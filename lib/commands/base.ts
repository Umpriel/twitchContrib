import { Client } from 'tmi.js';

export interface CommandContext {
  channel: string;
  username: string;
  tags: Record<string, unknown>;
  message: string;
  client: Client;
}

export interface CommandHandler {
  matches(message: string): boolean;
  execute(context: CommandContext): Promise<boolean>;
} 