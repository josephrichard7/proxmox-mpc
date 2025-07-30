/**
 * Tests for Enhanced Interactive Console
 * Testing advanced REPL features including history, completion, and session management
 */

import { EnhancedInteractiveConsole } from '../enhanced-repl';
import { CommandHistory } from '../history';
import { TabCompletion } from '../completion';
import { SessionManager } from '../session';
import * as readline from 'readline';
import * as fs from 'fs';

// Mock dependencies
jest.mock('readline');
jest.mock('fs');
jest.mock('../history');
jest.mock('../completion');
jest.mock('../session');

const mockReadline = readline as jest.Mocked<typeof readline>;
const mockFs = fs as jest.Mocked<typeof fs>;
const MockCommandHistory = CommandHistory as jest.MockedClass<typeof CommandHistory>;
const MockTabCompletion = TabCompletion as jest.MockedClass<typeof TabCompletion>;
const MockSessionManager = SessionManager as jest.MockedClass<typeof SessionManager>;

describe('EnhancedInteractiveConsole', () => {
  let console: EnhancedInteractiveConsole;
  let mockRL: any;
  let mockHistory: jest.Mocked<CommandHistory>;
  let mockCompletion: jest.Mocked<TabCompletion>;
  let mockSessionManager: jest.Mocked<SessionManager>;

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

    // Mock dependencies
    mockHistory = {
      add: jest.fn(),
      save: jest.fn(),
      getSimpleHistory: jest.fn().mockReturnValue([]),
    } as any;
    MockCommandHistory.mockImplementation(() => mockHistory);

    mockCompletion = {
      complete: jest.fn().mockReturnValue([[], '']),
      updateContext: jest.fn(),
    } as any;
    MockTabCompletion.mockImplementation(() => mockCompletion);

    mockSessionManager = {
      getCurrentSession: jest.fn().mockReturnValue({
        preferences: {
          prompt: 'proxmox-mpc> ',
          historySize: 1000,
        },
        workspace: null,
        context: {
          currentPath: '/test',
        },
      }),
      recordCommand: jest.fn(),
      updateWorkspace: jest.fn(),
      updatePreferences: jest.fn(),
      getRecentWorkspaces: jest.fn().mockReturnValue([]),
      getSessionSummary: jest.fn().mockReturnValue({
        duration: 60,
        commands: 5,
        successRate: 100,
        workspace: null,
      }),
      cleanup: jest.fn(),
    } as any;
    MockSessionManager.mockImplementation(() => mockSessionManager);

    // Mock console methods
    jest.spyOn(global.console, 'log').mockImplementation(() => {});
    jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    console = new EnhancedInteractiveConsole();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize all components', () => {
      expect(MockCommandHistory).toHaveBeenCalled();
      expect(MockSessionManager).toHaveBeenCalled();
      expect(MockTabCompletion).toHaveBeenCalledWith({
        workspace: null,
        history: mockHistory,
        commands: expect.any(Object),
      });
    });

    it('should setup readline with completion', () => {
      expect(mockReadline.createInterface).toHaveBeenCalledWith({
        input: process.stdin,
        output: process.stdout,
        prompt: 'proxmox-mpc> ',
        historySize: 1000,
        completer: expect.any(Function),
      });
    });

    it('should setup event handlers', () => {
      expect(mockRL.on).toHaveBeenCalledWith('line', expect.any(Function));
      expect(mockRL.on).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockRL.on).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    });
  });

  describe('start', () => {
    it('should display enhanced welcome message', async () => {
      const logSpy = jest.spyOn(global.console, 'log');
      
      await console.start();

      expect(logSpy).toHaveBeenCalledWith('🔧 Proxmox Infrastructure Console v0.2.0');
      expect(logSpy).toHaveBeenCalledWith('Enhanced interactive console with history and auto-completion\\n');
      expect(logSpy).toHaveBeenCalledWith('💬 Use Tab for auto-completion, ↑↓ for history navigation\\n');
      expect(mockRL.prompt).toHaveBeenCalled();
    });

    it('should show workspace info if available', async () => {
      mockSessionManager.getCurrentSession.mockReturnValue({
        preferences: { prompt: 'proxmox-mpc> ', historySize: 1000 },
        workspace: { name: 'test-workspace', path: '/test' },
        context: { currentPath: '/test' },
      } as any);

      const logSpy = jest.spyOn(global.console, 'log');
      await console.start();

      expect(logSpy).toHaveBeenCalledWith('🏗️  Project workspace: test-workspace');
    });

    it('should show recent workspaces', async () => {
      mockSessionManager.getRecentWorkspaces.mockReturnValue([
        { name: 'workspace1', path: '/path1', lastUsed: new Date() },
        { name: 'workspace2', path: '/path2', lastUsed: new Date() },
      ]);

      const logSpy = jest.spyOn(global.console, 'log');
      await console.start();

      expect(logSpy).toHaveBeenCalledWith('🕒 Recent workspaces: workspace1, workspace2');
    });
  });

  describe('handleInput', () => {
    let lineHandler: Function;

    beforeEach(async () => {
      await console.start();
      const lineCall = mockRL.on.mock.calls.find((call: any) => call[0] === 'line');
      lineHandler = lineCall[1];
    });

    it('should record commands in history and session', async () => {
      await lineHandler('test command');

      expect(mockHistory.add).toHaveBeenCalledWith('test command', undefined, 0);
      expect(mockSessionManager.recordCommand).toHaveBeenCalledWith('test command', true);
    });

    it('should record failed commands with error code', async () => {
      // Mock command registry to throw error
      const mockCommands = console.getCommands();
      jest.spyOn(mockCommands, 'execute').mockRejectedValue(new Error('Test error'));

      await lineHandler('/test');

      expect(mockHistory.add).toHaveBeenCalledWith('/test', undefined, 1);
      expect(mockSessionManager.recordCommand).toHaveBeenCalledWith('/test', false);
    });

    it('should handle slash commands', async () => {
      const mockCommands = console.getCommands();
      jest.spyOn(mockCommands, 'has').mockReturnValue(true);
      jest.spyOn(mockCommands, 'execute').mockResolvedValue();

      await lineHandler('/help');

      expect(mockCommands.execute).toHaveBeenCalledWith('help', [], expect.any(Object));
    });

    it('should handle resource commands', async () => {
      const logSpy = jest.spyOn(global.console, 'log');

      await lineHandler('create vm');

      expect(logSpy).toHaveBeenCalledWith('🚧 Resource command not yet implemented: create vm');
    });

    it('should handle exit command', async () => {
      expect(() => lineHandler('exit')).rejects.toThrow('process.exit called');
      expect(mockHistory.save).toHaveBeenCalled();
      expect(mockSessionManager.cleanup).toHaveBeenCalled();
    });
  });

  describe('setWorkspace', () => {
    it('should update workspace in session manager', () => {
      const mockWorkspace = { name: 'test-workspace', rootPath: '/test' } as any;

      console.setWorkspace(mockWorkspace);

      expect(mockSessionManager.updateWorkspace).toHaveBeenCalledWith(mockWorkspace);
    });

    it('should update completion context', () => {
      const mockWorkspace = { name: 'test-workspace', rootPath: '/test' } as any;

      console.setWorkspace(mockWorkspace);

      expect(mockCompletion.updateContext).toHaveBeenCalledWith({ workspace: mockWorkspace });
    });

    it('should update prompt with workspace name', () => {
      const mockWorkspace = { name: 'test-workspace', rootPath: '/test' } as any;

      console.setWorkspace(mockWorkspace);

      expect(mockSessionManager.updatePreferences).toHaveBeenCalledWith({
        prompt: 'proxmox-mpc:test-workspace> ',
      });
      expect(mockRL.setPrompt).toHaveBeenCalledWith('proxmox-mpc:test-workspace> ');
    });

    it('should reset prompt when workspace is null', () => {
      console.setWorkspace(null);

      expect(mockSessionManager.updatePreferences).toHaveBeenCalledWith({
        prompt: 'proxmox-mpc> ',
      });
      expect(mockRL.setPrompt).toHaveBeenCalledWith('proxmox-mpc> ');
    });
  });

  describe('getters', () => {
    it('should return session from session manager', () => {
      const mockSession = { id: 'test-session' } as any;
      mockSessionManager.getCurrentSession.mockReturnValue(mockSession);

      const session = console.getSession();

      expect(session).toBe(mockSession);
    });

    it('should return command registry', () => {
      const commands = console.getCommands();

      expect(commands).toBeDefined();
      expect(typeof commands.execute).toBe('function');
    });

    it('should return history instance', () => {
      const history = console.getHistory();

      expect(history).toBe(mockHistory);
    });
  });

  describe('stop', () => {
    it('should close readline interface', () => {
      console.stop();

      expect(mockRL.close).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    let lineHandler: Function;

    beforeEach(async () => {
      await console.start();
      const lineCall = mockRL.on.mock.calls.find((call: any) => call[0] === 'line');
      lineHandler = lineCall[1];
    });

    it('should handle command execution errors gracefully', async () => {
      const mockCommands = console.getCommands();
      jest.spyOn(mockCommands, 'has').mockReturnValue(true);
      jest.spyOn(mockCommands, 'execute').mockRejectedValue(new Error('Command failed'));

      const logSpy = jest.spyOn(global.console, 'log');

      await lineHandler('/test');

      expect(logSpy).toHaveBeenCalledWith('❌ Error: Command failed');
      expect(mockRL.prompt).toHaveBeenCalled();
    });

    it('should handle unknown error types', async () => {
      const mockCommands = console.getCommands();
      jest.spyOn(mockCommands, 'has').mockReturnValue(true);
      jest.spyOn(mockCommands, 'execute').mockRejectedValue('String error');

      const logSpy = jest.spyOn(global.console, 'log');

      await lineHandler('/test');

      expect(logSpy).toHaveBeenCalledWith('❌ Error: Unknown error');
    });
  });

  describe('tab completion integration', () => {
    it('should use tab completion for command completion', () => {
      const completer = mockReadline.createInterface.mock.calls[0][0].completer;
      
      // Completer expects a callback as second argument
      const mockCallback = jest.fn();
      completer('test', mockCallback);

      expect(mockCompletion.complete).toHaveBeenCalledWith('test');
    });
  });
});