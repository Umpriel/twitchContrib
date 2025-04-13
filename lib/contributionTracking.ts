// TODO: narrow down the unacceptable similarity threshold

import { getChatClient, verifyChatClient } from './twitchAuth';
import db from './db';


const userSubmissions: { [key: string]: { time: number; hash: string } } = {};
const SUBMISSION_COOLDOWN = 2000; // 2 seconds cooldown
const processedMessageIds = new Set<string>();
const MESSAGE_ID_CLEANUP_INTERVAL = 300000; // Clean up every 5 minutes
const DUPLICATE_MESSAGE_WINDOW = 5000; // 5 seconds window to detect duplicates
const recentMessages = new Map<string, number>();


let listenersInitialized = false;

verifyChatClient();

const createCodeHash = (filename: string, code: string) => {
  // Normalize code more thoroughly:
  // 1. Remove comments
  // 2. Convert to lowercase
  // 3. Remove all whitespace
  // 4. Remove any quotes and replace with standard quotes
  const normalizedCode = code
    .replace(/\/\/.*$/gm, '') // Remove single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
    .replace(/\s+/g, '') // Remove all whitespace
    .toLowerCase() // Case-insensitive
    .replace(/['"]/g, '"'); // Normalize quotes

  return `${filename}:${normalizedCode}`;
};


const parseContribution = (message: string) => {

  const cleanMessage = message.replace(/!contrib/g, '').trim();
  

  const parts = cleanMessage.split(/\s+/);
  if (parts.length < 2) return null; // Need at least filename and code


  const filename = parts[0];
  let lineNumber = null;
  let codeStartIndex = 1;


  if (parts[1].startsWith('line:')) {
    lineNumber = parseInt(parts[1].substring(5));
    codeStartIndex = 2;
  }


  let code = parts.slice(codeStartIndex).join(' ');
  

  code = code.replace(/\\n/g, '\n');
  

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
const hasSimilarContribution = async (username: string, filename: string, code: string) => {
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


export async function processMessage(channel: string, tags: any, message: string) {

  if (tags['id'] && processedMessageIds.has(tags['id'])) {
    return;
  }
  

  if (tags['id']) {
    processedMessageIds.add(tags['id']);
  }
  

  if (!message.startsWith('!contrib')) {
    return;
  }
  
  const username = tags['display-name'] || tags['username'];
  
  console.log(`Processing contribution from ${username}: ${message}`);
  

  const contribution = parseContribution(message);
  if (!contribution) {

    const client = await getChatClient();
    client.say(channel, `@${username} Invalid contribution format. Use: !contrib filename:line_number:code`);
    return;
  }
  
  const { filename, lineNumber, code } = contribution;
  

  const codeHash = createCodeHash(filename, code);
  

  const now = Date.now();
  if (userSubmissions[username]) {
    const timeSinceLastSubmission = now - userSubmissions[username].time;
    

    if (timeSinceLastSubmission < SUBMISSION_COOLDOWN) {
      console.log(`Rate limiting ${username}, submitted too quickly`);
      return;
    }
    

    if (userSubmissions[username].hash === codeHash) {
      console.log(`Duplicate contribution from ${username}`);
      

      try {
        const client = await getChatClient();
        const formattedChannel = channel.startsWith('#') ? channel : `#${channel}`;
        await client.say(formattedChannel, `@${username} You've already submitted this exact contribution.`);
      } catch (error) {
        console.error('Error sending duplicate notification:', error);
      }
      
      return;
    }
  }
  

/* SIMILARITY CHECK DISABLED
  const similarContributions = await hasSimilarContribution(username, filename, code);
  if (similarContributions.length > 0) {
    console.log(`Similar contribution(s) already exist from ${username}, found ${similarContributions.length}`);
    
    // Add notification for similar contributions - send only ONCE
    try {
      const client = await getChatClient();
      const formattedChannel = channel.startsWith('#') ? channel : `#${channel}`;
      await client.say(formattedChannel, `@${username} Similar contribution already exists.`);
    } catch (error) {
      console.error('Error sending duplicate notification:', error);
    }
    
    // Save the contribution anyway, but mark it as a duplicate
    await db.createContribution(
      username,
      filename,
      lineNumber,
      code,
      'duplicate'  // Mark as duplicate
    );
    
    return;
  }
  */
  

  try {
    await db.createContribution(
      username,
      filename,
      lineNumber,
      code
    );
    

    userSubmissions[username] = {
      time: now,
      hash: codeHash
    };
    

    console.log('Getting chat client to send notification');
    const client = await getChatClient();
    console.log('Chat client connected:', !!client);
    console.log('Chat client options:', JSON.stringify(client.getOptions(), null, 2));
    console.log('Chat client channels:', client.getChannels());
    console.log('Sending to channel:', channel);
    
    try {

      const message = `@${username} Contribution saved! Thank you for your code snippet.`;
      console.log(`Attempting to send: "${message}" to ${channel}`);
      

      const formattedChannel = channel.startsWith('#') ? channel : `#${channel}`;
      

      await client.say(formattedChannel, message);
      
      console.log('Chat message sent successfully');
    } catch (chatError) {
      console.error('Error sending chat message:', chatError);
    }
    
    console.log(`Contribution from ${username} saved successfully`);
  } catch (error) {
    console.error('Error saving contribution:', error);
    

    const client = await getChatClient();
    client.say(channel, `@${username} Failed to save contribution. Please try again later.`);
  }
}


export async function initContributionTracking() {
  try {

    if (listenersInitialized) {
      console.log('Contribution tracking already initialized, skipping');
      return true;
    }

    const client = await getChatClient();
    

    client.on('message', (channel, tags, message, self) => {

      if (self) return;
      

      processMessage(channel, tags, message)
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