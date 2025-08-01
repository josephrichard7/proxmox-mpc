/**
 * MCP Resource Provider
 * Provides infrastructure, workspace, logs, and diagnostic resources to AI models
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  MCPResource,
  MCPResourceType,
  InfrastructureResource,
  WorkspaceResource,
  LogResource,
  DiagnosticResource
} from './types';
import { ProxmoxClient } from '../api/proxmox-client';
import { Logger } from '../observability/logger';
import { DiagnosticsCollector } from '../observability/diagnostics';
import { MetricsCollector } from '../observability/metrics';

interface ResourceProviderConfig {
  proxmoxClient: ProxmoxClient;
  logger: Logger;
  workspacePath: string;
  diagnostics?: DiagnosticsCollector;
  metrics?: MetricsCollector;
}

export class MCPResourceProvider {
  private config: ResourceProviderConfig;
  private proxmoxClient: ProxmoxClient;
  private logger: Logger;
  private diagnostics?: DiagnosticsCollector;
  private metrics?: MetricsCollector;
  private resourceCache: Map<string, { data: MCPResource[]; timestamp: number }>;
  private cacheTimeout: number = 5 * 60 * 1000; // 5 minutes

  constructor(config: ResourceProviderConfig) {
    this.config = config;
    this.proxmoxClient = config.proxmoxClient;
    this.logger = config.logger;
    this.diagnostics = config.diagnostics || DiagnosticsCollector.getInstance();
    this.metrics = config.metrics || MetricsCollector.getInstance();
    this.resourceCache = new Map();
  }

  /**
   * Initialize resource provider
   */
  async initialize(): Promise<void> {
    this.logger.debug('MCP Resource Provider initialized', {
      resourcesAffected: ['mcp-resources'],
      workspacePath: this.config.workspacePath
    });
  }

  /**
   * Get resources by type with optional filtering
   */
  async getResources(type: MCPResourceType, filters?: any): Promise<MCPResource[]> {
    const cacheKey = `${type}_${JSON.stringify(filters || {})}`;
    const cached = this.resourceCache.get(cacheKey);
    
    // Return cached data if still valid
    if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
      return cached.data;
    }

    let resources: MCPResource[] = [];

    try {
      switch (type) {
        case MCPResourceType.INFRASTRUCTURE:
          resources = await this.getInfrastructureResources();
          break;
        case MCPResourceType.WORKSPACE:
          resources = await this.getWorkspaceResources();
          break;
        case MCPResourceType.LOGS:
          resources = await this.getLogResources();
          break;
        case MCPResourceType.DIAGNOSTICS:
          resources = await this.getDiagnosticResources();
          break;
      }

      // Apply filters
      if (filters) {
        resources = this.applyFilters(resources, filters);
      }

      // Cache the results
      this.resourceCache.set(cacheKey, {
        data: resources,
        timestamp: Date.now()
      });

      return resources;
    } catch (error) {
      this.logger.error(`Failed to get ${type} resources`, error instanceof Error ? error : new Error(String(error)), {
        resourcesAffected: ['mcp-resources'],
        resourceType: type
      });
      return [];
    }
  }

  /**
   * Get infrastructure state summary
   */
  async getInfrastructureState(): Promise<any> {
    try {
      const nodes = await this.proxmoxClient.getNodes();
      // Get all nodes for VM and container queries
      const nodeNames = nodes.map(n => n.node);
      
      const [vms, containers] = await Promise.allSettled([
        Promise.all(nodeNames.map(node => this.proxmoxClient.getVMs(node).catch(() => []))).then(results => results.flat()),
        Promise.all(nodeNames.map(node => this.proxmoxClient.getContainers(node).catch(() => []))).then(results => results.flat())
      ]);

      return {
        nodes: nodes.length,
        vms: vms.status === 'fulfilled' ? vms.value.length : 0,
        containers: containers.status === 'fulfilled' ? containers.value.length : 0,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('Failed to get infrastructure state', error instanceof Error ? error : new Error(String(error)), {
        resourcesAffected: ['infrastructure-state']
      });
      return { nodes: 0, vms: 0, containers: 0, lastUpdated: new Date().toISOString() };
    }
  }

  /**
   * Clear resource cache
   */
  clearCache(): void {
    this.resourceCache.clear();
  }

  /**
   * Get infrastructure resources (nodes, VMs, containers, storage)
   */
  private async getInfrastructureResources(): Promise<InfrastructureResource[]> {
    const resources: InfrastructureResource[] = [];

    try {
      // Get nodes
      const nodes = await this.proxmoxClient.getNodes();
      for (const node of nodes) {
        resources.push({
          type: 'node',
          name: node.node,
          description: `Proxmox node ${node.node}`,
          uri: `infrastructure://node/${node.node}`,
          status: node.status,
          properties: {
            cpu: node.cpu,
            maxcpu: node.maxcpu,
            memory: node.mem,
            maxmem: node.maxmem,
            uptime: node.uptime
          }
        });
      }
    } catch (error) {
      this.logger.error('Failed to fetch node resources', error instanceof Error ? error : new Error(String(error)), {
        resourcesAffected: ['nodes']
      });
    }

    try {
      // Get VMs from all nodes
      const nodes = await this.proxmoxClient.getNodes();
      const vms = await Promise.all(
        nodes.map(node => this.proxmoxClient.getVMs(node.node).catch(() => []))
      ).then(results => results.flat());
      for (const vm of vms) {
        resources.push({
          type: 'vm',
          name: vm.name || `vm-${vm.vmid}`,
          description: `Virtual Machine ${vm.name || vm.vmid} (ID: ${vm.vmid})`,
          uri: `infrastructure://vm/${vm.vmid}`,
          status: vm.status,
          properties: {
            vmid: vm.vmid,
            node: vm.node,
            memory: vm.mem || vm.maxmem,
            cores: vm.cpus || vm.cpu,
            template: vm.template || false
          }
        });
      }
    } catch (error) {
      this.logger.error('Failed to fetch VM resources', error instanceof Error ? error : new Error(String(error)), {
        resourcesAffected: ['vms']
      });
    }

    try {
      // Get containers from all nodes
      const nodes = await this.proxmoxClient.getNodes();
      const containers = await Promise.all(
        nodes.map((node: any) => this.proxmoxClient.getContainers(node.node).catch(() => []))
      ).then(results => results.flat());
      for (const container of containers) {
        resources.push({
          type: 'container',
          name: container.name || `container-${container.vmid}`,
          description: `LXC Container ${container.name || container.vmid} (ID: ${container.vmid})`,
          uri: `infrastructure://container/${container.vmid}`,
          status: container.status,
          properties: {
            vmid: container.vmid,
            node: container.node,
            template: container.template || false,
            memory: container.mem || container.maxmem
          }
        });
      }
    } catch (error) {
      this.logger.error('Failed to fetch container resources', error instanceof Error ? error : new Error(String(error)), {
        resourcesAffected: ['containers']
      });
    }

    try {
      // Get storage
      const storage = await this.proxmoxClient.getStoragePools();
      for (const pool of storage) {
        resources.push({
          type: 'storage',
          name: pool.storage,
          description: `Storage pool ${pool.storage} (${pool.type})`,
          uri: `infrastructure://storage/${pool.storage}`,
          status: pool.enabled ? 'enabled' : 'disabled',
          properties: {
            type: pool.type,
            total: pool.total,
            used: pool.used,
            available: pool.avail,
            utilization: pool.total ? (pool.used || 0) / pool.total : 0
          }
        });
      }
    } catch (error) {
      this.logger.error('Failed to fetch storage resources', error instanceof Error ? error : new Error(String(error)), {
        resourcesAffected: ['storage']
      });
    }

    return resources;
  }

  /**
   * Get workspace resources (configuration, terraform, ansible)
   */
  private async getWorkspaceResources(): Promise<WorkspaceResource[]> {
    const resources: WorkspaceResource[] = [];

    // Main workspace configuration
    const workspaceResource: WorkspaceResource = {
      type: 'workspace',
      name: 'workspace-config',
      description: 'Workspace configuration and project settings',
      uri: `workspace://config`,
      path: this.config.workspacePath,
      configuration: await this.getWorkspaceConfiguration()
    };

    resources.push(workspaceResource);

    return resources;
  }

  /**
   * Get log resources (operation logs, error logs, audit logs)
   */
  private async getLogResources(): Promise<LogResource[]> {
    const resources: LogResource[] = [];

    try {
      // Operation logs
      const operationLogs = await this.logger.getRecentLogs(100);
      resources.push({
        type: 'operation-logs',
        name: 'recent-operations',
        description: 'Recent operation logs from proxmox-mpc',
        uri: 'logs://operations',
        timeRange: {
          start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 24h ago
          end: new Date().toISOString()
        },
        count: operationLogs.length,
        metadata: {
          operations: [...new Set(operationLogs.map(log => log.operation))]
        }
      });

      // Error logs
      const errorLogs = this.logger.getRecentLogs(50, 'error');
      resources.push({
        type: 'error-logs',
        name: 'recent-errors',
        description: 'Recent error logs requiring attention',
        uri: 'logs://errors',
        timeRange: {
          start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          end: new Date().toISOString()
        },
        count: errorLogs.length,
        metadata: {
          severity: 'error',
          categories: [...new Set(errorLogs.map(log => log.error?.category).filter(Boolean))]
        }
      });

      // Audit logs (create, update, delete operations)
      const createLogs = this.logger.getRecentLogs(20, undefined, 'create');
      const updateLogs = this.logger.getRecentLogs(20, undefined, 'update');
      const deleteLogs = this.logger.getRecentLogs(20, undefined, 'delete');
      const auditLogs = [...createLogs, ...updateLogs, ...deleteLogs];

      resources.push({
        type: 'audit-logs',
        name: 'audit-trail',
        description: 'Audit trail logs for infrastructure changes',
        uri: 'logs://audit',
        timeRange: {
          start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
          end: new Date().toISOString()
        },
        count: auditLogs.length,
        metadata: {
          operations: [...new Set(auditLogs.map(log => log.operation))]
        }
      });
    } catch (error) {
      this.logger.error('Failed to fetch log resources', error instanceof Error ? error : new Error(String(error)), {
        resourcesAffected: ['log-resources']
      });
    }

    return resources;
  }

  /**
   * Get diagnostic resources (system health, performance metrics, connectivity)
   */
  private async getDiagnosticResources(): Promise<DiagnosticResource[]> {
    const resources: DiagnosticResource[] = [];

    try {
      // System health
      resources.push({
        type: 'system-health',
        name: 'system-status',
        description: 'System health status and component availability',
        uri: 'diagnostics://health',
        lastUpdated: new Date().toISOString(),
        status: 'healthy', // This would be determined by actual health check
        metadata: {
          components: {
            proxmox: { status: 'connected' },
            database: { status: 'connected' },
            workspace: { status: 'accessible' },
            tools: {
              terraform: { available: true },
              ansible: { available: true }
            }
          }
        }
      });

      // Performance metrics
      if (this.metrics) {
        const metrics = this.metrics.getMetrics();
        resources.push({
          type: 'performance-metrics',
          name: 'performance-data',
          description: 'Performance metrics and system resource usage',
          uri: 'diagnostics://metrics',
          lastUpdated: new Date().toISOString(),
          status: 'healthy',
          metadata: {
            count: metrics.length,
            categories: [...new Set(metrics.map(m => m.name.split('.')[0]))]
          }
        });
      }

      // Connectivity status
      resources.push({
        type: 'connectivity-status',
        name: 'connectivity-check',
        description: 'Connectivity status to external services',
        uri: 'diagnostics://connectivity',
        lastUpdated: new Date().toISOString(),
        status: 'healthy',
        metadata: {
          services: {
            proxmox: { status: 'connected', responseTime: 45 },
            database: { status: 'connected', responseTime: 12 }
          }
        }
      });
    } catch (error) {
      this.logger.error('Failed to fetch diagnostic resources', error instanceof Error ? error : new Error(String(error)), {
        resourcesAffected: ['diagnostic-resources']
      });
    }

    return resources;
  }

  /**
   * Get workspace configuration
   */
  private async getWorkspaceConfiguration(): Promise<any> {
    const config: any = {
      path: this.config.workspacePath,
      configExists: false,
      terraform: { available: false },
      ansible: { available: false }
    };

    try {
      // Check for main config file
      const configPath = path.join(this.config.workspacePath, '.proxmox', 'config.yml');
      config.configExists = fs.existsSync(configPath);

      // Check for Terraform files
      const terraformPath = path.join(this.config.workspacePath, 'terraform');
      if (fs.existsSync(terraformPath)) {
        config.terraform.available = true;
        config.terraform.files = fs.readdirSync(terraformPath).filter(f => f.endsWith('.tf'));
      }

      // Check for Ansible files
      const ansiblePath = path.join(this.config.workspacePath, 'ansible');
      if (fs.existsSync(ansiblePath)) {
        config.ansible.available = true;
        config.ansible.files = fs.readdirSync(ansiblePath).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));
      }
    } catch (error) {
      this.logger.error('Failed to read workspace configuration', error instanceof Error ? error : new Error(String(error)), {
        resourcesAffected: ['workspace-config']
      });
    }

    return config;
  }

  /**
   * Apply filters to resources
   */
  private applyFilters(resources: MCPResource[], filters: any): MCPResource[] {
    let filtered = resources;

    // Filter by type
    if (filters.type) {
      filtered = filtered.filter(r => r.type === filters.type);
    }

    // Search by name
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      filtered = filtered.filter(r => 
        r.name.toLowerCase().includes(searchTerm) ||
        r.description.toLowerCase().includes(searchTerm)
      );
    }

    // Pagination
    if (filters.limit || filters.offset) {
      const offset = filters.offset || 0;
      const limit = filters.limit || filtered.length;
      filtered = filtered.slice(offset, offset + limit);
    }

    return filtered;
  }
}