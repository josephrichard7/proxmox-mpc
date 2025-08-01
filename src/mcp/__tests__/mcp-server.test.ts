/**
 * MCP Server Test Suite
 * TDD tests for Model Context Protocol server implementation
 */

import { MCPServer } from '../mcp-server';
import { MCPMessage, MCPResponse, MCPResourceType } from '../types';
import { ProxmoxClient } from '../../api/proxmox-client';
import { Logger } from '../../observability/logger';

// Mock dependencies
jest.mock('../../api/proxmox-client');
jest.mock('../../observability/logger');

describe('MCPServer', () => {
  let mcpServer: MCPServer;
  let mockProxmoxClient: jest.Mocked<ProxmoxClient>;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    mockProxmoxClient = {
      connect: jest.fn(),
      getNodes: jest.fn(),
      getVMs: jest.fn(),
      getContainers: jest.fn(),
      getVersion: jest.fn()
    } as any;

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn()
    } as any;

    mcpServer = new MCPServer({
      proxmoxClient: mockProxmoxClient,
      logger: mockLogger,
      workspacePath: '/test/workspace'
    });
  });

  describe('Server Initialization', () => {
    it('should initialize with correct capabilities', async () => {
      const capabilities = await mcpServer.getCapabilities();
      
      expect(capabilities).toHaveProperty('resources');
      expect(capabilities).toHaveProperty('tools');
      expect(capabilities).toHaveProperty('prompts');
      
      // Should support infrastructure resources
      expect(capabilities.resources).toContain(MCPResourceType.INFRASTRUCTURE);
      expect(capabilities.resources).toContain(MCPResourceType.WORKSPACE);
      expect(capabilities.resources).toContain(MCPResourceType.LOGS);
      expect(capabilities.resources).toContain(MCPResourceType.DIAGNOSTICS);
    });

    it('should start and stop server correctly', async () => {
      await expect(mcpServer.start()).resolves.not.toThrow();
      expect(mcpServer.isRunning()).toBe(true);
      
      await expect(mcpServer.stop()).resolves.not.toThrow();
      expect(mcpServer.isRunning()).toBe(false);
    });

    it('should establish connection with workspace context', async () => {
      await mcpServer.start();
      
      const contextInfo = await mcpServer.getWorkspaceContext();
      expect(contextInfo).toHaveProperty('workspacePath', '/test/workspace');
      expect(contextInfo).toHaveProperty('infrastruactureState');
      expect(contextInfo).toHaveProperty('availableTools');
    });
  });

  describe('Resource Management', () => {
    beforeEach(async () => {
      await mcpServer.start();
    });

    afterEach(async () => {
      await mcpServer.stop();
    });

    it('should expose infrastructure resources', async () => {
      mockProxmoxClient.getNodes.mockResolvedValue([
        { node: 'pve-01', status: 'online', cpu: 0.25, maxcpu: 8, mem: 4500000000, maxmem: 10000000000, uptime: 12345 }
      ]);
      mockProxmoxClient.getVMs.mockResolvedValue([
        { vmid: 100, name: 'test-vm', status: 'running', node: 'pve-01', mem: 2048000000, cpu: 0.25, maxmem: 2048000000, cpus: 2, template: false }
      ]);

      const resources = await mcpServer.getResources(MCPResourceType.INFRASTRUCTURE);
      
      expect(resources).toHaveLength(2); // nodes + vms
      expect(resources[0]).toHaveProperty('type', 'node');
      expect(resources[1]).toHaveProperty('type', 'vm');
      expect(resources[1]).toHaveProperty('name', 'test-vm');
    });

    it('should expose workspace configuration', async () => {
      const resources = await mcpServer.getResources(MCPResourceType.WORKSPACE);
      
      expect(resources).toHaveLength(1);
      expect(resources[0]).toHaveProperty('type', 'workspace');
      expect(resources[0]).toHaveProperty('path', '/test/workspace');
      expect(resources[0]).toHaveProperty('configuration');
    });

    it('should expose observability logs', async () => {
      const resources = await mcpServer.getResources(MCPResourceType.LOGS);
      
      expect(resources).toEqual(expect.arrayContaining([
        expect.objectContaining({
          type: 'operation-logs',
          description: expect.stringContaining('Recent operation logs')
        })
      ]));
    });

    it('should expose diagnostic information', async () => {
      const resources = await mcpServer.getResources(MCPResourceType.DIAGNOSTICS);
      
      expect(resources).toEqual(expect.arrayContaining([
        expect.objectContaining({
          type: 'system-health',
          description: expect.stringContaining('System health status')
        }),
        expect.objectContaining({
          type: 'performance-metrics',
          description: expect.stringContaining('Performance metrics')
        })
      ]));
    });
  });

  describe('Tool Integration', () => {
    beforeEach(async () => {
      await mcpServer.start();
    });

    afterEach(async () => {
      await mcpServer.stop();
    });

    it('should provide VM creation tool', async () => {
      const tools = await mcpServer.getAvailableTools();
      
      const createVMTool = tools.find(tool => tool.name === 'createVM');
      expect(createVMTool).toBeDefined();
      expect(createVMTool?.description).toContain('Create a new virtual machine');
      expect(createVMTool?.parameters).toContain('name');
      expect(createVMTool?.parameters).toContain('node');
      expect(createVMTool?.parameters).toContain('memory');
      expect(createVMTool?.parameters).toContain('cores');
    });

    it('should provide infrastructure deployment tool', async () => {
      const tools = await mcpServer.getAvailableTools();
      
      const deployTool = tools.find(tool => tool.name === 'deployInfrastructure');
      expect(deployTool).toBeDefined();
      expect(deployTool?.description).toContain('Deploy infrastructure changes');
      expect(deployTool?.parameters).toContain('dryRun');
      expect(deployTool?.parameters).toContain('confirmChanges');
    });

    it('should provide diagnostics tool', async () => {
      const tools = await mcpServer.getAvailableTools();
      
      const diagnosticsTool = tools.find(tool => tool.name === 'runDiagnostics');
      expect(diagnosticsTool).toBeDefined();
      expect(diagnosticsTool?.description).toContain('Run system diagnostics');
      expect(diagnosticsTool?.parameters).toContain('includeMetrics');
      expect(diagnosticsTool?.parameters).toContain('includeLogs');
    });

    it('should execute VM creation tool correctly', async () => {
      const mockResult = { vmid: 101, status: 'created' };
      mockProxmoxClient.createVM = jest.fn().mockResolvedValue(mockResult);

      const result = await mcpServer.executeTool('createVM', {
        name: 'test-vm-new',
        node: 'pve-01',
        memory: 2048,
        cores: 2
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResult);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('MCP tool executed: createVM'),
        expect.any(Object)
      );
    });

    it('should handle tool execution errors gracefully', async () => {
      mockProxmoxClient.createVM = jest.fn().mockRejectedValue(new Error('Connection failed'));

      const result = await mcpServer.executeTool('createVM', {
        name: 'test-vm-fail',
        node: 'pve-01'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Connection failed');
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('MCP tool execution failed'),
        expect.any(Error),
        expect.any(Object)
      );
    });
  });

  describe('Prompt Templates', () => {
    beforeEach(async () => {
      await mcpServer.start();
    });

    afterEach(async () => {
      await mcpServer.stop();
    });

    it('should provide troubleshooting prompt template', async () => {
      const prompts = await mcpServer.getPromptTemplates();
      
      const troubleshootPrompt = prompts.find(p => p.name === 'troubleshoot');
      expect(troubleshootPrompt).toBeDefined();
      expect(troubleshootPrompt?.description).toContain('troubleshooting');
      expect(troubleshootPrompt?.template).toContain('{{error}}');
      expect(troubleshootPrompt?.template).toContain('{{context}}');
    });

    it('should provide optimization prompt template', async () => {
      const prompts = await mcpServer.getPromptTemplates();
      
      const optimizePrompt = prompts.find(p => p.name === 'optimize');
      expect(optimizePrompt).toBeDefined();
      expect(optimizePrompt?.description).toContain('optimization');
      expect(optimizePrompt?.template).toContain('{{infrastructure}}');
      expect(optimizePrompt?.template).toContain('{{metrics}}');
    });

    it('should provide planning prompt template', async () => {
      const prompts = await mcpServer.getPromptTemplates();
      
      const planPrompt = prompts.find(p => p.name === 'plan');
      expect(planPrompt).toBeDefined();
      expect(planPrompt?.description).toContain('planning');
      expect(planPrompt?.template).toContain('{{requirements}}');
      expect(planPrompt?.template).toContain('{{constraints}}');
    });

    it('should render prompt template with context', async () => {
      const rendered = await mcpServer.renderPrompt('troubleshoot', {
        error: 'VM failed to start',
        context: {
          vmid: 100,
          node: 'pve-01',
          lastOperation: 'start'
        }
      });

      expect(rendered).toContain('VM failed to start');
      expect(rendered).toContain('vmid: 100');
      expect(rendered).toContain('node: pve-01');
      expect(rendered).not.toContain('{{error}}'); // Template variables should be replaced
    });
  });

  describe('Session Management', () => {
    it('should create and manage MCP sessions', async () => {
      const sessionId = await mcpServer.createSession('test-client');
      
      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe('string');
      
      const session = await mcpServer.getSession(sessionId);
      expect(session).toHaveProperty('id', sessionId);
      expect(session).toHaveProperty('clientId', 'test-client');
      expect(session).toHaveProperty('createdAt');
      expect(session).toHaveProperty('lastActivity');
    });

    it('should maintain session context across requests', async () => {
      const sessionId = await mcpServer.createSession('test-client');
      
      // Set workspace context for session
      await mcpServer.setSessionContext(sessionId, {
        workspace: '/test/workspace',
        selectedNode: 'pve-01'
      });

      const context = await mcpServer.getSessionContext(sessionId);
      expect(context).toHaveProperty('workspace', '/test/workspace');
      expect(context).toHaveProperty('selectedNode', 'pve-01');
    });

    it('should expire inactive sessions', async () => {
      const sessionId = await mcpServer.createSession('test-client');
      
      // Mock time passage
      jest.useFakeTimers();
      jest.advanceTimersByTime(30 * 60 * 1000); // 30 minutes
      
      await mcpServer.cleanupExpiredSessions();
      
      const session = await mcpServer.getSession(sessionId);
      expect(session).toBeNull();
      
      jest.useRealTimers();
    });

    it('should handle concurrent sessions correctly', async () => {
      const session1 = await mcpServer.createSession('client-1');
      const session2 = await mcpServer.createSession('client-2');
      
      expect(session1).not.toBe(session2);
      
      await mcpServer.setSessionContext(session1, { workspace: '/workspace1' });
      await mcpServer.setSessionContext(session2, { workspace: '/workspace2' });
      
      const context1 = await mcpServer.getSessionContext(session1);
      const context2 = await mcpServer.getSessionContext(session2);
      
      expect(context1.workspace).toBe('/workspace1');
      expect(context2.workspace).toBe('/workspace2');
    });
  });

  describe('Message Processing', () => {
    beforeEach(async () => {
      await mcpServer.start();
    });

    afterEach(async () => {
      await mcpServer.stop();
    });

    it('should process resource list requests', async () => {
      const message: MCPMessage = {
        jsonrpc: '2.0',
        id: 'test-1',
        method: 'resources/list',
        params: { type: MCPResourceType.INFRASTRUCTURE }
      };

      const response = await mcpServer.processMessage(message);
      
      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe('test-1');
      expect(response.result).toHaveProperty('resources');
      expect(Array.isArray(response.result.resources)).toBe(true);
    });

    it('should process tool execution requests', async () => {
      mockProxmoxClient.createVM = jest.fn().mockResolvedValue({ vmid: 102 });
      
      const message: MCPMessage = {
        jsonrpc: '2.0',
        id: 'test-2',
        method: 'tools/call',
        params: {
          name: 'createVM',
          arguments: {
            name: 'test-vm',
            node: 'pve-01',
            memory: 1024
          }
        }
      };

      const response = await mcpServer.processMessage(message);
      
      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe('test-2');
      expect(response.result.success).toBe(true);
      expect(response.result.data).toHaveProperty('vmid', 102);
    });

    it('should handle invalid message formats', async () => {
      const message = {
        // Missing jsonrpc field
        id: 'test-3',
        method: 'invalid'
      } as MCPMessage;

      const response = await mcpServer.processMessage(message);
      
      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32600); // Invalid Request
      expect(response.error?.message).toContain('Invalid JSON-RPC message');
    });

    it('should handle unknown methods', async () => {
      const message: MCPMessage = {
        jsonrpc: '2.0',
        id: 'test-4',
        method: 'unknown/method',
        params: {}
      };

      const response = await mcpServer.processMessage(message);
      
      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32601); // Method not found
      expect(response.error?.message).toContain('Method not found');
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle Proxmox connection failures gracefully', async () => {
      mockProxmoxClient.connect.mockRejectedValue(new Error('Connection timeout'));
      
      await mcpServer.start();
      
      const resources = await mcpServer.getResources(MCPResourceType.INFRASTRUCTURE);
      
      // Should return empty resources with error status
      expect(resources).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to fetch infrastructure resources'),
        expect.any(Error),
        expect.any(Object)
      );
    });

    it('should recover from temporary failures', async () => {
      // First call fails
      mockProxmoxClient.getNodes
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce([{ node: 'pve-01', status: 'online', cpu: 0.25, maxcpu: 8, mem: 4500000000, maxmem: 10000000000, uptime: 12345 }]);
      
      await mcpServer.start();
      
      // First attempt should fail gracefully
      let resources = await mcpServer.getResources(MCPResourceType.INFRASTRUCTURE);
      expect(resources).toEqual([]);
      
      // Second attempt should succeed
      resources = await mcpServer.getResources(MCPResourceType.INFRASTRUCTURE);
      expect(resources).toHaveLength(1);
      expect(resources[0]).toHaveProperty('type', 'node');
    });

    it('should validate tool parameters', async () => {
      const result = await mcpServer.executeTool('createVM', {
        // Missing required parameters
        name: 'test-vm'
        // missing node, memory, cores
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required parameters');
      expect(result.error).toContain('node');
      expect(result.error).toContain('memory');
    });
  });
});