import { CommandHandler, CommandContext } from './base';
import db from '../db';

export class PrependCommand implements CommandHandler {
  matches(message: string): boolean {
    return !!message.match(/!contrib\s+-0\s+\d+\s+.+/i);
  }

  async execute(context: CommandContext): Promise<boolean> {
    const { channel, username, message, client } = context;
    
    try {
      const match = message.match(/!contrib\s+-0\s+(\d+)\s+(.+)/i);
      if (!match) {
        await client.say(channel, `@${username} Invalid prepend format. Use: !contrib -0 contrib_id your_code_here`);
        return true;
      }

      const contribId = parseInt(match[1]);
      if (isNaN(contribId) || contribId <= 0) {
        await client.say(channel, `@${username} Invalid contribution ID. Please use a positive number.`);
        return true;
      }
      
      let codeToPrepend = match[2].trim();
      
      // Process \n for explicit newlines
      codeToPrepend = codeToPrepend.replace(/\\n/g, '\n');

      // Fetch the existing contribution
      const existingContrib = await db.getContribution(contribId);
      if (!existingContrib) {
        await client.say(channel, `@${username} Contribution #${contribId} not found.`);
        return true;
      }

      // Check if this user owns the contribution
      if (existingContrib.username !== username) {
        await client.say(channel, `@${username} You can only prepend to your own contributions.`);
        return true;
      }

      // Check if contribution is still pending
      if (existingContrib.status !== 'pending') {
        await client.say(channel, `@${username} You can only prepend to pending contributions.`);
        return true;
      }

      // Prepend code to existing contribution
      const updatedCode = codeToPrepend + existingContrib.code;
      
      // Update the contribution in the database
      await db.updateContribution(contribId, {
        code: updatedCode
      });

      await client.say(channel, `@${username} Contribution #${contribId} has been updated with your prepended code.`);
      return true;
    } catch (error) {
      console.error('Error processing prepend operation:', error);
      await client.say(channel, `@${username} Failed to prepend code. Please try again.`);
      return true;
    }
  }
} 