import { getChatClient } from './twitchAuth';
import db from './db';

// Track last submission time and message hash per user
const userSubmissions: { [key: string]: { time: number; hash: string } } = {};
const SUBMISSION_COOLDOWN = 2000; // 2 seconds cooldown
const processedMessageIds = new Set<string>();
const MESSAGE_ID_CLEANUP_INTERVAL = 300000; // Clean up every 5 minutes
const DUPLICATE_MESSAGE_WINDOW = 5000; // 5 seconds window to detect duplicates
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

// Cleanup intervals
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

// Process incoming chat messages for contributions
export async function processMessage(channel: string, tags: any, message: string) {
  // Skip if we've already processed this message
  if (tags['id'] && processedMessageIds.has(tags['id'])) {
    return;
  }
  
  // Mark this message as processed
  if (tags['id']) {
    processedMessageIds.add(tags['id']);
  }
  
  // Check if this is a contribution command
  if (!message.startsWith('!contrib')) {
    return;
  }
  
  const username = tags['display-name'] || tags['username'];
  
  // Parse the contribution
  const contribution = parseContribution(message);
  if (!contribution) {
    return;
  }
  
  const { filename, lineNumber, code } = contribution;
  
  // Create a hash of this contribution
  const codeHash = createCodeHash(filename, code);
  
  // Check for rate limiting
  const now = Date.now();
  if (userSubmissions[username]) {
    const timeSinceLastSubmission = now - userSubmissions[username].time;
    
    // Rate limit: Don't allow submissions too quickly
    if (timeSinceLastSubmission < SUBMISSION_COOLDOWN) {
      console.log(`Rate limiting ${username}, submitted too quickly`);
      return;
    }
    
    // Duplicate check: Don't allow the same contribution twice in a row
    if (userSubmissions[username].hash === codeHash) {
      console.log(`Duplicate contribution from ${username}`);
      return;
    }
  }
  
  // Check for similar contributions already in the database
  const hasSimilar = await hasSimilarContribution(username, filename, code);
  if (hasSimilar) {
    console.log(`Similar contribution already exists from ${username}`);
    return;
  }
  
  // Create the contribution in the database
  try {
    await db.createContribution(
      username,
      filename,
      lineNumber,
      code
    );
    
    // Update the user's submission record
    userSubmissions[username] = {
      time: now,
      hash: codeHash
    };
    
    console.log(`Contribution from ${username} saved successfully`);
  } catch (error) {
    console.error('Error saving contribution:', error);
  }
}

// Export the initialization function that sets up chat listeners
export async function initContributionTracking() {
  try {
    const client = await getChatClient();
    
    // Set up message listener
    client.on('message', async (channel, tags, message, self) => {
      // Skip messages from the bot itself
      if (self) return;
      
      // Process the message
      await processMessage(channel, tags, message);
    });
    
    return true;
  } catch (error) {
    console.error('Failed to initialize contribution tracking:', error);
    return false;
  }
} 