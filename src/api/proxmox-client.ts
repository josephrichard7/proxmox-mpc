/**
 * Proxmox VE API Client
 * Handles authentication, requests, and response processing
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import https from 'https';
import { ProxmoxConfig, ProxmoxResponse, ConnectionResult, VersionInfo, NodeInfo } from '../types';

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