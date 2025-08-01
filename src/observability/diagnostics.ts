/**
 * Diagnostics System
 * Comprehensive diagnostic data collection and health monitoring
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { exec } from 'child_process';
import { promisify } from 'util';
import { DiagnosticSnapshot, HealthStatus, OperationLog } from './types';
import { Logger } from './logger';
import { MetricsCollector } from './metrics';
import { Tracer } from './tracer';

const execAsync = promisify(exec);

export class DiagnosticsCollector {
  private static instance: DiagnosticsCollector;
  private logger: Logger;
  private metrics: MetricsCollector;
  private tracer: Tracer;
  private healthChecks: HealthStatus[] = [];

  private constructor() {
    this.logger = Logger.getInstance();
    this.metrics = MetricsCollector.getInstance();
    this.tracer = Tracer.getInstance();
    this.setupHealthMonitoring();
  }

  static getInstance(): DiagnosticsCollector {
    if (!DiagnosticsCollector.instance) {
      DiagnosticsCollector.instance = new DiagnosticsCollector();
    }
    return DiagnosticsCollector.instance;
  }

  /**
   * Generate comprehensive diagnostic snapshot
   */
  async generateSnapshot(workspace?: string, operation?: string, error?: any): Promise<DiagnosticSnapshot> {
    const id = uuidv4();
    const timestamp = new Date().toISOString();

    this.logger.info('Generating diagnostic snapshot...', {
      workspace,
      resourcesAffected: []
    });

    const snapshot: DiagnosticSnapshot = {
      id,
      timestamp,
      workspace,
      operation,
      error: this.sanitizeError(error),
      logs: this.logger.getRecentLogs(500),
      metrics: this.metrics.getMetrics(undefined, 200),
      healthStatus: await this.performHealthChecks(),
      systemInfo: this.getSystemInfo(),
      workspaceInfo: workspace ? await this.getWorkspaceInfo(workspace) : undefined
    };

    // Save snapshot to file
    await this.saveSnapshot(snapshot);

    this.logger.info(`Diagnostic snapshot generated: ${id}`, {
      workspace,
      resourcesAffected: []
    }, {
      snapshotId: id,
      logsCount: snapshot.logs.length,
      metricsCount: snapshot.metrics.length,
      healthChecksCount: snapshot.healthStatus.length
    });

    return snapshot;
  }

  /**
   * Perform comprehensive health checks
   */
  async performHealthChecks(): Promise<HealthStatus[]> {
    const checks: HealthStatus[] = [];
    const timestamp = new Date().toISOString();

    try {
      // System health
      const systemHealth = await this.checkSystemHealth();
      checks.push({
        component: 'system',
        status: systemHealth.healthy ? 'healthy' : 'warning',
        message: systemHealth.message,
        details: systemHealth.details,
        timestamp
      });

      // Memory health
      const memoryHealth = this.checkMemoryHealth();
      checks.push({
        component: 'memory',
        status: memoryHealth.status,
        message: memoryHealth.message,
        details: memoryHealth.details,
        timestamp
      });

      // Tool availability
      const toolsHealth = await this.checkToolsAvailability();
      checks.forEach(toolHealth => checks.push({...toolHealth, timestamp}));

      // Database health (if available)
      const dbHealth = await this.checkDatabaseHealth();
      if (dbHealth) {
        checks.push({...dbHealth, timestamp});
      }

      // Workspace health (if in workspace)
      const workspaceHealth = await this.checkWorkspaceHealth();
      if (workspaceHealth) {
        checks.push({...workspaceHealth, timestamp});
      }

    } catch (error) {
      checks.push({
        component: 'health_check_system',
        status: 'error',
        message: `Health check system error: ${error instanceof Error ? error.message : String(error)}`,
        timestamp
      });
    }

    this.healthChecks = checks;
    return checks;
  }

  /**
   * Check system health
   */
  private async checkSystemHealth(): Promise<{healthy: boolean; message: string; details: any}> {
    const uptime = process.uptime();
    const loadAvg = os.loadavg();
    const cpuCount = os.cpus().length;

    const healthy = uptime > 0 && loadAvg[0] < cpuCount * 2;

    return {
      healthy,
      message: healthy ? 'System running normally' : 'System under high load',
      details: {
        uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
        loadAvg: loadAvg.map(l => l.toFixed(2)),
        cpuCount,
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version
      }
    };
  }

  /**
   * Check memory health
   */
  private checkMemoryHealth(): {status: HealthStatus['status']; message: string; details: any} {
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    
    const heapUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    const systemUsagePercent = ((totalMem - freeMem) / totalMem) * 100;

    let status: HealthStatus['status'] = 'healthy';
    let message = 'Memory usage normal';

    if (heapUsagePercent > 90 || systemUsagePercent > 90) {
      status = 'error';
      message = 'Critical memory usage';
    } else if (heapUsagePercent > 75 || systemUsagePercent > 75) {
      status = 'warning';
      message = 'High memory usage';
    }

    return {
      status,
      message,
      details: {
        heapUsed: this.formatBytes(memUsage.heapUsed),
        heapTotal: this.formatBytes(memUsage.heapTotal),
        heapUsagePercent: heapUsagePercent.toFixed(1) + '%',
        systemTotal: this.formatBytes(totalMem),
        systemFree: this.formatBytes(freeMem),
        systemUsagePercent: systemUsagePercent.toFixed(1) + '%'
      }
    };
  }

  /**
   * Check external tools availability
   */
  private async checkToolsAvailability(): Promise<HealthStatus[]> {
    const tools = ['terraform', 'ansible', 'node', 'npm', 'git'];
    const checks: HealthStatus[] = [];

    for (const tool of tools) {
      try {
        const startTime = Date.now();
        const { stdout } = await execAsync(`${tool} --version`);
        const responseTime = Date.now() - startTime;

        checks.push({
          component: `tool_${tool}`,
          status: 'healthy',
          message: `${tool} available`,
          details: {
            version: stdout.trim().split('\n')[0],
            responseTime: `${responseTime}ms`
          },
          timestamp: new Date().toISOString(),
          responseTime
        });
      } catch (error) {
        checks.push({
          component: `tool_${tool}`,
          status: 'error',
          message: `${tool} not available`,
          details: {
            error: error instanceof Error ? error.message : String(error)
          },
          timestamp: new Date().toISOString()
        });
      }
    }

    return checks;
  }

  /**
   * Check database health
   */
  private async checkDatabaseHealth(): Promise<HealthStatus | null> {
    try {
      // This would check database connectivity
      // For now, just check if database files exist
      const dbPath = path.join(process.cwd(), '.proxmox', 'database.db');
      const exists = fs.existsSync(dbPath);

      if (exists) {
        const stats = fs.statSync(dbPath);
        return {
          component: 'database',
          status: 'healthy',
          message: 'Database accessible',
          details: {
            path: dbPath,
            size: this.formatBytes(stats.size),
            modified: stats.mtime.toISOString()
          },
          timestamp: new Date().toISOString()
        };
      } else {
        return {
          component: 'database',
          status: 'warning',
          message: 'Database not initialized',
          details: {
            expectedPath: dbPath
          },
          timestamp: new Date().toISOString()
        };
      }
    } catch (error) {
      return {
        component: 'database',
        status: 'error',
        message: `Database check failed: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Check workspace health
   */
  private async checkWorkspaceHealth(): Promise<HealthStatus | null> {
    try {
      const workspacePath = process.cwd();
      const proxmoxDir = path.join(workspacePath, '.proxmox');

      if (!fs.existsSync(proxmoxDir)) {
        return null; // Not in a workspace
      }

      const configPath = path.join(proxmoxDir, 'config.yml');
      const terraformDir = path.join(workspacePath, 'terraform');
      const ansibleDir = path.join(workspacePath, 'ansible');

      const hasConfig = fs.existsSync(configPath);
      const hasTerraform = fs.existsSync(terraformDir);
      const hasAnsible = fs.existsSync(ansibleDir);

      let status: HealthStatus['status'] = 'healthy';
      let message = 'Workspace configured correctly';

      if (!hasConfig) {
        status = 'error';
        message = 'Workspace missing configuration';
      } else if (!hasTerraform || !hasAnsible) {
        status = 'warning';
        message = 'Workspace partially configured';
      }

      return {
        component: 'workspace',
        status,
        message,
        details: {
          path: workspacePath,
          hasConfig,
          hasTerraform,
          hasAnsible,
          configPath: hasConfig ? configPath : undefined
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        component: 'workspace',
        status: 'error',
        message: `Workspace check failed: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get system information
   */
  private getSystemInfo() {
    return {
      nodeVersion: process.version,
      platform: `${os.platform()} ${os.release()}`,
      memory: process.memoryUsage(),
      uptime: process.uptime()
    };
  }

  /**
   * Get workspace information
   */
  private async getWorkspaceInfo(workspace: string) {
    try {
      const configPath = path.join(workspace, '.proxmox', 'config.yml');
      let config = {};

      if (fs.existsSync(configPath)) {
        const configContent = fs.readFileSync(configPath, 'utf8');
        // Parse YAML (simplified - in real implementation use yaml parser)
        config = { raw: configContent };
      }

      // Get tool versions
      let terraformVersion: string | undefined;
      let ansibleVersion: string | undefined;

      try {
        const { stdout: tfOut } = await execAsync('terraform --version');
        terraformVersion = tfOut.split('\n')[0];
      } catch {}

      try {
        const { stdout: ansOut } = await execAsync('ansible --version');
        ansibleVersion = ansOut.split('\n')[0];
      } catch {}

      return {
        path: workspace,
        config: this.sanitizeConfig(config),
        terraformVersion,
        ansibleVersion
      };
    } catch (error) {
      return {
        path: workspace,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Save diagnostic snapshot to file
   */
  private async saveSnapshot(snapshot: DiagnosticSnapshot): Promise<void> {
    const diagnosticsDir = path.join(process.cwd(), '.proxmox', 'diagnostics');
    
    if (!fs.existsSync(diagnosticsDir)) {
      fs.mkdirSync(diagnosticsDir, { recursive: true });
    }

    const filename = `snapshot-${snapshot.id}.json`;
    const filepath = path.join(diagnosticsDir, filename);

    fs.writeFileSync(filepath, JSON.stringify(snapshot, null, 2));
  }

  /**
   * Setup continuous health monitoring
   */
  private setupHealthMonitoring(): void {
    // Run health checks every 5 minutes
    setInterval(async () => {
      await this.performHealthChecks();
    }, 5 * 60 * 1000);
  }

  /**
   * Get latest health status
   */
  getLatestHealthStatus(): HealthStatus[] {
    return this.healthChecks;
  }

  /**
   * Generate AI collaboration prompt
   */
  generateAIPrompt(snapshot: DiagnosticSnapshot, userDescription: string): string {
    const errorSummary = snapshot.error 
      ? `Error: ${snapshot.error.message || 'Unknown error'}`
      : 'No specific error reported';

    const recentLogs = snapshot.logs
      .filter(log => log.level === 'error' || log.level === 'warn')
      .slice(0, 5);

    const healthIssues = snapshot.healthStatus
      .filter(status => status.status !== 'healthy')
      .map(status => `${status.component}: ${status.message}`)
      .join(', ');

    return `I'm having issues with my proxmox-mpc setup. Here's my diagnostic report:

**User Description:** ${userDescription}

**Error Summary:** ${errorSummary}
**Last Successful Operation:** ${this.getLastSuccessfulOperation(snapshot.logs)}
**Health Issues:** ${healthIssues || 'None'}

**System Info:**
- Node.js: ${snapshot.systemInfo.nodeVersion}
- Platform: ${snapshot.systemInfo.platform}
- Memory Usage: ${this.formatBytes(snapshot.systemInfo.memory.heapUsed)} / ${this.formatBytes(snapshot.systemInfo.memory.heapTotal)}

**Workspace:** ${snapshot.workspace || 'Not in workspace'}
**Operation:** ${snapshot.operation || 'Unknown'}

**Recent Error Logs:**
${recentLogs.map(log => `- [${log.level.toUpperCase()}] ${log.message}`).join('\n')}

Please analyze the logs and suggest fixes. The full diagnostic snapshot is attached.`;
  }

  /**
   * Utility methods
   */
  private sanitizeError(error: any): any {
    if (!error) return undefined;

    return {
      message: error.message || String(error),
      stack: error.stack,
      code: error.code,
      type: error.constructor?.name || 'Error'
    };
  }

  private sanitizeConfig(config: any): any {
    // Remove sensitive information
    const sanitized = JSON.parse(JSON.stringify(config));
    
    if (sanitized.tokenSecret) sanitized.tokenSecret = '[REDACTED]';
    if (sanitized.password) sanitized.password = '[REDACTED]';
    if (sanitized.apiKey) sanitized.apiKey = '[REDACTED]';

    return sanitized;
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private getLastSuccessfulOperation(logs: OperationLog[]): string {
    const successLog = logs
      .filter(log => log.level === 'info' && log.message.includes('Completed'))
      .slice(-1)[0];
    
    return successLog ? successLog.operation : 'Unknown';
  }
}