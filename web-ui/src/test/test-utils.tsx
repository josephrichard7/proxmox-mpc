/**
 * Test utilities for React component testing with all required providers
 */

import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { BrowserRouter } from 'react-router-dom';
import { ReactElement, ReactNode } from 'react';
import { AuthProvider } from '../stores/AuthContext';
import { WebSocketProvider } from '../stores/WebSocketContext';
import theme from '../theme';

// Mock WebSocket for testing
const mockWebSocket = {
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  connected: false,
  connect: vi.fn(),
  disconnect: vi.fn()
};

// Mock authentication context value
export const mockAuthUser = {
  id: 'test-user-123',
  username: 'testuser',
  email: 'test@example.com',
  role: 'admin' as const,
  proxmoxServer: 'test.proxmox.local',
  createdAt: new Date('2024-01-01T00:00:00.000Z')
};

// Create a test query client
const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

interface AllTheProvidersProps {
  children: ReactNode;
  queryClient?: QueryClient;
  authenticated?: boolean;
  authUser?: typeof mockAuthUser;
}

// Wrapper component with all providers
function AllTheProviders({ 
  children, 
  queryClient = createTestQueryClient(),
  authenticated = true,
  authUser = mockAuthUser 
}: AllTheProvidersProps) {
  const mockAuthValue = {
    user: authenticated ? authUser : null,
    isAuthenticated: authenticated,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    refreshToken: vi.fn()
  };

  const mockWebSocketValue = {
    socket: mockWebSocket,
    connected: false,
    connect: vi.fn(),
    disconnect: vi.fn()
  };

  return (
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme}>
        <Notifications />
        <BrowserRouter>
          <AuthProvider value={mockAuthValue}>
            <WebSocketProvider value={mockWebSocketValue}>
              {children}
            </WebSocketProvider>
          </AuthProvider>
        </BrowserRouter>
      </MantineProvider>
    </QueryClientProvider>
  );
}

// Custom render function with providers
const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'> & {
    queryClient?: QueryClient;
    authenticated?: boolean;
    authUser?: typeof mockAuthUser;
  }
) => {
  const { queryClient, authenticated, authUser, ...renderOptions } = options || {};
  
  return render(ui, {
    wrapper: ({ children }) => (
      <AllTheProviders
        queryClient={queryClient}
        authenticated={authenticated}
        authUser={authUser}
      >
        {children}
      </AllTheProviders>
    ),
    ...renderOptions,
  });
};

// Mock API responses
export const mockVMResponse = {
  success: true,
  data: {
    vms: [
      {
        id: 100,
        name: 'test-vm-01',
        description: 'Test VM 1',
        node: 'pve',
        status: 'running',
        template: false,
        memory: 2048,
        cores: 2,
        disk: 20,
        uptime: 3600,
        cpuUsage: 12.5,
        memoryUsage: 1024,
        diskUsage: 15.2,
        networkIn: 1024000,
        networkOut: 2048000,
        tags: ['production', 'web'],
        startOnBoot: true,
        protection: false,
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        updatedAt: new Date('2024-01-02T00:00:00.000Z')
      },
      {
        id: 101,
        name: 'test-vm-02',
        description: 'Test VM 2',
        node: 'pve',
        status: 'stopped',
        template: false,
        memory: 4096,
        cores: 4,
        disk: 50,
        uptime: 0,
        cpuUsage: 0,
        memoryUsage: 0,
        diskUsage: 0,
        networkIn: 0,
        networkOut: 0,
        tags: ['development'],
        startOnBoot: false,
        protection: false,
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        updatedAt: new Date('2024-01-02T00:00:00.000Z')
      }
    ],
    pagination: {
      page: 1,
      limit: 10,
      total: 2,
      totalPages: 1
    }
  }
};

export const mockNodeResponse = {
  success: true,
  data: {
    nodes: [
      {
        node: 'pve',
        status: 'online',
        uptime: 3600000,
        cpu: 0.15,
        memory: {
          used: 8589934592,
          total: 17179869184
        },
        storage: {
          used: 107374182400,
          total: 214748364800
        },
        version: '8.0.4',
        type: 'node'
      }
    ]
  }
};

// Mock API service responses
export const mockApiService = {
  auth: {
    login: vi.fn().mockResolvedValue({ 
      success: true, 
      data: { 
        token: 'mock-token',
        user: mockAuthUser
      } 
    }),
    logout: vi.fn().mockResolvedValue({ success: true }),
    refreshToken: vi.fn().mockResolvedValue({ 
      success: true, 
      data: { token: 'new-mock-token' } 
    })
  },
  vms: {
    getVMs: vi.fn().mockResolvedValue(mockVMResponse),
    getVM: vi.fn().mockResolvedValue({
      success: true,
      data: { vm: mockVMResponse.data.vms[0] }
    }),
    createVM: vi.fn().mockResolvedValue({
      success: true,
      data: { vm: mockVMResponse.data.vms[0] }
    }),
    updateVM: vi.fn().mockResolvedValue({
      success: true,
      data: { vm: mockVMResponse.data.vms[0] }
    }),
    deleteVM: vi.fn().mockResolvedValue({ success: true }),
    startVM: vi.fn().mockResolvedValue({ success: true }),
    stopVM: vi.fn().mockResolvedValue({ success: true }),
    restartVM: vi.fn().mockResolvedValue({ success: true })
  },
  nodes: {
    getNodes: vi.fn().mockResolvedValue(mockNodeResponse)
  }
};

// Export everything needed for testing
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
export { customRender as render, createTestQueryClient, mockWebSocket };