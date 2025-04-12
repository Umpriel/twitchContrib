import type { NextApiRequest, NextApiResponse } from 'next';
import { parse } from 'cookie';
import db from '../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Parse cookies to get user ID
    const cookies = parse(req.headers.cookie || '');
    const userId = cookies.twitch_user_id;
    
    if (!userId) {
      return res.status(401).json({ 
        valid: false, 
        needsAuth: true,
        message: 'No token exists, authorization required' 
      });
    }
    
    // Get user from database
    const user = await db.getUserById(userId);
    
    if (!user) {
      return res.status(401).json({ 
        valid: false, 
        needsAuth: true,
        message: 'User not found, authorization required' 
      });
    }
    
    // Check if token is expired
    const now = Date.now();
    const timeUntilExpiry = user.token_expires_at - now;
    
    // Token is valid if it has more than 1 hour until expiry
    const isValid = timeUntilExpiry > 3600000;
    
    return res.status(200).json({
      valid: isValid,
      needsAuth: !isValid,
      expiresIn: Math.floor(timeUntilExpiry / 1000),
      message: isValid ? 'Token is valid' : 'Token is expired or about to expire'
    });
  } catch (error) {
    console.error('Error checking token:', error);
    return res.status(500).json({ 
      valid: false, 
      needsAuth: true,
      message: 'Error checking token status' 
    });
  }
} 