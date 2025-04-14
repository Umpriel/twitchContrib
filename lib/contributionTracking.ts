// TODO: narrow down the unacceptable similarity threshold

import { getChatClient, verifyChatClient } from './twitchAuth';
import db from './db';
import { Client } from 'tmi.js';


const userSubmissions: { [key: string]: { time: number; hash: string } } = {};
const SUBMISSION_COOLDOWN = 2000; // 2 seconds cooldown
const processedMessageIds = new Set<string>();
const MESSAGE_ID_CLEANUP_INTERVAL = 300000; // Clean up every 5 minutes
const DUPLICATE_MESSAGE_WINDOW = 5000; // 5 seconds window to detect duplicates
const recentMessages = new Map<string, number>();


let listenersInitialized = false;


const createCodeHash = (filename: string, code: string) => {
  // Normalize code more thoroughly:
  // 1. Remove comments
  // 2. Convert to lowercase
  // 3. Remove all whitespace
  // 4. Remove any quotes and replace with standard quotes
  const normalizedCode = code
    .replace(/\/\/.*$/gm, '') // Remove single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
    .toLowerCase() // Case-insensitive
    .replace(/\n/g, '') // Remove newlines
    .replace(/\s+/g, '') // Remove all whitespace
    .replace(/\r/g, ''); // Remove carriage returns

  return normalizedCode + filename;
};


