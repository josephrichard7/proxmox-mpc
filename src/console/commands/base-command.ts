/**
 * Base Command Interface and Implementation
 * Provides standardized command structure and common functionality
 */

import { ConsoleSession } from '../repl';
import { errorHandler } from '../error-handler';

/**
 * Command execution result
 */
export interface CommandResult {
  success: boolean;
  message?: string;
  data?: any;
}

/**
 * Command metadata for help and documentation
 */
export interface CommandMetadata {
  name: string;
  description: string;
  usage: string;
  examples?: string[];
  requiresWorkspace?: boolean;
  requiresConnection?: boolean;
  aliases?: string[];
}

/**
 * Base command interface that all commands must implement
 */
export interface ICommand {
  /**
   * Execute the command with given arguments and session
   */
  execute(args: string[], session: ConsoleSession): Promise<void>;

  /**
   * Get command metadata for help and validation
   */
  getMetadata(): CommandMetadata;

  /**
   * Validate command arguments (optional override)
   */
  validateArgs?(args: string[]): string[];
}

/**
 * Abstract base command class providing common functionality
 */
export abstract class BaseCommand implements ICommand {
  /**
   * Execute the command - must be implemented by subclasses
   */
  abstract execute(args: string[], session: ConsoleSession): Promise<void>;

  /**
   * Get command metadata - must be implemented by subclasses
   */
  abstract getMetadata(): CommandMetadata;

  /**
   * Validate command arguments - override for custom validation
   */
  validateArgs?(args: string[]): string[] {
    return []; // No validation errors by default
  }

  /**
   * Standard validation helper methods
   */
  protected requireWorkspace(session: ConsoleSession): void {
    if (!session.workspace) {
      throw new Error('This command requires an initialized workspace. Run /init first.');
    }
  }

  protected requireConnection(session: ConsoleSession): void {
    if (!session.client) {
      throw new Error('This command requires a Proxmox server connection.');
    }
  }

  protected validateArgCount(args: string[], min: number, max?: number): void {
    if (args.length < min) {
      const metadata = this.getMetadata();
      throw new Error(`${metadata.name} requires at least ${min} argument(s). Usage: ${metadata.usage}`);
    }
    if (max !== undefined && args.length > max) {
      const metadata = this.getMetadata();
      throw new Error(`${metadata.name} accepts at most ${max} argument(s). Usage: ${metadata.usage}`);
    }
  }

  protected showSuccess(message: string, details?: string[]): void {
    console.log(`✅ ${message}`);
    if (details) {
      details.forEach(detail => console.log(`   ${detail}`));
    }
  }

  protected showWarning(message: string, details?: string[]): void {
    console.log(`⚠️  ${message}`);
    if (details) {
      details.forEach(detail => console.log(`   ${detail}`));
    }
  }

  protected showError(message: string, details?: string[]): void {
    console.log(`❌ ${message}`);
    if (details) {
      details.forEach(detail => console.log(`   ${detail}`));
    }
  }

  protected showInfo(message: string, details?: string[]): void {
    console.log(`ℹ️  ${message}`);
    if (details) {
      details.forEach(detail => console.log(`   ${detail}`));
    }
  }
}

/**
 * Command execution wrapper with standardized error handling
 */
export async function executeCommand(command: ICommand, args: string[], session: ConsoleSession): Promise<void> {
  const metadata = command.getMetadata();

  try {
    // Validate workspace requirement
    if (metadata.requiresWorkspace && !session.workspace) {
      errorHandler.handleError({
        code: 'WORKSPACE_REQUIRED',
        message: `Command '${metadata.name}' requires an initialized workspace`,
        severity: 'medium' as const,
        context: {
          command: metadata.name,
          workspace: undefined
        }
      });
      return;
    }

    // Validate connection requirement
    if (metadata.requiresConnection && !session.client) {
      errorHandler.handleError({
        code: 'CONNECTION_REQUIRED', 
        message: `Command '${metadata.name}' requires a Proxmox server connection`,
        severity: 'medium' as const,
        context: {
          command: metadata.name,
          workspace: session.workspace?.name
        }
      });
      return;
    }

    // Validate arguments if validator exists
    if (command.validateArgs) {
      const validationErrors = command.validateArgs(args);
      if (validationErrors.length > 0) {
        console.log(`❌ Invalid arguments for '${metadata.name}' command:`);
        validationErrors.forEach(error => console.log(`   • ${error}`));
        console.log(`💡 Usage: ${metadata.usage}`);
        return;
      }
    }

    // Execute the command
    await command.execute(args, session);
    
  } catch (error) {
    errorHandler.handleError({
      code: 'COMMAND_EXECUTION_FAILED',
      message: `Command '${metadata.name}' failed to execute`,
      originalError: error as Error,
      severity: 'high' as const,
      context: {
        command: metadata.name,
        workspace: session.workspace?.name
      }
    });
  }
}