/**
 * Tests for Command History Management
 * Testing persistent history, search, and statistics functionality
 */

import * as fs from 'fs';
import * as path from 'path';

import { CommandHistory, HistoryEntry, HistoryFilter } from '../history';

// Mock fs module
jest.mock('fs');
jest.mock('path');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockPath = path as jest.Mocked<typeof path>;

describe('CommandHistory', () => {
  let history: CommandHistory;
  let mockHistoryFile: string;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock file system
    mockHistoryFile = '/mock/.proxmox-mpc/command-history.json';
    mockFs.existsSync.mockReturnValue(false);
    mockFs.mkdirSync.mockImplementation(() => '');
    mockFs.readFileSync.mockReturnValue('[]');
    mockFs.writeFileSync.mockImplementation(() => {});

    // Mock path.join
    mockPath.join.mockReturnValue(mockHistoryFile);

    history = new CommandHistory(5); // Small size for testing
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with empty history when file does not exist', () => {
      expect(history.size()).toBe(0);
    });

    it('should load existing history from file', () => {
      const mockEntries = [
        {
          command: 'test command',
          timestamp: '2024-01-01T00:00:00.000Z',
          workspaceName: 'test-workspace',
        },
      ];
      
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify({ entries: mockEntries }));
      
      const historyWithData = new CommandHistory();
      
      expect(historyWithData.size()).toBe(1);
    });

    it('should handle corrupted history file gracefully', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('invalid json');
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const historyWithCorrupted = new CommandHistory();
      
      expect(historyWithCorrupted.size()).toBe(0);
      expect(consoleSpy).toHaveBeenCalledWith('Warning: Could not load command history, starting fresh');
      
      consoleSpy.mockRestore();
    });
  });

  describe('add', () => {
    it('should add new command to history', () => {
      history.add('test command');
      
      expect(history.size()).toBe(1);
      const recent = history.getRecent(1);
      expect(recent[0].command).toBe('test command');
    });

    it('should add command with workspace and exit code', () => {
      history.add('test command', 'test-workspace', 0, 1000);
      
      const recent = history.getRecent(1);
      expect(recent[0]).toEqual({
        command: 'test command',
        timestamp: expect.any(Date),
        workspaceName: 'test-workspace',
        exitCode: 0,
        duration: 1000,
      });
    });

    it('should not add duplicate consecutive commands', () => {
      history.add('same command');
      history.add('same command');
      
      expect(history.size()).toBe(1);
    });

    it('should limit history size', () => {
      // Add more commands than the limit (5)
      for (let i = 0; i < 10; i++) {
        history.add(`command ${i}`);
      }
      
      expect(history.size()).toBe(5);
      const recent = history.getRecent(5);
      expect(recent[0].command).toBe('command 9'); // Most recent
      expect(recent[4].command).toBe('command 5'); // Oldest kept
    });

    it('should trim whitespace from commands', () => {
      history.add('  spaced command  ');
      
      const recent = history.getRecent(1);
      expect(recent[0].command).toBe('spaced command');
    });
  });

  describe('getRecent', () => {
    beforeEach(() => {
      history.add('command 1');
      history.add('command 2');
      history.add('command 3');
    });

    it('should return recent commands in reverse order', () => {
      const recent = history.getRecent(2);
      
      expect(recent).toHaveLength(2);
      expect(recent[0].command).toBe('command 3');
      expect(recent[1].command).toBe('command 2');
    });

    it('should default to 10 recent commands', () => {
      const recent = history.getRecent();
      
      expect(recent.length).toBeLessThanOrEqual(10);
      expect(recent[0].command).toBe('command 3');
    });

    it('should handle requests for more commands than available', () => {
      const recent = history.getRecent(100);
      
      expect(recent).toHaveLength(3);
    });
  });

  describe('search', () => {
    beforeEach(() => {
      history.add('create vm', 'workspace1', 0);
      history.add('delete vm', 'workspace1', 1);
      history.add('list containers', 'workspace2', 0);
      history.add('create network', 'workspace1', 0);
    });

    it('should filter by workspace', () => {
      const filter: HistoryFilter = { workspace: 'workspace1' };
      const results = history.search(filter);
      
      expect(results).toHaveLength(3);
      expect(results.every(entry => entry.workspaceName === 'workspace1')).toBe(true);
    });

    it('should filter by pattern', () => {
      const filter: HistoryFilter = { pattern: /create/ };
      const results = history.search(filter);
      
      expect(results).toHaveLength(2);
      expect(results.every(entry => entry.command.includes('create'))).toBe(true);
    });

    it('should filter by exit code', () => {
      const filter: HistoryFilter = { exitCode: 0 };
      const results = history.search(filter);
      
      expect(results).toHaveLength(3);
      expect(results.every(entry => entry.exitCode === 0)).toBe(true);
    });

    it('should filter by date range', () => {
      const now = new Date();
      const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      
      const filter: HistoryFilter = { dateFrom: hourAgo };
      const results = history.search(filter);
      
      expect(results).toHaveLength(4); // All commands should be within the last hour
    });

    it('should combine multiple filters', () => {
      const filter: HistoryFilter = {
        workspace: 'workspace1',
        exitCode: 0,
        pattern: /network/,
      };
      const results = history.search(filter);
      
      expect(results).toHaveLength(1);
      expect(results[0].command).toBe('create network');
    });

    it('should return results in reverse chronological order', () => {
      const filter: HistoryFilter = { workspace: 'workspace1' };
      const results = history.search(filter);
      
      expect(results[0].command).toBe('create network'); // Most recent
      expect(results[2].command).toBe('create vm'); // Oldest
    });
  });

  describe('getCommandSuggestions', () => {
    beforeEach(() => {
      history.add('create vm');
      history.add('create container');
      history.add('delete vm');
      history.add('create network');
    });

    it('should return commands that start with partial', () => {
      const suggestions = history.getCommandSuggestions('create');
      
      expect(suggestions).toHaveLength(3);
      expect(suggestions).toContain('create vm');
      expect(suggestions).toContain('create container');
      expect(suggestions).toContain('create network');
    });

    it('should limit suggestions to 10', () => {
      // Add many commands with same prefix
      for (let i = 0; i < 15; i++) {
        history.add(`test command ${i}`);
      }
      
      const suggestions = history.getCommandSuggestions('test');
      
      expect(suggestions.length).toBeLessThanOrEqual(10);
    });

    it('should return unique suggestions', () => {
      history.add('create vm'); // Duplicate
      
      const suggestions = history.getCommandSuggestions('create');
      
      const uniqueSuggestions = [...new Set(suggestions)];
      expect(suggestions).toEqual(uniqueSuggestions);
    });
  });

  describe('getStats', () => {
    beforeEach(() => {
      history.add('create vm', 'workspace1');
      history.add('create vm', 'workspace1'); // Duplicate for counting
      history.add('delete vm', 'workspace2');
      history.add('list containers', 'workspace1');
    });

    it('should return correct statistics', () => {
      const stats = history.getStats();
      
      expect(stats.totalCommands).toBe(3); // Excludes duplicate
      expect(stats.uniqueCommands).toBe(3);
      expect(stats.workspaces).toEqual(['workspace1', 'workspace2']);
    });

    it('should return most used commands', () => {
      const stats = history.getStats();
      
      expect(stats.mostUsed).toHaveLength(3);
      expect(stats.mostUsed[0]).toEqual({ command: 'create vm', count: 1 });
    });

    it('should sort most used commands by count', () => {
      // Add more of the same command with different commands in between
      history.add('popular command');
      history.add('other command');
      history.add('popular command');
      history.add('another command');
      history.add('popular command');
      
      const stats = history.getStats();
      
      expect(stats.mostUsed[0].command).toBe('popular command');
      expect(stats.mostUsed[0].count).toBe(3);
    });
  });

  describe('save and load', () => {
    it('should save history to file', () => {
      history.add('test command');
      
      history.save();
      
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        mockHistoryFile,
        expect.stringContaining('test command'),
        'utf-8'
      );
    });

    it('should handle save errors gracefully', () => {
      mockFs.writeFileSync.mockImplementation(() => {
        throw new Error('Write failed');
      });
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      history.save();
      
      expect(consoleSpy).toHaveBeenCalledWith('Warning: Could not save command history:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });

  describe('clear', () => {
    beforeEach(() => {
      history.add('command 1');
      history.add('command 2');
    });

    it('should clear all history', () => {
      history.clear();
      
      expect(history.size()).toBe(0);
    });

    it('should save after clearing', () => {
      history.clear();
      
      expect(mockFs.writeFileSync).toHaveBeenCalled();
    });
  });

  describe('export', () => {
    beforeEach(() => {
      history.add('test command', 'test-workspace');
    });

    it('should export history to file', () => {
      const exportPath = '/test/export.json';
      
      history.export(exportPath);
      
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        exportPath,
        expect.stringContaining('test command'),
        'utf-8'
      );
    });

    it('should handle export errors', () => {
      mockFs.writeFileSync.mockImplementation(() => {
        throw new Error('Export failed');
      });
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      history.export('/test/export.json');
      
      expect(consoleSpy).toHaveBeenCalledWith('❌ Failed to export history:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });
});