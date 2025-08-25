/**
 * Resource Command Handler
 * Handles resource management commands: create, delete, list, describe
 */

import { ProxmoxClient } from '../../api';
import { AnsibleGenerator } from '../../generators/ansible';
import { TerraformGenerator } from '../../generators/terraform';
import { TestGenerator } from '../../generators/tests';
import { VMCreateConfig, ContainerCreateConfig, VMInfo, ContainerInfo } from '../../types';
import { ConsoleSession } from '../repl';

export interface ResourceCommandOptions {
  name?: string;
  cores?: number;
  memory?: number;
  storage?: string;
  template?: string;
  ostemplate?: string;
  network?: string;
  description?: string;
  start?: boolean;
  [key: string]: any;
}

export class ResourceCommand {
  /**
   * Execute resource commands: create, delete, list, describe
   */
  async execute(command: string, session: ConsoleSession): Promise<void> {
    if (!session.workspace) {
      console.log('❌ No workspace detected. Use /init to create a workspace first.');
      return;
    }

    const [action, resourceType, ...args] = command.split(' ');

    try {
      switch (action) {
        case 'create':
          await this.handleCreate(resourceType, args, session);
          break;
        case 'delete':
          await this.handleDelete(resourceType, args, session);
          break;
        case 'list':
          await this.handleList(resourceType, args, session);
          break;
        case 'describe':
          await this.handleDescribe(resourceType, args, session);
          break;
        default:
          console.log(`❌ Unknown resource action: ${action}`);
          this.showResourceHelp();
          break;
      }
    } catch (error) {
      console.error(`❌ Resource command error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Handle create commands
   */
  private async handleCreate(resourceType: string, args: string[], session: ConsoleSession): Promise<void> {
    const options = this.parseOptions(args);

    if (!options.name) {
      console.log('❌ Resource name is required. Use --name <name>');
      return;
    }

    switch (resourceType) {
      case 'vm':
        await this.createVM(options, session);
        break;
      case 'container':
        await this.createContainer(options, session);
        break;
      default:
        console.log(`❌ Unknown resource type: ${resourceType}`);
        console.log('Available types: vm, container');
        break;
    }
  }

  /**
   * Handle delete commands
   */
  private async handleDelete(resourceType: string, args: string[], session: ConsoleSession): Promise<void> {
    if (args.length === 0) {
      console.log('❌ Resource ID or name is required');
      return;
    }

    const identifier = args[0];
    
    switch (resourceType) {
      case 'vm':
        await this.deleteVM(identifier, session);
        break;
      case 'container':
        await this.deleteContainer(identifier, session);
        break;
      default:
        console.log(`❌ Unknown resource type: ${resourceType}`);
        console.log('Available types: vm, container');
        break;
    }
  }

  /**
   * Handle list commands
   */
  private async handleList(resourceType: string, args: string[], session: ConsoleSession): Promise<void> {
    try {
      const database = await session.workspace!.getDatabaseClient();

      switch (resourceType) {
        case 'vms':
          await this.listVMs(database);
          break;
        case 'containers':
          await this.listContainers(database);
          break;
        case 'all':
          await this.listVMs(database);
          console.log(''); // Empty line separator
          await this.listContainers(database);
          break;
        default:
          console.log(`❌ Unknown resource type: ${resourceType}`);
          console.log('Available types: vms, containers, all');
          break;
      }

      await database.$disconnect();
    } catch (error) {
      console.error(`❌ Failed to list resources: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Handle describe commands
   */
  private async handleDescribe(resourceType: string, args: string[], session: ConsoleSession): Promise<void> {
    if (args.length === 0) {
      console.log('❌ Resource ID or name is required');
      return;
    }

    const identifier = args[0];

    try {
      const database = await session.workspace!.getDatabaseClient();

      switch (resourceType) {
        case 'vm':
          await this.describeVM(identifier, database);
          break;
        case 'container':
          await this.describeContainer(identifier, database);
          break;
        default:
          console.log(`❌ Unknown resource type: ${resourceType}`);
          console.log('Available types: vm, container');
          break;
      }

      await database.$disconnect();
    } catch (error) {
      console.error(`❌ Failed to describe resource: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Create VM with Terraform/Ansible generation
   */
  private async createVM(options: ResourceCommandOptions, session: ConsoleSession): Promise<void> {
    console.log(`🏗️  Creating VM configuration: ${options.name}`);

    // Validate options
    const vmConfig: VMCreateConfig = {
      vmid: 0, // Will be assigned by Proxmox
      name: options.name,
      cores: options.cores || 2,
      memory: options.memory || 2048,
      storage: options.storage || 'local-lvm',
      template: options.template,
      description: options.description,
      start: options.start !== false,
    };

    try {
      // Create mock VM info for generators
      const vmInfo: VMInfo = {
        vmid: 9999, // Placeholder - will be assigned by Proxmox
        name: vmConfig.name,
        status: 'planning',
        node: session.workspace!.config.node,
        cpus: vmConfig.cores,
        maxmem: (vmConfig.memory || 2048) * 1024 * 1024, // Convert MB to bytes
        maxdisk: 21474836480, // 20GB default
      };

      // Generate Terraform configuration
      const terraformGen = new TerraformGenerator(session.workspace!);
      await terraformGen.initialize();
      await terraformGen.generateVMResource(vmInfo);
      console.log(`📝 Generated terraform/vms/${this.sanitizeName(options.name!)}.tf`);

      // Generate Ansible configuration
      const ansibleGen = new AnsibleGenerator(session.workspace!);
      await ansibleGen.generateVMPlaybook(vmInfo);
      console.log(`📝 Generated ansible/playbooks/${this.sanitizeName(options.name!)}.yml`);

      // Generate tests
      const testGen = new TestGenerator(session.workspace!);
      await testGen.generateVMTest(vmInfo);
      console.log(`🧪 Generated tests/vms/${this.sanitizeName(options.name!)}.test.js`);

      console.log(`✅ VM configuration created successfully!`);
      console.log('');
      console.log('📋 Next steps:');
      console.log('   1. Review generated configurations in terraform/ and ansible/');
      console.log('   2. Run /test to validate configurations');
      console.log('   3. Run /apply to deploy to Proxmox');

    } catch (error) {
      console.error(`❌ Failed to create VM configuration: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Create container with Terraform/Ansible generation
   */
  private async createContainer(options: ResourceCommandOptions, session: ConsoleSession): Promise<void> {
    console.log(`🏗️  Creating container configuration: ${options.name}`);

    // Validate options
    const containerConfig: ContainerCreateConfig = {
      vmid: 0, // Will be assigned by Proxmox
      hostname: options.name,
      cores: options.cores || 1,
      memory: options.memory || 512,
      ostemplate: options.ostemplate || 'local:vztmpl/ubuntu-22.04-standard_22.04-1_amd64.tar.zst',
      description: options.description,
      start: options.start !== false,
    };

    try {
      // Create mock container info for generators
      const containerInfo: ContainerInfo = {
        vmid: 9999, // Placeholder - will be assigned by Proxmox
        name: containerConfig.hostname,
        status: 'planning',
        node: session.workspace!.config.node,
        cpus: containerConfig.cores,
        maxmem: (containerConfig.memory || 512) * 1024 * 1024, // Convert MB to bytes
        maxdisk: 8589934592, // 8GB default
      };

      // Generate Terraform configuration
      const terraformGen = new TerraformGenerator(session.workspace!);
      await terraformGen.initialize();
      await terraformGen.generateContainerResource(containerInfo);
      console.log(`📝 Generated terraform/containers/${this.sanitizeName(options.name!)}.tf`);

      // Generate Ansible configuration
      const ansibleGen = new AnsibleGenerator(session.workspace!);
      await ansibleGen.generateContainerPlaybook(containerInfo);
      console.log(`📝 Generated ansible/playbooks/${this.sanitizeName(options.name!)}.yml`);

      // Generate tests
      const testGen = new TestGenerator(session.workspace!);
      await testGen.generateContainerTest(containerInfo);
      console.log(`🧪 Generated tests/containers/${this.sanitizeName(options.name!)}.test.js`);

      console.log(`✅ Container configuration created successfully!`);
      console.log('');
      console.log('📋 Next steps:');
      console.log('   1. Review generated configurations in terraform/ and ansible/');
      console.log('   2. Run /test to validate configurations');
      console.log('   3. Run /apply to deploy to Proxmox');

    } catch (error) {
      console.error(`❌ Failed to create container configuration: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Delete VM (placeholder implementation)
   */
  private async deleteVM(identifier: string, session: ConsoleSession): Promise<void> {
    console.log(`🚧 Delete VM functionality not yet implemented: ${identifier}`);
    console.log('   This will remove Terraform/Ansible configurations and update database');
  }

  /**
   * Delete container (placeholder implementation)
   */
  private async deleteContainer(identifier: string, session: ConsoleSession): Promise<void> {
    console.log(`🚧 Delete container functionality not yet implemented: ${identifier}`);
    console.log('   This will remove Terraform/Ansible configurations and update database');
  }

  /**
   * List VMs from workspace database
   */
  private async listVMs(database: any): Promise<void> {
    const vms = await database.vM.findMany({
      orderBy: { id: 'asc' },
      include: { node: true }
    });

    if (vms.length === 0) {
      console.log('📋 No VMs found in workspace');
      console.log('   Use "create vm --name <name>" to create VM configurations');
      console.log('   Use "/sync" to import existing VMs from server');
      return;
    }

    console.log('📋 Virtual Machines:');
    console.log('');
    console.log('ID    Name                 Status    Node         CPU    Memory     Disk');
    console.log('────  ───────────────────  ────────  ───────────  ─────  ─────────  ──────────');
    
    for (const vm of vms) {
      const id = vm.id.toString().padEnd(4);
      const name = (vm.name || `vm-${vm.id}`).padEnd(19);
      const status = vm.status.padEnd(8);
      const node = vm.nodeId.padEnd(11);
      const cpu = (vm.cpuCores || 0).toString().padEnd(5);
      const memory = this.formatBytes(vm.memoryBytes || 0).padEnd(9);
      const disk = this.formatBytes(vm.diskSize || 0);
      
      console.log(`${id}  ${name}  ${status}  ${node}  ${cpu}  ${memory}  ${disk}`);
    }
  }

  /**
   * List containers from workspace database
   */
  private async listContainers(database: any): Promise<void> {
    const containers = await database.container.findMany({
      orderBy: { id: 'asc' },
      include: { node: true }
    });

    if (containers.length === 0) {
      console.log('📋 No containers found in workspace');
      console.log('   Use "create container --name <name>" to create container configurations');
      console.log('   Use "/sync" to import existing containers from server');
      return;
    }

    console.log('📋 Containers:');
    console.log('');
    console.log('ID    Name                 Status    Node         CPU    Memory     Disk');
    console.log('────  ───────────────────  ────────  ───────────  ─────  ─────────  ──────────');
    
    for (const container of containers) {
      const id = container.id.toString().padEnd(4);
      const name = (container.name || `ct-${container.id}`).padEnd(19);
      const status = container.status.padEnd(8);
      const node = container.nodeId.padEnd(11);
      const cpu = (container.cpuCores || 0).toString().padEnd(5);
      const memory = this.formatBytes(container.memoryBytes || 0).padEnd(9);
      const disk = this.formatBytes(container.diskSize || 0);
      
      console.log(`${id}  ${name}  ${status}  ${node}  ${cpu}  ${memory}  ${disk}`);
    }
  }

  /**
   * Describe VM details
   */
  private async describeVM(identifier: string, database: any): Promise<void> {
    const vmid = parseInt(identifier);
    let vm;

    if (isNaN(vmid)) {
      // Search by name
      vm = await database.vM.findFirst({
        where: { name: identifier },
        include: { node: true }
      });
    } else {
      // Search by ID
      vm = await database.vM.findUnique({
        where: { id: vmid },
        include: { node: true }
      });
    }

    if (!vm) {
      console.log(`❌ VM not found: ${identifier}`);
      return;
    }

    console.log(`🖥️  Virtual Machine Details: ${vm.name || `vm-${vm.id}`}`);
    console.log('');
    console.log(`ID:          ${vm.id}`);
    console.log(`Name:        ${vm.name || 'N/A'}`);
    console.log(`Status:      ${vm.status}`);
    console.log(`Node:        ${vm.nodeId}`);
    console.log(`CPU Cores:   ${vm.cpuCores || 0}`);
    console.log(`Memory:      ${this.formatBytes(vm.memoryBytes || 0)}`);
    console.log(`Disk:        ${this.formatBytes(vm.diskSize || 0)}`);
    console.log(`Template:    ${vm.template ? 'Yes' : 'No'}`);
    console.log(`HA Managed:  ${vm.haManaged ? 'Yes' : 'No'}`);
    console.log(`Created:     ${vm.createdAt.toISOString()}`);
    console.log(`Updated:     ${vm.updatedAt.toISOString()}`);

    if (vm.lockStatus) {
      console.log(`Lock Status: ${vm.lockStatus}`);
    }
    
    if (vm.lastSeen) {
      console.log(`Last Seen:   ${vm.lastSeen.toISOString()}`);
    }
  }

  /**
   * Describe container details
   */
  private async describeContainer(identifier: string, database: any): Promise<void> {
    const vmid = parseInt(identifier);
    let container;

    if (isNaN(vmid)) {
      // Search by name
      container = await database.container.findFirst({
        where: { name: identifier },
        include: { node: true }
      });
    } else {
      // Search by ID
      container = await database.container.findUnique({
        where: { id: vmid },
        include: { node: true }
      });
    }

    if (!container) {
      console.log(`❌ Container not found: ${identifier}`);
      return;
    }

    console.log(`📦 Container Details: ${container.name || `ct-${container.id}`}`);
    console.log('');
    console.log(`ID:          ${container.id}`);
    console.log(`Name:        ${container.name || 'N/A'}`);
    console.log(`Hostname:    ${container.hostname || 'N/A'}`);
    console.log(`Status:      ${container.status}`);
    console.log(`Node:        ${container.nodeId}`);
    console.log(`CPU Cores:   ${container.cpuCores || 0}`);
    console.log(`Memory:      ${this.formatBytes(container.memoryBytes || 0)}`);
    console.log(`Swap:        ${this.formatBytes(container.swapBytes || 0)}`);
    console.log(`Disk:        ${this.formatBytes(container.diskSize || 0)}`);
    console.log(`Template:    ${container.template ? 'Yes' : 'No'}`);
    console.log(`HA Managed:  ${container.haManaged ? 'Yes' : 'No'}`);
    console.log(`Created:     ${container.createdAt.toISOString()}`);
    console.log(`Updated:     ${container.updatedAt.toISOString()}`);

    if (container.osTemplate) {
      console.log(`OS Template: ${container.osTemplate}`);
    }
    
    if (container.lockStatus) {
      console.log(`Lock Status: ${container.lockStatus}`);
    }
    
    if (container.lastSeen) {
      console.log(`Last Seen:   ${container.lastSeen.toISOString()}`);
    }
  }

  /**
   * Parse command line options
   */
  private parseOptions(args: string[]): ResourceCommandOptions {
    const options: ResourceCommandOptions = {};
    
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      if (arg.startsWith('--')) {
        const key = arg.slice(2);
        const value = args[i + 1];
        
        if (value && !value.startsWith('--')) {
          // Convert numeric values
          if (key === 'cores' || key === 'memory') {
            options[key] = parseInt(value);
          } else if (key === 'start') {
            options[key] = value.toLowerCase() === 'true';
          } else {
            options[key] = value;
          }
          i++; // Skip the value in next iteration
        } else {
          // Boolean flag
          options[key] = true;
        }
      }
    }
    
    return options;
  }

  /**
   * Format bytes to human readable format
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }

  /**
   * Sanitize resource names for file names
   */
  private sanitizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }

  /**
   * Show resource command help
   */
  private showResourceHelp(): void {
    console.log('');
    console.log('🏗️  Resource Commands:');
    console.log('');
    console.log('Create Resources:');
    console.log('  create vm --name <name> [options]        Create VM configuration');
    console.log('  create container --name <name> [options] Create container configuration');
    console.log('');
    console.log('List Resources:');
    console.log('  list vms                                 List all VMs');
    console.log('  list containers                          List all containers');
    console.log('  list all                                 List VMs and containers');
    console.log('');
    console.log('Resource Details:');
    console.log('  describe vm <id|name>                    Show VM details');
    console.log('  describe container <id|name>             Show container details');
    console.log('');
    console.log('Delete Resources:');
    console.log('  delete vm <id|name>                      Remove VM configuration');
    console.log('  delete container <id|name>               Remove container configuration');
    console.log('');
    console.log('VM Creation Options:');
    console.log('  --name <name>       VM name (required)');
    console.log('  --cores <number>    CPU cores (default: 2)');
    console.log('  --memory <mb>       Memory in MB (default: 2048)');
    console.log('  --storage <name>    Storage pool (default: local-lvm)');
    console.log('  --template <name>   Clone from template');
    console.log('  --description <text> VM description');
    console.log('  --start <true|false> Start after creation (default: true)');
    console.log('');
    console.log('Container Creation Options:');
    console.log('  --name <name>       Container name (required)');
    console.log('  --cores <number>    CPU cores (default: 1)');
    console.log('  --memory <mb>       Memory in MB (default: 512)');
    console.log('  --ostemplate <name> OS template');
    console.log('  --description <text> Container description');
    console.log('  --start <true|false> Start after creation (default: true)');
    console.log('');
  }
}