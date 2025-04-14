import { CommandHandler, CommandContext } from './base';
import db from '../db';

export class ListCommand implements CommandHandler {
  matches(message: string): boolean {
    return !!message.match(/!contrib\s+-ls($|\s)/i);
  }

  async execute(context: CommandContext): Promise<boolean> {
    const { channel, username, client } = context;
    
    try {
      // Get user's recent contributions
      const contributions = await db.getUserContributions(username, 5);
      
      if (contributions.length === 0) {
        await client.say(channel, `@${username} You don't have any recent contributions.`);
        return true;
      }
      
      const contribList = contributions.map(c => 
        `#${c.id} (${c.filename}${c.line_number ? `, line ${c.line_number}` : ''}, ${c.status})`
      ).join(', ');
      
      await client.say(channel, `@${username} Your recent contributions: ${contribList}`);
      return true;
    } catch (error) {
      console.error('Error fetching user contributions:', error);
      await client.say(channel, `@${username} Failed to fetch your contributions. Please try again.`);
      return true;
    }
  }
} 