import { CommandHandler, CommandContext } from './base';
import db from '../db';

export class StatusCommand implements CommandHandler {
  matches(message: string): boolean {
    // Only match complete status commands with an ID
    return !!message.match(/!contrib\s+-status\s+\d+$/i);
  }

  async execute(context: CommandContext): Promise<boolean> {
    const { channel, username, message, client } = context;
    
    try {
      const match = message.match(/!contrib\s+-status\s+(\d+)/i)!;
      // Using non-null assertion (!) since matches() already validated the format
      
      const contribId = parseInt(match[1]);
      if (isNaN(contribId) || contribId <= 0) {
        await client.say(channel, `@${username} Invalid contribution ID. Please use a positive number.`);
        return true;
      }
      
      // Get the contribution
      const contribution = await db.getContribution(contribId);
      
      if (!contribution) {
        await client.say(channel, `@${username} Contribution #${contribId} not found.`);
        return true;
      }
      
      const statusEmoji = {
        'pending': '⏳',
        'accepted': '✅',
        'rejected': '❌'
      }[contribution.status] || '❓';
      
      await client.say(channel, `@${username} Contribution #${contribId} (${contribution.filename}${contribution.line_number ? `, line ${contribution.line_number}` : ''}) is ${statusEmoji} ${contribution.status.toUpperCase()}`);
      return true;
    } catch (error) {
      console.error('Error fetching contribution status:', error);
      await client.say(channel, `@${username} Failed to check status. Please try again.`);
      return true;
    }
  }
} 