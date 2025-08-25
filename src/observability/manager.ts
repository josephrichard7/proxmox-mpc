/**
 * Observability Manager
 * Unified entry point for all observability functionality
 * Consolidates singleton patterns and provides dependency injection
 */

import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from './logger';
import { MetricsCollector } from './metrics';
import { Tracer } from './tracer';
import { DiagnosticsCollector } from './diagnostics';
import { LoggerConfig } from './types';

export interface ObservabilityConfig {
  logger?: LoggerConfig;
  enableMetrics?: boolean;
  enableTracing?: boolean;
  enableDiagnostics?: boolean;
}

export class ObservabilityManager {
  private static instance: ObservabilityManager;
  private config: ObservabilityConfig;
  private _logger?: Logger;
  private _metrics?: MetricsCollector;
  private _tracer?: Tracer;
  private _diagnostics?: DiagnosticsCollector;
  private initialized = false;

  private constructor(config: ObservabilityConfig = {}) {
    this.config = {
      enableMetrics: true,
      enableTracing: true,
      enableDiagnostics: true,
      ...config
    };
  }

  static getInstance(config?: ObservabilityConfig): ObservabilityManager {
    if (!ObservabilityManager.instance) {
      ObservabilityManager.instance = new ObservabilityManager(config);
    }
    return ObservabilityManager.instance;
  }

  /**
   * Initialize all observability components
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Initialize logger first (other components depend on it)
    this._logger = Logger.getInstance(this.config.logger);
    
    // Initialize other components
    if (this.config.enableMetrics) {
      this._metrics = MetricsCollector.getInstance();
    }
    
    if (this.config.enableTracing) {
      this._tracer = Tracer.getInstance();
    }
    
    if (this.config.enableDiagnostics) {
      this._diagnostics = DiagnosticsCollector.getInstance();
    }

    this.initialized = true;
    this._logger?.info('Observability manager initialized', {
      resourcesAffected: []
    }, {
      enabledComponents: {
        logger: true,
        metrics: this.config.enableMetrics,
        tracing: this.config.enableTracing,
        diagnostics: this.config.enableDiagnostics
      }
    });
  }

  /**
   * Ensure initialization before component access
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Get logger instance
   */
  async getLogger(): Promise<Logger> {
    await this.ensureInitialized();
    if (!this._logger) {
      throw new Error('Logger not available - check configuration');
    }
    return this._logger;
  }

  /**
   * Get metrics collector instance
   */
  async getMetrics(): Promise<MetricsCollector> {
    await this.ensureInitialized();
    if (!this._metrics) {
      throw new Error('Metrics collector not enabled - set enableMetrics: true in config');
    }
    return this._metrics;
  }

  /**
   * Get tracer instance
   */
  async getTracer(): Promise<Tracer> {
    await this.ensureInitialized();
    if (!this._tracer) {
      throw new Error('Tracer not enabled - set enableTracing: true in config');
    }
    return this._tracer;
  }

  /**
   * Get diagnostics collector instance
   */
  async getDiagnostics(): Promise<DiagnosticsCollector> {
    await this.ensureInitialized();
    if (!this._diagnostics) {
      throw new Error('Diagnostics collector not enabled - set enableDiagnostics: true in config');
    }
    return this._diagnostics;
  }

  /**
   * Synchronous getters for backwards compatibility (auto-initialize)
   */
  get logger(): Logger {
    if (!this._logger) {
      this._logger = Logger.getInstance(this.config.logger);
    }
    return this._logger;
  }

  get metrics(): MetricsCollector {
    if (!this._metrics && this.config.enableMetrics) {
      this._metrics = MetricsCollector.getInstance();
    }
    if (!this._metrics) {
      throw new Error('Metrics collector not enabled');
    }
    return this._metrics;
  }

  get tracer(): Tracer {
    if (!this._tracer && this.config.enableTracing) {
      this._tracer = Tracer.getInstance();
    }
    if (!this._tracer) {
      throw new Error('Tracer not enabled');
    }
    return this._tracer;
  }

  get diagnostics(): DiagnosticsCollector {
    if (!this._diagnostics && this.config.enableDiagnostics) {
      this._diagnostics = DiagnosticsCollector.getInstance();
    }
    if (!this._diagnostics) {
      throw new Error('Diagnostics collector not enabled');
    }
    return this._diagnostics;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ObservabilityConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Update logger config if provided
    if (config.logger && this._logger) {
      this._logger.updateConfig(config.logger);
    }

    this.logger.info('Observability configuration updated', {
      resourcesAffected: []
    }, { newConfig: config });
  }

  /**
   * Get current configuration
   */
  getConfig(): ObservabilityConfig {
    return { ...this.config };
  }

  /**
   * Convenience methods for common operations
   */

