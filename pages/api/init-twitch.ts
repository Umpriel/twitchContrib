import type { NextApiRequest, NextApiResponse } from 'next';
import { parse } from 'cookie';
import db from '../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // This route now just verifies the user is authorized
  // The actual client initialization happens at server startup
  try {
    const cookies = parse(req.headers.cookie || '');
    const userId = cookies.twitch_user_id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const user = await db.getUserById(userId);
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    if (!user.is_channel_owner) {
      return res.status(200).json({ message: 'Chat client not needed for non-channel owners' });
    }
    
    // No need to initialize client here anymore
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error in init-twitch endpoint:', error);
    res.status(500).json({ error: 'An error occurred' });
  }
} 