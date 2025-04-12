import { NextApiRequest, NextApiResponse } from 'next';
import { parse } from 'cookie';
import db from './db';
import { refreshAuthToken } from './twitchAuth';
import { serialize } from 'cookie';

export async function withAuth(
  req: NextApiRequest,
  res: NextApiResponse,
  handler: (req: NextApiRequest, res: NextApiResponse, userId: string) => Promise<void>
) {
  // Parse cookies
  const cookies = parse(req.headers.cookie || '');
  const userId = cookies.twitch_user_id;
  
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  // Get user from database
  const user = await db.getUserById(userId);
  
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  // Check if token is expired
  if (user.token_expires_at < Date.now()) {
    try {
      // Try to refresh the token
      const newTokenData = await refreshAuthToken(user.refresh_token);
      
      // Update user with new tokens
      await db.createOrUpdateUser({
        ...user,
        access_token: newTokenData.access_token,
        refresh_token: newTokenData.refresh_token,
        token_expires_at: Date.now() + (newTokenData.expires_in * 1000)
      });
      
      // Update the cookie with new expiration
      const cookie = serialize('twitch_user_id', userId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60, // 30 days
        path: '/'
      });
      
      res.setHeader('Set-Cookie', cookie);
    } catch (error) {
      console.error('Error refreshing token:', error);
      return res.status(401).json({ error: 'Session expired, please log in again' });
    }
  }
  
  // Check if user is channel owner
  if (!user.is_channel_owner) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  // Call the handler with the authenticated userId
  await handler(req, res, userId);
} 