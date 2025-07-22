/**
 * Basic CRUD operations validation tests
 */

import { dbClient } from '../client';

describe('Database CRUD Operations', () => {
  afterAll(async () => {
    await dbClient.disconnect();
  });

  beforeEach(async () => {
    // Clean up test data before each test - order matters for foreign keys
    await dbClient.client.stateSnapshot.deleteMany();
    await dbClient.client.task.deleteMany();
    await dbClient.client.vM.deleteMany();
    await dbClient.client.container.deleteMany();
    await dbClient.client.node.deleteMany();
    await dbClient.client.storage.deleteMany();
  });

  describe('Node operations', () => {
    it('should create and retrieve a node', async () => {
      // Create test node
      const node = await dbClient.client.node.create({
        data: {
          id: 'test-node',
          status: 'online',
          type: 'pve',
          cpuUsage: 0.25,
          cpuMax: 4,
          memoryUsage: BigInt(2147483648), // 2GB
          memoryMax: BigInt(8589934592),   // 8GB
          uptime: 86400,
          pveVersion: '8.4.1'
        }
      });

      expect(node.id).toBe('test-node');
      expect(node.status).toBe('online');
      expect(node.cpuUsage).toBe(0.25);
      expect(node.memoryUsage).toBe(BigInt(2147483648));

      // Retrieve node
      const retrieved = await dbClient.client.node.findUnique({
        where: { id: 'test-node' }
      });

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe('test-node');
      expect(retrieved?.pveVersion).toBe('8.4.1');
    });

    it('should update node data', async () => {
      // Create node
      await dbClient.client.node.create({
        data: {
          id: 'update-test',
          status: 'online',
          cpuUsage: 0.1
        }
      });

      // Update node
      const updated = await dbClient.client.node.update({
        where: { id: 'update-test' },
        data: {
          cpuUsage: 0.8,
          memoryUsage: BigInt(4294967296) // 4GB
        }
      });

      expect(updated.cpuUsage).toBe(0.8);
      expect(updated.memoryUsage).toBe(BigInt(4294967296));
    });

    it('should delete node', async () => {
      // Create node
      await dbClient.client.node.create({
        data: {
          id: 'delete-test',
          status: 'online'
        }
      });

      // Delete node
      await dbClient.client.node.delete({
        where: { id: 'delete-test' }
      });

      // Verify deletion
      const deleted = await dbClient.client.node.findUnique({
        where: { id: 'delete-test' }
      });

      expect(deleted).toBeNull();
    });
  });

  describe('VM operations', () => {
    it('should create VM with node relationship', async () => {
      // Create parent node first
      await dbClient.client.node.create({
        data: {
          id: 'vm-node',
          status: 'online'
        }
      });

      // Create VM
      const vm = await dbClient.client.vM.create({
        data: {
          id: 100,
          nodeId: 'vm-node',
          name: 'test-vm',
          status: 'running',
          cpuCores: 2,
          memoryBytes: BigInt(1073741824), // 1GB
          diskSize: BigInt(21474836480),   // 20GB
          template: false
        }
      });

      expect(vm.id).toBe(100);
      expect(vm.nodeId).toBe('vm-node');
      expect(vm.name).toBe('test-vm');
      expect(vm.status).toBe('running');

      // Test relationship query
      const vmWithNode = await dbClient.client.vM.findUnique({
        where: { id: 100 },
        include: { node: true }
      });

      expect(vmWithNode?.node.id).toBe('vm-node');
      expect(vmWithNode?.node.status).toBe('online');
    });

    it('should handle VM with all optional fields', async () => {
      // Create parent node
      await dbClient.client.node.create({
        data: {
          id: 'full-vm-node',
          status: 'online'
        }
      });

      // Create VM with all fields
      const vm = await dbClient.client.vM.create({
        data: {
          id: 101,
          nodeId: 'full-vm-node',
          name: 'full-test-vm',
          status: 'stopped',
          template: false,
          cpuCores: 4,
          cpuUsage: 0.65,
          memoryBytes: BigInt(2147483648),
          memoryUsage: BigInt(1073741824),
          diskSize: BigInt(53687091200),
          diskUsage: BigInt(21474836480),
          networkIn: BigInt(1048576),
          networkOut: BigInt(2097152),
          uptime: 3600,
          pid: 12345,
          haManaged: true,
          lockStatus: 'backup',
          configDigest: 'abc123def456'
        }
      });

      expect(vm.cpuUsage).toBe(0.65);
      expect(vm.haManaged).toBe(true);
      expect(vm.lockStatus).toBe('backup');
      expect(vm.configDigest).toBe('abc123def456');
    });
  });

  describe('Container operations', () => {
    it('should create LXC container', async () => {
      // Create parent node
      await dbClient.client.node.create({
        data: {
          id: 'container-node',
          status: 'online'
        }
      });

      // Create container
      const container = await dbClient.client.container.create({
        data: {
          id: 200,
          nodeId: 'container-node',
          name: 'test-container',
          hostname: 'test-ct',
          status: 'running',
          cpuCores: 1,
          memoryBytes: BigInt(536870912), // 512MB
          swapBytes: BigInt(536870912),   // 512MB
          osTemplate: 'ubuntu-22.04-standard'
        }
      });

      expect(container.id).toBe(200);
      expect(container.hostname).toBe('test-ct');
      expect(container.osTemplate).toBe('ubuntu-22.04-standard');
    });
  });

  describe('Storage operations', () => {
    it('should create storage configuration', async () => {
      const storage = await dbClient.client.storage.create({
        data: {
          id: 'local-lvm',
          type: 'lvm',
          contentTypes: '["images", "rootdir"]',
          enabled: true,
          shared: false,
          totalBytes: BigInt(107374182400), // 100GB
          usedBytes: BigInt(32212254720),   // 30GB
          availableBytes: BigInt(75161927680), // 70GB
          path: '/dev/pve/data',
          nodes: '["node1", "node2"]'
        }
      });

      expect(storage.id).toBe('local-lvm');
      expect(storage.type).toBe('lvm');
      expect(storage.enabled).toBe(true);
      expect(storage.contentTypes).toBe('["images", "rootdir"]');
    });
  });

  describe('Task operations', () => {
    it('should create and track tasks', async () => {
      // Create parent node
      await dbClient.client.node.create({
        data: {
          id: 'task-node',
          status: 'online'
        }
      });

      const task = await dbClient.client.task.create({
        data: {
          upid: 'UPID:task-node:00001234:000ABCDE:67890123:vmstart:100:root@pam:',
          nodeId: 'task-node',
          type: 'vmstart',
          status: 'running',
          resourceType: 'vm',
          resourceId: '100',
          user: 'root@pam',
          startTime: new Date()
        }
      });

      expect(task.upid).toContain('task-node');
      expect(task.type).toBe('vmstart');
      expect(task.resourceType).toBe('vm');
      expect(task.resourceId).toBe('100');
    });
  });

  describe('StateSnapshot operations', () => {
    it('should create state snapshots for change tracking', async () => {
      const snapshot = await dbClient.client.stateSnapshot.create({
        data: {
          snapshotTime: new Date(),
          resourceType: 'vm',
          resourceId: '100',
          resourceData: JSON.stringify({
            id: 100,
            name: 'test-vm',
            status: 'running',
            cpu: 2,
            memory: '1G'
          }),
          changeType: 'created'
        }
      });

      expect(snapshot.resourceType).toBe('vm');
      expect(snapshot.resourceId).toBe('100');
      expect(snapshot.changeType).toBe('created');
      
      const parsedData = JSON.parse(snapshot.resourceData);
      expect(parsedData.name).toBe('test-vm');
      expect(parsedData.status).toBe('running');
    });
  });

  describe('complex queries', () => {
    it('should handle queries with relationships', async () => {
      // Create test data
      await dbClient.client.node.create({
        data: {
          id: 'query-node',
          status: 'online',
          cpuUsage: 0.5
        }
      });

      await dbClient.client.vM.create({
        data: {
          id: 300,
          nodeId: 'query-node',
          name: 'query-vm',
          status: 'running',
          cpuCores: 2
        }
      });

      // Query VMs with their nodes
      const vmsWithNodes = await dbClient.client.vM.findMany({
        include: {
          node: true
        }
      });

      expect(vmsWithNodes).toHaveLength(1);
      expect(vmsWithNodes[0].name).toBe('query-vm');
      expect(vmsWithNodes[0].node.id).toBe('query-node');
      expect(vmsWithNodes[0].node.cpuUsage).toBe(0.5);
    });

    it('should handle filtered queries', async () => {
      // Create test nodes
      await dbClient.client.node.createMany({
        data: [
          { id: 'online-node', status: 'online' },
          { id: 'offline-node', status: 'offline' }
        ]
      });

      // Query only online nodes
      const onlineNodes = await dbClient.client.node.findMany({
        where: {
          status: 'online'
        }
      });

      expect(onlineNodes).toHaveLength(1);
      expect(onlineNodes[0].id).toBe('online-node');
    });
  });
});