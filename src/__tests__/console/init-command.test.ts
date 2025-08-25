/**
 * Tests for Interactive Init Command
 * Verifies interactive input handling without readline conflicts
 */

import * as readline from 'readline';

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

import { InitCommand } from '../../console/commands/init';
import { ConsoleSession } from '../../console/repl';
import { ProjectWorkspace } from '../../workspace';

// Mock dependencies
jest.mock('../../workspace');
jest.mock('readline');

describe('InitCommand', () => {
  let initCommand: InitCommand;
  let mockSession: ConsoleSession;
  let mockRl: jest.Mocked<readline.Interface>;

  beforeEach(() => {
    initCommand = new InitCommand();
    
    // Create mock readline interface
    mockRl = {
      question: jest.fn(),
      close: jest.fn(),
      pause: jest.fn(),
      resume: jest.fn(),
    } as any;

    // Create mock session
    mockSession = {
      workspace: undefined,
      client: undefined,
      history: [],
      startTime: new Date(),
      rl: mockRl,
    };

    // Mock console methods
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('execute', () => {
    it('should detect existing workspace and abort', async () => {
      // Mock existing workspace
      const mockWorkspace = { name: 'existing-project', configPath: '/path/to/config' };
      jest.mocked(ProjectWorkspace.detect).mockResolvedValue(mockWorkspace as any);

      await initCommand.execute([], mockSession);

      expect(console.log).toHaveBeenCalledWith('❌ Already in a Proxmox workspace!');
      expect(console.log).toHaveBeenCalledWith(`   Project: ${mockWorkspace.name}`);
    });

    it('should create new workspace when none exists', async () => {
      // Mock no existing workspace
      jest.mocked(ProjectWorkspace.detect).mockRejectedValue(new Error('No workspace'));
      
      // Mock workspace creation
      const mockWorkspace = {
        name: 'test-project',
        configPath: '/path/to/config',
        databasePath: '/path/to/db',
      };
      jest.mocked(ProjectWorkspace.create).mockResolvedValue(mockWorkspace as any);

      // Mock readline interactions
      mockRl.question
        .mockImplementationOnce((question, callback) => {
          (callback as (answer: string) => void)('192.168.1.100');
        })  // host
        .mockImplementationOnce((question, callback) => {
          (callback as (answer: string) => void)('8006');
        })  // port
        .mockImplementationOnce((question, callback) => {
          (callback as (answer: string) => void)('root@pam');
        })  // username
        .mockImplementationOnce((question, callback) => {
          (callback as (answer: string) => void)('test-token');
        })  // token id

      // Mock password prompt separately (since it's handled differently)
      const _mockPasswordPrompt = jest.spyOn(initCommand as any, 'promptPassword')
        .mockResolvedValue('test-secret');

      mockRl.question
        .mockImplementationOnce((question, callback) => {
          (callback as (answer: string) => void)('');
        })  // node (default)
        .mockImplementationOnce((question, callback) => {
          (callback as (answer: string) => void)('n');
        });  // skip TLS

      await initCommand.execute([], mockSession);

      expect(ProjectWorkspace.create).toHaveBeenCalledWith(
        process.cwd(),
        expect.objectContaining({
          host: '192.168.1.100',
          port: 8006,
          username: 'root@pam',
          tokenId: 'test-token',
          tokenSecret: 'test-secret',
          node: 'pve',
          rejectUnauthorized: true,
        })
      );
      
      expect(mockSession.workspace).toBe(mockWorkspace);
      expect(console.log).toHaveBeenCalledWith('✅ Project workspace initialized successfully!');
    });

    it('should handle interactive input errors gracefully', async () => {
      // Mock no existing workspace
      jest.mocked(ProjectWorkspace.detect).mockRejectedValue(new Error('No workspace'));
      
      // Mock readline error
      mockRl.question.mockImplementation(() => {
        throw new Error('Readline error');
      });

      // Mock fallback workspace creation
      const mockWorkspace = { name: 'fallback-project' };
      jest.mocked(ProjectWorkspace.create).mockResolvedValue(mockWorkspace as any);

      await initCommand.execute([], mockSession);

      expect(console.error).toHaveBeenCalledWith('\n❌ Failed to collect configuration interactively');
      expect(ProjectWorkspace.create).toHaveBeenCalledWith(
        process.cwd(),
        expect.objectContaining({
          host: 'your-proxmox-server.local',
          tokenId: 'proxmox-mpc',
        })
      );
    });
  });

  describe('password input handling', () => {
    let mockStdin: any;
    let _originalIsRaw: boolean;

    beforeEach(() => {
      mockStdin = {
        isRaw: false,
        setRawMode: jest.fn(),
        on: jest.fn(),
        removeListener: jest.fn(),
      };
      
      originalIsRaw = process.stdin.isRaw;
      Object.defineProperty(process, 'stdin', { value: mockStdin, writable: true });
    });

    afterEach(() => {
      Object.defineProperty(process, 'stdin', { value: process.stdin, writable: true });
    });

    it('should handle password input with raw mode', async () => {
      // Mock no existing workspace
      jest.mocked(ProjectWorkspace.detect).mockRejectedValue(new Error('No workspace'));
      
      // Create a proper test for password handling
      const passwordPromise = (initCommand as any).promptPassword(mockRl, 'Password: ');
      
      // Simulate stdin data events
      const onDataCallback = mockStdin.on.mock.calls.find(call => call[0] === 'data')?.[1];
      expect(onDataCallback).toBeDefined();

      // Simulate typing password characters
      onDataCallback(Buffer.from('s'));
      onDataCallback(Buffer.from('e'));
      onDataCallback(Buffer.from('c'));
      onDataCallback(Buffer.from('r'));
      onDataCallback(Buffer.from('e'));
      onDataCallback(Buffer.from('t'));
      onDataCallback(Buffer.from('\r')); // Enter key

      const password = await passwordPromise;
      expect(password).toBe('secret');
      expect(mockStdin.setRawMode).toHaveBeenCalledWith(true);
      expect(mockStdin.setRawMode).toHaveBeenCalledWith(false);
    });

    it('should handle backspace in password input', async () => {
      const passwordPromise = (initCommand as any).promptPassword(mockRl, 'Password: ');
      
      const onDataCallback = mockStdin.on.mock.calls.find(call => call[0] === 'data')?.[1];
      
      // Type some characters, then backspace, then more characters
      onDataCallback(Buffer.from('s'));
      onDataCallback(Buffer.from('e'));
      onDataCallback(Buffer.from('c'));
      onDataCallback(Buffer.from('\x7f')); // Backspace
      onDataCallback(Buffer.from('c'));
      onDataCallback(Buffer.from('r'));
      onDataCallback(Buffer.from('e'));
      onDataCallback(Buffer.from('t'));
      onDataCallback(Buffer.from('\r'));

      const password = await passwordPromise;
      expect(password).toBe('secret');
    });
  });

  describe('input validation', () => {
    it('should apply default values for empty inputs', async () => {
      jest.mocked(ProjectWorkspace.detect).mockRejectedValue(new Error('No workspace'));
      jest.mocked(ProjectWorkspace.create).mockResolvedValue({} as any);

      // Mock empty inputs (user just presses enter)
      mockRl.question
        .mockImplementationOnce((question, callback) => callback('192.168.1.100'))  // host
        .mockImplementationOnce((question, callback) => callback(''))               // port (default)
        .mockImplementationOnce((question, callback) => callback(''))               // username (default)
        .mockImplementationOnce((question, callback) => callback('test-token'))     // token id
        .mockImplementationOnce((question, callback) => callback(''))              // node (default)
        .mockImplementationOnce((question, callback) => callback(''));             // skip TLS (default)

      await initCommand.execute([], mockSession);

      expect(ProjectWorkspace.create).toHaveBeenCalledWith(
        process.cwd(),
        expect.objectContaining({
          host: '192.168.1.100',
          port: 8006,              // default
          username: 'root@pam',    // default
          tokenId: 'test-token',
          node: 'pve',             // default
          rejectUnauthorized: true, // default (not skip TLS)
        })
      );
    });

    it('should trim whitespace from inputs', async () => {
      jest.mocked(ProjectWorkspace.detect).mockRejectedValue(new Error('No workspace'));
      jest.mocked(ProjectWorkspace.create).mockResolvedValue({} as any);

      mockRl.question
        .mockImplementationOnce((question, callback) => callback('  192.168.1.100  '))  // host with spaces
        .mockImplementationOnce((question, callback) => callback(' 8006 '))             // port with spaces
        .mockImplementationOnce((question, callback) => callback(' root@pam '))         // username with spaces
        .mockImplementationOnce((question, callback) => callback(' test-token '))       // token id with spaces
        .mockImplementationOnce((question, callback) => callback(' pve '))             // node with spaces
        .mockImplementationOnce((question, callback) => callback(' y '));              // skip TLS with spaces

      await initCommand.execute([], mockSession);

      expect(ProjectWorkspace.create).toHaveBeenCalledWith(
        process.cwd(),
        expect.objectContaining({
          host: '192.168.1.100',
          port: 8006,
          username: 'root@pam',
          tokenId: 'test-token',
          node: 'pve',
          rejectUnauthorized: false, // skip TLS = y
        })
      );
    });
  });
});