/**
 * MCP Resources Test Suite
 * TDD tests for MCP resource providers
 */

import { MCPResourceProvider } from '../mcp-resources';
import { MCPResourceType } from '../types';
import { ProxmoxClient } from '../../api/proxmox-client';
import { Logger } from '../../observability/logger';
import { DiagnosticsCollector } from '../../observability/diagnostics';
import { MetricsCollector } from '../../observability/metrics';

// Mock dependencies
jest.mock('../../api/proxmox-client');
jest.mock('../../observability/logger');
jest.mock('../../observability/diagnostics');
jest.mock('../../observability/metrics');

describe('MCPResourceProvider', () => {
  let resourceProvider: MCPResourceProvider;
  let mockProxmoxClient: jest.Mocked<ProxmoxClient>;
  let mockLogger: jest.Mocked<Logger>;
  let mockDiagnostics: jest.Mocked<DiagnosticsCollector>;
  let mockMetrics: jest.Mocked<MetricsCollector>;

  beforeEach(() => {
    mockProxmoxClient = {
      getNodes: jest.fn(),
      getVMs: jest.fn(),
      getContainers: jest.fn(),
      getStoragePools: jest.fn(),
      getVersion: jest.fn()
    } as any;

    mockLogger = {
      getRecentLogs: jest.fn().mockReturnValue([])
    } as any;

    mockDiagnostics = {
      generateSnapshot: jest.fn()
    } as any;

    mockMetrics = {
      getMetrics: jest.fn().mockReturnValue([])
    } as any;

    resourceProvider = new MCPResourceProvider({
      proxmoxClient: mockProxmoxClient,
      logger: mockLogger,
      diagnostics: mockDiagnostics,
      metrics: mockMetrics,
      workspacePath: '/test/workspace'
    });
  });

  describe('Infrastructure Resources', () => {
    it('should provide node resources', async () => {
      const mockNodes = [
        { node: 'pve-01', status: 'online', cpu: 0.25, maxcpu: 8, mem: 4500000000, maxmem: 10000000000, uptime: 12345 },
        { node: 'pve-02', status: 'online', cpu: 0.15, maxcpu: 8, mem: 3500000000, maxmem: 10000000000, uptime: 12300 }
      ];
      mockProxmoxClient.getNodes.mockResolvedValue(mockNodes);
      // Mock VM and container calls for each node
      mockProxmoxClient.getVMs.mockResolvedValue([]);
      mockProxmoxClient.getContainers.mockResolvedValue([]);

      const resources = await resourceProvider.getResources(MCPResourceType.INFRASTRUCTURE);
      
      const nodeResources = resources.filter(r => r.type === 'node');
      expect(nodeResources).toHaveLength(2);
      
      expect(nodeResources[0]).toMatchObject({
        type: 'node',
        name: 'pve-01',
        description: expect.stringContaining('Proxmox node'),
        uri: expect.stringContaining('node/pve-01'),
        properties: expect.objectContaining({
          cpu: 0.25,
          maxcpu: 8,
          memory: 4500000000,
          maxmem: 10000000000,
          uptime: 12345
        })
      });
    });

    it('should provide VM resources', async () => {
      const mockVMs = [
        { vmid: 100, name: 'web-server-01', status: 'running', node: 'pve-01', mem: 2048000000, cpu: 0.25, maxmem: 2048000000, cpus: 2, template: false },
        { vmid: 101, name: 'db-server-01', status: 'stopped', node: 'pve-02', mem: 4096000000, cpu: 0.15, maxmem: 4096000000, cpus: 4, template: false }
      ];
      mockProxmoxClient.getVMs.mockResolvedValue(mockVMs);

      const resources = await resourceProvider.getResources(MCPResourceType.INFRASTRUCTURE);
      
      const vmResources = resources.filter(r => r.type === 'vm');
      expect(vmResources).toHaveLength(2);
      
      expect(vmResources[0]).toMatchObject({
        type: 'vm',
        name: 'web-server-01',
        description: expect.stringContaining('Virtual Machine'),
        uri: expect.stringContaining('vm/100'),
        properties: expect.objectContaining({
          vmid: 100,
          node: 'pve-01',
          memory: 2048000000,
          cores: 2,
          template: false
        })
      });
    });

    it('should provide container resources', async () => {
      const mockContainers = [
        { vmid: 200, name: 'app-container-01', status: 'running', node: 'pve-01', mem: 1024000000, maxmem: 1024000000, template: false },
        { vmid: 201, name: 'cache-container-01', status: 'running', node: 'pve-01', mem: 512000000, maxmem: 512000000, template: false }
      ];
      mockProxmoxClient.getContainers.mockResolvedValue(mockContainers);

      const resources = await resourceProvider.getResources(MCPResourceType.INFRASTRUCTURE);
      
      const containerResources = resources.filter(r => r.type === 'container');
      expect(containerResources).toHaveLength(2);
      
      expect(containerResources[0]).toMatchObject({
        type: 'container',
        name: 'app-container-01',
        description: expect.stringContaining('LXC Container'),
        uri: expect.stringContaining('container/200'),
        properties: expect.objectContaining({
          vmid: 200,
          node: 'pve-01',
          template: false,
          memory: 1024000000
        })
      });
    });

    it('should provide storage resources', async () => {
      const mockStorage = [
        { storage: 'local-lvm', type: 'lvm', total: 100000000, used: 50000000, avail: 50000000, enabled: true },
        { storage: 'backup-nfs', type: 'nfs', total: 500000000, used: 100000000, avail: 400000000, enabled: true }
      ];
      mockProxmoxClient.getStoragePools.mockResolvedValue(mockStorage);

      const resources = await resourceProvider.getResources(MCPResourceType.INFRASTRUCTURE);
      
      const storageResources = resources.filter(r => r.type === 'storage');
      expect(storageResources).toHaveLength(2);
      
      expect(storageResources[0]).toMatchObject({
        type: 'storage',
        name: 'local-lvm',
        description: expect.stringContaining('Storage pool'),
        uri: expect.stringContaining('storage/local-lvm'),
        properties: expect.objectContaining({
          type: 'lvm',
          total: 100000000,
          used: 50000000,
          available: 50000000,
          utilization: 0.5
        })
      });
    });

    it('should handle infrastructure resource errors gracefully', async () => {
      mockProxmoxClient.getNodes.mockRejectedValue(new Error('Connection failed'));
      mockProxmoxClient.getVMs.mockResolvedValue([]);
      mockProxmoxClient.getContainers.mockResolvedValue([]);

      const resources = await resourceProvider.getResources(MCPResourceType.INFRASTRUCTURE);
      
      // Should only include VMs and containers (nodes failed)
      expect(resources.some(r => r.type === 'node')).toBe(false);
      expect(resources.filter(r => r.type === 'vm')).toHaveLength(0);
      expect(resources.filter(r => r.type === 'container')).toHaveLength(0);
    });
  });

  describe('Workspace Resources', () => {
    it('should provide workspace configuration resource', async () => {
      const resources = await resourceProvider.getResources(MCPResourceType.WORKSPACE);
      
      expect(resources).toHaveLength(1);
      expect(resources[0]).toMatchObject({
        type: 'workspace',
        name: 'workspace-config',
        description: expect.stringContaining('Workspace configuration'),
        uri: expect.stringContaining('workspace/config'),
        configuration: expect.objectContaining({
          path: '/test/workspace',
          configExists: expect.any(Boolean)
        })
      });
    });

    it('should include terraform configuration when available', async () => {
      // Mock fs to simulate terraform files exist
      jest.doMock('fs', () => ({
        existsSync: jest.fn((path) => path.includes('terraform')),
        readFileSync: jest.fn(() => 'terraform { required_version = ">= 1.0" }')
      }));

      const resources = await resourceProvider.getResources(MCPResourceType.WORKSPACE);
      
      const workspaceResource = resources[0] as any; // Cast to access configuration property
      expect(workspaceResource.configuration).toHaveProperty('terraform');
      expect(workspaceResource.configuration.terraform).toHaveProperty('available', true);
    });

    it('should include ansible configuration when available', async () => {
      // Mock fs to simulate ansible files exist
      jest.doMock('fs', () => ({
        existsSync: jest.fn((path) => path.includes('ansible')),
        readFileSync: jest.fn(() => '---\n- hosts: all\n  tasks: []')
      }));

      const resources = await resourceProvider.getResources(MCPResourceType.WORKSPACE);
      
      const workspaceResource = resources[0] as any; // Cast to access configuration property
      expect(workspaceResource.configuration).toHaveProperty('ansible');
      expect(workspaceResource.configuration.ansible).toHaveProperty('available', true);
    });
  });

  describe('Log Resources', () => {
    it('should provide operation logs', async () => {
      const mockLogs = [
        {
          timestamp: '2024-08-01T10:00:00Z',
          correlationId: 'sync-001',
          operation: 'sync',
          phase: 'execution',
          level: 'info' as const,
          message: 'Sync completed successfully',
          context: {
            workspace: '/test/workspace',
            resourcesAffected: ['nodes', 'vms'],
            duration: 1500
          }
        },
        {
          timestamp: '2024-08-01T10:05:00Z',
          correlationId: 'apply-001',
          operation: 'apply',
          phase: 'deployment',
          level: 'info' as const,
          message: 'Infrastructure deployed',
          context: {
            workspace: '/test/workspace',
            resourcesAffected: ['terraform'],
            duration: 2500
          }
        }
      ];
      mockLogger.getRecentLogs.mockReturnValue(mockLogs);

      const resources = await resourceProvider.getResources(MCPResourceType.LOGS);
      
      const operationLogs = resources.find(r => r.type === 'operation-logs');
      expect(operationLogs).toBeDefined();
      expect(operationLogs).toMatchObject({
        type: 'operation-logs',
        name: 'recent-operations',
        description: expect.stringContaining('Recent operation logs'),
        uri: expect.stringContaining('logs/operations'),
        metadata: expect.objectContaining({
          count: 2,
          timeRange: expect.any(Object)
        })
      });
    });

    it('should provide error logs', async () => {
      const mockErrorLogs = [
        {
          timestamp: '2024-08-01T10:10:00Z',
          correlationId: 'apply-002',
          operation: 'apply',
          phase: 'terraform',
          level: 'error' as const,
          message: 'Terraform execution failed',
          context: {
            workspace: '/test/workspace',
            resourcesAffected: ['terraform'],
            duration: 500
          },
          error: { 
            type: 'TerraformError', 
            message: 'Resource already exists',
            stack: 'TerraformError: Resource already exists\n    at apply...',
            recoveryActions: ['Check terraform state', 'Run terraform destroy', 'Review configuration']
          }
        }
      ];
      mockLogger.getRecentLogs.mockReturnValue(mockErrorLogs);

      const resources = await resourceProvider.getResources(MCPResourceType.LOGS);
      
      const errorLogs = resources.find(r => r.type === 'error-logs');
      expect(errorLogs).toBeDefined();
      expect(errorLogs).toMatchObject({
        type: 'error-logs',
        name: 'recent-errors',
        description: expect.stringContaining('Recent error logs'),
        uri: expect.stringContaining('logs/errors'),
        metadata: expect.objectContaining({
          count: 1,
          severity: 'error'
        })
      });
    });

    it('should provide audit logs', async () => {
      const mockAuditLogs = [
        {
          timestamp: '2024-08-01T10:15:00Z',
          correlationId: 'create-001',
          operation: 'create',
          phase: 'vm-creation',
          level: 'info' as const,
          message: 'VM created by user',
          context: {
            workspace: '/test/workspace',
            resourcesAffected: ['vm-100'],
            userId: 'admin',
            resource: 'vm-100'
          }
        }
      ];
      // Mock different calls for create, update, delete operations
      mockLogger.getRecentLogs
        .mockReturnValueOnce(mockAuditLogs) // create logs
        .mockReturnValueOnce([]) // update logs
        .mockReturnValueOnce([]); // delete logs

      const resources = await resourceProvider.getResources(MCPResourceType.LOGS);
      
      const auditLogs = resources.find(r => r.type === 'audit-logs');
      expect(auditLogs).toBeDefined();
      expect(auditLogs).toMatchObject({
        type: 'audit-logs',
        name: 'audit-trail',
        description: expect.stringContaining('Audit trail logs'),
        uri: expect.stringContaining('logs/audit'),
        metadata: expect.objectContaining({
          count: 1,
          operations: expect.arrayContaining(['create'])
        })
      });
    });
  });

  describe('Diagnostic Resources', () => {
    it('should provide system health resource', async () => {
      const mockHealth = {
        overall: 'healthy',
        proxmox: { status: 'connected', responseTime: 45 },
        database: { status: 'connected', queries: 156 },
        tools: {
          terraform: { available: true, version: '1.6.0' },
          ansible: { available: true, version: '8.5.0' }
        }
      };
      // System health is built into diagnostic resources - no separate method needed

      const resources = await resourceProvider.getResources(MCPResourceType.DIAGNOSTICS);
      
      const healthResource = resources.find(r => r.type === 'system-health');
      expect(healthResource).toBeDefined();
      expect(healthResource).toMatchObject({
        type: 'system-health',
        name: 'system-status',
        description: expect.stringContaining('System health status'),
        uri: expect.stringContaining('diagnostics/health'),
        metadata: expect.objectContaining({
          status: 'healthy',
          lastUpdated: expect.any(String),
          components: expect.objectContaining({
            proxmox: expect.any(Object),
            database: expect.any(Object),
            tools: expect.any(Object)
          })
        })
      });
    });

    it('should provide performance metrics resource', async () => {
      const actualMockMetrics = [
        { name: 'operation.sync.duration', value: 1234, unit: 'ms', timestamp: new Date(), tags: { operation: 'sync' } },
        { name: 'system.memory.usage', value: 0.45, unit: 'ratio', timestamp: new Date(), tags: { component: 'system' } }
      ];
      mockMetrics.getMetrics.mockReturnValue(actualMockMetrics);

      const resources = await resourceProvider.getResources(MCPResourceType.DIAGNOSTICS);
      
      const metricsResource = resources.find(r => r.type === 'performance-metrics');
      expect(metricsResource).toBeDefined();
      expect(metricsResource).toMatchObject({
        type: 'performance-metrics',
        name: 'performance-data',
        description: expect.stringContaining('Performance metrics'),
        uri: expect.stringContaining('diagnostics/metrics'),
        metadata: expect.objectContaining({
          count: 2,
          lastUpdated: expect.any(String),
          categories: expect.arrayContaining(['operation', 'system'])
        })
      });
    });

    it('should provide connectivity status resource', async () => {
      const mockConnectivity = {
        proxmox: { status: 'connected', responseTime: 45, lastCheck: new Date() },
        database: { status: 'connected', responseTime: 12, lastCheck: new Date() },
        external: { status: 'limited', services: ['terraform', 'ansible'] }
      };
      // Connectivity status is built into diagnostic resources - no separate method needed

      const resources = await resourceProvider.getResources(MCPResourceType.DIAGNOSTICS);
      
      const connectivityResource = resources.find(r => r.type === 'connectivity-status');
      expect(connectivityResource).toBeDefined();
      expect(connectivityResource).toMatchObject({
        type: 'connectivity-status',
        name: 'connectivity-check',
        description: expect.stringContaining('Connectivity status'),
        uri: expect.stringContaining('diagnostics/connectivity'),
        metadata: expect.objectContaining({
          status: expect.any(String),
          lastUpdated: expect.any(String),
          services: expect.objectContaining({
            proxmox: expect.any(Object),
            database: expect.any(Object)
          })
        })
      });
    });
  });

  describe('Resource Caching', () => {
    it('should cache resource data for performance', async () => {
      const mockNodes = [{ node: 'pve-01', status: 'online', cpu: 0.25, maxcpu: 8, mem: 4500000000, maxmem: 10000000000, uptime: 12345 }];
      mockProxmoxClient.getNodes.mockResolvedValue(mockNodes);

      // First call
      await resourceProvider.getResources(MCPResourceType.INFRASTRUCTURE);
      expect(mockProxmoxClient.getNodes).toHaveBeenCalledTimes(1);

      // Second call within cache window should use cache
      await resourceProvider.getResources(MCPResourceType.INFRASTRUCTURE);
      expect(mockProxmoxClient.getNodes).toHaveBeenCalledTimes(1);
    });

    it('should refresh cache after expiry', async () => {
      const mockNodes = [{ node: 'pve-01', status: 'online', cpu: 0.25, maxcpu: 8, mem: 4500000000, maxmem: 10000000000, uptime: 12345 }];
      mockProxmoxClient.getNodes.mockResolvedValue(mockNodes);

      // First call
      await resourceProvider.getResources(MCPResourceType.INFRASTRUCTURE);
      expect(mockProxmoxClient.getNodes).toHaveBeenCalledTimes(1);

      // Simulate cache expiry
      jest.advanceTimersByTime(5 * 60 * 1000); // 5 minutes

      // Second call should refresh cache
      await resourceProvider.getResources(MCPResourceType.INFRASTRUCTURE);
      expect(mockProxmoxClient.getNodes).toHaveBeenCalledTimes(2);
    });

    it('should clear cache on demand', async () => {
      const mockNodes = [{ node: 'pve-01', status: 'online', cpu: 0.25, maxcpu: 8, mem: 4500000000, maxmem: 10000000000, uptime: 12345 }];
      mockProxmoxClient.getNodes.mockResolvedValue(mockNodes);

      // First call
      await resourceProvider.getResources(MCPResourceType.INFRASTRUCTURE);
      expect(mockProxmoxClient.getNodes).toHaveBeenCalledTimes(1);

      // Clear cache
      resourceProvider.clearCache();

      // Second call should fetch fresh data
      await resourceProvider.getResources(MCPResourceType.INFRASTRUCTURE);
      expect(mockProxmoxClient.getNodes).toHaveBeenCalledTimes(2);
    });
  });

  describe('Resource Filtering and Pagination', () => {
    it('should filter resources by type', async () => {
      const mockNodes = [{ node: 'pve-01', status: 'online', cpu: 0.25, maxcpu: 8, mem: 4500000000, maxmem: 10000000000, uptime: 12345 }];
      const mockVMs = [{ vmid: 100, name: 'test-vm', status: 'running', node: 'pve-01', mem: 2048000000, cpu: 0.25, maxmem: 2048000000, cpus: 2, template: false }];
      mockProxmoxClient.getNodes.mockResolvedValue(mockNodes);
      mockProxmoxClient.getVMs.mockResolvedValue(mockVMs);
      mockProxmoxClient.getContainers.mockResolvedValue([]);

      const allResources = await resourceProvider.getResources(MCPResourceType.INFRASTRUCTURE);
      const nodeResources = await resourceProvider.getResources(MCPResourceType.INFRASTRUCTURE, { type: 'node' });
      const vmResources = await resourceProvider.getResources(MCPResourceType.INFRASTRUCTURE, { type: 'vm' });

      expect(allResources.length).toBeGreaterThan(nodeResources.length);
      expect(nodeResources).toHaveLength(1);
      expect(vmResources).toHaveLength(1);
      expect(nodeResources[0].type).toBe('node');
      expect(vmResources[0].type).toBe('vm');
    });

    it('should paginate large resource lists', async () => {
      const mockVMs = Array.from({ length: 50 }, (_, i) => ({
        vmid: 100 + i,
        name: `vm-${i}`,
        status: 'running',
        node: 'pve-01',
        mem: 2048000000,
        cpu: 0.25,
        maxmem: 2048000000,
        cpus: 2,
        template: false
      }));
      mockProxmoxClient.getVMs.mockResolvedValue(mockVMs);
      mockProxmoxClient.getNodes.mockResolvedValue([]);
      mockProxmoxClient.getContainers.mockResolvedValue([]);

      const page1 = await resourceProvider.getResources(MCPResourceType.INFRASTRUCTURE, { 
        limit: 20, 
        offset: 0 
      });
      const page2 = await resourceProvider.getResources(MCPResourceType.INFRASTRUCTURE, { 
        limit: 20, 
        offset: 20 
      });

      expect(page1).toHaveLength(20);
      expect(page2).toHaveLength(20);
      expect(page1[0].name).toBe('vm-0');
      expect(page2[0].name).toBe('vm-20');
    });

    it('should search resources by name', async () => {
      const mockVMs = [
        { vmid: 100, name: 'web-server-01', status: 'running', node: 'pve-01', mem: 2048000000, cpu: 0.25, maxmem: 2048000000, cpus: 2, template: false },
        { vmid: 101, name: 'db-server-01', status: 'running', node: 'pve-01', mem: 2048000000, cpu: 0.25, maxmem: 2048000000, cpus: 2, template: false },
        { vmid: 102, name: 'cache-server-01', status: 'running', node: 'pve-01', mem: 2048000000, cpu: 0.25, maxmem: 2048000000, cpus: 2, template: false }
      ];
      mockProxmoxClient.getVMs.mockResolvedValue(mockVMs);
      mockProxmoxClient.getNodes.mockResolvedValue([]);
      mockProxmoxClient.getContainers.mockResolvedValue([]);

      const webServers = await resourceProvider.getResources(MCPResourceType.INFRASTRUCTURE, { 
        search: 'web' 
      });
      const servers = await resourceProvider.getResources(MCPResourceType.INFRASTRUCTURE, { 
        search: 'server' 
      });

      expect(webServers).toHaveLength(1);
      expect(webServers[0].name).toBe('web-server-01');
      expect(servers).toHaveLength(3); // All contain 'server'
    });
  });
});