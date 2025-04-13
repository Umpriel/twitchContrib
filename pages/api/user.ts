import type { NextApiRequest, NextApiResponse } from 'next';
import { parse } from 'cookie';
import db from '../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {

  const cookies = parse(req.headers.cookie || '');
  const userId = cookies.twitch_user_id;
  
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {

    const user = await db.getUserById(userId);
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    

    return res.status(200).json({
      id: user.id,
      username: user.username,
      isChannelOwner: user.is_channel_owner
    });
  } catch (error) {
    console.error('Error getting user info:', error);
    return res.status(500).json({ error: 'Failed to get user information' });
  }
} 