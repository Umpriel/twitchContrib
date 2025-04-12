import tmi from 'tmi.js';
import db from './db';

// Create and export a function to get the client
let chatClientPromise: Promise<tmi.Client> | null = null;

// Initialize and get chat client using access token
export const initAndGetChatClient = async (accessToken?: string) => {
  if (!chatClientPromise) {
    if (!process.env.TWITCH_CHANNEL) {
      throw new Error('Missing TWITCH_CHANNEL environment variable');
    }
    
    try {
      const client = new tmi.Client({
        identity: accessToken ? {
          username: process.env.TWITCH_BOT_USERNAME || process.env.TWITCH_CHANNEL,
          password: `oauth:${accessToken}`
        } : undefined,
        channels: [process.env.TWITCH_CHANNEL]
      });
      
      await client.connect();
      chatClientPromise = Promise.resolve(client);
      return client;
    } catch (error) {
      console.error('Failed to initialize chat client:', error);
      throw error;
    }
  }
  
  return chatClientPromise;
};

// Export a function to get a connected client
export const getChatClient = async () => {
  return chatClientPromise || initAndGetChatClient();
};

// OAuth token exchange and refresh functions
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