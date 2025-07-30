/**
 * Command History Management for Proxmox-MPC Console
 * Handles persistent command history with search and filtering capabilities
 */

import * as fs from 'fs';
import * as path from 'path';

export interface HistoryEntry {
  command: string;
  timestamp: Date;
  workspaceName?: string;
  exitCode?: number;
  duration?: number;
}

export interface HistoryFilter {
  workspace?: string;
  dateFrom?: Date;
  dateTo?: Date;
  pattern?: RegExp;
  exitCode?: number;
}

export class CommandHistory {
  private historyFile: string;
  private maxSize: number;
  private entries: HistoryEntry[] = [];

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
    this.historyFile = this.getHistoryFilePath();
    this.loadHistory();
  }

  public add(
    command: string, 
    workspaceName?: string, 
    exitCode?: number, 
    duration?: number
  ): void {
    const entry: HistoryEntry = {
      command: command.trim(),
      timestamp: new Date(),
      workspaceName,
      exitCode,
      duration,
    };

    // Don't add duplicate consecutive commands
    const lastEntry = this.entries[this.entries.length - 1];
    if (lastEntry && lastEntry.command === entry.command) {
      return;
    }

    this.entries.push(entry);

    // Limit history size
    if (this.entries.length > this.maxSize) {
      this.entries = this.entries.slice(-this.maxSize);
    }
  }

  public getRecent(count: number = 10): HistoryEntry[] {
    return this.entries.slice(-count).reverse();
  }

  public search(filter: HistoryFilter): HistoryEntry[] {
    return this.entries.filter(entry => {
      // Workspace filter
      if (filter.workspace && entry.workspaceName !== filter.workspace) {
        return false;
      }

      // Date range filter
      if (filter.dateFrom && entry.timestamp < filter.dateFrom) {
        return false;
      }
      if (filter.dateTo && entry.timestamp > filter.dateTo) {
        return false;
      }

      // Pattern filter
      if (filter.pattern && !filter.pattern.test(entry.command)) {
        return false;
      }

      // Exit code filter
      if (filter.exitCode !== undefined && entry.exitCode !== filter.exitCode) {
        return false;
      }

      return true;
    }).reverse(); // Most recent first
  }

  public getCommandSuggestions(partial: string): string[] {
    const suggestions = new Set<string>();
    
    this.entries
      .filter(entry => entry.command.startsWith(partial))
      .forEach(entry => suggestions.add(entry.command));
    
    return Array.from(suggestions).slice(0, 10);
  }

  public getStats(): {
    totalCommands: number;
    uniqueCommands: number;
    mostUsed: { command: string; count: number }[];
    workspaces: string[];
  } {
    const commandCounts = new Map<string, number>();
    const workspaces = new Set<string>();

    this.entries.forEach(entry => {
      // Count commands
      const count = commandCounts.get(entry.command) || 0;
      commandCounts.set(entry.command, count + 1);

      // Collect workspaces
      if (entry.workspaceName) {
        workspaces.add(entry.workspaceName);
      }
    });

    // Get most used commands
    const mostUsed = Array.from(commandCounts.entries())
      .map(([command, count]) => ({ command, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalCommands: this.entries.length,
      uniqueCommands: commandCounts.size,
      mostUsed,
      workspaces: Array.from(workspaces),
    };
  }

  public clear(): void {
    this.entries = [];
    this.save();
  }

  public save(): void {
    try {
      const data = {
        version: '1.0',
        entries: this.entries,
      };
      
      const content = JSON.stringify(data, null, 2);
      fs.writeFileSync(this.historyFile, content, 'utf-8');
    } catch (error) {
      console.warn('Warning: Could not save command history:', error);
    }
  }

  public export(filePath: string): void {
    try {
      const stats = this.getStats();
      const exportData = {
        metadata: {
          exportDate: new Date(),
          totalCommands: stats.totalCommands,
          uniqueCommands: stats.uniqueCommands,
          workspaces: stats.workspaces,
        },
        history: this.entries,
        statistics: stats,
      };

      const content = JSON.stringify(exportData, null, 2);
      fs.writeFileSync(filePath, content, 'utf-8');
      console.log(`📁 History exported to: ${filePath}`);
    } catch (error) {
      console.error('❌ Failed to export history:', error);
    }
  }

  private loadHistory(): void {
    try {
      if (fs.existsSync(this.historyFile)) {
        const content = fs.readFileSync(this.historyFile, 'utf-8');
        const data = JSON.parse(content);
        
        if (data.entries && Array.isArray(data.entries)) {
          this.entries = data.entries.map((entry: any) => ({
            ...entry,
            timestamp: new Date(entry.timestamp),
          }));
        }
      }
    } catch (error) {
      console.warn('Warning: Could not load command history, starting fresh');
      this.entries = [];
    }
  }

  private getHistoryFilePath(): string {
    const homeDir = process.env.HOME || process.env.USERPROFILE || process.cwd();
    const configDir = path.join(homeDir, '.proxmox-mpc');
    
    // Ensure config directory exists
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    return path.join(configDir, 'command-history.json');
  }

  // Simple format for readline history
  public getSimpleHistory(): string[] {
    return this.entries.map(entry => entry.command);
  }

  public size(): number {
    return this.entries.length;
  }
}