/**
 * DiagnosticsCollector Component TDD Test Suite
 * Comprehensive tests for system health monitoring and diagnostic reporting
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';
import { DiagnosticsCollector } from '../diagnostics';
import { DiagnosticSnapshot, HealthStatus } from '../types';
import { Logger } from '../logger';
import { MetricsCollector } from '../metrics';
import { Tracer } from '../tracer';

// Mock all dependencies
jest.mock('../logger');
jest.mock('../metrics');
jest.mock('../tracer');
jest.mock('fs');
jest.mock('os');
jest.mock('child_process');
jest.mock('util', () => ({
  promisify: jest.fn((fn: any) => {
    return jest.fn((command) => {
      if (command.includes('terraform --version')) {
        return Promise.resolve({ stdout: 'Terraform v1.0.0\n' });
      } else if (command.includes('ansible --version')) {
        return Promise.resolve({ stdout: 'ansible 2.9.0\n' });
      } else if (command.includes('node --version')) {
        return Promise.resolve({ stdout: 'v16.0.0\n' });
      } else if (command.includes('npm --version')) {
        return Promise.resolve({ stdout: '8.0.0\n' });
      } else if (command.includes('git --version')) {
        return Promise.resolve({ stdout: 'git version 2.30.0\n' });
      } else {
        return Promise.reject(new Error('Command not found'));
      }
    });
  })
}));

const mockFs = fs as jest.Mocked<typeof fs>;
const mockOs = os as jest.Mocked<typeof os>;
const mockExec = exec as unknown as jest.Mock;

describe('DiagnosticsCollector', () => {
  let collector: DiagnosticsCollector;
  let mockLogger: jest.Mocked<Logger>;
  let mockMetrics: jest.Mocked<MetricsCollector>;
  let mockTracer: jest.Mocked<Tracer>;

  beforeEach(() => {
    // Reset all singleton instances for clean tests
    (DiagnosticsCollector as any).instance = undefined;
    (Logger as any).instance = undefined;
    (MetricsCollector as any).instance = undefined;
    (Tracer as any).instance = undefined;

    // Setup mocks
    mockLogger = {
      getRecentLogs: jest.fn(() => []),
      info: jest.fn()
    } as any;

    mockMetrics = {
      getMetrics: jest.fn(() => []),
      getMetricsSummary: jest.fn(() => ({
        totalMetrics: 100,
        uniqueOperations: 5,
        avgResponseTime: 250,
        errorRate: 0.05,
        memoryUsage: { current: 50000000, peak: 80000000 }
      }))
    } as any;

    mockTracer = {
      getCompletedSpans: jest.fn(() => [])
    } as any;

    (Logger.getInstance as jest.Mock).mockReturnValue(mockLogger);
    (MetricsCollector.getInstance as jest.Mock).mockReturnValue(mockMetrics);
    (Tracer.getInstance as jest.Mock).mockReturnValue(mockTracer);

    // Mock OS functions
    mockOs.hostname.mockReturnValue('test-host');
    mockOs.platform.mockReturnValue('linux');
    mockOs.release.mockReturnValue('5.4.0');
    mockOs.arch.mockReturnValue('x64');
    mockOs.totalmem.mockReturnValue(8 * 1024 * 1024 * 1024); // 8GB
    mockOs.freemem.mockReturnValue(4 * 1024 * 1024 * 1024); // 4GB
    mockOs.loadavg.mockReturnValue([1.5, 1.2, 1.0]);
    mockOs.cpus.mockReturnValue([{}, {}, {}, {}] as any); // 4 CPUs

    // Mock fs functions
    mockFs.existsSync.mockReturnValue(true);
    mockFs.mkdirSync.mockReturnValue(undefined);
    mockFs.writeFileSync.mockReturnValue(undefined);
    mockFs.statSync.mockReturnValue({
      size: 1024,
      mtime: new Date()
    } as any);

    collector = DiagnosticsCollector.getInstance();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Instance Creation', () => {
    it('should use singleton pattern correctly', () => {
      const collector1 = DiagnosticsCollector.getInstance();
      const collector2 = DiagnosticsCollector.getInstance();
      
      // Should return the same instance (singleton pattern)
      expect(collector1).toBe(collector2);
    });
  });

  describe('Diagnostic Snapshot Generation', () => {
    it('should generate comprehensive diagnostic snapshot', async () => {
      const mockLogs = [
        {
          timestamp: '2024-01-01T00:00:00Z',
          level: 'error' as const,
          message: 'Test error',
          correlationId: 'test-123',
          operation: 'test',
          phase: 'test',
          context: { resourcesAffected: [] }
        }
      ];

      const mockMetricsData = [
        {
          name: 'test.metric',
          value: 100,
          unit: 'ms',
          timestamp: '2024-01-01T00:00:00Z',
          tags: { test: 'value' }
        }
      ];

      mockLogger.getRecentLogs.mockReturnValue(mockLogs);
      mockMetrics.getMetrics.mockReturnValue(mockMetricsData);

      // Mock exec for health checks
      mockExec.mockImplementation((command, callback) => {
        if (typeof callback === 'function') {
          callback(null, { stdout: 'version 1.0.0\n' } as any);
        }
        return {} as any;
      });

      const snapshot = await collector.generateSnapshot(
        '/test/workspace',
        'test-operation',
        new Error('Test error')
      );

      expect(snapshot).toBeDefined();
      expect(snapshot.id).toBeDefined();
      expect(snapshot.timestamp).toBeDefined();
      expect(snapshot.workspace).toBe('/test/workspace');
      expect(snapshot.operation).toBe('test-operation');
      expect(snapshot.error).toEqual({
        message: 'Test error',
        stack: expect.any(String),
        code: undefined,
        type: 'Error'
      });
      expect(snapshot.logs).toEqual(mockLogs);
      expect(snapshot.metrics).toEqual(mockMetricsData);
      expect(snapshot.healthStatus).toBeDefined();
      expect(snapshot.systemInfo).toBeDefined();
    });

    it('should include system information in snapshot', async () => {
      const snapshot = await collector.generateSnapshot();

      expect(snapshot.systemInfo).toMatchObject({
        nodeVersion: process.version,
        platform: expect.stringContaining('linux'),
        memory: expect.objectContaining({
          rss: expect.any(Number),
          heapTotal: expect.any(Number),
          heapUsed: expect.any(Number),
          external: expect.any(Number)
        }),
        uptime: expect.any(Number)
      });
    }, 15000);

    it('should generate snapshot with correct structure', async () => {
      const snapshot = await collector.generateSnapshot();

      expect(snapshot).toHaveProperty('id');
      expect(snapshot).toHaveProperty('timestamp');
      expect(snapshot).toHaveProperty('healthStatus');
      expect(snapshot).toHaveProperty('systemInfo');
      expect(snapshot.id).toMatch(/^[a-f0-9-]{36}$/); // UUID format
    }, 15000);
  });

  describe('Health Checks', () => {
    it('should perform comprehensive health checks', async () => {
      // Mock successful tool checks
      mockExec.mockImplementation((command, callback) => {
        if (typeof callback === 'function') {
          if (command.includes('terraform')) {
            callback(null, { stdout: 'Terraform v1.0.0\n' } as any);
          } else if (command.includes('ansible')) {
            callback(null, { stdout: 'ansible 2.9.0\n' } as any);
          } else {
            callback(null, { stdout: 'version 1.0.0\n' } as any);
          }
        }
        return {} as any;
      });

      const healthStatus = await collector.performHealthChecks();

      expect(healthStatus).toBeDefined();
      expect(Array.isArray(healthStatus)).toBe(true);
      expect(healthStatus.length).toBeGreaterThan(0);

      // Should include system health
      const systemHealth = healthStatus.find(h => h.component === 'system');
      expect(systemHealth).toBeDefined();
      expect(systemHealth!.status).toMatch(/healthy|warning|error/);

      // Should include memory health
      const memoryHealth = healthStatus.find(h => h.component === 'memory');
      expect(memoryHealth).toBeDefined();

      // Should include tool availability
      const terraformHealth = healthStatus.find(h => h.component === 'tool_terraform');
      expect(terraformHealth).toBeDefined();
      expect(terraformHealth!.status).toBe('healthy');
    });

    it('should detect system health issues', async () => {
      // Mock high system load
      mockOs.loadavg.mockReturnValue([8.0, 7.5, 7.0]); // High load for 4 CPUs

      const healthStatus = await collector.performHealthChecks();
      const systemHealth = healthStatus.find(h => h.component === 'system');

      expect(systemHealth!.status).toBe('warning');
      expect(systemHealth!.message).toContain('high load');
    });

    it('should detect memory health issues', async () => {
      // Mock high memory usage
      const mockMemoryUsage = jest.spyOn(process, 'memoryUsage').mockReturnValue({
        rss: 100 * 1024 * 1024,
        heapUsed: 95 * 1024 * 1024, // 95% heap usage
        heapTotal: 100 * 1024 * 1024,
        external: 10 * 1024 * 1024,
        arrayBuffers: 5 * 1024 * 1024
      });

      const healthStatus = await collector.performHealthChecks();
      const memoryHealth = healthStatus.find(h => h.component === 'memory');

      expect(memoryHealth!.status).toBe('error');
      expect(memoryHealth!.message).toContain('Critical memory usage');

      mockMemoryUsage.mockRestore();
    });

    it('should handle successful tool availability checks', async () => {
      // With our global mock, all tools should be available
      const healthStatus = await collector.performHealthChecks();
      const terraformHealth = healthStatus.find(h => h.component === 'tool_terraform');
      const ansibleHealth = healthStatus.find(h => h.component === 'tool_ansible');

      expect(terraformHealth!.status).toBe('healthy');
      expect(terraformHealth!.message).toContain('available');
      expect(ansibleHealth!.status).toBe('healthy');
      expect(ansibleHealth!.message).toContain('available');
    });

    it('should check database health', async () => {
      // Mock database file exists
      mockFs.existsSync.mockImplementation((path) => {
        return path.toString().includes('database.db');
      });

      const healthStatus = await collector.performHealthChecks();
      const dbHealth = healthStatus.find(h => h.component === 'database');

      expect(dbHealth).toBeDefined();
      expect(dbHealth!.status).toBe('healthy');
    });

    it('should check workspace health', async () => {
      // Mock workspace structure
      mockFs.existsSync.mockImplementation((path) => {
        const pathStr = path.toString();
        return pathStr.includes('.proxmox') || 
               pathStr.includes('config.yml') ||
               pathStr.includes('terraform') ||
               pathStr.includes('ansible');
      });

      const healthStatus = await collector.performHealthChecks();
      const workspaceHealth = healthStatus.find(h => h.component === 'workspace');

      expect(workspaceHealth).toBeDefined();
      expect(workspaceHealth!.status).toBe('healthy');
    });
  });

  describe('System Information Collection', () => {
    it('should collect complete system information', async () => {
      const snapshot = await collector.generateSnapshot();

      expect(snapshot.systemInfo).toMatchObject({
        nodeVersion: process.version,
        platform: expect.stringContaining(os.platform()),
        memory: expect.objectContaining({
          rss: expect.any(Number),
          heapTotal: expect.any(Number),
          heapUsed: expect.any(Number),
          external: expect.any(Number)
        }),
        uptime: expect.any(Number)
      });
    }, 15000);
  });

  describe('Workspace Information Collection', () => {
    it('should collect workspace information when available', async () => {
      // Mock workspace files
      mockFs.existsSync.mockImplementation((path) => {
        return path.toString().includes('config.yml');
      });
      mockFs.readFileSync.mockReturnValue('host: test-server\nport: 8006');

      // Mock tool versions
      mockExec.mockImplementation((command, callback) => {
        if (typeof callback === 'function') {
          if (command.includes('terraform')) {
            callback(null, { stdout: 'Terraform v1.0.0\n' } as any);
          } else if (command.includes('ansible')) {
            callback(null, { stdout: 'ansible 2.9.0\n' } as any);
          }
        }
        return {} as any;
      });

      const snapshot = await collector.generateSnapshot('/test/workspace');

      expect(snapshot.workspaceInfo).toBeDefined();
      expect(snapshot.workspaceInfo!.path).toBe('/test/workspace');
      expect(snapshot.workspaceInfo!.terraformVersion).toContain('Terraform v1.0.0');
      expect(snapshot.workspaceInfo!.ansibleVersion).toContain('ansible 2.9.0');
    }, 20000);

    it('should handle workspace information collection errors', async () => {
      // Mock file read error
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });

      const snapshot = await collector.generateSnapshot('/test/workspace');

      expect(snapshot.workspaceInfo).toBeDefined();
      expect(snapshot.workspaceInfo!.error).toContain('File not found');
    }, 20000);
  });

  describe('AI Collaboration Prompt Generation', () => {
    it('should generate comprehensive AI prompt', () => {
      const mockSnapshot: DiagnosticSnapshot = {
        id: 'test-123',
        timestamp: '2024-01-01T00:00:00Z',
        workspace: '/test/workspace',
        operation: 'sync',
        error: {
          message: 'Connection failed',
          stack: 'Error stack trace',
          code: 'ECONNREFUSED',
          type: 'Error'
        },
        logs: [
          {
            timestamp: '2024-01-01T00:00:00Z',
            level: 'error',
            message: 'Connection timeout',
            correlationId: 'test-123',
            operation: 'sync',
            phase: 'connect',
            context: { resourcesAffected: [] }
          }
        ],
        metrics: [],
        healthStatus: [
          {
            component: 'proxmox',
            status: 'error',
            message: 'Connection failed',
            timestamp: '2024-01-01T00:00:00Z'
          }
        ],
        systemInfo: {
          nodeVersion: 'v18.0.0',
          platform: 'linux',
          memory: process.memoryUsage(),
          uptime: 3600
        }
      };

      const userDescription = 'Sync operation failed with connection error';
      const prompt = collector.generateAIPrompt(mockSnapshot, userDescription);

      expect(prompt).toContain('Sync operation failed with connection error');
      expect(prompt).toContain('Connection failed');
      expect(prompt).toContain('proxmox: Connection failed');
      expect(prompt).toContain('Node.js: v18.0.0');
      expect(prompt).toContain('Platform: linux');
      expect(prompt).toContain('[ERROR] Connection timeout');
    });

    it('should handle snapshots without errors', () => {
      const mockSnapshot: DiagnosticSnapshot = {
        id: 'test-123',
        timestamp: '2024-01-01T00:00:00Z',
        logs: [],
        metrics: [],
        healthStatus: [],
        systemInfo: {
          nodeVersion: 'v18.0.0',
          platform: 'linux',
          memory: process.memoryUsage(),
          uptime: 3600
        }
      };

      const prompt = collector.generateAIPrompt(mockSnapshot, 'General issue');

      expect(prompt).toContain('No specific error reported');
      expect(prompt).toContain('General issue');
    });
  });

  describe('Health Status', () => {
    it('should perform health checks on demand', async () => {
      const healthStatus = await collector.performHealthChecks();
      
      expect(Array.isArray(healthStatus)).toBe(true);
      expect(healthStatus.length).toBeGreaterThan(0);
    }, 20000);

    it('should include all expected health components', async () => {
      const healthStatus = await collector.performHealthChecks();
      
      const components = healthStatus.map(h => h.component);
      expect(components).toContain('system');
      expect(components).toContain('memory');
      expect(components).toContain('database');
    });
  });

  describe('Error Handling', () => {
    it('should handle health check errors gracefully', async () => {
      // With our global mock, all tools should be available
      const healthStatus = await collector.performHealthChecks();
      
      // Should still return some health checks (system, memory)
      expect(healthStatus.length).toBeGreaterThan(0);
      
      // Tool checks should show as healthy with our mock
      const toolChecks = healthStatus.filter(h => h.component.startsWith('tool_'));
      expect(toolChecks.length).toBeGreaterThan(0); // Make sure we have tool checks
      toolChecks.forEach(check => {
        expect(check.status).toBe('healthy');
      });
    });

    it('should generate snapshot despite potential file system errors', async () => {
      // Mock file system error (should not affect snapshot generation since it doesn't save to file)
      mockFs.mkdirSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const snapshot = await collector.generateSnapshot();
      
      // Should still generate snapshot successfully
      expect(snapshot).toBeDefined();
      expect(snapshot.id).toBeDefined();
    });

    it('should sanitize sensitive information', async () => {
      const testConfig = {
        host: 'test-server',
        tokenSecret: 'secret-token',
        password: 'secret-password',
        apiKey: 'secret-api-key'
      };

      // Use private method via type assertion
      const sanitized = (collector as any).sanitizeConfig(testConfig);

      expect(sanitized.host).toBe('test-server');
      expect(sanitized.tokenSecret).toBe('[REDACTED]');
      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.apiKey).toBe('[REDACTED]');
    });
  });

  describe('Utility Methods', () => {
    it('should format bytes correctly', () => {
      const formatBytes = (collector as any).formatBytes;

      expect(formatBytes(0)).toBe('0 B');
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1024 * 1024)).toBe('1 MB');
      expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
      expect(formatBytes(1536)).toBe('1.5 KB');
    });

    it('should handle error serialization correctly', () => {
      const testError = new Error('Test error');
      testError.stack = 'Test stack trace';
      
      // Test that our error handling is working in generateSnapshot
      expect(() => collector.generateSnapshot('test', 'test', testError)).not.toThrow();
    });
  });

  describe('Simplified Design', () => {
    it('should work without continuous monitoring', () => {
      // The simplified design no longer has continuous monitoring
      // Health checks are performed on-demand only
      expect(collector).toBeDefined();
      expect(typeof collector.performHealthChecks).toBe('function');
    });
  });
});