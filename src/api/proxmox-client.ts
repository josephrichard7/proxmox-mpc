/**
 * Proxmox VE API Client
 * 
 * A comprehensive client for interacting with the Proxmox VE REST API.
 * Handles authentication, request/response processing, and provides
 * high-level methods for managing virtual machines and containers.
 * 
 * @example
 * ```typescript
 * const config: ProxmoxConfig = {
 *   host: 'pve.example.com',
 *   port: 8006,
 *   username: 'root@pam',
 *   tokenId: 'my-token',
 *   tokenSecret: 'secret-value',
 *   node: 'pve',
 *   rejectUnauthorized: true
 * };
 * 
 * const client = new ProxmoxClient(config);
 * const connection = await client.testConnection();
 * 
 * if (connection.success) {
 *   const vms = await client.getVMs();
 *   console.log('Available VMs:', vms);
 * }
 * ```
 */

import * as https from 'https';

import axios, { AxiosInstance, AxiosError as _AxiosError } from 'axios';

import { 
  vmRepository, 
  taskRepository, 
  containerRepository,
  type CreateVMInput, 
  type CreateTaskInput,
  type CreateContainerInput 
} from '../database/repositories';
import { Logger } from '../observability/logger';
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
  TaskInfo,
  VMCreateConfig,
  VMCreationResult,
  VMDeleteOptions,
  ContainerCreateConfig,
  ContainerCreationResult,
  ContainerDeleteOptions
} from '../types';

/**
 * Main Proxmox VE API client class
 * 
 * Provides a high-level interface for interacting with Proxmox VE servers,
 * including VM/container management, storage operations, and task monitoring.
 */
export class ProxmoxClient {
  private config: ProxmoxConfig;
  private httpClient: AxiosInstance;
  private logger = Logger.getInstance();

  /**
   * Create a new ProxmoxClient instance
   * 
   * @param config - Configuration object containing server details and authentication
   * @throws {Error} When configuration is invalid or incomplete
   * 
   * @example
   * ```typescript
   * const client = new ProxmoxClient({
   *   host: 'proxmox.example.com',
   *   port: 8006,
   *   username: 'admin@pve',
   *   tokenId: 'my-app',
   *   tokenSecret: 'secret-token',
   *   node: 'pve-node1',
   *   rejectUnauthorized: true
   * });
   * ```
   */
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
   * Test connectivity and authenticate with the Proxmox server
   * 
   * Performs a basic connectivity test by retrieving server version
   * and node information. This is typically the first method called
   * to verify that the client configuration is correct.
   * 
   * @returns Promise resolving to connection result with server details
   * @throws {ProxmoxApiError} When authentication fails or server is unreachable
   * 
   * @example
   * ```typescript
   * const result = await client.connect();
   * if (result.success) {
   *   console.log(`Connected to Proxmox ${result.version}`);
   *   console.log(`Available nodes: ${result.details.nodes}`);
   * } else {
   *   console.error('Connection failed:', result.error);
   * }
   * ```
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
   * 
   * Retrieves detailed version information about the Proxmox VE server,
   * including version number, release information, and repository details.
   * 
   * @returns Promise resolving to version information object
   * @throws {ProxmoxApiError} When API request fails or server is unreachable
   * 
   * @example
   * ```typescript
   * const version = await client.getVersion();
   * console.log(`Proxmox VE ${version.version}`);
   * console.log(`Release: ${version.release}`);
   * ```
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

  // ===== VM MANAGEMENT METHODS =====

