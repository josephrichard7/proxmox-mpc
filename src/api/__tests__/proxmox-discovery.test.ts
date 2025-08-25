/**
 * Tests for Proxmox resource discovery endpoints
 */

import { ProxmoxConfig, VMInfo, ContainerInfo, StorageInfo, TaskInfo } from '../../types';
import { ProxmoxClient } from '../proxmox-client';

// Mock axios
jest.mock('axios');
const mockedAxios = require('axios');

describe('ProxmoxClient Discovery Methods', () => {
  let client: ProxmoxClient;
  let mockConfig: ProxmoxConfig;

  beforeEach(() => {
    mockConfig = {
      host: 'test.example.com',
      port: 8006,
      username: 'test@pve',
      tokenId: 'test-token',
      tokenSecret: 'secret-value',
      node: 'pve-node1',
      rejectUnauthorized: false,
    };

    // Reset mocks
    jest.clearAllMocks();
    
    // Mock axios.create to return a mock client
    const mockHttpClient = {
      get: jest.fn(),
      defaults: { headers: { common: {} } }
    };
    mockedAxios.create.mockReturnValue(mockHttpClient);
    
    client = new ProxmoxClient(mockConfig);
  });

  describe('VM Discovery', () => {
    it('should get list of VMs from a node', async () => {
      const mockVMs: VMInfo[] = [
        {
          vmid: 100,
          name: 'test-vm-1',
          status: 'running',
          node: 'pve-node1',
          cpu: 0.02,
          maxmem: 2147483648,
          mem: 1073741824,
          uptime: 86400,
          template: false
        },
        {
          vmid: 101,
          name: 'test-vm-2',
          status: 'stopped',
          node: 'pve-node1',
          maxmem: 4294967296,
          mem: 0,
          template: false
        }
      ];

      const mockHttpClient = mockedAxios.create();
      mockHttpClient.get.mockResolvedValue({
        data: { data: mockVMs }
      });

      const result = await client.getVMs('pve-node1');

      expect(mockHttpClient.get).toHaveBeenCalledWith('/nodes/pve-node1/qemu');
      expect(result).toEqual(mockVMs.map(vm => ({ ...vm, node: 'pve-node1' })));
      expect(result).toHaveLength(2);
      expect(result[0].vmid).toBe(100);
      expect(result[1].vmid).toBe(101);
    });

    it('should get VM status', async () => {
      const mockVMStatus: VMInfo = {
        vmid: 100,
        name: 'test-vm',
        status: 'running',
        node: 'pve-node1',
        cpu: 0.05,
        maxmem: 2147483648,
        mem: 1073741824,
        uptime: 86400,
        pid: 12345
      };

      const mockHttpClient = mockedAxios.create();
      mockHttpClient.get.mockResolvedValue({
        data: { data: mockVMStatus }
      });

      const result = await client.getVMStatus('pve-node1', 100);

      expect(mockHttpClient.get).toHaveBeenCalledWith('/nodes/pve-node1/qemu/100/status/current');
      expect(result.vmid).toBe(100);
      expect(result.node).toBe('pve-node1');
      expect(result.status).toBe('running');
    });

    it('should get VM configuration', async () => {
      const mockVMConfig = {
        vmid: 100,
        name: 'test-vm',
        cores: 2,
        memory: 2048,
        boot: 'cdn',
        ostype: 'l26',
        ide0: 'local:vm-100-disk-0,size=32G',
        net0: 'virtio=00:11:22:33:44:55,bridge=vmbr0'
      };

      const mockHttpClient = mockedAxios.create();
      mockHttpClient.get.mockResolvedValue({
        data: { data: mockVMConfig }
      });

      const result = await client.getVMConfig('pve-node1', 100);

      expect(mockHttpClient.get).toHaveBeenCalledWith('/nodes/pve-node1/qemu/100/config');
      expect(result.vmid).toBe(100);
      expect(result.cores).toBe(2);
      expect(result.memory).toBe(2048);
    });

    it('should handle VM API errors', async () => {
      const mockHttpClient = mockedAxios.create();
      mockHttpClient.get.mockRejectedValue({
        response: {
          status: 404,
          data: { message: 'VM not found' }
        }
      });

      await expect(client.getVMStatus('pve-node1', 999))
        .rejects.toThrow('Failed to get status for VM 999 on node pve-node1: HTTP 404 - VM not found');
    });
  });

  describe('Container Discovery', () => {
    it('should get list of containers from a node', async () => {
      const mockContainers: ContainerInfo[] = [
        {
          vmid: 200,
          name: 'test-ct-1',
          status: 'running',
          node: 'pve-node1',
          cpu: 0.01,
          maxmem: 536870912,
          mem: 268435456,
          uptime: 43200,
          template: false
        },
        {
          vmid: 201,
          name: 'test-ct-2',
          status: 'stopped',
          node: 'pve-node1',
          maxmem: 1073741824,
          mem: 0,
          template: false
        }
      ];

      const mockHttpClient = mockedAxios.create();
      mockHttpClient.get.mockResolvedValue({
        data: { data: mockContainers }
      });

      const result = await client.getContainers('pve-node1');

      expect(mockHttpClient.get).toHaveBeenCalledWith('/nodes/pve-node1/lxc');
      expect(result).toEqual(mockContainers.map(ct => ({ ...ct, node: 'pve-node1' })));
      expect(result).toHaveLength(2);
      expect(result[0].vmid).toBe(200);
      expect(result[1].vmid).toBe(201);
    });

    it('should get container status', async () => {
      const mockContainerStatus: ContainerInfo = {
        vmid: 200,
        name: 'test-container',
        status: 'running',
        node: 'pve-node1',
        cpu: 0.03,
        maxmem: 536870912,
        mem: 268435456,
        uptime: 43200
      };

      const mockHttpClient = mockedAxios.create();
      mockHttpClient.get.mockResolvedValue({
        data: { data: mockContainerStatus }
      });

      const result = await client.getContainerStatus('pve-node1', 200);

      expect(mockHttpClient.get).toHaveBeenCalledWith('/nodes/pve-node1/lxc/200/status/current');
      expect(result.vmid).toBe(200);
      expect(result.node).toBe('pve-node1');
      expect(result.status).toBe('running');
    });

    it('should get container configuration', async () => {
      const mockContainerConfig = {
        vmid: 200,
        hostname: 'test-container',
        cores: 1,
        memory: 512,
        swap: 0,
        ostemplate: 'local:vztmpl/debian-11-standard_11.3-1_amd64.tar.zst',
        rootfs: 'local:vm-200-disk-0,size=8G',
        net0: 'name=eth0,bridge=vmbr0,ip=dhcp'
      };

      const mockHttpClient = mockedAxios.create();
      mockHttpClient.get.mockResolvedValue({
        data: { data: mockContainerConfig }
      });

      const result = await client.getContainerConfig('pve-node1', 200);

      expect(mockHttpClient.get).toHaveBeenCalledWith('/nodes/pve-node1/lxc/200/config');
      expect(result.vmid).toBe(200);
      expect(result.cores).toBe(1);
      expect(result.memory).toBe(512);
    });
  });

  describe('Storage Discovery', () => {
    it('should get list of storage pools', async () => {
      const mockStoragePools: StorageInfo[] = [
        {
          storage: 'local',
          type: 'dir',
          content: 'backup,iso,vztmpl',
          enabled: true,
          shared: false,
          total: 100000000000,
          used: 20000000000,
          avail: 80000000000
        },
        {
          storage: 'local-lvm',
          type: 'lvm',
          content: 'images,rootdir',
          enabled: true,
          shared: false,
          total: 500000000000,
          used: 100000000000,
          avail: 400000000000
        }
      ];

      const mockHttpClient = mockedAxios.create();
      mockHttpClient.get.mockResolvedValue({
        data: { data: mockStoragePools }
      });

      const result = await client.getStoragePools();

      expect(mockHttpClient.get).toHaveBeenCalledWith('/storage');
      expect(result).toEqual(mockStoragePools);
      expect(result).toHaveLength(2);
      expect(result[0].storage).toBe('local');
      expect(result[1].storage).toBe('local-lvm');
    });

    it('should get node storage', async () => {
      const mockNodeStorage: StorageInfo[] = [
        {
          storage: 'local',
          type: 'dir',
          total: 100000000000,
          used: 20000000000,
          avail: 80000000000,
          enabled: true
        }
      ];

      const mockHttpClient = mockedAxios.create();
      mockHttpClient.get.mockResolvedValue({
        data: { data: mockNodeStorage }
      });

      const result = await client.getNodeStorage('pve-node1');

      expect(mockHttpClient.get).toHaveBeenCalledWith('/nodes/pve-node1/storage');
      expect(result).toEqual(mockNodeStorage);
      expect(result[0].storage).toBe('local');
    });

    it('should get storage content', async () => {
      const mockStorageContent = [
        {
          volid: 'local:iso/debian-11.0.0-amd64-netinst.iso',
          content: 'iso',
          format: 'iso',
          size: 396361728,
          ctime: 1625097600
        },
        {
          volid: 'local:vztmpl/debian-11-standard_11.3-1_amd64.tar.zst',
          content: 'vztmpl',
          format: 'tgz',
          size: 140509184,
          ctime: 1650384000
        }
      ];

      const mockHttpClient = mockedAxios.create();
      mockHttpClient.get.mockResolvedValue({
        data: { data: mockStorageContent }
      });

      const result = await client.getStorageContent('pve-node1', 'local');

      expect(mockHttpClient.get).toHaveBeenCalledWith('/nodes/pve-node1/storage/local/content');
      expect(result).toEqual(mockStorageContent);
      expect(result).toHaveLength(2);
    });
  });

  describe('Task Monitoring', () => {
    it('should get list of tasks', async () => {
      const mockTasks: TaskInfo[] = [
        {
          upid: 'UPID:pve-node1:00001234:12345678:qmstart:100:test@pve:',
          node: 'pve-node1',
          pid: 1234,
          type: 'qmstart',
          id: '100',
          user: 'test@pve',
          status: 'running',
          starttime: 1640995200
        },
        {
          upid: 'UPID:pve-node1:00001235:12345679:vzstart:200:test@pve:',
          node: 'pve-node1',
          pid: 1235,
          type: 'vzstart',
          id: '200',
          user: 'test@pve',
          status: 'OK',
          starttime: 1640995100,
          endtime: 1640995150,
          exitstatus: 'OK'
        }
      ];

      const mockHttpClient = mockedAxios.create();
      mockHttpClient.get.mockResolvedValue({
        data: { data: mockTasks }
      });

      const result = await client.getTasks('pve-node1');

      expect(mockHttpClient.get).toHaveBeenCalledWith('/nodes/pve-node1/tasks');
      expect(result).toEqual(mockTasks.map(task => ({ ...task, node: 'pve-node1' })));
      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('qmstart');
      expect(result[1].type).toBe('vzstart');
    });

    it('should get task status', async () => {
      const mockTaskStatus: TaskInfo = {
        upid: 'UPID:pve-node1:00001234:12345678:qmstart:100:test@pve:',
        node: 'pve-node1',
        pid: 1234,
        type: 'qmstart',
        id: '100',
        user: 'test@pve',
        status: 'running',
        starttime: 1640995200
      };

      const mockHttpClient = mockedAxios.create();
      mockHttpClient.get.mockResolvedValue({
        data: { data: mockTaskStatus }
      });

      const upid = 'UPID:pve-node1:00001234:12345678:qmstart:100:test@pve:';
      const result = await client.getTaskStatus('pve-node1', upid);

      expect(mockHttpClient.get).toHaveBeenCalledWith(`/nodes/pve-node1/tasks/${upid}/status`);
      expect(result.upid).toBe(upid);
      expect(result.node).toBe('pve-node1');
      expect(result.status).toBe('running');
    });

    it('should get task log', async () => {
      const mockTaskLog = [
        { n: 1, t: 'starting task UPID:pve-node1:00001234:12345678:qmstart:100:test@pve:' },
        { n: 2, t: 'Starting VM 100' },
        { n: 3, t: 'VM 100 started successfully' }
      ];

      const expectedLog = [
        'starting task UPID:pve-node1:00001234:12345678:qmstart:100:test@pve:',
        'Starting VM 100',
        'VM 100 started successfully'
      ];

      const mockHttpClient = mockedAxios.create();
      mockHttpClient.get.mockResolvedValue({
        data: { data: mockTaskLog }
      });

      const upid = 'UPID:pve-node1:00001234:12345678:qmstart:100:test@pve:';
      const result = await client.getTaskLog('pve-node1', upid);

      expect(mockHttpClient.get).toHaveBeenCalledWith(`/nodes/pve-node1/tasks/${upid}/log`);
      expect(result).toEqual(expectedLog);
      expect(result).toHaveLength(3);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      const mockHttpClient = mockedAxios.create();
      mockHttpClient.get.mockRejectedValue(new Error('Network Error'));

      await expect(client.getVMs('pve-node1'))
        .rejects.toThrow('Failed to get VMs for node pve-node1: Network Error');
    });

    it('should handle API errors with status codes', async () => {
      const mockHttpClient = mockedAxios.create();
      mockHttpClient.get.mockRejectedValue({
        response: {
          status: 500,
          data: { message: 'Internal Server Error' }
        }
      });

      await expect(client.getStoragePools())
        .rejects.toThrow('Failed to get storage pools: HTTP 500 - Internal Server Error');
    });

    it('should handle API response with errors field', async () => {
      const mockHttpClient = mockedAxios.create();
      mockHttpClient.get.mockResolvedValue({
        data: {
          data: null,
          errors: {
            'vm': 'VM does not exist'
          }
        }
      });

      await expect(client.getVMStatus('pve-node1', 999))
        .rejects.toThrow('API Error: VM does not exist');
    });
  });
});