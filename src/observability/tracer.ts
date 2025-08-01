/**
 * Operation Tracer
 * Detailed execution traces for all operations with correlation
 */

import { v4 as uuidv4 } from 'uuid';
import { TraceSpan, OperationLog } from './types';
import { Logger } from './logger';

export class Tracer {
  private static instance: Tracer;
  private activeSpans = new Map<string, TraceSpan>();
  private completedSpans: TraceSpan[] = [];
  private logger: Logger;

  private constructor() {
    this.logger = Logger.getInstance();
  }

  static getInstance(): Tracer {
    if (!Tracer.instance) {
      Tracer.instance = new Tracer();
    }
    return Tracer.instance;
  }

  /**
   * Start a new trace
   */
  startTrace(operation: string, tags: Record<string, string> = {}): string {
    const traceId = uuidv4();
    const spanId = uuidv4();

    const span: TraceSpan = {
      traceId,
      spanId,
      operation,
      startTime: Date.now(),
      status: 'pending',
      tags: {
        ...tags,
        operation
      },
      logs: []
    };

    this.activeSpans.set(spanId, span);
    this.logger.setTraceContext(traceId, spanId);

    this.logger.debug(`Trace started: ${operation}`, {
      resourcesAffected: []
    }, {
      traceId,
      spanId,
      operation,
      phase: 'trace-start'
    });

    return spanId;
  }

  /**
   * Start a child span
   */
  startSpan(operation: string, parentSpanId: string, tags: Record<string, string> = {}): string {
    const parentSpan = this.activeSpans.get(parentSpanId);
    if (!parentSpan) {
      throw new Error(`Parent span ${parentSpanId} not found`);
    }

    const spanId = uuidv4();
    const span: TraceSpan = {
      traceId: parentSpan.traceId,
      spanId,
      parentSpanId,
      operation,
      startTime: Date.now(),
      status: 'pending',
      tags: {
        ...tags,
        operation,
        parent: parentSpan.operation
      },
      logs: []
    };

    this.activeSpans.set(spanId, span);
    this.logger.setTraceContext(parentSpan.traceId, spanId);

    this.logger.debug(`Span started: ${operation}`, {
      resourcesAffected: []
    }, {
      traceId: parentSpan.traceId,
      spanId,
      parentSpanId,
      operation,
      phase: 'span-start'
    });

    return spanId;
  }

  /**
   * Add log to current span
   */
  addLog(spanId: string, log: OperationLog): void {
    const span = this.activeSpans.get(spanId);
    if (span) {
      span.logs.push(log);
    }
  }

  /**
   * Add tags to span
   */
  addTags(spanId: string, tags: Record<string, string>): void {
    const span = this.activeSpans.get(spanId);
    if (span) {
      span.tags = { ...span.tags, ...tags };
    }
  }

  /**
   * Finish span successfully
   */
  finishSpan(spanId: string, tags: Record<string, string> = {}): void {
    const span = this.activeSpans.get(spanId);
    if (!span) {
      this.logger.warn(`Attempted to finish non-existent span: ${spanId}`);
      return;
    }

    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;
    span.status = 'success';
    span.tags = { ...span.tags, ...tags };

    this.activeSpans.delete(spanId);
    this.completedSpans.push(span);
    this.trimCompletedSpans();

    this.logger.debug(`Span completed: ${span.operation}`, {
      resourcesAffected: [],
      duration: span.duration
    }, {
      traceId: span.traceId,
      spanId,
      operation: span.operation,
      phase: 'span-complete',
      duration: span.duration
    });

    // Clear trace context if this was the root span
    if (!span.parentSpanId) {
      this.logger.clearTraceContext();
    }
  }

  /**
   * Finish span with error
   */
  finishSpanWithError(spanId: string, error: Error, tags: Record<string, string> = {}): void {
    const span = this.activeSpans.get(spanId);
    if (!span) {
      this.logger.warn(`Attempted to finish non-existent span: ${spanId}`);
      return;
    }

    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;
    span.status = 'error';
    span.tags = { 
      ...span.tags, 
      ...tags,
      error: error.message,
      errorType: error.constructor.name
    };

    this.activeSpans.delete(spanId);
    this.completedSpans.push(span);
    this.trimCompletedSpans();

    this.logger.error(`Span failed: ${span.operation}`, error, {
      resourcesAffected: [],
      duration: span.duration
    }, [
      'Check the error details above',
      'Review the operation logs for more context',
      'Use /logs command to query related logs'
    ]);

    // Clear trace context if this was the root span
    if (!span.parentSpanId) {
      this.logger.clearTraceContext();
    }
  }

