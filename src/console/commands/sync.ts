/**
 * Sync Command
 * Discovers existing Proxmox infrastructure and generates Infrastructure-as-Code
 */

import { ConsoleSession } from '../repl';
import { ProxmoxClient } from '../../api';
import { TerraformGenerator } from '../../generators/terraform';
import { AnsibleGenerator } from '../../generators/ansible';
import { TestGenerator } from '../../generators/tests';
import { Logger } from '../../observability/logger';
import { Tracer } from '../../observability/tracer';
import { MetricsCollector } from '../../observability/metrics';
import { errorHandler } from '../error-handler';

export class SyncCommand {
  private logger = Logger.getInstance();
  private tracer = Tracer.getInstance();
  private metrics = MetricsCollector.getInstance();

  async execute(args: string[], session: ConsoleSession): Promise<void> {
    // Start tracing for the entire sync operation
    const traceId = this.tracer.startTrace('sync', {
      workspace: session.workspace?.name || 'unknown',
      command: 'sync'
    });
    
    const startTime = Date.now();
    
    this.logger.operationStart('sync', 'initialization', {
      workspace: session.workspace?.rootPath,
      proxmoxServer: session.workspace?.config.host
    });

    console.log('🔄 Synchronizing Proxmox infrastructure...\n');

    // Check if we're in a workspace
    if (!errorHandler.validateSession(session, 'sync')) {
      this.tracer.finishSpanWithError(traceId, new Error('No workspace detected'));
      return;
    }

    try {
      // Connect to Proxmox server
      const connectSpan = this.tracer.startSpan('connect', traceId, {
        server: session.workspace!.config.host,
        port: session.workspace!.config.port.toString()
      });

      const client = session.client || new ProxmoxClient(session.workspace!.config);
      const connectStartTime = Date.now();
      const connectionResult = await client.connect();
      const connectDuration = Date.now() - connectStartTime;
      
      this.metrics.recordProxmoxMetrics('connect', 'POST', connectDuration, connectionResult.success);
      
      if (!connectionResult.success) {
        console.log('❌ Failed to connect to Proxmox server');
        console.log(`   Error: ${connectionResult.error}`);
        
        this.logger.error('Proxmox connection failed', new Error(connectionResult.error || 'Connection failed'), {
          workspace: session.workspace!.rootPath,
          proxmoxServer: session.workspace!.config.host,
          resourcesAffected: []
        }, [
          'Check network connectivity to Proxmox server',
          'Verify server address and port in workspace config',
          'Check API token permissions'
        ]);
        
        this.tracer.finishSpanWithError(connectSpan, new Error(connectionResult.error || 'Connection failed'));
        this.tracer.finishSpanWithError(traceId, new Error('Sync failed due to connection error'));
        return;
      }

      console.log('✅ Connected to Proxmox server');
      session.client = client;
      
      this.logger.info('Proxmox connection established', {
        workspace: session.workspace!.rootPath,
        proxmoxServer: session.workspace!.config.host,
        resourcesAffected: [],
        duration: connectDuration
      });
      
      this.tracer.finishSpan(connectSpan, { duration: connectDuration.toString() });

      // Phase 1: Infrastructure Discovery
      await this.discoverInfrastructure(client, session, traceId);

      // Phase 2: Generate Terraform configurations
      await this.generateTerraformConfigs(client, session, traceId);

      // Phase 3: Generate Ansible configurations
      await this.generateAnsibleConfigs(client, session, traceId);

      // Phase 4: Generate TDD test suite
      await this.generateTestSuite(client, session, traceId);

      // Phase 5: Update local database
      await this.updateLocalDatabase(client, session, traceId);

      const totalDuration = Date.now() - startTime;
      
      console.log('\n✅ Infrastructure synchronization complete!');
      console.log('\n📂 Generated files:');
      console.log('   • terraform/*.tf - Infrastructure resources');
      console.log('   • ansible/inventory.yml - Server inventory');
      console.log('   • ansible/playbooks/*.yml - Configuration playbooks');
      console.log('   • tests/ - Comprehensive TDD test suite');
      console.log('     ├── terraform/ - Terratest Go tests');
      console.log('     ├── ansible/ - pytest and molecule tests');
      console.log('     └── integration/ - End-to-end workflow tests');
      
      console.log('\n🚀 Next steps:');
      console.log('   • Use /status to verify imported infrastructure'); 
      console.log('   • Use /test to validate configurations and run TDD tests');
      console.log('   • Run ./tests/run-tests.sh for comprehensive validation');
      console.log('   • Use /apply to deploy any changes after validation');

      // Record successful completion
      this.logger.operationSuccess('sync', 'completion', totalDuration, {
        workspace: session.workspace!.rootPath,
        proxmoxServer: session.workspace!.config.host,
        resourcesAffected: []
      });
      
      this.metrics.recordDuration('sync', totalDuration, {
        success: 'true',
        workspace: session.workspace!.name
      });
      
      this.tracer.finishSpan(traceId, {
        duration: totalDuration.toString(),
        success: 'true'
      });

    } catch (error) {
      const totalDuration = Date.now() - startTime;
      
      console.error(`❌ Sync failed: ${error instanceof Error ? error.message : String(error)}`);
      
      this.logger.operationFailure('sync', 'execution', error as Error, totalDuration, {
        workspace: session.workspace?.rootPath,
        proxmoxServer: session.workspace?.config.host,
        resourcesAffected: []
      }, [
        'Check logs with /logs --level error for detailed error information',
        'Use /debug on for verbose troubleshooting',
        'Use /report-issue to generate diagnostic report for AI assistance'
      ]);
      
      this.metrics.recordDuration('sync', totalDuration, {
        success: 'false',
        workspace: session.workspace?.name || 'unknown'
      });
      
      this.tracer.finishSpanWithError(traceId, error as Error);
    }
  }

