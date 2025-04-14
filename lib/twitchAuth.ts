import tmi, { Client } from 'tmi.js';
import { getUserByChannelOwner } from './db';
import { User } from './db-interface';  // Make sure this import exists

// Make this a true global singleton using Node.js global object
declare global {
  var _twitchChatClient: Client | null;
  var _twitchIsConnecting: boolean;
  var _twitchConnectionPromise: Promise<Client> | null;
  var _hasTestedAuth: boolean;
}

// Initialize globals if they don't exist
global._twitchChatClient = global._twitchChatClient || null;
global._twitchIsConnecting = global._twitchIsConnecting || false;
global._twitchConnectionPromise = global._twitchConnectionPromise || null;
global._hasTestedAuth = global._hasTestedAuth || false;

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
      
      // Test authentication only once
      if (accessToken && !global._hasTestedAuth) {
        try {
          await global._twitchChatClient.say(process.env.TWITCH_CHANNEL || 'umpriel', 'Bot connected and authenticated successfully!');
          console.log('Authentication test successful - bot can send messages');
          global._hasTestedAuth = true;
        } catch (e) {
          console.error('Authentication test failed - bot cannot send messages:', e);
          // Don't throw here, just log the error and continue
        }
      }
      
      return global._twitchChatClient;
    } catch (error) {
      console.error('Failed to initialize chat client:', error);
      // If we failed, allow retry
      global._twitchChatClient = null;
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