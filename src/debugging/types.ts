/**
 * Autonomous Web Application Debugging System - Type Definitions
 *
 * Core interfaces and types for multi-agent debugging system
 */

export interface DebuggingSession {
  id: string;
  startTime: Date;
  status: "initializing" | "active" | "paused" | "completed" | "error";
  mode: "continuous" | "incident" | "proactive" | "validation";
  context: DebuggingContext;
  agents: ActiveAgent[];
  findings: DebuggingFinding[];
}

export interface DebuggingContext {
  applicationUrls: {
    frontend: string;
    backend: string;
    api?: string;
  };
  monitoringScope: {
    includeUI: boolean;
    includeBackend: boolean;
    includeNetwork: boolean;
    includePerformance: boolean;
  };
  thresholds: PerformanceThresholds;
  userWorkflows: UserWorkflow[];
}

export interface PerformanceThresholds {
  responseTime: number; // ms
  errorRate: number; // percentage
  cpuUsage: number; // percentage
  memoryUsage: number; // percentage
  loadTime: number; // ms
}

export interface UserWorkflow {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  criticalPath: boolean;
}

export interface WorkflowStep {
  action: "navigate" | "click" | "type" | "wait" | "verify";
  target?: string;
  value?: string;
  expected?: string;
  timeout?: number;
}

export interface ActiveAgent {
  type: AgentType;
  status: "initializing" | "active" | "idle" | "error";
  lastActivity: Date;
  currentTask?: AgentTask;
  metrics: AgentMetrics;
}

export type AgentType =
  | "coordinator"
  | "planner"
  | "ui-inspector"
  | "backend-monitor"
  | "implementer"
  | "validator"
  | "documenter";

export interface AgentTask {
  id: string;
  type: string;
  description: string;
  startTime: Date;
  estimatedDuration?: number;
  dependencies?: string[];
  status: "pending" | "in-progress" | "completed" | "failed";
}

export interface AgentMetrics {
  tasksCompleted: number;
  averageTaskTime: number;
  successRate: number;
  errorCount: number;
  lastError?: string;
}

export interface DebuggingFinding {
  id: string;
  timestamp: Date;
  severity: "critical" | "high" | "medium" | "low" | "info";
  category:
    | "ui"
    | "backend"
    | "performance"
    | "network"
    | "security"
    | "accessibility";
  title: string;
  description: string;
  source: AgentType;
  evidence: DebuggingEvidence;
  recommendations: string[];
  status: "new" | "analyzing" | "confirmed" | "fixed" | "false-positive";
}

export interface DebuggingEvidence {
  screenshots?: string[];
  logs?: LogEntry[];
  networkRequests?: NetworkRequest[];
  performanceMetrics?: PerformanceMetric[];
  consoleErrors?: ConsoleError[];
  stackTraces?: string[];
}

export interface LogEntry {
  timestamp: Date;
  level: "debug" | "info" | "warn" | "error";
  message: string;
  source: string;
  context?: Record<string, any>;
  correlationId?: string;
}

export interface NetworkRequest {
  timestamp: Date;
  method: string;
  url: string;
  statusCode: number;
  responseTime: number;
  size: number;
  headers: Record<string, string>;
  error?: string;
}

export interface PerformanceMetric {
  timestamp: Date;
  metric: string;
  value: number;
  unit: string;
  target?: number;
  threshold?: number;
}

export interface ConsoleError {
  timestamp: Date;
  level: "error" | "warn";
  message: string;
  source: string;
  lineNumber?: number;
  columnNumber?: number;
  stackTrace?: string;
}

export interface DebuggingWorkflow {
  id: string;
  name: string;
  description: string;
  triggerConditions: TriggerCondition[];
  steps: WorkflowStep[];
  timeout: number;
  retryCount: number;
  requiredAgents: AgentType[];
}

export interface TriggerCondition {
  type:
    | "error-rate"
    | "response-time"
    | "console-error"
    | "network-failure"
    | "manual";
  threshold?: number;
  timeWindow?: number; // minutes
  pattern?: string;
}

