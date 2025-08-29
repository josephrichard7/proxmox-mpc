/**
 * VM Management API Tests - Fixed Version
 * 
 * Comprehensive tests for VM management endpoints including
 * integration with ProxmoxClient and database operations.
 */

import request from 'supertest';
import express from 'express';
import { jest } from '@jest/globals';

// Mock dependencies before importing modules
jest.mock('../../../../api/proxmox-client');
jest.mock('../../../../database/client');
jest.mock('../../../../database/repositories/vm-repository');
jest.mock('../../../websocket/notification-service');

import vmRoutes from '../../routes/vms';
import { authMiddleware } from '../../middleware/auth';
import { errorHandler } from '../../middleware/error';
import { ProxmoxClient } from '../../../../api/proxmox-client';
import { DatabaseClient } from '../../../../database/client';
import { VMRepository } from '../../../../database/repositories/vm-repository';
import { getNotificationService } from '../../../websocket/notification-service';

// Test data
const mockUser = {
  id: 'test-user-123',
  username: 'testuser',
  email: 'test@example.com',
  role: 'user' as const,
  proxmoxServer: 'proxmox.test.local',
  createdAt: new Date()
};

const mockVM = {
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

// Mock implementations
const mockVMRepo = {
  count: jest.fn(),
  findMany: jest.fn(),
  findById: jest.fn(),
  findByName: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn()
};

const mockProxmoxClient = {
  getVMStatus: jest.fn(),
  createVM: jest.fn(),
  startVM: jest.fn(),
  shutdownVM: jest.fn(),
  rebootVM: jest.fn(),
  deleteVM: jest.fn()
};

const mockNotificationService = {
  broadcastOperationNotification: jest.fn(),
  broadcastVMStatusUpdate: jest.fn()
};

// Mock authentication middleware
const mockAuthMiddleware = (req: any, res: any, next: any) => {
  req.user = mockUser;
  next();
};

// Setup Express app for testing
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use(mockAuthMiddleware);
  app.use('/api/vms', vmRoutes);
  app.use(errorHandler);
  return app;
};

describe('VM Management API', () => {
  let app: express.Application;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock implementations
    (DatabaseClient.getInstance as jest.Mock).mockReturnValue({});
    (VMRepository as jest.Mock).mockImplementation(() => mockVMRepo);
    (ProxmoxClient as jest.Mock).mockImplementation(() => mockProxmoxClient);
    (getNotificationService as jest.Mock).mockReturnValue(mockNotificationService);
    
    app = createTestApp();
  });

  describe('GET /api/vms', () => {
    it('should return paginated list of VMs', async () => {
      const mockVMs = [mockVM];
      mockVMRepo.count.mockResolvedValue(1);
      mockVMRepo.findMany.mockResolvedValue(mockVMs);

      const response = await request(app)
        .get('/api/vms')
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.vms).toHaveLength(1);
      expect(response.body.data.vms[0]).toMatchObject({
        id: mockVM.id,
        name: mockVM.name,
        status: mockVM.status
      });
    });

    it('should handle database errors', async () => {
      mockVMRepo.count.mockRejectedValue(new Error('Database error'));

      await request(app)
        .get('/api/vms')
        .expect(500);
    });
  });

  describe('POST /api/vms', () => {
    const validVMData = {
      name: 'new-test-vm',
      node: 'pve',
      memory: 2048,
      cores: 2,
      disk: 20,
      description: 'New test VM'
    };

    it('should create VM successfully', async () => {
      const createdVM = { ...mockVM, id: 101, name: validVMData.name };
      mockVMRepo.findByName.mockResolvedValue(null);
      mockVMRepo.create.mockResolvedValue(createdVM);
      mockProxmoxClient.createVM.mockResolvedValue({
        upid: 'UPID:pve:123456',
        vmid: 101,
        node: 'pve'
      });

      const response = await request(app)
        .post('/api/vms')
        .send(validVMData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.vm.name).toBe(validVMData.name);
    });

    it('should validate required fields', async () => {
      await request(app)
        .post('/api/vms')
        .send({})
        .expect(400);
    });
  });
});