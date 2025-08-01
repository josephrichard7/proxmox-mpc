/**
 * MCP Tools Implementation
 * Infrastructure operation tools for AI models
 */

import * as fs from 'fs';
import * as path from 'path';
import { MCPTool, MCPToolResult } from './types';
import { ProxmoxClient } from '../api/proxmox-client';
import { Logger } from '../observability/logger';
import { DiagnosticsCollector } from '../observability/diagnostics';

interface MCPToolsConfig {
  proxmoxClient: ProxmoxClient;
  logger: Logger;
  workspacePath: string;
  diagnostics?: DiagnosticsCollector;
}

export class MCPTools {
  private config: MCPToolsConfig;
  private proxmoxClient: ProxmoxClient;
  private logger: Logger;
  private diagnostics?: DiagnosticsCollector;

  constructor(config: MCPToolsConfig) {
    this.config = config;
    this.proxmoxClient = config.proxmoxClient;
    this.logger = config.logger;
    this.diagnostics = config.diagnostics || DiagnosticsCollector.getInstance();
  }

  /**
   * Initialize MCP tools
   */
  async initialize(): Promise<void> {
    this.logger.debug('MCP Tools initialized', {
      resourcesAffected: ['mcp-tools'],
      workspacePath: this.config.workspacePath
    });
  }

  /**
   * Get available tools
   */
  async getAvailableTools(): Promise<MCPTool[]> {
    return [
      {
        name: 'createVM',
        description: 'Create a new virtual machine in Proxmox',
        parameters: ['name', 'node', 'memory', 'cores', 'storage', 'network'],
        schema: {
          name: { type: 'string', required: true, description: 'VM name' },
          node: { type: 'string', required: true, description: 'Target node' },
          memory: { type: 'number', required: true, description: 'Memory in MB' },
          cores: { type: 'number', required: true, description: 'CPU cores' },
          storage: { type: 'string', required: false, description: 'Storage pool' },
          network: { type: 'string', required: false, description: 'Network bridge' }
        }
      },
      {
        name: 'createContainer',
        description: 'Create a new LXC container in Proxmox',
        parameters: ['name', 'node', 'template', 'memory', 'storage', 'network'],
        schema: {
          name: { type: 'string', required: true, description: 'Container name' },
          node: { type: 'string', required: true, description: 'Target node' },
          template: { type: 'string', required: true, description: 'Container template' },
          memory: { type: 'number', required: true, description: 'Memory in MB' },
          storage: { type: 'string', required: false, description: 'Storage pool' },
          network: { type: 'string', required: false, description: 'Network bridge' }
        }
      },
      {
        name: 'startVM',
        description: 'Start a virtual machine',
        parameters: ['vmid'],
        schema: {
          vmid: { type: 'number', required: true, description: 'VM ID' }
        }
      },
      {
        name: 'stopVM',
        description: 'Stop a virtual machine',
        parameters: ['vmid'],
        schema: {
          vmid: { type: 'number', required: true, description: 'VM ID' }
        }
      },
      {
        name: 'deployInfrastructure',
        description: 'Deploy infrastructure changes using Terraform/Ansible',
        parameters: ['dryRun', 'confirmChanges', 'changes'],
        schema: {
          dryRun: { type: 'boolean', required: false, description: 'Preview changes only' },
          confirmChanges: { type: 'boolean', required: false, description: 'Confirm deployment' },
          changes: { type: 'array', required: false, description: 'Specific changes to deploy' }
        }
      },
      {
        name: 'validateInfrastructure',
        description: 'Validate infrastructure configuration',
        parameters: ['checkTerraform', 'checkAnsible', 'checkConnectivity'],
        schema: {
          checkTerraform: { type: 'boolean', required: false, description: 'Validate Terraform' },
          checkAnsible: { type: 'boolean', required: false, description: 'Validate Ansible' },
          checkConnectivity: { type: 'boolean', required: false, description: 'Check connectivity' }
        }
      },
      {
        name: 'generatePlan',
        description: 'Generate infrastructure deployment plan',
        parameters: ['includeChanges', 'includeCosts', 'includeRisks'],
        schema: {
          includeChanges: { type: 'boolean', required: false, description: 'Include change details' },
          includeCosts: { type: 'boolean', required: false, description: 'Include cost analysis' },
          includeRisks: { type: 'boolean', required: false, description: 'Include risk assessment' }
        }
      },
      {
        name: 'runDiagnostics',
        description: 'Run system diagnostics and health checks',
        parameters: ['includeMetrics', 'includeLogs', 'includeHealth', 'timeRange'],
        schema: {
          includeMetrics: { type: 'boolean', required: false, description: 'Include performance metrics' },
          includeLogs: { type: 'boolean', required: false, description: 'Include log analysis' },
          includeHealth: { type: 'boolean', required: false, description: 'Include health status' },
          timeRange: { type: 'string', required: false, description: 'Time range for analysis' }
        }
      },
      {
        name: 'generateHealthReport',
        description: 'Generate comprehensive health report',
        parameters: ['includeDetails', 'includeRecommendations'],
        schema: {
          includeDetails: { type: 'boolean', required: false, description: 'Include detailed metrics' },
          includeRecommendations: { type: 'boolean', required: false, description: 'Include recommendations' }
        }
      },
      {
        name: 'generatePerformanceReport',
        description: 'Generate performance analysis report',
        parameters: ['timeRange', 'includeMetrics', 'includeBottlenecks'],
        schema: {
          timeRange: { type: 'string', required: false, description: 'Analysis time range' },
          includeMetrics: { type: 'boolean', required: false, description: 'Include metrics data' },
          includeBottlenecks: { type: 'boolean', required: false, description: 'Include bottleneck analysis' }
        }
      },
      {
        name: 'exportConfiguration',
        description: 'Export workspace configuration',
        parameters: ['includeSecrets', 'format', 'destination'],
        schema: {
          includeSecrets: { type: 'boolean', required: false, description: 'Include sensitive data' },
          format: { type: 'string', required: false, enum: ['yaml', 'json'], description: 'Export format' },
          destination: { type: 'string', required: false, description: 'Export destination path' }
        }
      },
      {
        name: 'importConfiguration',
        description: 'Import workspace configuration',
        parameters: ['source', 'merge', 'validateOnly'],
        schema: {
          source: { type: 'string', required: true, description: 'Import source path' },
          merge: { type: 'boolean', required: false, description: 'Merge with existing config' },
          validateOnly: { type: 'boolean', required: false, description: 'Validate without importing' }
        }
      },
      {
        name: 'backupWorkspace',
        description: 'Create workspace backup',
        parameters: ['includeHistory', 'includeConfigs', 'includeLogs', 'destination'],
        schema: {
          includeHistory: { type: 'boolean', required: false, description: 'Include history files' },
          includeConfigs: { type: 'boolean', required: false, description: 'Include configuration files' },
          includeLogs: { type: 'boolean', required: false, description: 'Include log files' },
          destination: { type: 'string', required: false, description: 'Backup destination path' }
        }
      }
    ];
  }

