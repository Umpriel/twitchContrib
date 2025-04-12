import type { NextApiRequest, NextApiResponse } from 'next';
import { loadToken } from '../../lib/tokenStorage';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const tokenData = await loadToken();
    
    if (!tokenData) {
      return res.status(401).json({ 
        valid: false, 
        needsAuth: true,
        message: 'No token exists, authorization required' 
      });
    }
    
    const expiryTime = tokenData.obtainmentTimestamp + (tokenData.expiresIn * 1000);
    const now = Date.now();
    const timeUntilExpiry = expiryTime - now;
    
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