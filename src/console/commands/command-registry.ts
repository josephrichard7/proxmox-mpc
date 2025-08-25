/**
 * Standardized Command Registry
 * Manages command registration and execution with unified interface
 */

import { ICommand, executeCommand } from './base-command';
import { ConsoleSession } from '../repl';

/**
 * Enhanced command registry with standardized command interface
 */
export class StandardizedCommandRegistry {
  private commands = new Map<string, ICommand>();
  private aliases = new Map<string, string>();

  /**
   * Register a command with automatic alias registration
   */
  register(command: ICommand): void {
    const metadata = command.getMetadata();
    
    // Register main command
    this.commands.set(metadata.name.toLowerCase(), command);
    
    // Register aliases
    if (metadata.aliases) {
      metadata.aliases.forEach(alias => {
        this.aliases.set(alias.toLowerCase(), metadata.name.toLowerCase());
      });
    }
  }

  /**
   * Check if a command exists
   */
  has(commandName: string): boolean {
    const name = commandName.toLowerCase();
    return this.commands.has(name) || this.aliases.has(name);
  }

  /**
   * Get a command by name or alias
   */
  get(commandName: string): ICommand | undefined {
    const name = commandName.toLowerCase();
    
    // Check direct command name
    if (this.commands.has(name)) {
      return this.commands.get(name);
    }
    
    // Check aliases
    const aliasTarget = this.aliases.get(name);
    if (aliasTarget) {
      return this.commands.get(aliasTarget);
    }
    
    return undefined;
  }

  /**
   * Execute a command with standardized error handling and validation
   */
  async execute(commandName: string, args: string[], session: ConsoleSession): Promise<void> {
    const command = this.get(commandName);
    
    if (!command) {
      console.log(`❌ Unknown command: /${commandName}`);
      console.log('💡 Use /help to see available commands');
      return;
    }
    
    // Use standardized execution with error handling
    await executeCommand(command, args, session);
  }

  /**
   * Get all registered commands
   */
  getAllCommands(): ICommand[] {
    return Array.from(this.commands.values());
  }

  /**
   * Get commands by category or requirement
   */
  getCommandsByRequirement(requiresWorkspace?: boolean, requiresConnection?: boolean): ICommand[] {
    return this.getAllCommands().filter(command => {
      const metadata = command.getMetadata();
      if (requiresWorkspace !== undefined && metadata.requiresWorkspace !== requiresWorkspace) {
        return false;
      }
      if (requiresConnection !== undefined && metadata.requiresConnection !== requiresConnection) {
        return false;
      }
      return true;
    });
  }

  /**
   * Generate help text for all commands
   */
  generateHelpText(): string {
    const commands = this.getAllCommands();
    let helpText = '\n📚 Available Commands:\n\n';
    
    // Group by requirements
    const basicCommands = this.getCommandsByRequirement(false, false);
    const workspaceCommands = this.getCommandsByRequirement(true, false);
    const connectionCommands = this.getCommandsByRequirement(undefined, true);
    
    if (basicCommands.length > 0) {
      helpText += '🔧 Basic Commands:\n';
      basicCommands.forEach(command => {
        const metadata = command.getMetadata();
        helpText += `  /${metadata.name.padEnd(12)} ${metadata.description}\n`;
      });
      helpText += '\n';
    }
    
    if (workspaceCommands.length > 0) {
      helpText += '📁 Workspace Commands:\n';
      workspaceCommands.forEach(command => {
        const metadata = command.getMetadata();
        helpText += `  /${metadata.name.padEnd(12)} ${metadata.description}\n`;
      });
      helpText += '\n';
    }
    
    if (connectionCommands.length > 0) {
      helpText += '🖥️  Server Commands:\n';
      connectionCommands.forEach(command => {
        const metadata = command.getMetadata();
        helpText += `  /${metadata.name.padEnd(12)} ${metadata.description}\n`;
      });
      helpText += '\n';
    }
    
    helpText += '💡 Use /help [command] for detailed usage information\n';
    
    return helpText;
  }
}