  private async discoverInfrastructure(client: ProxmoxClient, session: ConsoleSession, parentTraceId: string): Promise<void> {
    const spanId = this.tracer.startSpan('discovery', parentTraceId, {
      phase: 'infrastructure-discovery'
    });
    
    console.log('🔍 Phase 1: Discovering infrastructure...');

    try {
      // Get all nodes
      const nodes = await client.getNodes();
      console.log(`   📍 Found ${nodes.length} node(s): ${nodes.map(n => n.node).join(', ')}`);

      let totalVMs = 0;
      let totalContainers = 0;

      // Discover resources on each node
      for (const node of nodes) {
        console.log(`\n   🖥️  Scanning node: ${node.node}`);
        
        // Get VMs
        const vms = await client.getVMs(node.node);
        if (vms.length > 0) {
          console.log(`   📦 VMs found: ${vms.map(vm => `${vm.vmid}:${vm.name}(${vm.status})`).join(', ')}`);
          totalVMs += vms.length;
        }

        // Get containers
        const containers = await client.getContainers(node.node);
        if (containers.length > 0) {
          console.log(`   📦 Containers found: ${containers.map(c => `${c.vmid}:${c.name}(${c.status})`).join(', ')}`);
          totalContainers += containers.length;
        }

        // Get storage
        try {
          const storage = await client.getStoragePools();
          console.log(`   💾 Storage pools: ${storage.length} found`);
        } catch (error) {
          console.log(`   💾 Storage pools: Unable to retrieve`);
        }
      }

      console.log(`\n   📊 Discovery summary: ${totalVMs} VMs, ${totalContainers} containers across ${nodes.length} node(s)`);
      
      this.logger.info('Infrastructure discovery completed', {
        workspace: session.workspace?.rootPath,
        resourcesAffected: [`${totalVMs} VMs`, `${totalContainers} containers`]
      });
      
      this.tracer.finishSpan(spanId, {
        totalVMs: totalVMs.toString(),
        totalContainers: totalContainers.toString(),
        nodes: nodes.length.toString()
      });

    } catch (error) {
      this.logger.error('Infrastructure discovery failed', error as Error, {
        workspace: session.workspace?.rootPath,
        resourcesAffected: []
      });
      
      this.tracer.finishSpanWithError(spanId, error as Error);
      throw new Error(`Infrastructure discovery failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async generateTerraformConfigs(client: ProxmoxClient, session: ConsoleSession, parentTraceId: string): Promise<void> {
    console.log('\n🏗️  Phase 2: Generating Terraform configurations...');

    try {
      const generator = new TerraformGenerator(session.workspace!);
      
      // Get all nodes for resource discovery
      const nodes = await client.getNodes();
      
      for (const node of nodes) {
        // Generate VM configurations
        const vms = await client.getVMs(node.node);
        for (const vm of vms) {
          await generator.generateVMResource(vm);
          console.log(`   📝 Generated terraform/vms/${vm.name || vm.vmid}.tf`);
        }

        // Generate container configurations
        const containers = await client.getContainers(node.node);
        for (const container of containers) {
          await generator.generateContainerResource(container);
          console.log(`   📝 Generated terraform/containers/${container.name || container.vmid}.tf`);
        }
      }

      // Generate provider and variables configuration
      await generator.generateProviderConfig();
      console.log(`   📝 Generated terraform/main.tf`);

    } catch (error) {
      throw new Error(`Terraform generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async generateAnsibleConfigs(client: ProxmoxClient, session: ConsoleSession, parentTraceId: string): Promise<void> {
    console.log('\n🎵 Phase 3: Generating Ansible configurations...');

    try {
      const generator = new AnsibleGenerator(session.workspace!);
      
      // Generate dynamic inventory
      const nodes = await client.getNodes();
      const allVMs = [];
      const allContainers = [];

      for (const node of nodes) {
        const vms = await client.getVMs(node.node);
        const containers = await client.getContainers(node.node);
        allVMs.push(...vms);
        allContainers.push(...containers);
      }

      await generator.generateInventory(allVMs, allContainers);
      console.log(`   📝 Generated ansible/inventory.yml`);

      // Generate basic playbooks
      await generator.generatePlaybooks(allVMs, allContainers);
      console.log(`   📝 Generated ansible/playbooks/site.yml`);

    } catch (error) {
      throw new Error(`Ansible generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async generateTestSuite(client: ProxmoxClient, session: ConsoleSession, parentTraceId: string): Promise<void> {
    console.log('\n🧪 Phase 4: Generating TDD test suite...');

    try {
      const testGenerator = new TestGenerator(session.workspace!);
      
      // Collect all infrastructure data for test generation
      const nodes = await client.getNodes();
      const allVMs: any[] = [];
      const allContainers: any[] = [];
      let allStorage: any[] = [];
      
      // Gather all resources from all nodes
      for (const node of nodes) {
        try {
          const vms = await client.getVMs(node.node);
          allVMs.push(...vms);
          
          const containers = await client.getContainers(node.node);
          allContainers.push(...containers);
        } catch (error) {
          console.log(`   ⚠️  Could not get resources from node ${node.node}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      // Get storage information
      try {
        allStorage = await client.getStoragePools();
      } catch (error) {
        console.log(`   ⚠️  Could not get storage information: ${error instanceof Error ? error.message : String(error)}`);
        allStorage = [];
      }
      
      // Generate comprehensive test suite
      await testGenerator.generateTestSuite(allVMs, allContainers, allStorage);
      
      console.log('   ✅ Generated comprehensive TDD test suite');
      console.log(`   📊 Test coverage: ${allVMs.length + allContainers.length} resources, ${nodes.length} nodes`);
      console.log('   🏗️  Terraform tests: Syntax validation, planning, resource verification');
      console.log('   🎵 Ansible tests: Inventory validation, playbook syntax, molecule integration');
      console.log('   🔗 Integration tests: End-to-end workflow and consistency validation');

    } catch (error) {
      throw new Error(`Test generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async updateLocalDatabase(client: ProxmoxClient, session: ConsoleSession, parentTraceId: string): Promise<void> {
    console.log('\n💽 Phase 5: Updating local database...');

    try {
      // TODO: Implement database synchronization
      // This would update the local SQLite database with current infrastructure state
      console.log('   📊 Database synchronization (placeholder - to be implemented)');

    } catch (error) {
      throw new Error(`Database update failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}