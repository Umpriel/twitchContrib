import tmi from 'tmi.js';
import db from './db';
import { authProvider, initializeAuth } from './twitchOAuth';
import path from 'path';
import fs from 'fs';

// Initialize with checks
const initTwitchAuth = async () => {
  // Initialize auth
  const authInitialized = await initializeAuth();
  
  if (!authInitialized) {
    console.error('Twitch authentication not initialized. Please visit /auth-twitch to set up.');
    throw new Error('Missing Twitch authentication');
  }
  
  if (!process.env.TWITCH_CHANNEL) {
    throw new Error('Missing required Twitch channel environment variable');
  }
  
  try {
    // Get access token from the auth provider for use with tmi.js
    const tokenData = await authProvider.getAnyAccessToken();
    
    // Log more useful debug information
    console.log('Auth details:', {
      username: process.env.TWITCH_BOT_USERNAME,
      channel: process.env.TWITCH_CHANNEL,
      tokenScopes: tokenData.scope
    });

    // TMI.js requires adding the oauth: prefix in the password field
    const password = `oauth:${tokenData.accessToken}`;

    // Set up the TMI client with the token
    return new tmi.Client({
      options: { debug: true },
      identity: {
        username: process.env.TWITCH_BOT_USERNAME,
        password: password
      },
      channels: [process.env.TWITCH_CHANNEL]
    });
  } catch (error) {
    console.error('Failed to get access token:', error);
    throw new Error('Authentication failed - please reauthorize at /auth-twitch');
  }
};

// Create and export a function to get the client
let chatClientPromise: Promise<tmi.Client> | null = null;

// Initialize the client and set up all handlers
export const initAndGetChatClient = async () => {
  if (!chatClientPromise) {
    chatClientPromise = initTwitchAuth().then(client => {
      // Set up event handlers on the client
      client.on('message', async (channel, tags, message, self) => {
        if (self) return;
        if (!message.startsWith('!contrib')) return;
        
        // Create a more unique message fingerprint that includes username
        const username = tags.username || '';
        const messageFingerprint = `${username}:${message.replace(/\s+/g, ' ').trim()}`;
        const now = Date.now();
        
        // Check if we've seen this message recently
        const lastSeen = recentMessages.get(messageFingerprint);
        if (lastSeen && now - lastSeen < DUPLICATE_MESSAGE_WINDOW) {
          console.log(`Duplicate message detected within ${DUPLICATE_MESSAGE_WINDOW}ms:`, messageFingerprint);
          return;
        }
        
        // Mark this message as processed
        recentMessages.set(messageFingerprint, now);
        
        const contribution = parseContribution(message);
        if (!contribution) {
          client.say(channel, 'Usage: !contrib filename.ext [line:123] code \\n for new lines');
          return;
        }
        
        try {
          // Check for similar existing contributions
          if (await hasSimilarContribution(username, contribution.filename, contribution.code)) {
            client.say(channel, `${username}, you've already submitted similar code recently.`);
            return;
          }
          
          // Store the contribution
          await db.createContribution(
            username, 
            contribution.filename, 
            contribution.lineNumber, 
            contribution.code
          );
          
          // Update user submission tracking
          userSubmissions[username] = {
            time: now,
            hash: createCodeHash(contribution.filename, contribution.code)
          };
          
          client.say(channel, `Contribution received from ${username}! It will be reviewed soon.`);
        } catch (error) {
          console.error('Failed to store contribution:', error);
          client.say(channel, `Sorry ${username}, there was an error storing your contribution.`);
        }
      });
      
      client.on('connected', () => {
        console.log('Connected to Twitch chat');
      });
      
      client.on('disconnected', (reason) => {
        console.error('Disconnected from chat:', reason);
      });
      
      return client;
    });
  }
  return chatClientPromise;
};

// Export a function to get a connected client
export const getChatClient = async () => {
  return initAndGetChatClient();
};

// Track last submission time and message hash per user
const userSubmissions: { [key: string]: { time: number; hash: string } } = {};
const SUBMISSION_COOLDOWN = 2000; // 2 seconds cooldown

// Track message IDs to prevent duplicate responses
const processedMessageIds = new Set<string>();
const MESSAGE_ID_CLEANUP_INTERVAL = 300000; // Clean up every 5 minutes
const DUPLICATE_MESSAGE_WINDOW = 5000; // 5 seconds window to detect duplicates

