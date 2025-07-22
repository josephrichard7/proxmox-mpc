/**
 * Integration tests simulating real Proxmox data scenarios
 */

import { dbClient } from '../client';

describe('Database Integration Tests', () => {
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

  describe('Proxmox cluster simulation', () => {
    it('should store complete Proxmox cluster state', async () => {
      // Simulate a real Proxmox cluster setup
      
      // 1. Create node (like your 192.168.0.19 server)
      const node = await dbClient.client.node.create({
        data: {
          id: 'proxmox',
          status: 'online',
          type: 'node',
          cpuUsage: 0.15,
          cpuMax: 4,
          memoryUsage: BigInt(2147483648), // 2GB used
          memoryMax: BigInt(8589934592),   // 8GB total
          uptime: 432000, // 5 days
          pveVersion: '8.4.1',
          lastSeen: new Date()
        }
      });

      // 2. Create storage
      const storage = await dbClient.client.storage.create({
        data: {
          id: 'local-lvm',
          type: 'lvm',
          contentTypes: '["images", "rootdir"]',
          enabled: true,
          shared: false,
          totalBytes: BigInt(53687091200), // 50GB
          usedBytes: BigInt(21474836480),  // 20GB
          availableBytes: BigInt(32212254720) // 30GB
        }
      });

      // 3. Create VMs
      const vm1 = await dbClient.client.vM.create({
        data: {
          id: 100,
          nodeId: 'proxmox',
          name: 'ubuntu-server',
          status: 'running',
          cpuCores: 2,
          cpuUsage: 0.25,
          memoryBytes: BigInt(2147483648),  // 2GB allocated
          memoryUsage: BigInt(1073741824),  // 1GB used
          diskSize: BigInt(21474836480),    // 20GB
          networkIn: BigInt(1048576),       // 1MB
          networkOut: BigInt(2097152),      // 2MB
          uptime: 86400, // 1 day
          pid: 12345,
          configDigest: 'abc123'
        }
      });

      const vm2 = await dbClient.client.vM.create({
        data: {
          id: 101,
          nodeId: 'proxmox',
          name: 'test-vm',
          status: 'stopped',
          cpuCores: 1,
          memoryBytes: BigInt(1073741824), // 1GB
          diskSize: BigInt(10737418240),   // 10GB
          template: false
        }
      });

      // 4. Create containers
      const container = await dbClient.client.container.create({
        data: {
          id: 200,
          nodeId: 'proxmox',
          name: 'nginx-proxy',
          hostname: 'nginx',
          status: 'running',
          cpuCores: 1,
          memoryBytes: BigInt(536870912),  // 512MB
          swapBytes: BigInt(536870912),    // 512MB swap
          diskSize: BigInt(2147483648),    // 2GB
          osTemplate: 'ubuntu-22.04-standard',
          uptime: 3600 // 1 hour
        }
      });

      // 5. Create tasks
      const task = await dbClient.client.task.create({
        data: {
          upid: 'UPID:proxmox:00003039:0004F2A1:65A8B123:vmstart:100:root@pam:',
          nodeId: 'proxmox',
          type: 'vmstart',
          status: 'OK',
          resourceType: 'vm',
          resourceId: '100',
          user: 'root@pam',
          startTime: new Date(Date.now() - 300000), // 5 minutes ago
          endTime: new Date(Date.now() - 295000),   // 4m55s ago
          exitStatus: 'OK'
        }
      });

      // 6. Create state snapshots
      await dbClient.client.stateSnapshot.create({
        data: {
          snapshotTime: new Date(),
          resourceType: 'vm',
          resourceId: '100',
          resourceData: JSON.stringify({
            id: 100,
            name: 'ubuntu-server',
            status: 'running',
            node: 'proxmox'
          }),
          changeType: 'discovered'
        }
      });

      // Verify complete cluster state
      const clusterState = await dbClient.client.node.findMany({
        include: {
          vms: true,
          containers: true,
          tasks: true
        }
      });

      expect(clusterState).toHaveLength(1);
      expect(clusterState[0].id).toBe('proxmox');
      expect(clusterState[0].vms).toHaveLength(2);
      expect(clusterState[0].containers).toHaveLength(1);
      expect(clusterState[0].tasks).toHaveLength(1);

      // Verify storage
      const storageCount = await dbClient.client.storage.count();
      expect(storageCount).toBe(1);

      // Verify snapshots
      const snapshotCount = await dbClient.client.stateSnapshot.count();
      expect(snapshotCount).toBe(1);
    });

    it('should handle resource state changes over time', async () => {
      // Create initial state
      await dbClient.client.node.create({
        data: { id: 'test-node', status: 'online' }
      });

      const vm = await dbClient.client.vM.create({
        data: {
          id: 100,
          nodeId: 'test-node',
          name: 'changing-vm',
          status: 'stopped',
          configDigest: 'initial-config'
        }
      });

      // Create initial snapshot
      await dbClient.client.stateSnapshot.create({
        data: {
          snapshotTime: new Date(Date.now() - 60000), // 1 minute ago
          resourceType: 'vm',
          resourceId: '100',
          resourceData: JSON.stringify({ status: 'stopped' }),
          changeType: 'discovered'
        }
      });

      // Simulate VM being started
      await dbClient.client.vM.update({
        where: { id: 100 },
        data: {
          status: 'running',
          uptime: 30,
          pid: 54321,
          configDigest: 'running-config'
        }
      });

      // Create change snapshot
      await dbClient.client.stateSnapshot.create({
        data: {
          snapshotTime: new Date(),
          resourceType: 'vm',
          resourceId: '100',
          resourceData: JSON.stringify({ status: 'running', uptime: 30 }),
          changeType: 'updated'
        }
      });

      // Verify state change tracking
      const snapshots = await dbClient.client.stateSnapshot.findMany({
        where: { resourceId: '100' },
        orderBy: { snapshotTime: 'asc' }
      });

      expect(snapshots).toHaveLength(2);
      expect(snapshots[0].changeType).toBe('discovered');
      expect(snapshots[1].changeType).toBe('updated');

      const initialData = JSON.parse(snapshots[0].resourceData);
      const updatedData = JSON.parse(snapshots[1].resourceData);
      expect(initialData.status).toBe('stopped');
      expect(updatedData.status).toBe('running');
    });
  });

  describe('performance and constraints', () => {
    it('should handle bulk operations efficiently', async () => {
      // Create node first
      await dbClient.client.node.create({
        data: { id: 'bulk-node', status: 'online' }
      });

      // Create multiple VMs at once
      const vmData = Array.from({ length: 10 }, (_, i) => ({
        id: 1000 + i,
        nodeId: 'bulk-node',
        name: `bulk-vm-${i}`,
        status: 'stopped',
        cpuCores: 1
      }));

      await dbClient.client.vM.createMany({
        data: vmData
      });

      // Verify all created
      const vmCount = await dbClient.client.vM.count({
        where: { nodeId: 'bulk-node' }
      });

      expect(vmCount).toBe(10);

      // Test bulk update
      await dbClient.client.vM.updateMany({
        where: { nodeId: 'bulk-node' },
        data: { status: 'running' }
      });

      const runningVMs = await dbClient.client.vM.count({
        where: { nodeId: 'bulk-node', status: 'running' }
      });

      expect(runningVMs).toBe(10);
    });

    it('should enforce foreign key constraints', async () => {
      // Try to create VM without parent node - should fail
      await expect(
        dbClient.client.vM.create({
          data: {
            id: 999,
            nodeId: 'non-existent-node',
            name: 'orphan-vm',
            status: 'stopped'
          }
        })
      ).rejects.toThrow();
    });

    it('should handle concurrent operations', async () => {
      // Create node
      await dbClient.client.node.create({
        data: { id: 'concurrent-node', status: 'online' }
      });

      // Simulate concurrent VM creation
      const concurrentOps = Array.from({ length: 5 }, (_, i) =>
        dbClient.client.vM.create({
          data: {
            id: 2000 + i,
            nodeId: 'concurrent-node',
            name: `concurrent-vm-${i}`,
            status: 'stopped'
          }
        })
      );

      // All should succeed
      const results = await Promise.all(concurrentOps);
      expect(results).toHaveLength(5);

      // Verify all created
      const totalVMs = await dbClient.client.vM.count({
        where: { nodeId: 'concurrent-node' }
      });
      expect(totalVMs).toBe(5);
    });
  });
});