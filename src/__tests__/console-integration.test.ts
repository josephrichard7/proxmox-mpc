/**
 * Integration Tests for Console Entry Point
 * Testing the main console executable and basic integration
 */

import { SimpleInteractiveConsole } from '../console/simple-repl';
import * as readline from 'readline';

// Mock readline to prevent actual terminal interaction during tests
jest.mock('readline');
const mockReadline = readline as jest.Mocked<typeof readline>;

describe('Console Integration', () => {
  describe('SimpleInteractiveConsole Integration', () => {
    let console: SimpleInteractiveConsole;
    let mockRL: any;

    beforeEach(() => {
      // Mock readline interface
      mockRL = {
        on: jest.fn(),
        prompt: jest.fn(),
        close: jest.fn(),
      };
      mockReadline.createInterface.mockReturnValue(mockRL);
      
      console = new SimpleInteractiveConsole();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should instantiate console without errors', () => {
      expect(console).toBeInstanceOf(SimpleInteractiveConsole);
    });

    it('should have start method', () => {
      expect(typeof console.start).toBe('function');
    });

    it('should have stop method', () => {
      expect(typeof console.stop).toBe('function');
    });
  });

  describe('Console Entry Point Module', () => {
    it('should export SimpleInteractiveConsole', () => {
      const consoleModule = require('../console/simple-repl');
      expect(consoleModule.SimpleInteractiveConsole).toBeDefined();
    });

    it.skip('should be importable from main console module', () => {
      // TODO: Enable when full InteractiveConsole is implemented
      const consoleModule = require('../console');
      expect(consoleModule.InteractiveConsole).toBeDefined();
    });
  });

  describe('Package Configuration', () => {
    it('should have console script in package.json', () => {
      const packageJson = require('../../package.json');
      expect(packageJson.scripts.console).toBe('tsx src/console.ts');
    });

    it('should have proxmox-mpc bin entry', () => {
      const packageJson = require('../../package.json');
      expect(packageJson.bin['proxmox-mpc']).toBe('bin/proxmox-mpc');
    });

    it('should have required dependencies', () => {
      const packageJson = require('../../package.json');
      expect(packageJson.dependencies['js-yaml']).toBeDefined();
      expect(packageJson.dependencies['@types/js-yaml']).toBeDefined();
    });
  });
});