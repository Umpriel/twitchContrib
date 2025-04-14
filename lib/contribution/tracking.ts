import { Client } from 'tmi.js';
import { commands } from '../commands';
import { verifyClient } from '../utils/chat';

// Store processed message IDs to prevent duplicates
const processedMessageIds = new Set<string>();

export async function processMessage(channel: string, tags: Record<string, unknown>, message: string, client: Client): Promise<void> {
  verifyClient(client);
  
  // Prevent duplicate processing
  if (tags['id'] && processedMessageIds.has(String(tags['id']))) {
    return;
  }

  if (tags['id']) {
    processedMessageIds.add(String(tags['id']));
  }

  // Only process contrib commands
  if (!message.startsWith('!contrib')) {
    return;
  }

  const username = String(tags['display-name'] || tags['username']);
  console.log(`Processing message from ${username}: ${message}`);

  // Try each command handler in order
  for (const commandHandler of commands) {
    if (commandHandler.matches(message)) {
      const context = {
        channel,
        username,
        tags,
        message,
        client
      };
      
      try {
        const handled = await commandHandler.execute(context);
        if (handled) {
          return; // Command was handled, no need to try other handlers
        }
      } catch (error) {
        console.error('Error handling command:', error);
      }
    }
  }
}

export async function initContributionTracking(client: Client): Promise<void> {
  console.log('Initializing contribution tracking...');

  // Ensure we don't have any duplicate listeners
  client.removeAllListeners('message');
  
  // Register the message handler
  client.on('message', (channel, tags, message, self) => {
    if (self) return; // Ignore messages from the bot itself
    processMessage(channel, tags, message, client).catch(console.error);
  });
  
  console.log('Contribution tracking initialized');
} 