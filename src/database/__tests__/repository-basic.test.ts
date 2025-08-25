/**
 * Basic repository functionality tests
 */

import { dbClient } from '../client';
import { DatabaseTestHelper } from '../../__tests__/utils/database-test-helper';
import { NodeRepository } from '../repositories/node-repository';
import { VMRepository } from '../repositories/vm-repository';

describe('Basic Repository Tests', () => {
  let nodeRepo: NodeRepository;
  let vmRepo: VMRepository;

  beforeAll(async () => {
    await DatabaseTestHelper.ensureConnection();
    nodeRepo = new NodeRepository();
    vmRepo = new VMRepository();
  });

  beforeEach(async () => {
    // Clean database before each test to ensure isolation
    await DatabaseTestHelper.cleanupDatabase();
  });

  afterAll(async () => {
    await DatabaseTestHelper.closeConnection();
  });

  describe('Node Repository', () => {
    it('should create and retrieve a node', async () => {
      const nodeData = {
        id: 'test-node',
        status: 'online'
      };

      const created = await nodeRepo.create(nodeData);
      expect(created.id).toBe('test-node');
      expect(created.status).toBe('online');

      const retrieved = await nodeRepo.findById('test-node');
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe('test-node');
    });

    it('should count nodes', async () => {
      await nodeRepo.create({ id: 'node1', status: 'online' });
      await nodeRepo.create({ id: 'node2', status: 'offline' });

      const count = await nodeRepo.count();
      expect(count).toBe(2);
    });

    it('should check if node exists', async () => {
      await nodeRepo.create({ id: 'exists-test', status: 'online' });

      const exists = await nodeRepo.exists('exists-test');
      const notExists = await nodeRepo.exists('not-exists');

      expect(exists).toBe(true);
      expect(notExists).toBe(false);
    });

    it('should update node', async () => {
      await nodeRepo.create({ id: 'update-test', status: 'online' });

      const updated = await nodeRepo.update('update-test', { status: 'offline' });
      expect(updated.status).toBe('offline');
    });

    it('should delete node', async () => {
      await nodeRepo.create({ id: 'delete-test', status: 'online' });

      await nodeRepo.delete('delete-test');

      const retrieved = await nodeRepo.findById('delete-test');
      expect(retrieved).toBeNull();
    });
  });

  describe('VM Repository', () => {
    beforeEach(async () => {
      // Create parent node for VMs
      await nodeRepo.create({ id: 'vm-node', status: 'online' });
    });

    it('should create VM with node relationship', async () => {
      const vmData = {
        id: 100,
        nodeId: 'vm-node',
        status: 'running'
      };

      const created = await vmRepo.create(vmData);
      expect(created.id).toBe(100);
      expect(created.nodeId).toBe('vm-node');
      expect(created.status).toBe('running');
    });

    it('should find VMs by node', async () => {
      await vmRepo.create({ id: 100, nodeId: 'vm-node', status: 'running' });
      await vmRepo.create({ id: 101, nodeId: 'vm-node', status: 'stopped' });

      const nodeVMs = await vmRepo.findByNode('vm-node');
      expect(nodeVMs).toHaveLength(2);
    });

    it('should find VMs by status', async () => {
      await vmRepo.create({ id: 100, nodeId: 'vm-node', status: 'running' });
      await vmRepo.create({ id: 101, nodeId: 'vm-node', status: 'stopped' });

      const runningVMs = await vmRepo.findByStatus('running');
      expect(runningVMs).toHaveLength(1);
      expect(runningVMs[0].status).toBe('running');
    });
  });

  describe('Health Checks', () => {
    it('should pass health checks', async () => {
      const nodeHealth = await nodeRepo.health();
      const vmHealth = await vmRepo.health();

      expect(nodeHealth.status).toBe('healthy');
      expect(vmHealth.status).toBe('healthy');
    });
  });
});