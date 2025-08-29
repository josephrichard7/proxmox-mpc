/**
 * Test Setup Configuration for Proxmox-MPC Web Dashboard
 * Configures Jest, React Testing Library, and MSW for comprehensive testing
 */

import '@testing-library/jest-dom';
import { server } from './test-utils/mocks/server';
import { vi } from 'vitest';

// Mock WebSocket for testing
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.OPEN;
  onopen = vi.fn();
  onclose = vi.fn();
  onmessage = vi.fn();
  onerror = vi.fn();

  constructor() {
    setTimeout(() => {
      if (this.onopen) this.onopen({} as Event);
    }, 0);
  }

  send = vi.fn();
  close = vi.fn(() => {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) this.onclose({} as CloseEvent);
  });

  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  dispatchEvent = vi.fn();
}

// Global WebSocket mock
global.WebSocket = MockWebSocket as any;

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock fetch if not available
if (!global.fetch) {
  global.fetch = vi.fn();
}

// Establish API mocking before all tests
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

// Reset any request handlers that we may add during the tests,
// so they don't affect other tests
afterEach(() => server.resetHandlers());

// Clean up after the tests are finished
afterAll(() => server.close());

// Mock environment variables
process.env.REACT_APP_API_URL = 'http://localhost:3000';
process.env.REACT_APP_WS_URL = 'ws://localhost:3000';