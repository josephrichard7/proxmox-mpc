/**
 * MCP Server Implementation
 * Model Context Protocol server for AI collaboration
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
  MCPServerConfig,
  MCPServerCapabilities,
  MCPResourceType,
  MCPResource,
  MCPTool,
  MCPPromptTemplate,
  MCPSession,
  MCPMessage,
  MCPResponse,
  MCPError,
  MCPErrorCodes,
  MCPToolResult
} from './types';
import { MCPResourceProvider } from './mcp-resources';
import { MCPTools } from './mcp-tools';
import { MCPPrompts } from './mcp-prompts';
import { Logger } from '../observability/logger';
import { ProxmoxClient } from '../api/proxmox-client';

export class MCPServer extends EventEmitter {
  private config: MCPServerConfig;
  private logger: Logger;
  private proxmoxClient: ProxmoxClient;
  private resourceProvider: MCPResourceProvider;
  private tools: MCPTools;
  private prompts: MCPPrompts;
  private sessions: Map<string, MCPSession>;
  private isServerRunning: boolean = false;
  private sessionCleanupInterval?: NodeJS.Timeout;

  constructor(config: MCPServerConfig) {
    super();
    this.config = config;
    this.logger = config.logger;
    this.proxmoxClient = config.proxmoxClient;
    this.sessions = new Map();

    // Initialize components
    this.resourceProvider = new MCPResourceProvider({
      proxmoxClient: this.proxmoxClient,
      logger: this.logger,
      workspacePath: config.workspacePath
    });

    this.tools = new MCPTools({
      proxmoxClient: this.proxmoxClient,
      logger: this.logger,
      workspacePath: config.workspacePath
    });

    this.prompts = new MCPPrompts({
      logger: this.logger,
      workspacePath: config.workspacePath
    });
  }

  /**
   * Get MCP server capabilities
   */
  async getCapabilities(): Promise<MCPServerCapabilities> {
    return {
      resources: [
        MCPResourceType.INFRASTRUCTURE,
        MCPResourceType.WORKSPACE,
        MCPResourceType.LOGS,
        MCPResourceType.DIAGNOSTICS
      ],
      tools: [
        'createVM',
        'createContainer',
        'deployInfrastructure',
        'runDiagnostics',
        'generateReport'
      ],
      prompts: [
        'troubleshoot',
        'optimize',
        'plan'
      ],
      sessionManagement: true
    };
  }

  /**
   * Start MCP server
   */
  async start(): Promise<void> {
    if (this.isServerRunning) {
      return;
    }

    try {
      // Initialize components
      await this.resourceProvider.initialize();
      await this.tools.initialize();
      await this.prompts.initialize();

      this.isServerRunning = true;

      // Start session cleanup interval
      this.sessionCleanupInterval = setInterval(
        () => this.cleanupExpiredSessions(),
        5 * 60 * 1000 // 5 minutes
      );

      this.logger.info('MCP server started successfully', {
        resourcesAffected: ['mcp-server'],
        workspacePath: this.config.workspacePath
      });

      this.emit('started');
    } catch (error) {
      this.logger.error('Failed to start MCP server', error instanceof Error ? error : new Error(String(error)), {
        resourcesAffected: ['mcp-server']
      });
      throw error;
    }
  }

  /**
   * Stop MCP server
   */
  async stop(): Promise<void> {
    if (!this.isServerRunning) {
      return;
    }

    try {
      // Clear session cleanup interval
      if (this.sessionCleanupInterval) {
        clearInterval(this.sessionCleanupInterval);
        this.sessionCleanupInterval = undefined;
      }

      // Clear all sessions
      this.sessions.clear();

      this.isServerRunning = false;

      this.logger.info('MCP server stopped successfully', {
        resourcesAffected: ['mcp-server']
      });

      this.emit('stopped');
    } catch (error) {
      this.logger.error('Failed to stop MCP server', error instanceof Error ? error : new Error(String(error)), {
        resourcesAffected: ['mcp-server']
      });
      throw error;
    }
  }

  /**
   * Check if server is running
   */
  isRunning(): boolean {
    return this.isServerRunning;
  }

  /**
   * Get workspace context information
   */
  async getWorkspaceContext(): Promise<any> {
    return {
      workspacePath: this.config.workspacePath,
      infrastruactureState: await this.resourceProvider.getInfrastructureState(),
      availableTools: await this.getAvailableTools()
    };
  }

  /**
   * Get resources by type
   */
  async getResources(type: MCPResourceType, filters?: any): Promise<MCPResource[]> {
    try {
      return await this.resourceProvider.getResources(type, filters);
    } catch (error) {
      this.logger.error('Failed to get MCP resources', error instanceof Error ? error : new Error(String(error)), {
        resourcesAffected: ['mcp-resources'],
        resourceType: type
      });
      return [];
    }
  }

  /**
   * Get available tools
   */
  async getAvailableTools(): Promise<MCPTool[]> {
    return await this.tools.getAvailableTools();
  }

  /**
   * Execute tool
   */
  async executeTool(toolName: string, parameters: any): Promise<MCPToolResult> {
    try {
      this.logger.info(`MCP tool executed: ${toolName}`, {
        resourcesAffected: ['mcp-tools'],
        toolName,
        parameters
      });

      return await this.tools.executeTool(toolName, parameters);
    } catch (error) {
      this.logger.error(`MCP tool execution failed: ${toolName}`, error instanceof Error ? error : new Error(String(error)), {
        resourcesAffected: ['mcp-tools'],
        toolName,
        parameters
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get prompt templates
   */
  async getPromptTemplates(): Promise<MCPPromptTemplate[]> {
    return await this.prompts.getPromptTemplates();
  }

  /**
   * Render prompt template with context
   */
  async renderPrompt(templateName: string, context: any): Promise<string> {
    return await this.prompts.renderPrompt(templateName, context);
  }

  /**
   * Create session
   */
  async createSession(clientId: string): Promise<string> {
    const sessionId = uuidv4();
    const session: MCPSession = {
      id: sessionId,
      clientId,
      createdAt: new Date(),
      lastActivity: new Date(),
      context: {}
    };

    this.sessions.set(sessionId, session);

    this.logger.info('MCP session created', {
      resourcesAffected: ['mcp-session'],
      sessionId,
      clientId
    });

    return sessionId;
  }

  /**
   * Get session
   */
  async getSession(sessionId: string): Promise<MCPSession | null> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = new Date();
    }
    return session || null;
  }

  /**
   * Set session context
   */
  async setSessionContext(sessionId: string, context: any): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.context = { ...session.context, ...context };
      session.lastActivity = new Date();
    }
  }

  /**
   * Get session context
   */
  async getSessionContext(sessionId: string): Promise<any> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = new Date();
      return session.context;
    }
    return {};
  }

  /**
   * Cleanup expired sessions
   */
  async cleanupExpiredSessions(): Promise<void> {
    const sessionTimeout = this.config.sessionTimeout || 30 * 60 * 1000; // 30 minutes
    const now = new Date();

    for (const [sessionId, session] of this.sessions.entries()) {
      const timeSinceLastActivity = now.getTime() - session.lastActivity.getTime();
      if (timeSinceLastActivity > sessionTimeout) {
        this.sessions.delete(sessionId);
        this.logger.debug('MCP session expired and removed', {
          resourcesAffected: ['mcp-session'],
          sessionId,
          clientId: session.clientId
        });
      }
    }
  }

  /**
   * Process MCP message
   */
  async processMessage(message: MCPMessage): Promise<MCPResponse> {
    try {
      // Validate JSON-RPC format
      if (message.jsonrpc !== '2.0' || !message.id || !message.method) {
        return {
          jsonrpc: '2.0',
          id: message.id || 0,
          error: {
            code: MCPErrorCodes.INVALID_REQUEST,
            message: 'Invalid JSON-RPC message format'
          }
        };
      }

      // Route message to appropriate handler
      switch (message.method) {
        case 'resources/list':
          const resources = await this.getResources(message.params?.type);
          return {
            jsonrpc: '2.0',
            id: message.id,
            result: { resources }
          };

        case 'tools/call':
          const toolResult = await this.executeTool(
            message.params?.name,
            message.params?.arguments
          );
          return {
            jsonrpc: '2.0',
            id: message.id,
            result: toolResult
          };

        case 'prompts/get':
          const rendered = await this.renderPrompt(
            message.params?.name,
            message.params?.context
          );
          return {
            jsonrpc: '2.0',
            id: message.id,
            result: { content: rendered }
          };

        default:
          return {
            jsonrpc: '2.0',
            id: message.id,
            error: {
              code: MCPErrorCodes.METHOD_NOT_FOUND,
              message: `Method not found: ${message.method}`
            }
          };
      }
    } catch (error) {
      this.logger.error('MCP message processing failed', error instanceof Error ? error : new Error(String(error)), {
        resourcesAffected: ['mcp-server'],
        method: message.method
      });

      return {
        jsonrpc: '2.0',
        id: message.id,
        error: {
          code: MCPErrorCodes.INTERNAL_ERROR,
          message: error instanceof Error ? error.message : 'Internal error'
        }
      };
    }
  }
}