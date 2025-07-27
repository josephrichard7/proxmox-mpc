/**
 * VM Lifecycle Integration Tests
 * End-to-end testing of VM creation, start, stop, and deletion
 */

import { 
  setupTestEnvironment, 
  cleanupTestEnvironment, 
  TestEnvironment,
  waitForCondition,
  generateTestId,
  validateResource,
  PerformanceTimer
} from './test-utils';
import { VMCreateConfig } from '../../types';

describe('VM Lifecycle Integration Tests', () => {
  let testEnv: TestEnvironment;
  const testPort = 8007;

  beforeAll(async () => {
    testEnv = await setupTestEnvironment(testPort);
  });

  afterAll(async () => {
    await cleanupTestEnvironment(testEnv);
  });

  beforeEach(() => {
    // Clear mock server data between tests
    testEnv.mockServer.clearData();
  });

  describe('VM Creation', () => {
    it('should create a VM successfully', async () => {
      const vmid = generateTestId('vm');
      const vmConfig: VMCreateConfig = {
        vmid,
        name: `test-vm-${vmid}`,
        cores: 2,
        memory: 2048,
        ostype: 'l26',
        storage: 'local-lvm'
      };

      const result = await testEnv.client.createVM('pve-node1', vmConfig);

      expect(result).toBeDefined();
      expect(result.vmid).toBe(vmid);
      expect(result.node).toBe('pve-node1');
      expect(result.upid).toMatch(/^UPID:/);
      expect(result.task.status).toBe('running');

      // Wait for creation to complete
      await waitForCondition(
        async () => {
          const vm = testEnv.mockServer.getVM('pve-node1', vmid);
          return vm !== undefined;
        },
        { timeout: 10000, timeoutError: 'VM was not created within timeout' }
      );

      // Verify VM exists in mock server
      const createdVM = testEnv.mockServer.getVM('pve-node1', vmid);
      expect(createdVM).toBeDefined();
      expect(createdVM!.name).toBe(vmConfig.name);
      expect(createdVM!.status).toBe('stopped');
    });

    it('should fail to create VM with duplicate ID', async () => {
      const vmid = 100; // This ID exists in mock server by default
      const vmConfig: VMCreateConfig = {
        vmid,
        name: `duplicate-vm-${vmid}`,
        cores: 1,
        memory: 512
      };

      await expect(testEnv.client.createVM('pve-node1', vmConfig))
        .rejects
        .toThrow('VM with ID 100 already exists');
    });

    it('should wait for VM creation with waitForVMCreation', async () => {
      const vmid = generateTestId('vm');
      const vmConfig: VMCreateConfig = {
        vmid,
        name: `wait-test-vm-${vmid}`,
        cores: 1,
        memory: 1024
      };

      // Create VM and wait for completion
      await testEnv.client.createVM('pve-node1', vmConfig);
      
      const vm = await testEnv.client.waitForVMCreation('pve-node1', vmid, 15000);
      
      expect(vm).toBeDefined();
      expect(vm.vmid).toBe(vmid);
      expect(vm.name).toBe(vmConfig.name);
      expect(vm.status).toBe('stopped');
    });
  });

  describe('VM Lifecycle Operations', () => {
    let vmid: number;

    beforeEach(async () => {
      // Create a test VM for each test
      vmid = generateTestId('vm');
      const vmConfig: VMCreateConfig = {
        vmid,
        name: `lifecycle-test-vm-${vmid}`,
        cores: 2,
        memory: 1024
      };

      await testEnv.client.createVM('pve-node1', vmConfig);
      
      // Wait for creation
      await waitForCondition(
        async () => {
          const vm = testEnv.mockServer.getVM('pve-node1', vmid);
          return vm !== undefined;
        },
        { timeout: 10000 }
      );
    });

    it('should complete full VM lifecycle: create → start → stop → delete', async () => {
      const timer = new PerformanceTimer();
      timer.start();

      // 1. Verify VM is created and stopped
      timer.checkpoint('verify-created');
      let validation = await validateResource(testEnv.client, 'vm', 'pve-node1', vmid, 'stopped');
      expect(validation.exists).toBe(true);
      expect(validation.status).toBe('stopped');

      // 2. Start VM
      timer.checkpoint('start-initiated');
      const startTask = await testEnv.client.startVM('pve-node1', vmid);
      expect(startTask.upid).toMatch(/^UPID:/);

      // Wait for VM to start
      await testEnv.client.waitForVMStatus('pve-node1', vmid, 'running', 15000);
      timer.checkpoint('start-completed');

      validation = await validateResource(testEnv.client, 'vm', 'pve-node1', vmid, 'running');
      expect(validation.status).toBe('running');

      // 3. Stop VM
      timer.checkpoint('stop-initiated');
      const stopTask = await testEnv.client.stopVM('pve-node1', vmid);
      expect(stopTask.upid).toMatch(/^UPID:/);

      // Wait for VM to stop
      await testEnv.client.waitForVMStatus('pve-node1', vmid, 'stopped', 15000);
      timer.checkpoint('stop-completed');

      validation = await validateResource(testEnv.client, 'vm', 'pve-node1', vmid, 'stopped');
      expect(validation.status).toBe('stopped');

      // 4. Delete VM
      timer.checkpoint('delete-initiated');
      const deleteTask = await testEnv.client.deleteVM('pve-node1', vmid);
      expect(deleteTask.upid).toMatch(/^UPID:/);

      // Wait for VM to be deleted
      await waitForCondition(
        async () => {
          const vm = testEnv.mockServer.getVM('pve-node1', vmid);
          return vm === undefined;
        },
        { timeout: 10000, timeoutError: 'VM was not deleted within timeout' }
      );
      
      timer.checkpoint('delete-completed');
      const totalDuration = timer.end();

      // Verify VM no longer exists
      validation = await validateResource(testEnv.client, 'vm', 'pve-node1', vmid);
      expect(validation.exists).toBe(false);

      // Performance assertions
      expect(totalDuration).toBeLessThan(60000); // Should complete within 1 minute
      console.log(`Full VM lifecycle completed in ${totalDuration}ms`);
      console.log(`  Create → Start: ${timer.getCheckpointInterval('verify-created', 'start-completed')}ms`);
      console.log(`  Start → Stop: ${timer.getCheckpointInterval('start-completed', 'stop-completed')}ms`);
      console.log(`  Stop → Delete: ${timer.getCheckpointInterval('stop-completed', 'delete-completed')}ms`);
    });

    it('should handle graceful VM shutdown', async () => {
      // Start VM first
      await testEnv.client.startVM('pve-node1', vmid);
      await testEnv.client.waitForVMStatus('pve-node1', vmid, 'running', 10000);

      // Graceful shutdown
      const shutdownTask = await testEnv.client.shutdownVM('pve-node1', vmid);
      expect(shutdownTask.upid).toMatch(/^UPID:/);

      // Wait for shutdown
      await testEnv.client.waitForVMStatus('pve-node1', vmid, 'stopped', 15000);

      const validation = await validateResource(testEnv.client, 'vm', 'pve-node1', vmid, 'stopped');
      expect(validation.status).toBe('stopped');
    });

    it('should handle VM reboot', async () => {
      // Start VM first
      await testEnv.client.startVM('pve-node1', vmid);
      await testEnv.client.waitForVMStatus('pve-node1', vmid, 'running', 10000);

      // Reboot VM
      const rebootTask = await testEnv.client.rebootVM('pve-node1', vmid);
      expect(rebootTask.upid).toMatch(/^UPID:/);

      // Wait a moment for reboot to initiate, then verify it's running again
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const validation = await validateResource(testEnv.client, 'vm', 'pve-node1', vmid);
      expect(validation.status).toBe('running');
    });
  });

  describe('VM Status and Configuration', () => {
    let vmid: number;

    beforeEach(async () => {
      vmid = 101; // Use existing VM from mock server
    });

    it('should retrieve VM status correctly', async () => {
      const vmStatus = await testEnv.client.getVMStatus('pve-node1', vmid);

      expect(vmStatus).toBeDefined();
      expect(vmStatus.vmid).toBe(vmid);
      expect(vmStatus.node).toBe('pve-node1');
      expect(vmStatus.status).toMatch(/^(running|stopped|paused)$/);
      expect(vmStatus.name).toBeDefined();
    });

    it('should retrieve VM configuration', async () => {
      const vmConfig = await testEnv.client.getVMConfig('pve-node1', vmid);

      expect(vmConfig).toBeDefined();
      expect(vmConfig.cores).toBeGreaterThan(0);
      expect(vmConfig.memory).toBeGreaterThan(0);
      expect(vmConfig.name).toBeDefined();
    });

    it('should list all VMs on node', async () => {
      const vms = await testEnv.client.getVMs('pve-node1');

      expect(Array.isArray(vms)).toBe(true);
      expect(vms.length).toBeGreaterThan(0);
      
      const testVM = vms.find(vm => vm.vmid === vmid);
      expect(testVM).toBeDefined();
      expect(testVM!.node).toBe('pve-node1');
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent VM operations gracefully', async () => {
      const nonExistentVMID = 99999;

      // Test various operations with non-existent VM
      await expect(testEnv.client.getVMStatus('pve-node1', nonExistentVMID))
        .rejects
        .toThrow('not found');

      await expect(testEnv.client.startVM('pve-node1', nonExistentVMID))
        .rejects
        .toThrow('not found');

      await expect(testEnv.client.stopVM('pve-node1', nonExistentVMID))
        .rejects
        .toThrow('not found');

      await expect(testEnv.client.deleteVM('pve-node1', nonExistentVMID))
        .rejects
        .toThrow('not found');
    });

    it('should handle invalid node operations', async () => {
      const vmid = 100;
      const invalidNode = 'non-existent-node';

      await expect(testEnv.client.getVMStatus(invalidNode, vmid))
        .rejects
        .toThrow();

      await expect(testEnv.client.startVM(invalidNode, vmid))
        .rejects
        .toThrow();
    });

    it('should handle state conflicts appropriately', async () => {
      const vmid = 100; // Stopped VM

      // Try to stop already stopped VM
      await expect(testEnv.client.stopVM('pve-node1', vmid))
        .rejects
        .toThrow('already stopped');

      // Start VM then try to start again
      await testEnv.client.startVM('pve-node1', vmid);
      await testEnv.client.waitForVMStatus('pve-node1', vmid, 'running', 10000);

      await expect(testEnv.client.startVM('pve-node1', vmid))
        .rejects
        .toThrow('already running');
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle multiple VM operations concurrently', async () => {
      const vmCount = 3;
      const vmids: number[] = [];
      const timer = new PerformanceTimer();

      // Create multiple VMs concurrently
      timer.start();
      const createPromises = Array.from({ length: vmCount }, async (_, index) => {
        const vmid = generateTestId(`concurrent-${index}`);
        vmids.push(vmid);
        
        const vmConfig: VMCreateConfig = {
          vmid,
          name: `concurrent-vm-${vmid}`,
          cores: 1,
          memory: 512
        };

        return testEnv.client.createVM('pve-node1', vmConfig);
      });

      const createResults = await Promise.all(createPromises);
      timer.checkpoint('all-created');

      expect(createResults).toHaveLength(vmCount);
      createResults.forEach((result, index) => {
        expect(result.vmid).toBe(vmids[index]);
      });

      // Wait for all VMs to be created
      await Promise.all(vmids.map(vmid =>
        waitForCondition(
          async () => {
            const vm = testEnv.mockServer.getVM('pve-node1', vmid);
            return vm !== undefined;
          },
          { timeout: 15000 }
        )
      ));

      // Start all VMs concurrently
      const startPromises = vmids.map(vmid => testEnv.client.startVM('pve-node1', vmid));
      await Promise.all(startPromises);
      timer.checkpoint('all-started');

      // Wait for all to be running
      await Promise.all(vmids.map(vmid =>
        testEnv.client.waitForVMStatus('pve-node1', vmid, 'running', 15000)
      ));

      // Stop all VMs concurrently
      const stopPromises = vmids.map(vmid => testEnv.client.stopVM('pve-node1', vmid));
      await Promise.all(stopPromises);

      // Wait for all to be stopped
      await Promise.all(vmids.map(vmid =>
        testEnv.client.waitForVMStatus('pve-node1', vmid, 'stopped', 15000)
      ));

      // Delete all VMs concurrently
      const deletePromises = vmids.map(vmid => testEnv.client.deleteVM('pve-node1', vmid));
      await Promise.all(deletePromises);
      timer.checkpoint('all-deleted');

      const totalDuration = timer.end();
      console.log(`Concurrent operations on ${vmCount} VMs completed in ${totalDuration}ms`);

      // Verify all VMs are deleted
      for (const vmid of vmids) {
        await waitForCondition(
          async () => {
            const vm = testEnv.mockServer.getVM('pve-node1', vmid);
            return vm === undefined;
          },
          { timeout: 10000 }
        );
      }
    });
  });

  describe('Performance Benchmarks', () => {
    it('should meet performance expectations for VM operations', async () => {
      const timer = new PerformanceTimer();
      const vmid = generateTestId('perf');
      
      const vmConfig: VMCreateConfig = {
        vmid,
        name: `performance-test-vm-${vmid}`,
        cores: 1,
        memory: 512
      };

      // Measure create operation
      timer.start();
      await testEnv.client.createVM('pve-node1', vmConfig);
      await waitForCondition(
        async () => testEnv.mockServer.getVM('pve-node1', vmid) !== undefined,
        { timeout: 10000 }
      );
      const createTime = timer.checkpoint('create');
      const createDuration = timer.getCheckpointDuration('create');

      // Measure start operation
      await testEnv.client.startVM('pve-node1', vmid);
      await testEnv.client.waitForVMStatus('pve-node1', vmid, 'running', 10000);
      const startTime = timer.checkpoint('start');
      const startDuration = startTime - createTime;

      // Measure stop operation
      await testEnv.client.stopVM('pve-node1', vmid);
      await testEnv.client.waitForVMStatus('pve-node1', vmid, 'stopped', 10000);
      const stopTime = timer.checkpoint('stop');
      const stopDuration = stopTime - startTime;

      // Measure delete operation
      await testEnv.client.deleteVM('pve-node1', vmid);
      await waitForCondition(
        async () => testEnv.mockServer.getVM('pve-node1', vmid) === undefined,
        { timeout: 10000 }
      );
      const endTime = timer.end();
      const deleteDuration = endTime - stopTime;

      // Performance assertions (these are for mock server, real server would be slower)
      expect(createDuration).toBeLessThan(5000); // 5 seconds
      expect(startDuration).toBeLessThan(3000);  // 3 seconds
      expect(stopDuration).toBeLessThan(2000);   // 2 seconds  
      expect(deleteDuration).toBeLessThan(3000); // 3 seconds

      console.log('VM Operation Performance:');
      console.log(`  Create: ${createDuration}ms`);
      console.log(`  Start:  ${startDuration}ms`);
      console.log(`  Stop:   ${stopDuration}ms`);
      console.log(`  Delete: ${deleteDuration}ms`);
    });
  });
});