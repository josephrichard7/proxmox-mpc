/**
 * Backend Monitor Agent - Real-time Server-Side Debugging and Log Analysis
 *
 * Specialized agent for backend log streaming, API monitoring,
 * database health checks, and performance metrics collection
 */

import { EventEmitter } from "events";

// import { WebSocket } from 'ws';  // Commented out to avoid type issues in testing
import { Logger } from "../../observability/logger";
import { OperationLog } from "../../observability/types";
import {
  BackendMonitorAgent as IBackendMonitorAgent,
  HealthStatus,
  LogPattern,
  PerformanceMetric,
  LogEntry,
  DebuggingFinding,
  // DebuggingEvidence
} from "../types";

export class BackendMonitorAgent
  extends EventEmitter
  implements IBackendMonitorAgent
{
  private logger: Logger;
  private isMonitoring = false;
  private logStream?: any; // WebSocket type commented out for testing
  private monitoredEndpoints: string[] = [];
  private performanceMetrics: PerformanceMetric[] = [];
  private logBuffer: LogEntry[] = [];
  private logPatterns: Map<string, LogPattern> = new Map();
  private monitoringInterval?: NodeJS.Timeout;
  private healthCheckInterval?: NodeJS.Timeout;

  constructor() {
    super();
    this.logger = Logger.getInstance();
  }

  /**
   * Start streaming logs from the backend services
   */
  async startLogStreaming(): Promise<void> {
    if (this.isMonitoring) {
      this.logger.warn("Backend monitoring already active");
      return;
    }

    this.logger.info("Starting backend log streaming");

    try {
      // Connect to existing logger stream
      await this.connectToLogStream();

      // Start monitoring existing logs
      this.startLogBufferMonitoring();

      // Start health checks
      this.startHealthChecks();

      this.isMonitoring = true;
      this.emit("log-streaming-started");
    } catch (error) {
      this.logger.error("Failed to start log streaming", error as Error);
      throw error;
    }
  }

  /**
   * Connect to the existing logger stream
   */
  private async connectToLogStream(): Promise<void> {
    // Access the existing logger buffer for real-time monitoring
    this.startLogBufferMonitoring();

    // Set up WebSocket connection if available
    try {
      // This would connect to the WebSocket service if available
      this.emit("log-stream-request", {
        type: "backend-logs",
        filters: ["error", "warn", "info"],
      });
    } catch (error) {
      this.logger.warn(
        "WebSocket log streaming not available, using buffer monitoring",
        { error },
      );
    }
  }

  /**
   * Start monitoring the existing logger buffer
   */
  private startLogBufferMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.processLogBuffer();
    }, 5000); // Check every 5 seconds

    this.logger.debug("Log buffer monitoring started");
  }

  /**
   * Process logs from the existing logger buffer
   */
  private processLogBuffer(): void {
    if (!this.isMonitoring) return;

    try {
      // Get recent logs from existing logger
      const recentLogs = this.logger.getRecentLogs(50); // Last 50 logs

      // Convert OperationLog to LogEntry format
      const newLogEntries = recentLogs
        .filter(
          (log) =>
            !this.logBuffer.some(
              (existing) =>
                existing.timestamp.getTime() ===
                  new Date(log.timestamp).getTime() &&
                existing.message === log.message,
            ),
        )
        .map(this.convertOperationLogToLogEntry);

      if (newLogEntries.length > 0) {
        this.logBuffer.push(...newLogEntries);
        this.trimLogBuffer();

        // Analyze new logs for issues
        this.analyzeLogEntries(newLogEntries);
      }
    } catch (error) {
      this.logger.error("Failed to process log buffer", error as Error);
    }
  }

  /**
   * Convert OperationLog to LogEntry
   */
  private convertOperationLogToLogEntry(operationLog: OperationLog): LogEntry {
    return {
      timestamp: new Date(operationLog.timestamp),
      level: operationLog.level,
      message: operationLog.message,
      source: operationLog.operation,
      context: operationLog.context,
      correlationId: operationLog.correlationId,
    };
  }

  /**
   * Analyze log entries for issues and patterns
   */
  private analyzeLogEntries(logEntries: LogEntry[]): void {
    // Analyze for error patterns
    const errorLogs = logEntries.filter((log) => log.level === "error");
    if (errorLogs.length > 0) {
      this.processErrorLogs(errorLogs);
    }

    // Analyze for warning patterns
    const warningLogs = logEntries.filter((log) => log.level === "warn");
    if (warningLogs.length > 0) {
      this.processWarningLogs(warningLogs);
    }

    // Update log patterns
    this.updateLogPatterns(logEntries);

    // Check for performance issues
    this.checkPerformanceIssues(logEntries);
  }

  /**
   * Process error logs and create findings
   */
  private processErrorLogs(errorLogs: LogEntry[]): void {
    // Group errors by type/pattern
    const errorGroups = this.groupErrorsByPattern(errorLogs);

    for (const [pattern, errors] of errorGroups) {
      if (errors.length >= 3) {
        // Multiple occurrences indicate a systemic issue
        const finding: DebuggingFinding = {
          id: `backend-error-${Date.now()}`,
          timestamp: new Date(),
          severity: "high",
          category: "backend",
          title: `Recurring Backend Error Pattern Detected`,
          description: `Pattern "${pattern}" occurred ${errors.length} times in recent logs`,
          source: "backend-monitor",
          evidence: {
            logs: errors,
          },
          recommendations: [
            "Review error handling in affected components",
            "Check for infrastructure issues",
            "Verify dependencies and configurations",
            "Consider implementing circuit breaker patterns",
          ],
          status: "new",
        };

        this.emit("finding-detected", finding);
        this.logger.warn(`Recurring error pattern detected`, {
          pattern,
          occurrences: errors.length,
        });
      }
    }
  }

  /**
   * Group errors by similar patterns
   */
  private groupErrorsByPattern(errorLogs: LogEntry[]): Map<string, LogEntry[]> {
    const groups = new Map<string, LogEntry[]>();

    for (const log of errorLogs) {
      // Extract error pattern (simplified)
      const pattern = this.extractErrorPattern(log.message);

      if (!groups.has(pattern)) {
        groups.set(pattern, []);
      }
      groups.get(pattern)!.push(log);
    }

    return groups;
  }

  /**
   * Extract error pattern from message
   */
  private extractErrorPattern(message: string): string {
    // Remove specific values and create pattern
    return message
      .replace(/\d+/g, "NUM")
      .replace(/[a-f0-9-]{36}/g, "UUID")
      .replace(/[a-f0-9]{8,}/g, "HASH")
      .replace(/"[^"]*"/g, "STRING")
      .substring(0, 100); // Limit length
  }

  /**
   * Process warning logs for potential issues
   */
  private processWarningLogs(warningLogs: LogEntry[]): void {
    // Look for performance warnings
    const performanceWarnings = warningLogs.filter(
      (log) =>
        log.message.includes("slow") ||
        log.message.includes("timeout") ||
        log.message.includes("performance") ||
        (log.context?.duration && log.context.duration > 5000),
    );

    if (performanceWarnings.length >= 5) {
      const finding: DebuggingFinding = {
        id: `backend-performance-${Date.now()}`,
        timestamp: new Date(),
        severity: "medium",
        category: "performance",
        title: "Performance Issues Detected in Backend",
        description: `${performanceWarnings.length} performance-related warnings detected`,
        source: "backend-monitor",
        evidence: {
          logs: performanceWarnings,
        },
        recommendations: [
          "Review slow operations and optimize queries",
          "Check system resource utilization",
          "Consider caching strategies",
          "Optimize database queries and indexes",
        ],
        status: "new",
      };

      this.emit("finding-detected", finding);
    }
  }

  /**
   * Update log patterns for trend analysis
   */
  private updateLogPatterns(logEntries: LogEntry[]): void {
    for (const log of logEntries) {
      const pattern = this.extractErrorPattern(log.message);

      if (this.logPatterns.has(pattern)) {
        const existing = this.logPatterns.get(pattern)!;
        existing.frequency++;
        existing.lastSeen = log.timestamp;
        existing.samples.push(log);

        // Keep only recent samples
        if (existing.samples.length > 10) {
          existing.samples = existing.samples.slice(-10);
        }
      } else {
        this.logPatterns.set(pattern, {
          pattern,
          frequency: 1,
          severity: log.level as "info" | "warn" | "error",
          firstSeen: log.timestamp,
          lastSeen: log.timestamp,
          samples: [log],
        });
      }
    }
  }

  /**
   * Check for performance issues in logs
   */
  private checkPerformanceIssues(logEntries: LogEntry[]): void {
    const slowOperations = logEntries.filter(
      (log) => log.context?.duration && log.context.duration > 3000, // Operations taking >3 seconds
    );

    if (slowOperations.length > 0) {
      const performanceMetrics: PerformanceMetric[] = slowOperations.map(
        (log) => ({
          timestamp: log.timestamp,
          metric: "operation_duration",
          value: log.context?.duration || 0,
          unit: "ms",
          threshold: 3000,
          target: 1000,
        }),
      );

      this.performanceMetrics.push(...performanceMetrics);
      this.trimPerformanceMetrics();
    }
  }

  /**
   * Monitor API endpoints for health and performance
   */
  async monitorApiEndpoints(endpoints: string[]): Promise<void> {
    this.monitoredEndpoints = endpoints;

    this.logger.info("Starting API endpoint monitoring", { endpoints });

    // Start periodic health checks for endpoints
    this.startEndpointHealthChecks();
  }

  /**
   * Start health checks for monitored endpoints
   */
  private startEndpointHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      for (const endpoint of this.monitoredEndpoints) {
        try {
          await this.checkEndpointHealth(endpoint);
        } catch (error) {
          this.logger.error(
            `Health check failed for endpoint ${endpoint}`,
            error as Error,
          );
        }
      }
    }, 60000); // Check every minute
  }

  /**
   * Check health of specific endpoint
   */
  private async checkEndpointHealth(endpoint: string): Promise<void> {
    const _startTime = Date.now();

    try {
      // Emit health check request (to be handled by coordinator)
      this.emit("endpoint-health-check", {
        endpoint,
        timestamp: new Date(),
      });

      // For now, analyze logs for endpoint-related errors
      const endpointLogs = this.logBuffer.filter(
        (log) =>
          log.message.includes(endpoint) || log.source.includes(endpoint),
      );

      const recentErrors = endpointLogs
        .filter((log) => log.level === "error")
        .filter((log) => Date.now() - log.timestamp.getTime() < 300000); // Last 5 minutes

      if (recentErrors.length > 5) {
        const finding: DebuggingFinding = {
          id: `endpoint-errors-${Date.now()}`,
          timestamp: new Date(),
          severity: "high",
          category: "backend",
          title: `API Endpoint Errors: ${endpoint}`,
          description: `${recentErrors.length} errors detected for endpoint in last 5 minutes`,
          source: "backend-monitor",
          evidence: {
            logs: recentErrors,
          },
          recommendations: [
            "Check endpoint implementation for bugs",
            "Verify endpoint dependencies",
            "Review error handling",
            "Consider circuit breaker implementation",
          ],
          status: "new",
        };

        this.emit("finding-detected", finding);
      }
    } catch (error) {
      this.logger.error(
        `Endpoint health check failed for ${endpoint}`,
        error as Error,
      );
    }
  }

  /**
   * Check database health
   */
  async checkDatabaseHealth(): Promise<HealthStatus> {
    this.logger.debug("Checking database health");

    try {
      // Check for database-related errors in logs
      const dbLogs = this.logBuffer.filter(
        (log) =>
          log.message.includes("database") ||
          log.message.includes("sql") ||
          log.message.includes("prisma") ||
          log.source.includes("database"),
      );

      const recentDbErrors = dbLogs
        .filter((log) => log.level === "error")
        .filter((log) => Date.now() - log.timestamp.getTime() < 600000); // Last 10 minutes

      const connectionErrors = recentDbErrors.filter(
        (log) =>
          log.message.includes("connection") || log.message.includes("timeout"),
      );

      const status: HealthStatus = {
        status:
          connectionErrors.length > 0
            ? "critical"
            : recentDbErrors.length > 3
              ? "warning"
              : "healthy",
        metrics: {
          errorCount: recentDbErrors.length,
          connectionErrors: connectionErrors.length,
          queryCount: dbLogs.filter((log) => log.level === "info").length,
        },
        issues: recentDbErrors.map((log) => log.message),
        lastChecked: new Date(),
      };

      if (status.status !== "healthy") {
        this.logger.warn("Database health issues detected", {
          status: status.status,
          errorCount: recentDbErrors.length,
          connectionErrors: connectionErrors.length,
        });
      }

      return status;
    } catch (error) {
      this.logger.error("Database health check failed", error as Error);
      return {
        status: "critical",
        metrics: { errorCount: 1 },
        issues: [`Health check failed: ${error}`],
        lastChecked: new Date(),
      };
    }
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(): Promise<PerformanceMetric[]> {
    return [...this.performanceMetrics];
  }

  /**
   * Analyze log patterns for trends
   */
  async analyzeLogPatterns(): Promise<LogPattern[]> {
    return Array.from(this.logPatterns.values())
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 20); // Top 20 patterns
  }

  /**
   * Start general health checks
   */
  private startHealthChecks(): void {
    // Check system health every 5 minutes
    setInterval(async () => {
      try {
        await this.performSystemHealthCheck();
      } catch (error) {
        this.logger.error("System health check failed", error as Error);
      }
    }, 300000);
  }

  /**
   * Perform comprehensive system health check
   */
  private async performSystemHealthCheck(): Promise<void> {
    // Check log buffer size
    if (this.logBuffer.length > 5000) {
      this.logger.warn("Log buffer growing large", {
        bufferSize: this.logBuffer.length,
      });
    }

    // Check error rate
    const recentLogs = this.logBuffer.slice(-1000); // Last 1000 logs
    const errorRate =
      recentLogs.filter((log) => log.level === "error").length /
      recentLogs.length;

    if (errorRate > 0.05) {
      // More than 5% error rate
      const finding: DebuggingFinding = {
        id: `high-error-rate-${Date.now()}`,
        timestamp: new Date(),
        severity: "high",
        category: "backend",
        title: "High Error Rate Detected",
        description: `Error rate of ${(errorRate * 100).toFixed(1)}% detected in recent logs`,
        source: "backend-monitor",
        evidence: {
          logs: recentLogs.filter((log) => log.level === "error").slice(-10),
        },
        recommendations: [
          "Investigate recent changes or deployments",
          "Check system resources and dependencies",
          "Review error patterns for common causes",
          "Consider rolling back recent changes if error rate continues",
        ],
        status: "new",
      };

      this.emit("finding-detected", finding);
    }
  }

  /**
   * Trim log buffer to prevent memory issues
   */
  private trimLogBuffer(): void {
    const maxSize = 10000;
    if (this.logBuffer.length > maxSize) {
      this.logBuffer = this.logBuffer.slice(-maxSize);
    }
  }

  /**
   * Trim performance metrics to prevent memory issues
   */
  private trimPerformanceMetrics(): void {
    const maxSize = 1000;
    if (this.performanceMetrics.length > maxSize) {
      this.performanceMetrics = this.performanceMetrics.slice(-maxSize);
    }
  }

  /**
   * Stop monitoring
   */
  async stopMonitoring(): Promise<void> {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    if (this.logStream) {
      this.logStream.close();
    }

    this.logger.info("Backend monitoring stopped");
    this.emit("monitoring-stopped");
  }

  /**
   * Get current monitoring status
   */
  getMonitoringStatus(): any {
    return {
      isMonitoring: this.isMonitoring,
      monitoredEndpoints: this.monitoredEndpoints.length,
      logBufferSize: this.logBuffer.length,
      performanceMetricsCount: this.performanceMetrics.length,
      logPatternsCount: this.logPatterns.size,
      recentErrorRate: this.calculateRecentErrorRate(),
    };
  }

  /**
   * Calculate recent error rate
   */
  private calculateRecentErrorRate(): number {
    const recentLogs = this.logBuffer.slice(-100); // Last 100 logs
    if (recentLogs.length === 0) return 0;

    const errorCount = recentLogs.filter((log) => log.level === "error").length;
    return errorCount / recentLogs.length;
  }
}
