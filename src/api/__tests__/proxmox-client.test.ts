/**
 * Unit tests for Proxmox API client
 */

import axios from 'axios';
import { ProxmoxClient } from '../proxmox-client';
import { ProxmoxConfig, ProxmoxResponse, VersionInfo, NodeInfo } from '../../types';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ProxmoxClient', () => {
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

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock axios instance
    mockAxiosInstance = {
      get: jest.fn(),
      post: jest.fn(),
      defaults: {
        headers: {
          common: {}
        }
      }
    };
    
    mockedAxios.create.mockReturnValue(mockAxiosInstance);
    
    client = new ProxmoxClient(testConfig);
  });

  describe('constructor', () => {
    it('should create axios instance with correct base URL', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'https://test.proxmox.local:8006/api2/json',
          timeout: 10000,
        })
      );
    });

    it('should set authentication header when token provided', () => {
      expect(mockAxiosInstance.defaults.headers.common['Authorization'])
        .toBe('PVEAPIToken=root@pam!test-token=secret-value');
    });

    it('should handle SSL certificate configuration', () => {
      const createCall = mockedAxios.create.mock.calls[0]?.[0];
      expect(createCall?.httpsAgent).toBeDefined();
    });
  });

  describe('getVersion', () => {
    const mockVersionResponse: ProxmoxResponse<VersionInfo> = {
      data: {
        version: '8.1.4',
        release: '8.1',
        repoid: 'abc123'
      }
    };

    it('should return version information', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: mockVersionResponse });

      const result = await client.getVersion();
      
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/version');
      expect(result).toEqual(mockVersionResponse.data);
    });

    it('should handle API errors in response', async () => {
      const errorResponse: ProxmoxResponse = {
        data: null,
        errors: { version: 'Permission denied' }
      };
      
      mockAxiosInstance.get.mockResolvedValue({ data: errorResponse });

      await expect(client.getVersion()).rejects.toThrow('API Error: Permission denied');
    });

    it('should handle HTTP errors', async () => {
      const httpError = {
        response: { status: 401, data: { message: 'Unauthorized' } },
        message: 'Request failed'
      };
      
      mockAxiosInstance.get.mockRejectedValue(httpError);

      await expect(client.getVersion()).rejects.toThrow('Failed to get version information: HTTP 401 - Unauthorized');
    });
  });

  describe('getNodes', () => {
    const mockNodesResponse: ProxmoxResponse<NodeInfo[]> = {
      data: [
        {
          node: 'pve1',
          status: 'online',
          cpu: 0.15,
          maxcpu: 4,
          mem: 2048000000,
          maxmem: 8192000000,
          uptime: 86400
        }
      ]
    };

    it('should return list of nodes', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: mockNodesResponse });

      const result = await client.getNodes();
      
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/nodes');
      expect(result).toEqual(mockNodesResponse.data);
      expect(result).toHaveLength(1);
      expect(result[0].node).toBe('pve1');
    });
  });

  describe('connect', () => {
    it('should return success when connection works', async () => {
      const versionResponse: ProxmoxResponse<VersionInfo> = {
        data: { version: '8.1.4', release: '8.1', repoid: 'abc123' }
      };
      const nodesResponse: ProxmoxResponse<NodeInfo[]> = {
        data: [{ node: 'pve', status: 'online', cpu: 0, maxcpu: 4, mem: 1000, maxmem: 8000, uptime: 1000 }]
      };

      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: versionResponse })
        .mockResolvedValueOnce({ data: nodesResponse });

      const result = await client.connect();

      expect(result.success).toBe(true);
      expect(result.version).toBe('8.1.4');
      expect(result.node).toBe('pve');
      expect(result.details).toBeDefined();
    });

    it('should handle connection network error', async () => {
      const networkError = { 
        code: 'ECONNREFUSED',
        message: 'connect ECONNREFUSED' 
      };
      mockAxiosInstance.get.mockRejectedValue(networkError);

      const result = await client.connect();

      expect(result.success).toBe(false);
      expect(result.error).toContain('ECONNREFUSED'); // This is what actually gets returned
    });

    it('should handle connection timeout error', async () => {
      const timeoutError = { 
        code: 'ETIMEDOUT',
        message: 'timeout of 10000ms exceeded'
      };
      mockAxiosInstance.get.mockRejectedValue(timeoutError);

      const result = await client.connect();

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout of 10000ms exceeded');
    });

    it('should handle HTTP authentication error', async () => {
      const authError = { 
        response: { status: 401 },
        message: 'Request failed with status code 401'
      };
      mockAxiosInstance.get.mockRejectedValue(authError);

      const result = await client.connect();

      expect(result.success).toBe(false);
      expect(result.error).toContain('HTTP 401'); // This matches our error handling
    });
  });

  describe('getConfigSummary', () => {
    it('should return config without sensitive data', () => {
      const summary = client.getConfigSummary();
      
      expect(summary).toEqual({
        host: 'test.proxmox.local',
        port: 8006,
        username: 'root@pam',
        node: 'pve',
        rejectUnauthorized: false
      });
      
      expect(summary).not.toHaveProperty('tokenSecret');
      expect(summary).not.toHaveProperty('password');
    });
  });
});