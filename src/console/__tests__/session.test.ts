/**
 * Session Manager Tests
 * Tests for simplified session management
 */

import { SessionManager } from '../session';
import { ProjectWorkspace } from '../../workspace';

describe('SessionManager', () => {
  let sessionManager: SessionManager;

  beforeEach(() => {
    sessionManager = new SessionManager();
  });

  describe('Basic Session Creation', () => {
    test('should create a new session with start time', () => {
      expect(sessionManager.startTime).toBeInstanceOf(Date);
      expect(sessionManager.workspace).toBeNull();
      expect(sessionManager.history).toEqual([]);
    });

    test('should have reasonable start time', () => {
      const now = new Date();
      const timeDiff = now.getTime() - sessionManager.startTime.getTime();
      expect(timeDiff).toBeLessThan(1000); // Within 1 second
    });
  });

  describe('Workspace Management', () => {
    test('should update workspace', () => {
      const mockWorkspace = {
        name: 'test-project',
        rootPath: '/test/path',
        configPath: '/test/path/.proxmox/config.yml',
        databasePath: '/test/path/.proxmox/state.db',
        config: {
          host: 'test-server',
          node: 'test-node',
          username: 'test-user',
          apiToken: 'test-token'
        },
        getDatabaseClient: jest.fn(),
        testDatabaseConnection: jest.fn()
      } as unknown as ProjectWorkspace;

      sessionManager.updateWorkspace(mockWorkspace);
      expect(sessionManager.workspace).toBe(mockWorkspace);
    });

    test('should clear workspace when set to null', () => {
      const mockWorkspace = {
        name: 'test-project',
        rootPath: '/test/path',
        configPath: '/test/path/.proxmox/config.yml',
        databasePath: '/test/path/.proxmox/state.db',
        config: {},
        getDatabaseClient: jest.fn(),
        testDatabaseConnection: jest.fn()
      } as unknown as ProjectWorkspace;

      sessionManager.updateWorkspace(mockWorkspace);
      expect(sessionManager.workspace).toBe(mockWorkspace);

      sessionManager.updateWorkspace(null);
      expect(sessionManager.workspace).toBeNull();
    });
  });

  describe('Session Summary', () => {
    test('should return correct session summary', () => {
      // Add some commands to history
      sessionManager.history.push('command1');
      sessionManager.history.push('command2');

      const summary = sessionManager.getSessionSummary();
      
      expect(summary.commands).toBe(2);
      expect(summary.duration).toBeGreaterThanOrEqual(0);
      expect(summary.workspace).toBeNull();
    });

    test('should include workspace name in summary', () => {
      const mockWorkspace = {
        name: 'test-workspace',
        rootPath: '/test/path',
        configPath: '/test/path/.proxmox/config.yml',
        databasePath: '/test/path/.proxmox/state.db',
        config: {},
        getDatabaseClient: jest.fn(),
        testDatabaseConnection: jest.fn()
      } as unknown as ProjectWorkspace;

      sessionManager.updateWorkspace(mockWorkspace);
      const summary = sessionManager.getSessionSummary();
      
      expect(summary.workspace).toBe('test-workspace');
    });

    test('should calculate duration correctly', () => {
      const summary = sessionManager.getSessionSummary();
      expect(typeof summary.duration).toBe('number');
      expect(summary.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('History Management', () => {
    test('should maintain command history', () => {
      expect(sessionManager.history).toEqual([]);
      
      sessionManager.history.push('test command');
      expect(sessionManager.history).toEqual(['test command']);
      
      sessionManager.history.push('another command');
      expect(sessionManager.history).toEqual(['test command', 'another command']);
    });
  });

  describe('getDuration', () => {
    test('should return duration in seconds', () => {
      const duration = sessionManager.getDuration();
      expect(typeof duration).toBe('number');
      expect(duration).toBeGreaterThanOrEqual(0);
    });

    test('should increase over time', async () => {
      const initialDuration = sessionManager.getDuration();
      
      // Wait a short time
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const laterDuration = sessionManager.getDuration();
      expect(laterDuration).toBeGreaterThanOrEqual(initialDuration);
    });
  });
});