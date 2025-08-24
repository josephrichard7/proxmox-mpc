/**
 * Repository validation and integration tests
 * Validates the complete repository pattern with realistic scenarios
 */

import { dbClient } from '../client';
import { NodeRepository } from '../repositories/node-repository';
import { VMRepository } from '../repositories/vm-repository';
import { ContainerRepository } from '../repositories/container-repository';
import { TaskRepository } from '../repositories/task-repository';
import { StateSnapshotRepository } from '../repositories/state-snapshot-repository';
import { RepositoryFactory } from '../repositories/index';
import { NotFoundError, ValidationError } from '../repositories/base-repository';

describe('Repository Validation Tests', () => {
  let nodeRepo: NodeRepository;
  let vmRepo: VMRepository;
  let containerRepo: ContainerRepository;
  let taskRepo: TaskRepository;
  let stateSnapshotRepo: StateSnapshotRepository;

  beforeAll(async () => {
    // Get repository instances
    nodeRepo = new NodeRepository();
    vmRepo = new VMRepository();
    containerRepo = new ContainerRepository();
    taskRepo = new TaskRepository();
    stateSnapshotRepo = new StateSnapshotRepository();

    // Verify database connection
    await dbClient.connect();
  });

  afterAll(async () => {
    await dbClient.disconnect();
  });

  beforeEach(async () => {
    // Clean up test data in correct order for foreign keys
    await dbClient.client.stateSnapshot.deleteMany();
    await dbClient.client.task.deleteMany();
    await dbClient.client.vM.deleteMany();
    await dbClient.client.container.deleteMany();
    await dbClient.client.node.deleteMany();
  });

  describe('Repository Factory Pattern', () => {
    it('should provide singleton instances', () => {
      const repo1 = RepositoryFactory.getNodeRepository();
      const repo2 = RepositoryFactory.getNodeRepository();
      expect(repo1).toBe(repo2);
    });

    it('should pass health checks for all repositories', async () => {
      const health = await RepositoryFactory.healthCheck();
      
      expect(health.status).toBe('healthy');
      expect(health.repositories.nodes.status).toBe('healthy');
      expect(health.repositories.vms.status).toBe('healthy');
      expect(health.repositories.containers.status).toBe('healthy');
      expect(health.repositories.tasks.status).toBe('healthy');
      expect(health.repositories.stateSnapshots.status).toBe('healthy');
      
    });
  });

  describe('Node Repository Functionality', () => {
    it('should handle complete node lifecycle', async () => {
      // Create node
      const node = await nodeRepo.create({
        id: 'test-node',
        status: 'online',
        type: 'pve',
        cpuUsage: 0.25,
        cpuMax: 8,
        memoryUsage: BigInt(4294967296),
        memoryMax: BigInt(17179869184),
        uptime: 86400,
        pveVersion: '8.4.1'
      });

      expect(node.id).toBe('test-node');
      expect(node.status).toBe('online');
      expect(node.cpuUsage).toBe(0.25);

      // Update node
      const updated = await nodeRepo.update('test-node', {
        cpuUsage: 0.5,
        uptime: 172800
      });

      expect(updated.cpuUsage).toBe(0.5);
      expect(updated.uptime).toBe(172800);

      // Find node
      const found = await nodeRepo.findById('test-node');
      expect(found).not.toBeNull();
      expect(found!.cpuUsage).toBe(0.5);

      // Check exists
      const exists = await nodeRepo.exists('test-node');
      expect(exists).toBe(true);

      // Get resource summary
      const summary = await nodeRepo.getResourceSummary();
      expect(summary.totalNodes).toBe(1);
      expect(summary.onlineNodes).toBe(1);

      // Delete node
      await nodeRepo.delete('test-node');
      const deleted = await nodeRepo.findById('test-node');
      expect(deleted).toBeNull();

    });
  });

  describe('VM Repository with Relationships', () => {
    beforeEach(async () => {
      await nodeRepo.create({ id: 'vm-node', status: 'online' });
    });

    it('should handle VM operations with foreign key validation', async () => {
      // Create VM
      const vm = await vmRepo.create({
        id: 100,
        nodeId: 'vm-node',
        name: 'test-vm',
        status: 'running',
        cpuCores: 4,
        memoryBytes: BigInt(4294967296),
        diskSize: BigInt(42949672960)
      });

      expect(vm.id).toBe(100);
      expect(vm.nodeId).toBe('vm-node');

      // Find with relationships
      const vmWithNode = await vmRepo.findWithRelations(100);
      expect(vmWithNode).not.toBeNull();
      expect(vmWithNode!.node!.id).toBe('vm-node');

      // Find by node
      const nodeVMs = await vmRepo.findByNode('vm-node');
      expect(nodeVMs).toHaveLength(1);

      // Find by status
      const runningVMs = await vmRepo.findRunningVMs();
      expect(runningVMs).toHaveLength(1);

      // Get statistics
      const stats = await vmRepo.getVMStatistics();
      expect(stats.totalVMs).toBe(1);
      expect(stats.runningVMs).toBe(1);

    });

    it('should prevent orphaned VMs', async () => {
      await expect(vmRepo.create({
        id: 101,
        nodeId: 'non-existent-node',
        status: 'running'
      })).rejects.toThrow(ValidationError);

    });
  });

  describe('Container Repository Operations', () => {
    beforeEach(async () => {
      await nodeRepo.create({ id: 'container-node', status: 'online' });
    });

    it('should manage containers effectively', async () => {
      // Create containers with different templates
      const container1 = await containerRepo.create({
        id: 200,
        nodeId: 'container-node',
        name: 'nginx-proxy',
        hostname: 'nginx',
        status: 'running',
        osTemplate: 'ubuntu-22.04-standard'
      });

      const container2 = await containerRepo.create({
        id: 201,
        nodeId: 'container-node',
        name: 'database',
        hostname: 'db',
        status: 'running',
        osTemplate: 'debian-11-standard'
      });

      // Find by OS template
      const ubuntuContainers = await containerRepo.findByOSTemplate('ubuntu-22.04-standard');
      expect(ubuntuContainers).toHaveLength(1);

      // Get statistics
      const stats = await containerRepo.getContainerStatistics();
      expect(stats.totalContainers).toBe(2);
      expect(stats.runningContainers).toBe(2);
      expect(stats.osTemplateDistribution).toEqual({
        'ubuntu-22.04-standard': 1,
        'debian-11-standard': 1
      });

    });
  });

  describe('Task Repository and Tracking', () => {
    beforeEach(async () => {
      await nodeRepo.create({ id: 'task-node', status: 'online' });
    });

    it('should track Proxmox operations', async () => {
      // Create a running task
      const task = await taskRepo.create({
        upid: 'UPID:task-node:00001234:000ABCDE:67890123:vmstart:100:root@pam:',
        nodeId: 'task-node',
        type: 'vmstart',
        status: 'running',
        resourceType: 'vm',
        resourceId: '100',
        user: 'root@pam',
        startTime: new Date()
      });

      expect(task.type).toBe('vmstart');
      expect(task.status).toBe('running');

      // Add log entry
      await taskRepo.addLogEntry(task.upid, 'Starting VM 100...');
      await taskRepo.addLogEntry(task.upid, 'VM startup complete');

      // Update task status
      await taskRepo.updateTaskStatus(task.upid, 'OK', 'success');

      const updated = await taskRepo.findById(task.upid);
      expect(updated!.status).toBe('OK');
      expect(updated!.exitStatus).toBe('success');
      expect(updated!.logEntries).toContain('Starting VM 100');

      // Find by resource
      const vmTasks = await taskRepo.findByResource('vm', '100');
      expect(vmTasks).toHaveLength(1);

      // Get statistics
      const stats = await taskRepo.getTaskStatistics();
      expect(stats.totalTasks).toBe(1);
      expect(stats.completedTasks).toBe(1);

    });
  });

  describe('State Snapshot and Change Detection', () => {
    it('should track resource changes over time', async () => {
      const resourceId = '100';
      const resourceType = 'vm';

      // Initial state
      const initialState = {
        id: 100,
        name: 'test-vm',
        status: 'stopped',
        cpuCores: 2
      };

      // Track initial state
      const firstSnapshot = await stateSnapshotRepo.trackResourceChange(
        resourceType, resourceId, initialState
      );

      expect(firstSnapshot.hasChanged).toBe(true);
      expect(firstSnapshot.snapshot.changeType).toBe('created');

      // Same state - no changes
      const sameSnapshot = await stateSnapshotRepo.trackResourceChange(
        resourceType, resourceId, initialState
      );

      expect(sameSnapshot.hasChanged).toBe(false);
      expect(sameSnapshot.snapshot.changeType).toBe('discovered');

      // Changed state
      const changedState = {
        id: 100,
        name: 'test-vm',
        status: 'running', // Changed
        cpuCores: 4,       // Changed
        uptime: 3600       // New field (ignored in comparison)
      };

      const changedSnapshot = await stateSnapshotRepo.trackResourceChange(
        resourceType, resourceId, changedState
      );

      expect(changedSnapshot.hasChanged).toBe(true);
      expect(changedSnapshot.snapshot.changeType).toBe('updated');
      expect(changedSnapshot.changes).toHaveLength(2); // status and cpuCores

      // Verify change details
      const statusChange = changedSnapshot.changes!.find((c: any) => c.field === 'status');
      expect(statusChange).toEqual({
        field: 'status',
        oldValue: 'stopped',
        newValue: 'running'
      });

      // Get resource history
      const history = await stateSnapshotRepo.getResourceHistory(resourceType, resourceId);
      expect(history.snapshots).toHaveLength(3);
      expect(history.totalChanges).toBe(1); // One 'updated' change

    });

    it('should provide change statistics', async () => {
      // Create some test snapshots
      await stateSnapshotRepo.createResourceSnapshot('vm', '100', {}, 'created');
      await stateSnapshotRepo.createResourceSnapshot('vm', '100', {}, 'updated');
      await stateSnapshotRepo.createResourceSnapshot('container', '200', {}, 'created');

      const stats = await stateSnapshotRepo.getChangeStatistics();
      expect(stats.totalSnapshots).toBe(3);
      expect(stats.changesByType.created).toBe(2);
      expect(stats.changesByType.updated).toBe(1);
      expect(stats.changesByResource.vm).toBe(2);
      expect(stats.changesByResource.container).toBe(1);

    });
  });

  describe('Error Handling Validation', () => {
    it('should handle validation errors appropriately', async () => {
      // Missing required field
      await expect(nodeRepo.create({
        id: '',
        status: 'online'
      })).rejects.toThrow(ValidationError);

      // Invalid status
      await expect(nodeRepo.create({
        id: 'test-node',
        status: 'invalid-status'
      })).rejects.toThrow(ValidationError);

    });

    it('should handle not found errors', async () => {
      await expect(nodeRepo.update('non-existent', { status: 'offline' }))
        .rejects.toThrow(NotFoundError);

      await expect(nodeRepo.delete('non-existent'))
        .rejects.toThrow(NotFoundError);

    });
  });

  describe('Bulk Operations and Performance', () => {
    beforeEach(async () => {
      await nodeRepo.create({ id: 'bulk-node', status: 'online' });
    });

    it('should handle bulk operations efficiently', async () => {
      const startTime = Date.now();

      // Create multiple VMs
      const vmData = Array.from({ length: 10 }, (_, i) => ({
        id: 1000 + i,
        nodeId: 'bulk-node',
        name: `bulk-vm-${i}`,
        status: 'stopped'
      }));

      const created = await vmRepo.createMany(vmData);
      expect(created).toHaveLength(10);

      // Bulk update
      const updated = await vmRepo.updateMany(
        { nodeId: 'bulk-node' },
        { status: 'running' }
      );
      expect(updated).toBe(10);

      // Test pagination
      const page1 = await vmRepo.findMany({ 
        where: { nodeId: 'bulk-node' },
        page: 1, 
        limit: 5 
      });
      expect(page1.data).toHaveLength(5);
      expect(page1.total).toBe(10);
      expect(page1.hasMore).toBe(true);

      const endTime = Date.now();
    });
  });

  describe('Complete Proxmox Cluster Simulation', () => {
    it('should simulate a realistic Proxmox environment', async () => {

      // 1. Create cluster node
      const node = await nodeRepo.create({
        id: 'proxmox-main',
        status: 'online',
        type: 'pve',
        cpuUsage: 0.15,
        cpuMax: 8,
        memoryUsage: BigInt(4294967296),
        memoryMax: BigInt(17179869184),
        pveVersion: '8.4.1'
      });

      // 2. Create VMs
      const vm1 = await vmRepo.create({
        id: 100,
        nodeId: 'proxmox-main',
        name: 'ubuntu-server',
        status: 'running',
        cpuCores: 4,
        memoryBytes: BigInt(4294967296)
      });

      const vm2 = await vmRepo.create({
        id: 101,
        nodeId: 'proxmox-main',
        name: 'web-server',
        status: 'running',
        cpuCores: 2,
        memoryBytes: BigInt(2147483648)
      });

      // 3. Create containers
      const container = await containerRepo.create({
        id: 200,
        nodeId: 'proxmox-main',
        name: 'nginx-proxy',
        status: 'running',
        osTemplate: 'ubuntu-22.04-standard'
      });

      // 4. Create tasks
      const task = await taskRepo.create({
        upid: 'UPID:proxmox-main:123:456:789:vmstart:100:root@pam:',
        nodeId: 'proxmox-main',
        type: 'vmstart',
        status: 'OK',
        resourceType: 'vm',
        resourceId: '100'
      });

      // 5. Track state changes
      await stateSnapshotRepo.trackResourceChange('vm', '100', {
        id: 100, name: 'ubuntu-server', status: 'running'
      });

      // 6. Verify complete setup
      const clusterNode = await nodeRepo.findWithRelations('proxmox-main');
      expect(clusterNode!.vms).toHaveLength(2);
      expect(clusterNode!.containers).toHaveLength(1);
      expect(clusterNode!.tasks).toHaveLength(1);

      const nodeStats = await nodeRepo.getResourceSummary();
      expect(nodeStats.totalNodes).toBe(1);
      expect(nodeStats.onlineNodes).toBe(1);

      const vmStats = await vmRepo.getVMStatistics();
      expect(vmStats.totalVMs).toBe(2);
      expect(vmStats.runningVMs).toBe(2);

      // Complex cluster simulation completed successfully
    });
  });
});