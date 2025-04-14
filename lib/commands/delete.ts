import { CommandHandler, CommandContext } from './base';
import db from '../db';

export class DeleteCommand implements CommandHandler {
  matches(message: string): boolean {
    // Only match complete delete commands with an ID
    return !!message.match(/!contrib\s+-D\s+\d+$/i);
  }

  async execute(context: CommandContext): Promise<boolean> {
    const { channel, username, message, client } = context;
    
    try {
      const match = message.match(/!contrib\s+-D\s+(\d+)/i)!;
      // Using non-null assertion (!) since matches() already validated the format
      
      const contribId = parseInt(match[1]);
      if (isNaN(contribId) || contribId <= 0) {
        await client.say(channel, `@${username} Invalid contribution ID. Please use a positive number.`);
        return true;
      }
      
      // Fetch the existing contribution
      const existingContrib = await db.getContribution(contribId);
      if (!existingContrib) {
        await client.say(channel, `@${username} Contribution #${contribId} not found.`);
        return true;
      }
      
      // Check if this user owns the contribution
      if (existingContrib.username !== username) {
        await client.say(channel, `@${username} You can only delete your own contributions.`);
        return true;
      }
      
      // Check if contribution is still pending
      if (existingContrib.status !== 'pending') {
        await client.say(channel, `@${username} You can only delete pending contributions.`);
        return true;
      }
      
      // Delete the contribution
      await db.deleteContribution(contribId);
      
      await client.say(channel, `@${username} Contribution #${contribId} has been deleted.`);
      return true;
    } catch (error) {
      console.error('Error processing delete operation:', error);
      await client.say(channel, `@${username} Failed to delete contribution. Please try again.`);
      return true;
    }
  }
} 