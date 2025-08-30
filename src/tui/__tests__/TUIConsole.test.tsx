import React from 'react';
import { render } from 'ink-testing-library';
import { TUIConsole } from '../TUIConsole';
import { ConsoleSession } from '../types';
import { ProjectWorkspace } from '../../workspace';

// Mock workspace
const mockWorkspace: ProjectWorkspace = {
  name: 'test-workspace',
  config: {
    host: '192.168.1.100',
    port: 8006,
    node: 'pve-01',
    username: 'test@pam',
    tokenId: 'test-token',
    tokenSecret: 'test-secret',
    rejectUnauthorized: false,
  },
  rootPath: '/test/workspace',
  configPath: '/test/workspace/.proxmox/config.yml',
  databasePath: '/test/workspace/.proxmox/state.db',
  getDatabaseClient: jest.fn(),
  testDatabaseConnection: jest.fn(),
} as ProjectWorkspace;

const mockSession: ConsoleSession = {
  workspace: mockWorkspace,
  client: undefined,
  rl: {} as any,
  history: ['test command'],
  startTime: new Date(),
};

describe('TUIConsole', () => {
  let mockOnCommand: jest.Mock;
  let mockOnExit: jest.Mock;

  beforeEach(() => {
    mockOnCommand = jest.fn();
    mockOnExit = jest.fn();
    jest.clearAllMocks();
  });

  describe('Basic Functionality', () => {
    it('should implement ConsoleInterface', () => {
      const tuiConsole = new TUIConsole(mockSession);
      
      // Should have required interface methods
      expect(tuiConsole).toHaveProperty('start');
      expect(tuiConsole).toHaveProperty('stop');
      expect(tuiConsole).toHaveProperty('executeCommand');
      
      // Methods should be functions
      expect(typeof tuiConsole.start).toBe('function');
      expect(typeof tuiConsole.stop).toBe('function');
      expect(typeof tuiConsole.executeCommand).toBe('function');
    });

    it('should initialize with session', () => {
      const tuiConsole = new TUIConsole(mockSession);
      
      // Should store session
      expect(tuiConsole.getSession()).toBe(mockSession);
    });

    it('should allow session updates', () => {
      const tuiConsole = new TUIConsole(mockSession);
      const updatedSession = { ...mockSession, history: ['new command'] };
      
      tuiConsole.updateSession(updatedSession);
      expect(tuiConsole.getSession()).toBe(updatedSession);
    });
  });

  describe('Command Execution', () => {
    it('should handle executeCommand method', async () => {
      const tuiConsole = new TUIConsole(mockSession);
      
      // Should not throw when executing commands
      await expect(tuiConsole.executeCommand('/help')).resolves.not.toThrow();
    });

    it('should update history when executing commands', async () => {
      const tuiConsole = new TUIConsole(mockSession);
      const initialHistoryLength = tuiConsole.getSession().history.length;
      
      await tuiConsole.executeCommand('/status');
      
      // History should be updated
      expect(tuiConsole.getSession().history.length).toBe(initialHistoryLength + 1);
      expect(tuiConsole.getSession().history).toContain('/status');
    });

    it('should handle command callbacks', async () => {
      const mockCallback = jest.fn();
      const tuiConsole = new TUIConsole(mockSession, mockCallback);
      
      await tuiConsole.executeCommand('/test');
      
      // Callback should be called
      expect(mockCallback).toHaveBeenCalledWith('/test');
    });
  });

  describe('Lifecycle Management', () => {
    it('should start without errors', async () => {
      const tuiConsole = new TUIConsole(mockSession);
      
      await expect(tuiConsole.start()).resolves.not.toThrow();
    });

    it('should stop without errors', () => {
      const tuiConsole = new TUIConsole(mockSession);
      
      expect(() => tuiConsole.stop()).not.toThrow();
    });

    it('should handle start/stop cycles', async () => {
      const tuiConsole = new TUIConsole(mockSession);
      
      await tuiConsole.start();
      tuiConsole.stop();
      
      // Should be able to start again
      await expect(tuiConsole.start()).resolves.not.toThrow();
    });
  });

  describe('Connection Status Management', () => {
    it('should track connection status', () => {
      const tuiConsole = new TUIConsole(mockSession);
      
      // Should have default connection status
      expect(tuiConsole.getConnectionStatus()).toBeDefined();
      expect(['connected', 'disconnected', 'connecting']).toContain(
        tuiConsole.getConnectionStatus()
      );
    });

    it('should allow connection status updates', () => {
      const tuiConsole = new TUIConsole(mockSession);
      
      tuiConsole.setConnectionStatus('connected');
      expect(tuiConsole.getConnectionStatus()).toBe('connected');
      
      tuiConsole.setConnectionStatus('disconnected');
      expect(tuiConsole.getConnectionStatus()).toBe('disconnected');
    });

    it('should determine initial status from session', () => {
      const sessionWithClient = { ...mockSession, client: {} as any };
      const tuiConsole = new TUIConsole(sessionWithClient);
      
      // Should detect connected status when client exists
      expect(tuiConsole.getConnectionStatus()).toBe('connected');
    });
  });

  describe('Integration with Existing Console Commands', () => {
    it('should be compatible with slash commands', async () => {
      const tuiConsole = new TUIConsole(mockSession);
      
      // Should handle existing slash commands
      const slashCommands = ['/help', '/init', '/status', '/exit'];
      for (const cmd of slashCommands) {
        await expect(tuiConsole.executeCommand(cmd)).resolves.not.toThrow();
      }
    });

    it('should be compatible with resource commands', async () => {
      const tuiConsole = new TUIConsole(mockSession);
      
      // Should handle existing resource commands
      const resourceCommands = [
        'create vm --name test',
        'list vms',
        'describe vm 100',
        'delete vm 100'
      ];
      
      for (const cmd of resourceCommands) {
        await expect(tuiConsole.executeCommand(cmd)).resolves.not.toThrow();
      }
    });

    it('should maintain ConsoleSession interface compatibility', () => {
      const tuiConsole = new TUIConsole(mockSession);
      const session = tuiConsole.getSession();
      
      // Should have all required ConsoleSession properties
      expect(session).toHaveProperty('workspace');
      expect(session).toHaveProperty('client');
      expect(session).toHaveProperty('rl');
      expect(session).toHaveProperty('history');
      expect(session).toHaveProperty('startTime');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid commands gracefully', async () => {
      const tuiConsole = new TUIConsole(mockSession);
      
      await expect(tuiConsole.executeCommand('invalid-command')).resolves.not.toThrow();
    });

    it('should handle session with missing data', () => {
      const invalidSession = {
        ...mockSession,
        workspace: undefined,
        history: null as any,
      };
      
      expect(() => new TUIConsole(invalidSession)).not.toThrow();
    });

    it('should handle command execution errors', async () => {
      const errorCallback = jest.fn().mockRejectedValue(new Error('Command failed'));
      const tuiConsole = new TUIConsole(mockSession, errorCallback);
      
      // Should handle callback errors gracefully
      await expect(tuiConsole.executeCommand('/test')).resolves.not.toThrow();
    });
  });

  describe('Performance', () => {
    it('should initialize quickly', () => {
      const start = Date.now();
      new TUIConsole(mockSession);
      const initTime = Date.now() - start;
      
      expect(initTime).toBeLessThan(50);
    });

    it('should handle rapid command execution', async () => {
      const tuiConsole = new TUIConsole(mockSession);
      
      const start = Date.now();
      const commands = ['/help', '/status', 'list vms', '/exit'];
      
      for (const cmd of commands) {
        await tuiConsole.executeCommand(cmd);
      }
      
      const executionTime = Date.now() - start;
      expect(executionTime).toBeLessThan(100);
    });
  });

  describe('Backward Compatibility', () => {
    it('should work as drop-in replacement for readline console', () => {
      const tuiConsole = new TUIConsole(mockSession);
      
      // Should implement the same interface
      expect(tuiConsole.start).toBeDefined();
      expect(tuiConsole.stop).toBeDefined();
      expect(tuiConsole.executeCommand).toBeDefined();
    });

    it('should maintain existing session behavior', () => {
      const tuiConsole = new TUIConsole(mockSession);
      
      // Session should behave the same way
      expect(tuiConsole.getSession().startTime).toBeInstanceOf(Date);
      expect(Array.isArray(tuiConsole.getSession().history)).toBe(true);
    });

    it('should support existing command handlers', async () => {
      const commandHandler = jest.fn();
      const tuiConsole = new TUIConsole(mockSession, commandHandler);
      
      await tuiConsole.executeCommand('/test-command');
      
      // Should call existing handlers
      expect(commandHandler).toHaveBeenCalledWith('/test-command');
    });
  });
});