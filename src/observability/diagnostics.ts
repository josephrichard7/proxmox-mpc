/**
 * Diagnostics System
 * Simple diagnostic data collection and health monitoring
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { exec } from 'child_process';
import { promisify } from 'util';
import { DiagnosticSnapshot, HealthStatus } from './types';
import { Logger } from './logger';
import { MetricsCollector } from './metrics';
import { Tracer } from './tracer';

const execAsync = promisify(exec);

export class DiagnosticsCollector {
  private static instance: DiagnosticsCollector;
  private logger: Logger;
  private metrics: MetricsCollector;
  private tracer: Tracer;

  private constructor() {
    this.logger = Logger.getInstance();
    this.metrics = MetricsCollector.getInstance();
    this.tracer = Tracer.getInstance();
  }

  static getInstance(): DiagnosticsCollector {
    if (!DiagnosticsCollector.instance) {
      DiagnosticsCollector.instance = new DiagnosticsCollector();
    }
    return DiagnosticsCollector.instance;
  }

  /**
   * Generate diagnostic snapshot
   */
  async generateSnapshot(workspace?: string, operation?: string, error?: any): Promise<DiagnosticSnapshot> {
    const id = uuidv4();
    const timestamp = new Date().toISOString();

    const snapshot: DiagnosticSnapshot = {
      id,
      timestamp,
      workspace,
      operation,
      error: error ? { message: error.message || String(error), stack: error.stack, type: error.constructor?.name || 'Error' } : undefined,
      logs: this.logger.getRecentLogs(500),
      metrics: this.metrics.getMetrics(undefined, 200),
      healthStatus: await this.performHealthChecks(),
      systemInfo: {
        nodeVersion: process.version,
        platform: `${os.platform()} ${os.release()}`,
        memory: process.memoryUsage(),
        uptime: process.uptime()
      },
      workspaceInfo: workspace ? await this.getWorkspaceInfo(workspace) : undefined
    };

    // Save snapshot if in workspace
    if (workspace) {
      await this.saveSnapshot(snapshot);
    }

    return snapshot;
  }

  /**
   * Perform health checks
   */
  async performHealthChecks(): Promise<HealthStatus[]> {
    const checks: HealthStatus[] = [];
    const timestamp = new Date().toISOString();

    try {
      // System health
      const uptime = process.uptime();
      const loadAvg = os.loadavg();
      const cpuCount = os.cpus().length;
      const healthy = uptime > 0 && loadAvg[0] < cpuCount * 2;
      
      checks.push({
        component: 'system',
        status: healthy ? 'healthy' : 'warning',
        message: healthy ? 'System running normally' : 'System under high load',
        details: {
          uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
          loadAvg: loadAvg.map(l => l.toFixed(2)),
          cpuCount
        },
        timestamp
      });

      // Memory health
      const memUsage = process.memoryUsage();
      const heapUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
      let memStatus: HealthStatus['status'] = 'healthy';
      let memMessage = 'Memory usage normal';
      
      if (heapUsagePercent > 90) {
        memStatus = 'error';
        memMessage = 'Critical memory usage';
      } else if (heapUsagePercent > 75) {
        memStatus = 'warning';
        memMessage = 'High memory usage';
      }

      checks.push({
        component: 'memory',
        status: memStatus,
        message: memMessage,
        details: {
          heapUsed: this.formatBytes(memUsage.heapUsed),
          heapTotal: this.formatBytes(memUsage.heapTotal),
          heapUsagePercent: heapUsagePercent.toFixed(1) + '%'
        },
        timestamp
      });

      // Tool availability
      const tools = ['terraform', 'ansible', 'node', 'npm', 'git'];
      for (const tool of tools) {
        try {
          const { stdout } = await execAsync(`${tool} --version`);
          checks.push({
            component: `tool_${tool}`,
            status: 'healthy',
            message: `${tool} available`,
            details: { version: stdout.trim().split('\n')[0] },
            timestamp
          });
        } catch {
          checks.push({
            component: `tool_${tool}`,
            status: 'error',
            message: `${tool} not available`,
            timestamp
          });
        }
      }

      // Database check
      const dbPath = path.join(process.cwd(), '.proxmox', 'database.db');
      if (fs.existsSync(dbPath)) {
        const stats = fs.statSync(dbPath);
        checks.push({
          component: 'database',
          status: 'healthy',
          message: 'Database accessible',
          details: {
            size: this.formatBytes(stats.size),
            modified: stats.mtime.toISOString()
          },
          timestamp
        });
      } else {
        checks.push({
          component: 'database',
          status: 'warning',
          message: 'Database not initialized',
          timestamp
        });
      }

      // Workspace check
      const proxmoxDir = path.join(process.cwd(), '.proxmox');
      if (fs.existsSync(proxmoxDir)) {
        const configPath = path.join(proxmoxDir, 'config.yml');
        const hasConfig = fs.existsSync(configPath);
        const hasTerraform = fs.existsSync(path.join(process.cwd(), 'terraform'));
        const hasAnsible = fs.existsSync(path.join(process.cwd(), 'ansible'));

        let status: HealthStatus['status'] = 'healthy';
        let message = 'Workspace configured correctly';
        
        if (!hasConfig) {
          status = 'error';
          message = 'Workspace missing configuration';
        } else if (!hasTerraform || !hasAnsible) {
          status = 'warning';
          message = 'Workspace partially configured';
        }

        checks.push({
          component: 'workspace',
          status,
          message,
          details: { hasConfig, hasTerraform, hasAnsible },
          timestamp
        });
      }

    } catch (error) {
      checks.push({
        component: 'health_check_system',
        status: 'error',
        message: `Health check error: ${error instanceof Error ? error.message : String(error)}`,
        timestamp
      });
    }

    return checks;
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
        config = { raw: configContent };
      }

      // Get tool versions
      let terraformVersion: string | undefined;
      let ansibleVersion: string | undefined;

      try {
        const { stdout: tfOut } = await execAsync('terraform --version');
        terraformVersion = tfOut.split('\n')[0];
      } catch {
        // Tool not available
      }

      try {
        const { stdout: ansOut } = await execAsync('ansible --version');
        ansibleVersion = ansOut.split('\n')[0];
      } catch {
        // Tool not available
      }

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
    try {
      const diagnosticsDir = path.join(process.cwd(), '.proxmox', 'diagnostics');
      
      if (!fs.existsSync(diagnosticsDir)) {
        fs.mkdirSync(diagnosticsDir, { recursive: true });
      }

      const filename = `snapshot-${snapshot.id}.json`;
      const filepath = path.join(diagnosticsDir, filename);

      fs.writeFileSync(filepath, JSON.stringify(snapshot, null, 2));
    } catch {
      // Ignore file save errors - diagnostics should not fail operations
    }
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

    const lastSuccess = snapshot.logs
      .filter(log => log.level === 'info' && log.message.includes('Completed'))
      .slice(-1)[0];

    return `I'm having issues with my proxmox-mpc setup. Here's my diagnostic report:

**User Description:** ${userDescription}

**Error Summary:** ${errorSummary}
**Last Successful Operation:** ${lastSuccess ? lastSuccess.operation : 'Unknown'}
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
  private sanitizeConfig(config: any): any {
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
}