/**
 * Status Command
 * Shows project and server status information
 */

import { ProxmoxClient } from '../../api';
import { BaseCommand, CommandMetadata } from './base-command';
import { errorHandler } from '../error-handler';
import { ConsoleSession } from '../repl';

export class StatusCommand extends BaseCommand {
  getMetadata(): CommandMetadata {
    return {
      name: 'status',
      description: 'Show project and server status information',
      usage: '/status',
      examples: ['/status - Display current project and server status'],
      requiresWorkspace: false,
      requiresConnection: false
    };
  }

  async execute(args: string[], session: ConsoleSession): Promise<void> {
    console.log('📊 Project Status\n');

    // Show workspace status
    if (session.workspace) {
      console.log('📁 Workspace Information:');
      console.log(`   Project: ${session.workspace.name}`);
      console.log(`   Location: ${session.workspace.rootPath}`);
      console.log(`   Config: ${session.workspace.configPath}`);
      console.log(`   Database: ${session.workspace.databasePath}`);
      
      // Show server configuration
      console.log('\n🖥️  Server Configuration:');
      console.log(`   Host: ${session.workspace.config.host}:${session.workspace.config.port}`);
      console.log(`   Username: ${session.workspace.config.username}`);
      console.log(`   Node: ${session.workspace.config.node}`);
      console.log(`   SSL Verification: ${session.workspace.config.rejectUnauthorized ? 'Enabled' : 'Disabled'}`);

      // Test server connectivity
      console.log('\n🔌 Server Connectivity:');
      try {
        const client = new ProxmoxClient(session.workspace.config);
        const result = await client.connect();
        
        if (result.success) {
          console.log('   Status: ✅ Connected');
          console.log(`   Version: ${result.version}`);
          console.log(`   Endpoint: ${result.details?.endpoint}`);
          console.log(`   Nodes: ${result.details?.nodes}`);
          
          // Cache client for future use
          session.client = client;
        } else {
          console.log('   Status: ❌ Connection failed');
          console.log(`   Error: ${result.error}`);
        }
      } catch (error) {
        errorHandler.handleConnectionError(
          'status',
          `${session.workspace.config.host}:${session.workspace.config.port}`,
          error as Error
        );
      }

      // Show infrastructure overview (if connected)
      if (session.client) {
        await this.showInfrastructureOverview(session.client, session.workspace.config.node);
      }

    } else {
      errorHandler.handleError({
        code: 'NO_WORKSPACE',
        message: 'No workspace detected',
        severity: 'medium',
        context: {
          command: 'status',
          suggestions: [
            'Use /init to create a new workspace',
            'Navigate to an existing project directory'
          ]
        }
      });
    }

    // Show session information
    console.log('\n⏱️  Session Information:');
    console.log(`   Started: ${session.startTime.toLocaleString()}`);
    console.log(`   Commands executed: ${session.history.length}`);
    console.log(`   Uptime: ${this.formatDuration(Date.now() - session.startTime.getTime())}`);
    
    console.log('');
  }

  private async showInfrastructureOverview(client: ProxmoxClient, defaultNode: string): Promise<void> {
    console.log('\n🏗️  Infrastructure Overview:');
    
    try {
      // Get nodes
      const nodes = await client.getNodes();
      console.log(`   Nodes: ${nodes.length} total`);
      console.log(`   📝 Available nodes:`, nodes.map(n => `${n.node} (${n.status})`).join(', '));
      
      // Get VMs and containers from all nodes
      let totalVMs = 0;
      let totalContainers = 0;
      let runningVMs = 0;
      let runningContainers = 0;

      for (const node of nodes) {
        try {
          console.log(`   🔍 Checking node: ${node.node}`);
          
          // Get VMs first
          const vms = await client.getVMs(node.node);
          console.log(`   📊 VMs on ${node.node}:`, vms.length > 0 ? vms.map(vm => `${vm.vmid}:${vm.name}(${vm.status})`).join(', ') : 'none');
          
          // Get containers
          const containers = await client.getContainers(node.node);
          console.log(`   📊 Containers on ${node.node}:`, containers.length > 0 ? containers.map(c => `${c.vmid}:${c.name}(${c.status})`).join(', ') : 'none');
          
          totalVMs += vms.length;
          totalContainers += containers.length;
          runningVMs += vms.filter(vm => vm.status === 'running').length;
          runningContainers += containers.filter(c => c.status === 'running').length;
          
        } catch (error) {
          errorHandler.showWarning(
            `Failed to get resources from node ${node.node}`,
            [`Error: ${error instanceof Error ? error.message : String(error)}`]
          );
        }
      }

      console.log(`   VMs: ${totalVMs} total (${runningVMs} running)`);
      console.log(`   Containers: ${totalContainers} total (${runningContainers} running)`);

      // Show storage information
      try {
        const storage = await client.getStoragePools();
        console.log(`   Storage Pools: ${storage.length} total`);
      } catch (error) {
        console.log('   Storage Pools: Unable to retrieve');
      }

    } catch (error) {
      console.log('   Unable to retrieve infrastructure information');
    }
  }

  private formatDuration(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
}