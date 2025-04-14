import type { NextApiRequest, NextApiResponse } from 'next';
import { serialize } from 'cookie';
import { resetChatClient } from '../../../lib/twitchAuth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // Reset the chat client state (but don't disconnect)
  try {
    await resetChatClient();
    console.log('Chat client state updated during logout');
  } catch (error) {
    console.error('Error updating chat client state during logout:', error);
  }

  const cookie = serialize('twitch_user_id', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: -1, // Expire immediately
    path: '/'
  });
  
  res.setHeader('Set-Cookie', cookie);
  return res.status(200).json({ success: true });
} 