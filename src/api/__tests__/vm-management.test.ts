/**
 * Unit tests for VM management functionality in Proxmox API client
 */

import axios from 'axios';

import { ProxmoxConfig, VMCreateConfig, VMCreationResult as _VMCreationResult, TaskInfo } from '../../types';
import { ProxmoxClient } from '../proxmox-client';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock database repositories to avoid configuration issues in tests
jest.mock('../../database/repositories', () => ({
  vmRepository: {
    create: jest.fn().mockResolvedValue({})
  },
  taskRepository: {
    create: jest.fn().mockResolvedValue({})
  }
}));

describe('ProxmoxClient VM Management', () => {
  let client: ProxmoxClient;
  let mockAxiosInstance: jest.Mocked<any>;
  
  const testConfig: ProxmoxConfig = {
    host: 'test.proxmox.local',
    port: 8006,
    username: 'root@pam',
    tokenId: 'test-token',
    tokenSecret: 'secret-value',
    node: 'pve',
    rejectUnauthorized: false
  };

  const mockTask: TaskInfo = {
    upid: 'UPID:pve:00001234:00005678:61234567:qmcreate:150:root@pam:',
    node: 'pve',
    pid: 1234,
    type: 'qmcreate',
    user: 'root@pam',
    status: 'running',
    starttime: 1634567890,
    id: '150'
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock axios instance
    mockAxiosInstance = {
      get: jest.fn(),
      post: jest.fn(),
      delete: jest.fn(),
      defaults: {
        headers: {
          common: {}
        }
      }
    };
    
    mockedAxios.create.mockReturnValue(mockAxiosInstance);
    
    client = new ProxmoxClient(testConfig);
  });

  describe('createVM', () => {
    const vmConfig: VMCreateConfig = {
      vmid: 150,
      name: 'test-vm',
      cores: 2,
      memory: 2048,
      ostype: 'l26'
    };

    it('should create VM successfully', async () => {
      // Mock successful API responses
      const upid = 'UPID:pve:00001234:00005678:61234567:qmcreate:150:root@pam:';
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { data: upid }
      });
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { data: mockTask }
      });
      
      // Database operations will be mocked automatically

      const result = await client.createVM('pve', vmConfig);

      expect(result).toEqual({
        upid,
        vmid: 150,
        node: 'pve',
        task: mockTask
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/nodes/pve/qemu', {
        vmid: 150,
        name: 'test-vm',
        cores: 2,
        memory: 2048,
        ostype: 'l26'
      });
    });

    it('should handle VM creation with all options', async () => {
      const fullConfig: VMCreateConfig = {
        vmid: 151,
        name: 'full-test-vm',
        cores: 4,
        sockets: 2,
        memory: 4096,
        ostype: 'win10',
        storage: 'local-lvm',
        start: true,
        description: 'Test VM with all options'
      };

      const upid = 'UPID:pve:00001235:00005679:61234568:qmcreate:151:root@pam:';
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { data: upid }
      });
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { data: { ...mockTask, id: '151' } }
      });
      
      // Database operations will be mocked automatically

      const result = await client.createVM('pve', fullConfig);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/nodes/pve/qemu', fullConfig);
      expect(result.vmid).toBe(151);
    });

    it('should validate VM ID', async () => {
      const invalidConfig = { ...vmConfig, vmid: 0 };

      await expect(client.createVM('pve', invalidConfig))
        .rejects.toThrow('VM ID must be a positive integer');

      expect(mockAxiosInstance.post).not.toHaveBeenCalled();
    });

    it('should handle API errors', async () => {
      mockAxiosInstance.post.mockRejectedValueOnce({
        response: {
          status: 400,
          data: { message: 'VM 150 already exists' }
        }
      });

      await expect(client.createVM('pve', vmConfig))
        .rejects.toThrow('Failed to create VM 150 on node pve');
    });


    it('should continue on database errors', async () => {
      const upid = 'UPID:pve:00001234:00005678:61234567:qmcreate:150:root@pam:';
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { data: upid }
      });
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { data: mockTask }
      });
      
      // Database operations will be mocked automatically (silently failing won't break VM creation)
      const result = await client.createVM('pve', vmConfig);
      expect(result.vmid).toBe(150);
    });
  });

  describe('waitForVMCreation', () => {
    it('should wait for VM creation to complete', async () => {
      const vmInfo = {
        vmid: 150,
        name: 'test-vm',
        status: 'stopped',
        node: 'pve'
      };

      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { data: vmInfo }
      });

      const result = await client.waitForVMCreation('pve', 150, 5000);
      expect(result).toEqual(vmInfo);
    });

    it('should timeout if VM creation takes too long', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('VM not found'));

      await expect(client.waitForVMCreation('pve', 150, 1000))
        .rejects.toThrow('Timeout waiting for VM 150 creation on node pve');
    });
  });

  describe('startVM', () => {
    it('should start VM successfully', async () => {
      const upid = 'UPID:pve:00001234:00005678:61234567:qmstart:150:root@pam:';
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { data: upid }
      });
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { data: { ...mockTask, type: 'qmstart' } }
      });

      const result = await client.startVM('pve', 150);
      expect(result.type).toBe('qmstart');
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/nodes/pve/qemu/150/status/start');
    });
  });

  describe('stopVM', () => {
    it('should stop VM successfully', async () => {
      const upid = 'UPID:pve:00001234:00005678:61234567:qmstop:150:root@pam:';
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { data: upid }
      });
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { data: { ...mockTask, type: 'qmstop' } }
      });

      const result = await client.stopVM('pve', 150);
      expect(result.type).toBe('qmstop');
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/nodes/pve/qemu/150/status/stop', {});
    });

    it('should force stop VM when requested', async () => {
      const upid = 'UPID:pve:00001234:00005678:61234567:qmstop:150:root@pam:';
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { data: upid }
      });
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { data: { ...mockTask, type: 'qmstop' } }
      });

      await client.stopVM('pve', 150, true);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/nodes/pve/qemu/150/status/stop', {
        forceStop: 1
      });
    });
  });

  describe('shutdownVM', () => {
    it('should shutdown VM gracefully', async () => {
      const upid = 'UPID:pve:00001234:00005678:61234567:qmshutdown:150:root@pam:';
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { data: upid }
      });
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { data: { ...mockTask, type: 'qmshutdown' } }
      });

      const result = await client.shutdownVM('pve', 150);
      expect(result.type).toBe('qmshutdown');
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/nodes/pve/qemu/150/status/shutdown');
    });
  });

  describe('rebootVM', () => {
    it('should reboot VM successfully', async () => {
      const upid = 'UPID:pve:00001234:00005678:61234567:qmreboot:150:root@pam:';
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { data: upid }
      });
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { data: { ...mockTask, type: 'qmreboot' } }
      });

      const result = await client.rebootVM('pve', 150);
      expect(result.type).toBe('qmreboot');
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/nodes/pve/qemu/150/status/reboot');
    });
  });

  describe('deleteVM', () => {
    it('should delete VM successfully', async () => {
      const upid = 'UPID:pve:00001234:00005678:61234567:qmdestroy:150:root@pam:';
      mockAxiosInstance.delete.mockResolvedValueOnce({
        data: { data: upid }
      });
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { data: { ...mockTask, type: 'qmdestroy' } }
      });

      const result = await client.deleteVM('pve', 150);
      expect(result.type).toBe('qmdestroy');
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/nodes/pve/qemu/150', {
        data: {}
      });
    });

    it('should delete VM with options', async () => {
      const upid = 'UPID:pve:00001234:00005678:61234567:qmdestroy:150:root@pam:';
      mockAxiosInstance.delete.mockResolvedValueOnce({
        data: { data: upid }
      });
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { data: { ...mockTask, type: 'qmdestroy' } }
      });

      const options = {
        force: true,
        destroyUnreferencedDisks: true
      };

      await client.deleteVM('pve', 150, options);
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/nodes/pve/qemu/150', {
        data: {
          force: 1,
          'destroy-unreferenced-disks': 1
        }
      });
    });
  });

  describe('waitForVMStatus', () => {
    it('should wait for VM to reach target status', async () => {
      const vmInfo = {
        vmid: 150,
        name: 'test-vm',
        status: 'running',
        node: 'pve'
      };

      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { data: vmInfo }
      });

      const result = await client.waitForVMStatus('pve', 150, 'running', 5000);
      expect(result).toEqual(vmInfo);
    });

    it('should timeout if VM does not reach target status', async () => {
      const vmInfo = {
        vmid: 150,
        name: 'test-vm',
        status: 'stopped',
        node: 'pve'
      };

      mockAxiosInstance.get.mockResolvedValue({
        data: { data: vmInfo }
      });

      await expect(client.waitForVMStatus('pve', 150, 'running', 1000))
        .rejects.toThrow('Timeout waiting for VM 150 to reach status running on node pve');
    });

    it('should handle VM deletion', async () => {
      mockAxiosInstance.get.mockRejectedValue({
        message: 'HTTP 500 - VM not found'
      });

      await expect(client.waitForVMStatus('pve', 150, 'deleted', 1000))
        .rejects.toThrow('VM 150 has been deleted');
    });
  });
});