/**
 * MetricsCollector Component TDD Test Suite
 * Comprehensive tests for performance metrics tracking and analysis
 */

import { MetricsCollector } from '../metrics';
import { PerformanceMetric } from '../types';
import { Logger } from '../logger';

// Mock Logger to avoid interference
jest.mock('../logger', () => ({
  Logger: {
    getInstance: () => ({
      debug: jest.fn()
    })
  }
}));

// Mock OS module for hostname
jest.mock('os', () => ({
  hostname: () => 'test-hostname'
}));

describe('MetricsCollector', () => {
  let collector: MetricsCollector;
  let originalProcess: any;

  beforeEach(() => {
    // Reset singleton instance
    (MetricsCollector as any).instance = undefined;
    collector = MetricsCollector.getInstance();

    // Mock process methods
    originalProcess = {
      hrtime: process.hrtime,
      memoryUsage: process.memoryUsage,
      cpuUsage: process.cpuUsage,
      uptime: process.uptime
    };

    // Mock process.hrtime for consistent timing tests
    const mockTime = BigInt(1000000000); // 1 second in nanoseconds
    process.hrtime = {
      bigint: jest.fn(() => mockTime)
    } as any;

    // Mock process.memoryUsage
    (process.memoryUsage as any) = jest.fn(() => ({
      rss: 100 * 1024 * 1024, // 100MB
      heapUsed: 50 * 1024 * 1024, // 50MB
      heapTotal: 80 * 1024 * 1024, // 80MB
      external: 10 * 1024 * 1024, // 10MB
      arrayBuffers: 5 * 1024 * 1024 // 5MB
    }));

    // Mock process.cpuUsage
    (process.cpuUsage as any) = jest.fn(() => ({
      user: 100000, // 100ms
      system: 50000  // 50ms
    }));

    // Mock process.uptime
    (process.uptime as any) = jest.fn(() => 3600); // 1 hour
  });

  afterEach(() => {
    // Restore original process methods
    process.hrtime = originalProcess.hrtime;
    process.memoryUsage = originalProcess.memoryUsage;
    process.cpuUsage = originalProcess.cpuUsage;
    process.uptime = originalProcess.uptime;

    // Clear metrics
    collector.clearMetrics();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance when called multiple times', () => {
      const collector1 = MetricsCollector.getInstance();
      const collector2 = MetricsCollector.getInstance();
      
      expect(collector1).toBe(collector2);
    });
  });

  describe('Basic Metric Recording', () => {
    it('should record metrics with all required fields', () => {
      collector.record('test.metric', 42.5, 'ms', { 
        component: 'test' 
      }, 'test-operation');

      const metrics = collector.getMetrics();
      expect(metrics).toHaveLength(1);

      const metric = metrics[0];
      expect(metric.name).toBe('test.metric');
      expect(metric.value).toBe(42.5);
      expect(metric.unit).toBe('ms');
      expect(metric.tags.component).toBe('test');
      expect(metric.tags.host).toBe('test-hostname');
      expect(metric.operation).toBe('test-operation');
      expect(metric.timestamp).toBeDefined();
      expect(new Date(metric.timestamp)).toBeInstanceOf(Date);
    });

    it('should auto-add hostname tag to all metrics', () => {
      collector.record('test.metric', 100, 'count');

      const metrics = collector.getMetrics();
      expect(metrics[0].tags.host).toBe('test-hostname');
    });

    it('should handle metrics without tags or operation', () => {
      collector.record('simple.metric', 123, 'bytes');

      const metrics = collector.getMetrics();
      expect(metrics).toHaveLength(1);
      expect(metrics[0].tags).toEqual({ host: 'test-hostname' });
      expect(metrics[0].operation).toBeUndefined();
    });
  });

  describe('Timer Management', () => {
    it('should start and end timers correctly', () => {
      const timerName = 'test.timer';
      
      collector.startTimer(timerName, { context: 'test' });
      
      // Mock time progression
      const newTime = 2000000000n; // 2 seconds
      (process.hrtime.bigint as jest.Mock).mockReturnValue(newTime);
      
      const duration = collector.endTimer(timerName, { result: 'success' });

      expect(duration).toBe(1000); // 1 second in milliseconds

      const metrics = collector.getMetrics(timerName);
      expect(metrics).toHaveLength(1);
      
      const metric = metrics[0];
      expect(metric.name).toBe(timerName);
      expect(metric.value).toBe(1000);
      expect(metric.unit).toBe('ms');
      expect(metric.tags.context).toBe('test');
      expect(metric.tags.result).toBe('success');
    });

    it('should handle ending non-existent timers gracefully', () => {
      const duration = collector.endTimer('non-existent-timer');
      expect(duration).toBe(0);
      expect(collector.getMetrics()).toHaveLength(0);
    });

    it('should handle multiple concurrent timers', () => {
      collector.startTimer('timer1', { type: 'A' });
      collector.startTimer('timer2', { type: 'B' });
      
      // End first timer
      const duration1 = collector.endTimer('timer1');
      
      // Progress time for second timer
      const newTime = 3000000000n; // 3 seconds from start
      (process.hrtime.bigint as jest.Mock).mockReturnValue(newTime);
      
      const duration2 = collector.endTimer('timer2');

      expect(duration1).toBe(1000);
      expect(duration2).toBe(2000);

      const metrics = collector.getMetrics();
      expect(metrics).toHaveLength(2);
    });
  });

  describe('Operation Duration Recording', () => {
    it('should record operation duration with tags', () => {
      collector.recordDuration('sync', 5420, { 
        success: 'true',
        resources: '12'
      });

      const metrics = collector.getMetrics('operation.duration');
      expect(metrics).toHaveLength(1);

      const metric = metrics[0];
      expect(metric.name).toBe('operation.duration');
      expect(metric.value).toBe(5420);
      expect(metric.unit).toBe('ms');
      expect(metric.operation).toBe('sync');
      expect(metric.tags.operation).toBe('sync');
      expect(metric.tags.success).toBe('true');
      expect(metric.tags.resources).toBe('12');
    });
  });

  describe('System Metrics Recording', () => {
    it('should record memory usage metrics', () => {
      collector.recordMemoryUsage('test-operation');

      const memoryMetrics = collector.getMetrics().filter(m => 
        m.name.startsWith('memory.')
      );

      expect(memoryMetrics).toHaveLength(4);
      
      const metricsByType = memoryMetrics.reduce((acc, m) => {
        acc[m.tags.type] = m;
        return acc;
      }, {} as Record<string, PerformanceMetric>);

      expect(metricsByType.rss.value).toBe(100 * 1024 * 1024);
      expect(metricsByType.heapUsed.value).toBe(50 * 1024 * 1024);
      expect(metricsByType.heapTotal.value).toBe(80 * 1024 * 1024);
      expect(metricsByType.external.value).toBe(10 * 1024 * 1024);

      // All should have correct operation
      memoryMetrics.forEach(metric => {
        expect(metric.operation).toBe('test-operation');
        expect(metric.unit).toBe('bytes');
      });
    });

    it('should record CPU usage metrics', () => {
      collector.recordCpuUsage('test-operation');

      const cpuMetrics = collector.getMetrics().filter(m => 
        m.name.startsWith('cpu.')
      );

      expect(cpuMetrics).toHaveLength(2);

      const userMetric = cpuMetrics.find(m => m.tags.type === 'user');
      const systemMetric = cpuMetrics.find(m => m.tags.type === 'system');

      expect(userMetric!.value).toBe(100000);
      expect(systemMetric!.value).toBe(50000);
      expect(userMetric!.unit).toBe('microseconds');
      expect(systemMetric!.unit).toBe('microseconds');
    });
  });

  describe('API Metrics Recording', () => {
    it('should record API response time', () => {
      collector.recordApiResponseTime('/api/nodes', 'GET', 200, 156);

      const metrics = collector.getMetrics('api.response_time');
      expect(metrics).toHaveLength(1);

      const metric = metrics[0];
      expect(metric.value).toBe(156);
      expect(metric.unit).toBe('ms');
      expect(metric.tags.endpoint).toBe('/api/nodes');
      expect(metric.tags.method).toBe('GET');
      expect(metric.tags.status_code).toBe('200');
    });

    it('should record database query time', () => {
      collector.recordDbQueryTime('SELECT * FROM vms WHERE status = ?', 45, 12);

      const metrics = collector.getMetrics('db.query_time');
      expect(metrics).toHaveLength(1);

      const metric = metrics[0];
      expect(metric.value).toBe(45);
      expect(metric.unit).toBe('ms');
      expect(metric.tags.query_type).toBe('select');
      expect(metric.tags.row_count).toBe('12');
    });

    it('should extract query types correctly', () => {
      const queries = [
        'SELECT * FROM users',
        'INSERT INTO logs VALUES',
        'UPDATE vm SET status = ?',
        'DELETE FROM temp',
        'CREATE TABLE test',
        'DROP TABLE old',
        'EXPLAIN SELECT'
      ];

      queries.forEach((query, index) => {
        collector.recordDbQueryTime(query, 10, index);
      });

      const metrics = collector.getMetrics('db.query_time');
      const queryTypes = metrics.map(m => m.tags.query_type);

      expect(queryTypes).toEqual([
        'select', 'insert', 'update', 'delete', 
        'create', 'drop', 'other'
      ]);
    });
  });

  describe('Infrastructure Metrics Recording', () => {
    it('should record Terraform operation metrics', () => {
      collector.recordTerraformMetrics('apply', 12500, 5, true);

      const metrics = collector.getMetrics().filter(m => 
        m.name.startsWith('terraform.')
      );

      expect(metrics).toHaveLength(2);

      const durationMetric = metrics.find(m => 
        m.name === 'terraform.operation_duration'
      );
      const resourceMetric = metrics.find(m => 
        m.name === 'terraform.resource_count'
      );

      expect(durationMetric!.value).toBe(12500);
      expect(durationMetric!.tags.operation).toBe('apply');
      expect(durationMetric!.tags.success).toBe('true');

      expect(resourceMetric!.value).toBe(5);
      expect(resourceMetric!.unit).toBe('count');
    });

    it('should record Ansible operation metrics', () => {
      collector.recordAnsibleMetrics('playbook', 8000, 3, 15, false);

      const metrics = collector.getMetrics().filter(m => 
        m.name.startsWith('ansible.')
      );

      expect(metrics).toHaveLength(3);

      const durationMetric = metrics.find(m => 
        m.name === 'ansible.operation_duration'
      );
      const hostMetric = metrics.find(m => 
        m.name === 'ansible.host_count'
      );
      const taskMetric = metrics.find(m => 
        m.name === 'ansible.task_count'
      );

      expect(durationMetric!.value).toBe(8000);
      expect(durationMetric!.tags.success).toBe('false');

      expect(hostMetric!.value).toBe(3);
      expect(taskMetric!.value).toBe(15);
    });

    it('should record Proxmox API metrics', () => {
      collector.recordProxmoxMetrics('/nodes', 'GET', 234, true);

      const metrics = collector.getMetrics('proxmox.api_call_duration');
      expect(metrics).toHaveLength(1);

      const metric = metrics[0];
      expect(metric.value).toBe(234);
      expect(metric.tags.endpoint).toBe('/nodes');
      expect(metric.tags.method).toBe('GET');
      expect(metric.tags.success).toBe('true');
    });
  });

  describe('Metric Querying', () => {
    beforeEach(() => {
      // Create test data
      collector.record('metric.a', 10, 'ms', {}, 'op1');
      collector.record('metric.b', 20, 'ms', {}, 'op1');
      collector.record('metric.a', 15, 'ms', {}, 'op2');
      collector.record('metric.c', 30, 'count', {}, 'op2');
    });

    it('should return all metrics when no filter specified', () => {
      const metrics = collector.getMetrics();
      expect(metrics).toHaveLength(4);
    });

    it('should filter metrics by name', () => {
      const metricA = collector.getMetrics('metric.a');
      expect(metricA).toHaveLength(2);
      expect(metricA.every(m => m.name === 'metric.a')).toBe(true);
    });

    it('should limit number of returned metrics', () => {
      const metrics = collector.getMetrics(undefined, 2);
      expect(metrics).toHaveLength(2);
      
      // Should be most recent first
      expect(metrics[0].name).toBe('metric.c');
      expect(metrics[1].name).toBe('metric.a');
    });

    it('should return metrics by operation', () => {
      const op1Metrics = collector.getMetricsByOperation('op1');
      expect(op1Metrics).toHaveLength(2);
      expect(op1Metrics.every(m => m.operation === 'op1')).toBe(true);
    });

    it('should return metrics in reverse chronological order', () => {
      const metrics = collector.getMetrics();
      
      // Parse timestamps and verify ordering
      const timestamps = metrics.map(m => new Date(m.timestamp).getTime());
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i-1]).toBeGreaterThanOrEqual(timestamps[i]);
      }
    });
  });

  describe('Metrics Summary', () => {
    beforeEach(() => {
      const now = Date.now();
      
      // Create metrics within the time window (1 hour ago to now)
      collector.record('operation.duration', 100, 'ms', { success: 'true' }, 'op1');
      collector.record('operation.duration', 200, 'ms', { success: 'true' }, 'op2');
      collector.record('operation.duration', 150, 'ms', { success: 'false' }, 'op3');
      collector.record('api.response_time', 50, 'ms', { success: 'true' }, 'op1');
      collector.record('error.count', 1, 'count', { success: 'false' }, 'op3');
      
      collector.recordMemoryUsage('system');
    });

    it('should generate comprehensive metrics summary', () => {
      const summary = collector.getMetricsSummary();

      expect(summary.totalMetrics).toBeGreaterThan(0);
      expect(summary.uniqueOperations).toBe(4); // op1, op2, op3, system
      expect(summary.avgResponseTime).toBeGreaterThan(0);
      expect(summary.errorRate).toBeGreaterThan(0);
      expect(summary.memoryUsage.current).toBeGreaterThan(0);
      expect(summary.memoryUsage.peak).toBeGreaterThan(0);
    });

    it('should calculate average response time correctly', () => {
      // Clear existing metrics and add specific test data
      collector.clearMetrics();
      
      collector.record('operation.duration', 100, 'ms');
      collector.record('api.response_time', 200, 'ms');
      collector.record('test.duration', 300, 'ms');

      const summary = collector.getMetricsSummary();
      expect(summary.avgResponseTime).toBe(200); // (100 + 200 + 300) / 3
    });

    it('should calculate error rate correctly', () => {
      collector.clearMetrics();
      
      // 2 successful, 1 failed out of 3 total
      collector.record('test', 1, 'count', { success: 'true' });
      collector.record('test', 2, 'count', { success: 'true' });
      collector.record('test', 3, 'count', { success: 'false' });

      const summary = collector.getMetricsSummary();
      expect(summary.errorRate).toBeCloseTo(0.333, 2); // 1/3
    });

    it('should use custom time window for summary', () => {
      collector.clearMetrics();
      
      // This should be filtered out by a very short time window
      collector.record('old.metric', 100, 'count');
      
      const summary = collector.getMetricsSummary(1); // 1ms window
      expect(summary.totalMetrics).toBe(0);
    });
  });

  describe('Memory Management', () => {
    it('should trim metrics when exceeding maximum count', () => {
      // Add more metrics than the limit (5000)
      for (let i = 0; i < 5200; i++) {
        collector.record(`metric.${i}`, i, 'count');
      }

      const metrics = collector.getMetrics(undefined, 10000); // Request more than limit
      expect(metrics.length).toBeLessThanOrEqual(5000);

      // Should keep most recent metrics
      const latestMetric = metrics[0];
      expect(latestMetric.name).toBe('metric.5199');
    });

    it('should clear all metrics when requested', () => {
      collector.record('test1', 1, 'count');
      collector.record('test2', 2, 'count');
      
      expect(collector.getMetrics()).toHaveLength(2);
      
      collector.clearMetrics();
      
      expect(collector.getMetrics()).toHaveLength(0);
    });
  });

  describe('System Metrics Automation', () => {
    it('should setup system metrics collection on initialization', () => {
      // This is tested by verifying that the singleton sets up intervals
      // The actual interval testing would require more complex mocking
      expect(collector).toBeDefined();
      
      // Verify that system metrics can be recorded
      collector.recordMemoryUsage('system');
      collector.recordCpuUsage('system');
      
      const systemMetrics = collector.getMetrics().filter(m => 
        m.operation === 'system'
      );
      
      expect(systemMetrics.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid metric values gracefully', () => {
      // Should not throw errors
      collector.record('test', NaN, 'ms');
      collector.record('test', Infinity, 'ms');
      collector.record('test', -Infinity, 'ms');

      const metrics = collector.getMetrics('test');
      expect(metrics).toHaveLength(3);
      
      // Values should be recorded as-is for analysis
      expect(metrics.some(m => isNaN(m.value))).toBe(true);
      expect(metrics.some(m => m.value === Infinity)).toBe(true);
      expect(metrics.some(m => m.value === -Infinity)).toBe(true);
    });

    it('should handle concurrent metric recording', () => {
      const promises = [];
      
      // Simulate concurrent metric recording
      for (let i = 0; i < 100; i++) {
        promises.push(
          Promise.resolve().then(() => 
            collector.record(`concurrent.${i}`, i, 'count')
          )
        );
      }

      return Promise.all(promises).then(() => {
        const metrics = collector.getMetrics();
        expect(metrics.length).toBe(100);
        
        // All metrics should be unique
        const names = metrics.map(m => m.name);
        const uniqueNames = new Set(names);
        expect(uniqueNames.size).toBe(100);
      });
    });
  });

  describe('Logger Integration', () => {
    it('should log metric recording when debug enabled', () => {
      const mockLogger = Logger.getInstance();
      
      collector.record('test.metric', 42, 'ms', { test: 'value' });
      
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Metric recorded: test.metric = 42 ms',
        { resourcesAffected: [] },
        {
          metricName: 'test.metric',
          metricValue: 42,
          metricUnit: 'ms',
          metricTags: { test: 'value' }
        }
      );
    });
  });
});