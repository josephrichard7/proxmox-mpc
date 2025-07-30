/**
 * Tests for Session State Management
 * Testing persistent session state, preferences, and context tracking
 */

import { SessionManager, SessionState, UserPreferences, WorkspaceInfo } from '../session';
import { ProjectWorkspace } from '../../workspace';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs module
jest.mock('fs');
jest.mock('path');
jest.mock('../../workspace');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockPath = path as jest.Mocked<typeof path>;

describe('SessionManager', () => {
  let sessionManager: SessionManager;
  let mockSessionFile: string;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock file system
    mockSessionFile = '/mock/.proxmox-mpc/sessions.json';
    mockFs.existsSync.mockReturnValue(false);
    mockFs.mkdirSync.mockImplementation(() => '');
    mockFs.readFileSync.mockReturnValue('[]');
    mockFs.writeFileSync.mockImplementation(() => {});

    // Mock path.join
    mockPath.join.mockReturnValue(mockSessionFile);

    // Mock timers for auto-save testing
    jest.useFakeTimers();

    sessionManager = new SessionManager();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create new session with default values', () => {
      const session = sessionManager.getCurrentSession();
      
      expect(session.id).toMatch(/^session-/);
      expect(session.startTime).toBeInstanceOf(Date);
      expect(session.workspace).toBeNull();
      expect(session.preferences).toEqual({
        prompt: 'proxmox-mpc> ',
        outputFormat: 'table',
        autoSave: true,
        historySize: 1000,
        theme: 'default',
        confirmDangerous: true,
        autoComplete: true,
      });
    });

    it('should load previous session preferences', () => {
      const previousSessions = [
        {
          id: 'previous-session',
          preferences: {
            prompt: 'custom> ',
            outputFormat: 'json',
            theme: 'minimal',
          },
          statistics: {
            totalSessions: 5,
            totalCommands: 100,
            averageSessionDuration: 3600000,
            mostUsedCommands: [],
            workspacesUsed: [],
          },
        },
      ];
      
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(previousSessions));
      
      const sessionWithHistory = new SessionManager();
      const session = sessionWithHistory.getCurrentSession();
      
      expect(session.preferences.outputFormat).toBe('json');
      expect(session.preferences.theme).toBe('minimal');
      expect(session.statistics.totalSessions).toBe(6); // Incremented
    });

    it('should start auto-save interval when autoSave is enabled', () => {
      const setIntervalSpy = jest.spyOn(global, 'setInterval');
      
      new SessionManager();
      
      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 30000);
    });
  });

  describe('updateWorkspace', () => {
    it('should update workspace info', () => {
      const mockWorkspace = {
        name: 'test-workspace',
        rootPath: '/test/path',
      } as ProjectWorkspace;
      
      sessionManager.updateWorkspace(mockWorkspace);
      
      const session = sessionManager.getCurrentSession();
      expect(session.workspace).toEqual({
        name: 'test-workspace',
        path: '/test/path',
        lastUsed: expect.any(Date),
      });
      expect(session.context.workspaceCount).toBe(1);
    });

    it('should clear workspace when null is provided', () => {
      // Set workspace first
      const mockWorkspace = { name: 'test', rootPath: '/test' } as ProjectWorkspace;
      sessionManager.updateWorkspace(mockWorkspace);
      
      // Then clear it
      sessionManager.updateWorkspace(null);
      
      const session = sessionManager.getCurrentSession();
      expect(session.workspace).toBeNull();
    });

    it('should update last activity time', () => {
      const beforeUpdate = new Date();
      
      sessionManager.updateWorkspace(null);
      
      const session = sessionManager.getCurrentSession();
      expect(session.lastActivity.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime());
    });
  });

  describe('updatePreferences', () => {
    it('should update user preferences', () => {
      const newPreferences: Partial<UserPreferences> = {
        outputFormat: 'yaml',
        theme: 'verbose',
        autoComplete: false,
      };
      
      sessionManager.updatePreferences(newPreferences);
      
      const session = sessionManager.getCurrentSession();
      expect(session.preferences.outputFormat).toBe('yaml');
      expect(session.preferences.theme).toBe('verbose');
      expect(session.preferences.autoComplete).toBe(false);
      // Other preferences should remain unchanged
      expect(session.preferences.prompt).toBe('proxmox-mpc> ');
    });

    it('should trigger save after updating preferences', () => {
      sessionManager.updatePreferences({ outputFormat: 'json' });
      
      expect(mockFs.writeFileSync).toHaveBeenCalled();
    });
  });

  describe('recordCommand', () => {
    it('should record successful command', () => {
      sessionManager.recordCommand('test command', true);
      
      const session = sessionManager.getCurrentSession();
      expect(session.context.lastCommand).toBe('test command');
      expect(session.context.commandCount).toBe(1);
      expect(session.context.errorCount).toBe(0);
    });

    it('should record failed command', () => {
      sessionManager.recordCommand('failed command', false);
      
      const session = sessionManager.getCurrentSession();
      expect(session.context.errorCount).toBe(1);
    });

    it('should update command statistics', () => {
      sessionManager.recordCommand('popular command');
      sessionManager.recordCommand('popular command');
      sessionManager.recordCommand('other command');
      
      const session = sessionManager.getCurrentSession();
      expect(session.statistics.totalCommands).toBe(3);
      expect(session.statistics.mostUsedCommands).toContainEqual({
        command: 'popular command',
        count: 2,
      });
    });

    it('should limit most used commands to 10', () => {
      // Record 15 different commands
      for (let i = 0; i < 15; i++) {
        sessionManager.recordCommand(`command ${i}`);
      }
      
      const session = sessionManager.getCurrentSession();
      expect(session.statistics.mostUsedCommands.length).toBeLessThanOrEqual(10);
    });

    it('should sort most used commands by count', () => {
      sessionManager.recordCommand('rare command');
      sessionManager.recordCommand('popular command');
      sessionManager.recordCommand('popular command');
      sessionManager.recordCommand('popular command');
      
      const session = sessionManager.getCurrentSession();
      expect(session.statistics.mostUsedCommands[0]).toEqual({
        command: 'popular command',
        count: 3,
      });
    });
  });

  describe('setConnectionStatus', () => {
    it('should update connection status', () => {
      sessionManager.setConnectionStatus('connected');
      
      const session = sessionManager.getCurrentSession();
      expect(session.context.connectionStatus).toBe('connected');
    });

    it('should update last activity time', () => {
      const beforeUpdate = new Date();
      
      sessionManager.setConnectionStatus('disconnected');
      
      const session = sessionManager.getCurrentSession();
      expect(session.lastActivity.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime());
    });
  });

  describe('getSessionSummary', () => {
    beforeEach(() => {
      // Setup session with some data
      sessionManager.recordCommand('command 1', true);
      sessionManager.recordCommand('command 2', false);
      sessionManager.recordCommand('command 3', true);
      
      const mockWorkspace = { name: 'test-workspace', rootPath: '/test' } as ProjectWorkspace;
      sessionManager.updateWorkspace(mockWorkspace);
    });

    it('should return correct session summary', () => {
      const summary = sessionManager.getSessionSummary();
      
      expect(summary.commands).toBe(3);
      expect(summary.errors).toBe(1);
      expect(summary.successRate).toBe(67); // 2/3 * 100, rounded
      expect(summary.workspace).toBe('test-workspace');
      expect(summary.duration).toBeGreaterThan(0);
    });

    it('should handle 100% success rate', () => {
      // Create new session with only successful commands
      const newSessionManager = new SessionManager();
      newSessionManager.recordCommand('success 1', true);
      newSessionManager.recordCommand('success 2', true);
      
      const summary = newSessionManager.getSessionSummary();
      expect(summary.successRate).toBe(100);
    });

    it('should handle no commands', () => {
      const newSessionManager = new SessionManager();
      const summary = newSessionManager.getSessionSummary();
      
      expect(summary.commands).toBe(0);
      expect(summary.errors).toBe(0);
      expect(summary.successRate).toBe(100);
    });
  });

  describe('getRecentWorkspaces', () => {
    it('should return recent workspaces from all sessions', () => {
      const mockSessions = [
        {
          workspace: {
            name: 'workspace1',
            path: '/path1',
            lastUsed: '2024-01-01T00:00:00.000Z',
          },
        },
        {
          workspace: {
            name: 'workspace2',
            path: '/path2',
            lastUsed: '2024-01-02T00:00:00.000Z',
          },
        },
      ];
      
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockSessions));
      
      const workspaces = sessionManager.getRecentWorkspaces();
      
      expect(workspaces).toHaveLength(2);
      expect(workspaces[0].name).toBe('workspace2'); // Most recent first
      expect(workspaces[1].name).toBe('workspace1');
    });

    it('should limit results to specified count', () => {
      const mockSessions = Array.from({ length: 10 }, (_, i) => ({
        workspace: {
          name: `workspace${i}`,
          path: `/path${i}`,
          lastUsed: new Date().toISOString(),
        },
      }));
      
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockSessions));
      
      const workspaces = sessionManager.getRecentWorkspaces(3);
      
      expect(workspaces).toHaveLength(3);
    });

    it('should handle duplicate workspace paths', () => {
      const mockSessions = [
        {
          workspace: {
            name: 'workspace1',
            path: '/same-path',
            lastUsed: '2024-01-01T00:00:00.000Z',
          },
        },
        {
          workspace: {
            name: 'workspace1-updated',
            path: '/same-path',
            lastUsed: '2024-01-02T00:00:00.000Z',
          },
        },
      ];
      
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockSessions));
      
      const workspaces = sessionManager.getRecentWorkspaces();
      
      expect(workspaces).toHaveLength(1);
      expect(workspaces[0].name).toBe('workspace1-updated'); // Most recent version
    });

    it('should handle load errors gracefully', () => {
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('Read failed');
      });
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const workspaces = sessionManager.getRecentWorkspaces();
      
      expect(workspaces).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith('Warning: Could not load recent workspaces');
      
      consoleSpy.mockRestore();
    });
  });

  describe('exportSession', () => {
    it('should export session data to file', () => {
      const exportPath = '/test/session-export.json';
      
      sessionManager.exportSession(exportPath);
      
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        exportPath,
        expect.stringContaining('sessionId'),
        'utf-8'
      );
    });

    it('should handle export errors', () => {
      mockFs.writeFileSync.mockImplementation(() => {
        throw new Error('Export failed');
      });
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      sessionManager.exportSession('/test/export.json');
      
      expect(consoleSpy).toHaveBeenCalledWith('❌ Failed to export session:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });

  describe('cleanup', () => {
    it('should clear auto-save interval', () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      
      sessionManager.cleanup();
      
      expect(clearIntervalSpy).toHaveBeenCalled();
    });

    it('should finalize session statistics', () => {
      const mockWorkspace = { name: 'test-workspace', rootPath: '/test' } as ProjectWorkspace;
      sessionManager.updateWorkspace(mockWorkspace);
      
      sessionManager.cleanup();
      
      const session = sessionManager.getCurrentSession();
      expect(session.statistics.workspacesUsed).toContain('test-workspace');
      expect(session.statistics.averageSessionDuration).toBeGreaterThan(0);
    });

    it('should save final session state', () => {
      sessionManager.cleanup();
      
      expect(mockFs.writeFileSync).toHaveBeenCalled();
    });
  });

  describe('auto-save functionality', () => {
    it('should auto-save session periodically', () => {
      // Fast-forward 30 seconds
      jest.advanceTimersByTime(30000);
      
      expect(mockFs.writeFileSync).toHaveBeenCalled();
    });

    it('should not auto-save if autoSave is disabled', () => {
      sessionManager.updatePreferences({ autoSave: false });
      
      // Clear previous calls
      jest.clearAllMocks();
      
      // Fast-forward 30 seconds
      jest.advanceTimersByTime(30000);
      
      expect(mockFs.writeFileSync).not.toHaveBeenCalled();
    });
  });

  describe('session persistence', () => {
    it('should save and load session history', () => {
      sessionManager.recordCommand('test command');
      
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        mockSessionFile,
        expect.stringContaining('test command'),
        'utf-8'
      );
    });

    it('should limit saved sessions to 100', () => {
      // Mock 150 existing sessions
      const manySessions = Array.from({ length: 150 }, (_, i) => ({
        id: `session-${i}`,
        startTime: new Date(),
        lastActivity: new Date(),
      }));
      
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(manySessions));
      
      sessionManager.recordCommand('trigger save');
      
      // Should save only last 100 sessions plus current
      const saveCall = mockFs.writeFileSync.mock.calls.find(call => call[0] === mockSessionFile);
      expect(saveCall).toBeDefined();
      if (saveCall) {
        const savedData = JSON.parse(saveCall[1] as string);
        expect(savedData.length).toBeLessThanOrEqual(100);
      }
    });

    it('should handle corrupted session file', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('invalid json');
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      new SessionManager();
      
      expect(consoleSpy).toHaveBeenCalledWith('Warning: Could not load session history');
      
      consoleSpy.mockRestore();
    });
  });
});