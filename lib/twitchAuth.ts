import tmi, { Client } from 'tmi.js';
import db, { getUserByChannelOwner } from './db';
import { User } from './db-interface';  // Make sure this import exists
import settings from '@/pages/settings';

// Make this a true global singleton using Node.js global object
// This ensures it persists across module reloads in development
declare global {
  var _twitchChatClient: Client | null;
  var _twitchIsConnecting: boolean;
  var _twitchConnectionPromise: Promise<Client> | null;
}

// Initialize globals if they don't exist
global._twitchChatClient = global._twitchChatClient || null;
global._twitchIsConnecting = global._twitchIsConnecting || false;
global._twitchConnectionPromise = global._twitchConnectionPromise || null;

export const resetChatClient = async () => {
  console.log('User logged out, but keeping client connection');
  return true;
};

export const verifyChatClient = (client: Client): boolean => {
  try {
    console.log('Chat client details:');
    console.log('- Connected:', client.readyState() === 'OPEN');
    console.log('- Channels:', client.getChannels());
    return client.readyState() === 'OPEN';
  } catch (error) {
    console.error('Error verifying chat client:', error);
    return false;
  }
};

export const initAndGetChatClient = async (accessToken?: string) => {
  // If already connected, return existing client
  if (global._twitchChatClient && global._twitchChatClient.readyState() === 'OPEN') {
    console.log('Using existing chat client connection');
    return global._twitchChatClient;
  }
  
  // If connection is in progress, wait for it
  if (global._twitchIsConnecting && global._twitchConnectionPromise) {
    console.log('Connection already in progress, waiting...');
    return global._twitchConnectionPromise;
  }
  
  if (!process.env.TWITCH_CHANNEL) {
    throw new Error('Missing TWITCH_CHANNEL environment variable');
  }
  
  global._twitchIsConnecting = true;
  global._twitchConnectionPromise = (async () => {
    try {
      console.log(`Initializing chat client for channel: ${process.env.TWITCH_CHANNEL}`);
      console.log(`Authentication: ${accessToken ? 'Using token' : 'Anonymous'}`);
      
      if (!accessToken) {
        console.warn('WARNING: No access token provided. Bot will only be able to read messages, not send them.');
      }

      // Disconnect existing client if any
      if (global._twitchChatClient) {
        console.log('Disconnecting existing client before creating a new one');
        try {
          await global._twitchChatClient.disconnect();
        } catch (e) {
          console.error('Error disconnecting existing client:', e);
        }
      }

      // Create new client
      global._twitchChatClient = new tmi.Client({
        options: { debug: true },
        identity: accessToken ? {
          username: process.env.TWITCH_BOT_USERNAME || process.env.TWITCH_CHANNEL,
          password: `oauth:${accessToken}`
        } : undefined,
        channels: [process.env.TWITCH_CHANNEL || 'defaultchannel']
      });
      
      await global._twitchChatClient.connect();
      
      // Verify the connection was successful
      const readyState = global._twitchChatClient.readyState();
      console.log(`Client connected with state: ${readyState}`);
      console.log(`Connected channels: ${global._twitchChatClient.getChannels().join(', ')}`);
      
      // Test authentication if we have a token
      if (accessToken) {
        try {
          let settings = await db.getSettings();
          if (!settings) {
            settings = {
              welcomeMessage: 'Bot connected and authenticated successfully!',
              showRejected: true,
              useHuhMode: false
            };
          }
          const channel = process.env.TWITCH_CHANNEL || 'defaultchannel';
          await global._twitchChatClient.say(channel, settings.welcomeMessage || 'Bot connected and authenticated successfully!');
          console.log(`Authentication test successful for channel ${channel} - bot can send messages`);
        } catch (e) {
          console.error('Authentication test failed - bot cannot send messages:', e);
          throw new Error('Failed to authenticate with Twitch. Please check your token.');
        }
      }
      
      return global._twitchChatClient;
    } catch (error) {
      console.error('Failed to initialize chat client:', error);
      // If we failed, allow retry
      global._twitchChatClient = null;
      console.log('twitchAuth.ts line 107')
      throw error;
    } finally {
      global._twitchIsConnecting = false;
      global._twitchConnectionPromise = null;
    }
  })();
  
  return global._twitchConnectionPromise;
};

export const getChatClient = async () => {
  if (!global._twitchChatClient) {
    console.log('No existing chat client, initializing a new one');

    try {
      const channelOwner = await getUserByChannelOwner() as User;
      if (channelOwner && channelOwner.access_token) {
        console.log('Using channel owner token for chat');
        return initAndGetChatClient(channelOwner.access_token);
      } else {
        console.log('No channel owner found, using anonymous connection');
        return initAndGetChatClient();
      }
    } catch (error) {
      console.error('Error getting channel owner:', error);
      return initAndGetChatClient();
    }
  }
  return global._twitchChatClient;
};

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