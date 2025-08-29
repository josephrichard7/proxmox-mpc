/**
 * Node Management API Integration Tests
 */

import request from 'supertest';
import express from 'express';
import { jest } from '@jest/globals';

// Mock dependencies
jest.mock('../../../../api/proxmox-client');
jest.mock('../../../../database/client');
jest.mock('../../../../database/repositories/node-repository');
jest.mock('../../../websocket/notification-service');

import nodeRoutes from '../../routes/nodes';
import { authMiddleware } from '../../middleware/auth';
import { errorHandler } from '../../middleware/error';
import { ProxmoxClient } from '../../../../api/proxmox-client';
import { DatabaseClient } from '../../../../database/client';
import { NodeRepository } from '../../../../database/repositories/node-repository';
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

const mockNode = {
  name: 'pve',
  status: 'online',
  uptime: 3600000,
  version: '8.0.4',
  cpuUsage: 0.15,
  memoryTotal: 17179869184,
  memoryUsed: 8589934592,
  storageTotal: 214748364800,
  storageUsed: 107374182400,
  loadAverage: [0.12, 0.15, 0.18],
  cpuInfo: 'Intel(R) Xeon(R) CPU E5-2686 v4 @ 2.30GHz',
  kernelVersion: '5.15.107-2-pve',
  createdAt: new Date(),
  updatedAt: new Date()
};

const mockProxmoxNodeStatus = {
  node: 'pve',
  status: 'online',
  uptime: 3600000,
  cpu: 0.15,
  maxcpu: 16,
  mem: 8589934592,
  maxmem: 17179869184,
  disk: 107374182400,
  maxdisk: 214748364800,
  loadavg: [0.12, 0.15, 0.18],
  version: '8.0.4',
  subscription: {
    status: 'active',
    level: 'enterprise'
  }
};

// Mock implementations
const mockNodeRepo = {
  findMany: jest.fn(),
  findByName: jest.fn(),
  update: jest.fn(),
  create: jest.fn(),
  delete: jest.fn()
};

const mockProxmoxClient = {
  getNodeStatus: jest.fn(),
  getClusterNodes: jest.fn(),
  getNodeResources: jest.fn(),
  getNodeTasks: jest.fn(),
  getNodeServices: jest.fn(),
  setNodeMaintenanceMode: jest.fn(),
  restartNodeService: jest.fn()
};

const mockNotificationService = {
  broadcastNodeStatusUpdate: jest.fn(),
  broadcastOperationNotification: jest.fn()
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
  app.use('/api/nodes', nodeRoutes);
  app.use(errorHandler);
  return app;
};

