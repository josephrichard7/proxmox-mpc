/**
 * Logger Component TDD Test Suite
 * Comprehensive tests for structured logging with correlation IDs
 */

import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../logger';
import { LogLevel, LoggerConfig } from '../types';

describe('Logger', () => {
  let testLogDir: string;
  let testLogFile: string;
  let originalConsole: any;
  let consoleOutput: string[];

  beforeEach(() => {
    // Create temporary test directory
    testLogDir = path.join(__dirname, 'test-logs');
    testLogFile = path.join(testLogDir, 'test.log');
    
    if (!fs.existsSync(testLogDir)) {
      fs.mkdirSync(testLogDir, { recursive: true });
    }

    // Mock console to capture output
    consoleOutput = [];
    originalConsole = {
      log: console.log,
      error: console.error,
      warn: console.warn
    };
    
    console.log = jest.fn((message) => consoleOutput.push(message));
    console.error = jest.fn((message) => consoleOutput.push(message));
    console.warn = jest.fn((message) => consoleOutput.push(message));

    // Reset singleton instance
    (Logger as any).instance = undefined;
  });

  afterEach(() => {
    // Restore console
    console.log = originalConsole.log;
    console.error = originalConsole.error;
    console.warn = originalConsole.warn;

    // Clean up test files
    if (fs.existsSync(testLogFile)) {
      fs.unlinkSync(testLogFile);
    }
    if (fs.existsSync(testLogDir)) {
      fs.rmdirSync(testLogDir);
    }
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance when called multiple times', () => {
      const logger1 = Logger.getInstance();
      const logger2 = Logger.getInstance();
      
      expect(logger1).toBe(logger2);
    });

    it('should use provided config on first initialization', () => {
      const config: LoggerConfig = {
        level: 'debug',
        enableConsole: false,
        enableFile: true,
        filePath: testLogFile,
        enableStructured: true,
        enableTracing: true
      };

      const logger = Logger.getInstance(config);
      const actualConfig = logger.getConfig();

      expect(actualConfig.level).toBe('debug');
      expect(actualConfig.enableConsole).toBe(false);
      expect(actualConfig.enableFile).toBe(true);
      expect(actualConfig.filePath).toBe(testLogFile);
    });
  });

  describe('Log Level Filtering', () => {
    it('should respect log level hierarchy', () => {
      const logger = Logger.getInstance({
        level: 'warn',
        enableConsole: true,
        enableFile: false,
        enableStructured: false,
        enableTracing: false
      });

      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');

      // Only warn and error should appear
      expect(consoleOutput).toHaveLength(2);
      expect(consoleOutput.some(line => line.includes('warn message'))).toBe(true);
      expect(consoleOutput.some(line => line.includes('error message'))).toBe(true);
      expect(consoleOutput.some(line => line.includes('debug message'))).toBe(false);
      expect(consoleOutput.some(line => line.includes('info message'))).toBe(false);
    });

    it('should log all levels when set to debug', () => {
      const logger = Logger.getInstance({
        level: 'debug',
        enableConsole: true,
        enableFile: false,
        enableStructured: false,
        enableTracing: false
      });

      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');

      expect(consoleOutput).toHaveLength(4);
    });
  });

  describe('Structured Logging', () => {
    it('should output JSON format when structured logging is enabled', () => {
      const logger = Logger.getInstance({
        level: 'info',
        enableConsole: true,
        enableFile: false,
        enableStructured: true,
        enableTracing: false
      });

      logger.info('test message', { workspace: '/test' });

      expect(consoleOutput).toHaveLength(1);
      const logEntry = JSON.parse(consoleOutput[0]);
      
      expect(logEntry).toHaveProperty('timestamp');
      expect(logEntry).toHaveProperty('correlationId');
      expect(logEntry).toHaveProperty('operation');
      expect(logEntry).toHaveProperty('phase');
      expect(logEntry).toHaveProperty('level', 'info');
      expect(logEntry).toHaveProperty('message', 'test message');
      expect(logEntry.context).toHaveProperty('workspace', '/test');
    });

    it('should output human-readable format when structured logging is disabled', () => {
      const logger = Logger.getInstance({
        level: 'info',
        enableConsole: true,
        enableFile: false,
        enableStructured: false,
        enableTracing: false
      });

      logger.info('test message');

      expect(consoleOutput).toHaveLength(1);
      expect(consoleOutput[0]).toMatch(/\[\d{1,2}:\d{2}:\d{2}.*\] INFO\s+test message/);
    });
  });

  describe('File Logging', () => {
    it('should write logs to file when file logging is enabled', () => {
      const logger = Logger.getInstance({
        level: 'info',
        enableConsole: false,
        enableFile: true,
        filePath: testLogFile,
        enableStructured: true,
        enableTracing: false
      });

      logger.info('file log test', { test: true });

      expect(fs.existsSync(testLogFile)).toBe(true);
      const logContent = fs.readFileSync(testLogFile, 'utf8');
      const logEntry = JSON.parse(logContent.trim());
      
      expect(logEntry).toHaveProperty('message', 'file log test');
      expect(logEntry.context).toHaveProperty('test', true);
    });

    it('should create log directory if it does not exist', () => {
      const deepLogFile = path.join(testLogDir, 'nested', 'deep', 'test.log');
      
      const logger = Logger.getInstance({
        level: 'info',
        enableConsole: false,
        enableFile: true,
        filePath: deepLogFile,
        enableStructured: true,
        enableTracing: false
      });

      logger.info('deep directory test');

      expect(fs.existsSync(deepLogFile)).toBe(true);
      
      // Clean up
      fs.unlinkSync(deepLogFile);
      fs.rmdirSync(path.dirname(deepLogFile));
      fs.rmdirSync(path.dirname(path.dirname(deepLogFile)));
    });
  });

  describe('Trace Context', () => {
    it('should use trace context when set', () => {
      const logger = Logger.getInstance({
        level: 'info',
        enableConsole: true,
        enableFile: false,
        enableStructured: true,
        enableTracing: true
      });

      const traceId = 'test-trace-123';
      const spanId = 'test-span-456';

      logger.setTraceContext(traceId, spanId);
      logger.info('traced message');

      const logEntry = JSON.parse(consoleOutput[0]);
      expect(logEntry.correlationId).toBe(traceId);
    });

    it('should generate unique correlation ID when no trace context is set', () => {
      const logger = Logger.getInstance({
        level: 'info',
        enableConsole: true,
        enableFile: false,
        enableStructured: true,
        enableTracing: false
      });

      logger.info('message 1');
      logger.info('message 2');

      expect(consoleOutput).toHaveLength(2);
      const log1 = JSON.parse(consoleOutput[0]);
      const log2 = JSON.parse(consoleOutput[1]);
      
      expect(log1.correlationId).toBeDefined();
      expect(log2.correlationId).toBeDefined();
      expect(log1.correlationId).not.toBe(log2.correlationId);
    });
  });

  describe('Error Logging', () => {
    it('should log error with stack trace and recovery actions', () => {
      const logger = Logger.getInstance({
        level: 'error',
        enableConsole: true,
        enableFile: false,
        enableStructured: true,
        enableTracing: false
      });

      const testError = new Error('Test error message');
      const recoveryActions = ['Check network connection', 'Retry operation'];

      logger.error('Operation failed', testError, { operation: 'test' }, recoveryActions);

      expect(consoleOutput).toHaveLength(1);
      const logEntry = JSON.parse(consoleOutput[0]);
      
      expect(logEntry.level).toBe('error');
      expect(logEntry.message).toBe('Operation failed');
      expect(logEntry.error).toHaveProperty('type', 'Error');
      expect(logEntry.error).toHaveProperty('message', 'Test error message');
      expect(logEntry.error).toHaveProperty('stack');
      expect(logEntry.error.recoveryActions).toEqual(recoveryActions);
    });

    it('should categorize errors correctly', () => {
      const logger = Logger.getInstance({
        level: 'error',
        enableConsole: true,
        enableFile: false,
        enableStructured: true,
        enableTracing: false
      });

      // Test connection error
      const connectionError = new Error('Connection timeout');
      logger.error('Connection failed', connectionError);
      
      // Test terraform error
      const terraformError = new Error('terraform plan failed');
      logger.error('Terraform error', terraformError);

      expect(consoleOutput).toHaveLength(2);
      const log1 = JSON.parse(consoleOutput[0]);
      const log2 = JSON.parse(consoleOutput[1]);
      
      expect(log1.error.category).toBe('connection');
      expect(log2.error.category).toBe('terraform');
    });
  });

  describe('Operation Logging', () => {
    it('should log operation start with proper structure', () => {
      const logger = Logger.getInstance({
        level: 'info',
        enableConsole: true,
        enableFile: false,
        enableStructured: true,
        enableTracing: false
      });

      logger.operationStart('sync', 'discovery', {
        workspace: '/test',
        proxmoxServer: 'test-server'
      });

      expect(consoleOutput).toHaveLength(1);
      const logEntry = JSON.parse(consoleOutput[0]);
      
      expect(logEntry.message).toBe('Starting sync - discovery');
      expect(logEntry.context.workspace).toBe('/test');
      expect(logEntry.context.proxmoxServer).toBe('test-server');
      expect(logEntry.metadata.operationType).toBe('start');
    });

    it('should log operation success with duration', () => {
      const logger = Logger.getInstance({
        level: 'info',
        enableConsole: true,
        enableFile: false,
        enableStructured: true,
        enableTracing: false
      });

      logger.operationSuccess('apply', 'terraform', 5000, {
        resourcesAffected: ['vm-1', 'vm-2']
      });

      expect(consoleOutput).toHaveLength(1);
      const logEntry = JSON.parse(consoleOutput[0]);
      
      expect(logEntry.message).toBe('Completed apply - terraform');
      expect(logEntry.context.duration).toBe(5000);
      expect(logEntry.context.resourcesAffected).toEqual(['vm-1', 'vm-2']);
      expect(logEntry.metadata.operationType).toBe('success');
    });

    it('should log operation failure with error and recovery actions', () => {
      const logger = Logger.getInstance({
        level: 'error',
        enableConsole: true,
        enableFile: false,
        enableStructured: true,
        enableTracing: false
      });

      const error = new Error('Connection refused');
      const recoveryActions = ['Check server status', 'Verify credentials'];

      logger.operationFailure('sync', 'connect', error, 1500, {
        proxmoxServer: 'test-server'
      }, recoveryActions);

      expect(consoleOutput).toHaveLength(1);
      const logEntry = JSON.parse(consoleOutput[0]);
      
      expect(logEntry.level).toBe('error');
      expect(logEntry.message).toBe('Failed sync - connect');
      expect(logEntry.context.duration).toBe(1500);
      expect(logEntry.error.recoveryActions).toEqual(recoveryActions);
    });
  });

  describe('Log Querying', () => {
    it('should return recent logs with limit', () => {
      const logger = Logger.getInstance({
        level: 'info',
        enableConsole: false,
        enableFile: false,
        enableStructured: true,
        enableTracing: false
      });

      // Generate multiple log entries
      for (let i = 0; i < 10; i++) {
        logger.info(`message ${i}`);
      }

      const recentLogs = logger.getRecentLogs(5);
      expect(recentLogs).toHaveLength(5);
      
      // Should be in reverse chronological order (most recent first)
      expect(recentLogs[0].message).toBe('message 9');
      expect(recentLogs[4].message).toBe('message 5');
    });

    it('should filter logs by level', () => {
      const logger = Logger.getInstance({
        level: 'debug',
        enableConsole: false,
        enableFile: false,
        enableStructured: true,
        enableTracing: false
      });

      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');

      const errorLogs = logger.getRecentLogs(10, 'error');
      expect(errorLogs).toHaveLength(1);
      expect(errorLogs[0].message).toBe('error message');

      const warnLogs = logger.getRecentLogs(10, 'warn');
      expect(warnLogs).toHaveLength(1);
      expect(warnLogs[0].message).toBe('warn message');
    });

    it('should filter logs by operation', () => {
      const logger = Logger.getInstance({
        level: 'info',
        enableConsole: false,
        enableFile: false,
        enableStructured: true,
        enableTracing: false
      });

      logger.info('sync message', {}, { operation: 'sync' });
      logger.info('apply message', {}, { operation: 'apply' });
      logger.info('test message', {}, { operation: 'test' });

      const syncLogs = logger.getRecentLogs(10, undefined, 'sync');
      expect(syncLogs).toHaveLength(1);
      expect(syncLogs[0].message).toBe('sync message');
    });

    it('should return logs by correlation ID', () => {
      const logger = Logger.getInstance({
        level: 'info',
        enableConsole: false,
        enableFile: false,
        enableStructured: true,
        enableTracing: true
      });

      const correlationId = 'test-correlation-123';
      logger.setTraceContext(correlationId, 'span-1');
      
      logger.info('related message 1');
      logger.info('related message 2');
      
      logger.clearTraceContext();
      logger.info('unrelated message');

      const relatedLogs = logger.getLogsByCorrelationId(correlationId);
      expect(relatedLogs).toHaveLength(2);
      expect(relatedLogs.every(log => log.correlationId === correlationId)).toBe(true);
    });
  });

  describe('Buffer Management', () => {
    it('should trim log buffer when it exceeds maximum size', () => {
      const logger = Logger.getInstance({
        level: 'info',
        enableConsole: false,
        enableFile: false,
        enableStructured: true,
        enableTracing: false
      });

      // Generate more logs than the buffer limit (1000)
      for (let i = 0; i < 1200; i++) {
        logger.info(`message ${i}`);
      }

      const allLogs = logger.getRecentLogs(2000);
      expect(allLogs.length).toBeLessThanOrEqual(1000);
      
      // Should keep the most recent entries
      expect(allLogs[0].message).toBe('message 1199');
    });

    it('should clear buffer when requested', () => {
      const logger = Logger.getInstance({
        level: 'info',
        enableConsole: false,
        enableFile: false,
        enableStructured: true,
        enableTracing: false
      });

      logger.info('message 1');
      logger.info('message 2');
      
      expect(logger.getRecentLogs(10)).toHaveLength(2);
      
      logger.clearBuffer();
      
      expect(logger.getRecentLogs(10)).toHaveLength(0);
    });
  });

  describe('Configuration Management', () => {
    it('should update configuration dynamically', () => {
      const logger = Logger.getInstance({
        level: 'info',
        enableConsole: true,
        enableFile: false,
        enableStructured: false,
        enableTracing: false
      });

      logger.info('before config change');
      
      logger.updateConfig({
        level: 'error',
        enableStructured: true
      });

      logger.info('after config change - should not appear');
      logger.error('error after config change');

      // Only 2 entries: initial message and error after config change
      expect(consoleOutput).toHaveLength(2);
      
      // Second entry should be JSON structured
      const secondEntry = consoleOutput[1];
      expect(() => JSON.parse(secondEntry)).not.toThrow();
    });

    it('should return current configuration', () => {
      const initialConfig: LoggerConfig = {
        level: 'debug',
        enableConsole: true,
        enableFile: true,
        filePath: testLogFile,
        enableStructured: true,
        enableTracing: true
      };

      const logger = Logger.getInstance(initialConfig);
      const retrievedConfig = logger.getConfig();

      expect(retrievedConfig).toEqual(initialConfig);
    });
  });

  describe('Default Configuration', () => {
    it('should provide sensible default configuration', () => {
      const defaultConfig = Logger.getDefaultConfig();

      expect(defaultConfig.level).toBe('info');
      expect(defaultConfig.enableConsole).toBe(true);
      expect(defaultConfig.enableFile).toBe(true);
      expect(defaultConfig.enableStructured).toBe(true);
      expect(defaultConfig.enableTracing).toBe(true);
      expect(defaultConfig.filePath).toContain('.proxmox/logs/proxmox-mpc.log');
    });
  });
});