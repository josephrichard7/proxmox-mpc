/**
 * Health Command
 * Display comprehensive system health and status information
 */

import { ConsoleSession } from '../repl';
import { DiagnosticsCollector } from '../../observability/diagnostics';
import { Logger } from '../../observability/logger';
import { MetricsCollector } from '../../observability/metrics';

export class HealthCommand {
  async execute(args: string[], session: ConsoleSession): Promise<void> {
    const diagnostics = DiagnosticsCollector.getInstance();
    const logger = Logger.getInstance();
    const metrics = MetricsCollector.getInstance();

    console.log('🏥 System Health Check\\n');

    try {
      // Parse arguments
      const options = this.parseArguments(args);

      // Perform health checks
      console.log('🔍 Running health checks...');
      const healthStatus = await diagnostics.performHealthChecks();

      // Overall status
      const overallStatus = this.calculateOverallStatus(healthStatus);
      const statusEmoji = overallStatus === 'healthy' ? '🟢' : 
                         overallStatus === 'warning' ? '🟡' : '🔴';
      
      console.log(`\\n${statusEmoji} System Health: ${this.formatStatus(overallStatus)}\\n`);

      // Connection Status
      await this.showConnectionStatus(healthStatus, session);

      // Tool Availability
      await this.showToolAvailability(healthStatus);

      // Resource Status
      if (session.client) {
        await this.showResourceStatus(session);
      }

      // Performance Metrics
      if (options.metrics) {
        await this.showPerformanceMetrics(metrics);
      }

      // Detailed health information
      if (options.detailed) {
        await this.showDetailedHealth(healthStatus);
      }

      // Workspace status
      if (session.workspace) {
        await this.showWorkspaceStatus(healthStatus, session);
      }

      // Recommendations
      await this.showRecommendations(healthStatus, session);

    } catch (error) {
      logger.error('Health check failed', error as Error, {
        resourcesAffected: []
      });
      console.log('❌ Health check failed:', error instanceof Error ? error.message : String(error));
    }
  }

  private parseArguments(args: string[]): {
    detailed: boolean;
    metrics: boolean;
    json: boolean;
  } {
    const options = {
      detailed: false,
      metrics: false,
      json: false
    };

    for (const arg of args) {
      switch (arg) {
        case '--detailed':
        case '-d':
          options.detailed = true;
          break;
        case '--metrics':
        case '-m':
          options.metrics = true;
          break;
        case '--json':
        case '-j':
          options.json = true;
          break;
      }
    }

    return options;
  }

  private calculateOverallStatus(healthStatus: any[]): 'healthy' | 'warning' | 'error' {
    const hasError = healthStatus.some(status => status.status === 'error');
    const hasWarning = healthStatus.some(status => status.status === 'warning');

    if (hasError) return 'error';
    if (hasWarning) return 'warning';
    return 'healthy';
  }

  private formatStatus(status: string): string {
    switch (status) {
      case 'healthy': return 'All Systems Operational';
      case 'warning': return 'Some Issues Detected';
      case 'error': return 'Critical Issues Found';
      default: return 'Unknown Status';
    }
  }

  private async showConnectionStatus(healthStatus: any[], session: ConsoleSession): Promise<void> {
    console.log('🔗 Connectivity Status:');

    // Database connection
    const dbHealth = healthStatus.find(h => h.component === 'database');
    if (dbHealth) {
      const dbEmoji = dbHealth.status === 'healthy' ? '✅' : 
                     dbHealth.status === 'warning' ? '⚠️' : '❌';
      console.log(`  ${dbEmoji} Database Connection - ${dbHealth.message}`);
    }

    // Proxmox server connection
    if (session.client && session.workspace) {
      try {
        const startTime = Date.now();
        await session.client.getNodes();
        const responseTime = Date.now() - startTime;
        
        console.log(`  ✅ Proxmox Server (${session.workspace.config.host}:${session.workspace.config.port}) - Response: ${responseTime}ms`);
      } catch (error) {
        console.log(`  ❌ Proxmox Server (${session.workspace.config.host}:${session.workspace.config.port}) - Connection failed`);
        console.log(`     Error: ${error instanceof Error ? error.message : String(error)}`);
      }
    } else if (session.workspace) {
      console.log(`  ⚠️  Proxmox Server - Not connected (use /status to connect)`);
    } else {
      console.log(`  ⚠️  Proxmox Server - No workspace configured`);
    }

    // Workspace access
    const workspaceHealth = healthStatus.find(h => h.component === 'workspace');
    if (workspaceHealth) {
      const wsEmoji = workspaceHealth.status === 'healthy' ? '✅' : 
                     workspaceHealth.status === 'warning' ? '⚠️' : '❌';
      console.log(`  ${wsEmoji} Workspace Access - ${workspaceHealth.message}`);
    } else {
      console.log(`  ⚠️  Workspace Access - Not in a workspace`);
    }

    console.log('');
  }

