import { CommandHandler, CommandContext } from './base';
import db from '../db';
import { formatCode } from '../contribution/formatter';
import { isRateLimited } from '../utils/rate-limiter';

export class ReplaceCommand implements CommandHandler {
  matches(message: string): boolean {
    return !!message.match(/!contrib\s+-C\s+\d+\s+.+/i);
  }

  async execute(context: CommandContext): Promise<boolean> {
    const { channel, username, message, client } = context;
    
    try {
      const match = message.match(/!contrib\s+-C\s+(\d+)\s+(.+)/i);
      if (!match) {
        await client.say(channel, `@${username} Invalid format. Use: !contrib -C contrib_id new_code`);
        return true;
      }
      
      // Check rate limiting
      if (isRateLimited(username)) {
        await client.say(channel, `@${username} You're contributing too quickly. Please wait a moment and try again.`);
        return true;
      }
      
      const contribId = parseInt(match[1]);
      if (isNaN(contribId) || contribId <= 0) {
        await client.say(channel, `@${username} Invalid contribution ID. Please use a positive number.`);
        return true;
      }
      
      let newCode = match[2].trim();
      
      // Process \n for explicit newlines
      newCode = newCode.replace(/\\n/g, '\n');
      
      // Format the code
      const formattedCode = formatCode(newCode);
      
      // Fetch the existing contribution
      const existingContrib = await db.getContribution(contribId);
      if (!existingContrib) {
        await client.say(channel, `@${username} Contribution #${contribId} not found.`);
        return true;
      }
      
      // Check if this user owns the contribution
      if (existingContrib.username !== username) {
        await client.say(channel, `@${username} You can only replace your own contributions.`);
        return true;
      }
      
      // Check if contribution is still pending
      if (existingContrib.status !== 'pending') {
        await client.say(channel, `@${username} You can only replace pending contributions.`);
        return true;
      }
      
      // Update the contribution in the database
      await db.updateContribution(contribId, {
        code: formattedCode
      });
      
      await client.say(channel, `@${username} Contribution #${contribId} has been replaced with your new code.`);
      return true;
    } catch (error) {
      console.error('Error processing replace operation:', error);
      await client.say(channel, `@${username} Failed to replace code. Please try again.`);
      return true;
    }
  }
} 