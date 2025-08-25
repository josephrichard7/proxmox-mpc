/**
 * Debug Command
 * Control debug mode and verbose diagnostic output
 */

import { observability } from '../../observability';
import { errorHandler } from '../error-handler';
import { ConsoleSession } from '../repl';

export class DebugCommand {
  async execute(args: string[], session: ConsoleSession): Promise<void> {
    const logger = observability.logger;

    if (args.length === 0) {
      await this.showDebugStatus(session);
      return;
    }

    const command = args[0].toLowerCase();

    switch (command) {
      case 'on':
        await this.enableDebug(session);
        break;
      case 'off':
        await this.disableDebug(session);
        break;
      case 'status':
        await this.showDebugStatus(session);
        break;
      case 'logs':
        await this.showRecentLogs(args.slice(1), session);
        break;
      case 'metrics':
        await this.showMetrics(args.slice(1), session);
        break;
      case 'traces':
        await this.showTraces(args.slice(1), session);
        break;
      case 'clear':
        await this.clearDebugData(args.slice(1), session);
        break;
      default:
        errorHandler.handleError({
          code: 'UNKNOWN_DEBUG_COMMAND',
          message: `Unknown debug command: ${command}`,
          severity: 'low',
          context: {
            command: 'debug',
            suggestions: [
              'Use /help debug for available debug commands',
              'Available commands: on, off, status, logs, metrics, traces, clear'
            ]
          }
        });
    }
  }

  private async enableDebug(session: ConsoleSession): Promise<void> {
    const logger = observability.logger;
    
    logger.updateConfig({
      level: 'debug',
      enableConsole: true,
      enableStructured: false // Human-readable for debug mode
    });

    console.log('🐛 Debug mode enabled');
    console.log('   • Log level set to DEBUG');
    console.log('   • Verbose output enabled');
    console.log('   • Human-readable log format enabled');
    console.log('');
    console.log('💡 Available debug commands:');
    console.log('   /debug logs     - Show recent log entries');
    console.log('   /debug metrics  - Show performance metrics');
    console.log('   /debug traces   - Show operation traces');
    console.log('   /debug off      - Disable debug mode');

    logger.info('Debug mode enabled', {
      resourcesAffected: []
    });
  }

  private async disableDebug(session: ConsoleSession): Promise<void> {
    const logger = observability.logger;
    
    logger.updateConfig({
      level: 'info',
      enableStructured: true // Back to structured format
    });

    console.log('🔇 Debug mode disabled');
    console.log('   • Log level set to INFO');
    console.log('   • Verbose output disabled');
    console.log('   • Structured log format restored');

    logger.info('Debug mode disabled', {
      resourcesAffected: []
    });
  }

