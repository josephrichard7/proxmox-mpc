/**
 * Session State Management for Proxmox-MPC Console
 * Handles persistent session state, preferences, and context
 */

import * as fs from 'fs';
import * as path from 'path';
import { ProjectWorkspace } from '../workspace';

export interface SessionState {
  id: string;
  startTime: Date;
  lastActivity: Date;
  workspace: WorkspaceInfo | null;
  preferences: UserPreferences;
  context: SessionContext;
  statistics: SessionStatistics;
}

export interface WorkspaceInfo {
  name: string;
  path: string;
  lastUsed: Date;
}

export interface UserPreferences {
  prompt: string;
  outputFormat: 'table' | 'json' | 'yaml';
  autoSave: boolean;
  historySize: number;
  theme: 'default' | 'minimal' | 'verbose';
  confirmDangerous: boolean;
  autoComplete: boolean;
}

export interface SessionContext {
  currentPath: string;
  connectionStatus: 'connected' | 'disconnected' | 'unknown';
  lastCommand: string | null;
  commandCount: number;
  errorCount: number;
  workspaceCount: number;
}

export interface SessionStatistics {
  totalSessions: number;
  totalCommands: number;
  averageSessionDuration: number;
  mostUsedCommands: { command: string; count: number }[];
  workspacesUsed: string[];
}

export class SessionManager {
  private sessionFile: string;
  private currentSession: SessionState;
  private autoSaveInterval?: NodeJS.Timeout;

  constructor() {
    this.sessionFile = this.getSessionFilePath();
    this.currentSession = this.createNewSession();
    this.loadPreviousState();
    this.startAutoSave();
  }

  public getCurrentSession(): SessionState {
    return this.currentSession;
  }

  public updateWorkspace(workspace: ProjectWorkspace | null): void {
    if (workspace) {
      this.currentSession.workspace = {
        name: workspace.name,
        path: workspace.rootPath,
        lastUsed: new Date(),
      };
      this.currentSession.context.workspaceCount++;
    } else {
      this.currentSession.workspace = null;
    }
    
    this.currentSession.lastActivity = new Date();
    this.saveSession();
  }

  public updatePreferences(preferences: Partial<UserPreferences>): void {
    this.currentSession.preferences = {
      ...this.currentSession.preferences,
      ...preferences,
    };
    
    this.currentSession.lastActivity = new Date();
    this.saveSession();
  }

  public recordCommand(command: string, success: boolean = true): void {
    this.currentSession.context.lastCommand = command;
    this.currentSession.context.commandCount++;
    
    if (!success) {
      this.currentSession.context.errorCount++;
    }
    
    this.currentSession.lastActivity = new Date();
    
    // Update most used commands
    this.updateCommandStatistics(command);
  }

  public setConnectionStatus(status: 'connected' | 'disconnected' | 'unknown'): void {
    this.currentSession.context.connectionStatus = status;
    this.currentSession.lastActivity = new Date();
  }

  public getSessionSummary(): {
    duration: number;
    commands: number;
    errors: number;
    successRate: number;
    workspace: string | null;
  } {
    const duration = Date.now() - this.currentSession.startTime.getTime();
    const commands = this.currentSession.context.commandCount;
    const errors = this.currentSession.context.errorCount;
    const successRate = commands > 0 ? ((commands - errors) / commands) * 100 : 100;
    
    return {
      duration: Math.round(duration / 1000), // seconds
      commands,
      errors,
      successRate: Math.round(successRate),
      workspace: this.currentSession.workspace?.name || null,
    };
  }

  public getRecentWorkspaces(limit: number = 5): WorkspaceInfo[] {
    try {
      const allSessions = this.loadAllSessions();
      const workspaces = new Map<string, WorkspaceInfo>();
      
      allSessions.forEach(session => {
        if (session.workspace) {
          const existing = workspaces.get(session.workspace.path);
          if (!existing || session.workspace.lastUsed > existing.lastUsed) {
            workspaces.set(session.workspace.path, session.workspace);
          }
        }
      });
      
      return Array.from(workspaces.values())
        .sort((a, b) => b.lastUsed.getTime() - a.lastUsed.getTime())
        .slice(0, limit);
    } catch (error) {
      console.warn('Warning: Could not load recent workspaces');
      return [];
    }
  }

  public exportSession(filePath: string): void {
    try {
      const summary = this.getSessionSummary();
      const exportData = {
        metadata: {
          exportDate: new Date(),
          sessionId: this.currentSession.id,
        },
        session: this.currentSession,
        summary,
        statistics: this.currentSession.statistics,
      };

      const content = JSON.stringify(exportData, null, 2);
      fs.writeFileSync(filePath, content, 'utf-8');
      console.log(`📁 Session exported to: ${filePath}`);
    } catch (error) {
      console.error('❌ Failed to export session:', error);
    }
  }

