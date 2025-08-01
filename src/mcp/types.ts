/**
 * MCP (Model Context Protocol) Types
 * Type definitions for MCP server implementation
 */

// Core MCP Protocol Types
export interface MCPMessage {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: any;
}

export interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: any;
  error?: MCPError;
}

export interface MCPError {
  code: number;
  message: string;
  data?: any;
}

// MCP Resource Types
export enum MCPResourceType {
  INFRASTRUCTURE = 'infrastructure',
  WORKSPACE = 'workspace',
  LOGS = 'logs',
  DIAGNOSTICS = 'diagnostics'
}

export interface MCPResource {
  type: string;
  name: string;
  description: string;
  uri: string;
  metadata?: Record<string, any>;
}

// MCP Tool Types
export interface MCPTool {
  name: string;
  description: string;
  parameters: string[];
  schema?: Record<string, any>;
}

export interface MCPToolResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: Record<string, any>;
}

// MCP Prompt Types
export interface MCPPromptTemplate {
  name: string;
  description: string;
  template: string;
  variables: string[];
}

// MCP Server Configuration
export interface MCPServerConfig {
  proxmoxClient: any; // ProxmoxClient type
  logger: any; // Logger type  
  workspacePath: string;
  sessionTimeout?: number;
  maxSessions?: number;
}

// MCP Session Types
export interface MCPSession {
  id: string;
  clientId: string;
  createdAt: Date;
  lastActivity: Date;
  context: Record<string, any>;
}

// MCP Server Capabilities
export interface MCPServerCapabilities {
  resources: MCPResourceType[];
  tools: string[];
  prompts: string[];
  sessionManagement: boolean;
}

// Infrastructure Resource Types
export interface InfrastructureResource extends MCPResource {
  type: 'node' | 'vm' | 'container' | 'storage' | 'network';
  status: string;
  properties: Record<string, any>;
}

// Workspace Resource Types
export interface WorkspaceResource extends MCPResource {
  type: 'workspace';
  path: string;
  configuration: Record<string, any>;
}

// Log Resource Types
export interface LogResource extends MCPResource {
  type: 'operation-logs' | 'error-logs' | 'audit-logs';
  timeRange: {
    start: string;
    end: string;
  };
  count: number;
}

// Diagnostic Resource Types
export interface DiagnosticResource extends MCPResource {
  type: 'system-health' | 'performance-metrics' | 'connectivity-status';
  lastUpdated: string;
  status: 'healthy' | 'warning' | 'error';
}

// MCP Method Types
export type MCPMethod = 
  | 'initialize'
  | 'resources/list'
  | 'resources/read'
  | 'tools/list'
  | 'tools/call'
  | 'prompts/list'
  | 'prompts/get'
  | 'session/create'
  | 'session/context/set'
  | 'session/context/get';

// Error Codes (JSON-RPC 2.0 standard)
export const MCPErrorCodes = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  SERVER_ERROR: -32000,
  RESOURCE_NOT_FOUND: -32001,
  TOOL_EXECUTION_FAILED: -32002,
  SESSION_NOT_FOUND: -32003
} as const;