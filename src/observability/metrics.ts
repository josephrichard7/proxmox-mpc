/**
 * Performance Metrics
 * Timing and resource usage tracking for all operations
 */

import { PerformanceMetric } from './types';
import { Logger } from './logger';

export class MetricsCollector {
  private static instance: MetricsCollector;
  private metrics: PerformanceMetric[] = [];
  private timers = new Map<string, { startTime: bigint; tags: Record<string, string> }>();
  private logger: Logger;

  private constructor() {
    this.logger = Logger.getInstance();
    this.setupSystemMetrics();
  }

  static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector();
    }
    return MetricsCollector.instance;
  }

  /**
   * Record a metric
   */
  record(name: string, value: number, unit: string, tags: Record<string, string> = {}, operation?: string): void {
    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: new Date().toISOString(),
      tags: {
        ...tags,
        host: require('os').hostname()
      },
      operation
    };

    this.metrics.push(metric);
    this.trimMetrics();

    this.logger.debug(`Metric recorded: ${name} = ${value} ${unit}`, {
      resourcesAffected: []
    }, {
      metricName: name,
      metricValue: value,
      metricUnit: unit,
      metricTags: tags
    });
  }

  /**
   * Start a timer
   */
  startTimer(name: string, tags: Record<string, string> = {}): void {
    this.timers.set(name, {
      startTime: process.hrtime.bigint(),
      tags
    });
  }

  /**
   * End a timer and record the duration
   */
  endTimer(name: string, additionalTags: Record<string, string> = {}): number {
    const timer = this.timers.get(name);
    if (!timer) {
      this.logger.warn(`Timer '${name}' not found`);
      return 0;
    }

    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - timer.startTime) / 1_000_000; // Convert to milliseconds

    this.record(name, duration, 'ms', {
      ...timer.tags,
      ...additionalTags
    });

    this.timers.delete(name);
    return duration;
  }

  /**
   * Record operation duration
   */
  recordDuration(operation: string, duration: number, tags: Record<string, string> = {}): void {
    this.record(`operation.duration`, duration, 'ms', {
      operation,
      ...tags
    }, operation);
  }

  /**
   * Record memory usage
   */
  recordMemoryUsage(operation?: string): void {
    const memUsage = process.memoryUsage();
    const timestamp = new Date().toISOString();

    this.record('memory.rss', memUsage.rss, 'bytes', { type: 'rss' }, operation);
    this.record('memory.heapUsed', memUsage.heapUsed, 'bytes', { type: 'heapUsed' }, operation);
    this.record('memory.heapTotal', memUsage.heapTotal, 'bytes', { type: 'heapTotal' }, operation);
    this.record('memory.external', memUsage.external, 'bytes', { type: 'external' }, operation);
  }

  /**
   * Record CPU usage (requires additional calculation)
   */
  private startCpuUsage = process.cpuUsage();
  recordCpuUsage(operation?: string): void {
    const cpuUsage = process.cpuUsage(this.startCpuUsage);
    
    this.record('cpu.user', cpuUsage.user, 'microseconds', { type: 'user' }, operation);
    this.record('cpu.system', cpuUsage.system, 'microseconds', { type: 'system' }, operation);
    
    this.startCpuUsage = process.cpuUsage();
  }

  /**
   * Record API response time
   */
  recordApiResponseTime(endpoint: string, method: string, statusCode: number, duration: number): void {
    this.record('api.response_time', duration, 'ms', {
      endpoint,
      method,
      status_code: statusCode.toString()
    });
  }

  /**
   * Record database query time
   */
  recordDbQueryTime(query: string, duration: number, rowCount?: number): void {
    this.record('db.query_time', duration, 'ms', {
      query_type: this.extractQueryType(query),
      ...(rowCount !== undefined && { row_count: rowCount.toString() })
    });
  }

  /**
   * Record Terraform operation metrics
   */
  recordTerraformMetrics(operation: 'plan' | 'apply' | 'destroy', duration: number, resourceCount: number, success: boolean): void {
    this.record('terraform.operation_duration', duration, 'ms', {
      operation,
      success: success.toString()
    });

    this.record('terraform.resource_count', resourceCount, 'count', {
      operation
    });
  }

  /**
   * Record Ansible operation metrics
   */
  recordAnsibleMetrics(operation: string, duration: number, hostCount: number, taskCount: number, success: boolean): void {
    this.record('ansible.operation_duration', duration, 'ms', {
      operation,
      success: success.toString()
    });

    this.record('ansible.host_count', hostCount, 'count', { operation });
    this.record('ansible.task_count', taskCount, 'count', { operation });
  }

  /**
   * Record Proxmox API metrics
   */
  recordProxmoxMetrics(endpoint: string, method: string, duration: number, success: boolean): void {
    this.record('proxmox.api_call_duration', duration, 'ms', {
      endpoint,
      method,
      success: success.toString()
    });
  }

  /**
   * Get metrics by name
   */
  getMetrics(name?: string, limit: number = 100): PerformanceMetric[] {
    let filtered = this.metrics;

    if (name) {
      filtered = filtered.filter(metric => metric.name === name);
    }

    return filtered.slice(-limit).reverse(); // Most recent first
  }

  /**
   * Get metrics by operation
   */
  getMetricsByOperation(operation: string, limit: number = 100): PerformanceMetric[] {
    return this.metrics
      .filter(metric => metric.operation === operation)
      .slice(-limit)
      .reverse();
  }

  /**
   * Get metrics summary
   */
  getMetricsSummary(timeWindow: number = 3600000): { // 1 hour default
    totalMetrics: number;
    uniqueOperations: number;
    avgResponseTime: number;
    errorRate: number;
    memoryUsage: { current: number; peak: number };
  } {
    const cutoff = Date.now() - timeWindow;
    const recentMetrics = this.metrics.filter(
      metric => new Date(metric.timestamp).getTime() > cutoff
    );

    const operations = new Set(recentMetrics.map(m => m.operation).filter(Boolean));
    const responseTimes = recentMetrics
      .filter(m => m.name.includes('duration') || m.name.includes('response_time'))
      .map(m => m.value);
    
    const avgResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
      : 0;

    const errorMetrics = recentMetrics.filter(m => 
      m.tags.success === 'false' || m.name.includes('error')
    );
    const errorRate = recentMetrics.length > 0 
      ? errorMetrics.length / recentMetrics.length 
      : 0;

    const memoryMetrics = recentMetrics.filter(m => m.name.startsWith('memory.heapUsed'));
    const currentMemory = memoryMetrics.length > 0 ? memoryMetrics[memoryMetrics.length - 1].value : 0;
    const peakMemory = memoryMetrics.length > 0 ? Math.max(...memoryMetrics.map(m => m.value)) : 0;

    return {
      totalMetrics: recentMetrics.length,
      uniqueOperations: operations.size,
      avgResponseTime,
      errorRate,
      memoryUsage: {
        current: currentMemory,
        peak: peakMemory
      }
    };
  }

  /**
   * Clear metrics
   */
  clearMetrics(): void {
    this.metrics = [];
  }

  /**
   * Trim metrics to prevent memory issues
   */
  private trimMetrics(): void {
    const maxMetrics = 5000;
    if (this.metrics.length > maxMetrics) {
      this.metrics = this.metrics.slice(-maxMetrics);
    }
  }

  /**
   * Extract query type from SQL
   */
  private extractQueryType(query: string): string {
    const normalized = query.trim().toLowerCase();
    if (normalized.startsWith('select')) return 'select';
    if (normalized.startsWith('insert')) return 'insert';
    if (normalized.startsWith('update')) return 'update';
    if (normalized.startsWith('delete')) return 'delete';
    if (normalized.startsWith('create')) return 'create';
    if (normalized.startsWith('drop')) return 'drop';
    return 'other';
  }

  /**
   * Setup system metrics collection
   */
  private setupSystemMetrics(): void {
    // Collect system metrics every 30 seconds
    setInterval(() => {
      this.recordMemoryUsage('system');
      this.recordCpuUsage('system');
      
      // Record uptime
      this.record('system.uptime', process.uptime(), 'seconds', { type: 'process' });
    }, 30000);
  }
}

/**
 * Metrics decorator for automatic duration tracking
 */
export function metrics(metricName?: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const collector = MetricsCollector.getInstance();
      const name = metricName || `${target.constructor.name}.${propertyName}`;
      
      collector.startTimer(name, {
        class: target.constructor.name,
        method: propertyName
      });

      try {
        const result = await method.apply(this, args);
        collector.endTimer(name, { success: 'true' });
        return result;
      } catch (error) {
        collector.endTimer(name, { success: 'false' });
        throw error;
      }
    };

    return descriptor;
  };
}