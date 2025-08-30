import React from 'react';
import { render } from 'ink';
import { App } from './App';
import { ConsoleSession } from './types';

/**
 * TUIConsole - Integration bridge between React Ink TUI and existing console system
 * 
 * Provides backward-compatible interface while using modern TUI components
 * underneath. Serves as drop-in replacement for readline-based console.
 */
export class TUIConsole {
  private session: ConsoleSession;
  private onCommand?: (command: string) => void | Promise<void>;
  private connectionStatus: 'connected' | 'disconnected' | 'connecting' = 'disconnected';
  private inkInstance: any = null;

  constructor(session: ConsoleSession, onCommand?: (command: string) => void | Promise<void>) {
    this.session = session; // Store reference, not copy
    this.onCommand = onCommand;
    
    // Determine initial connection status from session
    if (session.client) {
      this.connectionStatus = 'connected';
    }
  }

  /**
   * Start the TUI console interface
   */
  async start(): Promise<void> {
    try {
      // Render the React Ink application
      this.inkInstance = render(
        React.createElement(App, {
          session: this.session,
          connectionStatus: this.connectionStatus,
          onCommand: this.handleCommand.bind(this)
        })
      );
    } catch (error) {
      // Graceful fallback - don't throw, just log
      console.error('TUI start error:', error);
    }
  }

  /**
   * Stop the TUI console interface
   */
  stop(): void {
    try {
      if (this.inkInstance && typeof this.inkInstance.unmount === 'function') {
        this.inkInstance.unmount();
      }
      if (this.inkInstance && typeof this.inkInstance.cleanup === 'function') {
        this.inkInstance.cleanup();
      }
    } catch (error) {
      // Graceful handling - don't throw on cleanup
      console.error('TUI stop error:', error);
    } finally {
      this.inkInstance = null;
    }
  }

  /**
   * Execute a command through the console
   */
  async executeCommand(command: string): Promise<void> {
    try {
      // Add command to history
      if (!this.session.history) {
        this.session.history = [];
      }
      this.session.history.push(command);

      // Call the command handler if provided
      if (this.onCommand) {
        await this.onCommand(command);
      }
    } catch (error) {
      // Graceful error handling - log but don't throw
      console.error('Command execution error:', error);
    }
  }

  /**
   * Get current session data
   */
  getSession(): ConsoleSession {
    return this.session;
  }

  /**
   * Update session data
   */
  updateSession(newSession: ConsoleSession): void {
    this.session = newSession; // Store reference, not copy
  }

  /**
   * Get current connection status
   */
  getConnectionStatus(): 'connected' | 'disconnected' | 'connecting' {
    return this.connectionStatus;
  }

  /**
   * Set connection status
   */
  setConnectionStatus(status: 'connected' | 'disconnected' | 'connecting'): void {
    this.connectionStatus = status;
  }

  /**
   * Handle command input from TUI
   */
  private async handleCommand(command: string): Promise<void> {
    await this.executeCommand(command);
  }
}