const parseContribution = (message: string) => {
  // Remove the "!contrib" command and trim whitespace
  const cleanMessage = message.replace(/!contrib/g, '').trim();
  
  // Split by whitespace to process arguments
  const parts = cleanMessage.split(/\s+/);
  if (parts.length < 2) return null; // Need at least filename and code
  
  const filename = parts[0];
  let lineNumber = null;
  let codeStartIndex = 1;

  // Look for -l flag followed by a number
  for (let i = 1; i < parts.length - 1; i++) {
    if (parts[i] === '-l') {
      // Line number is the next part
      lineNumber = parseInt(parts[i + 1]);
      if (!isNaN(lineNumber)) {
        // If valid line number, code starts after line number
        codeStartIndex = i + 2;
      }
      break;
    }
  }

  // Join the remaining parts as code
  let code = parts.slice(codeStartIndex).join(' ');
  code = code.replace(/\\n/g, '\n');

  // Handle indentation and code formatting as you did before
  const lines = code.split('\n');
  let indentLevel = 0;
  const indentedLines = lines.map(line => {
    const trimmedLine = line.trim();


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

// TODO: narrow down the unacceptable similarity threshold
/*const hasSimilarContribution = async (username: string, filename: string, code: string) => {
  // Normalize the code more thoroughly
  const normalizedCode = code
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, '')
    .toLowerCase();
  
  try {
    // Use a more sophisticated db query with configurable timeframe
    return await db.getSimilarContributions(username, filename, normalizedCode);
  } catch (error) {
    console.error('Error checking for similar contributions:', error);
    return false;
  }
};
*/


const contributionsByFilename = async (filename: string) => {
  try {
    const contributions = await db.getContributionsByFilename(filename);
    return contributions;
  } catch (error) {
    console.error('Error fetching contributions by filename:', error);
    return [];
  }
};

setInterval(() => {
  const now = Date.now();
  for (const [username, submission] of Object.entries(userSubmissions)) {
    if (now - submission.time > SUBMISSION_COOLDOWN * 2) {
      delete userSubmissions[username];
    }
  }
}, SUBMISSION_COOLDOWN * 2);

setInterval(() => {
  console.log(`Cleaning up ${processedMessageIds.size} message IDs`);
  processedMessageIds.clear();
}, MESSAGE_ID_CLEANUP_INTERVAL);

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


export async function processMessage(channel: string, tags: Record<string, unknown>, message: string, client: Client) {
  verifyChatClient(client);
  if (tags['id'] && processedMessageIds.has(String(tags['id']))) {
    return;
  }

  if (tags['id']) {
    processedMessageIds.add(String(tags['id']));
  }

  if (!message.startsWith('!contrib')) {
    return;
  }

  // Check for help command - do this early before any other processing
  const cleanMessage = message.trim().toLowerCase();
  if (cleanMessage === '!contrib --help' || cleanMessage === '!contrib -h' || cleanMessage === '!contrib help') {
    const username = String(tags['display-name'] || tags['username']);
    try {
      await client.say(channel, `@${username} 📝 HOW TO USE !CONTRIB:

1️⃣ For specific line: !contrib filename -l line_number code
2️⃣ Without line: !contrib filename code

📌 EXAMPLES:
• !contrib main.js -l 10 console.log("Hello World");
• !contrib style.css body { margin: 0; }`);
    } catch (error) {
      console.error('Error sending help message:', error);
    }
    return; // Exit early - don't process as a contribution
  }

  // Continue with existing contribution processing
  const username = String(tags['display-name'] || tags['username']);
  console.log(`Processing contribution from ${username}: ${message}`);

  const contribution = parseContribution(message);
  if (!contribution) {
    client.say(channel, `@${username} Invalid contribution format. Use: !contrib filename -l line_number code or !contrib --help`);
    return;
  }

  const { filename, lineNumber, code } = contribution;
  const codeHash = createCodeHash(filename, code);
  const formattedChannel = channel.startsWith('#') ? channel : `#${channel}`;

  // Rate limiting check
  const now = Date.now();
  if (userSubmissions[username]) {
    const timeSinceLastSubmission = now - userSubmissions[username].time;
    if (timeSinceLastSubmission < SUBMISSION_COOLDOWN) {
      console.log(`Rate limiting ${username}, submitted too quickly`);
      try {
        await client.say(formattedChannel, `@${username} Chill out Dude, and stop spamming before i smack you.`);
      } catch (error) {
        console.error('Error sending rate limit notification:', error);
      }
      return;
    }
  }

  // Enhanced conflict checks with username
  try {
    const conflicts = await db.checkContributionConflicts(filename, lineNumber, codeHash, username);
    
    // Personal duplicate check (same user, same code)
    if (conflicts.personalDuplicate) {
      console.log(`Personal duplicate from ${username}`);
      try {
        await client.say(formattedChannel, `@${username} You've already submitted this exact code.`);
      } catch (error) {
        console.error('Error sending notification:', error);
      }
      return;
    }
    
    // Global accepted check (any user, code already accepted)
    if (conflicts.acceptedDuplicate) {
      console.log(`Accepted duplicate from ${username}`);
      try {
        await client.say(formattedChannel, `@${username} This code has already been accepted.`);
      } catch (error) {
        console.error('Error sending notification:', error);
      }
      return;
    }
    
    // Line conflict check (different user, same line, pending status)
    if (conflicts.lineConflict) {
      console.log(`Line conflict from ${username} for line ${lineNumber}`);
      try {
        await client.say(formattedChannel, `@${username} Line ${lineNumber} already has a pending submission from another user. Try a different line!`);
      } catch (error) {
        console.error('Error sending notification:', error);
      }
      return;
    }
    
  } catch (error) {
    console.error('Error checking for conflicts:', error);
    // Continue with submission even if conflict check fails
  }

  // Save contribution to database
  try {
    const result = await db.createContribution(
      username,
      filename,
      lineNumber,
      code
    );

    userSubmissions[username] = {
      time: now,
      hash: codeHash
    };

    console.log(`Contribution from ${username} saved in the DB successfully`);
    
    // Send confirmation message
    try {
      await client.say(channel, `@${username} Contribution saved! Thank you for your code snippet.`);
      console.log('Chat message sent successfully');
    } catch (chatError) {
      console.error('Error sending chat message:', chatError);
    }
    
  } catch (error) {
    console.error('Error saving contribution:', error);
    console.error('Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));

    try {
      await client.say(formattedChannel, `@${username} Failed to save contribution. Please try again later.`);
    } catch (chatError) {
      console.error('Additionally failed to send error notification:', chatError);
    }
  }
}


export async function initContributionTracking(client: Client) {
  try {

    if (listenersInitialized) {
      console.log('Contribution tracking already initialized, skipping');
      return true;
    }


    client.on('message', (channel, tags, message, self) => {

      if (self) return;
      processMessage(channel, tags, message, client)
        .catch(err => console.error('Error processing message:', err));
    });

    console.log('Contribution tracking initialized successfully');
    listenersInitialized = true;
    return true;
  } catch (error) {
    console.error('Failed to initialize contribution tracking:', error);
    return false;
  }
} 