  /**
   * Create a new virtual machine on the specified node
   * 
   * Creates a new VM with the provided configuration. The VM will be created
   * but not automatically started. Use startVM() to power on the VM after creation.
   * 
   * @param node - Name of the Proxmox node where the VM should be created
   * @param config - VM configuration including vmid, name, cores, memory, etc.
   * @returns Promise resolving to creation result with task information
   * @throws {ProxmoxApiError} When VM creation fails or configuration is invalid
   * 
   * @example
   * ```typescript
   * const vmConfig: VMCreateConfig = {
   *   vmid: 100,
   *   name: 'test-vm',
   *   cores: 2,
   *   memory: 2048,
   *   sockets: 1,
   *   ostype: 'l26',
   *   net0: 'virtio,bridge=vmbr0'
   * };
   * 
   * const result = await client.createVM('pve-node1', vmConfig);
   * console.log(`VM creation started: ${result.task}`);
   * 
   * // Wait for creation to complete
   * const vm = await client.waitForVMCreation('pve-node1', vmConfig.vmid);
   * console.log(`VM ${vm.name} created successfully`);
   * ```
   */
  async createVM(node: string, config: VMCreateConfig): Promise<VMCreationResult> {
    try {
      // Validate required parameters
      if (!config.vmid || config.vmid <= 0) {
        throw new Error('VM ID must be a positive integer');
      }

      // Prepare the request data
      const requestData: Record<string, any> = {
        ...config
      };

      // Remove undefined values to avoid API issues
      Object.keys(requestData).forEach(key => {
        if (requestData[key] === undefined) {
          delete requestData[key];
        }
      });

      const response = await this.httpClient.post<ProxmoxResponse<string>>(`/nodes/${node}/qemu`, requestData);
      const upid = this.extractData(response.data);
      
      // Get task info
      const task = await this.getTaskStatus(node, upid);
      
      // Save task to database
      try {
        await taskRepository.create({
          upid: task.upid,
          nodeId: node,
          type: task.type,
          status: task.status,
          user: task.user,
          startTime: new Date(task.starttime * 1000),
          endTime: task.endtime ? new Date(task.endtime * 1000) : undefined,
          exitStatus: task.exitstatus,
          resourceId: config.vmid.toString()
        });
      } catch (dbError) {
        this.logger.warn('Failed to save task to database after VM creation', {
          workspace: 'vm-creation',
          resourcesAffected: [config.vmid.toString()]
        }, { error: dbError, operation: 'vm-creation', phase: 'task-save' });
        // Continue execution - database error shouldn't fail VM creation
      }

      // Save VM to database (initial state)
      try {
        const vmData: CreateVMInput = {
          id: config.vmid,
          nodeId: node,
          name: config.name,
          status: 'stopped', // Initial status for new VMs
          template: false,
          cpuCores: config.cores,
          memoryBytes: config.memory ? BigInt(config.memory * 1024 * 1024) : undefined // Convert MB to bytes
        };

        await vmRepository.create(vmData);
      } catch (dbError) {
        this.logger.warn('Failed to save VM to database after creation', {
          workspace: 'vm-creation',
          resourcesAffected: [config.vmid.toString()]
        }, { error: dbError, operation: 'vm-creation', phase: 'vm-save' });
        // Continue execution - database error shouldn't fail VM creation
      }
      
      return {
        upid,
        vmid: config.vmid,
        node,
        task
      };
    } catch (error) {
      throw this.handleApiError(error, `Failed to create VM ${config.vmid} on node ${node}`);
    }
  }

  /**
   * Wait for VM creation to complete
   */
  async waitForVMCreation(node: string, vmid: number, timeoutMs: number = 300000): Promise<VMInfo> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      try {
        // Check if VM exists and get its status
        const vm = await this.getVMStatus(node, vmid);
        if (vm) {
          return vm;
        }
      } catch (error) {
        // VM might not exist yet, continue waiting
      }
      
