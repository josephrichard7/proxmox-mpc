/**
 * Structured Logger
 * JSON-formatted logging with correlation IDs and comprehensive context
 */

import * as fs from 'fs';
import * as path from 'path';

import { v4 as uuidv4 } from 'uuid';

import { OperationLog, LogLevel, LoggerConfig, ErrorCategory } from './types';

export class Logger {
  private static instance: Logger;
  private config: LoggerConfig;
  private logBuffer: OperationLog[] = [];
  private currentTraceId?: string;
  private currentSpanId?: string;
  private sessionId: string;

  private constructor(config: LoggerConfig) {
    this.config = config;
    this.sessionId = uuidv4();
    this.ensureLogDirectory();
  }

  static getInstance(config?: LoggerConfig): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(config || Logger.getDefaultConfig());
    }
    return Logger.instance;
  }

  static getDefaultConfig(): LoggerConfig {
    return {
      level: 'info',
      enableConsole: true,
      enableFile: true,
      filePath: path.join(process.cwd(), '.proxmox', 'logs', 'proxmox-mpc.log'),
      enableStructured: true,
      enableTracing: true,
      maxFileSize: '10MB',
      maxFiles: 5
    };
  }

  /**
   * Set trace context for correlation
   */
  setTraceContext(traceId: string, spanId: string): void {
    this.currentTraceId = traceId;
    this.currentSpanId = spanId;
  }

  /**
   * Clear trace context
   */
  clearTraceContext(): void {
    this.currentTraceId = undefined;
    this.currentSpanId = undefined;
  }

  /**
   * Log debug message
   */
  debug(message: string, context: Partial<OperationLog['context']> = {}, metadata?: Record<string, any>): void {
    this.log('debug', message, context, undefined, metadata);
  }

  /**
   * Log info message
   */
  info(message: string, context: Partial<OperationLog['context']> = {}, metadata?: Record<string, any>): void {
    this.log('info', message, context, undefined, metadata);
  }

  /**
   * Log warning message
   */
  warn(message: string, context: Partial<OperationLog['context']> = {}, metadata?: Record<string, any>): void {
    this.log('warn', message, context, undefined, metadata);
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error, context: Partial<OperationLog['context']> = {}, recoveryActions: string[] = []): void {
    const errorInfo = error ? {
      type: error.constructor.name,
      message: error.message,
      stack: error.stack || '',
      recoveryActions,
      code: (error as any).code,
      category: this.categorizeError(error)
    } : undefined;

    this.log('error', message, context, errorInfo);
  }

  /**
   * Log operation start
   */
  operationStart(operation: string, phase: string, context: Partial<OperationLog['context']> = {}): void {
    this.info(`Starting ${operation} - ${phase}`, {
      ...context,
      duration: 0
    }, {
      operationType: 'start',
      operation,
      phase
    });
  }

  /**
   * Log operation success
   */
  operationSuccess(operation: string, phase: string, duration: number, context: Partial<OperationLog['context']> = {}): void {
    this.info(`Completed ${operation} - ${phase}`, {
      ...context,
      duration
    }, {
      operationType: 'success',
      operation,
      phase,
      duration
    });
  }

  /**
   * Log operation failure
   */
  operationFailure(operation: string, phase: string, error: Error, duration: number, context: Partial<OperationLog['context']> = {}, recoveryActions: string[] = []): void {
    this.error(`Failed ${operation} - ${phase}`, error, {
      ...context,
      duration
    }, recoveryActions);
  }

  /**
   * Core logging method
   */
  private log(
    level: LogLevel,
    message: string,
    context: Partial<OperationLog['context']>,
    error?: OperationLog['error'],
    metadata?: Record<string, any>
  ): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const logEntry: OperationLog = {
      timestamp: new Date().toISOString(),
      correlationId: this.currentTraceId || uuidv4(),
      operation: metadata?.operation || context.workspace || 'unknown',
      phase: metadata?.phase || 'execution',
      level,
      message,
      context: {
        resourcesAffected: [],
        sessionId: this.sessionId,
        ...context
      },
      error,
      metadata
    };

    // Add to buffer for querying
    this.logBuffer.push(logEntry);
    this.trimLogBuffer();

    // Output to console if enabled
    if (this.config.enableConsole) {
      this.outputToConsole(logEntry);
    }

    // Write to file if enabled
    if (this.config.enableFile) {
      this.writeToFile(logEntry);
    }
  }

  /**
   * Check if log level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };

    return levels[level] >= levels[this.config.level];
  }

  /**
   * Output log to console
   */
  private outputToConsole(log: OperationLog): void {
    if (this.config.enableStructured) {
      // Structured JSON output
      console.log(JSON.stringify(log, null, 2));
    } else {
      // Human-readable format
      const timestamp = new Date(log.timestamp).toLocaleTimeString();
      const level = log.level.toUpperCase().padEnd(5);
      const prefix = `[${timestamp}] ${level}`;
      
      if (log.error) {
        console.error(`${prefix} ${log.message}`);
        console.error(`         Error: ${log.error.message}`);
        if (log.error.recoveryActions.length > 0) {
          console.error(`         Recovery: ${log.error.recoveryActions.join(', ')}`);
        }
      } else {
        const method = log.level === 'error' ? console.error : 
                     log.level === 'warn' ? console.warn : console.log;
        method(`${prefix} ${log.message}`);
      }
    }
  }

  /**
   * Write log to file
   */
  private writeToFile(log: OperationLog): void {
    if (!this.config.filePath) return;

    try {
      const logLine = JSON.stringify(log) + '\n';
      fs.appendFileSync(this.config.filePath, logLine);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  /**
   * Ensure log directory exists
   */
  private ensureLogDirectory(): void {
    if (!this.config.filePath) return;

    const logDir = path.dirname(this.config.filePath);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  /**
   * Trim log buffer to prevent memory issues
   */
  private trimLogBuffer(): void {
    const maxBufferSize = 1000;
    if (this.logBuffer.length > maxBufferSize) {
      this.logBuffer = this.logBuffer.slice(-maxBufferSize);
    }
  }

  /**
   * Categorize error for better handling
   */
  private categorizeError(error: Error): ErrorCategory {
    const message = error.message.toLowerCase();
    const stack = error.stack?.toLowerCase() || '';

    if (message.includes('connection') || message.includes('timeout') || message.includes('network')) {
      return 'connection';
    }
    if (message.includes('terraform') || stack.includes('terraform')) {
      return 'terraform';
    }
    if (message.includes('ansible') || stack.includes('ansible')) {
      return 'ansible';
    }
    if (message.includes('proxmox') || message.includes('pve')) {
      return 'proxmox';
    }
    if (message.includes('workspace') || message.includes('config')) {
      return 'workspace';
    }
    if (message.includes('validation') || message.includes('invalid')) {
      return 'validation';
    }
    if (message.includes('permission') || message.includes('access')) {
      return 'system';
    }

    return 'system';
  }

  /**
   * Get recent logs for querying
   */
  getRecentLogs(limit: number = 100, level?: LogLevel, operation?: string): OperationLog[] {
    let logs = this.logBuffer.slice(-limit);

    if (level) {
      logs = logs.filter(log => log.level === level);
    }

    if (operation) {
      logs = logs.filter(log => log.operation.includes(operation));
    }

    return logs.reverse(); // Most recent first
  }

  /**
   * Get logs for a specific correlation ID
   */
  getLogsByCorrelationId(correlationId: string): OperationLog[] {
    return this.logBuffer.filter(log => log.correlationId === correlationId);
  }

  /**
   * Clear log buffer
   */
  clearBuffer(): void {
    this.logBuffer = [];
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
    if (config.filePath) {
      this.ensureLogDirectory();
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): LoggerConfig {
    return { ...this.config };
  }
}