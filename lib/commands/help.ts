import { CommandHandler, CommandContext } from './base';

export class HelpCommand implements CommandHandler {
  matches(message: string): boolean {
    const cleanMessage = message.trim().toLowerCase();
    return cleanMessage === '!contrib --help' || 
           cleanMessage === '!contrib -h' || 
           cleanMessage === '!contrib help' ||
           cleanMessage === '!contrib --usage' ||
           cleanMessage === '!contrib --options';
  }

  async execute(context: CommandContext): Promise<boolean> {
    const { channel, username, message, client } = context;
    const cleanMessage = message.trim().toLowerCase();
    
    try {
      if (cleanMessage === '!contrib --usage') {
        await client.say(channel, `@${username} 📝 !CONTRIB USAGE: [filename] [-l line_number] [code] | [-A ID code] | [-0 ID code] | [-C ID code] | [-D ID] | [-ls] | [-grep filename] | [-status ID] | Use \\n for newlines`);
      } else if (cleanMessage === '!contrib --options') {
        await client.say(channel, `@${username} !CONTRIB OPTIONS: -l=line number, -A=append, -0=prepend, -C=replace, -D=delete, -ls=list yours, -grep=find by file, -status=check status. Use \\n for newlines.`);
      } else {
        // Default help message
        await client.say(channel, `@${username} For !contrib usage syntax, type: !contrib --usage. For options definitions, type: !contrib --options`);
      }
      
      return true; // Command handled successfully
    } catch (error) {
      console.error('Error sending help message:', error);
      return false;
    }
  }
} 