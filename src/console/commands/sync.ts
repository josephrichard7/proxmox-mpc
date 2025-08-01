/**
 * Sync Command
 * Discovers existing Proxmox infrastructure and generates Infrastructure-as-Code
 */

import { ConsoleSession } from '../repl';
import { ProxmoxClient } from '../../api';
import { TerraformGenerator } from '../../generators/terraform';
import { AnsibleGenerator } from '../../generators/ansible';

export class SyncCommand {
  async execute(args: string[], session: ConsoleSession): Promise<void> {
    console.log('🔄 Synchronizing Proxmox infrastructure...\n');

    // Check if we're in a workspace
    if (!session.workspace) {
      console.log('❌ No workspace detected');
      console.log('   Use /init to create a workspace first');
      return;
    }

    try {
      // Connect to Proxmox server
      const client = session.client || new ProxmoxClient(session.workspace.config);
      const connectionResult = await client.connect();
      
      if (!connectionResult.success) {
        console.log('❌ Failed to connect to Proxmox server');
        console.log(`   Error: ${connectionResult.error}`);
        return;
      }

      console.log('✅ Connected to Proxmox server');
      session.client = client;

      // Phase 1: Infrastructure Discovery
      await this.discoverInfrastructure(client, session);

      // Phase 2: Generate Terraform configurations
      await this.generateTerraformConfigs(client, session);

      // Phase 3: Generate Ansible configurations
      await this.generateAnsibleConfigs(client, session);

      // Phase 4: Update local database
      await this.updateLocalDatabase(client, session);

      console.log('\n✅ Infrastructure synchronization complete!');
      console.log('\n📂 Generated files:');
      console.log('   • terraform/*.tf - Infrastructure resources');
      console.log('   • ansible/inventory.yml - Server inventory');
      console.log('   • ansible/playbooks/*.yml - Configuration playbooks');
      console.log('   • tests/*.test.js - Infrastructure validation tests');
      
      console.log('\n🚀 Next steps:');
      console.log('   • Use /status to verify imported infrastructure'); 
      console.log('   • Use /test to validate configurations');
      console.log('   • Use /apply to deploy any changes');

    } catch (error) {
      console.error(`❌ Sync failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async discoverInfrastructure(client: ProxmoxClient, session: ConsoleSession): Promise<void> {
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

    } catch (error) {
      throw new Error(`Infrastructure discovery failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async generateTerraformConfigs(client: ProxmoxClient, session: ConsoleSession): Promise<void> {
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

  private async generateAnsibleConfigs(client: ProxmoxClient, session: ConsoleSession): Promise<void> {
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

  private async updateLocalDatabase(client: ProxmoxClient, session: ConsoleSession): Promise<void> {
    console.log('\n💽 Phase 4: Updating local database...');

    try {
      // TODO: Implement database synchronization
      // This would update the local SQLite database with current infrastructure state
      console.log('   📊 Database synchronization (placeholder - to be implemented)');

    } catch (error) {
      throw new Error(`Database update failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}