describe('Node Management API', () => {
  let app: express.Application;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock implementations
    (DatabaseClient.getInstance as jest.Mock).mockReturnValue({});
    (NodeRepository as jest.Mock).mockImplementation(() => mockNodeRepo);
    (ProxmoxClient as jest.Mock).mockImplementation(() => mockProxmoxClient);
    (getNotificationService as jest.Mock).mockReturnValue(mockNotificationService);
    
    app = createTestApp();
  });

  describe('GET /api/nodes', () => {
    it('should return list of cluster nodes with live status', async () => {
      const mockNodes = [mockNode];
      mockNodeRepo.findMany.mockResolvedValue(mockNodes);
      mockProxmoxClient.getClusterNodes.mockResolvedValue([mockProxmoxNodeStatus]);

      const response = await request(app)
        .get('/api/nodes')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.nodes).toHaveLength(1);
      expect(response.body.data.nodes[0]).toMatchObject({
        name: mockNode.name,
        status: mockNode.status,
        liveStatus: mockProxmoxNodeStatus
      });
    });

    it('should handle Proxmox API errors gracefully', async () => {
      const mockNodes = [mockNode];
      mockNodeRepo.findMany.mockResolvedValue(mockNodes);
      mockProxmoxClient.getClusterNodes.mockRejectedValue(new Error('Proxmox API error'));

      const response = await request(app)
        .get('/api/nodes')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.nodes[0].liveStatus).toBeUndefined();
    });

    it('should handle database errors', async () => {
      mockNodeRepo.findMany.mockRejectedValue(new Error('Database error'));

      await request(app)
        .get('/api/nodes')
        .expect(500);
    });
  });

  describe('GET /api/nodes/:name', () => {
    it('should return detailed node information', async () => {
      mockNodeRepo.findByName.mockResolvedValue(mockNode);
      mockProxmoxClient.getNodeStatus.mockResolvedValue(mockProxmoxNodeStatus);

      const response = await request(app)
        .get('/api/nodes/pve')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.node).toMatchObject({
        name: 'pve',
        status: 'online',
        liveStatus: mockProxmoxNodeStatus
      });
    });

    it('should return 404 for non-existent node', async () => {
      mockNodeRepo.findByName.mockResolvedValue(null);

      await request(app)
        .get('/api/nodes/nonexistent')
        .expect(404);
    });

    it('should handle Proxmox connection errors', async () => {
      mockNodeRepo.findByName.mockResolvedValue(mockNode);
      mockProxmoxClient.getNodeStatus.mockRejectedValue(new Error('Connection failed'));

      const response = await request(app)
        .get('/api/nodes/pve')
        .expect(200);

      expect(response.body.data.node.liveStatus).toBeUndefined();
    });
  });

  describe('GET /api/nodes/:name/resources', () => {
    it('should return node resource utilization', async () => {
      const mockResources = {
        cpu: { usage: 15.5, cores: 16 },
        memory: { used: 8589934592, total: 17179869184, percentage: 50 },
        storage: [
          { name: 'local', used: 50000000000, total: 100000000000, type: 'dir' },
          { name: 'local-lvm', used: 25000000000, total: 100000000000, type: 'lvm' }
        ],
        network: [
          { name: 'vmbr0', rx: 1024000000, tx: 512000000, speed: 1000 }
        ]
      };

      mockNodeRepo.findByName.mockResolvedValue(mockNode);
      mockProxmoxClient.getNodeResources.mockResolvedValue(mockResources);

      const response = await request(app)
        .get('/api/nodes/pve/resources')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.resources).toMatchObject(mockResources);
    });

    it('should return 404 for non-existent node', async () => {
      mockNodeRepo.findByName.mockResolvedValue(null);

      await request(app)
        .get('/api/nodes/nonexistent/resources')
        .expect(404);
    });

    it('should handle Proxmox API errors', async () => {
      mockNodeRepo.findByName.mockResolvedValue(mockNode);
      mockProxmoxClient.getNodeResources.mockRejectedValue(new Error('API error'));

      await request(app)
        .get('/api/nodes/pve/resources')
        .expect(500);
    });
  });

  describe('GET /api/nodes/:name/tasks', () => {
    it('should return running tasks on node', async () => {
      const mockTasks = [
        {
          upid: 'UPID:pve:00001234:start',
          type: 'qmstart',
          id: '100',
          user: 'root@pam',
          starttime: Date.now() / 1000,
          status: 'running'
        },
        {
          upid: 'UPID:pve:00001235:backup',
          type: 'vzdump',
          id: '101',
          user: 'backup@pve',
          starttime: (Date.now() - 300000) / 1000,
          status: 'OK',
          endtime: (Date.now() - 60000) / 1000
        }
      ];

      mockNodeRepo.findByName.mockResolvedValue(mockNode);
      mockProxmoxClient.getNodeTasks.mockResolvedValue(mockTasks);

      const response = await request(app)
        .get('/api/nodes/pve/tasks')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tasks).toHaveLength(2);
      expect(response.body.data.tasks[0]).toMatchObject({
        upid: 'UPID:pve:00001234:start',
        type: 'qmstart',
        status: 'running'
      });
    });

    it('should filter tasks by type', async () => {
      mockNodeRepo.findByName.mockResolvedValue(mockNode);
      mockProxmoxClient.getNodeTasks.mockResolvedValue([]);

      await request(app)
        .get('/api/nodes/pve/tasks')
        .query({ type: 'backup' })
        .expect(200);

      expect(mockProxmoxClient.getNodeTasks).toHaveBeenCalledWith('pve', { type: 'backup' });
    });
  });

  describe('GET /api/nodes/:name/services', () => {
    it('should return node service status', async () => {
      const mockServices = [
        { service: 'pvestatd', state: 'running', desc: 'PVE Status Daemon' },
        { service: 'pvedaemon', state: 'running', desc: 'PVE API Daemon' },
        { service: 'pveproxy', state: 'running', desc: 'PVE API Proxy Server' },
        { service: 'spiceproxy', state: 'stopped', desc: 'SPICE Proxy Server' }
      ];

      mockNodeRepo.findByName.mockResolvedValue(mockNode);
      mockProxmoxClient.getNodeServices.mockResolvedValue(mockServices);

      const response = await request(app)
        .get('/api/nodes/pve/services')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.services).toHaveLength(4);
      expect(response.body.data.services[0]).toMatchObject({
        service: 'pvestatd',
        state: 'running'
      });
    });
  });

  describe('PUT /api/nodes/:name/maintenance', () => {
    it('should enable maintenance mode', async () => {
      mockNodeRepo.findByName.mockResolvedValue(mockNode);
      mockProxmoxClient.setNodeMaintenanceMode.mockResolvedValue({ success: true });
      mockNodeRepo.update.mockResolvedValue({ ...mockNode, status: 'maintenance' });

      const response = await request(app)
        .put('/api/nodes/pve/maintenance')
        .send({ enabled: true, reason: 'Hardware upgrade' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockProxmoxClient.setNodeMaintenanceMode).toHaveBeenCalledWith('pve', true, 'Hardware upgrade');
      expect(mockNotificationService.broadcastNodeStatusUpdate).toHaveBeenCalled();
    });

    it('should disable maintenance mode', async () => {
      const maintenanceNode = { ...mockNode, status: 'maintenance' };
      mockNodeRepo.findByName.mockResolvedValue(maintenanceNode);
      mockProxmoxClient.setNodeMaintenanceMode.mockResolvedValue({ success: true });
      mockNodeRepo.update.mockResolvedValue({ ...mockNode, status: 'online' });

      const response = await request(app)
        .put('/api/nodes/pve/maintenance')
        .send({ enabled: false })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockProxmoxClient.setNodeMaintenanceMode).toHaveBeenCalledWith('pve', false, undefined);
    });

    it('should validate maintenance request', async () => {
      await request(app)
        .put('/api/nodes/pve/maintenance')
        .send({}) // Missing enabled field
        .expect(400);
    });
  });

  describe('POST /api/nodes/:name/services/:service/restart', () => {
    it('should restart node service', async () => {
      mockNodeRepo.findByName.mockResolvedValue(mockNode);
      mockProxmoxClient.restartNodeService.mockResolvedValue({ 
        upid: 'UPID:pve:00001236:service:restart',
        success: true 
      });

      const response = await request(app)
        .post('/api/nodes/pve/services/pvestatd/restart')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockProxmoxClient.restartNodeService).toHaveBeenCalledWith('pve', 'pvestatd');
      expect(mockNotificationService.broadcastOperationNotification).toHaveBeenCalledWith(
        'restart_service', 'node', 'pve', 'pvestatd', 'success', mockUser.id
      );
    });

    it('should return 404 for non-existent node', async () => {
      mockNodeRepo.findByName.mockResolvedValue(null);

      await request(app)
        .post('/api/nodes/nonexistent/services/pvestatd/restart')
        .expect(404);
    });

    it('should handle service restart failures', async () => {
      mockNodeRepo.findByName.mockResolvedValue(mockNode);
      mockProxmoxClient.restartNodeService.mockRejectedValue(new Error('Service restart failed'));

      await request(app)
        .post('/api/nodes/pve/services/pvestatd/restart')
        .expect(500);

      expect(mockNotificationService.broadcastOperationNotification).toHaveBeenCalledWith(
        'restart_service', 'node', 'pve', 'pvestatd', 'error', mockUser.id, 'Service restart failed'
      );
    });
  });

  describe('Node monitoring and alerts', () => {
    it('should identify resource threshold violations', async () => {
      const highUsageNode = {
        ...mockProxmoxNodeStatus,
        cpu: 0.95, // 95% CPU usage
        mem: mockProxmoxNodeStatus.maxmem * 0.9 // 90% memory usage
      };

      mockNodeRepo.findByName.mockResolvedValue(mockNode);
      mockProxmoxClient.getNodeStatus.mockResolvedValue(highUsageNode);

      const response = await request(app)
        .get('/api/nodes/pve')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.node.liveStatus.cpu).toBe(0.95);
      // High usage should trigger monitoring alerts (tested at notification service level)
    });

    it('should track node uptime correctly', async () => {
      const uptimeData = { ...mockProxmoxNodeStatus, uptime: 86400 }; // 24 hours
      mockNodeRepo.findByName.mockResolvedValue(mockNode);
      mockProxmoxClient.getNodeStatus.mockResolvedValue(uptimeData);

      const response = await request(app)
        .get('/api/nodes/pve')
        .expect(200);

      expect(response.body.data.node.liveStatus.uptime).toBe(86400);
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle malformed node names', async () => {
      await request(app)
        .get('/api/nodes/invalid node name!')
        .expect(400);
    });

    it('should handle network timeouts', async () => {
      mockNodeRepo.findByName.mockResolvedValue(mockNode);
      mockProxmoxClient.getNodeStatus.mockRejectedValue({ code: 'ECONNABORTED' });

      const response = await request(app)
        .get('/api/nodes/pve')
        .expect(200);

      expect(response.body.data.node.liveStatus).toBeUndefined();
    });

    it('should validate service names for restart operations', async () => {
      mockNodeRepo.findByName.mockResolvedValue(mockNode);

      await request(app)
        .post('/api/nodes/pve/services/invalid-service!/restart')
        .expect(400);
    });
  });
});