export interface AgentCommunication {
  sendMessage(agentType: AgentType, message: AgentMessage): Promise<void>;
  broadcastMessage(message: AgentMessage): Promise<void>;
  subscribeToMessages(callback: (message: AgentMessage) => void): void;
}

export interface AgentMessage {
  id: string;
  timestamp: Date;
  from: AgentType;
  to?: AgentType;
  type:
    | "task-assignment"
    | "status-update"
    | "finding-report"
    | "coordination"
    | "error";
  payload: any;
  correlationId?: string;
}

export interface DebuggingConfiguration {
  enabled: boolean;
  mode: "continuous" | "on-demand";
  agentConfiguration: {
    [K in AgentType]?: {
      enabled: boolean;
      config: any;
    };
  };
  monitoring: {
    interval: number; // ms
    batchSize: number;
    retentionPeriod: number; // hours
  };
  thresholds: PerformanceThresholds;
  notifications: {
    enabled: boolean;
    channels: ("console" | "websocket" | "email" | "slack")[];
    severity: ("critical" | "high" | "medium" | "low")[];
  };
}

// Agent-specific interfaces
export interface UIInspectorAgent {
  startMonitoring(urls: string[]): Promise<void>;
  takeScreenshot(url: string): Promise<string>;
  getConsoleLogs(url: string): Promise<ConsoleError[]>;
  monitorNetworkRequests(url: string): Promise<NetworkRequest[]>;
  detectVisualRegression(
    beforePath: string,
    afterPath: string,
  ): Promise<boolean>;
  validateUserWorkflow(workflow: UserWorkflow): Promise<ValidationResult>;
}

export interface BackendMonitorAgent {
  startLogStreaming(): Promise<void>;
  monitorApiEndpoints(endpoints: string[]): Promise<void>;
  checkDatabaseHealth(): Promise<HealthStatus>;
  getPerformanceMetrics(): Promise<PerformanceMetric[]>;
  analyzeLogPatterns(): Promise<LogPattern[]>;
}

export interface ValidationResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
  duration: number;
  steps: {
    step: WorkflowStep;
    result: "passed" | "failed" | "warning";
    message?: string;
    screenshot?: string;
  }[];
}

export interface HealthStatus {
  status: "healthy" | "warning" | "critical";
  metrics: Record<string, number>;
  issues: string[];
  lastChecked: Date;
}

export interface LogPattern {
  pattern: string;
  frequency: number;
  severity: "info" | "warn" | "error";
  firstSeen: Date;
  lastSeen: Date;
  samples: LogEntry[];
}

// Event system for real-time coordination
export interface DebuggingEvent {
  id: string;
  timestamp: Date;
  type: string;
  source: AgentType;
  data: any;
  sessionId: string;
}

export type DebuggingEventHandler = (
  event: DebuggingEvent,
) => void | Promise<void>;

export interface DebuggingEventEmitter {
  emit(event: DebuggingEvent): void;
  on(eventType: string, handler: DebuggingEventHandler): void;
  off(eventType: string, handler: DebuggingEventHandler): void;
  once(eventType: string, handler: DebuggingEventHandler): void;
}

// Storage and persistence
export interface DebuggingStorage {
  saveFinding(finding: DebuggingFinding): Promise<string>;
  getFinding(id: string): Promise<DebuggingFinding | null>;
  getFindings(
    sessionId: string,
    filters?: FindingFilters,
  ): Promise<DebuggingFinding[]>;
  saveSession(session: DebuggingSession): Promise<void>;
  getSession(id: string): Promise<DebuggingSession | null>;
  saveEvidence(evidence: DebuggingEvidence): Promise<string>;
  getEvidence(id: string): Promise<DebuggingEvidence | null>;
}

export interface FindingFilters {
  severity?: ("critical" | "high" | "medium" | "low")[];
  category?: ("ui" | "backend" | "performance" | "network" | "security")[];
  status?: ("new" | "analyzing" | "confirmed" | "fixed" | "false-positive")[];
  dateFrom?: Date;
  dateTo?: Date;
}
