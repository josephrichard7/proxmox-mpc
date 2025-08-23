/**
 * Logs Command
 * Query and display logs with filtering and search capabilities
 */

import { ConsoleSession } from '../repl';
import { Logger } from '../../observability/logger';
import { LogLevel } from '../../observability/types';

export class LogsCommand {
  async execute(args: string[], session: ConsoleSession): Promise<void> {
    const logger = Logger.getInstance();

    try {
      const options = this.parseArguments(args);
      
      // Only show header if not JSON mode
      if (!options.json) {
        console.log('📋 System Logs\\n');
      }

      // Get logs based on filters
      let logs = logger.getRecentLogs(options.limit);

      // Apply filters
      if (options.level) {
        logs = logs.filter(log => log.level === options.level);
      }

      if (options.operation) {
        logs = logs.filter(log => 
          log.operation.toLowerCase().includes(options.operation!.toLowerCase()) ||
          log.phase.toLowerCase().includes(options.operation!.toLowerCase())
        );
      }

      if (options.correlationId) {
        logs = logger.getLogsByCorrelationId(options.correlationId);
      }

      if (options.search) {
        logs = logs.filter(log =>
          log.message.toLowerCase().includes(options.search!.toLowerCase()) ||
          (log.error?.message || '').toLowerCase().includes(options.search!.toLowerCase())
        );
      }

      // Filter by time range
      if (options.since) {
        const sinceTime = new Date(Date.now() - options.since * 60 * 1000);
        logs = logs.filter(log => new Date(log.timestamp) > sinceTime);
      }

      // Display results
      if (logs.length === 0) {
        if (options.json) {
          console.log('[]');
        } else {
          console.log('📝 No logs found matching your criteria\\n');
          this.showUsageHelp();
        }
        return;
      }

      if (!options.json) {
        console.log(`📊 Found ${logs.length} log entries\\n`);
      }

      // Show summary if requested
      if (options.summary) {
        this.showLogSummary(logs);
        return;
      }

      // Display logs
      if (options.json) {
        console.log(JSON.stringify(logs, null, 2));
      } else {
        this.displayLogs(logs, options);
      }

      // Show usage tip (but not in JSON mode)
      if (!options.quiet && !options.json) {
        console.log('\\n💡 Use /logs --help for more filtering options');
      }

    } catch (error) {
      console.log(`❌ Failed to retrieve logs: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private parseArguments(args: string[]): {
    limit: number;
    level?: LogLevel;
    operation?: string;
    correlationId?: string;
    search?: string;
    since?: number;
    summary: boolean;
    json: boolean;
    quiet: boolean;
    help: boolean;
  } {
    const options = {
      limit: 50,
      summary: false,
      json: false,
      quiet: false,
      help: false
    } as any;

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      switch (arg) {
        case '--help':
        case '-h':
          options.help = true;
          break;
        case '--limit':
        case '-n':
          if (i + 1 < args.length) {
            options.limit = parseInt(args[i + 1]) || 50;
            i++;
          }
          break;
        case '--level':
        case '-l':
          if (i + 1 < args.length) {
            options.level = args[i + 1] as LogLevel;
            i++;
          }
          break;
        case '--operation':
        case '-o':
          if (i + 1 < args.length) {
            options.operation = args[i + 1];
            i++;
          }
          break;
        case '--correlation-id':
        case '-c':
          if (i + 1 < args.length) {
            options.correlationId = args[i + 1];
            i++;
          }
          break;
        case '--search':
        case '-s':
          if (i + 1 < args.length) {
            options.search = args[i + 1];
            i++;
          }
          break;
        case '--since':
          if (i + 1 < args.length) {
            options.since = parseInt(args[i + 1]) || 60;
            i++;
          }
          break;
        case '--summary':
          options.summary = true;
          break;
        case '--json':
        case '-j':
          options.json = true;
          break;
        case '--quiet':
        case '-q':
          options.quiet = true;
          break;
        default:
          // If it's a number, treat it as limit
          if (!isNaN(parseInt(arg))) {
            options.limit = parseInt(arg);
          }
      }
    }

    if (options.help) {
      this.showHelp();
      return options;
    }

    return options;
  }

  private displayLogs(logs: any[], options: any): void {
    logs.forEach((log, index) => {
      const timestamp = new Date(log.timestamp).toLocaleString();
      const levelEmoji = this.getLevelEmoji(log.level);
      const levelColor = this.getLevelColor(log.level);
      
      // Log header
      console.log(`${levelEmoji} [${timestamp}] ${log.correlationId.substring(0, 8)}`);
      console.log(`   Operation: ${log.operation}/${log.phase}`);
      console.log(`   Message: ${log.message}`);

      // Context information
      if (log.context) {
        if (log.context.workspace) {
          console.log(`   Workspace: ${log.context.workspace}`);
        }
        if (log.context.proxmoxServer) {
          console.log(`   Server: ${log.context.proxmoxServer}`);
        }
        if (log.context.resourcesAffected && log.context.resourcesAffected.length > 0) {
          console.log(`   Resources: ${log.context.resourcesAffected.join(', ')}`);
        }
        if (log.context.duration !== undefined) {
          console.log(`   Duration: ${log.context.duration}ms`);
        }
      }

      // Error information
      if (log.error) {
        console.log(`   ❌ Error: ${log.error.message}`);
        console.log(`   Type: ${log.error.type}`);
        if (log.error.code) {
          console.log(`   Code: ${log.error.code}`);
        }
        if (log.error.category) {
          console.log(`   Category: ${log.error.category}`);
        }
        if (log.error.recoveryActions && log.error.recoveryActions.length > 0) {
          console.log(`   💡 Recovery: ${log.error.recoveryActions.join(', ')}`);
        }
      }

      // Metadata
      if (log.metadata && Object.keys(log.metadata).length > 0) {
        console.log(`   📊 Metadata: ${JSON.stringify(log.metadata)}`);
      }

      // Separator between logs
      if (index < logs.length - 1) {
        console.log('   ' + '─'.repeat(60));
      }
      console.log('');
    });
  }

  private showLogSummary(logs: any[]): void {
    console.log('📊 Log Summary\\n');

    // Group by level
    const byLevel = logs.reduce((acc, log) => {
      acc[log.level] = (acc[log.level] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('📈 By Level:');
    Object.entries(byLevel).forEach(([level, count]) => {
      const emoji = this.getLevelEmoji(level as LogLevel);
      console.log(`   ${emoji} ${level.toUpperCase()}: ${count}`);
    });

    // Group by operation
    const byOperation = logs.reduce((acc, log) => {
      acc[log.operation] = (acc[log.operation] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('\\n🔧 By Operation:');
    Object.entries(byOperation)
      .sort(([,a], [,b]) => (b as number) - (a as number))
      .slice(0, 10)
      .forEach(([operation, count]) => {
        console.log(`   • ${operation}: ${count}`);
      });

    // Error summary
    const errors = logs.filter(log => log.error);
    if (errors.length > 0) {
      console.log('\\n❌ Error Summary:');
      const errorsByType = errors.reduce((acc, log) => {
        const type = log.error.category || log.error.type;
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      Object.entries(errorsByType).forEach(([type, count]) => {
        console.log(`   • ${type}: ${count}`);
      });
    }

    // Time range
    if (logs.length > 0) {
      const oldest = new Date(logs[logs.length - 1].timestamp);
      const newest = new Date(logs[0].timestamp);
      const duration = newest.getTime() - oldest.getTime();
      
      console.log('\\n⏰ Time Range:');
      console.log(`   From: ${oldest.toLocaleString()}`);
      console.log(`   To: ${newest.toLocaleString()}`);
      console.log(`   Duration: ${this.formatDuration(duration)}`);
    }

    // Performance insights
    const withDuration = logs.filter(log => log.context?.duration !== undefined);
    if (withDuration.length > 0) {
      const durations = withDuration.map(log => log.context.duration);
      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      const maxDuration = Math.max(...durations);
      const minDuration = Math.min(...durations);

      console.log('\\n⚡ Performance:');
      console.log(`   Average Duration: ${avgDuration.toFixed(2)}ms`);
      console.log(`   Max Duration: ${maxDuration}ms`);
      console.log(`   Min Duration: ${minDuration}ms`);
    }
  }

  private showHelp(): void {
    console.log('📋 Logs Command Help\\n');
    console.log('Usage: /logs [options]\\n');
    console.log('Options:');
    console.log('  -n, --limit <number>        Limit number of logs (default: 50)');
    console.log('  -l, --level <level>         Filter by log level (debug, info, warn, error)');
    console.log('  -o, --operation <name>      Filter by operation name');
    console.log('  -c, --correlation-id <id>   Show logs for specific correlation ID');
    console.log('  -s, --search <text>         Search in log messages');
    console.log('  --since <minutes>           Show logs from last N minutes');
    console.log('  --summary                   Show summary instead of detailed logs');
    console.log('  -j, --json                  Output in JSON format');
    console.log('  -q, --quiet                 Suppress usage tips');
    console.log('  -h, --help                  Show this help message\\n');
    console.log('Examples:');
    console.log('  /logs                       Show last 50 logs');
    console.log('  /logs 100                   Show last 100 logs');
    console.log('  /logs --level error         Show only error logs');
    console.log('  /logs --operation sync      Show logs from sync operations');
    console.log('  /logs --search "terraform"  Search for terraform in logs');
    console.log('  /logs --since 30            Show logs from last 30 minutes');
    console.log('  /logs --summary             Show log summary statistics');
  }

  private showUsageHelp(): void {
    console.log('💡 Log Query Tips:');
    console.log('   • Use --level to filter by severity (debug, info, warn, error)');
    console.log('   • Use --operation to find logs from specific operations');
    console.log('   • Use --search to find logs containing specific text');
    console.log('   • Use --correlation-id to trace a specific operation');
    console.log('   • Use --summary for quick overview');
    console.log('\\n📖 Examples:');
    console.log('   /logs --level error --since 60');
    console.log('   /logs --operation apply --limit 20');
    console.log('   /logs --search "connection failed"');
  }

  private getLevelEmoji(level: LogLevel): string {
    switch (level) {
      case 'debug': return '🐛';
      case 'info': return 'ℹ️';
      case 'warn': return '⚠️';
      case 'error': return '❌';
      default: return '📝';
    }
  }

  private getLevelColor(level: LogLevel): string {
    // For future use with colored output
    switch (level) {
      case 'debug': return 'gray';
      case 'info': return 'blue';
      case 'warn': return 'yellow';
      case 'error': return 'red';
      default: return 'white';
    }
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
    return `${(ms / 3600000).toFixed(1)}h`;
  }
}