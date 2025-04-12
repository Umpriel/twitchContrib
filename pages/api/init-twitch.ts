import type { NextApiRequest, NextApiResponse } from 'next';
import { initAndGetChatClient } from '../../lib/twitchAuth';
import { parse } from 'cookie';
import db from '../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Parse cookies to get user ID
    const cookies = parse(req.headers.cookie || '');
    const userId = cookies.twitch_user_id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Get user from database
    const user = await db.getUserById(userId);
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    // Check if user is channel owner
    if (!user.is_channel_owner) {
      return res.status(200).json({ message: 'Chat client not needed for non-channel owners' });
    }
    
    // Initialize the chat client with user tokens
    await initAndGetChatClient(user.access_token);
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Failed to connect to Twitch:', error);
    res.status(500).json({ error: 'Failed to initialize Twitch connection' });
  }
} 