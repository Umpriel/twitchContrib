import type { NextApiRequest, NextApiResponse } from 'next';
import { parse } from 'cookie';
import db from '../../lib/db';
import { refreshAuthToken } from '../../lib/twitchAuth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {

  const cookies = parse(req.headers.cookie || '');
  const userId = cookies.twitch_user_id;
  
  if (!userId) {
    return res.status(200).json({ authenticated: false, isChannelOwner: false });
  }
  
  try {

    const user = await db.getUserById(userId);
    
    if (!user) {
      return res.status(200).json({ authenticated: false, isChannelOwner: false });
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
        
        return res.status(200).json({
          authenticated: true,
          isChannelOwner: user.is_channel_owner
        });
      } catch (error) {
        console.error('Error refreshing token:', error);
        return res.status(200).json({ authenticated: false, isChannelOwner: false });
      }
    }
    
    return res.status(200).json({
      authenticated: true,
      isChannelOwner: user.is_channel_owner
    });
  } catch (error) {
    console.error('Error checking auth status:', error);
    return res.status(200).json({ authenticated: false, isChannelOwner: false });
  }
} 