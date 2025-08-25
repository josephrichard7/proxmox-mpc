/**
 * Unified Error Handler for Console Commands
 * Provides consistent error handling, validation, and user messaging
 */

import { Logger } from '../observability/logger';

import { ConsoleSession } from './repl';

export interface ErrorContext {
  command: string;
  operation?: string;
  workspace?: string;
  resourcesAffected?: string[];
  suggestions?: string[];
  details?: Record<string, any>;
}

export interface CommandError {
  code: string;
  message: string;
  context: ErrorContext;
  originalError?: Error;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export class ConsoleErrorHandler {
  private logger = Logger.getInstance();

  /**
   * Validates common preconditions for console commands
   */
  validateSession(session: ConsoleSession, commandName: string): boolean {
    if (!session.workspace) {
      this.handleError({
        code: 'NO_WORKSPACE',
        message: 'No workspace detected',
        severity: 'medium',
        context: {
          command: commandName,
          suggestions: [
            'Use /init to create a workspace first',
            'Navigate to an existing project directory'
          ]
        }
      });
      return false;
    }
    return true;
  }

  /**
   * Validates workspace structure and connectivity
   */
  async validateWorkspaceReady(session: ConsoleSession, commandName: string, requiresConnection = false): Promise<boolean> {
    if (!this.validateSession(session, commandName)) {
      return false;
    }

    if (requiresConnection && !session.client) {
      this.handleError({
        code: 'NO_CONNECTION',
        message: 'No Proxmox connection available',
        severity: 'high',
        context: {
          command: commandName,
          workspace: session.workspace!.name,
          suggestions: [
            'Use /status to check server connectivity',
            'Verify your Proxmox server configuration'
          ]
        }
      });
      return false;
    }

    return true;
  }

  /**
   * Handles and displays errors in a consistent format
   */
  handleError(error: CommandError): void {
    // Log the error for debugging
    this.logger.error(
      error.message,
      error.originalError,
      {
        command: error.context.command,
        operation: error.context.operation,
        workspace: error.context.workspace,
        resourcesAffected: error.context.resourcesAffected || []
      },
      error.context.suggestions || []
    );

    // Display user-friendly error message
    const emoji = this.getSeverityEmoji(error.severity);
    console.log(`${emoji} ${error.message}`);
    
    // Show additional context if available
    if (error.context.operation) {
      console.log(`   Operation: ${error.context.operation}`);
    }
    
    if (error.context.resourcesAffected && error.context.resourcesAffected.length > 0) {
      console.log(`   Affected: ${error.context.resourcesAffected.join(', ')}`);
    }

    // Show suggestions
    if (error.context.suggestions && error.context.suggestions.length > 0) {
      console.log('\n💡 Suggestions:');
      error.context.suggestions.forEach(suggestion => {
        console.log(`   • ${suggestion}`);
      });
    }

    // Show additional details for debugging if available
    if (error.originalError && process.env.DEBUG === 'true') {
      console.log(`\n🔍 Debug Details: ${error.originalError.message}`);
      if (error.originalError.stack) {
        console.log(`   Stack: ${error.originalError.stack.split('\n').slice(0, 3).join('\n   ')}`);
      }
    }

    console.log(''); // Empty line for spacing
  }

  /**
   * Handles external process errors (terraform, ansible, etc.)
   */
  handleProcessError(
    commandName: string,
    processName: string,
    exitCode: number,
    output: string,
    suggestions: string[] = []
  ): void {
    const defaultSuggestions = [
      `Ensure ${processName} is installed and in your PATH`,
      'Check the detailed output above for specific issues',
      'Run with debug mode enabled for more information'
    ];

    this.handleError({
      code: 'PROCESS_ERROR',
      message: `${processName} process failed with exit code ${exitCode}`,
      severity: 'high',
      context: {
        command: commandName,
        operation: `${processName} execution`,
        suggestions: suggestions.length > 0 ? suggestions : defaultSuggestions,
        details: { exitCode, output: output.slice(-500) } // Last 500 chars
      }
    });

    // Show relevant output lines
    if (output) {
      console.log('📋 Process Output (last 10 lines):');
      const lines = output.split('\n').slice(-10);
      lines.forEach(line => {
        if (line.trim()) {
          console.log(`   ${line}`);
        }
      });
      console.log('');
    }
  }

  /**
   * Handles file system operation errors
   */
  handleFileSystemError(
    commandName: string,
    operation: string,
    filePath: string,
    error: Error
  ): void {
    let suggestions: string[] = [];
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'medium';

    if (error.message.includes('ENOENT')) {
      suggestions = [
        'Ensure the file or directory exists',
        'Check that the workspace is properly initialized',
        'Run /sync to generate missing files'
      ];
    } else if (error.message.includes('EACCES') || error.message.includes('EPERM')) {
      suggestions = [
        'Check file and directory permissions',
        'Ensure you have write access to the workspace',
        'Run with appropriate user permissions'
      ];
      severity = 'high';
    } else if (error.message.includes('ENOSPC')) {
      suggestions = [
        'Free up disk space',
        'Check available storage in the workspace directory'
      ];
      severity = 'critical';
    } else {
      suggestions = [
        'Check file system permissions and availability',
        'Verify the workspace structure is intact'
      ];
    }

    this.handleError({
      code: 'FILESYSTEM_ERROR',
      message: `File system operation failed: ${operation}`,
      severity,
      originalError: error,
      context: {
        command: commandName,
        operation,
        suggestions,
        details: { filePath, errorCode: (error as any).code }
      }
    });
  }

  /**
   * Handles network/connection errors
   */
  handleConnectionError(
    commandName: string,
    serverInfo: string,
    error: Error
  ): void {
    const suggestions = [
      'Check network connectivity to the Proxmox server',
      'Verify server address and port configuration',
      'Check API token permissions and validity',
      'Ensure the Proxmox server is running and accessible',
      'Use /status to diagnose connection issues'
    ];

    this.handleError({
      code: 'CONNECTION_ERROR',
      message: `Failed to connect to Proxmox server: ${serverInfo}`,
      severity: 'high',
      originalError: error,
      context: {
        command: commandName,
        operation: 'proxmox_connection',
        suggestions
      }
    });
  }

  /**
   * Wraps async operations with consistent error handling
   */
  async wrapAsync<T>(
    operation: () => Promise<T>,
    context: ErrorContext
  ): Promise<T | null> {
    try {
      return await operation();
    } catch (error) {
      this.handleError({
        code: 'ASYNC_OPERATION_ERROR',
        message: `Operation failed: ${context.operation || 'unknown operation'}`,
        severity: 'high',
        originalError: error as Error,
        context
      });
      return null;
    }
  }

  /**
   * Creates a standardized success message
   */
  showSuccess(message: string, details?: string[]): void {
    console.log(`✅ ${message}`);
    if (details && details.length > 0) {
      details.forEach(detail => {
        console.log(`   ${detail}`);
      });
    }
    console.log('');
  }

  /**
   * Creates a standardized warning message
   */
  showWarning(message: string, suggestions?: string[]): void {
    console.log(`⚠️  ${message}`);
    if (suggestions && suggestions.length > 0) {
      console.log('\n💡 Suggestions:');
      suggestions.forEach(suggestion => {
        console.log(`   • ${suggestion}`);
      });
    }
    console.log('');
  }

  /**
   * Creates a standardized info message
   */
  showInfo(message: string, details?: string[]): void {
    console.log(`ℹ️  ${message}`);
    if (details && details.length > 0) {
      details.forEach(detail => {
        console.log(`   ${detail}`);
      });
    }
    console.log('');
  }

  private getSeverityEmoji(severity: 'low' | 'medium' | 'high' | 'critical'): string {
    switch (severity) {
      case 'low': return '⚠️';
      case 'medium': return '❌';
      case 'high': return '🚨';
      case 'critical': return '💥';
      default: return '❌';
    }
  }
}

// Singleton instance for use across commands
export const errorHandler = new ConsoleErrorHandler();