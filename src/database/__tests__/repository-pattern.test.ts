/**
 * Repository pattern comprehensive tests
 */

import { dbClient } from '../client';
import {
  RepositoryFactory,
  NodeRepository,
  VMRepository,
  ContainerRepository,
  StorageRepository,
  TaskRepository,
  StateSnapshotRepository,
  NotFoundError,
  ValidationError,
  ConflictError
} from '../repositories';

describe('Repository Pattern Tests', () => {
  let nodeRepo: NodeRepository;
  let vmRepo: VMRepository;
  let containerRepo: ContainerRepository;
  let storageRepo: StorageRepository;
  let taskRepo: TaskRepository;
  let stateSnapshotRepo: StateSnapshotRepository;

  beforeAll(() => {
    nodeRepo = RepositoryFactory.getNodeRepository();
    vmRepo = RepositoryFactory.getVMRepository();
    containerRepo = RepositoryFactory.getContainerRepository();
    storageRepo = RepositoryFactory.getStorageRepository();
    taskRepo = RepositoryFactory.getTaskRepository();
    stateSnapshotRepo = RepositoryFactory.getStateSnapshotRepository();
  });

  afterAll(async () => {
    await dbClient.disconnect();
  });

  beforeEach(async () => {
    // Clean up test data - order matters for foreign keys
    await dbClient.client.stateSnapshot.deleteMany();
    await dbClient.client.task.deleteMany();
    await dbClient.client.vM.deleteMany();
    await dbClient.client.container.deleteMany();
    await dbClient.client.node.deleteMany();
    await dbClient.client.storage.deleteMany();
  });

  describe('Repository Factory', () => {
    it('should provide singleton instances', () => {
      const repo1 = RepositoryFactory.getNodeRepository();
      const repo2 = RepositoryFactory.getNodeRepository();
      expect(repo1).toBe(repo2);
    });

    it('should provide health check for all repositories', async () => {
      const health = await RepositoryFactory.healthCheck();
      
      expect(health.status).toBe('healthy');
      expect(health.repositories).toHaveProperty('nodes');
      expect(health.repositories).toHaveProperty('vms');
      expect(health.repositories).toHaveProperty('containers');
      expect(health.repositories).toHaveProperty('storage');
      expect(health.repositories).toHaveProperty('tasks');
      expect(health.repositories).toHaveProperty('stateSnapshots');
    });
  });

  describe('Node Repository', () => {
    it('should create and retrieve a node', async () => {
      const nodeData = {
        id: 'test-node',
        status: 'online',
        type: 'pve',
        cpuUsage: 0.25,
        cpuMax: 4,
        memoryUsage: BigInt(2147483648),
        memoryMax: BigInt(8589934592)
      };

      const created = await nodeRepo.create(nodeData);
      expect(created.id).toBe('test-node');
      expect(created.status).toBe('online');

      const retrieved = await nodeRepo.findById('test-node');
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe('test-node');
    });

    it('should validate node data', async () => {
      const invalidData = {
        id: '',
        status: 'invalid-status',
        cpuUsage: 1.5 // Invalid range
      };

      await expect(nodeRepo.create(invalidData as any)).rejects.toThrow(ValidationError);
    });

    it('should find nodes by status', async () => {
      await nodeRepo.create({ id: 'node1', status: 'online' });
      await nodeRepo.create({ id: 'node2', status: 'offline' });
      await nodeRepo.create({ id: 'node3', status: 'online' });

      const onlineNodes = await nodeRepo.findOnlineNodes();
      expect(onlineNodes).toHaveLength(2);
      expect(onlineNodes.every(n => n.status === 'online')).toBe(true);
    });

    it('should get resource summary', async () => {
      await nodeRepo.create({
        id: 'node1',
        status: 'online',
        cpuMax: 4,
        cpuUsage: 0.5,
        memoryMax: BigInt(8589934592)
      });

      await nodeRepo.create({
        id: 'node2',
        status: 'offline',
        cpuMax: 2,
        cpuUsage: 0.2,
        memoryMax: BigInt(4294967296)
      });

      const summary = await nodeRepo.getResourceSummary();
      expect(summary.totalNodes).toBe(2);
      expect(summary.onlineNodes).toBe(1);
      expect(summary.totalCpu).toBe(6);
      expect(summary.avgCpuUsage).toBe(0.35);
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
        name: 'test-vm',
        status: 'running',
        cpuCores: 2,
        memoryBytes: BigInt(2147483648)
      };

      const created = await vmRepo.create(vmData);
      expect(created.id).toBe(100);
      expect(created.nodeId).toBe('vm-node');

      const withRelations = await vmRepo.findWithRelations(100);
      expect(withRelations!.node!.id).toBe('vm-node');
    });

    it('should validate VM foreign key constraints', async () => {
      const vmData = {
        id: 101,
        nodeId: 'non-existent-node',
        name: 'orphan-vm',
        status: 'running'
      };

      await expect(vmRepo.create(vmData)).rejects.toThrow(ValidationError);
    });

    it('should get VM statistics', async () => {
      await vmRepo.create({
        id: 100,
        nodeId: 'vm-node',
        status: 'running',
        template: false,
        memoryBytes: BigInt(2147483648),
        diskSize: BigInt(21474836480)
      });

      await vmRepo.create({
        id: 101,
        nodeId: 'vm-node',
        status: 'stopped',
        template: true,
        memoryBytes: BigInt(1073741824),
        diskSize: BigInt(10737418240)
      });

      const stats = await vmRepo.getVMStatistics();
      expect(stats.totalVMs).toBe(2);
      expect(stats.runningVMs).toBe(1);
      expect(stats.templates).toBe(1);
      expect(stats.totalMemoryAllocated).toBe(BigInt(3221225472));
    });
  });

  describe('Container Repository', () => {
    beforeEach(async () => {
      await nodeRepo.create({ id: 'container-node', status: 'online' });
    });

    it('should create and manage containers', async () => {
      const containerData = {
        id: 200,
        nodeId: 'container-node',
        name: 'test-container',
        hostname: 'test-ct',
        status: 'running',
        osTemplate: 'ubuntu-22.04-standard'
      };

      const created = await containerRepo.create(containerData);
      expect(created.id).toBe(200);
      expect(created.hostname).toBe('test-ct');

      const byTemplate = await containerRepo.findByOSTemplate('ubuntu-22.04-standard');
      expect(byTemplate).toHaveLength(1);
    });

    it('should get container statistics', async () => {
      await containerRepo.create({
        id: 200,
        nodeId: 'container-node',
        status: 'running',
        osTemplate: 'ubuntu-22.04',
        memoryBytes: BigInt(536870912)
      });

      await containerRepo.create({
        id: 201,
        nodeId: 'container-node',
        status: 'stopped',
        osTemplate: 'debian-11',
        template: true
      });

      const stats = await containerRepo.getContainerStatistics();
      expect(stats.totalContainers).toBe(2);
      expect(stats.runningContainers).toBe(1);
      expect(stats.osTemplateDistribution).toEqual({
        'ubuntu-22.04': 1,
        'debian-11': 1
      });
    });
  });

  describe('Storage Repository', () => {
    it('should manage storage pools', async () => {
      const storageData = {
        id: 'local-lvm',
        type: 'lvm',
        enabled: true,
        totalBytes: BigInt(107374182400),
        usedBytes: BigInt(32212254720),
        availableBytes: BigInt(75161927680)
      };

      const created = await storageRepo.create(storageData);
      expect(created.id).toBe('local-lvm');
      expect(created.type).toBe('lvm');

      const byType = await storageRepo.findByType('lvm');
      expect(byType).toHaveLength(1);
    });

    it('should get storage statistics', async () => {
      await storageRepo.create({
        id: 'storage1',
        type: 'lvm',
        enabled: true,
        shared: false,
        totalBytes: BigInt(100000000000),
        usedBytes: BigInt(50000000000)
      });

      await storageRepo.create({
        id: 'storage2',
        type: 'nfs',
        enabled: true,
        shared: true,
        totalBytes: BigInt(200000000000),
        usedBytes: BigInt(60000000000)
      });

      const stats = await storageRepo.getStorageStatistics();
      expect(stats.totalStorages).toBe(2);
      expect(stats.enabledStorages).toBe(2);
      expect(stats.sharedStorages).toBe(1);
      expect(stats.storageTypeDistribution).toEqual({
        'lvm': 1,
        'nfs': 1
      });
    });
  });

  describe('Task Repository', () => {
    beforeEach(async () => {
      await nodeRepo.create({ id: 'task-node', status: 'online' });
    });

    it('should track task operations', async () => {
      const taskData = {
        upid: 'UPID:task-node:00001234:000ABCDE:67890123:vmstart:100:root@pam:',
        nodeId: 'task-node',
        type: 'vmstart',
        status: 'running',
        resourceType: 'vm',
        resourceId: '100',
        user: 'root@pam',
        startTime: new Date()
      };

      const created = await taskRepo.create(taskData);
      expect(created.upid).toBe(taskData.upid);
      expect(created.type).toBe('vmstart');

      const byResource = await taskRepo.findByResource('vm', '100');
      expect(byResource).toHaveLength(1);
    });

    it('should update task status and add logs', async () => {
      const task = await taskRepo.create({
        upid: 'UPID:task-node:00001234:000ABCDE:67890123:vmstart:100:root@pam:',
        nodeId: 'task-node',
        type: 'vmstart',
        status: 'running',
        startTime: new Date()
      });

      await taskRepo.addLogEntry(task.upid, 'Starting VM...');
      await taskRepo.updateTaskStatus(task.upid, 'OK', 'success');

      const updated = await taskRepo.findById(task.upid);
      expect(updated!.status).toBe('OK');
      expect(updated!.exitStatus).toBe('success');
      expect(updated!.logEntries).toContain('Starting VM...');
    });

    it('should get task statistics', async () => {
      const now = new Date();
      
      await taskRepo.create({
        upid: 'UPID:task-node:1:1:1:vmstart:100:root@pam:',
        nodeId: 'task-node',
        type: 'vmstart',
        status: 'OK',
        startTime: new Date(now.getTime() - 60000),
        endTime: now
      });

      await taskRepo.create({
        upid: 'UPID:task-node:2:2:2:vmstop:101:root@pam:',
        nodeId: 'task-node',
        type: 'vmstop',
        status: 'running',
        startTime: now
      });

      const stats = await taskRepo.getTaskStatistics();
      expect(stats.totalTasks).toBe(2);
      expect(stats.runningTasks).toBe(1);
      expect(stats.completedTasks).toBe(1);
      expect(stats.taskTypeDistribution).toEqual({
        'vmstart': 1,
        'vmstop': 1
      });
    });
  });

  describe('StateSnapshot Repository', () => {
    it('should track resource state changes', async () => {
      const resourceData = {
        id: 100,
        name: 'test-vm',
        status: 'running',
        cpu: 2
      };

      const snapshot = await stateSnapshotRepo.createResourceSnapshot(
        'vm',
        '100',
        resourceData,
        'created'
      );

      expect(snapshot.resourceType).toBe('vm');
      expect(snapshot.resourceId).toBe('100');
      expect(snapshot.changeType).toBe('created');

      const parsedData = JSON.parse(snapshot.resourceData);
      expect(parsedData).toEqual(resourceData);
    });

    it('should detect state changes', async () => {
      const initialData = { id: 100, name: 'test-vm', status: 'stopped' };
      const updatedData = { id: 100, name: 'test-vm', status: 'running', uptime: 3600 };

      // Create initial snapshot
      await stateSnapshotRepo.createResourceSnapshot('vm', '100', initialData, 'created');

      // Compare with updated data
      const comparison = await stateSnapshotRepo.compareWithLatest('vm', '100', updatedData);
      
      expect(comparison.hasChanged).toBe(true);
      expect(comparison.changes).toHaveLength(1); // Only status changed (uptime is ignored)
      expect(comparison.changes![0]).toEqual({
        field: 'status',
        oldValue: 'stopped',
        newValue: 'running'
      });
    });

    it('should track resource changes automatically', async () => {
      const initialData = { id: 100, status: 'stopped' };
      const updatedData = { id: 100, status: 'running' };

      // First track (should create)
      const first = await stateSnapshotRepo.trackResourceChange('vm', '100', initialData);
      expect(first.hasChanged).toBe(true);
      expect(first.snapshot.changeType).toBe('created');

      // Second track with same data (should not detect changes)
      const second = await stateSnapshotRepo.trackResourceChange('vm', '100', initialData);
      expect(second.hasChanged).toBe(false);
      expect(second.snapshot.changeType).toBe('discovered');

      // Third track with changes
      const third = await stateSnapshotRepo.trackResourceChange('vm', '100', updatedData);
      expect(third.hasChanged).toBe(true);
      expect(third.snapshot.changeType).toBe('updated');
    });

    it('should get resource history', async () => {
      const data1 = { id: 100, status: 'stopped' };
      const data2 = { id: 100, status: 'running' };
      const data3 = { id: 100, status: 'paused' };

      await stateSnapshotRepo.createResourceSnapshot('vm', '100', data1, 'created');
      await stateSnapshotRepo.createResourceSnapshot('vm', '100', data2, 'updated');
      await stateSnapshotRepo.createResourceSnapshot('vm', '100', data3, 'updated');

      const history = await stateSnapshotRepo.getResourceHistory('vm', '100');
      expect(history.snapshots).toHaveLength(3);
      expect(history.totalChanges).toBe(2); // Two 'updated' changes
      expect(history.resourceType).toBe('vm');
      expect(history.resourceId).toBe('100');
    });

    it('should get change statistics', async () => {
      await stateSnapshotRepo.createResourceSnapshot('vm', '100', {}, 'created');
      await stateSnapshotRepo.createResourceSnapshot('vm', '100', {}, 'updated');
      await stateSnapshotRepo.createResourceSnapshot('container', '200', {}, 'created');

      const stats = await stateSnapshotRepo.getChangeStatistics();
      expect(stats.totalSnapshots).toBe(3);
      expect(stats.changesByType).toEqual({
        'created': 2,
        'updated': 1
      });
      expect(stats.changesByResource).toEqual({
        'vm': 2,
        'container': 1
      });
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await nodeRepo.create({ id: 'error-test-node', status: 'online' });
    });

    it('should throw NotFoundError for non-existent resources', async () => {
      await expect(nodeRepo.findById('non-existent')).resolves.toBeNull();
      await expect(nodeRepo.update('non-existent', { status: 'offline' })).rejects.toThrow(NotFoundError);
      await expect(nodeRepo.delete('non-existent')).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError for invalid data', async () => {
      // Invalid status
      await expect(nodeRepo.create({
        id: 'invalid-node',
        status: 'invalid-status'
      })).rejects.toThrow(ValidationError);

      // Duplicate ID
      await nodeRepo.create({ id: 'duplicate-test', status: 'online' });
      await expect(nodeRepo.create({ id: 'duplicate-test', status: 'online' })).rejects.toThrow(ValidationError);
    });

    it('should handle foreign key constraint violations', async () => {
      // Try to delete node with dependent VMs
      await vmRepo.create({
        id: 100,
        nodeId: 'error-test-node',
        status: 'running'
      });

      await expect(nodeRepo.delete('error-test-node')).rejects.toThrow(ValidationError);
    });
  });

  describe('Performance and Bulk Operations', () => {
    beforeEach(async () => {
      await nodeRepo.create({ id: 'bulk-node', status: 'online' });
    });

    it('should handle bulk operations efficiently', async () => {
      const vmData = Array.from({ length: 5 }, (_, i) => ({
        id: 1000 + i,
        nodeId: 'bulk-node',
        name: `bulk-vm-${i}`,
        status: 'stopped'
      }));

      const created = await vmRepo.createMany(vmData);
      expect(created).toHaveLength(5);

      const updated = await vmRepo.updateMany(
        { nodeId: 'bulk-node' },
        { status: 'running' }
      );
      expect(updated).toBe(5);

      const count = await vmRepo.count({ status: 'running' });
      expect(count).toBe(5);
    });

    it('should support pagination', async () => {
      // Create test data
      const vmData = Array.from({ length: 15 }, (_, i) => ({
        id: 2000 + i,
        nodeId: 'bulk-node',
        name: `page-vm-${i}`,
        status: 'stopped'
      }));

      await vmRepo.createMany(vmData);

      // Test pagination
      const page1 = await vmRepo.findMany({ page: 1, limit: 5 });
      expect(page1.data).toHaveLength(5);
      expect(page1.total).toBe(15);
      expect(page1.hasMore).toBe(true);

      const page2 = await vmRepo.findMany({ page: 2, limit: 5 });
      expect(page2.data).toHaveLength(5);
      expect(page2.hasMore).toBe(true);

      const page4 = await vmRepo.findMany({ page: 4, limit: 5 });
      expect(page4.data).toHaveLength(0);
      expect(page4.hasMore).toBe(false);
    });
  });
});