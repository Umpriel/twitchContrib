import { NextApiRequest, NextApiResponse } from 'next';
import { initializeServer } from '../../lib/server-init';
import db from '../../lib/db';
import { User } from '../../lib/db-interface';

// Initialize on server start, not on request
let isInitializing = false;
let isInitialized = false;

// This runs when the file is first imported during server startup
if (typeof window === 'undefined' && !isInitialized && !isInitializing) {
  isInitializing = true;
  console.log('Server starting, initializing Twitch client...');
  
  // Try to get the channel owner's token for auth
  const initWithChannelOwner = async () => {
    try {
      const channelName = process.env.TWITCH_CHANNEL?.toLowerCase();
      if (!channelName) {
        console.error('Missing TWITCH_CHANNEL environment variable');
        await initializeServer(); // Start without auth
        isInitialized = true;
        isInitializing = false;
        return;
      }
      
      console.log(`Searching for channel owner: ${channelName}`);
      
      // First try direct query for better debugging
      const users = await db.query(
        'SELECT * FROM users WHERE username = ? AND is_channel_owner = 1',
        [channelName]
      ) as User[];
      
      console.log(`Found ${users?.length || 0} matching users in database`);
      
      if (users && users.length > 0) {
        const channelOwner = users[0];
        console.log(`Found channel owner: ${channelOwner.username} (token expires: ${new Date(channelOwner.token_expires_at).toISOString()})`);
        
        if (channelOwner.access_token) {
          console.log('Using channel owner token for authentication');
          await initializeServer(channelOwner.access_token);
        } else {
          console.warn('Channel owner found but no access token available');
          await initializeServer();
        }
      } else {
        console.warn(`No channel owner found for ${channelName}, using anonymous connection`);
        await initializeServer();
      }
      
      isInitialized = true;
      isInitializing = false;
    } catch (error) {
      console.error('Error during server initialization:', error);
      isInitializing = false;
      
      // Try to initialize without auth as fallback
      try {
        await initializeServer();
        isInitialized = true;
      } catch (innerError) {
        console.error('Failed to initialize even without auth:', innerError);
      }
    }
  };
  
  initWithChannelOwner();
}

// API route to check initialization status
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({ 
    initialized: isInitialized,
    initializing: isInitializing
  });
}
