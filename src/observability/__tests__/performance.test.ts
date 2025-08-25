/**
 * Performance Test Suite
 * Tests to ensure observability overhead is minimal and acceptable
 */

import { DiagnosticsCollector } from '../diagnostics';
import { Logger } from '../logger';
import { MetricsCollector } from '../metrics';
import { Tracer } from '../tracer';

// Mock fs to avoid actual file operations in performance tests
jest.mock('fs', () => ({
  existsSync: jest.fn(() => true),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn(() => 'test: config'),
  statSync: jest.fn(() => ({ size: 1024, mtime: new Date() }))
}));

jest.mock('child_process', () => ({
  exec: jest.fn((command, callback) => {
    if (callback) callback(null, { stdout: 'version 1.0.0\n' });
  })
}));

describe('Observability Performance Tests', () => {
  let logger: Logger;
  let tracer: Tracer;
  let metrics: MetricsCollector;
  let diagnostics: DiagnosticsCollector;

  beforeEach(() => {
    // Reset singletons
    (Logger as any).instance = undefined;
    (Tracer as any).instance = undefined;
    (MetricsCollector as any).instance = undefined;
    (DiagnosticsCollector as any).instance = undefined;

    // Initialize components
    logger = Logger.getInstance({
      level: 'info',
      enableConsole: false, // Disable console output for performance tests
      enableFile: false,    // Disable file operations for performance tests
      enableStructured: true,
      enableTracing: true
    });
    tracer = Tracer.getInstance();
    metrics = MetricsCollector.getInstance();
    diagnostics = DiagnosticsCollector.getInstance();
  });

  afterEach(() => {
    // Clean up for accurate measurements
    logger.clearBuffer();
    metrics.clearMetrics();
    tracer.clearCompletedSpans();
  });

  describe('Logger Performance', () => {
    it('should log messages with minimal overhead', () => {
      const iterations = 10000;
      const warmupIterations = 1000;

      // Warmup
      for (let i = 0; i < warmupIterations; i++) {
        logger.info(`Warmup message ${i}`, { test: true });
      }

      // Actual test
      const startTime = process.hrtime.bigint();
      
      for (let i = 0; i < iterations; i++) {
        logger.info(`Performance test message ${i}`, { 
          iteration: i,
          test: 'performance'
        });
      }

      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1_000_000; // Convert to milliseconds

      const avgTimePerLog = duration / iterations;

      // Should average less than 0.1ms per log entry
      expect(avgTimePerLog).toBeLessThan(0.1);
      
      // Total time should be reasonable
      expect(duration).toBeLessThan(500); // 500ms for 10k logs
    });

    it('should handle high-frequency logging without memory leaks', () => {
      const iterations = 50000;
      const initialMemory = process.memoryUsage().heapUsed;

      for (let i = 0; i < iterations; i++) {
        logger.info(`High frequency log ${i}`, { 
          batch: Math.floor(i / 1000),
          iteration: i
        });

        // Check memory every 10k iterations
        if (i % 10000 === 0 && i > 0) {
          const currentMemory = process.memoryUsage().heapUsed;
          const memoryIncrease = currentMemory - initialMemory;
          const memoryIncreasePerLog = memoryIncrease / i;

          // Memory increase per log should be reasonable (less than 10KB per log)
          // This accounts for Node.js garbage collection behavior
          expect(memoryIncreasePerLog).toBeLessThan(10240);
        }
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const totalMemoryIncrease = finalMemory - initialMemory;

      // Total memory increase should be reasonable (less than 50MB for 50k logs)
      expect(totalMemoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });

    it('should filter logs efficiently by level', () => {
      // Set to error level to filter out info logs
      logger.updateConfig({ level: 'error' });

      const iterations = 10000;
      const startTime = process.hrtime.bigint();

      for (let i = 0; i < iterations; i++) {
        logger.info(`Filtered message ${i}`); // Should be filtered out
        if (i % 100 === 0) {
          logger.error(`Error message ${i}`); // Should be logged
        }
      }

      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1_000_000;

      // Filtering should be very fast
      expect(duration).toBeLessThan(100); // 100ms for 10k filtered logs
      
      // Should only have error logs (100 out of 10000)
      const logs = logger.getRecentLogs(10000);
      expect(logs.length).toBe(100);
    });
  });

  describe('Tracer Performance', () => {
    it('should create and finish spans with minimal overhead', () => {
      const iterations = 5000;
      const spans: string[] = [];

      const startTime = process.hrtime.bigint();

      // Create spans
      for (let i = 0; i < iterations; i++) {
        const spanId = tracer.startTrace(`operation-${i}`, {
          iteration: i.toString(),
          batch: Math.floor(i / 100).toString()
        });
        spans.push(spanId);
      }

      // Finish spans
      for (const spanId of spans) {
        tracer.finishSpan(spanId, { success: 'true' });
      }

      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1_000_000;

      const avgTimePerSpan = duration / iterations;

      // Should average less than 0.2ms per span (create + finish)
      expect(avgTimePerSpan).toBeLessThan(0.2);
      
      // Total time should be reasonable
      expect(duration).toBeLessThan(500); // 500ms for 5k spans
    });

    it('should handle nested spans efficiently', () => {
      const depth = 10;
      const iterations = 1000;

      const startTime = process.hrtime.bigint();

      for (let i = 0; i < iterations; i++) {
        const spans: string[] = [];
        
        // Create nested spans
        let parentSpanId = tracer.startTrace(`root-${i}`);
        spans.push(parentSpanId);

        for (let d = 1; d < depth; d++) {
          const childSpanId = tracer.startSpan(`level-${d}`, parentSpanId);
          spans.push(childSpanId);
          parentSpanId = childSpanId;
        }

        // Finish spans in reverse order (child to parent)
        for (let j = spans.length - 1; j >= 0; j--) {
          tracer.finishSpan(spans[j]);
        }
      }

      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1_000_000;

      const totalSpans = iterations * depth;
      const avgTimePerSpan = duration / totalSpans;

      // Should handle nested spans efficiently
      expect(avgTimePerSpan).toBeLessThan(0.3);
      expect(duration).toBeLessThan(2000); // 2s for 10k nested spans
    });

    it('should maintain performance with large number of completed spans', () => {
      // Create a large number of completed spans first
      for (let i = 0; i < 1000; i++) {
        const spanId = tracer.startTrace(`background-${i}`);
        tracer.finishSpan(spanId);
      }

      // Now test performance with existing spans
      const iterations = 1000;
      const startTime = process.hrtime.bigint();

      for (let i = 0; i < iterations; i++) {
        const spanId = tracer.startTrace(`foreground-${i}`);
        tracer.finishSpan(spanId);
      }

      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1_000_000;

      // Performance should not degrade significantly with existing spans
      const avgTimePerSpan = duration / iterations;
      expect(avgTimePerSpan).toBeLessThan(0.5);
    });
  });

  describe('MetricsCollector Performance', () => {
    it('should record metrics with minimal overhead', () => {
      const iterations = 20000;

      const startTime = process.hrtime.bigint();

      for (let i = 0; i < iterations; i++) {
        metrics.record(`performance.test.${i % 10}`, i, 'count', {
          iteration: i.toString(),
          batch: Math.floor(i / 1000).toString()
        }, 'performance-test');
      }

      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1_000_000;

      const avgTimePerMetric = duration / iterations;

      // Should average less than 0.05ms per metric
      expect(avgTimePerMetric).toBeLessThan(0.05);
      
      // Total time should be reasonable
      expect(duration).toBeLessThan(400); // 400ms for 20k metrics
    });

    it('should handle timer operations efficiently', () => {
      const iterations = 5000;
      const timers: string[] = [];

      // Start timers
      const startTime = process.hrtime.bigint();

      for (let i = 0; i < iterations; i++) {
        const timerName = `timer-${i}`;
        metrics.startTimer(timerName, { iteration: i.toString() });
        timers.push(timerName);
      }

      // End timers
      for (const timerName of timers) {
        metrics.endTimer(timerName, { success: 'true' });
      }

      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1_000_000;

      const avgTimePerTimer = duration / iterations;

      // Should handle timer start/end efficiently
      expect(avgTimePerTimer).toBeLessThan(0.1);
      expect(duration).toBeLessThan(300); // 300ms for 5k timers
    });

    it('should query metrics efficiently', () => {
      // Create a large dataset first
      for (let i = 0; i < 10000; i++) {
        metrics.record(`query.test.${i % 20}`, i, 'ms', {
          type: i % 5 === 0 ? 'success' : 'error'
        }, `operation-${i % 10}`);
      }

      const iterations = 1000;
      const startTime = process.hrtime.bigint();

      for (let i = 0; i < iterations; i++) {
        // Different types of queries
        if (i % 4 === 0) {
          metrics.getMetrics(`query.test.${i % 20}`, 100);
        } else if (i % 4 === 1) {
          metrics.getMetricsByOperation(`operation-${i % 10}`, 50);
        } else if (i % 4 === 2) {
          metrics.getMetrics(undefined, 200);
        } else {
          metrics.getMetricsSummary();
        }
      }

      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1_000_000;

      const avgTimePerQuery = duration / iterations;

      // Queries should be fast even with large datasets
      expect(avgTimePerQuery).toBeLessThan(1); // Less than 1ms per query
      expect(duration).toBeLessThan(500); // 500ms for 1k queries
    });
  });

  describe('DiagnosticsCollector Performance', () => {
    it('should perform health checks within acceptable time', async () => {
      const iterations = 10;
      const durations: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = process.hrtime.bigint();
        
        await diagnostics.performHealthChecks();
        
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1_000_000;
        durations.push(duration);
      }

      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      const maxDuration = Math.max(...durations);

      // Average health check should be under 1 second
      expect(avgDuration).toBeLessThan(1000);
      
      // Max health check should be under 2 seconds
      expect(maxDuration).toBeLessThan(2000);
    });

    it('should generate diagnostic snapshots efficiently', async () => {
      // Pre-populate with data
      for (let i = 0; i < 1000; i++) {
        logger.info(`Snapshot test log ${i}`);
        metrics.record(`snapshot.metric.${i}`, i, 'count');
      }

      const iterations = 5;
      const durations: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = process.hrtime.bigint();
        
        await diagnostics.generateSnapshot('/test/workspace', 'performance-test');
        
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1_000_000;
        durations.push(duration);
      }

      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;

      // Snapshot generation should be under 3 seconds on average
      expect(avgDuration).toBeLessThan(3000);
    });
  });

  describe('Combined System Performance', () => {
    it('should handle realistic mixed workload efficiently', async () => {
      const duration = 3000; // 3 second test
      const startTime = Date.now();
      let operations = 0;

      while (Date.now() - startTime < duration) {
        const operationType = operations % 5;

        switch (operationType) {
          case 0: // Logging
            logger.info(`Mixed workload log ${operations}`, { 
              operation: 'mixed-test',
              iteration: operations
            });
            break;

          case 1: { // Tracing
            const spanId = tracer.startTrace(`mixed-operation-${operations}`);
            tracer.finishSpan(spanId, { type: 'mixed-test' });
            break;
          }

          case 2: // Metrics
            metrics.record('mixed.workload', operations, 'count', {
              type: 'performance-test'
            });
            break;

          case 3: { // Timer
            const timerName = `mixed-timer-${operations}`;
            metrics.startTimer(timerName);
            metrics.endTimer(timerName);
            break;
          }

          case 4: // Query operations
            if (operations > 100) {
              logger.getRecentLogs(10);
              metrics.getMetrics(undefined, 10);
              tracer.getCompletedSpans(10);
            }
            break;
        }

        operations++;
        
        // Small delay to prevent overwhelming the system
        if (operations % 1000 === 0) {
          await new Promise(resolve => setTimeout(resolve, 1));
        }
      }

      const actualDuration = Date.now() - startTime;
      const operationsPerSecond = operations / (actualDuration / 1000);

      // Should handle at least 5000 operations per second
      expect(operationsPerSecond).toBeGreaterThan(5000);
      
      // Should have processed significant number of operations
      expect(operations).toBeGreaterThan(20000);
    });

    it('should maintain performance under memory pressure', () => {
      const iterations = 50000;
      const memoryCheckInterval = 5000;
      let maxMemoryIncrease = 0;
      const initialMemory = process.memoryUsage().heapUsed;

      for (let i = 0; i < iterations; i++) {
        // Mix of operations to stress memory
        logger.info(`Memory pressure test ${i}`, { 
          data: 'x'.repeat(100), // 100 chars per log
          iteration: i
        });

        metrics.record(`memory.test.${i % 100}`, i, 'bytes', {
          data: 'y'.repeat(50)
        });

        const spanId = tracer.startTrace(`memory-test-${i}`);
        tracer.addTags(spanId, { 
          data: 'z'.repeat(75),
          iteration: i.toString()
        });
        tracer.finishSpan(spanId);

        // Check memory usage periodically
        if (i % memoryCheckInterval === 0) {
          const currentMemory = process.memoryUsage().heapUsed;
          const memoryIncrease = currentMemory - initialMemory;
          maxMemoryIncrease = Math.max(maxMemoryIncrease, memoryIncrease);

          // Force garbage collection if available
          if (global.gc) {
            global.gc();
          }
        }
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const totalMemoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 200MB)
      expect(totalMemoryIncrease).toBeLessThan(200 * 1024 * 1024);
      
      // Peak memory increase should be controlled
      expect(maxMemoryIncrease).toBeLessThan(300 * 1024 * 1024);
    });
  });

  describe('Resource Cleanup Performance', () => {
    it('should clean up resources efficiently', () => {
      // Create a large amount of data
      for (let i = 0; i < 10000; i++) {
        logger.info(`Cleanup test ${i}`);
        metrics.record(`cleanup.metric.${i}`, i, 'count');
        const spanId = tracer.startTrace(`cleanup-${i}`);
        tracer.finishSpan(spanId);
      }

      // Measure cleanup time
      const startTime = process.hrtime.bigint();

      logger.clearBuffer();
      metrics.clearMetrics();
      tracer.clearCompletedSpans();

      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1_000_000;

      // Cleanup should be very fast
      expect(duration).toBeLessThan(100); // Less than 100ms

      // Verify cleanup was effective
      expect(logger.getRecentLogs(1000)).toHaveLength(0);
      expect(metrics.getMetrics()).toHaveLength(0);
      expect(tracer.getCompletedSpans()).toHaveLength(0);
    });
  });
});