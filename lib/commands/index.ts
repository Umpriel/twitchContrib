import { CommandHandler } from './base';
import { HelpCommand } from './help';
import { ContribCommand } from './contrib';
import { AppendCommand } from './append';
import { ListCommand } from './list';
import { GrepCommand } from './grep';
import { StatusCommand } from './status';
import { ReplaceCommand } from './replace';
import { DeleteCommand } from './delete';
import { PrependCommand } from './prepend';
import { IncompleteArgumentCommand } from './incomplete-argument';
import { UnknownCommand } from './unknown';

export const commands: CommandHandler[] = [
  new HelpCommand(),
  new ListCommand(),
  new GrepCommand(),
  new StatusCommand(),
  new ReplaceCommand(),
  new DeleteCommand(),
  new PrependCommand(),
  new AppendCommand(),
  new ContribCommand(),        // Main contribution command
  new IncompleteArgumentCommand(), // Catch incomplete commands
  new UnknownCommand(),        // Catch any other !contrib commands
];

export * from './base'; 