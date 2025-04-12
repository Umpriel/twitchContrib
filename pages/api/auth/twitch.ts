import type { NextApiRequest, NextApiResponse } from 'next';
import { exchangeCode } from '@twurple/auth';
import fs from 'fs';
import path from 'path';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { code } = req.query;
  
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Missing authorization code' });
  }
  
  try {
    // Exchange the code for an access token
    const tokenData = await exchangeCode(
      process.env.NEXT_PUBLIC_TWITCH_CLIENT_ID!,
      process.env.TWITCH_CLIENT_SECRET!,
      code,
      process.env.NEXT_PUBLIC_TWITCH_REDIRECT_URI!
    );
    
    // Save the token data
    const tokenDataPath = path.join(process.cwd(), '.twitch-token.json');
    fs.writeFileSync(tokenDataPath, JSON.stringify(tokenData, null, 4), 'utf8');
    
    res.status(200).json({ success: true, message: 'Authorization successful!' });
  } catch (error) {
    console.error('Error during token exchange:', error);
    res.status(500).json({ error: 'Failed to exchange authorization code' });
  }
} 