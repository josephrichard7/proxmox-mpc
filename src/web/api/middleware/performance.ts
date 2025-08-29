/**
 * Performance Monitoring Middleware
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../../../observability/logger';

interface PerformanceMetrics {
  timestamp: number;
  method: string;
  url: string;
  duration: number;
  statusCode: number;
  contentLength?: number;
  userAgent?: string;
  ip: string;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private readonly maxMetrics = 1000;

  addMetric(metric: PerformanceMetrics) {
    this.metrics.push(metric);
    
    // Keep only recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    // Log slow requests
    if (metric.duration > 1000) { // > 1 second
      logger.warn('Slow API request detected', {
        url: metric.url,
        method: metric.method,
        duration: `${metric.duration}ms`,
        statusCode: metric.statusCode
      });
    }
  }

  getStats() {
    if (this.metrics.length === 0) {
      return null;
    }

    const durations = this.metrics.map(m => m.duration);
    const statusCodes = this.metrics.reduce((acc, m) => {
      acc[m.statusCode] = (acc[m.statusCode] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    return {
      totalRequests: this.metrics.length,
      averageDuration: durations.reduce((a, b) => a + b) / durations.length,
      medianDuration: this.calculateMedian(durations),
      p95Duration: this.calculatePercentile(durations, 95),
      p99Duration: this.calculatePercentile(durations, 99),
      statusCodes,
      slowRequests: this.metrics.filter(m => m.duration > 1000).length,
      errorRate: (statusCodes[500] || 0) / this.metrics.length * 100
    };
  }

  private calculateMedian(numbers: number[]): number {
    const sorted = numbers.sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 
      ? sorted[mid] 
      : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  private calculatePercentile(numbers: number[], percentile: number): number {
    const sorted = numbers.sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index];
  }

  getRecentMetrics(minutes = 5) {
    const cutoff = Date.now() - (minutes * 60 * 1000);
    return this.metrics.filter(m => m.timestamp > cutoff);
  }
}

const performanceMonitor = new PerformanceMonitor();

/**
 * Performance tracking middleware
 */
export function performanceMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = process.hrtime.bigint();
    const startTimestamp = Date.now();

    // Override res.end to capture metrics
    const originalEnd = res.end;
    res.end = function(chunk?: any) {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds

      const metric: PerformanceMetrics = {
        timestamp: startTimestamp,
        method: req.method,
        url: req.originalUrl,
        duration,
        statusCode: res.statusCode,
        contentLength: res.get('content-length') ? parseInt(res.get('content-length')!) : undefined,
        userAgent: req.get('user-agent'),
        ip: req.ip
      };

      performanceMonitor.addMetric(metric);

      // Add performance headers
      res.set({
        'X-Response-Time': `${duration.toFixed(2)}ms`,
        'X-Timestamp': startTimestamp.toString()
      });

      return originalEnd.call(this, chunk);
    };

    next();
  };
}

/**
 * Request timeout middleware
 */
export function timeoutMiddleware(timeoutMs = 30000) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Set timeout for the request
    req.setTimeout(timeoutMs, () => {
      if (!res.headersSent) {
        logger.error('Request timeout', {
          method: req.method,
          url: req.originalUrl,
          timeout: timeoutMs
        });
        
        res.status(408).json({
          success: false,
          error: 'Request timeout',
          message: `Request took longer than ${timeoutMs}ms`
        });
      }
    });

    next();
  };
}

/**
 * Memory usage monitoring
 */
export function memoryMonitoringMiddleware() {
  let requestCount = 0;
  
  return (req: Request, res: Response, next: NextFunction) => {
    requestCount++;

    // Check memory usage every 100 requests
    if (requestCount % 100 === 0) {
      const memUsage = process.memoryUsage();
      const memUsageMB = {
        rss: Math.round(memUsage.rss / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024)
      };

      // Log warning if memory usage is high
      if (memUsageMB.heapUsed > 512) { // > 512MB
        logger.warn('High memory usage detected', memUsageMB);
      }

      // Force garbage collection if available (only in development)
      if (process.env.NODE_ENV === 'development' && global.gc) {
        global.gc();
      }
    }

    next();
  };
}

/**
 * Health check with performance metrics
 */
export function healthCheckHandler(req: Request, res: Response) {
  const stats = performanceMonitor.getStats();
  const memUsage = process.memoryUsage();
  const uptime = process.uptime();

  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(uptime)}s`,
    memory: {
      rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      external: `${Math.round(memUsage.external / 1024 / 1024)}MB`
    },
    performance: stats ? {
      totalRequests: stats.totalRequests,
      averageResponseTime: `${stats.averageDuration.toFixed(2)}ms`,
      p95ResponseTime: `${stats.p95Duration.toFixed(2)}ms`,
      errorRate: `${stats.errorRate.toFixed(2)}%`,
      slowRequests: stats.slowRequests
    } : null
  });
}

/**
 * Performance stats endpoint
 */
export function performanceStatsHandler(req: Request, res: Response) {
  const minutes = parseInt(req.query.minutes as string) || 5;
  const recentMetrics = performanceMonitor.getRecentMetrics(minutes);
  const stats = performanceMonitor.getStats();

  res.json({
    timeframe: `${minutes} minutes`,
    metrics: stats,
    recentRequests: recentMetrics.length,
    data: req.query.detailed === 'true' ? recentMetrics : undefined
  });
}

export { performanceMonitor };