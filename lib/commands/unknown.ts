import { CommandHandler, CommandContext } from './base';

export class UnknownCommand implements CommandHandler {
  matches(message: string): boolean {
    return message.startsWith('!contrib');
  }

  async execute(context: CommandContext): Promise<boolean> {
    const { channel, username, client } = context;
    await client.say(channel, `@${username} Unknown !contrib command format. Type !contrib --help for usage info.`);
    return true;
  }
} 