/**
 * Container Management API Integration Tests
 */

import request from 'supertest';
import express from 'express';
import { jest } from '@jest/globals';

// Mock dependencies
jest.mock('../../../../api/proxmox-client');
jest.mock('../../../../database/client');
jest.mock('../../../../database/repositories/container-repository');
jest.mock('../../../websocket/notification-service');

import containerRoutes from '../../routes/containers';
import { authMiddleware } from '../../middleware/auth';
import { errorHandler } from '../../middleware/error';
import { ProxmoxClient } from '../../../../api/proxmox-client';
import { DatabaseClient } from '../../../../database/client';
import { ContainerRepository } from '../../../../database/repositories/container-repository';
import { getNotificationService } from '../../../websocket/notification-service';

// Test data
const mockUser = {
  id: 'test-user-123',
  username: 'testuser',
  email: 'test@example.com',
  role: 'admin' as const,
  proxmoxServer: 'proxmox.test.local',
  createdAt: new Date()
};

const mockContainer = {
  id: 200,
  name: 'test-container',
  description: 'Test Container',
  node: 'pve',
  status: 'stopped',
  template: 'ubuntu-22.04-standard',
  memory: 512,
  cores: 1,
  disk: 8,
  uptime: 0,
  cpuUsage: 0,
  memoryUsage: 0,
  diskUsage: 0,
  networkIn: 0,
  networkOut: 0,
  tags: ['test'],
  startOnBoot: false,
  protection: false,
  unprivileged: true,
  createdAt: new Date(),
  updatedAt: new Date()
};

// Mock implementations
const mockContainerRepo = {
  count: jest.fn(),
  findMany: jest.fn(),
  findById: jest.fn(),
  findByName: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn()
};

const mockProxmoxClient = {
  getContainerStatus: jest.fn(),
  createContainer: jest.fn(),
  startContainer: jest.fn(),
  shutdownContainer: jest.fn(),
  rebootContainer: jest.fn(),
  deleteContainer: jest.fn(),
  waitForContainerStatus: jest.fn()
};

const mockNotificationService = {
  broadcastOperationNotification: jest.fn(),
  broadcastContainerStatusUpdate: jest.fn()
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
  app.use('/api/containers', containerRoutes);
  app.use(errorHandler);
  return app;
};

