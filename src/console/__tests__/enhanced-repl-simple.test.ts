/**
 * Simplified Enhanced REPL Tests
 * Testing core enhanced console functionality without complex mocking
 */

import { EnhancedInteractiveConsole } from '../enhanced-repl';
import * as readline from 'readline';

// Mock dependencies
jest.mock('readline');
jest.mock('../history');
jest.mock('../completion');
jest.mock('../session');

const mockReadline = readline as jest.Mocked<typeof readline>;

// Mock the SessionManager
const mockSessionManager = {
  getCurrentSession: jest.fn().mockReturnValue({
    id: 'test-session',
    startTime: new Date(),
    lastActivity: new Date(),
    workspace: null,
    preferences: {
      prompt: 'proxmox-mpc> ',
      outputFormat: 'table',
      autoSave: true,
      historySize: 1000,
      theme: 'default',
      confirmDangerous: true,
      autoComplete: true,
    },
    context: {
      currentPath: '/test',
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
  }),
  recordCommand: jest.fn(),
  updateWorkspace: jest.fn(),
  updatePreferences: jest.fn(),
  getRecentWorkspaces: jest.fn().mockReturnValue([]),
  getSessionSummary: jest.fn().mockReturnValue({
    duration: 60,
    commands: 0,
    successRate: 100,
    workspace: null,
  }),
  cleanup: jest.fn(),
};

// Mock the modules
jest.doMock('../session', () => ({
  SessionManager: jest.fn().mockImplementation(() => mockSessionManager),
}));

jest.doMock('../history', () => ({
  CommandHistory: jest.fn().mockImplementation(() => ({
    add: jest.fn(),
    save: jest.fn(),
    getSimpleHistory: jest.fn().mockReturnValue([]),
  })),
}));

jest.doMock('../completion', () => ({
  TabCompletion: jest.fn().mockImplementation(() => ({
    complete: jest.fn().mockReturnValue([[], '']),
    updateContext: jest.fn(),
  })),
}));

describe('EnhancedInteractiveConsole - Simplified', () => {
  let console: EnhancedInteractiveConsole;
  let mockRL: any;

  beforeEach(() => {
    // Mock readline interface
    mockRL = {
      on: jest.fn(),
      prompt: jest.fn(),
      close: jest.fn(),
      setPrompt: jest.fn(),
      history: [],
    };
    mockReadline.createInterface.mockReturnValue(mockRL);

    // Mock console methods
    jest.spyOn(global.console, 'log').mockImplementation(() => {});

    console = new EnhancedInteractiveConsole();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should create console instance successfully', () => {
      expect(console).toBeInstanceOf(EnhancedInteractiveConsole);
    });

    it('should setup readline interface', () => {
      expect(mockReadline.createInterface).toHaveBeenCalledWith({
        input: process.stdin,
        output: process.stdout,
        prompt: expect.any(String),
        historySize: expect.any(Number),
        completer: expect.any(Function),
      });
    });

    it('should setup event handlers', () => {
      expect(mockRL.on).toHaveBeenCalledWith('line', expect.any(Function));
      expect(mockRL.on).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockRL.on).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    });
  });

  describe('start method', () => {
    it('should display welcome message', async () => {
      const logSpy = jest.spyOn(global.console, 'log');
      
      await console.start();

      expect(logSpy).toHaveBeenCalledWith('🔧 Proxmox Infrastructure Console v0.2.0');
      expect(logSpy).toHaveBeenCalledWith('Enhanced interactive console with history and auto-completion\\n');
      expect(mockRL.prompt).toHaveBeenCalled();
    });

    it('should not start twice', async () => {
      await console.start();
      const firstCallCount = mockRL.prompt.mock.calls.length;
      
      await console.start();
      
      expect(mockRL.prompt.mock.calls.length).toBe(firstCallCount);
    });
  });

  describe('workspace management', () => {
    it('should set workspace successfully', () => {
      const mockWorkspace = { name: 'test-workspace', rootPath: '/test' } as any;

      expect(() => {
        console.setWorkspace(mockWorkspace);
      }).not.toThrow();
    });

    it('should clear workspace', () => {
      expect(() => {
        console.setWorkspace(null);
      }).not.toThrow();
    });
  });

  describe('getters', () => {
    it('should return session', () => {
      const session = console.getSession();
      expect(session).toBeDefined();
    });

    it('should return commands', () => {
      const commands = console.getCommands();
      expect(commands).toBeDefined();
    });

    it('should return history', () => {
      const history = console.getHistory();
      expect(history).toBeDefined();
    });
  });

  describe('stop method', () => {
    it('should close readline interface', () => {
      console.stop();
      expect(mockRL.close).toHaveBeenCalled();
    });
  });
});