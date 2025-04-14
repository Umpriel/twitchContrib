import { CommandHandler, CommandContext } from './base';
import db from '../db';

export class AppendCommand implements CommandHandler {
  matches(message: string): boolean {
    return !!message.match(/!contrib\s+-A\s+\d+/i);
  }

  async execute(context: CommandContext): Promise<boolean> {
    const { channel, username, message, client } = context;
    
    try {
      const match = message.match(/!contrib\s+-A\s+(\d+)\s+(.+)/i);
      if (!match) {
        await client.say(channel, `@${username} Invalid append format. Use: !contrib -A contrib_id your_code_here`);
        return true; // Command was handled, even though it failed
      }

      const contribId = parseInt(match[1]);
      let codeToAppend = match[2].trim();
      
      // Process \n for explicit newlines
      codeToAppend = codeToAppend.replace(/\\n/g, '\n');

      // Fetch the existing contribution
      const existingContrib = await db.getContribution(contribId);
      if (!existingContrib) {
        await client.say(channel, `@${username} Contribution #${contribId} not found.`);
        return true;
      }

      // Check if this user owns the contribution
      if (existingContrib.username !== username) {
        await client.say(channel, `@${username} You can only append to your own contributions.`);
        return true;
      }

      // Check if contribution is still pending
      if (existingContrib.status !== 'pending') {
        await client.say(channel, `@${username} You can only append to pending contributions.`);
        return true;
      }

      // Append code to existing contribution (no automatic newline unless explicitly provided)
      const updatedCode = existingContrib.code + codeToAppend;
      
      // Update the contribution in the database
      await db.updateContribution(contribId, {
        code: updatedCode
      });

      await client.say(channel, `@${username} Contribution #${contribId} has been updated with your additional code.`);
      return true;
    } catch (error) {
      console.error('Error processing append operation:', error);
      await client.say(channel, `@${username} Failed to append code. Please try again.`);
      return true; // Command was handled, even though it failed
    }
  }
} 