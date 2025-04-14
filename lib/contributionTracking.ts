/**
 * This file maintains backward compatibility with the original API
 * but delegates to the new modular implementation.
 */

// Re-export the main functionality
import { processMessage, initContributionTracking as importedInitTracking } from './contribution';
import { parseContribution } from './contribution/parser';
import { validateContribution } from './contribution/validator';
import { formatCode } from './contribution/formatter';
import { Client } from 'tmi.js';

// Re-export everything for backward compatibility
export {
  processMessage,
  parseContribution,
  validateContribution,
  formatCode
};

// The implementation has been moved to the new modular structure:
// - Command handling: lib/commands/
// - Contribution processing: lib/contribution/
// - Utilities: lib/utils/ 

// Global tracking of message handlers
declare global {
  var _contributionTrackingInitialized: boolean;
  var _registeredClientId: string | null;
}

// Initialize globals
global._contributionTrackingInitialized = global._contributionTrackingInitialized || false;
global._registeredClientId = global._registeredClientId || null;

export async function initContributionTracking(client: Client): Promise<void> {
  const clientId = client.getOptions().connection?.server || 'unknown';
  
  // Skip if already initialized for this specific client
  if (global._contributionTrackingInitialized && global._registeredClientId === clientId) {
    console.log('Contribution tracking already initialized for this client, skipping');
    return;
  }
  
  console.log('Initializing contribution tracking...');
  
  // Remove ALL existing listeners to prevent duplicates
  client.removeAllListeners('message');
  
  // Set up a single message handler
  const messageHandler = (channel: string, tags: any, message: string, self: boolean) => {
    if (self) return; // Ignore messages from the bot itself
    console.log(`Processing message from ${tags.username}: ${message}`);
    processMessage(channel, tags, message, client).catch(error => {
      console.error('Error processing message:', error);
    });
  };
  
  // Register the handler
  client.on('message', messageHandler);
  
  // Update global state
  global._contributionTrackingInitialized = true;
  global._registeredClientId = clientId;
  console.log('Contribution tracking initialized');
} 