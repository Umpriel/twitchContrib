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
const MESSAGE_ID_CLEANUP_INTERVAL = 60000; // Clean up every minute

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
  // Normalize the code for comparison
  const normalizedCode = code.replace(/\s+/g, ' ').trim().toLowerCase();
  
  const stmt = db.prepare(`
    SELECT * FROM contributions 
    WHERE username = ? 
    AND filename = ? 
    AND LOWER(REPLACE(REPLACE(code, '\n', ' '), '  ', ' ')) = ?
    AND created_at > datetime('now', '-1 hour')
  `);
  const existing = stmt.get(username, filename, normalizedCode);
  return !!existing;
};

chatClient.on('message', async (channel, tags, message, self) => {
  if (self) return;
  if (!message.startsWith('!contrib')) return;

  // Check if we've already processed this message
  const messageId = tags.id;
  if (!messageId || processedMessageIds.has(messageId)) {
    return;
  }
  processedMessageIds.add(messageId);

  const username = tags.username || '';
  const now = Date.now();
  
  // Check cooldown first
  const lastSubmission = userSubmissions[username];
  if (lastSubmission && now - lastSubmission.time < SUBMISSION_COOLDOWN) {
    return; // Too soon, ignore
  }

  const contribution = parseContribution(message);
  if (!contribution) {
    chatClient.say(channel, 'Usage: !contrib filename.ext [line:123] code \\n for new lines');
    return;
  }

  // Check for similar existing contributions
  if (hasSimilarContribution(username, contribution.filename, contribution.code)) {
    chatClient.say(channel, `${username}, you've already submitted similar code recently.`);
    return;
  }

  // Update submission tracking
  userSubmissions[username] = {
    time: now,
    hash: createCodeHash(contribution.filename, contribution.code)
  };

  try {
    const stmt = db.prepare(
      'INSERT INTO contributions (username, filename, line_number, code) VALUES (?, ?, ?, ?)'
    );
    stmt.run(username, contribution.filename, contribution.lineNumber, contribution.code);
    
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

// Clean up old message IDs periodically
setInterval(() => {
  processedMessageIds.clear();
}, MESSAGE_ID_CLEANUP_INTERVAL);

chatClient.on('connected', () => {
  console.log('Connected to Twitch chat');
});

chatClient.on('disconnected', (reason) => {
  console.error('Disconnected from chat:', reason);
}); 