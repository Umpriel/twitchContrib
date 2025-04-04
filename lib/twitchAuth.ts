import tmi from 'tmi.js';
import db from './db';

if (!process.env.TWITCH_OAUTH_TOKEN || !process.env.TWITCH_CHANNEL) {
  throw new Error('Missing required Twitch environment variables');
}

export const chatClient = new tmi.Client({
  options: { debug: false }, // Set to false to reduce noise in logs
  identity: {
    username: process.env.TWITCH_BOT_USERNAME || 'contrib-bot',
    password: process.env.TWITCH_OAUTH_TOKEN
  },
  channels: [process.env.TWITCH_CHANNEL]
});

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

  // Get the rest as code and preserve indentation
  const code = parts.slice(codeStartIndex)
    .join(' ')
    .replace(/\\n/g, '\n')
    .split('\n')
    .map((line, index, array) => {
      const trimmed = line.trim();
      const indentLevel = array
        .slice(0, index)
        .reduce((level, prevLine) => {
          return level + (prevLine.includes('{') ? 1 : 0) - (prevLine.includes('}') ? 1 : 0);
        }, 0);
      return '  '.repeat(indentLevel) + trimmed;
    })
    .join('\n');

  if (!code) return null;

  return {
    filename: filename.replace(/[^a-zA-Z0-9._-]/g, ''), // Sanitize filename
    lineNumber,
    code
  };
};

// Check if similar contribution exists
const hasSimilarContribution = (username: string, filename: string, code: string) => {
  // Normalize the code for comparison but preserve important variations
  // This should distinguish between 'primary' and 'secondary' variants
  const normalizedCode = code.replace(/\s+/g, ' ').trim();
  
  const stmt = db.prepare(`
    SELECT * FROM contributions 
    WHERE username = ? 
    AND filename = ? 
    AND REPLACE(REPLACE(code, '\n', ' '), '  ', ' ') = ?
    AND created_at > datetime('now', '-1 hour')
    AND created_at < datetime('now', '-1 second')
  `);
  const existing = stmt.get(username, filename, normalizedCode);
  return !!existing;
};

chatClient.on('message', async (channel, tags, message, self) => {
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
    chatClient.say(channel, 'Usage: !contrib filename.ext [line:123] code \\n for new lines');
    return;
  }

  try {
    // Check for similar existing contributions BEFORE storing the new one
    if (hasSimilarContribution(username, contribution.filename, contribution.code)) {
      chatClient.say(channel, `${username}, you've already submitted similar code recently.`);
      return;
    }
    
    const stmt = db.prepare(
      'INSERT INTO contributions (username, filename, line_number, code) VALUES (?, ?, ?, ?)'
    );
    stmt.run(username, contribution.filename, contribution.lineNumber, contribution.code);
    
    // Update submission tracking after successful insertion
    userSubmissions[username] = {
      time: now,
      hash: createCodeHash(contribution.filename, contribution.code)
    };
    
    chatClient.say(channel, `Contribution received from ${username}! It will be reviewed soon.`);
  } catch (error) {
    console.error('Failed to store contribution:', error);
    chatClient.say(channel, `Sorry ${username}, there was an error storing your contribution.`);
  }
});

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

chatClient.on('connected', () => {
  console.log('Connected to Twitch chat');
});

chatClient.on('disconnected', (reason) => {
  console.error('Disconnected from chat:', reason);
}); 