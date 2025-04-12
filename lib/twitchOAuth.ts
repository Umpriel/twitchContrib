import { StaticAuthProvider } from '@twurple/auth';
import { AccessToken } from '@twurple/auth';
import { loadToken } from './tokenStorage';

// Create a static auth provider instead of RefreshingAuthProvider
export async function getAuthProvider() {
  const tokenData = await loadToken();
  if (!tokenData) {
    throw new Error('No token data available');
  }
  
  return new StaticAuthProvider(
    process.env.NEXT_PUBLIC_TWITCH_CLIENT_ID!,
    tokenData.accessToken,
    tokenData.scope
  );
}

// Create the auth provider on demand
export const authProvider = {
  getAnyAccessToken: async () => {
    const tokenData = await loadToken();
    if (!tokenData) {
      throw new Error('No token data found');
    }
    return tokenData;
  }
};

// Initialize the auth provider with existing tokens or handle first-time setup
export async function initializeAuth() {
  try {
    // Try to load existing token data
    const tokenData = await loadToken();
    
    if (tokenData) {
      // Check if token is expired or about to expire (within 1 hour)
      const expiryTime = tokenData.obtainmentTimestamp + ((tokenData.expiresIn ?? 0) * 1000);
      const now = Date.now();
      const timeUntilExpiry = expiryTime - now;
      
      if (timeUntilExpiry < 3600000) { // Less than 1 hour until expiry
        console.log('Token is expired or about to expire - needs reauthorization');
        return false;
      }
      
      return true;
    } else {
      console.log('No existing token data found. You need to run the auth flow once.');
      return false;
    }
  } catch (error) {
    console.error('Error initializing auth:', error);
    return false;
  }
} 