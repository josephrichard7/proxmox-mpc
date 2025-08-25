/**
 * Comprehensive repository integration tests
 * Tests the complete repository pattern with realistic Proxmox scenarios
 */

import { dbClient } from '../client';
import { DatabaseTestHelper } from '../../__tests__/utils/database-test-helper';
import {
  RepositoryFactory,
  NodeRepository,
  VMRepository,
  ContainerRepository,
  StorageRepository,
  TaskRepository,
  StateSnapshotRepository,
  NotFoundError,
  ValidationError
} from '../repositories/index';

describe('Repository Integration Tests', () => {
  let nodeRepo: NodeRepository;
  let vmRepo: VMRepository;
  let containerRepo: ContainerRepository;
  let storageRepo: StorageRepository;
  let taskRepo: TaskRepository;
  let stateSnapshotRepo: StateSnapshotRepository;

  beforeAll(async () => {
    // Ensure database connection
    await DatabaseTestHelper.ensureConnection();
    
    // Get repository instances from factory
    nodeRepo = RepositoryFactory.getNodeRepository();
    vmRepo = RepositoryFactory.getVMRepository();
    containerRepo = RepositoryFactory.getContainerRepository();
    storageRepo = RepositoryFactory.getStorageRepository();
    taskRepo = RepositoryFactory.getTaskRepository();
    stateSnapshotRepo = RepositoryFactory.getStateSnapshotRepository();
  });

  beforeEach(async () => {
    // Clean database before each test to ensure isolation
    await DatabaseTestHelper.cleanupDatabase();
  });

  afterAll(async () => {
    await DatabaseTestHelper.closeConnection();
  });

  describe('Factory Pattern and Health Checks', () => {
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
      expect(health.repositories.storage.status).toBe('healthy');
      expect(health.repositories.tasks.status).toBe('healthy');
      expect(health.repositories.stateSnapshots.status).toBe('healthy');
    });
  });

  describe('Complete Proxmox Cluster Simulation', () => {
    it('should simulate a complete Proxmox cluster lifecycle', async () => {
      // 1. Create a Proxmox node (like your 192.168.0.19 server)
      const node = await nodeRepo.create({
        id: 'proxmox-main',
        status: 'online',
        type: 'pve',
        cpuUsage: 0.15,
        cpuMax: 8,
        memoryUsage: BigInt(4294967296), // 4GB used
        memoryMax: BigInt(17179869184),  // 16GB total
        uptime: 432000, // 5 days
        pveVersion: '8.4.1'
      });

      expect(node.id).toBe('proxmox-main');
      expect(node.status).toBe('online');

      // 2. Create storage pools
      const storage1 = await storageRepo.create({
        id: 'local-lvm',
        type: 'lvm',
        enabled: true,
        totalBytes: BigInt(107374182400), // 100GB
        usedBytes: BigInt(32212254720),   // 30GB
        availableBytes: BigInt(75161927680) // 70GB
      });

      const storage2 = await storageRepo.create({
        id: 'nfs-backup',
        type: 'nfs',
        enabled: true,
        shared: true,
        totalBytes: BigInt(536870912000), // 500GB
        usedBytes: BigInt(107374182400),   // 100GB
        availableBytes: BigInt(429496729600) // 400GB
      });

      // 3. Create VMs
      const vm1 = await vmRepo.create({
        id: 100,
        nodeId: 'proxmox-main',
        name: 'ubuntu-server',
        status: 'running',
        cpuCores: 4,
        cpuUsage: 0.25,
        memoryBytes: BigInt(4294967296),  // 4GB
        memoryUsage: BigInt(2147483648),  // 2GB used
        diskSize: BigInt(42949672960),    // 40GB
        uptime: 86400 // 1 day
      });

      const vm2 = await vmRepo.create({
        id: 101,
        nodeId: 'proxmox-main',
        name: 'web-server',
        status: 'running',
        cpuCores: 2,
        memoryBytes: BigInt(2147483648),  // 2GB
        diskSize: BigInt(21474836480)     // 20GB
      });

      const vmTemplate = await vmRepo.create({
        id: 9000,
        nodeId: 'proxmox-main',
        name: 'ubuntu-template',
        status: 'stopped',
        template: true,
        cpuCores: 1,
        memoryBytes: BigInt(1073741824)   // 1GB
      });

      // 4. Create containers
      const container1 = await containerRepo.create({
        id: 200,
        nodeId: 'proxmox-main',
        name: 'nginx-proxy',
        hostname: 'nginx',
        status: 'running',
        cpuCores: 1,
        memoryBytes: BigInt(536870912),   // 512MB
        swapBytes: BigInt(536870912),     // 512MB
        osTemplate: 'ubuntu-22.04-standard'
      });

      const container2 = await containerRepo.create({
        id: 201,
        nodeId: 'proxmox-main',
        name: 'database',
        hostname: 'db',
        status: 'running',
        cpuCores: 2,
        memoryBytes: BigInt(2147483648),  // 2GB
        osTemplate: 'debian-11-standard'
      });

      // 5. Create tasks
      const task1 = await taskRepo.create({
        upid: 'UPID:proxmox-main:00003039:0004F2A1:65A8B123:vmstart:100:root@pam:',
        nodeId: 'proxmox-main',
        type: 'vmstart',
        status: 'OK',
        resourceType: 'vm',
        resourceId: '100',
        user: 'root@pam',
        startTime: new Date(Date.now() - 300000), // 5 minutes ago
        endTime: new Date(Date.now() - 295000)    // 4m55s ago
      });

      const task2 = await taskRepo.create({
        upid: 'UPID:proxmox-main:00003040:0004F2A2:65A8B124:backup:101:root@pam:',
        nodeId: 'proxmox-main',
        type: 'backup',
        status: 'running',
        resourceType: 'vm',
        resourceId: '101',
        user: 'root@pam',
        startTime: new Date()
      });

      // 6. Verify cluster state with relationships
      const clusterNode = await nodeRepo.findWithRelations('proxmox-main');
      expect(clusterNode).not.toBeNull();
      expect(clusterNode!.vms).toHaveLength(3);
      expect(clusterNode!.containers).toHaveLength(2);
      expect(clusterNode!.tasks).toHaveLength(2);

      // 7. Test resource queries
      const runningVMs = await vmRepo.findRunningVMs();
      expect(runningVMs).toHaveLength(2);

      const runningContainers = await containerRepo.findRunningContainers();
      expect(runningContainers).toHaveLength(2);

      const recentTasks = await taskRepo.findRecentTasks(1); // Last 1 hour
      expect(recentTasks).toHaveLength(2);

      // 8. Test statistics
      const nodeStats = await nodeRepo.getResourceSummary();
      expect(nodeStats.totalNodes).toBe(1);
      expect(nodeStats.onlineNodes).toBe(1);

      const vmStats = await vmRepo.getVMStatistics();
      expect(vmStats.totalVMs).toBe(3);
      expect(vmStats.runningVMs).toBe(2);
      expect(vmStats.templates).toBe(1);

      const containerStats = await containerRepo.getContainerStatistics();
      expect(containerStats.totalContainers).toBe(2);
      expect(containerStats.runningContainers).toBe(2);

      const storageStats = await storageRepo.getStorageStatistics();
      expect(storageStats.totalStorages).toBe(2);
      expect(storageStats.enabledStorages).toBe(2);

    });
  });

  describe('State Snapshot and Change Detection', () => {
    beforeEach(async () => {
      // Ensure test-node exists for state tracking tests
      try {
        await nodeRepo.create({ id: 'test-node', status: 'online' });
      } catch (error) {
        // Node might already exist in some test scenarios, ignore duplicate errors
        if (!(error instanceof ValidationError && error.message.includes('already exists'))) {
          throw error;
        }
      }
    });

    it('should track VM state changes over time', async () => {
      const vmId = '100';

      // Initial VM state
      const initialState = {
        id: 100,
        name: 'test-vm',
        status: 'stopped',
        cpuCores: 2,
        memoryBytes: '2147483648'
      };

      // Track initial state
      const firstSnapshot = await stateSnapshotRepo.trackResourceChange('vm', vmId, initialState);
      expect(firstSnapshot.hasChanged).toBe(true);
      expect(firstSnapshot.snapshot.changeType).toBe('created');
      
      // Wait a small amount to ensure timestamps are different
      await new Promise(resolve => setTimeout(resolve, 10));

      // No changes - should detect no difference
      const noChangeSnapshot = await stateSnapshotRepo.trackResourceChange('vm', vmId, initialState);
      expect(noChangeSnapshot.hasChanged).toBe(false);
      expect(noChangeSnapshot.snapshot.changeType).toBe('discovered');
      
      // Wait a small amount to ensure timestamps are different
      await new Promise(resolve => setTimeout(resolve, 10));

      // VM started with resource changes
      const updatedState = {
        id: 100,
        name: 'test-vm',
        status: 'running',
        cpuCores: 4, // CPU upgraded
        memoryBytes: '4294967296', // Memory doubled
        uptime: 3600 // Now has uptime
      };

      const changedSnapshot = await stateSnapshotRepo.trackResourceChange('vm', vmId, updatedState);
      expect(changedSnapshot.hasChanged).toBe(true);
      expect(changedSnapshot.snapshot.changeType).toBe('updated');
      expect(changedSnapshot.changes).toHaveLength(3); // status, cpuCores, memoryBytes (uptime ignored)

      // Verify change details
      const statusChange = changedSnapshot.changes!.find(c => c.field === 'status');
      expect(statusChange).toEqual({
        field: 'status',
        oldValue: 'stopped',
        newValue: 'running'
      });

      // Get complete history
      const history = await stateSnapshotRepo.getResourceHistory('vm', vmId);
      expect(history.snapshots).toHaveLength(3);
      expect(history.totalChanges).toBe(1); // One 'updated' change
    });

    it('should provide resource timeline and recent changes', async () => {
      const vmId = '100';
      
      // Create multiple snapshots over time
      await stateSnapshotRepo.createResourceSnapshot('vm', vmId, { status: 'stopped' }, 'created');
      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
      await stateSnapshotRepo.createResourceSnapshot('vm', vmId, { status: 'running' }, 'updated');
      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
      await stateSnapshotRepo.createResourceSnapshot('vm', vmId, { status: 'paused' }, 'updated');

      // Get timeline
      const timeline = await stateSnapshotRepo.getResourceTimeline('vm', vmId);
      expect(timeline).toHaveLength(3);
      expect(timeline[0].changeType).toBe('created'); // First in chronological order
      expect(timeline[2].changeType).toBe('updated'); // Last change

      // Get recent changes
      const recentChanges = await stateSnapshotRepo.findResourcesWithRecentChanges(1);
      expect(recentChanges.length).toBeGreaterThan(0);
      expect(recentChanges[0].resourceType).toBe('vm');
      expect(recentChanges[0].resourceId).toBe(vmId);
    });
  });

  describe('Error Handling and Validation', () => {
    it('should handle validation errors appropriately', async () => {
      // Missing required fields
      await expect(nodeRepo.create({
        id: '',
        status: 'online'
      })).rejects.toThrow(ValidationError);

      // Invalid status value
      await expect(nodeRepo.create({
        id: 'test-node',
        status: 'invalid-status'
      })).rejects.toThrow(ValidationError);

      // Invalid CPU usage range
      await expect(nodeRepo.create({
        id: 'test-node',
        status: 'online',
        cpuUsage: 1.5 // > 100%
      })).rejects.toThrow(ValidationError);

    });

    it('should handle foreign key constraint violations', async () => {
      // Try to create VM without parent node
      await expect(vmRepo.create({
        id: 100,
        nodeId: 'non-existent-node',
        status: 'running'
      })).rejects.toThrow(ValidationError);

      // Create node then VM should work
      await nodeRepo.create({ id: 'valid-node', status: 'online' });
      const vm = await vmRepo.create({
        id: 100,
        nodeId: 'valid-node',
        status: 'running'
      });
      expect(vm.nodeId).toBe('valid-node');

    });

    it('should handle not found errors', async () => {
      await expect(nodeRepo.findById('non-existent')).resolves.toBeNull();
      await expect(nodeRepo.update('non-existent', { status: 'offline' })).rejects.toThrow(NotFoundError);
      await expect(nodeRepo.delete('non-existent')).rejects.toThrow(NotFoundError);

    });

    it('should prevent cascading deletes when relationships exist', async () => {
      // Create node with dependent resources
      await nodeRepo.create({ id: 'parent-node', status: 'online' });
      await vmRepo.create({ id: 100, nodeId: 'parent-node', status: 'running' });

      // Should not be able to delete node with VMs
      await expect(nodeRepo.delete('parent-node')).rejects.toThrow(ValidationError);

      // Should work after deleting VM first
      await vmRepo.delete(100);
      await nodeRepo.delete('parent-node');

    });
  });

  describe('Performance and Bulk Operations', () => {
    it('should handle bulk operations efficiently', async () => {
      // Create node for this test
      await nodeRepo.create({ id: 'perf-node', status: 'online' });
      const startTime = Date.now();

      // Create 20 VMs
      const vmData = Array.from({ length: 20 }, (_, i) => ({
        id: 1000 + i,
        nodeId: 'perf-node',
        name: `bulk-vm-${i}`,
        status: 'stopped'
      }));

      const created = await vmRepo.createMany(vmData);
      expect(created).toHaveLength(20);

      // Bulk update all VMs
      const updated = await vmRepo.updateMany(
        { nodeId: 'perf-node' },
        { status: 'running' }
      );
      expect(updated).toBe(20);

      // Test pagination
      const page1 = await vmRepo.findMany({ 
        where: { nodeId: 'perf-node' },
        page: 1, 
        limit: 10 
      });
      expect(page1.data).toHaveLength(10);
      expect(page1.total).toBe(20);
      expect(page1.hasMore).toBe(true);

      const page2 = await vmRepo.findMany({ 
        where: { nodeId: 'perf-node' },
        page: 2, 
        limit: 10 
      });
      expect(page2.data).toHaveLength(10);
      expect(page2.hasMore).toBe(false);

      const endTime = Date.now();
    });

    it('should handle concurrent operations safely', async () => {
      // Ensure node exists for this test
      await nodeRepo.create({ id: 'perf-node', status: 'online' });

      // Create multiple VMs concurrently
      const concurrentOps = Array.from({ length: 10 }, (_, i) =>
        vmRepo.create({
          id: 2000 + i,
          nodeId: 'perf-node',
          name: `concurrent-vm-${i}`,
          status: 'stopped'
        })
      );

      const results = await Promise.all(concurrentOps);
      expect(results).toHaveLength(10);

      // Verify all created successfully
      const count = await vmRepo.count({ nodeId: 'perf-node' });
      expect(count).toBe(10);
    });
  });

  describe('Advanced Query Features', () => {
    it('should support complex filtering and sorting', async () => {
      // Create node for this test
      await nodeRepo.create({ id: 'query-node', status: 'online' });

      // Create test data with various statuses and resources
      await vmRepo.create({ id: 100, nodeId: 'query-node', status: 'running', cpuUsage: 0.8 });
      await vmRepo.create({ id: 101, nodeId: 'query-node', status: 'running', cpuUsage: 0.3 });
      await vmRepo.create({ id: 102, nodeId: 'query-node', status: 'stopped', cpuUsage: 0.0 });

      // Find high CPU usage VMs
      const highCpuVMs = await vmRepo.findWithHighCpuUsage(0.5);
      expect(highCpuVMs).toHaveLength(1);
      expect(highCpuVMs[0].id).toBe(100);

      // Find by multiple criteria with pagination
      const runningVMs = await vmRepo.findMany({
        where: { 
          nodeId: 'query-node',
          status: 'running'
        },
        orderBy: { cpuUsage: 'desc' },
        page: 1,
        limit: 10
      });

      expect(runningVMs.data).toHaveLength(2);
      expect(runningVMs.data[0].id).toBe(100); // Higher CPU usage first
      expect(runningVMs.data[1].id).toBe(101);

    });
  });
});