  /**
   * Get active spans
   */
  getActiveSpans(): TraceSpan[] {
    return Array.from(this.activeSpans.values());
  }

  /**
   * Get completed spans
   */
  getCompletedSpans(limit: number = 50): TraceSpan[] {
    return this.completedSpans.slice(-limit).reverse(); // Most recent first
  }

  /**
   * Get trace by ID
   */
  getTrace(traceId: string): TraceSpan[] {
    const spans = [
      ...Array.from(this.activeSpans.values()),
      ...this.completedSpans
    ].filter(span => span.traceId === traceId);

    // Sort by start time to show execution order
    return spans.sort((a, b) => a.startTime - b.startTime);
  }

  /**
   * Get span by ID
   */
  getSpan(spanId: string): TraceSpan | undefined {
    return this.activeSpans.get(spanId) || 
           this.completedSpans.find(span => span.spanId === spanId);
  }

  /**
   * Check if span is active
   */
  isSpanActive(spanId: string): boolean {
    return this.activeSpans.has(spanId);
  }

  /**
   * Abort span (for cleanup)
   */
  abortSpan(spanId: string): void {
    const span = this.activeSpans.get(spanId);
    if (span) {
      span.endTime = Date.now();
      span.duration = span.endTime - span.startTime;
      span.status = 'error';
      span.tags.aborted = 'true';

      this.activeSpans.delete(spanId);
      this.completedSpans.push(span);

      this.logger.warn(`Span aborted: ${span.operation}`, {
        resourcesAffected: [],
        duration: span.duration
      });
    }
  }

  /**
   * Abort all active spans (for cleanup)
   */
  abortAllSpans(): void {
    const activeSpanIds = Array.from(this.activeSpans.keys());
    activeSpanIds.forEach(spanId => this.abortSpan(spanId));
  }

  /**
   * Trim completed spans to prevent memory issues
   */
  private trimCompletedSpans(): void {
    const maxSpans = 500;
    if (this.completedSpans.length > maxSpans) {
      this.completedSpans = this.completedSpans.slice(-maxSpans);
    }
  }

  /**
   * Clear all completed spans
   */
  clearCompletedSpans(): void {
    this.completedSpans = [];
  }

  /**
   * Get trace summary
   */
  getTraceSummary(traceId: string): {
    traceId: string;
    totalDuration: number;
    spanCount: number;
    successCount: number;
    errorCount: number;
    operation: string;
    status: 'success' | 'error' | 'pending';
  } | undefined {
    const spans = this.getTrace(traceId);
    if (spans.length === 0) {
      return undefined;
    }

    const rootSpan = spans.find(span => !span.parentSpanId);
    const successCount = spans.filter(span => span.status === 'success').length;
    const errorCount = spans.filter(span => span.status === 'error').length;
    const pendingCount = spans.filter(span => span.status === 'pending').length;

    const totalDuration = rootSpan?.duration || 
      (spans.length > 0 ? Math.max(...spans.map(s => s.endTime || s.startTime)) - Math.min(...spans.map(s => s.startTime)) : 0);

    return {
      traceId,
      totalDuration,
      spanCount: spans.length,
      successCount,
      errorCount,
      operation: rootSpan?.operation || 'unknown',
      status: errorCount > 0 ? 'error' : pendingCount > 0 ? 'pending' : 'success'
    };
  }
}

/**
 * Trace decorator for automatic span management
 */
export function trace(operation?: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const tracer = Tracer.getInstance();
      const opName = operation || `${target.constructor.name}.${propertyName}`;
      const spanId = tracer.startTrace(opName, {
        class: target.constructor.name,
        method: propertyName
      });

      try {
        const result = await method.apply(this, args);
        tracer.finishSpan(spanId);
        return result;
      } catch (error) {
        tracer.finishSpanWithError(spanId, error as Error);
        throw error;
      }
    };

    return descriptor;
  };
}