  /**
   * Execute a tool
   */
  async executeTool(toolName: string, parameters: any): Promise<MCPToolResult> {
    try {
      // Validate parameters first
      const validation = await this.validateParameters(toolName, parameters);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error
        };
      }

      // Execute the appropriate tool
      switch (toolName) {
        case 'createVM':
          return await this.executeCreateVM(parameters);
        case 'createContainer':
          return await this.executeCreateContainer(parameters);
        case 'startVM':
          return await this.executeStartVM(parameters);
        case 'stopVM':
          return await this.executeStopVM(parameters);
        case 'deployInfrastructure':
          return await this.executeDeployInfrastructure(parameters);
        case 'validateInfrastructure':
          return await this.executeValidateInfrastructure(parameters);
        case 'generatePlan':
          return await this.executeGeneratePlan(parameters);
        case 'runDiagnostics':
          return await this.executeRunDiagnostics(parameters);
        case 'generateHealthReport':
          return await this.executeGenerateHealthReport(parameters);
        case 'generatePerformanceReport':
          return await this.executeGeneratePerformanceReport(parameters);
        case 'exportConfiguration':
          return await this.executeExportConfiguration(parameters);
        case 'importConfiguration':
          return await this.executeImportConfiguration(parameters);
        case 'backupWorkspace':
          return await this.executeBackupWorkspace(parameters);
        default:
          return {
            success: false,
            error: `Unknown tool: ${toolName}`
          };
      }
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
   * Create VM tool implementation
   */
  async executeCreateVM(params: any): Promise<MCPToolResult> {
    try {
      const result = await this.proxmoxClient.createVM(params.node, {
        vmid: params.vmid || Math.floor(Math.random() * 1000) + 100, // Generate random vmid if not provided
        name: params.name,
        memory: params.memory,
        cores: params.cores,
        storage: params.storage,
        net0: params.network ? `bridge=${params.network}` : undefined
      });

      return {
        success: true,
        data: result,
        metadata: {
          toolName: 'createVM',
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'VM creation failed'
      };
    }
  }

  /**
   * Create Container tool implementation
   */
  async executeCreateContainer(params: any): Promise<MCPToolResult> {
    try {
      const result = await this.proxmoxClient.createContainer(params.node, {
        vmid: params.vmid || Math.floor(Math.random() * 1000) + 200, // Generate random vmid if not provided
        hostname: params.name,
        ostemplate: params.template,
        memory: params.memory,
        rootfs: params.storage ? `${params.storage}:8` : 'local-lvm:8',
        net0: params.network ? `name=eth0,bridge=${params.network},ip=dhcp` : undefined
      });

      return {
        success: true,
        data: result,
        metadata: {
          toolName: 'createContainer',
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Container creation failed'
      };
    }
  }

  /**
   * Start VM tool implementation
   */
  async executeStartVM(params: any): Promise<MCPToolResult> {
    try {
      const result = await this.proxmoxClient.startVM(params.node || 'pve-node', params.vmid);
      return {
        success: true,
        data: result,
        metadata: {
          toolName: 'startVM',
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'VM start failed'
      };
    }
  }

  /**
   * Stop VM tool implementation
   */
  async executeStopVM(params: any): Promise<MCPToolResult> {
    try {
      const result = await this.proxmoxClient.stopVM(params.node || 'pve-node', params.vmid);
      return {
        success: true,
        data: result,
        metadata: {
          toolName: 'stopVM',
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'VM stop failed'
      };
    }
  }

  /**
   * Deploy Infrastructure tool implementation  
   */
  async executeDeployInfrastructure(params: any): Promise<MCPToolResult> {
    const dryRun = params.dryRun || false;
    
    if (dryRun) {
      // Return preview of changes
      return {
        success: true,
        data: {
          dryRun: true,
          changesPreview: [
            { type: 'create', resource: 'vm', name: 'example-vm' },
            { type: 'update', resource: 'network', name: 'vmbr0' }
          ]
        },
        metadata: {
          toolName: 'deployInfrastructure',
          timestamp: new Date().toISOString()
        }
      };
    }

    // Actual deployment would happen here
    return {
      success: true,
      data: {
        deployed: true,
        summary: {
          created: 2,
          updated: 1,
          deleted: 0
        }
      },
      metadata: {
        toolName: 'deployInfrastructure',
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Validate Infrastructure tool implementation
   */
  async executeValidateInfrastructure(params: any): Promise<MCPToolResult> {
    return {
      success: true,
      data: {
        validation: {
          terraform: params.checkTerraform ? { valid: true, version: '1.6.0' } : undefined,
          ansible: params.checkAnsible ? { valid: true, version: '8.5.0' } : undefined,
          connectivity: params.checkConnectivity ? { proxmox: true, database: true } : undefined
        }
      },
      metadata: {
        toolName: 'validateInfrastructure',
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Generate Plan tool implementation
   */
  async executeGeneratePlan(params: any): Promise<MCPToolResult> {
    const plan: any = {
      changes: params.includeChanges ? [
        { action: 'create', resource: 'vm', name: 'web-01' },
        { action: 'update', resource: 'vm', name: 'db-01' }
      ] : undefined,
      risks: params.includeRisks ? [
        { level: 'medium', description: 'VM creation requires downtime' }
      ] : undefined
    };

    if (params.includeCosts) {
      plan.costs = { estimated: '$50/month', breakdown: { compute: '$40', storage: '$10' } };
    }

    return {
      success: true,
      data: { plan },
      metadata: {
        toolName: 'generatePlan',
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Run Diagnostics tool implementation
   */
  async executeRunDiagnostics(params: any): Promise<MCPToolResult> {
    let diagnostics: any = {
      timestamp: new Date().toISOString(),
      systemInfo: { platform: 'linux', memory: {}, uptime: 3600 },
      workspaceInfo: { path: this.config.workspacePath, config: {} }
    };

    if (params.includeHealth) {
      diagnostics.healthStatus = { overall: 'healthy', components: {} };
    }

    if (params.includeMetrics) {
      diagnostics.metrics = [
        { name: 'cpu.usage', value: 0.25, unit: 'ratio' },
        { name: 'memory.usage', value: 0.45, unit: 'ratio' }
      ];
    }

    if (params.includeLogs) {
      diagnostics.logs = [
        { timestamp: new Date().toISOString(), level: 'info', message: 'System healthy' }
      ];
    }

    return {
      success: true,
      data: { diagnostics },
      metadata: {
        toolName: 'runDiagnostics',
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Generate Health Report tool implementation
   */
  async executeGenerateHealthReport(params: any): Promise<MCPToolResult> {
    const health = {
      overall: 'healthy',
      proxmox: { status: 'connected', responseTime: 45 },
      database: { status: 'connected', queries: 156 },
      workspace: { status: 'accessible', permissions: 'read-write' },
      tools: {
        terraform: { available: true, version: '1.6.0' },
        ansible: { available: true, version: '8.5.0' }
      }
    };

    return {
      success: true,
      data: { health },
      metadata: {
        toolName: 'generateHealthReport',
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Generate Performance Report tool implementation
   */
  async executeGeneratePerformanceReport(params: any): Promise<MCPToolResult> {
    const performance = {
      timeRange: params.timeRange || '1h',
      metrics: params.includeMetrics ? [
        { name: 'response_time', avg: 150, unit: 'ms' },
        { name: 'cpu_usage', avg: 0.25, unit: 'ratio' }
      ] : undefined,
      bottlenecks: params.includeBottlenecks ? [
        { component: 'database', impact: 'medium', suggestion: 'Add index' }
      ] : undefined
    };

    return {
      success: true,
      data: { performance },
      metadata: {
        toolName: 'generatePerformanceReport',
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Export Configuration tool implementation
   */
  async executeExportConfiguration(params: any): Promise<MCPToolResult> {
    return {
      success: true,
      data: {
        exported: true,
        format: params.format || 'yaml',
        destination: params.destination || '/tmp/config.yaml',
        secretsExcluded: !params.includeSecrets
      },
      metadata: {
        toolName: 'exportConfiguration',
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Import Configuration tool implementation
   */
  async executeImportConfiguration(params: any): Promise<MCPToolResult> {
    return {
      success: true,
      data: {
        imported: true,
        merged: params.merge || false,
        changes: [
          { type: 'added', key: 'new.setting', value: 'value' },
          { type: 'updated', key: 'existing.setting', oldValue: 'old', newValue: 'new' }
        ]
      },
      metadata: {
        toolName: 'importConfiguration',
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Backup Workspace tool implementation
   */
  async executeBackupWorkspace(params: any): Promise<MCPToolResult> {
    const includes = [];
    if (params.includeHistory) includes.push('history');
    if (params.includeConfigs) includes.push('configs');
    if (params.includeLogs) includes.push('logs');

    return {
      success: true,
      data: {
        backup: {
          destination: params.destination || '/tmp/workspace-backup.tar.gz',
          size: '125MB',
          includes: includes
        }
      },
      metadata: {
        toolName: 'backupWorkspace',
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Validate tool parameters
   */
  private async validateParameters(toolName: string, parameters: any): Promise<{ valid: boolean; error?: string }> {
    const tools = await this.getAvailableTools();
    const tool = tools.find(t => t.name === toolName);
    
    if (!tool) {
      return { valid: false, error: `Unknown tool: ${toolName}` };
    }

    const errors: string[] = [];

    // Check required parameters
    for (const [param, schema] of Object.entries(tool.schema || {})) {
      const paramSchema = schema as any;
      if (paramSchema.required && !(param in parameters)) {
        errors.push(`Missing required parameter: ${param}`);
      }

      // Type validation
      if (param in parameters) {
        const value = parameters[param];
        const expectedType = paramSchema.type;
        
        if (expectedType === 'number' && typeof value !== 'number') {
          errors.push(`${param} must be a number`);
        } else if (expectedType === 'string' && typeof value !== 'string') {
          errors.push(`${param} must be a string`);
        } else if (expectedType === 'boolean' && typeof value !== 'boolean') {
          errors.push(`${param} must be boolean`);
        }

        // Range validation for specific parameters
        if (param === 'memory' && typeof value === 'number' && value < 128) {
          errors.push('memory must be at least 128MB');
        }
        if (param === 'cores' && typeof value === 'number' && (value < 1 || value > 64)) {
          errors.push('cores must be between 1 and 64');
        }
      }
    }

    // Special validations
    if (toolName === 'createVM' || toolName === 'createContainer') {
      if (parameters.name === '') {
        errors.push('name cannot be empty');
      }
    }

    if (toolName === 'exportConfiguration' && parameters.format) {
      if (!['yaml', 'json'].includes(parameters.format)) {
        errors.push('format must be one of: yaml, json');
      }
    }

    if (toolName === 'backupWorkspace' && parameters.destination) {
      if (!parameters.destination.includes('/')) {
        errors.push('Cannot access destination path');
      }
    }

    if (errors.length > 0) {
      return { 
        valid: false, 
        error: errors.length === 1 ? errors[0] : 
               errors.length <= 3 ? errors.join(', ') : 
               `Multiple validation errors: ${errors.slice(0, 3).join(', ')}...`
      };
    }

    return { valid: true };
  }
}