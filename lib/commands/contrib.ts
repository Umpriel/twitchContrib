import { CommandHandler, CommandContext } from './base';
import db from '../db';
import { parseContribution } from '../contribution/parser';
import { validateContribution } from '../contribution/validator';
import { formatCode } from '../contribution/formatter';
import { isRateLimited } from '../utils/rate-limiter';

export class ContribCommand implements CommandHandler {
  matches(message: string): boolean {
    // If it's a specific command with flags, let the other command handlers catch it
    if (message.match(/!contrib\s+(-[A0CDhlsgre]|--help|--usage|--options|help|-status|-grep|-ls)/i)) {
      return false;
    }
    
    // Check if it's a filename contribution command (starts with !contrib followed by something with a file extension)
    const filePattern = /!contrib\s+[\w\/\.-]+\.\w+/i;
    return filePattern.test(message);
  }

  async execute(context: CommandContext): Promise<boolean> {
    const { channel, username, message, client } = context;
    
    try {
      // Parse the contribution
      const contribution = parseContribution(message);
      if (!contribution) {
        await client.say(channel, `@${username} Invalid usage ❌. Use: !contrib filename -l line_number(optional) code or !contrib --help`);
        return true;
      }

      // Check rate limiting
      if (isRateLimited(username)) {
        await client.say(channel, `@${username} You're contributing too quickly. Please wait a moment and try again.`);
        return true;
      }

      // Format the code
      const formattedCode = formatCode(contribution.code);
      
      // Prepare for validation
      const codeHash = formatCode(contribution.code, true) + contribution.filename;
      
      // Validate the contribution
      const validation = await validateContribution(
        contribution.filename,
        contribution.lineNumber,
        codeHash,
        username
      );

      if (validation.personalDuplicate) {
        await client.say(channel, `@${username} You've already submitted this code. Please try something different.`);
        return true;
      }

      if (validation.acceptedDuplicate) {
        await client.say(channel, `@${username} This code has already been accepted. Please try something different.`);
        return true;
      }

      if (validation.lineConflict) {
        await client.say(channel, `@${username} Another user has a pending contribution for that line. Please choose a different line or wait for it to be reviewed.`);
        return true;
      }

      // Save the contribution
      const result = await db.createContribution(
        username,
        contribution.filename,
        contribution.lineNumber,
        formattedCode
      );

      await client.say(channel, `@${username} Contribution saved! ID: ${result.id}`);
      return true;
    } catch (error) {
      console.error('Error processing contribution:', error);
      await client.say(channel, `@${username} Failed to save contribution. Please try again later.`);
      return true;
    }
  }
} 