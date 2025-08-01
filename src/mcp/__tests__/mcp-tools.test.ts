/**
 * MCP Tools Test Suite
 * TDD tests for MCP tool implementations
 */

import { MCPTools } from '../mcp-tools';
import { ProxmoxClient } from '../../api/proxmox-client';
import { Logger } from '../../observability/logger';
import { DiagnosticsCollector } from '../../observability/diagnostics';

// Mock dependencies
jest.mock('../../api/proxmox-client');
jest.mock('../../observability/logger');
jest.mock('../../observability/diagnostics');

describe('MCPTools', () => {
  let mcpTools: MCPTools;
  let mockProxmoxClient: jest.Mocked<ProxmoxClient>;
  let mockLogger: jest.Mocked<Logger>;
  let mockDiagnostics: jest.Mocked<DiagnosticsCollector>;

  beforeEach(() => {
    mockProxmoxClient = {
      createVM: jest.fn(),
      createContainer: jest.fn(),
      startVM: jest.fn(),
      stopVM: jest.fn(),
      getNodes: jest.fn(),
      getVMs: jest.fn()
    } as any;

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    } as any;

    mockDiagnostics = {
      generateSnapshot: jest.fn(),
      getSystemHealth: jest.fn()
    } as any;

    mcpTools = new MCPTools({
      proxmoxClient: mockProxmoxClient,
      logger: mockLogger,
      diagnostics: mockDiagnostics,
      workspacePath: '/test/workspace'
    });
  });

  describe('VM Management Tools', () => {
    it('should create VM with proper configuration', async () => {
      const mockVM = { 
        upid: 'UPID:pve-01:00001234:00ABCDEF:qmcreate:100:root@pam:',
        vmid: 100, 
        node: 'pve-01',
        task: {
          upid: 'UPID:pve-01:00001234:00ABCDEF:qmcreate:100:root@pam:',
          node: 'pve-01',
          pid: 1234,
          type: 'qmcreate',
          user: 'root@pam',
          status: 'OK',
          starttime: Date.now()
        }
      };
      mockProxmoxClient.createVM.mockResolvedValue(mockVM);

      const result = await mcpTools.executeCreateVM({
        name: 'test-vm',
        node: 'pve-01',
        memory: 2048,
        cores: 2,
        storage: 'local-lvm',
        network: 'vmbr0'
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockVM);
      expect(mockProxmoxClient.createVM).toHaveBeenCalledWith({
        name: 'test-vm',
        node: 'pve-01',
        memory: 2048,
        cores: 2,
        storage: 'local-lvm',
        network: 'vmbr0'
      });
    });

    it('should validate VM creation parameters', async () => {
      const result = await mcpTools.executeCreateVM({
        name: '', // Invalid name
        node: 'pve-01',
        memory: -1, // Invalid memory
        cores: 0 // Invalid cores
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid parameters');
      expect(result.error).toContain('name cannot be empty');
      expect(result.error).toContain('memory must be positive');
      expect(result.error).toContain('cores must be at least 1');
    });

    it('should create container with proper configuration', async () => {
      const mockContainer = {
        upid: 'UPID:pve-01:00001235:00ABCDEF:pct create:200:root@pam:',
        vmid: 200,
        node: 'pve-01',
        task: {
          upid: 'UPID:pve-01:00001235:00ABCDEF:pct create:200:root@pam:',
          node: 'pve-01',
          pid: 1235,
          type: 'pct create',
          user: 'root@pam',
          status: 'OK',
          starttime: Date.now()
        }
      };
      mockProxmoxClient.createContainer.mockResolvedValue(mockContainer);

      const result = await mcpTools.executeCreateContainer({
        name: 'test-container',
        node: 'pve-01',
        template: 'ubuntu-20.04',
        memory: 1024,
        storage: 'local-lvm',
        network: 'vmbr0'
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockContainer);
      expect(mockProxmoxClient.createContainer).toHaveBeenCalledWith({
        name: 'test-container',
        node: 'pve-01',
        template: 'ubuntu-20.04',
        memory: 1024,
        storage: 'local-lvm',
        network: 'vmbr0'
      });
    });

    it('should start and stop VMs', async () => {
      const mockStartTask = {
        upid: 'UPID:pve-01:00001236:00ABCDEF:qmstart:100:root@pam:',
        node: 'pve-01',
        pid: 1236,
        type: 'qmstart',
        user: 'root@pam',
        status: 'OK',
        starttime: Date.now()
      };
      const mockStopTask = {
        upid: 'UPID:pve-01:00001237:00ABCDEF:qmstop:100:root@pam:',
        node: 'pve-01',
        pid: 1237,
        type: 'qmstop',
        user: 'root@pam',
        status: 'OK',
        starttime: Date.now()
      };
      mockProxmoxClient.startVM.mockResolvedValue(mockStartTask);
      mockProxmoxClient.stopVM.mockResolvedValue(mockStopTask);

      const startResult = await mcpTools.executeStartVM({ vmid: 100 });
      expect(startResult.success).toBe(true);
      expect(startResult.data.status).toBe('OK');

      const stopResult = await mcpTools.executeStopVM({ vmid: 100 });
      expect(stopResult.success).toBe(true);
      expect(stopResult.data.status).toBe('OK');
    });
  });

  describe('Infrastructure Deployment Tools', () => {
    it('should deploy infrastructure with dry-run option', async () => {
      const result = await mcpTools.executeDeployInfrastructure({
        dryRun: true,
        confirmChanges: false
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('dryRun', true);
      expect(result.data).toHaveProperty('changesPreview');
      expect(result.data.changesPreview).toBeInstanceOf(Array);
    });

    it('should deploy infrastructure with confirmation', async () => {
      const result = await mcpTools.executeDeployInfrastructure({
        dryRun: false,
        confirmChanges: true,
        changes: [
          { type: 'create', resource: 'vm', name: 'web-01' },
          { type: 'update', resource: 'vm', name: 'web-02' }
        ]
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('deployed');
      expect(result.data).toHaveProperty('summary');
      expect(result.data.summary).toHaveProperty('created');
      expect(result.data.summary).toHaveProperty('updated');
    });

    it('should validate infrastructure changes before deployment', async () => {
      const result = await mcpTools.executeValidateInfrastructure({
        checkTerraform: true,
        checkAnsible: true,
        checkConnectivity: true
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('validation');
      expect(result.data.validation).toHaveProperty('terraform');
      expect(result.data.validation).toHaveProperty('ansible');
      expect(result.data.validation).toHaveProperty('connectivity');
    });

    it('should generate infrastructure plan', async () => {
      const result = await mcpTools.executeGeneratePlan({
        includeChanges: true,
        includeCosts: false,
        includeRisks: true
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('plan');
      expect(result.data.plan).toHaveProperty('changes');
      expect(result.data.plan).toHaveProperty('risks');
      expect(result.data.plan).not.toHaveProperty('costs'); // Should not include costs when false
    });
  });

  describe('Diagnostics and Monitoring Tools', () => {
    it('should run comprehensive diagnostics', async () => {
      const mockSnapshot = {
        id: 'snapshot-123',
        timestamp: new Date().toISOString(),
        systemInfo: { 
          nodeVersion: '18.0.0',
          platform: 'linux', 
          memory: { rss: 1024, heapTotal: 2048, heapUsed: 1536, external: 512, arrayBuffers: 256 }, 
          uptime: 3600 
        },
        workspaceInfo: { path: '/test/workspace', config: {} },
        logs: [],
        metrics: [],
        healthStatus: []
      };

      mockDiagnostics.generateSnapshot.mockResolvedValue(mockSnapshot);

      const result = await mcpTools.executeRunDiagnostics({
        includeMetrics: true,
        includeLogs: true,
        includeHealth: true,
        timeRange: '1h'
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('diagnostics');
      expect(result.data.diagnostics).toHaveProperty('timestamp');
      expect(result.data.diagnostics).toHaveProperty('systemInfo');
      expect(result.data.diagnostics).toHaveProperty('workspaceInfo');
    });

    it('should generate health report', async () => {
      const mockHealth = {
        overall: 'healthy',
        proxmox: { status: 'connected', responseTime: 45 },
        database: { status: 'connected', queries: 156 },
        workspace: { status: 'accessible', permissions: 'read-write' },
        tools: {
          terraform: { available: true, version: '1.6.0' },
          ansible: { available: true, version: '8.5.0' }
        }
      };

      // Mock for health report - just return the health data directly
      // since generateHealthReport doesn't use getSystemHealth

      const result = await mcpTools.executeGenerateHealthReport({
        includeDetails: true,
        includeRecommendations: true
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('health');
      expect(result.data.health).toHaveProperty('overall', 'healthy');
      expect(result.data.health).toHaveProperty('proxmox');
      expect(result.data.health).toHaveProperty('tools');
    });

    it('should generate performance report', async () => {
      const result = await mcpTools.executeGeneratePerformanceReport({
        timeRange: '24h',
        includeMetrics: true,
        includeBottlenecks: true
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('performance');
      expect(result.data.performance).toHaveProperty('timeRange', '24h');
      expect(result.data.performance).toHaveProperty('metrics');
      expect(result.data.performance).toHaveProperty('bottlenecks');
    });
  });

  describe('Configuration Management Tools', () => {
    it('should export workspace configuration', async () => {
      const result = await mcpTools.executeExportConfiguration({
        includeSecrets: false,
        format: 'yaml',
        destination: '/export/config.yaml'
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('exported');
      expect(result.data).toHaveProperty('format', 'yaml');
      expect(result.data).toHaveProperty('destination', '/export/config.yaml');
      expect(result.data).toHaveProperty('secretsExcluded', true);
    });

    it('should import workspace configuration', async () => {
      const result = await mcpTools.executeImportConfiguration({
        source: '/import/config.yaml',
        merge: true,
        validateOnly: false
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('imported');
      expect(result.data).toHaveProperty('merged', true);
      expect(result.data).toHaveProperty('changes');
    });

    it('should backup workspace', async () => {
      const result = await mcpTools.executeBackupWorkspace({
        includeHistory: true,
        includeConfigs: true,
        includeLogs: false,
        destination: '/backups/workspace-backup.tar.gz'
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('backup');
      expect(result.data.backup).toHaveProperty('destination');
      expect(result.data.backup).toHaveProperty('size');
      expect(result.data.backup).toHaveProperty('includes');
      expect(result.data.backup.includes).toContain('history');
      expect(result.data.backup.includes).toContain('configs');
      expect(result.data.backup.includes).not.toContain('logs');
    });
  });

  describe('Tool Parameter Validation', () => {
    it('should validate required parameters', async () => {
      const result = await mcpTools.executeCreateVM({
        // Missing required parameters
        name: 'test-vm'
        // missing: node, memory, cores
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required parameters');
      expect(result.error).toContain('node');
      expect(result.error).toContain('memory');
      expect(result.error).toContain('cores');
    });

    it('should validate parameter types', async () => {
      const result = await mcpTools.executeCreateVM({
        name: 'test-vm',
        node: 'pve-01',
        memory: 'invalid', // Should be number
        cores: '2' // Should be number, not string
      } as any);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid parameter types');
      expect(result.error).toContain('memory must be a number');
      expect(result.error).toContain('cores must be a number');
    });

    it('should validate parameter ranges', async () => {
      const result = await mcpTools.executeCreateVM({
        name: 'test-vm',
        node: 'pve-01',
        memory: 0, // Invalid: must be > 0
        cores: 100 // Invalid: too many cores
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Parameter out of range');
      expect(result.error).toContain('memory must be at least 128MB');
      expect(result.error).toContain('cores cannot exceed 64');
    });

    it('should validate enum parameters', async () => {
      const result = await mcpTools.executeExportConfiguration({
        format: 'invalid-format', // Should be 'yaml' | 'json'
        includeSecrets: 'maybe' // Should be boolean
      } as any);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid parameter values');
      expect(result.error).toContain('format must be one of: yaml, json');
      expect(result.error).toContain('includeSecrets must be boolean');
    });
  });

  describe('Error Handling', () => {
    it('should handle Proxmox API errors', async () => {
      mockProxmoxClient.createVM.mockRejectedValue(new Error('Proxmox API Error: Insufficient permissions'));

      const result = await mcpTools.executeCreateVM({
        name: 'test-vm',
        node: 'pve-01',
        memory: 2048,
        cores: 2
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Proxmox API Error: Insufficient permissions');
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('MCP tool execution failed: createVM'),
        expect.any(Error),
        expect.any(Object)
      );
    });

    it('should handle timeout errors', async () => {
      mockProxmoxClient.createVM.mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 5000)
        )
      );

      const result = await mcpTools.executeCreateVM({
        name: 'test-vm',
        node: 'pve-01',
        memory: 2048,
        cores: 2
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Request timeout');
    });

    it('should handle workspace access errors', async () => {
      const result = await mcpTools.executeBackupWorkspace({
        destination: '/invalid/path/backup.tar.gz',
        includeHistory: true,
        includeConfigs: true
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot access destination path');
    });
  });
});