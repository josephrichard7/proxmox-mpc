/**
 * Console Types
 * Type definitions for console commands and natural language processing
 */

export interface WorkspaceContext {
  workspacePath: string;
  configExists: boolean;
  mcpServerEndpoint: string;
  currentState: {
    nodes: Array<{
      node: string;
      status: string;
      cpu?: number;
      memory?: number;
    }>;
    vms: Array<{
      vmid: number;
      name: string;
      status: string;
      cpu?: number;
      memory?: number;
    }>;
    containers: Array<{
      vmid: number;
      name: string;
      status: string;
      memory?: number;
    }>;
  };
  availableCommands: string[];
  previousOperations?: Array<{
    operation: string;
    timestamp: string;
    success: boolean;
    configuration?: Record<string, any>;
  }>;
}

export interface ExecutionStep {
  type: 'generate' | 'test' | 'deploy' | 'validate' | 'destroy' | 'migrate';
  description: string;
  commands: string[];
  dependencies: string[];
  stepId?: string;
  estimatedDuration?: string;
  confidence?: number;
  safetyLevel?: 'safe' | 'requires_confirmation' | 'dangerous';
  dryRunAvailable?: boolean;
  expectedFailure?: boolean;
  recoveryActions?: string[];
  validationErrors?: string[];
  potentialIssues?: Array<{
    issue: string;
    severity: 'info' | 'warning' | 'error';
    suggestions: string[];
  }>;
  reasoning?: string;
  optimizations?: string[];
}

export interface ExecutionPlan {
  executionPlan: ExecutionStep[];
  requiresConfirmation: boolean;
  confidence: number;
  estimatedTime?: string;
  totalEstimatedTime?: string;
  blocked?: boolean;
  blockingReasons?: string[];
  safetyWarnings?: string[];
  warnings?: string[];
  recommendDryRun?: boolean;
  error?: string;
}

export interface NaturalLanguageResult extends ExecutionPlan {
  isNaturalLanguage: boolean;
}

export interface NaturalLanguageProcessorConfig {
  claudeCodeIntegration: any; // ClaudeCodeIntegration type
  proxmoxClient: any; // ProxmoxClient type
  logger: any; // Logger type
  workspacePath: string;
}

export interface ClaudeCodeConfig {
  executablePath?: string;
  timeout?: number;
  workspacePath: string;
  mcpServerEndpoint: string;
}

export interface ClaudeCodeResponse {
  success: boolean;
  executionPlan?: ExecutionStep[];
  error?: string;
  confidence?: number;
  metadata?: {
    requiresConfirmation?: boolean;
    blocked?: boolean;
    blockingReasons?: string[];
    warnings?: string[];
    recommendDryRun?: boolean;
    totalEstimatedTime?: string;
    [key: string]: any;
  };
}