describe('Container Management API', () => {
  let app: express.Application;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock implementations
    (DatabaseClient.getInstance as jest.Mock).mockReturnValue({});
    (ContainerRepository as jest.Mock).mockImplementation(() => mockContainerRepo);
    (ProxmoxClient as jest.Mock).mockImplementation(() => mockProxmoxClient);
    (getNotificationService as jest.Mock).mockReturnValue(mockNotificationService);
    
    app = createTestApp();
  });

  describe('GET /api/containers', () => {
    it('should return paginated list of containers', async () => {
      mockContainerRepo.count.mockResolvedValue(1);
      mockContainerRepo.findMany.mockResolvedValue([mockContainer]);

      const response = await request(app)
        .get('/api/containers')
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.containers).toHaveLength(1);
      expect(response.body.data.containers[0]).toMatchObject({
        id: mockContainer.id,
        name: mockContainer.name,
        status: mockContainer.status
      });
    });

    it('should filter containers by template', async () => {
      mockContainerRepo.count.mockResolvedValue(1);
      mockContainerRepo.findMany.mockResolvedValue([mockContainer]);

      await request(app)
        .get('/api/containers')
        .query({ template: 'ubuntu' })
        .expect(200);

      expect(mockContainerRepo.findMany).toHaveBeenCalledWith({
        where: { template: { contains: 'ubuntu' } },
        skip: 0,
        take: 10,
        orderBy: { id: 'asc' }
      });
    });

    it('should handle database errors', async () => {
      mockContainerRepo.count.mockRejectedValue(new Error('Database error'));

      await request(app)
        .get('/api/containers')
        .expect(500);
    });
  });

  describe('GET /api/containers/:id', () => {
    it('should return container details with live status', async () => {
      const mockLiveStatus = {
        vmid: 200,
        node: 'pve',
        status: 'running',
        uptime: 1800,
        cpu: 0.05,
        mem: 268435456
      };

      mockContainerRepo.findById.mockResolvedValue(mockContainer);
      mockProxmoxClient.getContainerStatus.mockResolvedValue(mockLiveStatus);

      const response = await request(app)
        .get('/api/containers/200')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.container).toMatchObject({
        id: 200,
        name: 'test-container',
        liveStatus: mockLiveStatus
      });
    });

    it('should return 404 for non-existent container', async () => {
      mockContainerRepo.findById.mockResolvedValue(null);

      await request(app)
        .get('/api/containers/999')
        .expect(404);
    });
  });

  describe('POST /api/containers', () => {
    const validContainerData = {
      name: 'new-test-container',
      node: 'pve',
      template: 'ubuntu-22.04-standard',
      memory: 512,
      cores: 1,
      disk: 8,
      description: 'New test container'
    };

    it('should create container successfully', async () => {
      const createdContainer = { ...mockContainer, id: 201, name: validContainerData.name };
      mockContainerRepo.findByName.mockResolvedValue(null);
      mockContainerRepo.create.mockResolvedValue(createdContainer);
      mockProxmoxClient.createContainer.mockResolvedValue({
        upid: 'UPID:pve:123456',
        vmid: 201,
        node: 'pve',
        task: { upid: 'UPID:pve:123456' }
      });

      const response = await request(app)
        .post('/api/containers')
        .send(validContainerData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.container.name).toBe(validContainerData.name);
      expect(mockNotificationService.broadcastOperationNotification).toHaveBeenCalledWith(
        'create', 'container', 201, validContainerData.name, 'success', mockUser.id
      );
    });

    it('should reject duplicate container names', async () => {
      mockContainerRepo.findByName.mockResolvedValue(mockContainer);

      await request(app)
        .post('/api/containers')
        .send(validContainerData)
        .expect(400);
    });

    it('should validate required fields', async () => {
      await request(app)
        .post('/api/containers')
        .send({})
        .expect(400);
    });

    it('should handle Proxmox creation failure', async () => {
      const createdContainer = { ...mockContainer, id: 201, name: validContainerData.name };
      mockContainerRepo.findByName.mockResolvedValue(null);
      mockContainerRepo.create.mockResolvedValue(createdContainer);
      mockContainerRepo.delete.mockResolvedValue(undefined);
      mockProxmoxClient.createContainer.mockRejectedValue(new Error('Proxmox error'));

      await request(app)
        .post('/api/containers')
        .send(validContainerData)
        .expect(500);

      expect(mockContainerRepo.delete).toHaveBeenCalledWith('201');
      expect(mockNotificationService.broadcastOperationNotification).toHaveBeenCalledWith(
        'create', 'container', 201, validContainerData.name, 'error', mockUser.id, 'Proxmox error'
      );
    });
  });

  describe('PUT /api/containers/:id', () => {
    const updateData = {
      name: 'updated-container',
      memory: 1024,
      cores: 2
    };

    it('should update container successfully', async () => {
      const updatedContainer = { ...mockContainer, ...updateData };
      mockContainerRepo.findById.mockResolvedValue(mockContainer);
      mockContainerRepo.findByName.mockResolvedValue(null);
      mockContainerRepo.update.mockResolvedValue(updatedContainer);

      const response = await request(app)
        .put('/api/containers/200')
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.container.name).toBe(updateData.name);
    });

    it('should return 404 for non-existent container', async () => {
      mockContainerRepo.findById.mockResolvedValue(null);

      await request(app)
        .put('/api/containers/999')
        .send(updateData)
        .expect(404);
    });
  });

  describe('DELETE /api/containers/:id', () => {
    it('should delete container successfully', async () => {
      mockContainerRepo.findById.mockResolvedValue(mockContainer);
      mockProxmoxClient.getContainerStatus.mockResolvedValue({ status: 'stopped' });
      mockProxmoxClient.deleteContainer.mockResolvedValue({ upid: 'UPID:pve:delete' });
      mockContainerRepo.delete.mockResolvedValue(undefined);

      const response = await request(app)
        .delete('/api/containers/200')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockContainerRepo.delete).toHaveBeenCalledWith('200');
    });

    it('should reject deletion of protected container', async () => {
      const protectedContainer = { ...mockContainer, protection: true };
      mockContainerRepo.findById.mockResolvedValue(protectedContainer);

      await request(app)
        .delete('/api/containers/200')
        .expect(400);
    });

    it('should return 404 for non-existent container', async () => {
      mockContainerRepo.findById.mockResolvedValue(null);

      await request(app)
        .delete('/api/containers/999')
        .expect(404);
    });
  });

  describe('Container lifecycle operations', () => {
    describe('POST /api/containers/:id/start', () => {
      it('should start container successfully', async () => {
        mockContainerRepo.findById.mockResolvedValue(mockContainer);
        mockContainerRepo.update.mockResolvedValue({ ...mockContainer, status: 'running' });
        mockProxmoxClient.startContainer.mockResolvedValue({ upid: 'UPID:pve:start' });

        const response = await request(app)
          .post('/api/containers/200/start')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(mockNotificationService.broadcastOperationNotification).toHaveBeenCalledWith(
          'start', 'container', 200, mockContainer.name, 'success', mockUser.id
        );
        expect(mockNotificationService.broadcastContainerStatusUpdate).toHaveBeenCalled();
      });

      it('should reject starting already running container', async () => {
        const runningContainer = { ...mockContainer, status: 'running' };
        mockContainerRepo.findById.mockResolvedValue(runningContainer);

        await request(app)
          .post('/api/containers/200/start')
          .expect(400);
      });
    });

    describe('POST /api/containers/:id/stop', () => {
      it('should stop container successfully', async () => {
        const runningContainer = { ...mockContainer, status: 'running' };
        mockContainerRepo.findById.mockResolvedValue(runningContainer);
        mockContainerRepo.update.mockResolvedValue({ ...mockContainer, status: 'stopped' });
        mockProxmoxClient.shutdownContainer.mockResolvedValue({ upid: 'UPID:pve:stop' });

        const response = await request(app)
          .post('/api/containers/200/stop')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(mockNotificationService.broadcastOperationNotification).toHaveBeenCalledWith(
          'stop', 'container', 200, mockContainer.name, 'success', mockUser.id
        );
      });

      it('should reject stopping already stopped container', async () => {
        mockContainerRepo.findById.mockResolvedValue(mockContainer);

        await request(app)
          .post('/api/containers/200/stop')
          .expect(400);
      });
    });

    describe('POST /api/containers/:id/restart', () => {
      it('should restart container successfully', async () => {
        mockContainerRepo.findById.mockResolvedValue(mockContainer);
        mockContainerRepo.update.mockResolvedValue({ ...mockContainer, status: 'running' });
        mockProxmoxClient.rebootContainer.mockResolvedValue({ upid: 'UPID:pve:restart' });

        const response = await request(app)
          .post('/api/containers/200/restart')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(mockNotificationService.broadcastOperationNotification).toHaveBeenCalledWith(
          'restart', 'container', 200, mockContainer.name, 'success', mockUser.id
        );
      });

      it('should return 404 for non-existent container', async () => {
        mockContainerRepo.findById.mockResolvedValue(null);

        await request(app)
          .post('/api/containers/999/restart')
          .expect(404);
      });
    });
  });

  describe('Container-specific features', () => {
    it('should handle unprivileged container operations', async () => {
      const unprivilegedContainer = { ...mockContainer, unprivileged: true };
      mockContainerRepo.findById.mockResolvedValue(unprivilegedContainer);
      mockContainerRepo.update.mockResolvedValue({ ...unprivilegedContainer, status: 'running' });
      mockProxmoxClient.startContainer.mockResolvedValue({ upid: 'UPID:pve:start' });

      await request(app)
        .post('/api/containers/200/start')
        .expect(200);

      expect(mockProxmoxClient.startContainer).toHaveBeenCalledWith(200);
    });

    it('should handle template-based filtering', async () => {
      mockContainerRepo.count.mockResolvedValue(1);
      mockContainerRepo.findMany.mockResolvedValue([mockContainer]);

      await request(app)
        .get('/api/containers')
        .query({ template: 'ubuntu-22.04-standard' })
        .expect(200);

      expect(mockContainerRepo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            template: { contains: 'ubuntu-22.04-standard' }
          })
        })
      );
    });
  });
});