  private async showToolAvailability(healthStatus: any[]): Promise<void> {
    console.log('🛠️  Tool Availability:');

    const tools = ['terraform', 'ansible', 'node', 'npm', 'git'];
    
    for (const tool of tools) {
      const toolHealth = healthStatus.find(h => h.component === `tool_${tool}`);
      
      if (toolHealth) {
        const toolEmoji = toolHealth.status === 'healthy' ? '✅' : '❌';
        const version = toolHealth.details?.version || 'unknown';
        console.log(`  ${toolEmoji} ${tool.charAt(0).toUpperCase() + tool.slice(1)} ${version} - ${toolHealth.message}`);
      } else {
        console.log(`  ❓ ${tool.charAt(0).toUpperCase() + tool.slice(1)} - Status unknown`);
      }
    }

    console.log('');
  }

  private async showResourceStatus(session: ConsoleSession): Promise<void> {
    console.log('📊 Resource Status:');

    try {
      if (!session.client) {
        console.log('  ⚠️  No client connection available');
        return;
      }

      const nodes = await session.client.getNodes();
      let totalVMs = 0;
      let runningVMs = 0;
      let totalContainers = 0;
      let runningContainers = 0;

      for (const node of nodes) {
        try {
          const vms = await session.client.getVMs(node.node);
          const containers = await session.client.getContainers(node.node);

          totalVMs += vms.length;
          runningVMs += vms.filter(vm => vm.status === 'running').length;
          
          totalContainers += containers.length;
          runningContainers += containers.filter(ct => ct.status === 'running').length;
        } catch (error) {
          console.log(`  ⚠️  Failed to get resources for node ${node.node}`);
        }
      }

      console.log(`  ✅ VMs: ${runningVMs} running, ${totalVMs - runningVMs} stopped`);
      console.log(`  ✅ Containers: ${runningContainers} running, ${totalContainers - runningContainers} stopped`);

      // Storage status (simplified)
      for (const node of nodes.slice(0, 2)) { // Limit to first 2 nodes to avoid spam
        try {
          const storages = await session.client.getNodeStorage(node.node);
          for (const storage of storages.slice(0, 2)) { // Limit storages too
            const usedPercent = storage.used && storage.total ? 
              ((storage.used / storage.total) * 100).toFixed(0) : '0';
            const statusEmoji = parseInt(usedPercent) > 90 ? '🔴' : 
                               parseInt(usedPercent) > 75 ? '⚠️' : '✅';
            console.log(`  ${statusEmoji} Storage (${storage.storage}): ${usedPercent}% utilized`);
          }
        } catch (error) {
          // Skip storage info if unavailable
        }
      }

    } catch (error) {
      console.log(`  ❌ Failed to retrieve resource status: ${error instanceof Error ? error.message : String(error)}`);
    }

    console.log('');
  }

  private async showPerformanceMetrics(metrics: MetricsCollector): Promise<void> {
    console.log('⚡ Performance Metrics:');

    const summary = metrics.getMetricsSummary();
    
    console.log(`  📊 Total Operations: ${summary.totalMetrics}`);
    console.log(`  🎯 Unique Operations: ${summary.uniqueOperations}`);
    console.log(`  ⏱️  Average Response Time: ${summary.avgResponseTime.toFixed(2)}ms`);
    console.log(`  📈 Error Rate: ${(summary.errorRate * 100).toFixed(1)}%`);
    console.log(`  💾 Memory Usage: ${this.formatBytes(summary.memoryUsage.current)} (Peak: ${this.formatBytes(summary.memoryUsage.peak)})`);

    // Recent performance trends
    const recentMetrics = metrics.getMetrics('operation.duration', 10);
    if (recentMetrics.length > 0) {
      const avgRecent = recentMetrics.reduce((sum, m) => sum + m.value, 0) / recentMetrics.length;
      console.log(`  🔄 Recent Avg Response: ${avgRecent.toFixed(2)}ms`);
    }

    console.log('');
  }

