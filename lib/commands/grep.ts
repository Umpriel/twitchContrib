import { CommandHandler, CommandContext } from './base';
import db from '../db';

export class GrepCommand implements CommandHandler {
  matches(message: string): boolean {
    // Only match complete grep commands with a filename
    return !!message.match(/!contrib\s+-grep\s+\S+$/i);
  }

  async execute(context: CommandContext): Promise<boolean> {
    const { channel, username, message, client } = context;
    
    try {
      const match = message.match(/!contrib\s+-grep\s+(\S+)/i)!;
      // Using non-null assertion (!) since matches() already validated the format
      
      const filename = match[1];
      
      // Get contributions for this file
      const contributions = await db.getFileContributions(filename, 5);
      
      if (contributions.length === 0) {
        await client.say(channel, `@${username} No contributions found for ${filename}.`);
        return true;
      }
      
      const contribList = contributions.map(c => 
        `#${c.id} (${c.username}${c.line_number ? `, line ${c.line_number}` : ''}, ${c.status})`
      ).join(', ');
      
      await client.say(channel, `@${username} Recent contributions for ${filename}: ${contribList}`);
      return true;
    } catch (error) {
      console.error('Error fetching file contributions:', error);
      await client.say(channel, `@${username} Failed to fetch contributions. Please try again.`);
      return true;
    }
  }
} 