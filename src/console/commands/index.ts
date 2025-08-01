/**
 * Slash Command Registry
 * Manages registration and execution of slash commands
 */

import { ConsoleSession } from '../repl';
import { HelpCommand } from './help';
import { InitCommand } from './init';
import { StatusCommand } from './status';
import { SyncCommand } from './sync';
import { TestCommand } from './test';
import { ApplyCommand } from './apply';
import { PlanCommand } from './plan';
import { ValidateCommand } from './validate';
import { DestroyCommand } from './destroy';
import { ExitCommand } from './exit';

export type SlashCommandHandler = (args: string[], session: ConsoleSession) => Promise<void>;

export class SlashCommandRegistry {
  private commands = new Map<string, SlashCommandHandler>();

  constructor() {
    this.registerBuiltinCommands();
  }

  private registerBuiltinCommands(): void {
    const helpCommand = new HelpCommand();
    const initCommand = new InitCommand();
    const statusCommand = new StatusCommand();
    const syncCommand = new SyncCommand();
    const testCommand = new TestCommand();
    const applyCommand = new ApplyCommand();
    const planCommand = new PlanCommand();
    const validateCommand = new ValidateCommand();
    const destroyCommand = new DestroyCommand();
    const exitCommand = new ExitCommand();
    
    this.register('help', helpCommand.execute.bind(helpCommand));
    this.register('init', initCommand.execute.bind(initCommand));
    this.register('status', statusCommand.execute.bind(statusCommand));
    this.register('sync', syncCommand.execute.bind(syncCommand));
    this.register('test', testCommand.execute.bind(testCommand));
    this.register('apply', applyCommand.execute.bind(applyCommand));
    this.register('plan', planCommand.execute.bind(planCommand));
    this.register('validate', validateCommand.execute.bind(validateCommand));
    this.register('destroy', destroyCommand.execute.bind(destroyCommand));
    this.register('exit', exitCommand.execute.bind(exitCommand));
    
    // Aliases
    this.register('quit', exitCommand.execute.bind(exitCommand));
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