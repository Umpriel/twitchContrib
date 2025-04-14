import { Client } from 'tmi.js';

export function verifyClient(client: Client): void {
  if (!client) {
    throw new Error('Chat client is not initialized');
  }
  
  if (!client.say) {
    throw new Error('Chat client is missing say method');
  }
}

export async function saySafe(client: Client, channel: string, message: string): Promise<void> {
  try {
    // Ensure the channel name starts with #
    const formattedChannel = channel.startsWith('#') ? channel : `#${channel}`;
    await client.say(formattedChannel, message);
  } catch (error) {
    console.error('Error sending message to chat:', error);
  }
} 