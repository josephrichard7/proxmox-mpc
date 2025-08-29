/**
 * Mock Service Worker (MSW) server setup for API mocking
 * Provides comprehensive API mocking for testing
 */

import { setupServer } from 'msw/node';
import { rest } from 'msw';

// Mock data
const mockVMs = [
  {
    id: 'vm-001',
    name: 'test-vm-01',
    status: 'running',
    node: 'pve-01',
    cores: 2,
    memory: 4096,
    disk: 50,
    template: false,
    created: '2024-08-01T10:00:00Z'
  },
  {
    id: 'vm-002', 
    name: 'test-vm-02',
    status: 'stopped',
    node: 'pve-02',
    cores: 4,
    memory: 8192,
    disk: 100,
    template: false,
    created: '2024-08-01T11:00:00Z'
  }
];

const mockContainers = [
  {
    id: 'ct-001',
    name: 'test-ct-01',
    status: 'running',
    node: 'pve-01',
    cores: 1,
    memory: 1024,
    disk: 20,
    template: 'ubuntu-22.04',
    created: '2024-08-01T12:00:00Z'
  }
];

const mockNodes = [
  {
    name: 'pve-01',
    status: 'online',
    cpu: 45.2,
    memory: 62.8,
    disk: 78.3,
    uptime: 1234567,
    load: [0.45, 0.52, 0.38],
    version: 'pve-manager/8.0.3'
  },
  {
    name: 'pve-02', 
    status: 'online',
    cpu: 23.1,
    memory: 41.5,
    disk: 56.7,
    uptime: 987654,
    load: [0.23, 0.21, 0.19],
    version: 'pve-manager/8.0.3'
  }
];

const mockInfrastructureStatus = {
  vms: {
    total: 2,
    running: 1,
    stopped: 1
  },
  containers: {
    total: 1,
    running: 1,
    stopped: 0
  },
  nodes: {
    total: 2,
    online: 2,
    offline: 0
  },
  resources: {
    cpu: 34.2,
    memory: 52.1,
    storage: 67.5
  }
};

const mockUser = {
  id: '1',
  username: 'admin',
  email: 'admin@example.com',
  role: 'administrator'
};

// Request handlers
export const handlers = [
  // Authentication endpoints
  rest.post('http://localhost:3000/api/auth/login', (req, res, ctx) => {
    return res(
      ctx.json({
        success: true,
        data: {
          user: mockUser,
          token: 'mock-jwt-token',
          refreshToken: 'mock-refresh-token'
        }
      })
    );
  }),

  rest.post('http://localhost:3000/api/auth/refresh', (req, res, ctx) => {
    return res(
      ctx.json({
        success: true,
        data: {
          token: 'new-mock-jwt-token',
          refreshToken: 'new-mock-refresh-token'
        }
      })
    );
  }),

  rest.get('http://localhost:3000/api/auth/profile', (req, res, ctx) => {
    return res(ctx.json({ success: true, data: mockUser }));
  }),

  // VM endpoints
  rest.get('http://localhost:3000/api/vms', (req, res, ctx) => {
    return res(ctx.json({ success: true, data: mockVMs }));
  }),

  rest.get('http://localhost:3000/api/vms/:id', (req, res, ctx) => {
    const { id } = req.params;
    const vm = mockVMs.find(v => v.id === id);
    if (!vm) {
      return res(ctx.status(404), ctx.json({ success: false, error: 'VM not found' }));
    }
    return res(ctx.json({ success: true, data: vm }));
  }),

  rest.post('http://localhost:3000/api/vms', (req, res, ctx) => {
    return res(
      ctx.status(201),
      ctx.json({
        success: true,
        data: { ...mockVMs[0], id: 'vm-new', name: 'new-vm' }
      })
    );
  }),

  rest.delete('http://localhost:3000/api/vms/:id', (req, res, ctx) => {
    return res(ctx.json({ success: true, message: 'VM deleted successfully' }));
  }),

  // Container endpoints  
  rest.get('http://localhost:3000/api/containers', (req, res, ctx) => {
    return res(ctx.json({ success: true, data: mockContainers }));
  }),

  rest.post('http://localhost:3000/api/containers', (req, res, ctx) => {
    return res(
      ctx.status(201),
      ctx.json({
        success: true,
        data: { ...mockContainers[0], id: 'ct-new', name: 'new-container' }
      })
    );
  }),

  // Node endpoints
  rest.get('http://localhost:3000/api/nodes', (req, res, ctx) => {
    return res(ctx.json({ success: true, data: mockNodes }));
  }),

  // Infrastructure endpoints
  rest.get('http://localhost:3000/api/infrastructure/status', (req, res, ctx) => {
    return res(ctx.json({ success: true, data: mockInfrastructureStatus }));
  }),

  // File management endpoints
  rest.get('http://localhost:3000/api/infrastructure/files', (req, res, ctx) => {
    return res(
      ctx.json({
        success: true,
        data: {
          terraform: ['main.tf', 'variables.tf'],
          ansible: ['site.yml', 'inventory.yml']
        }
      })
    );
  }),

  // Template endpoints
  rest.get('http://localhost:3000/api/templates', (req, res, ctx) => {
    return res(
      ctx.json({
        success: true,
        data: [
          {
            id: 'template-001',
            name: 'Ubuntu Server',
            category: 'linux',
            description: 'Ubuntu 22.04 LTS server template'
          }
        ]
      })
    );
  }),

  // Error handler for unhandled requests
  rest.get('*', (req, res, ctx) => {
    console.error(`Unhandled ${req.method} request to ${req.url}`);
    return res(ctx.status(404), ctx.json({ success: false, error: 'Not found' }));
  })
];

export const server = setupServer(...handlers);