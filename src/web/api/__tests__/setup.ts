/**
 * Jest Test Setup
 * 
 * Global test setup and configuration for Web API tests.
 */

import { jest } from '@jest/globals';

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key';
process.env.DATABASE_URL = 'file:./test.db';

// Mock console methods to reduce noise during tests
const originalConsole = { ...console };

beforeAll(() => {
  // Suppress console output during tests
  console.log = jest.fn();
  console.info = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
});

afterAll(() => {
  // Restore console methods
  Object.assign(console, originalConsole);
});

// Mock logger to prevent log output during tests
jest.mock('../../../observability/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  },
  Logger: {
    getInstance: jest.fn(() => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    }))
  }
}));

// Global test utilities
global.mockUser = {
  id: 'test-user-123',
  username: 'testuser',
  email: 'test@example.com',
  role: 'user' as const,
  proxmoxServer: 'proxmox.test.local',
  createdAt: new Date()
};

global.mockVM = {
  id: 100,
  name: 'test-vm',
  description: 'Test VM',
  node: 'pve',
  status: 'stopped',
  template: false,
  memory: 2048,
  cores: 2,
  disk: 20,
  uptime: 0,
  cpuUsage: 0,
  memoryUsage: 0,
  diskUsage: 0,
  networkIn: 0,
  networkOut: 0,
  tags: [],
  startOnBoot: false,
  protection: false,
  createdAt: new Date(),
  updatedAt: new Date()
};

global.mockContainer = {
  id: 200,
  hostname: 'test-container',
  nodeId: 'pve',
  status: 'stopped',
  template: false,
  cpuCores: 2,
  memoryBytes: BigInt(2147483648), // 2GB
  uptime: 0,
  cpuUsage: 0,
  memoryUsage: 0,
  diskUsage: 0,
  networkIn: 0,
  networkOut: 0,
  tags: [],
  unprivileged: true,
  startOnBoot: false,
  protection: false,
  createdAt: new Date(),
  updatedAt: new Date()
};

// Custom matchers
expect.extend({
  toBeValidUUID(received: string) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const pass = uuidRegex.test(received);
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid UUID`,
        pass: true
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid UUID`,
        pass: false
      };
    }
  },
  
  toBeValidTimestamp(received: string) {
    const date = new Date(received);
    const pass = date instanceof Date && !isNaN(date.getTime());
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid timestamp`,
        pass: true
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid timestamp`,
        pass: false
      };
    }
  }
});

// Extend global types for TypeScript
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidUUID(): R;
      toBeValidTimestamp(): R;
    }
  }
  
  var mockUser: any;
  var mockVM: any;
  var mockContainer: any;
}