// Add this new map to track recent messages with timestamps
const recentMessages = new Map<string, number>();

// Helper to create a hash of the code content
const createCodeHash = (filename: string, code: string) => {
  // Normalize the code by removing whitespace and converting to lowercase
  return `${filename}:${code.replace(/\s+/g, ' ').trim().toLowerCase()}`;
};

// Parse contribution command
const parseContribution = (message: string) => {
  // Remove any extra !contrib commands that might be in the message
  const cleanMessage = message.replace(/!contrib/g, '').trim();
  
  // First split the command parts
  const parts = cleanMessage.split(/\s+/);
  if (parts.length < 2) return null; // Need at least filename and code

  // Get filename (first part)
  const filename = parts[0];
  let lineNumber = null;
  let codeStartIndex = 1;

  // Check for line number
  if (parts[1].startsWith('line:')) {
    lineNumber = parseInt(parts[1].substring(5));
    codeStartIndex = 2;
  }

  // Get code (rest of the message)
  let code = parts.slice(codeStartIndex).join(' ');
  
  // Replace \n with actual newlines
  code = code.replace(/\\n/g, '\n');
  
  // Auto-indent the code for better readability
  const lines = code.split('\n');
  let indentLevel = 0;
  const indentedLines = lines.map(line => {
    const trimmedLine = line.trim();
    
    // Adjust indent level based on braces
    if (trimmedLine.endsWith('{')) {
      const spaces = '  '.repeat(indentLevel);
      indentLevel++;
      return spaces + trimmedLine;
    } else if (trimmedLine.startsWith('}')) {
      indentLevel = Math.max(0, indentLevel - 1);
      const spaces = '  '.repeat(indentLevel);
      return spaces + trimmedLine;
    } else {
      const spaces = '  '.repeat(indentLevel);
      return spaces + trimmedLine;
    }
  });
  
  code = indentedLines.join('\n');
  
  return { filename, lineNumber, code };
};

// Check if similar contribution exists
const hasSimilarContribution = async (username: string, filename: string, code: string) => {
  // Normalize the code for comparison but preserve important variations
  const normalizedCode = code.replace(/\s+/g, ' ').trim();
  
  try {
    return await db.checkSimilarContribution(username, filename, normalizedCode);
  } catch (error) {
    console.error('Error checking for similar contributions:', error);
    return false;
  }
};

// Clean up old submission records periodically
setInterval(() => {
  const now = Date.now();
  for (const [username, submission] of Object.entries(userSubmissions)) {
    if (now - submission.time > SUBMISSION_COOLDOWN * 2) {
      delete userSubmissions[username];
    }
  }
}, SUBMISSION_COOLDOWN * 2);

// Ensure the cleanup interval is appropriate
setInterval(() => {
  console.log(`Cleaning up ${processedMessageIds.size} message IDs`);
  processedMessageIds.clear();
}, MESSAGE_ID_CLEANUP_INTERVAL);

// Add this cleanup for recent messages
setInterval(() => {
  const now = Date.now();
  let cleanupCount = 0;
  
  recentMessages.forEach((timestamp, messageKey) => {
    if (now - timestamp > DUPLICATE_MESSAGE_WINDOW) {
      recentMessages.delete(messageKey);
      cleanupCount++;
    }
  });
  
  if (cleanupCount > 0) {
    console.log(`Cleaned up ${cleanupCount} outdated message records, ${recentMessages.size} remaining`);
  }
}, DUPLICATE_MESSAGE_WINDOW);

export async function exchangeCode(code: string) {
  const response = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      client_id: process.env.NEXT_PUBLIC_TWITCH_CLIENT_ID!,
      client_secret: process.env.TWITCH_CLIENT_SECRET!,
      code,
      grant_type: 'authorization_code',
      redirect_uri: process.env.NEXT_PUBLIC_TWITCH_REDIRECT_URI!
    })
  });

  if (!response.ok) {
    throw new Error('Failed to exchange code for token');
  }

  return response.json();
}

export async function refreshAuthToken(refreshToken: string) {
  const response = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      client_id: process.env.NEXT_PUBLIC_TWITCH_CLIENT_ID!,
      client_secret: process.env.TWITCH_CLIENT_SECRET!,
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    })
  });

  if (!response.ok) {
    throw new Error('Failed to refresh token');
  }

  return response.json();
} 