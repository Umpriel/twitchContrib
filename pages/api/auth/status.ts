import type { NextApiRequest, NextApiResponse } from 'next';
import { parse } from 'cookie';
import db from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const cookies = parse(req.headers.cookie || '');
    const userId = cookies.twitch_user_id;
    
    if (!userId) {
      return res.status(200).json({ authenticated: false });
    }
    
    const user = await db.getUserById(userId);
    
    if (!user) {
      return res.status(200).json({ authenticated: false });
    }
    
    return res.status(200).json({ 
      authenticated: true,
      isChannelOwner: user.is_channel_owner || false,
      username: user.username
    });
  } catch (error) {
    console.error('Error checking auth status:', error);
    res.status(500).json({ error: 'Failed to check authentication status' });
  }
} 