/**
 * Simplified Tests for Slash Command Infrastructure
 * Testing basic command structure without process.exit complications
 */

import { SlashCommandRegistry } from '../commands';
import { HelpCommand } from '../commands/help';
import { ConsoleSession } from '../repl';

describe('SlashCommandRegistry Basic Tests', () => {
  let registry: SlashCommandRegistry;
  let mockSession: ConsoleSession;

  beforeEach(() => {
    registry = new SlashCommandRegistry();
    mockSession = {
      history: [],
      startTime: new Date(),
      rl: {} as any,
    };
  });

  describe('constructor', () => {
    it('should register builtin commands', () => {
      expect(registry.has('help')).toBe(true);
      expect(registry.has('init')).toBe(true);
      expect(registry.has('status')).toBe(true);
      expect(registry.has('exit')).toBe(true);
      expect(registry.has('quit')).toBe(true);
    });
  });

  describe('register', () => {
    it('should register new commands', () => {
      const mockHandler = jest.fn();
      registry.register('test', mockHandler);

      expect(registry.has('test')).toBe(true);
    });
  });

  describe('getAvailableCommands', () => {
    it('should return sorted list of commands', () => {
      const commands = registry.getAvailableCommands();

      expect(commands).toContain('help');
      expect(commands).toContain('init');
      expect(commands).toEqual([...commands].sort());
    });
  });
});

describe('HelpCommand Basic Tests', () => {
  let helpCommand: HelpCommand;
  let mockSession: ConsoleSession;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    helpCommand = new HelpCommand();
    mockSession = {
      history: [],
      startTime: new Date(),
      rl: {} as any,
    };
    logSpy = jest.spyOn(global.console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('execute', () => {
    it('should show general help when no args', async () => {
      await helpCommand.execute([], mockSession);

      expect(logSpy).toHaveBeenCalledWith('\n📚 Proxmox-MPC Interactive Console Help\n');
      expect(logSpy).toHaveBeenCalledWith('🔧 Core Slash Commands:');
    });

    it('should show specific help for known commands', async () => {
      await helpCommand.execute(['init'], mockSession);

      expect(logSpy).toHaveBeenCalledWith('\n/init - Initialize Project Workspace\n');
    });
  });
});

// Basic structure tests for other commands
describe('Command Structure Tests', () => {
  it('should have InitCommand class', () => {
    const { InitCommand } = require('../commands/init');
    expect(InitCommand).toBeDefined();
    expect(new InitCommand()).toHaveProperty('execute');
  });

  it('should have StatusCommand class', () => {
    const { StatusCommand } = require('../commands/status');
    expect(StatusCommand).toBeDefined();
    expect(new StatusCommand()).toHaveProperty('execute');
  });

  it('should have ExitCommand class', () => {
    const { ExitCommand } = require('../commands/exit');
    expect(ExitCommand).toBeDefined();
    expect(new ExitCommand()).toHaveProperty('execute');
  });
});