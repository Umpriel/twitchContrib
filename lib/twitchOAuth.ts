import { StaticAuthProvider } from '@twurple/auth';
import { AccessToken } from '@twurple/auth';
import fs from 'fs';
import path from 'path';

// Path to store token data between sessions
const tokenDataPath = path.join(process.cwd(), '.twitch-token.json');

// Function to load existing token data
function loadTokenData(): AccessToken | undefined {
  try {
    if (fs.existsSync(tokenDataPath)) {
      const tokenData = JSON.parse(fs.readFileSync(tokenDataPath, 'utf8'));
      console.log('Loaded token data:', {
        scopes: tokenData.scope,
        obtainmentTimestamp: new Date(tokenData.obtainmentTimestamp).toISOString(),
        expiresIn: tokenData.expiresIn
      });
      return tokenData;
    }
  } catch (error) {
    console.error('Error loading token data:', error);
  }
  return undefined;
}

// Function to save token data
function saveTokenData(tokenData: AccessToken): void {
  fs.writeFileSync(tokenDataPath, JSON.stringify(tokenData, null, 4), 'utf8');
  console.log('Token data saved successfully');
}

// Create a static auth provider instead of RefreshingAuthProvider
export function getAuthProvider() {
  const tokenData = loadTokenData();
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
    const tokenData = loadTokenData();
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
    const tokenData = loadTokenData();
    
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