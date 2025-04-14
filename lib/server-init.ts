import { initAndGetChatClient, verifyChatClient } from './twitchAuth';
import { initContributionTracking } from './contributionTracking';
import db from './db';

// Flag to track initialization state
let isServerInitialized = false;
let initializedClientId: string | null = null;

/**
 * Initialize the server-side components including the Twitch client
 * This should run once at server startup, not per request
 */
export async function initializeServer(accessToken?: string) {
  if (isServerInitialized) {
    console.log('Server already initialized, checking client state...');
    
    try {
      const client = await initAndGetChatClient(accessToken);
      // Verify the client is still connected
      const isConnected = await verifyChatClient(client);
      
      if (isConnected) {
        console.log('Existing client is still connected, skipping initialization');
        return true;
      } else {
        console.log('Existing client disconnected, reinitializing...');
        // Continue with initialization below
      }
    } catch (error) {
      console.error('Error checking client state:', error);
      // Continue with initialization below
    }
  }
  
  try {
    console.log('Initializing server components...');
    
    // Initialize the chat client with or without auth token
    const client = await initAndGetChatClient(accessToken);
    
    // Set up contribution tracking
    await initContributionTracking(client);
    
    isServerInitialized = true;
    console.log('Server initialization complete');
    return true;
  } catch (error) {
    console.error('Failed to initialize server:', error);
    return false;
  }
}
