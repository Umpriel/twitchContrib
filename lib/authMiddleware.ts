import { NextApiRequest, NextApiResponse } from 'next';
import { parse } from 'cookie';
import db from './db';
import { refreshAuthToken } from './twitchAuth';
import { serialize } from 'cookie';

type ApiHandler = (req: NextApiRequest, res: NextApiResponse) => Promise<void>;

export async function withAuth(
  req: NextApiRequest, 
  res: NextApiResponse,
  handler: ApiHandler
): Promise<void> {
  const cookies = parse(req.headers.cookie || '');
  const userId = cookies.twitch_user_id;
  
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  const user = await db.getUserById(userId);
  
  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }
  
  return handler(req, res);
}

export async function withChannelOwnerAuth(
  req: NextApiRequest,
  res: NextApiResponse,
  handler: ApiHandler
): Promise<void> {
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
    return res.status(403).json({ error: 'Only channel owners can access this resource' });
  }
  
  return handler(req, res);
}

export async function withAuthHandler(
  req: NextApiRequest,
  res: NextApiResponse,
  handler: (req: NextApiRequest, res: NextApiResponse, userId: string) => Promise<void>
) {
  
  const cookies = parse(req.headers.cookie || '');
  const userId = cookies.twitch_user_id;
  
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  

  const user = await db.getUserById(userId);
  
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  

  if (user.token_expires_at < Date.now()) {
    try {

      const newTokenData = await refreshAuthToken(user.refresh_token);
      

      await db.createOrUpdateUser({
        ...user,
        access_token: newTokenData.access_token,
        refresh_token: newTokenData.refresh_token,
        token_expires_at: Date.now() + (newTokenData.expires_in * 1000)
      });
      

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
  

  if (!user.is_channel_owner) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  

  await handler(req, res, userId);
} 