  private async showDebugStatus(session: ConsoleSession): Promise<void> {
    const logger = observability.logger;
    const metrics = observability.metrics;
    const tracer = observability.tracer;
    const config = logger.getConfig();

    console.log('🐛 Debug Status\\n');
    
    console.log('📊 Configuration:');
    console.log(`   • Log Level: ${config.level.toUpperCase()}`);
    console.log(`   • Console Output: ${config.enableConsole ? '✅' : '❌'}`);
    console.log(`   • File Logging: ${config.enableFile ? '✅' : '❌'}`);
    console.log(`   • Structured Format: ${config.enableStructured ? '✅' : '❌'}`);
    console.log(`   • Tracing: ${config.enableTracing ? '✅' : '❌'}`);
    
    if (config.enableFile && config.filePath) {
      console.log(`   • Log File: ${config.filePath}`);
    }

    console.log('\\n📈 Statistics:');
    const recentLogs = logger.getRecentLogs(100);
    const recentMetrics = metrics.getMetrics(undefined, 100);
    const activeSpans = tracer.getActiveSpans();
    const completedSpans = tracer.getCompletedSpans(50);

    console.log(`   • Recent Logs: ${recentLogs.length}`);
    console.log(`   • Recent Metrics: ${recentMetrics.length}`);
    console.log(`   • Active Traces: ${activeSpans.length}`);
    console.log(`   • Completed Traces: ${completedSpans.length}`);

    const logsByLevel = recentLogs.reduce((acc, log) => {
      acc[log.level] = (acc[log.level] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    if (Object.keys(logsByLevel).length > 0) {
      console.log('\\n📋 Log Distribution:');
      Object.entries(logsByLevel).forEach(([level, count]) => {
        const emoji = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : level === 'debug' ? '🐛' : 'ℹ️';
        console.log(`   • ${emoji} ${level.toUpperCase()}: ${count}`);
      });
    }

    console.log('\\n💡 Available Commands:');
    console.log('   /debug on               - Enable debug mode');
    console.log('   /debug off              - Disable debug mode');
    console.log('   /debug logs [count]     - Show recent logs');
    console.log('   /debug metrics [name]   - Show metrics');
    console.log('   /debug traces [limit]   - Show traces');
    console.log('   /debug clear [type]     - Clear debug data');
  }

  private async showRecentLogs(args: string[], session: ConsoleSession): Promise<void> {
    const logger = observability.logger;
    const limit = args.length > 0 ? parseInt(args[0]) || 20 : 20;
    const level = args.length > 1 ? args[1] as any : undefined;

    console.log(`\\n📋 Recent Logs (last ${limit})\\n`);

    const logs = logger.getRecentLogs(limit, level);

    if (logs.length === 0) {
      console.log('   No logs found matching criteria');
      return;
    }

    logs.forEach(log => {
      const timestamp = new Date(log.timestamp).toLocaleTimeString();
      const levelEmoji = log.level === 'error' ? '❌' : 
                        log.level === 'warn' ? '⚠️' : 
                        log.level === 'debug' ? '🐛' : 'ℹ️';
      
      console.log(`${levelEmoji} [${timestamp}] ${log.operation}/${log.phase}: ${log.message}`);
      
      if (log.error) {
        console.log(`   Error: ${log.error.message}`);
        if (log.error.recoveryActions.length > 0) {
          console.log(`   Recovery: ${log.error.recoveryActions.join(', ')}`);
        }
      }
      
      if (log.context.duration !== undefined) {
        console.log(`   Duration: ${log.context.duration}ms`);
      }
      
      if (log.metadata && Object.keys(log.metadata).length > 0) {
        console.log(`   Metadata: ${JSON.stringify(log.metadata, null, 2)}`);
      }
      
      console.log(''); // Empty line between logs
    });
  }

  private async showMetrics(args: string[], session: ConsoleSession): Promise<void> {
    const metrics = observability.metrics;
    const metricName = args.length > 0 ? args[0] : undefined;
    const limit = args.length > 1 ? parseInt(args[1]) || 20 : 20;

    console.log(`\\n📊 Performance Metrics\\n`);

    if (metricName) {
      console.log(`Showing metrics for: ${metricName}\\n`);
      const metricData = metrics.getMetrics(metricName, limit);
      
      if (metricData.length === 0) {
        console.log(`   No metrics found for '${metricName}'`);
        return;
      }

      metricData.forEach(metric => {
        const timestamp = new Date(metric.timestamp).toLocaleTimeString();
        console.log(`   [${timestamp}] ${metric.value} ${metric.unit}`);
        if (Object.keys(metric.tags).length > 0) {
          console.log(`     Tags: ${JSON.stringify(metric.tags)}`);
        }
      });
    } else {
      // Show summary
      const summary = metrics.getMetricsSummary();
      
      console.log('📈 Metrics Summary:');
      console.log(`   • Total Metrics: ${summary.totalMetrics}`);
      console.log(`   • Unique Operations: ${summary.uniqueOperations}`);
      console.log(`   • Avg Response Time: ${summary.avgResponseTime.toFixed(2)}ms`);
      console.log(`   • Error Rate: ${(summary.errorRate * 100).toFixed(1)}%`);
      console.log(`   • Current Memory: ${this.formatBytes(summary.memoryUsage.current)}`);
      console.log(`   • Peak Memory: ${this.formatBytes(summary.memoryUsage.peak)}`);

      console.log('\\n🏷️  Recent Metrics:');
      const recentMetrics = metrics.getMetrics(undefined, 10);
      recentMetrics.forEach(metric => {
        const timestamp = new Date(metric.timestamp).toLocaleTimeString();
        console.log(`   [${timestamp}] ${metric.name}: ${metric.value} ${metric.unit}`);
      });
    }

    console.log('\\n💡 Use: /debug metrics <name> [limit] to see specific metrics');
  }

  private async showTraces(args: string[], session: ConsoleSession): Promise<void> {
    const tracer = observability.tracer;
    const limit = args.length > 0 ? parseInt(args[0]) || 10 : 10;

    console.log(`\\n🔍 Operation Traces\\n`);

    const activeSpans = tracer.getActiveSpans();
    const completedSpans = tracer.getCompletedSpans(limit);

    if (activeSpans.length > 0) {
      console.log('🔄 Active Traces:');
      activeSpans.forEach(span => {
        const duration = Date.now() - span.startTime;
        console.log(`   • ${span.operation} (${duration}ms elapsed)`);
        console.log(`     Trace ID: ${span.traceId}`);
        console.log(`     Span ID: ${span.spanId}`);
      });
      console.log('');
    }

    if (completedSpans.length > 0) {
      console.log('✅ Recent Completed Traces:');
      completedSpans.forEach(span => {
        const statusEmoji = span.status === 'success' ? '✅' : '❌';
        const duration = span.duration || 0;
        console.log(`   ${statusEmoji} ${span.operation} (${duration}ms)`);
        console.log(`     Trace ID: ${span.traceId}`);
        if (span.tags.error) {
          console.log(`     Error: ${span.tags.error}`);
        }
      });
    }

    if (activeSpans.length === 0 && completedSpans.length === 0) {
      console.log('   No traces found');
    }

    console.log('\\n💡 Use: /debug traces <limit> to see more traces');
  }

  private async clearDebugData(args: string[], session: ConsoleSession): Promise<void> {
    const logger = observability.logger;
    const metrics = observability.metrics;
    const tracer = observability.tracer;
    
    const type = args.length > 0 ? args[0].toLowerCase() : 'all';

    switch (type) {
      case 'logs':
        logger.clearBuffer();
        console.log('🗑️  Log buffer cleared');
        break;
      case 'metrics':
        metrics.clearMetrics();
        console.log('🗑️  Metrics cleared');
        break;
      case 'traces':
        tracer.clearCompletedSpans();
        console.log('🗑️  Completed traces cleared');
        break;
      case 'all':
        logger.clearBuffer();
        metrics.clearMetrics();
        tracer.clearCompletedSpans();
        console.log('🗑️  All debug data cleared');
        break;
      default:
        console.log('❌ Unknown clear type. Use: logs, metrics, traces, or all');
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}