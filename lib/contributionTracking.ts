/**
 * This file maintains backward compatibility with the original API
 * but delegates to the new modular implementation.
 */

// Re-export the main functionality
import { processMessage, initContributionTracking } from './contribution';
import { parseContribution } from './contribution/parser';
import { validateContribution } from './contribution/validator';
import { formatCode } from './contribution/formatter';

// Re-export everything for backward compatibility
export {
  processMessage,
  initContributionTracking,
  parseContribution,
  validateContribution,
  formatCode
};

// The implementation has been moved to the new modular structure:
// - Command handling: lib/commands/
// - Contribution processing: lib/contribution/
// - Utilities: lib/utils/ 