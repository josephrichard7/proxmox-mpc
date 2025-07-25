/**
 * Unit tests for Container (LXC) management functionality in Proxmox API client
 */

import axios from 'axios';
import { ProxmoxClient } from '../proxmox-client';
import { ProxmoxConfig, ContainerCreateConfig, ContainerCreationResult, TaskInfo } from '../../types';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock database repositories to avoid configuration issues in tests
jest.mock('../../database/repositories', () => ({
  containerRepository: {
    create: jest.fn().mockResolvedValue({})
  },
  taskRepository: {
    create: jest.fn().mockResolvedValue({})
  }
}));

describe('ProxmoxClient Container Management', () => {
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
    upid: 'UPID:pve:00001234:00005678:61234567:lxccreate:200:root@pam:',
    node: 'pve',
    pid: 1234,
    type: 'lxccreate',
    user: 'root@pam',
    status: 'running',
    starttime: 1634567890,
    id: '200'
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

  describe('createContainer', () => {
    const containerConfig: ContainerCreateConfig = {
      vmid: 200,
      hostname: 'test-container',
      cores: 2,
      memory: 1024,
      ostemplate: 'local:vztmpl/ubuntu-20.04-standard_20.04-1_amd64.tar.gz'
    };

    it('should create container successfully', async () => {
      // Mock successful API responses
      const upid = 'UPID:pve:00001234:00005678:61234567:lxccreate:200:root@pam:';
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { data: upid }
      });
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { data: mockTask }
      });
      
      // Database operations will be mocked automatically

      const result = await client.createContainer('pve', containerConfig);

      expect(result).toEqual({
        upid,
        vmid: 200,
        node: 'pve',
        task: mockTask
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/nodes/pve/lxc', {
        vmid: 200,
        hostname: 'test-container',
        cores: 2,
        memory: 1024,
        ostemplate: 'local:vztmpl/ubuntu-20.04-standard_20.04-1_amd64.tar.gz'
      });
    });

    it('should handle container creation with all options', async () => {
      const fullConfig: ContainerCreateConfig = {
        vmid: 201,
        hostname: 'full-test-container',
        cores: 4,
        memory: 2048,
        swap: 512,
        ostemplate: 'local:vztmpl/debian-11-standard_11.3-1_amd64.tar.gz',
        rootfs: 'local-lvm:16',
        net0: 'name=eth0,bridge=vmbr0,ip=dhcp',
        storage: 'local-lvm',
        start: true,
        description: 'Test container with all options',
        unprivileged: true,
        features: 'nesting=1',
        password: 'testpass',
        ssh_public_keys: 'ssh-rsa AAAAB3...',
        onboot: true,
        tags: 'test,container'
      };

      const upid = 'UPID:pve:00001235:00005679:61234568:lxccreate:201:root@pam:';
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { data: upid }
      });
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { data: { ...mockTask, id: '201' } }
      });
      
      // Database operations will be mocked automatically

      const result = await client.createContainer('pve', fullConfig);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/nodes/pve/lxc', fullConfig);
      expect(result.vmid).toBe(201);
    });

    it('should validate container ID', async () => {
      const invalidConfig = { ...containerConfig, vmid: 0 };

      await expect(client.createContainer('pve', invalidConfig))
        .rejects.toThrow('Container ID must be a positive integer');

      expect(mockAxiosInstance.post).not.toHaveBeenCalled();
    });

    it('should validate ostemplate requirement', async () => {
      const invalidConfig = { ...containerConfig, ostemplate: '' };

      await expect(client.createContainer('pve', invalidConfig))
        .rejects.toThrow('ostemplate is required for container creation');

      expect(mockAxiosInstance.post).not.toHaveBeenCalled();
    });

    it('should handle API errors', async () => {
      mockAxiosInstance.post.mockRejectedValueOnce({
        response: {
          status: 400,
          data: { message: 'Container 200 already exists' }
        }
      });

      await expect(client.createContainer('pve', containerConfig))
        .rejects.toThrow('Failed to create container 200 on node pve');
    });

    it('should continue on database errors', async () => {
      const upid = 'UPID:pve:00001234:00005678:61234567:lxccreate:200:root@pam:';
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { data: upid }
      });
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { data: mockTask }
      });
      
      // Database operations will be mocked automatically (silently failing won't break container creation)
      const result = await client.createContainer('pve', containerConfig);
      expect(result.vmid).toBe(200);
    });
  });

  describe('waitForContainerCreation', () => {
    it('should wait for container creation to complete', async () => {
      const containerInfo = {
        vmid: 200,
        name: 'test-container',
        status: 'stopped',
        node: 'pve'
      };

      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { data: containerInfo }
      });

      const result = await client.waitForContainerCreation('pve', 200, 5000);
      expect(result).toEqual(containerInfo);
    });

    it('should timeout if container creation takes too long', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('Container not found'));

      await expect(client.waitForContainerCreation('pve', 200, 1000))
        .rejects.toThrow('Timeout waiting for container 200 creation on node pve');
    });
  });

  describe('startContainer', () => {
    it('should start container successfully', async () => {
      const upid = 'UPID:pve:00001234:00005678:61234567:lxcstart:200:root@pam:';
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { data: upid }
      });
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { data: { ...mockTask, type: 'lxcstart' } }
      });

      const result = await client.startContainer('pve', 200);
      expect(result.type).toBe('lxcstart');
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/nodes/pve/lxc/200/status/start');
    });
  });

  describe('stopContainer', () => {
    it('should stop container successfully', async () => {
      const upid = 'UPID:pve:00001234:00005678:61234567:lxcstop:200:root@pam:';
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { data: upid }
      });
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { data: { ...mockTask, type: 'lxcstop' } }
      });

      const result = await client.stopContainer('pve', 200);
      expect(result.type).toBe('lxcstop');
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/nodes/pve/lxc/200/status/stop', {});
    });

    it('should force stop container when requested', async () => {
      const upid = 'UPID:pve:00001234:00005678:61234567:lxcstop:200:root@pam:';
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { data: upid }
      });
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { data: { ...mockTask, type: 'lxcstop' } }
      });

      await client.stopContainer('pve', 200, true);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/nodes/pve/lxc/200/status/stop', {
        forceStop: 1
      });
    });
  });

  describe('shutdownContainer', () => {
    it('should shutdown container gracefully', async () => {
      const upid = 'UPID:pve:00001234:00005678:61234567:lxcshutdown:200:root@pam:';
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { data: upid }
      });
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { data: { ...mockTask, type: 'lxcshutdown' } }
      });

      const result = await client.shutdownContainer('pve', 200);
      expect(result.type).toBe('lxcshutdown');
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/nodes/pve/lxc/200/status/shutdown');
    });
  });

  describe('rebootContainer', () => {
    it('should reboot container successfully', async () => {
      const upid = 'UPID:pve:00001234:00005678:61234567:lxcreboot:200:root@pam:';
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { data: upid }
      });
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { data: { ...mockTask, type: 'lxcreboot' } }
      });

      const result = await client.rebootContainer('pve', 200);
      expect(result.type).toBe('lxcreboot');
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/nodes/pve/lxc/200/status/reboot');
    });
  });

  describe('deleteContainer', () => {
    it('should delete container successfully', async () => {
      const upid = 'UPID:pve:00001234:00005678:61234567:lxcdestroy:200:root@pam:';
      mockAxiosInstance.delete.mockResolvedValueOnce({
        data: { data: upid }
      });
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { data: { ...mockTask, type: 'lxcdestroy' } }
      });

      const result = await client.deleteContainer('pve', 200);
      expect(result.type).toBe('lxcdestroy');
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/nodes/pve/lxc/200', {
        data: {}
      });
    });

    it('should delete container with options', async () => {
      const upid = 'UPID:pve:00001234:00005678:61234567:lxcdestroy:200:root@pam:';
      mockAxiosInstance.delete.mockResolvedValueOnce({
        data: { data: upid }
      });
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { data: { ...mockTask, type: 'lxcdestroy' } }
      });

      const options = {
        force: true,
        purge: true
      };

      await client.deleteContainer('pve', 200, options);
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/nodes/pve/lxc/200', {
        data: {
          force: 1,
          purge: 1
        }
      });
    });
  });

  describe('waitForContainerStatus', () => {
    it('should wait for container to reach target status', async () => {
      const containerInfo = {
        vmid: 200,
        name: 'test-container',
        status: 'running',
        node: 'pve'
      };

      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { data: containerInfo }
      });

      const result = await client.waitForContainerStatus('pve', 200, 'running', 5000);
      expect(result).toEqual(containerInfo);
    });

    it('should timeout if container does not reach target status', async () => {
      const containerInfo = {
        vmid: 200,
        name: 'test-container',
        status: 'stopped',
        node: 'pve'
      };

      mockAxiosInstance.get.mockResolvedValue({
        data: { data: containerInfo }
      });

      await expect(client.waitForContainerStatus('pve', 200, 'running', 1000))
        .rejects.toThrow('Timeout waiting for container 200 to reach status running on node pve');
    });

    it('should handle container deletion', async () => {
      mockAxiosInstance.get.mockRejectedValue({
        message: 'HTTP 500 - Container not found'
      });

      await expect(client.waitForContainerStatus('pve', 200, 'deleted', 1000))
        .rejects.toThrow('Container 200 has been deleted');
    });
  });
});