      // Wait 2 seconds before next check
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    throw new Error(`Timeout waiting for VM ${vmid} creation on node ${node}`);
  }

  /**
   * Start a VM
   */
  async startVM(node: string, vmid: number): Promise<TaskInfo> {
    try {
      const response = await this.httpClient.post<ProxmoxResponse<string>>(`/nodes/${node}/qemu/${vmid}/status/start`);
      const upid = this.extractData(response.data);
      
      return await this.getTaskStatus(node, upid);
    } catch (error) {
      throw this.handleApiError(error, `Failed to start VM ${vmid} on node ${node}`);
    }
  }

  /**
   * Stop a VM (force stop)
   */
  async stopVM(node: string, vmid: number, force: boolean = false): Promise<TaskInfo> {
    try {
      const requestData = force ? { forceStop: 1 } : {};
      const response = await this.httpClient.post<ProxmoxResponse<string>>(`/nodes/${node}/qemu/${vmid}/status/stop`, requestData);
      const upid = this.extractData(response.data);
      
      return await this.getTaskStatus(node, upid);
    } catch (error) {
      throw this.handleApiError(error, `Failed to stop VM ${vmid} on node ${node}`);
    }
  }

  /**
   * Shutdown a VM gracefully
   */
  async shutdownVM(node: string, vmid: number): Promise<TaskInfo> {
    try {
      const response = await this.httpClient.post<ProxmoxResponse<string>>(`/nodes/${node}/qemu/${vmid}/status/shutdown`);
      const upid = this.extractData(response.data);
      
      return await this.getTaskStatus(node, upid);
    } catch (error) {
      throw this.handleApiError(error, `Failed to shutdown VM ${vmid} on node ${node}`);
    }
  }

  /**
   * Reboot a VM
   */
  async rebootVM(node: string, vmid: number): Promise<TaskInfo> {
    try {
      const response = await this.httpClient.post<ProxmoxResponse<string>>(`/nodes/${node}/qemu/${vmid}/status/reboot`);
      const upid = this.extractData(response.data);
      
      return await this.getTaskStatus(node, upid);
    } catch (error) {
      throw this.handleApiError(error, `Failed to reboot VM ${vmid} on node ${node}`);
    }
  }

  /**
   * Delete a VM
   */
  async deleteVM(node: string, vmid: number, options?: VMDeleteOptions): Promise<TaskInfo> {
    try {
      const requestData: Record<string, any> = {
        'skip-lock': options?.skipLock ? 1 : undefined,
        force: options?.force ? 1 : undefined,
        'destroy-unreferenced-disks': options?.destroyUnreferencedDisks ? 1 : undefined
      };

      // Remove undefined values
      Object.keys(requestData).forEach(key => {
        if (requestData[key] === undefined) {
          delete requestData[key];
        }
      });

      const response = await this.httpClient.delete<ProxmoxResponse<string>>(`/nodes/${node}/qemu/${vmid}`, {
        data: requestData
      });
      const upid = this.extractData(response.data);
      
      return await this.getTaskStatus(node, upid);
    } catch (error) {
      throw this.handleApiError(error, `Failed to delete VM ${vmid} on node ${node}`);
    }
  }

  /**
   * Wait for VM to reach a specific status
   */
  async waitForVMStatus(node: string, vmid: number, targetStatus: string, timeoutMs: number = 120000): Promise<VMInfo> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      try {
        const vm = await this.getVMStatus(node, vmid);
        if (vm.status === targetStatus) {
          return vm;
        }
      } catch (error) {
        // VM might not exist or might be transitioning
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (targetStatus === 'deleted' && errorMessage.includes('500')) {
          // VM is likely deleted
          throw new Error(`VM ${vmid} has been deleted`);
        }
      }
      
      // Wait 2 seconds before next check
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    throw new Error(`Timeout waiting for VM ${vmid} to reach status ${targetStatus} on node ${node}`);
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

  // ===== CONTAINER MANAGEMENT METHODS =====

  /**
   * Create a new container
   */
  async createContainer(node: string, config: ContainerCreateConfig): Promise<ContainerCreationResult> {
    try {
      // Validate required parameters
      if (!config.vmid || config.vmid <= 0) {
        throw new Error('Container ID must be a positive integer');
      }

      if (!config.ostemplate) {
        throw new Error('ostemplate is required for container creation');
      }

      // Prepare the request data
      const requestData: Record<string, any> = {
        ...config
      };

      // Remove undefined values to avoid API issues
      Object.keys(requestData).forEach(key => {
        if (requestData[key] === undefined) {
          delete requestData[key];
        }
      });

      const response = await this.httpClient.post<ProxmoxResponse<string>>(`/nodes/${node}/lxc`, requestData);
      const upid = this.extractData(response.data);
      
      // Get task info
      const task = await this.getTaskStatus(node, upid);
      
      // Save task to database
      try {
        await taskRepository.create({
          upid: task.upid,
          nodeId: node,
          type: task.type,
          status: task.status,
          user: task.user,
          startTime: new Date(task.starttime * 1000),
          endTime: task.endtime ? new Date(task.endtime * 1000) : undefined,
          exitStatus: task.exitstatus,
          resourceId: config.vmid.toString()
        });
      } catch (dbError) {
        this.logger.warn('Failed to save task to database after container creation', {
          workspace: 'container-creation',
          resourcesAffected: [config.vmid.toString()]
        }, { error: dbError, operation: 'container-creation', phase: 'task-save' });
        // Continue execution - database error shouldn't fail container creation
      }

      // Save container to database (initial state)
      try {
        const containerData: CreateContainerInput = {
          id: config.vmid,
          nodeId: node,
          hostname: config.hostname,
          status: 'stopped', // Initial status for new containers
          template: false,
          cpuCores: config.cores,
          memoryBytes: config.memory ? BigInt(config.memory * 1024 * 1024) : undefined // Convert MB to bytes
        };

        await containerRepository.create(containerData);
      } catch (dbError) {
        this.logger.warn('Failed to save container to database after creation', {
          workspace: 'container-creation',
          resourcesAffected: [config.vmid.toString()]
        }, { error: dbError, operation: 'container-creation', phase: 'container-save' });
        // Continue execution - database error shouldn't fail container creation
      }
      
      return {
        upid,
        vmid: config.vmid,
        node,
        task
      };
    } catch (error) {
      throw this.handleApiError(error, `Failed to create container ${config.vmid} on node ${node}`);
    }
  }

  /**
   * Wait for container creation to complete
   */
  async waitForContainerCreation(node: string, vmid: number, timeoutMs: number = 300000): Promise<ContainerInfo> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      try {
        // Check if container exists and get its status
        const container = await this.getContainerStatus(node, vmid);
        if (container) {
          return container;
        }
      } catch (error) {
        // Container might not exist yet, continue waiting
      }
      
      // Wait 2 seconds before next check
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    throw new Error(`Timeout waiting for container ${vmid} creation on node ${node}`);
  }

  /**
   * Start a container
   */
  async startContainer(node: string, vmid: number): Promise<TaskInfo> {
    try {
      const response = await this.httpClient.post<ProxmoxResponse<string>>(`/nodes/${node}/lxc/${vmid}/status/start`);
      const upid = this.extractData(response.data);
      
      return await this.getTaskStatus(node, upid);
    } catch (error) {
      throw this.handleApiError(error, `Failed to start container ${vmid} on node ${node}`);
    }
  }

  /**
   * Stop a container (force stop)
   */
  async stopContainer(node: string, vmid: number, force: boolean = false): Promise<TaskInfo> {
    try {
      const requestData = force ? { forceStop: 1 } : {};
      const response = await this.httpClient.post<ProxmoxResponse<string>>(`/nodes/${node}/lxc/${vmid}/status/stop`, requestData);
      const upid = this.extractData(response.data);
      
      return await this.getTaskStatus(node, upid);
    } catch (error) {
      throw this.handleApiError(error, `Failed to stop container ${vmid} on node ${node}`);
    }
  }

  /**
   * Shutdown a container gracefully
   */
  async shutdownContainer(node: string, vmid: number): Promise<TaskInfo> {
    try {
      const response = await this.httpClient.post<ProxmoxResponse<string>>(`/nodes/${node}/lxc/${vmid}/status/shutdown`);
      const upid = this.extractData(response.data);
      
      return await this.getTaskStatus(node, upid);
    } catch (error) {
      throw this.handleApiError(error, `Failed to shutdown container ${vmid} on node ${node}`);
    }
  }

  /**
   * Reboot a container
   */
  async rebootContainer(node: string, vmid: number): Promise<TaskInfo> {
    try {
      const response = await this.httpClient.post<ProxmoxResponse<string>>(`/nodes/${node}/lxc/${vmid}/status/reboot`);
      const upid = this.extractData(response.data);
      
      return await this.getTaskStatus(node, upid);
    } catch (error) {
      throw this.handleApiError(error, `Failed to reboot container ${vmid} on node ${node}`);
    }
  }

  /**
   * Delete a container
   */
  async deleteContainer(node: string, vmid: number, options?: ContainerDeleteOptions): Promise<TaskInfo> {
    try {
      const requestData: Record<string, any> = {
        'skip-lock': options?.skipLock ? 1 : undefined,
        force: options?.force ? 1 : undefined,
        purge: options?.purge ? 1 : undefined
      };

      // Remove undefined values
      Object.keys(requestData).forEach(key => {
        if (requestData[key] === undefined) {
          delete requestData[key];
        }
      });

      const response = await this.httpClient.delete<ProxmoxResponse<string>>(`/nodes/${node}/lxc/${vmid}`, {
        data: requestData
      });
      const upid = this.extractData(response.data);
      
      return await this.getTaskStatus(node, upid);
    } catch (error) {
      throw this.handleApiError(error, `Failed to delete container ${vmid} on node ${node}`);
    }
  }

  /**
   * Wait for container to reach a specific status
   */
  async waitForContainerStatus(node: string, vmid: number, targetStatus: string, timeoutMs: number = 120000): Promise<ContainerInfo> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      try {
        const container = await this.getContainerStatus(node, vmid);
        if (container.status === targetStatus) {
          return container;
        }
      } catch (error) {
        // Container might not exist or might be transitioning
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (targetStatus === 'deleted' && errorMessage.includes('500')) {
          // Container is likely deleted
          throw new Error(`Container ${vmid} has been deleted`);
        }
      }
      
      // Wait 2 seconds before next check
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    throw new Error(`Timeout waiting for container ${vmid} to reach status ${targetStatus} on node ${node}`);
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