/**
 * API Service for Proxmox-MPC Web Interface
 * 
 * Centralized service for making HTTP requests to the backend API.
 * Handles authentication, error handling, and response formatting.
 */

import axios, { AxiosResponse, AxiosError } from 'axios';

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Infrastructure Types
export interface InfrastructureStatus {
  summary: {
    vms: {
      total: number;
      running: number;
      stopped: number;
      percentage: number;
    };
    containers: {
      total: number;
      running: number;
      stopped: number;
      percentage: number;
    };
    nodes: {
      total: number;
      online: number;
      offline: number;
      percentage: number;
    };
    resources: {
      memory: {
        used: number;
        total: number;
        available: number;
        percentage: number;
      };
      storage: {
        used: number;
        total: number;
        available: number;
        percentage: number;
      };
    };
  };
  nodes: NodeDetail[];
  lastUpdated: string;
}

export interface NodeDetail {
  name: string;
  status: string;
  vms: number;
  containers: number;
  cpu: {
    usage: number;
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  storage: {
    used: number;
    total: number;
    percentage: number;
  };
  uptime: number;
  lastSeen: string | null;
}

// VM Types
export interface VM {
  id: number;
  name: string;
  description?: string;
  status: string;
  node: string;
  memory: number;
  cores: number;
  disk: number;
  template?: string;
  uptime: number;
  cpuUsage: number;
  memoryUsage: number;
  diskUsage?: number;
  networkIn?: number;
  networkOut?: number;
  tags: string[];
  startOnBoot: boolean;
  protection: boolean;
  createdAt: string;
  updatedAt: string;
  liveStatus?: any;
}

export interface CreateVMRequest {
  name: string;
  description?: string;
  node: string;
  memory: number;
  cores: number;
  disk?: number;
  template?: string;
  tags?: string[];
  startOnBoot?: boolean;
  protection?: boolean;
}

export interface UpdateVMRequest {
  name?: string;
  description?: string;
  memory?: number;
  cores?: number;
  tags?: string[];
  startOnBoot?: boolean;
  protection?: boolean;
}

// Container Types
export interface Container {
  id: number;
  name: string;
  description?: string;
  status: string;
  node: string;
  template: string;
  memory: number;
  disk: number;
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  networkIn: number;
  networkOut: number;
  uptime: number;
  tags: string[];
  unprivileged: boolean;
  protection: boolean;
  startOnBoot: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateContainerRequest {
  name: string;
  description?: string;
  node: string;
  template: string;
  memory: number;
  disk: number;
  tags?: string[];
  unprivileged?: boolean;
  protection?: boolean;
  startOnBoot?: boolean;
}

// Node Types
export interface Node {
  id: string;
  name: string;
  status: string;
  type: string;
  level: string;
  uptime: number;
  cpuUsage: number;
  memoryTotal: number;
  memoryUsed: number;
  storageTotal: number;
  storageUsed: number;
  version: string;
  subscription: string;
  lastSeen: string | null;
  createdAt: string;
  updatedAt: string;
}

// Query Parameters
export interface ListQueryParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  search?: string;
  status?: string;
  node?: string;
  tags?: string;
}

class ApiService {
  private baseURL: string;

