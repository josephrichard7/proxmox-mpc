/**
 * Test Utilities and Helpers for React Component Testing
 * Provides wrapped render functions and custom queries
 */

import React from 'react';
import { render as rtlRender, RenderOptions, RenderResult } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../stores/AuthContext';
import { WebSocketProvider } from '../stores/WebSocketContext';
import { theme } from '../theme/theme';

// Custom render function that includes all providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialEntries?: string[];
  queryClient?: QueryClient;
}

export function render(
  ui: React.ReactElement,
  {
    initialEntries = ['/'],
    queryClient = createTestQueryClient(),
    ...renderOptions
  }: CustomRenderOptions = {}
): RenderResult {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <MantineProvider theme={theme}>
        <Notifications />
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={initialEntries}>
            <AuthProvider>
              <WebSocketProvider>
                {children}
              </WebSocketProvider>
            </AuthProvider>
          </MemoryRouter>
        </QueryClientProvider>
      </MantineProvider>
    );
  }

  return rtlRender(ui, { wrapper: Wrapper, ...renderOptions });
}

// Create a test query client with disabled retries and logging
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        cacheTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
    logger: {
      log: () => {},
      warn: () => {},
      error: () => {},
    },
  });
}

// Mock user for authentication tests
export const mockAuthUser = {
  id: '1',
  username: 'admin',
  email: 'admin@example.com',
  role: 'administrator' as const,
};

// Mock localStorage for authentication tests
export const mockLocalStorage = {
  getItem: jest.fn((key: string) => {
    if (key === 'auth-token') return 'mock-token';
    if (key === 'refresh-token') return 'mock-refresh-token';
    return null;
  }),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

// Setup localStorage mock
export function mockLocalStorageForAuth() {
  Object.defineProperty(window, 'localStorage', {
    value: mockLocalStorage,
    writable: true,
  });
}

// Clean up localStorage mock
export function cleanupLocalStorageMock() {
  jest.clearAllMocks();
}

// Custom assertions
export const customMatchers = {
  toHaveSuccessStatus: (received: HTMLElement) => {
    const hasSuccessClass = received.classList.contains('success') || 
                           received.classList.contains('mantine-Badge-root') ||
                           received.textContent?.toLowerCase().includes('running') ||
                           received.textContent?.toLowerCase().includes('online');
    
    return {
      pass: hasSuccessClass,
      message: () => `Expected element to have success status, but it didn't`,
    };
  },

  toHaveErrorStatus: (received: HTMLElement) => {
    const hasErrorClass = received.classList.contains('error') ||
                         received.classList.contains('danger') ||
                         received.textContent?.toLowerCase().includes('stopped') ||
                         received.textContent?.toLowerCase().includes('offline');
    
    return {
      pass: hasErrorClass,
      message: () => `Expected element to have error status, but it didn't`,
    };
  },
};

// Extend Jest matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toHaveSuccessStatus(): R;
      toHaveErrorStatus(): R;
    }
  }
}

// Wait for loading states to resolve
export const waitForLoadingToFinish = () => {
  return new Promise((resolve) => setTimeout(resolve, 0));
};

// Mock WebSocket events
export const mockWebSocketEvent = (type: string, data: any) => {
  const event = new MessageEvent('message', {
    data: JSON.stringify({ type, data }),
  });
  
  // Dispatch to all mock WebSocket instances
  const websockets = (global.WebSocket as any).instances || [];
  websockets.forEach((ws: any) => {
    if (ws.onmessage) ws.onmessage(event);
  });
};

// Re-export everything from React Testing Library
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';