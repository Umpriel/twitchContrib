import tmi from 'tmi.js';
import { getUserByChannelOwner } from './db';


let chatClientPromise: Promise<tmi.Client> | null = null;


export const resetChatClient = async () => {
  if (chatClientPromise) {
    try {
      const client = await chatClientPromise;
      console.log('Disconnecting existing chat client');
      await client.disconnect();
    } catch (error) {
      console.error('Error disconnecting chat client:', error);
    }
    chatClientPromise = null;
    console.log('Chat client reset completed');
  }
};


export const initAndGetChatClient = async (accessToken?: string) => {
  if (!chatClientPromise) {
    if (!process.env.TWITCH_CHANNEL) {
      throw new Error('Missing TWITCH_CHANNEL environment variable');
    }
    
    try {

      const client = new tmi.Client({
        options: { debug: true },  // Enable debug mode like in old code
        identity: accessToken ? {
          username: process.env.TWITCH_BOT_USERNAME || process.env.TWITCH_CHANNEL,
          password: `oauth:${accessToken}`
        } : undefined,
        channels: [process.env.TWITCH_CHANNEL]
      });
      
      await client.connect();
      

      const connectedChannels = client.getChannels();
      if (connectedChannels.length === 0) {
        console.log(`Joining channel: ${process.env.TWITCH_CHANNEL}`);
        await client.join(process.env.TWITCH_CHANNEL);
      }
      

      console.log('Client connected to channels:', client.getChannels());
      
      chatClientPromise = Promise.resolve(client);
      return client;
    } catch (error) {
      console.error('Failed to initialize chat client:', error);
      throw error;
    }
  }
  
  return chatClientPromise;
};


export const getChatClient = async () => {
  if (!chatClientPromise) {
    console.log('No existing chat client, initializing a new one');

    try {
      const channelOwner = await getUserByChannelOwner();
      if (channelOwner) {
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
  return chatClientPromise;
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


export const verifyChatClient = async () => {
  try {
    const client = await getChatClient();
    console.log('Chat client details:');
    console.log('- Connected:', client.readyState() === 'OPEN');
    console.log('- Channels:', client.getChannels());
    return client.readyState() === 'OPEN';
  } catch (error) {
    console.error('Error verifying chat client:', error);
    return false;
  }
}; 