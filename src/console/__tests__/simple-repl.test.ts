/**
 * Tests for SimpleInteractiveConsole
 * Testing basic REPL functionality and command handling
 */

import { SimpleInteractiveConsole } from '../simple-repl';
import * as readline from 'readline';

// Mock readline
jest.mock('readline');
const mockReadline = readline as jest.Mocked<typeof readline>;

describe('SimpleInteractiveConsole', () => {
  let console: SimpleInteractiveConsole;
  let mockRL: any;
  let mockStdout: jest.SpyInstance;
  let mockExit: jest.SpyInstance;

  beforeEach(() => {
    // Mock readline interface
    mockRL = {
      on: jest.fn(),
      prompt: jest.fn(),
      close: jest.fn(),
    };
    mockReadline.createInterface.mockReturnValue(mockRL);

    // Mock console output
    mockStdout = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    jest.spyOn(global.console, 'log').mockImplementation(() => {});

    // Mock process.exit
    mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    console = new SimpleInteractiveConsole();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create readline interface with correct options', () => {
      expect(mockReadline.createInterface).toHaveBeenCalledWith({
        input: process.stdin,
        output: process.stdout,
        prompt: 'proxmox-mpc> ',
        historySize: 1000,
      });
    });

    it('should setup event handlers', () => {
      expect(mockRL.on).toHaveBeenCalledWith('line', expect.any(Function));
      expect(mockRL.on).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockRL.on).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    });
  });

  describe('start', () => {
    it('should display welcome message and prompt', async () => {
      const logSpy = jest.spyOn(global.console, 'log');
      
      await console.start();

      expect(logSpy).toHaveBeenCalledWith('🔧 Proxmox Infrastructure Console v0.1.0');
      expect(logSpy).toHaveBeenCalledWith('Welcome! This is a basic test version of the interactive console.\n');
      expect(mockRL.prompt).toHaveBeenCalled();
    });
  });

  describe('handleInput', () => {
    let lineHandler: Function;

    beforeEach(async () => {
      await console.start();
      // Get the line handler that was registered
      const lineCall = mockRL.on.mock.calls.find((call: any) => call[0] === 'line');
      lineHandler = lineCall[1];
    });

    it('should handle help command', async () => {
      const logSpy = jest.spyOn(global.console, 'log');

      await lineHandler('help');

      expect(logSpy).toHaveBeenCalledWith('\n📚 Simple Console Commands:\n');
      expect(mockRL.prompt).toHaveBeenCalled();
    });

    it('should handle /help command', async () => {
      const logSpy = jest.spyOn(global.console, 'log');

      await lineHandler('/help');

      expect(logSpy).toHaveBeenCalledWith('\n📚 Simple Console Commands:\n');
      expect(mockRL.prompt).toHaveBeenCalled();
    });

    it('should handle exit command', async () => {
      await lineHandler('exit');

      expect(mockRL.close).toHaveBeenCalled();
    });

    it('should handle quit command', async () => {
      await lineHandler('quit');

      expect(mockRL.close).toHaveBeenCalled();
    });

    it('should handle /exit command', async () => {
      await lineHandler('/exit');

      expect(mockRL.close).toHaveBeenCalled();
    });

    it('should handle unknown slash commands', async () => {
      const logSpy = jest.spyOn(global.console, 'log');

      await lineHandler('/unknown');

      expect(logSpy).toHaveBeenCalledWith('🚧 Slash command not yet implemented: /unknown');
      expect(mockRL.prompt).toHaveBeenCalled();
    });

    it('should handle unknown regular commands', async () => {
      const logSpy = jest.spyOn(global.console, 'log');

      await lineHandler('unknown');

      expect(logSpy).toHaveBeenCalledWith('🚧 Command not yet implemented: unknown');
      expect(logSpy).toHaveBeenCalledWith('   Type "help" for available commands');
      expect(mockRL.prompt).toHaveBeenCalled();
    });

    it('should ignore empty input', async () => {
      const logSpy = jest.spyOn(global.console, 'log');
      const initialCallCount = logSpy.mock.calls.length;

      await lineHandler('');

      expect(logSpy.mock.calls.length).toBe(initialCallCount);
      expect(mockRL.prompt).toHaveBeenCalled();
    });

    it('should ignore whitespace-only input', async () => {
      const logSpy = jest.spyOn(global.console, 'log');
      const initialCallCount = logSpy.mock.calls.length;

      await lineHandler('   ');

      expect(logSpy.mock.calls.length).toBe(initialCallCount);
      expect(mockRL.prompt).toHaveBeenCalled();
    });
  });

  describe('event handlers', () => {
    it('should handle close event', async () => {
      const logSpy = jest.spyOn(global.console, 'log');
      await console.start();

      const closeHandler = mockRL.on.mock.calls.find((call: any) => call[0] === 'close')[1];
      
      expect(() => closeHandler()).toThrow('process.exit called');
      expect(logSpy).toHaveBeenCalledWith('\n👋 Goodbye!');
    });

    it('should handle SIGINT event', async () => {
      const logSpy = jest.spyOn(global.console, 'log');
      await console.start();

      const sigintHandler = mockRL.on.mock.calls.find((call: any) => call[0] === 'SIGINT')[1];
      
      expect(() => sigintHandler()).toThrow('process.exit called');
      expect(logSpy).toHaveBeenCalledWith('\n👋 Goodbye!');
    });
  });

  describe('stop', () => {
    it('should close readline interface', () => {
      console.stop();

      expect(mockRL.close).toHaveBeenCalled();
    });
  });

  describe('displayHelp', () => {
    it('should display help information', async () => {
      const logSpy = jest.spyOn(global.console, 'log');
      await console.start();

      const lineHandler = mockRL.on.mock.calls.find((call: any) => call[0] === 'line')[1];
      await lineHandler('help');

      expect(logSpy).toHaveBeenCalledWith('\n📚 Simple Console Commands:\n');
      expect(logSpy).toHaveBeenCalledWith('  help, /help          Show this help message');
      expect(logSpy).toHaveBeenCalledWith('  exit, quit, /exit    Exit the console');
      expect(logSpy).toHaveBeenCalledWith('  Ctrl+C               Exit console\n');
      expect(logSpy).toHaveBeenCalledWith('🚧 This is a basic test version. More features coming soon!\n');
    });
  });
});