  public cleanup(): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }
    
    this.finalizeSession();
    this.saveSession();
  }

  private createNewSession(): SessionState {
    return {
      id: this.generateSessionId(),
      startTime: new Date(),
      lastActivity: new Date(),
      workspace: null,
      preferences: this.getDefaultPreferences(),
      context: {
        currentPath: process.cwd(),
        connectionStatus: 'unknown',
        lastCommand: null,
        commandCount: 0,
        errorCount: 0,
        workspaceCount: 0,
      },
      statistics: {
        totalSessions: 1,
        totalCommands: 0,
        averageSessionDuration: 0,
        mostUsedCommands: [],
        workspacesUsed: [],
      },
    };
  }

  private getDefaultPreferences(): UserPreferences {
    return {
      prompt: 'proxmox-mpc> ',
      outputFormat: 'table',
      autoSave: true,
      historySize: 1000,
      theme: 'default',
      confirmDangerous: true,
      autoComplete: true,
    };
  }

  private generateSessionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2);
    return `session-${timestamp}-${random}`;
  }

  private loadPreviousState(): void {
    try {
      const allSessions = this.loadAllSessions();
      if (allSessions.length > 0) {
        const lastSession = allSessions[allSessions.length - 1];
        
        // Inherit preferences from last session
        this.currentSession.preferences = {
          ...this.currentSession.preferences,
          ...lastSession.preferences,
        };
        
        // Update statistics
        this.currentSession.statistics = {
          ...lastSession.statistics,
          totalSessions: lastSession.statistics.totalSessions + 1,
        };
      }
    } catch (error) {
      console.warn('Warning: Could not load previous session state');
    }
  }

  private updateCommandStatistics(command: string): void {
    const stats = this.currentSession.statistics;
    stats.totalCommands++;
    
    // Update most used commands
    const existing = stats.mostUsedCommands.find(c => c.command === command);
    if (existing) {
      existing.count++;
    } else {
      stats.mostUsedCommands.push({ command, count: 1 });
    }
    
    // Keep only top 10 most used commands
    stats.mostUsedCommands.sort((a, b) => b.count - a.count);
    stats.mostUsedCommands = stats.mostUsedCommands.slice(0, 10);
  }

  private finalizeSession(): void {
    const duration = Date.now() - this.currentSession.startTime.getTime();
    const stats = this.currentSession.statistics;
    
    // Update average session duration
    const totalDuration = stats.averageSessionDuration * (stats.totalSessions - 1) + duration;
    stats.averageSessionDuration = Math.round(totalDuration / stats.totalSessions);
    
    // Add workspace to used workspaces
    if (this.currentSession.workspace) {
      const workspaceName = this.currentSession.workspace.name;
      if (!stats.workspacesUsed.includes(workspaceName)) {
        stats.workspacesUsed.push(workspaceName);
      }
    }
  }

  private saveSession(): void {
    try {
      const allSessions = this.loadAllSessions();
      
      // Replace current session if it exists, otherwise add it
      const existingIndex = allSessions.findIndex(s => s.id === this.currentSession.id);
      if (existingIndex >= 0) {
        allSessions[existingIndex] = this.currentSession;
      } else {
        allSessions.push(this.currentSession);
      }
      
      // Keep only last 100 sessions
      const sessionsToKeep = allSessions.slice(-100);
      
      const content = JSON.stringify(sessionsToKeep, null, 2);
      fs.writeFileSync(this.sessionFile, content, 'utf-8');
    } catch (error) {
      console.warn('Warning: Could not save session state:', error);
    }
  }

  private loadAllSessions(): SessionState[] {
    try {
      if (fs.existsSync(this.sessionFile)) {
        const content = fs.readFileSync(this.sessionFile, 'utf-8');
        const sessions = JSON.parse(content);
        
        return sessions.map((session: any) => ({
          ...session,
          startTime: new Date(session.startTime),
          lastActivity: new Date(session.lastActivity),
          workspace: session.workspace ? {
            ...session.workspace,
            lastUsed: new Date(session.workspace.lastUsed),
          } : null,
        }));
      }
    } catch (error) {
      console.warn('Warning: Could not load session history');
    }
    
    return [];
  }

  private startAutoSave(): void {
    if (this.currentSession.preferences.autoSave) {
      this.autoSaveInterval = setInterval(() => {
        this.saveSession();
      }, 30000); // Save every 30 seconds
    }
  }

  private getSessionFilePath(): string {
    const homeDir = process.env.HOME || process.env.USERPROFILE || process.cwd();
    const configDir = path.join(homeDir, '.proxmox-mpc');
    
    // Ensure config directory exists
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    return path.join(configDir, 'sessions.json');
  }
}