  /**
   * Start an operation with full observability
   */
  async startOperation(operation: string, context: any = {}): Promise<{
    spanId: string;
    timerName: string;
    end: (success: boolean, error?: Error, additionalContext?: any) => void;
  }> {
    const logger = await this.getLogger();
    const metrics = await this.getMetrics();
    const tracer = await this.getTracer();

    const spanId = tracer.startTrace(operation, context);
    const timerName = `operation_${operation}_${Date.now()}`;
    metrics.startTimer(timerName, { operation, ...context });

    logger.operationStart(operation, 'execution', context);

    return {
      spanId,
      timerName,
      end: (success: boolean, error?: Error, additionalContext: any = {}) => {
        const duration = metrics.endTimer(timerName, { success: success.toString() });
        
        if (success) {
          tracer.finishSpan(spanId, additionalContext);
          logger.operationSuccess(operation, 'execution', duration, {
            ...context,
            ...additionalContext
          });
        } else {
          tracer.finishSpanWithError(spanId, error || new Error('Operation failed'), additionalContext);
          logger.operationFailure(operation, 'execution', error || new Error('Operation failed'), duration, {
            ...context,
            ...additionalContext
          });
        }
      }
    };
  }

  /**
   * Create diagnostic snapshot
   */
  async createSnapshot(workspace?: string, operation?: string, error?: any) {
    const diagnostics = await this.getDiagnostics();
    return diagnostics.generateSnapshot(workspace, operation, error);
  }

  /**
   * Get health status
   */
  async getHealthStatus() {
    const diagnostics = await this.getDiagnostics();
    return diagnostics.performHealthChecks();
  }

  /**
   * Get recent logs with filtering
   */
  async getLogs(limit?: number, level?: string, operation?: string) {
    const logger = await this.getLogger();
    return logger.getRecentLogs(limit, level as any, operation);
  }

  /**
   * Get metrics summary
   */
  async getMetricsSummary(timeWindow?: number) {
    const metrics = await this.getMetrics();
    return metrics.getMetricsSummary(timeWindow);
  }

  /**
   * Get trace information
   */
  async getTraceInfo(traceId: string) {
    const tracer = await this.getTracer();
    return {
      trace: tracer.getTrace(traceId),
      summary: tracer.getTraceSummary(traceId)
    };
  }

  /**
   * Reset all observability data (for testing)
   */
  async reset(): Promise<void> {
    const logger = await this.getLogger();
    logger.clearBuffer();

    if (this.config.enableMetrics) {
      const metrics = await this.getMetrics();
      metrics.clearMetrics();
    }

    if (this.config.enableTracing) {
      const tracer = await this.getTracer();
      tracer.clearCompletedSpans();
      tracer.abortAllSpans();
    }

    logger.info('Observability data reset', {
      resourcesAffected: []
    });
  }

  /**
   * Shutdown observability system
   */
  async shutdown(): Promise<void> {
    const logger = this._logger;
    
    if (this._metrics) {
      this._metrics.stopSystemMetrics();
    }

    if (this._tracer) {
      this._tracer.abortAllSpans();
    }

    logger?.info('Observability manager shutting down', {
      resourcesAffected: []
    });

    // Clear references
    this._logger = undefined;
    this._metrics = undefined;
    this._tracer = undefined;
    this._diagnostics = undefined;
    this.initialized = false;
  }

  /**
   * Create scoped observability context for a specific operation
   */
  createScope(operation: string, context: any = {}) {
    return {
      logger: {
        debug: (message: string, additionalContext?: any, metadata?: any) => 
          this.logger.debug(message, { ...context, ...additionalContext }, { operation, ...metadata }),
        info: (message: string, additionalContext?: any, metadata?: any) => 
          this.logger.info(message, { ...context, ...additionalContext }, { operation, ...metadata }),
        warn: (message: string, additionalContext?: any, metadata?: any) => 
          this.logger.warn(message, { ...context, ...additionalContext }, { operation, ...metadata }),
        error: (message: string, error?: Error, additionalContext?: any, recoveryActions?: string[]) => 
          this.logger.error(message, error, { ...context, ...additionalContext }, recoveryActions),
      },
      metrics: {
        record: (name: string, value: number, unit: string, tags: any = {}) =>
          this.metrics.record(name, value, unit, { operation, ...context, ...tags }, operation),
        startTimer: (name: string, tags: any = {}) =>
          this.metrics.startTimer(`${operation}_${name}`, { operation, ...context, ...tags }),
        endTimer: (name: string, tags: any = {}) =>
          this.metrics.endTimer(`${operation}_${name}`, { operation, ...context, ...tags }),
      }
    };
  }
}

/**
 * Default export for easy access
 */
export const observability = ObservabilityManager.getInstance();