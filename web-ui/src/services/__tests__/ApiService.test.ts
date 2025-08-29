/**
 * ApiService Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import * as ApiService from '../ApiService';

// Mock axios
vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() }
      }
    }))
  }
}));

const mockAxios = vi.mocked(axios);
const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPut = vi.fn();
const mockDelete = vi.fn();

// Setup mock axios instance
mockAxios.create.mockReturnValue({
  get: mockGet,
  post: mockPost,
  put: mockPut,
  delete: mockDelete,
  interceptors: {
    request: { use: vi.fn() },
    response: { use: vi.fn() }
  }
} as any);

describe('ApiService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('VMs API', () => {
    describe('getVMs', () => {
      it('fetches VMs with default parameters', async () => {
        const mockResponse = {
          data: {
            success: true,
            data: {
              vms: [],
              pagination: { page: 1, limit: 10, total: 0, totalPages: 0 }
            }
          }
        };

        mockGet.mockResolvedValueOnce(mockResponse);

        const result = await ApiService.vms.getVMs();

        expect(mockGet).toHaveBeenCalledWith('/vms', {
          params: {
            page: 1,
            limit: 10
          }
        });
        expect(result).toEqual(mockResponse.data);
      });

      it('fetches VMs with custom parameters', async () => {
        const params = {
          page: 2,
          limit: 20,
          search: 'test',
          status: 'running' as const,
          node: 'pve',
          sortBy: 'name' as const,
          sortOrder: 'desc' as const
        };

        mockGet.mockResolvedValueOnce({
          data: { success: true, data: { vms: [], pagination: {} } }
        });

        await ApiService.vms.getVMs(params);

        expect(mockGet).toHaveBeenCalledWith('/vms', {
          params
        });
      });

      it('handles API errors', async () => {
        const error = new Error('API Error');
        mockGet.mockRejectedValueOnce(error);

        await expect(ApiService.vms.getVMs()).rejects.toThrow('API Error');
      });
    });

    describe('getVM', () => {
      it('fetches specific VM by ID', async () => {
        const vmId = 100;
        const mockResponse = {
          data: {
            success: true,
            data: { vm: { id: vmId, name: 'test-vm' } }
          }
        };

        mockGet.mockResolvedValueOnce(mockResponse);

        const result = await ApiService.vms.getVM(vmId);

        expect(mockGet).toHaveBeenCalledWith(`/vms/${vmId}`);
        expect(result).toEqual(mockResponse.data);
      });

      it('handles VM not found', async () => {
        mockGet.mockRejectedValueOnce({
          response: { status: 404, data: { message: 'VM not found' } }
        });

        await expect(ApiService.vms.getVM(999)).rejects.toThrow();
      });
    });

    describe('createVM', () => {
      const vmData = {
        name: 'test-vm',
        node: 'pve',
        memory: 2048,
        cores: 2,
        disk: 20,
        description: 'Test VM'
      };

      it('creates VM with valid data', async () => {
        const mockResponse = {
          data: {
            success: true,
            data: { vm: { id: 100, ...vmData } }
          }
        };

        mockPost.mockResolvedValueOnce(mockResponse);

        const result = await ApiService.vms.createVM(vmData);

        expect(mockPost).toHaveBeenCalledWith('/vms', vmData);
        expect(result).toEqual(mockResponse.data);
      });

      it('handles validation errors', async () => {
        mockPost.mockRejectedValueOnce({
          response: {
            status: 400,
            data: { success: false, message: 'Name is required' }
          }
        });

        await expect(ApiService.vms.createVM(vmData)).rejects.toThrow();
      });
    });

    describe('VM lifecycle operations', () => {
      const vmId = 100;

      it('starts VM', async () => {
        mockPost.mockResolvedValueOnce({
          data: { success: true }
        });

        const result = await ApiService.vms.startVM(vmId);

        expect(mockPost).toHaveBeenCalledWith(`/vms/${vmId}/start`);
        expect(result.success).toBe(true);
      });

      it('stops VM', async () => {
        mockPost.mockResolvedValueOnce({
          data: { success: true }
        });

        const result = await ApiService.vms.stopVM(vmId);

        expect(mockPost).toHaveBeenCalledWith(`/vms/${vmId}/stop`);
        expect(result.success).toBe(true);
      });

      it('restarts VM', async () => {
        mockPost.mockResolvedValueOnce({
          data: { success: true }
        });

        const result = await ApiService.vms.restartVM(vmId);

        expect(mockPost).toHaveBeenCalledWith(`/vms/${vmId}/restart`);
        expect(result.success).toBe(true);
      });

      it('handles VM operation failures', async () => {
        mockPost.mockRejectedValueOnce({
          response: {
            status: 400,
            data: { message: 'VM is already running' }
          }
        });

        await expect(ApiService.vms.startVM(vmId)).rejects.toThrow();
      });
    });

    describe('updateVM', () => {
      it('updates VM with valid data', async () => {
        const vmId = 100;
        const updateData = { name: 'updated-vm', memory: 4096 };
        const mockResponse = {
          data: {
            success: true,
            data: { vm: { id: vmId, ...updateData } }
          }
        };

        mockPut.mockResolvedValueOnce(mockResponse);

        const result = await ApiService.vms.updateVM(vmId, updateData);

        expect(mockPut).toHaveBeenCalledWith(`/vms/${vmId}`, updateData);
        expect(result).toEqual(mockResponse.data);
      });
    });

    describe('deleteVM', () => {
      it('deletes VM successfully', async () => {
        const vmId = 100;
        mockDelete.mockResolvedValueOnce({
          data: { success: true }
        });

        const result = await ApiService.vms.deleteVM(vmId);

        expect(mockDelete).toHaveBeenCalledWith(`/vms/${vmId}`);
        expect(result.success).toBe(true);
      });

      it('handles protected VM deletion', async () => {
        mockDelete.mockRejectedValueOnce({
          response: {
            status: 400,
            data: { message: 'VM is protected from deletion' }
          }
        });

        await expect(ApiService.vms.deleteVM(100)).rejects.toThrow();
      });
    });
  });

  describe('Containers API', () => {
    it('fetches containers', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            containers: [],
            pagination: { page: 1, limit: 10, total: 0, totalPages: 0 }
          }
        }
      };

      mockGet.mockResolvedValueOnce(mockResponse);

      const result = await ApiService.containers.getContainers();

      expect(mockGet).toHaveBeenCalledWith('/containers', {
        params: { page: 1, limit: 10 }
      });
      expect(result).toEqual(mockResponse.data);
    });

    it('performs container lifecycle operations', async () => {
      const containerId = 200;

      mockPost.mockResolvedValueOnce({ data: { success: true } });
      await ApiService.containers.startContainer(containerId);
      expect(mockPost).toHaveBeenCalledWith(`/containers/${containerId}/start`);

      mockPost.mockResolvedValueOnce({ data: { success: true } });
      await ApiService.containers.stopContainer(containerId);
      expect(mockPost).toHaveBeenCalledWith(`/containers/${containerId}/stop`);
    });
  });

  describe('Nodes API', () => {
    it('fetches cluster nodes', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            nodes: [
              {
                node: 'pve',
                status: 'online',
                uptime: 3600000,
                cpu: 0.15,
                memory: { used: 8589934592, total: 17179869184 }
              }
            ]
          }
        }
      };

      mockGet.mockResolvedValueOnce(mockResponse);

      const result = await ApiService.nodes.getNodes();

      expect(mockGet).toHaveBeenCalledWith('/nodes');
      expect(result).toEqual(mockResponse.data);
    });

    it('fetches specific node details', async () => {
      const nodeName = 'pve';
      const mockResponse = {
        data: {
          success: true,
          data: { node: { node: nodeName, status: 'online' } }
        }
      };

      mockGet.mockResolvedValueOnce(mockResponse);

      const result = await ApiService.nodes.getNode(nodeName);

      expect(mockGet).toHaveBeenCalledWith(`/nodes/${nodeName}`);
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('Infrastructure API', () => {
    it('triggers infrastructure sync', async () => {
      mockPost.mockResolvedValueOnce({
        data: { success: true, message: 'Sync started' }
      });

      const result = await ApiService.infrastructure.syncInfrastructure();

      expect(mockPost).toHaveBeenCalledWith('/infrastructure/sync');
      expect(result.success).toBe(true);
    });

    it('fetches sync status', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            status: 'running',
            progress: 50,
            phase: 'vms'
          }
        }
      };

      mockGet.mockResolvedValueOnce(mockResponse);

      const result = await ApiService.infrastructure.getSyncStatus();

      expect(mockGet).toHaveBeenCalledWith('/infrastructure/sync/status');
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('Error handling', () => {
    it('handles network errors', async () => {
      mockGet.mockRejectedValueOnce(new Error('Network Error'));

      await expect(ApiService.vms.getVMs()).rejects.toThrow('Network Error');
    });

    it('handles HTTP errors with response data', async () => {
      const errorResponse = {
        response: {
          status: 500,
          data: { message: 'Internal Server Error' }
        }
      };

      mockGet.mockRejectedValueOnce(errorResponse);

      await expect(ApiService.vms.getVMs()).rejects.toEqual(errorResponse);
    });

    it('handles timeout errors', async () => {
      mockGet.mockRejectedValueOnce({ code: 'ECONNABORTED' });

      await expect(ApiService.vms.getVMs()).rejects.toThrow();
    });
  });
});