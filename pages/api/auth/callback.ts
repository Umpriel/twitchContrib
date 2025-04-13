import { NextApiRequest, NextApiResponse } from 'next';
import { exchangeCode } from '../../../lib/twitchAuth';
import db from '../../../lib/db';
import { serialize } from 'cookie';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { code } = req.query;
  
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Missing authorization code' });
  }
  
  try {

    const tokenData = await exchangeCode(code);
    

    const userInfo = await getUserInfo(tokenData.access_token);
    

    const isChannelOwner = userInfo.login.toLowerCase() === 
      process.env.TWITCH_CHANNEL?.toLowerCase();
    

    await db.createOrUpdateUser({
      id: userInfo.id,
      username: userInfo.login,
      is_channel_owner: isChannelOwner,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      token_expires_at: Date.now() + (tokenData.expires_in * 1000)
    });
    

    const cookie = serialize('twitch_user_id', userInfo.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: '/'
    });
    
    res.setHeader('Set-Cookie', cookie);
    

    res.redirect('/');
  } catch (error) {
    console.error('Auth callback error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
}

async function getUserInfo(accessToken: string) {
  const response = await fetch('https://api.twitch.tv/helix/users', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Client-ID': process.env.NEXT_PUBLIC_TWITCH_CLIENT_ID!
    }
  });
  
  if (!response.ok) {
    throw new Error('Failed to get user info from Twitch');
  }
  
  const data = await response.json();
  return data.data[0];
} 