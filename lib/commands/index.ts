import { CommandHandler } from './base';
import { HelpCommand } from './help';
import { ContribCommand } from './contrib';
import { AppendCommand } from './append';

export const commands: CommandHandler[] = [
  new HelpCommand(),
  new AppendCommand(), // Check append first (more specific)
  new ContribCommand(), // Check standard contrib last (more general)
];

export * from './base'; 