  constructor() {
    this.baseURL = import.meta.env.VITE_API_URL || '/api';
    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor to add auth token
    axios.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('accessToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    axios.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          // Token expired or invalid
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    data?: any,
    params?: any
  ): Promise<ApiResponse<T>> {
    try {
      const config = {
        method,
        url: `${this.baseURL}${endpoint}`,
        data,
        params,
      };

      const response: AxiosResponse<ApiResponse<T>> = await axios(config);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.data) {
        return error.response.data;
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Infrastructure API
  async getInfrastructureStatus(): Promise<ApiResponse<InfrastructureStatus>> {
    return this.request<InfrastructureStatus>('GET', '/infrastructure/status');
  }

  async syncInfrastructure(data?: { 
    proxmoxServer?: string; 
    node?: string; 
    cleanup?: boolean;
  }): Promise<ApiResponse> {
    return this.request('POST', '/infrastructure/sync', data);
  }

  // VM API
  async getVMs(params?: ListQueryParams): Promise<ApiResponse<{ vms: VM[]; pagination: any }>> {
    return this.request('GET', '/vms', undefined, params);
  }

  async getVM(id: string): Promise<ApiResponse<{ vm: VM }>> {
    return this.request<{ vm: VM }>('GET', `/vms/${id}`);
  }

  async createVM(data: CreateVMRequest): Promise<ApiResponse<{ vm: VM }>> {
    return this.request<{ vm: VM }>('POST', '/vms', data);
  }

  async updateVM(id: string, data: UpdateVMRequest): Promise<ApiResponse<{ vm: VM }>> {
    return this.request<{ vm: VM }>('PUT', `/vms/${id}`, data);
  }

  async deleteVM(id: string): Promise<ApiResponse> {
    return this.request('DELETE', `/vms/${id}`);
  }

  async startVM(id: string): Promise<ApiResponse> {
    return this.request('POST', `/vms/${id}/start`);
  }

  async stopVM(id: string): Promise<ApiResponse> {
    return this.request('POST', `/vms/${id}/stop`);
  }

  async restartVM(id: string): Promise<ApiResponse> {
    return this.request('POST', `/vms/${id}/restart`);
  }

  // Container API
  async getContainers(params?: ListQueryParams): Promise<ApiResponse<{ containers: Container[]; pagination: any }>> {
    return this.request('GET', '/containers', undefined, params);
  }

  async getContainer(id: string): Promise<ApiResponse<{ container: Container }>> {
    return this.request<{ container: Container }>('GET', `/containers/${id}`);
  }

  async createContainer(data: CreateContainerRequest): Promise<ApiResponse<{ container: Container }>> {
    return this.request<{ container: Container }>('POST', '/containers', data);
  }

  async updateContainer(id: string, data: Partial<CreateContainerRequest>): Promise<ApiResponse<{ container: Container }>> {
    return this.request<{ container: Container }>('PUT', `/containers/${id}`, data);
  }

  async deleteContainer(id: string): Promise<ApiResponse> {
    return this.request('DELETE', `/containers/${id}`);
  }

  async startContainer(id: string): Promise<ApiResponse> {
    return this.request('POST', `/containers/${id}/start`);
  }

  async stopContainer(id: string): Promise<ApiResponse> {
    return this.request('POST', `/containers/${id}/stop`);
  }

  async restartContainer(id: string): Promise<ApiResponse> {
    return this.request('POST', `/containers/${id}/restart`);
  }

  // Node API
  async getNodes(params?: ListQueryParams): Promise<ApiResponse<{ nodes: Node[]; pagination: any }>> {
    return this.request('GET', '/nodes', undefined, params);
  }

  async getNode(id: string): Promise<ApiResponse<{ node: Node }>> {
    return this.request<{ node: Node }>('GET', `/nodes/${id}`);
  }

  // Configuration/File Management API
  async getInfrastructureFiles(): Promise<AxiosResponse<any>> {
    const response = await axios.get(`${this.baseURL}/infrastructure/files`);
    return response;
  }

  async getFileContent(filePath: string): Promise<AxiosResponse<any>> {
    const response = await axios.get(`${this.baseURL}/infrastructure/files/${encodeURIComponent(filePath)}`);
    return response;
  }

  async saveFile(filePath: string, content: string): Promise<ApiResponse> {
    return this.request('PUT', `/infrastructure/files/${encodeURIComponent(filePath)}`, { content });
  }

  async createFile(parentPath: string, name: string, type: 'file' | 'directory'): Promise<ApiResponse> {
    return this.request('POST', '/infrastructure/files', { parentPath, name, type });
  }

  async deleteFile(filePath: string): Promise<ApiResponse> {
    return this.request('DELETE', `/infrastructure/files/${encodeURIComponent(filePath)}`);
  }

  async validateConfiguration(file: string, content: string, type: 'terraform' | 'ansible'): Promise<ApiResponse> {
    return this.request('POST', '/infrastructure/validate', { file, content, type });
  }

  async previewInfrastructure(): Promise<ApiResponse> {
    return this.request('POST', '/infrastructure/preview');
  }

  // Utility methods
  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  formatUptime(seconds: number): string {
    const days = Math.floor(seconds / (24 * 3600));
    const hours = Math.floor((seconds % (24 * 3600)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }
}

// Export singleton instance
export const apiService = new ApiService();
export default apiService;