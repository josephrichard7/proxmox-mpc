/**
 * Proxmox VE API Client
 * Handles authentication, requests, and response processing
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import https from 'https';
import { 
  ProxmoxConfig, 
  ProxmoxResponse, 
  ConnectionResult, 
  VersionInfo, 
  NodeInfo,
  VMInfo,
  VMConfig,
  ContainerInfo,
  ContainerConfig,
  StorageInfo,
  StorageContent,
  TaskInfo
} from '../types';

export class ProxmoxClient {
  private config: ProxmoxConfig;
  private httpClient: AxiosInstance;

  constructor(config: ProxmoxConfig) {
    this.config = config;
    this.httpClient = this.createHttpClient();
  }

  /**
   * Create configured HTTP client with authentication and SSL handling
   */
  private createHttpClient(): AxiosInstance {
    const baseURL = `https://${this.config.host}:${this.config.port}/api2/json`;
    
    // Create HTTPS agent for SSL certificate handling
    const httpsAgent = new https.Agent({
      rejectUnauthorized: this.config.rejectUnauthorized ?? false // Default to false for homelab
    });

    const client = axios.create({
      baseURL,
      httpsAgent,
      timeout: 10000, // 10 second timeout
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add authentication header if token is provided
    if (this.config.tokenId && this.config.tokenSecret) {
      client.defaults.headers.common['Authorization'] = 
        `PVEAPIToken=${this.config.username}!${this.config.tokenId}=${this.config.tokenSecret}`;
    }

    return client;
  }

  /**
   * Test basic connectivity to Proxmox server
   */
  async connect(): Promise<ConnectionResult> {
    try {
      const version = await this.getVersion();
      const nodes = await this.getNodes();
      
      return {
        success: true,
        version: version.version,
        node: this.config.node,
        details: {
          version,
          nodes: nodes.length,
          endpoint: `${this.config.host}:${this.config.port}`
        }
      };
    } catch (error) {
      return this.handleConnectionError(error);
    }
  }

  /**
   * Get Proxmox VE version information
   */
  async getVersion(): Promise<VersionInfo> {
    try {
      const response = await this.httpClient.get<ProxmoxResponse<VersionInfo>>('/version');
      return this.extractData(response.data);
    } catch (error) {
      throw this.handleApiError(error, 'Failed to get version information');
    }
  }

  /**
   * Get list of cluster nodes
   */
  async getNodes(): Promise<NodeInfo[]> {
    try {
      const response = await this.httpClient.get<ProxmoxResponse<NodeInfo[]>>('/nodes');
      return this.extractData(response.data);
    } catch (error) {
      throw this.handleApiError(error, 'Failed to get node list');
    }
  }

  /**
   * Get specific node status
   */
  async getNodeStatus(node: string): Promise<NodeInfo> {
    try {
      const response = await this.httpClient.get<ProxmoxResponse<NodeInfo>>(`/nodes/${node}/status`);
      return this.extractData(response.data);
    } catch (error) {
      throw this.handleApiError(error, `Failed to get status for node ${node}`);
    }
  }

  /**
   * Extract data from Proxmox API response format
   */
  private extractData<T>(response: ProxmoxResponse<T>): T {
    if (response.errors) {
      const errorMessage = Object.values(response.errors).join(', ');
      throw new Error(`API Error: ${errorMessage}`);
    }
    
    if (response.data === null || response.data === undefined) {
      throw new Error('API returned null data');
    }
    
    return response.data;
  }

  /**
   * Handle connection errors with specific error types
   */
  private handleConnectionError(error: any): ConnectionResult {
    if (error.code === 'ENOTFOUND') {
      return {
        success: false,
        error: `Cannot resolve hostname: ${this.config.host}`,
      };
    }
    
    if (error.code === 'ECONNREFUSED') {
      return {
        success: false,
        error: `Connection refused to ${this.config.host}:${this.config.port}`,
      };
    }
    
    if (error.code === 'ETIMEDOUT') {
      return {
        success: false,
        error: `Connection timeout to ${this.config.host}:${this.config.port}`,
      };
    }
    
    if (error.code === 'CERT_HAS_EXPIRED' || error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
      return {
        success: false,
        error: 'SSL certificate error (try setting rejectUnauthorized: false for homelab)',
      };
    }

    if (error.response?.status === 401) {
      return {
        success: false,
        error: 'Authentication failed - check token ID and secret',
      };
    }

    if (error.response?.status === 403) {
      return {
        success: false,
        error: 'Permission denied - check token permissions',
      };
    }

    return {
      success: false,
      error: error.message || 'Unknown connection error',
    };
  }

  /**
   * Handle API errors with context
   */
  private handleApiError(error: any, context: string): Error {
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.message || error.message;
      
      return new Error(`${context}: HTTP ${status} - ${message}`);
    }
    
    return new Error(`${context}: ${error.message || 'Unknown error'}`);
  }

  // ===== VM DISCOVERY METHODS =====

  /**
   * Get list of VMs on a specific node
   */
  async getVMs(node: string): Promise<VMInfo[]> {
    try {
      const response = await this.httpClient.get<ProxmoxResponse<VMInfo[]>>(`/nodes/${node}/qemu`);
      const vms = this.extractData(response.data);
      
      // Add node information to each VM
      return vms.map(vm => ({ ...vm, node }));
    } catch (error) {
      throw this.handleApiError(error, `Failed to get VMs for node ${node}`);
    }
  }

  /**
   * Get current status of a specific VM
   */
  async getVMStatus(node: string, vmid: number): Promise<VMInfo> {
    try {
      const response = await this.httpClient.get<ProxmoxResponse<VMInfo>>(`/nodes/${node}/qemu/${vmid}/status/current`);
      const vm = this.extractData(response.data);
      
      // Ensure node information is included
      return { ...vm, node, vmid };
    } catch (error) {
      throw this.handleApiError(error, `Failed to get status for VM ${vmid} on node ${node}`);
    }
  }

  /**
   * Get configuration of a specific VM
   */
  async getVMConfig(node: string, vmid: number): Promise<VMConfig> {
    try {
      const response = await this.httpClient.get<ProxmoxResponse<VMConfig>>(`/nodes/${node}/qemu/${vmid}/config`);
      const config = this.extractData(response.data);
      
      // Ensure vmid is included
      return { ...config, vmid };
    } catch (error) {
      throw this.handleApiError(error, `Failed to get config for VM ${vmid} on node ${node}`);
    }
  }

  // ===== CONTAINER DISCOVERY METHODS =====

  /**
   * Get list of containers on a specific node
   */
  async getContainers(node: string): Promise<ContainerInfo[]> {
    try {
      const response = await this.httpClient.get<ProxmoxResponse<ContainerInfo[]>>(`/nodes/${node}/lxc`);
      const containers = this.extractData(response.data);
      
      // Add node information to each container
      return containers.map(container => ({ ...container, node }));
    } catch (error) {
      throw this.handleApiError(error, `Failed to get containers for node ${node}`);
    }
  }

  /**
   * Get current status of a specific container
   */
  async getContainerStatus(node: string, vmid: number): Promise<ContainerInfo> {
    try {
      const response = await this.httpClient.get<ProxmoxResponse<ContainerInfo>>(`/nodes/${node}/lxc/${vmid}/status/current`);
      const container = this.extractData(response.data);
      
      // Ensure node information is included
      return { ...container, node, vmid };
    } catch (error) {
      throw this.handleApiError(error, `Failed to get status for container ${vmid} on node ${node}`);
    }
  }

  /**
   * Get configuration of a specific container
   */
  async getContainerConfig(node: string, vmid: number): Promise<ContainerConfig> {
    try {
      const response = await this.httpClient.get<ProxmoxResponse<ContainerConfig>>(`/nodes/${node}/lxc/${vmid}/config`);
      const config = this.extractData(response.data);
      
      // Ensure vmid is included
      return { ...config, vmid };
    } catch (error) {
      throw this.handleApiError(error, `Failed to get config for container ${vmid} on node ${node}`);
    }
  }

  // ===== STORAGE DISCOVERY METHODS =====

  /**
   * Get list of all storage pools in the cluster
   */
  async getStoragePools(): Promise<StorageInfo[]> {
    try {
      const response = await this.httpClient.get<ProxmoxResponse<StorageInfo[]>>('/storage');
      return this.extractData(response.data);
    } catch (error) {
      throw this.handleApiError(error, 'Failed to get storage pools');
    }
  }

  /**
   * Get storage accessible from a specific node
   */
  async getNodeStorage(node: string): Promise<StorageInfo[]> {
    try {
      const response = await this.httpClient.get<ProxmoxResponse<StorageInfo[]>>(`/nodes/${node}/storage`);
      return this.extractData(response.data);
    } catch (error) {
      throw this.handleApiError(error, `Failed to get storage for node ${node}`);
    }
  }

  /**
   * Get content of a specific storage pool
   */
  async getStorageContent(node: string, storage: string): Promise<StorageContent[]> {
    try {
      const response = await this.httpClient.get<ProxmoxResponse<StorageContent[]>>(`/nodes/${node}/storage/${storage}/content`);
      return this.extractData(response.data);
    } catch (error) {
      throw this.handleApiError(error, `Failed to get content for storage ${storage} on node ${node}`);
    }
  }

  // ===== TASK MONITORING METHODS =====

  /**
   * Get list of tasks (running and recent) on a specific node
   */
  async getTasks(node: string): Promise<TaskInfo[]> {
    try {
      const response = await this.httpClient.get<ProxmoxResponse<TaskInfo[]>>(`/nodes/${node}/tasks`);
      const tasks = this.extractData(response.data);
      
      // Ensure node information is included
      return tasks.map(task => ({ ...task, node }));
    } catch (error) {
      throw this.handleApiError(error, `Failed to get tasks for node ${node}`);
    }
  }

  /**
   * Get status of a specific task
   */
  async getTaskStatus(node: string, upid: string): Promise<TaskInfo> {
    try {
      const response = await this.httpClient.get<ProxmoxResponse<TaskInfo>>(`/nodes/${node}/tasks/${upid}/status`);
      const task = this.extractData(response.data);
      
      // Ensure node and upid information is included
      return { ...task, node, upid };
    } catch (error) {
      throw this.handleApiError(error, `Failed to get status for task ${upid} on node ${node}`);
    }
  }

  /**
   * Get execution log of a specific task
   */
  async getTaskLog(node: string, upid: string): Promise<string[]> {
    try {
      const response = await this.httpClient.get<ProxmoxResponse<Array<{ n: number; t: string }>>>(`/nodes/${node}/tasks/${upid}/log`);
      const logEntries = this.extractData(response.data);
      
      // Extract just the text content from log entries
      return logEntries.map(entry => entry.t);
    } catch (error) {
      throw this.handleApiError(error, `Failed to get log for task ${upid} on node ${node}`);
    }
  }

  /**
   * Get current configuration (without sensitive data)
   */
  getConfigSummary(): Partial<ProxmoxConfig> {
    return {
      host: this.config.host,
      port: this.config.port,
      username: this.config.username,
      node: this.config.node,
      rejectUnauthorized: this.config.rejectUnauthorized,
    };
  }
}