/**
 * Observability Types
 * Core types for logging, tracing, and diagnostics
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface OperationLog {
  timestamp: string;
  correlationId: string;
  operation: string;
  phase: string;
  level: LogLevel;
  message: string;
  context: {
    workspace?: string;
    proxmoxServer?: string;
    resourcesAffected: string[];
    duration?: number;
    userId?: string;
    sessionId?: string;
    [key: string]: any; // Allow additional properties for testing and flexibility
  };
  error?: {
    type: string;
    message: string;
    stack: string;
    recoveryActions: string[];
    code?: string;
    category?: ErrorCategory;
  };
  metadata?: Record<string, any>;
}

export type ErrorCategory = 
  | 'connection'
  | 'validation' 
  | 'terraform'
  | 'ansible'
  | 'proxmox'
  | 'workspace'
  | 'system'
  | 'user';

export interface TraceSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operation: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'pending' | 'success' | 'error';
  tags: Record<string, string>;
  logs: OperationLog[];
}

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: string;
  tags: Record<string, string>;
  operation?: string;
}

export interface HealthStatus {
  component: string;
  status: 'healthy' | 'warning' | 'error';
  message: string;
  details?: Record<string, any>;
  timestamp: string;
  responseTime?: number;
}

export interface DiagnosticSnapshot {
  id: string;
  timestamp: string;
  workspace?: string;
  operation?: string;
  error?: any;
  logs: OperationLog[];
  metrics: PerformanceMetric[];
  healthStatus: HealthStatus[];
  systemInfo: {
    nodeVersion: string;
    platform: string;
    memory: NodeJS.MemoryUsage;
    uptime: number;
  };
  workspaceInfo?: {
    path: string;
    config?: any; // Make config optional for error cases
    terraformVersion?: string;
    ansibleVersion?: string;
    error?: string; // For error cases like file not found
  };
}

export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableFile: boolean;
  filePath?: string;
  enableStructured: boolean;
  enableTracing: boolean;
  maxFileSize?: string;
  maxFiles?: number;
}