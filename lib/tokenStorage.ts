import fs from 'fs';
import path from 'path';
import { getTwitchToken, saveTwitchToken } from './db';
import { AccessToken } from '@twurple/auth';

// Path to store token data between sessions
const tokenDataPath = path.join(process.cwd(), '.twitch-token.json');

// Load token data with fallback strategy
export async function loadToken() {
  // Try filesystem first
  try {
    if (fs.existsSync(tokenDataPath)) {
      const tokenData = JSON.parse(fs.readFileSync(tokenDataPath, 'utf8'));
      console.log('Loaded token data from file');
      return tokenData;
    }
  } catch (error) {
    console.log('Could not load from filesystem, will try database');
  }
  
  // Fall back to database
  try {
    const tokenData = await getTwitchToken();
    if (tokenData) {
      console.log('Loaded token data from database');
      return tokenData;
    }
  } catch (error) {
    console.error('Error loading token from database:', error);
  }
  
  return undefined;
}

// Save token with fallback strategy
export async function saveToken(tokenData: AccessToken) {
  // Try filesystem first
  try {
    fs.writeFileSync(tokenDataPath, JSON.stringify(tokenData, null, 4), 'utf8');
    console.log('Token saved to filesystem');
    return true;
  } catch (error) {
    console.log('Could not save to filesystem, will try database');
  }
  
  // Fall back to database
  try {
    await saveTwitchToken(tokenData);
    console.log('Token saved to database');
    return true;
  } catch (error) {
    console.error('Error saving token to database:', error);
    return false;
  }
} 