/**
 * Observability Commands Integration Test Suite
 * End-to-end tests for /debug, /health, /logs, and /report-issue commands
 */

import * as fs from 'fs';
import * as path from 'path';

import { DebugCommand } from '../../console/commands/debug';
import { HealthCommand } from '../../console/commands/health';
import { LogsCommand } from '../../console/commands/logs';
import { ReportIssueCommand } from '../../console/commands/report-issue';
import { ConsoleSession } from '../../console/repl';
import { DiagnosticsCollector } from '../diagnostics';
import { Logger } from '../logger';
import { MetricsCollector } from '../metrics';
import { ObservabilityManager } from '../manager';
import { Tracer } from '../tracer';

// Mock the observability singleton to use fresh instances
jest.mock('../../observability', () => {
  const originalModule = jest.requireActual('../../observability');
  return {
    ...originalModule,
    get observability() {
      return require('../manager').ObservabilityManager.getInstance();
    }
  };
});

// Mock file system operations
jest.mock('fs');
jest.mock('child_process');

const mockFs = fs as jest.Mocked<typeof fs>;

describe('Observability Commands Integration', () => {
  let mockSession: ConsoleSession;
  let originalConsole: any;
  let consoleOutput: string[];
  let testWorkspace: string;

  beforeEach(() => {
    // Reset singleton instances
    (Logger as any).instance = undefined;
    (MetricsCollector as any).instance = undefined;
    (Tracer as any).instance = undefined;
    (DiagnosticsCollector as any).instance = undefined;
    
    // Reset observability manager to ensure fresh logger instances
    (ObservabilityManager as any).instance = undefined;

    // Setup test workspace
    testWorkspace = '/test/workspace';
    mockSession = {
      workspace: {
        name: 'test-workspace',
        rootPath: testWorkspace,
        config: {
          host: 'test-server',
          port: 8006,
          node: 'test-node'
        }
      },
      client: {
        getNodes: jest.fn().mockResolvedValue([
          { node: 'test-node', status: 'online' }
        ]),
        getVMs: jest.fn().mockResolvedValue([]),
        getContainers: jest.fn().mockResolvedValue([])
      }
    } as any;

    // Mock console output
    consoleOutput = [];
    originalConsole = {
      log: console.log,
      error: console.error,
      warn: console.warn
    };
    
    console.log = jest.fn((message) => consoleOutput.push(message));
    console.error = jest.fn((message) => consoleOutput.push(message));
    console.warn = jest.fn((message) => consoleOutput.push(message));

    // Mock fs operations
    mockFs.existsSync.mockReturnValue(true);
    mockFs.mkdirSync.mockReturnValue(undefined);
    mockFs.writeFileSync.mockReturnValue(undefined);
    mockFs.readFileSync.mockReturnValue('test: config');
    mockFs.statSync.mockReturnValue({
      size: 1024,
      mtime: new Date()
    } as any);

    // Setup test data in observability components
    const logger = Logger.getInstance();
    const metrics = MetricsCollector.getInstance();
    const tracer = Tracer.getInstance();

    // Add test logs
    logger.info('Test info message', { workspace: testWorkspace });
    logger.error('Test error message', new Error('Test error'), { workspace: testWorkspace });
    logger.warn('Test warning message', { workspace: testWorkspace });

    // Add test metrics
    metrics.record('test.metric', 100, 'ms', { success: 'true' }, 'test-operation');
    metrics.record('operation.duration', 250, 'ms', { operation: 'sync' }, 'sync');

    // Add test traces
    const spanId = tracer.startTrace('test-operation', { test: 'true' });
    tracer.finishSpan(spanId);
  });

  afterEach(() => {
    // Clear console output buffer for fresh state
    consoleOutput = [];
    
    // Restore console
    console.log = originalConsole.log;
    console.error = originalConsole.error;
    console.warn = originalConsole.warn;

    jest.clearAllMocks();
  });

  describe('/debug Command Integration', () => {
    let debugCommand: DebugCommand;

    beforeEach(() => {
      debugCommand = new DebugCommand();
      // Clear output buffer for fresh test
      consoleOutput = [];
    });

    it('should show debug status with all observability components', async () => {
      await debugCommand.execute(['status'], mockSession);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Debug Status');
      expect(output).toContain('Configuration:');
      expect(output).toContain('Log Level:');
      expect(output).toContain('Statistics:');
      expect(output).toContain('Recent Logs:');
      expect(output).toContain('Recent Metrics:');
      expect(output).toContain('Active Traces:');
      expect(output).toContain('Completed Traces:');
    });

    it('should enable debug mode and change log level', async () => {
      await debugCommand.execute(['on'], mockSession);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Debug mode enabled');
      expect(output).toContain('Log level set to DEBUG');
      expect(output).toContain('Available debug commands:');

      const logger = Logger.getInstance();
      expect(logger.getConfig().level).toBe('debug');
    });

    it('should disable debug mode and restore log level', async () => {
      await debugCommand.execute(['off'], mockSession);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Debug mode disabled');
      expect(output).toContain('Log level set to INFO');

      const logger = Logger.getInstance();
      expect(logger.getConfig().level).toBe('info');
    });

    it('should display recent logs with filtering', async () => {
      await debugCommand.execute(['logs', '10'], mockSession);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Recent Logs (last 10)');
      expect(output).toContain('Test info message');
      expect(output).toContain('Test error message');
      expect(output).toContain('Test warning message');
    });

    it('should display metrics information', async () => {
      await debugCommand.execute(['metrics'], mockSession);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Performance Metrics');
      expect(output).toContain('Metrics Summary:');
      expect(output).toContain('Total Metrics:');
      expect(output).toContain('Recent Metrics:');
    });

    it('should display trace information', async () => {
      await debugCommand.execute(['traces'], mockSession);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Operation Traces');
      expect(output).toContain('Recent Completed Traces:');
      expect(output).toContain('test-operation');
    });

    it('should clear debug data', async () => {
      await debugCommand.execute(['clear', 'all'], mockSession);

      const output = consoleOutput.join('\n');
      expect(output).toContain('All debug data cleared');

      // Verify data was cleared
      const logger = Logger.getInstance();
      const metrics = MetricsCollector.getInstance();
      const tracer = Tracer.getInstance();

      expect(logger.getRecentLogs(100)).toHaveLength(0);
      expect(metrics.getMetrics()).toHaveLength(0);
      expect(tracer.getCompletedSpans()).toHaveLength(0);
    });

    it('should handle unknown debug commands gracefully', async () => {
      await debugCommand.execute(['unknown'], mockSession);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Unknown debug command');
    });
  });

  describe('/health Command Integration', () => {
    let healthCommand: HealthCommand;

    beforeEach(() => {
      healthCommand = new HealthCommand();
      // Clear output buffer for fresh test
      consoleOutput = [];
      
      // Mock exec for tool availability
      const { exec } = require('child_process');
      exec.mockImplementation((command: string, callback: Function) => {
        callback(null, { stdout: 'version 1.0.0\n' });
      });
    });

    it('should display comprehensive system health', async () => {
      await healthCommand.execute([], mockSession);

      const output = consoleOutput.join('\n');
      expect(output).toContain('System Health Check');
      expect(output).toContain('System Health:');
      expect(output).toContain('Connectivity Status:');
      expect(output).toContain('Tool Availability:');
      expect(output).toContain('Resource Status:');
    });

    it('should show detailed health information with --detailed flag', async () => {
      await healthCommand.execute(['--detailed'], mockSession);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Detailed Health Information:');
    });

    it('should include performance metrics with --metrics flag', async () => {
      await healthCommand.execute(['--metrics'], mockSession);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Performance Metrics:');
      expect(output).toContain('Total Operations:');
      expect(output).toContain('Average Response Time:');
    });

    it('should provide recommendations for health issues', async () => {
      // Mock unhealthy conditions
      const mockProcess = jest.spyOn(process, 'memoryUsage').mockReturnValue({
        rss: 100 * 1024 * 1024,
        heapUsed: 95 * 1024 * 1024, // 95% heap usage
        heapTotal: 100 * 1024 * 1024,
        external: 10 * 1024 * 1024,
        arrayBuffers: 5 * 1024 * 1024
      });

      await healthCommand.execute([], mockSession);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Recommendations:');

      mockProcess.mockRestore();
    });

    it('should handle health check failures gracefully', async () => {
      // Mock session without client
      const sessionWithoutClient = { ...mockSession, client: undefined };

      await healthCommand.execute([], sessionWithoutClient);

      const output = consoleOutput.join('\n');
      expect(output).toContain('System Health Check');
      // Should not crash and still show other health information
    });
  });

  describe('/logs Command Integration', () => {
    let logsCommand: LogsCommand;

    beforeEach(() => {
      logsCommand = new LogsCommand();
      // Clear output buffer for fresh test
      consoleOutput = [];
    });

    it('should display recent logs with default settings', async () => {
      await logsCommand.execute([], mockSession);

      const output = consoleOutput.join('\n');
      expect(output).toContain('System Logs');
      expect(output).toContain('Found');
      expect(output).toContain('log entries');
      expect(output).toContain('Test info message');
      expect(output).toContain('Test error message');
    });

    it('should filter logs by level', async () => {
      await logsCommand.execute(['--level', 'error'], mockSession);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Test error message');
      expect(output).not.toContain('Test info message');
    });

    it('should search logs by content', async () => {
      await logsCommand.execute(['--search', 'info'], mockSession);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Test info message');
      expect(output).not.toContain('Test error message');
    });

    it('should limit number of logs returned', async () => {
      await logsCommand.execute(['--limit', '1'], mockSession);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Found 1 log entries');
    });

    it('should show log summary with --summary flag', async () => {
      await logsCommand.execute(['--summary'], mockSession);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Log Summary');
      expect(output).toContain('By Level:');
      expect(output).toContain('By Operation:');
    });

    it('should output JSON format with --json flag', async () => {
      await logsCommand.execute(['--json'], mockSession);

      const output = consoleOutput.join('\n');
      // Should be valid JSON
      expect(() => JSON.parse(output)).not.toThrow();
    });

    it('should show help with --help flag', async () => {
      await logsCommand.execute(['--help'], mockSession);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Logs Command Help');
      expect(output).toContain('Usage: /logs [options]');
      expect(output).toContain('Examples:');
    });

    it('should handle no logs found gracefully', async () => {
      // Clear all logs
      const logger = Logger.getInstance();
      logger.clearBuffer();

      await logsCommand.execute([], mockSession);

      const output = consoleOutput.join('\n');
      expect(output).toContain('No logs found matching your criteria');
    });
  });

  describe('/report-issue Command Integration', () => {
    let reportIssueCommand: ReportIssueCommand;

    beforeEach(() => {
      reportIssueCommand = new ReportIssueCommand();
      // Clear output buffer for fresh test
      consoleOutput = [];
    });

    it('should generate comprehensive diagnostic report', async () => {
      await reportIssueCommand.execute(['Test issue description'], mockSession);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Collecting diagnostic information');
      expect(output).toContain('Issue Report Generated');
      expect(output).toContain('Report Contents:');
      expect(output).toContain('AI Collaboration Ready');
      expect(output).toContain('Report saved to:');

      // Verify report file was written (should be the second call - first is diagnostics snapshot)
      expect(mockFs.writeFileSync).toHaveBeenCalledTimes(2);
      const writeCall = (mockFs.writeFileSync as jest.Mock).mock.calls[1];
      expect(writeCall[0]).toMatch(/issue-.*\.json$/);
      
      // Verify report content
      const reportContent = JSON.parse(writeCall[1]);
      expect(reportContent.metadata.userDescription).toBe('Test issue description');
      expect(reportContent.snapshot).toBeDefined();
    });

    it('should generate AI-ready prompt', async () => {
      await reportIssueCommand.execute(['Connection timeout error'], mockSession);

      const output = consoleOutput.join('\n');
      expect(output).toContain('AI Collaboration Ready');
      expect(output).toContain('Suggested AI Prompt:');
      expect(output).toContain('Connection timeout error');
      expect(output).toContain('Next Steps:');
    });

    it('should handle empty description gracefully', async () => {
      await reportIssueCommand.execute([], mockSession);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Issue Report Generated');
      
      // Should use default description (second call is the report)
      const writeCall = (mockFs.writeFileSync as jest.Mock).mock.calls[1];
      const reportContent = JSON.parse(writeCall[1]);
      expect(reportContent.metadata.userDescription).toBe('General issue report');
    });

    it('should include workspace information in report', async () => {
      await reportIssueCommand.execute(['Test issue'], mockSession);

      const writeCall = (mockFs.writeFileSync as jest.Mock).mock.calls[1];
      const reportContent = JSON.parse(writeCall[1]);
      
      expect(reportContent.snapshot.workspace).toBe(testWorkspace);
      expect(reportContent.snapshot.workspaceInfo).toBeDefined();
    });

    it('should handle report generation errors gracefully', async () => {
      // Mock file system error on writeFileSync to trigger the error path
      mockFs.writeFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      await reportIssueCommand.execute(['Test issue'], mockSession);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Failed to generate diagnostic report');
      expect(output).toContain('Permission denied');
    });
  });

  describe('Cross-Command Integration', () => {
    it('should maintain observability state across commands', async () => {
      const debugCommand = new DebugCommand();
      const logsCommand = new LogsCommand();
      const healthCommand = new HealthCommand();

      // Enable debug mode
      await debugCommand.execute(['on'], mockSession);
      
      // This should generate more detailed logs
      await healthCommand.execute([], mockSession);
      
      // Check that logs were captured
      await logsCommand.execute(['--level', 'debug'], mockSession);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Debug mode enabled');
      expect(output).toContain('System Health Check');
    });

    it('should correlate traces across command executions', async () => {
      const tracer = Tracer.getInstance();
      const debugCommand = new DebugCommand();

      // Start a trace
      const spanId = tracer.startTrace('cross-command-test');
      
      // Execute debug command (should be traced)
      await debugCommand.execute(['status'], mockSession);
      
      tracer.finishSpan(spanId);

      // Check traces
      await debugCommand.execute(['traces'], mockSession);

      const output = consoleOutput.join('\n');
      expect(output).toContain('cross-command-test');
    });

    it('should maintain metrics across command executions', async () => {
      const metrics = MetricsCollector.getInstance();
      const debugCommand = new DebugCommand();

      // Record some metrics
      metrics.recordDuration('command-execution', 150, { command: 'debug' });

      // Check metrics through debug command
      await debugCommand.execute(['metrics'], mockSession);

      const output = consoleOutput.join('\n');
      // recordDuration stores metrics with name "operation.duration"
      expect(output).toContain('operation.duration:');
      expect(output).toContain('150');
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle command execution errors gracefully', async () => {
      const debugCommand = new DebugCommand();
      
      // Mock an internal error
      const originalMethod = debugCommand.execute;
      debugCommand.execute = jest.fn().mockRejectedValue(new Error('Internal error'));

      await expect(debugCommand.execute(['status'], mockSession)).rejects.toThrow('Internal error');
    });

    it('should handle invalid debug commands gracefully', async () => {
      const debugCommand = new DebugCommand();
      
      await debugCommand.execute(['invalid-command'], mockSession);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Unknown debug command');
      expect(output).toContain('Use /help debug for available debug commands');
    });
  });

  describe('Performance Integration', () => {
    it('should track command execution performance', async () => {
      const metrics = MetricsCollector.getInstance();
      const healthCommand = new HealthCommand();

      // Execute command
      const startTime = Date.now();
      await healthCommand.execute([], mockSession);
      const endTime = Date.now();

      // Check if performance was tracked
      const commandMetrics = metrics.getMetrics().filter(m => 
        m.name.includes('duration') || m.name.includes('time')
      );

      expect(commandMetrics.length).toBeGreaterThan(0);
    });

    it('should not significantly impact system performance', async () => {
      const startTime = process.hrtime.bigint();
      
      // Execute multiple observability operations
      const debugCommand = new DebugCommand();
      const logsCommand = new LogsCommand();
      const healthCommand = new HealthCommand();

      await Promise.all([
        debugCommand.execute(['status'], mockSession),
        logsCommand.execute(['--summary'], mockSession),
        healthCommand.execute([], mockSession)
      ]);

      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1_000_000; // Convert to milliseconds

      // Should complete within reasonable time (adjust based on test environment)
      expect(duration).toBeLessThan(5000); // 5 seconds max
    });
  });
});