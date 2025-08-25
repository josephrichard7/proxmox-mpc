/**
 * Tests for Interactive Console REPL
 * Verifies readline interface setup and command handling
 */

import * as readline from 'readline';

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

import { InteractiveConsole, ConsoleSession } from '../../console/repl';
import { ProjectWorkspace } from '../../workspace';

// Mock dependencies
jest.mock('readline');
jest.mock('../../workspace');
jest.mock('../../console/commands');

describe('InteractiveConsole', () => {
  let console: InteractiveConsole;
  let mockRl: jest.Mocked<readline.Interface>;
  let mockCreateInterface: jest.MockedFunction<typeof readline.createInterface>;

  beforeEach(() => {
    // Mock readline.createInterface
    mockRl = {
      prompt: jest.fn(),
      close: jest.fn(),
      on: jest.fn(),
      question: jest.fn(),
      pause: jest.fn(),
      resume: jest.fn(),
    } as any;

    mockCreateInterface = jest.mocked(readline.createInterface);
    mockCreateInterface.mockReturnValue(mockRl);

    // Mock console methods
    jest.spyOn(global.console, 'log').mockImplementation(() => {});
    jest.spyOn(global.console, 'error').mockImplementation(() => {});
    jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create readline interface with correct options', () => {
      console = new InteractiveConsole();

      expect(mockCreateInterface).toHaveBeenCalledWith({
        input: process.stdin,
        output: process.stdout,
        prompt: 'proxmox-mpc> ',
        historySize: 1000,
      });
    });

    it('should initialize session with readline interface', () => {
      console = new InteractiveConsole();

      const session = (console as any).session;
      expect(session).toMatchObject({
        history: [],
        startTime: expect.any(Date),
        rl: mockRl,
      });
    });

    it('should setup event handlers', () => {
      console = new InteractiveConsole();

      expect(mockRl.on).toHaveBeenCalledWith('line', expect.any(Function));
      expect(mockRl.on).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockRl.on).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    });
  });

  describe('start', () => {
    beforeEach(() => {
      console = new InteractiveConsole();
    });

    it('should display welcome message and prompt', async () => {
      jest.mocked(ProjectWorkspace.detect).mockRejectedValue(new Error('No workspace'));

      await console.start();

      expect(global.console.log).toHaveBeenCalledWith('🔧 Proxmox Infrastructure Console v0.1.0');
      expect(global.console.log).toHaveBeenCalledWith('Welcome! Type /help for commands or /init to get started.\n');
      expect(mockRl.prompt).toHaveBeenCalled();
    });

    it('should detect existing workspace', async () => {
      const mockWorkspace = {
        name: 'test-project',
        config: { host: '192.168.1.100', node: 'pve' }
      };
      jest.mocked(ProjectWorkspace.detect).mockResolvedValue(mockWorkspace as any);

      await console.start();

      expect(global.console.log).toHaveBeenCalledWith(`📁 Workspace detected: ${mockWorkspace.name}`);
      expect(global.console.log).toHaveBeenCalledWith(`   Server: ${mockWorkspace.config.host}`);
      expect(global.console.log).toHaveBeenCalledWith(`   Node: ${mockWorkspace.config.node}`);
    });
  });

  describe('input handling', () => {
    let lineHandler: (input: string) => Promise<void>;

    beforeEach(() => {
      console = new InteractiveConsole();
      
      // Get the line handler that was registered
      const onLineCalls = mockRl.on.mock.calls.filter((call: any) => call[0] === 'line');
      expect(onLineCalls).toHaveLength(1);
      lineHandler = onLineCalls[0][1] as any;
    });

    it('should handle empty input', async () => {
      await lineHandler('');
      
      // Should not add to history or execute commands
      const session = (console as any).session;
      expect(session.history).toHaveLength(0);
    });

    it('should add non-empty input to history', async () => {
      await lineHandler('/help');
      
      const session = (console as any).session;
      expect(session.history).toContain('/help');
    });

    it('should handle slash commands', async () => {
      const mockCommandRegistry = {
        has: jest.fn().mockReturnValue(true),
        execute: jest.fn(() => Promise.resolve()) as any,
      };
      (console as any).commandRegistry = mockCommandRegistry;

      await lineHandler('/help');

      expect(mockCommandRegistry.has).toHaveBeenCalledWith('help');
      expect(mockCommandRegistry.execute).toHaveBeenCalledWith('help', [], expect.any(Object));
    });

    it('should handle unknown slash commands', async () => {
      const mockCommandRegistry = {
        has: jest.fn().mockReturnValue(false),
        execute: jest.fn(),
      };
      (console as any).commandRegistry = mockCommandRegistry;

      await lineHandler('/unknown');

      expect(global.console.log).toHaveBeenCalledWith('❌ Unknown slash command: /unknown');
      expect(mockCommandRegistry.execute).not.toHaveBeenCalled();
    });

    it('should handle built-in help command', async () => {
      await lineHandler('help');

      expect(global.console.log).toHaveBeenCalledWith(expect.stringContaining('📚 Available Commands:'));
    });

    it('should handle exit commands', async () => {
      const stopSpy = jest.spyOn(console, 'stop');

      await lineHandler('exit');
      expect(stopSpy).toHaveBeenCalled();

      await lineHandler('quit');
      expect(stopSpy).toHaveBeenCalledTimes(2);
    });

    it('should handle resource commands (placeholder)', async () => {
      await lineHandler('create vm --name test');

      expect(global.console.log).toHaveBeenCalledWith(
        expect.stringContaining('🚧 Resource commands not yet implemented')
      );
    });

    it('should handle unknown commands', async () => {
      await lineHandler('unknown-command');

      expect(global.console.log).toHaveBeenCalledWith('Unknown command: unknown-command');
      expect(global.console.log).toHaveBeenCalledWith('Type "help" or "/help" for available commands');
    });

    it('should handle command execution errors', async () => {
      const mockCommandRegistry = {
        has: jest.fn().mockReturnValue(true),
        execute: jest.fn(() => Promise.reject(new Error('Command failed'))) as any,
      };
      (console as any).commandRegistry = mockCommandRegistry;

      await lineHandler('/test');

      expect(global.console.error).toHaveBeenCalledWith('❌ Error: Command failed');
    });
  });

  describe('event handlers', () => {
    beforeEach(() => {
      console = new InteractiveConsole();
    });

    it('should handle close event', () => {
      const closeHandler = mockRl.on.mock.calls.find((call: any) => call[0] === 'close')?.[1] as Function;
      expect(closeHandler).toBeDefined();

      closeHandler();

      expect(global.console.log).toHaveBeenCalledWith(expect.stringContaining('👋 Session ended'));
      expect(global.console.log).toHaveBeenCalledWith('Thank you for using Proxmox-MPC!');
      expect(process.exit).toHaveBeenCalledWith(0);
    });

    it('should handle SIGINT (Ctrl+C)', () => {
      const sigintHandler = mockRl.on.mock.calls.find((call: any) => call[0] === 'SIGINT')?.[1] as Function;
      expect(sigintHandler).toBeDefined();

      sigintHandler();

      expect(global.console.log).toHaveBeenCalledWith('\n\n👋 Goodbye!');
      expect(process.exit).toHaveBeenCalledWith(0);
    });
  });

  describe('stop', () => {
    it('should close readline interface and stop running', () => {
      console = new InteractiveConsole();
      
      console.stop();

      expect(mockRl.close).toHaveBeenCalled();
      expect((console as any).isRunning).toBe(false);
    });
  });
});