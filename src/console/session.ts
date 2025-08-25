/**
 * Session State Management for Proxmox-MPC Console
 * Simplified session handling for CLI tool context
 */

import { ProjectWorkspace } from '../workspace';

/**
 * Simple session state for console operations
 */
export interface ConsoleSession {
  startTime: Date;
  workspace: ProjectWorkspace | null;
  history: string[];
}

/**
 * Lightweight session manager for CLI tool
 * Maintains essential session state without complex persistence
 */
export class SessionManager {
  public startTime: Date;
  public workspace: ProjectWorkspace | null = null;
  public history: string[] = [];

  constructor() {
    this.startTime = new Date();
  }

  /**
   * Update the current workspace
   */
  public updateWorkspace(workspace: ProjectWorkspace | null): void {
    this.workspace = workspace;
  }

  /**
   * Get session duration in seconds
   */
  public getDuration(): number {
    return Math.round((Date.now() - this.startTime.getTime()) / 1000);
  }

  /**
   * Get basic session summary for exit message
   */
  public getSessionSummary(): {
    duration: number;
    commands: number;
    workspace: string | null;
  } {
    return {
      duration: this.getDuration(),
      commands: this.history.length,
      workspace: this.workspace?.name || null,
    };
  }
}