  private async showDetailedHealth(healthStatus: any[]): Promise<void> {
    console.log('🔍 Detailed Health Information:\\n');

    for (const health of healthStatus) {
      const statusEmoji = health.status === 'healthy' ? '✅' : 
                         health.status === 'warning' ? '⚠️' : '❌';
      
      console.log(`${statusEmoji} ${health.component.toUpperCase()}: ${health.message}`);
      
      if (health.details && Object.keys(health.details).length > 0) {
        Object.entries(health.details).forEach(([key, value]) => {
          console.log(`   • ${key}: ${value}`);
        });
      }
      
      if (health.responseTime) {
        console.log(`   • Response Time: ${health.responseTime}ms`);
      }
      
      console.log('');
    }
  }

  private async showWorkspaceStatus(healthStatus: any[], session: ConsoleSession): Promise<void> {
    console.log('📁 Workspace Status:');

    if (session.workspace) {
      console.log(`  📂 Project: ${session.workspace.name}`);
      console.log(`  🌐 Server: ${session.workspace.config.host}:${session.workspace.config.port}`);
      console.log(`  🖥️  Node: ${session.workspace.config.node}`);
      
      const workspaceHealth = healthStatus.find(h => h.component === 'workspace');
      if (workspaceHealth?.details) {
        const emoji = workspaceHealth.details.hasConfig ? '✅' : '❌';
        console.log(`  ${emoji} Configuration: ${workspaceHealth.details.hasConfig ? 'Present' : 'Missing'}`);
        
        const tfEmoji = workspaceHealth.details.hasTerraform ? '✅' : '❌';
        console.log(`  ${tfEmoji} Terraform: ${workspaceHealth.details.hasTerraform ? 'Ready' : 'Not configured'}`);
        
        const ansEmoji = workspaceHealth.details.hasAnsible ? '✅' : '❌';
        console.log(`  ${ansEmoji} Ansible: ${workspaceHealth.details.hasAnsible ? 'Ready' : 'Not configured'}`);
      }
    } else {
      console.log('  ⚠️  Not in a workspace - use /init to create one');
    }

    console.log('');
  }

  private async showRecommendations(healthStatus: any[], session: ConsoleSession): Promise<void> {
    const issues = healthStatus.filter(h => h.status !== 'healthy');
    
    if (issues.length === 0) {
      console.log('🎉 No issues detected - system is healthy!');
      return;
    }

    console.log('💡 Recommendations:');

    for (const issue of issues) {
      console.log(`\\n${issue.status === 'error' ? '🔴' : '🟡'} ${issue.component}:`);
      console.log(`   Issue: ${issue.message}`);
      
      // Provide specific recommendations based on component
      const recommendations = this.getRecommendations(issue.component, issue.status, issue.details);
      recommendations.forEach(rec => {
        console.log(`   💡 ${rec}`);
      });
    }

    console.log('\\n📖 For more help:');
    console.log('   • Use /debug on for detailed troubleshooting');
    console.log('   • Use /report-issue to generate diagnostic report');
    console.log('   • Check logs with /logs command');
  }

  private getRecommendations(component: string, status: string, details: any): string[] {
    const recommendations: string[] = [];

    switch (component) {
      case 'system':
        if (status === 'warning') {
          recommendations.push('Consider reducing system load');
          recommendations.push('Monitor CPU and memory usage');
        }
        break;
      
      case 'memory':
        recommendations.push('Consider restarting the application');
        recommendations.push('Monitor memory usage patterns');
        if (details?.heapUsagePercent > 75) {
          recommendations.push('Enable debug mode to identify memory leaks');
        }
        break;
      
      case 'database':
        recommendations.push('Ensure workspace is properly initialized');
        recommendations.push('Check file permissions in .proxmox directory');
        break;
      
      case 'workspace':
        recommendations.push('Run /init to properly configure workspace');
        recommendations.push('Verify .proxmox/config.yml exists and is valid');
        break;
      
      default:
        if (component.startsWith('tool_')) {
          const tool = component.replace('tool_', '');
          recommendations.push(`Install ${tool} or ensure it's in your PATH`);
          recommendations.push(`Check ${tool} documentation for installation instructions`);
        }
    }

    if (recommendations.length === 0) {
      recommendations.push('Check the error details above for more information');
      recommendations.push('Use /debug on for verbose troubleshooting');
    }

    return recommendations;
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}