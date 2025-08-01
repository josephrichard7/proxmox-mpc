/**
 * Jest Test Setup
 * Global configuration and utilities for observability tests
 */

// Mock console methods to avoid noisy test output
const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info,
  debug: console.debug
};

// Quiet console during tests unless explicitly testing output
beforeAll(() => {
  // Only mock if not testing console output specifically
  const isConsoleTest = expect.getState().testPath?.includes('console') || 
                       expect.getState().testPath?.includes('debug') ||
                       expect.getState().testPath?.includes('integration');
  
  if (!isConsoleTest) {
    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();
    console.info = jest.fn();
    console.debug = jest.fn();
  }
});

afterAll(() => {
  // Restore console methods
  console.log = originalConsole.log;
  console.error = originalConsole.error;
  console.warn = originalConsole.warn;
  console.info = originalConsole.info;
  console.debug = originalConsole.debug;
});

// Global test utilities
global.testUtils = {
  /**
   * Wait for a specified amount of time
   */
  wait: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
  
  /**
   * Create a mock function that resolves after a delay
   */
  createDelayedMock: (delay: number = 10, returnValue?: any) => {
    return jest.fn().mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve(returnValue), delay))
    );
  },
  
  /**
   * Generate test data for performance tests
   */
  generateTestData: (count: number, prefix: string = 'test') => {
    return Array.from({ length: count }, (_, i) => ({
      id: `${prefix}-${i}`,
      value: Math.random() * 1000,
      timestamp: new Date().toISOString(),
      tags: { iteration: i.toString() }
    }));
  },
  
  /**
   * Memory usage helper for performance tests
   */
  getMemoryUsage: () => {
    const usage = process.memoryUsage();
    return {
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
      external: Math.round(usage.external / 1024 / 1024), // MB
      rss: Math.round(usage.rss / 1024 / 1024) // MB
    };
  },
  
  /**
   * Performance measurement helper
   */
  measurePerformance: async (fn: () => void | Promise<void>, iterations: number = 1) => {
    const times: number[] = [];
    
    for (let i = 0; i < iterations; i++) {
      const start = process.hrtime.bigint();
      await fn();
      const end = process.hrtime.bigint();
      times.push(Number(end - start) / 1_000_000); // Convert to milliseconds
    }
    
    return {
      min: Math.min(...times),
      max: Math.max(...times),
      avg: times.reduce((a, b) => a + b, 0) / times.length,
      total: times.reduce((a, b) => a + b, 0),
      times
    };
  }
};

// Extend Jest matchers for observability-specific assertions
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidLogEntry(): R;
      toBeValidMetric(): R;
      toBeValidTraceSpan(): R;
      toHavePerformanceWithin(threshold: number): R;
    }
  }
  
  var testUtils: {
    wait: (ms: number) => Promise<void>;
    createDelayedMock: (delay?: number, returnValue?: any) => jest.Mock;
    generateTestData: (count: number, prefix?: string) => any[];
    getMemoryUsage: () => { heapUsed: number; heapTotal: number; external: number; rss: number };
    measurePerformance: (fn: () => void | Promise<void>, iterations?: number) => Promise<{
      min: number; max: number; avg: number; total: number; times: number[];
    }>;
  };
}

expect.extend({
  toBeValidLogEntry(received) {
    const requiredFields = ['timestamp', 'correlationId', 'operation', 'phase', 'level', 'message', 'context'];
    const missingFields = requiredFields.filter(field => !(field in received));
    
    if (missingFields.length > 0) {
      return {
        message: () => `Expected log entry to have fields: ${missingFields.join(', ')}`,
        pass: false,
      };
    }
    
    const validLevels = ['debug', 'info', 'warn', 'error'];
    if (!validLevels.includes(received.level)) {
      return {
        message: () => `Expected log level to be one of: ${validLevels.join(', ')}, but got: ${received.level}`,
        pass: false,
      };
    }
    
    return {
      message: () => 'Log entry is valid',
      pass: true,
    };
  },
  
  toBeValidMetric(received) {
    const requiredFields = ['name', 'value', 'unit', 'timestamp', 'tags'];
    const missingFields = requiredFields.filter(field => !(field in received));
    
    if (missingFields.length > 0) {
      return {
        message: () => `Expected metric to have fields: ${missingFields.join(', ')}`,
        pass: false,
      };
    }
    
    if (typeof received.value !== 'number') {
      return {
        message: () => `Expected metric value to be a number, but got: ${typeof received.value}`,
        pass: false,
      };
    }
    
    return {
      message: () => 'Metric is valid',
      pass: true,
    };
  },
  
  toBeValidTraceSpan(received) {
    const requiredFields = ['traceId', 'spanId', 'operation', 'startTime', 'status', 'tags'];
    const missingFields = requiredFields.filter(field => !(field in received));
    
    if (missingFields.length > 0) {
      return {
        message: () => `Expected trace span to have fields: ${missingFields.join(', ')}`,
        pass: false,
      };
    }
    
    const validStatuses = ['pending', 'success', 'error'];
    if (!validStatuses.includes(received.status)) {
      return {
        message: () => `Expected span status to be one of: ${validStatuses.join(', ')}, but got: ${received.status}`,
        pass: false,
      };
    }
    
    return {
      message: () => 'Trace span is valid',
      pass: true,
    };
  },
  
  toHavePerformanceWithin(received, threshold) {
    const isPerformant = received < threshold;
    
    return {
      message: () => isPerformant 
        ? `Expected performance ${received}ms to exceed threshold ${threshold}ms`
        : `Expected performance ${received}ms to be within threshold ${threshold}ms`,
      pass: isPerformant,
    };
  }
});

// Performance test helpers
export const performanceHelpers = {
  /**
   * Benchmark a function and ensure it meets performance criteria
   */
  async benchmarkFunction(
    fn: () => void | Promise<void>, 
    iterations: number = 100,
    maxAvgTime: number = 1
  ) {
    const results = await testUtils.measurePerformance(fn, iterations);
    
    expect(results.avg).toHavePerformanceWithin(maxAvgTime);
    expect(results.max).toBeLessThan(maxAvgTime * 10); // Max should be within 10x avg
    
    return results;
  },
  
  /**
   * Memory leak detection helper
   */
  async detectMemoryLeaks(
    fn: () => void | Promise<void>,
    iterations: number = 1000,
    maxMemoryIncrease: number = 50 // MB
  ) {
    const initialMemory = testUtils.getMemoryUsage();
    
    for (let i = 0; i < iterations; i++) {
      await fn();
      
      if (i % 100 === 0 && global.gc) {
        global.gc(); // Force garbage collection if available
      }
    }
    
    const finalMemory = testUtils.getMemoryUsage();
    const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
    
    expect(memoryIncrease).toBeLessThan(maxMemoryIncrease);
    
    return {
      initial: initialMemory,
      final: finalMemory,
      increase: memoryIncrease
    };
  }
};