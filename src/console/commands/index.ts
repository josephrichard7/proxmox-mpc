/**
 * Slash Command Registry
 * Manages registration and execution of slash commands
 */

import { ConsoleSession } from '../repl';
import { HelpCommand } from './help';
import { InitCommand } from './init';
import { StatusCommand } from './status';
import { ExitCommand } from './exit';

export type SlashCommandHandler = (args: string[], session: ConsoleSession) => Promise<void>;

export class SlashCommandRegistry {
  private commands = new Map<string, SlashCommandHandler>();

  constructor() {
    this.registerBuiltinCommands();
  }

  private registerBuiltinCommands(): void {
    this.register('help', new HelpCommand().execute);
    this.register('init', new InitCommand().execute);
    this.register('status', new StatusCommand().execute);
    this.register('exit', new ExitCommand().execute);
    
    // Aliases
    this.register('quit', new ExitCommand().execute);
  }

  /**
   * Register a new slash command
   */
  register(name: string, handler: SlashCommandHandler): void {
    this.commands.set(name, handler);
  }

  /**
   * Check if a command exists
   */
  has(name: string): boolean {
    return this.commands.has(name);
  }

  /**
   * Execute a slash command
   */
  async execute(name: string, args: string[], session: ConsoleSession): Promise<void> {
    const handler = this.commands.get(name);
    if (!handler) {
      throw new Error(`Unknown command: /${name}`);
    }

    await handler(args, session);
  }

  /**
   * Get list of available commands
   */
  getAvailableCommands(): string[] {
    return Array.from(this.commands.keys()).sort();
  }
}