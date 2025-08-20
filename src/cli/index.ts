#!/usr/bin/env node

/**
 * CLI entry point for Proxmox-MPC
 */

import { Command } from 'commander';
import { ProxmoxClient, loadProxmoxConfig, validateConfig, sanitizeConfig } from '../api';
import { VMCreateConfig, ContainerCreateConfig } from '../types';
import {
  promptConfirmation,
  validateVM,
  validateContainer,
  validateNode,
  displayValidationWarnings,
  displayError,
  displaySuccess,
  displayInfo,
  displayDryRun,
  Spinner,
  formatOutput,
  OutputFormat,
  Colors,
  filterResources,
  processBatchOperation
} from './utils';

const program = new Command();

program
  .name('proxmox-mpc')
  .description('Professional Proxmox Management and Control with safety mechanisms and batch operations')
  .version('0.1.0')
  .addHelpText('after', `
Examples:
  # Connection and discovery
  $ proxmox-mpc test-connection --verbose
  $ proxmox-mpc list-nodes --status online --output json
  $ proxmox-mpc discover-vms --status running --tags "production"
  
  # VM management with safety
  $ proxmox-mpc vm start 100 --wait --dry-run
  $ proxmox-mpc vm stop 100 --wait
  $ proxmox-mpc vm delete 100 --dry-run
  $ proxmox-mpc vm delete 100 --confirm --purge-disks
  
  # Batch operations
  $ proxmox-mpc vm batch-start 100 101 102 --wait
  $ proxmox-mpc vm batch-stop 100 101 --force --continue-on-error
  
  # Container management
  $ proxmox-mpc container start 200 --wait
  $ proxmox-mpc container delete 200 --dry-run
  
  # Output formats
  $ proxmox-mpc discover-vms --output yaml > vms.yaml
  $ proxmox-mpc list-nodes --output json | jq '.[] | .node'

Safety Features:
  • All destructive operations require confirmation (--confirm to skip)
  • Resource validation before operations
  • Dry-run mode for testing commands (--dry-run)
  • Progress indicators for long-running operations
  • Batch operations with error handling
  • Rich output formatting with colors and status indicators

For more help on specific commands, use: proxmox-mpc <command> --help
`);

// Connection test command
program
  .command('test-connection')
  .description('Test connection to Proxmox server')
  .option('-v, --verbose', 'show detailed connection information')
  .action(async (options) => {
    try {
      console.log('🔌 Testing Proxmox connection...');
      
      // Load and validate configuration
      const config = loadProxmoxConfig();
      const configErrors = validateConfig(config);
      
      if (configErrors.length > 0) {
        console.error('❌ Configuration errors:');
        configErrors.forEach(error => console.error(`   • ${error}`));
        process.exit(1);
      }

      if (options.verbose) {
        console.log('📋 Configuration:');
        const safeConfig = sanitizeConfig(config);
        Object.entries(safeConfig).forEach(([key, value]) => {
          console.log(`   ${key}: ${value}`);
        });
        console.log();
      }

      // Create client and test connection
      const client = new ProxmoxClient(config);
      const result = await client.connect();

      if (result.success) {
        console.log('✅ Connection successful!');
        console.log(`   Version: ${result.version}`);
        console.log(`   Node: ${result.node}`);
        
        if (options.verbose && result.details) {
          console.log('📊 Details:');
          console.log(`   Endpoint: ${result.details.endpoint}`);
          console.log(`   Nodes available: ${result.details.nodes}`);
          console.log(`   Full version: ${result.details.version.version}-${result.details.version.release}`);
        }
        
        process.exit(0);
      } else {
        console.error('❌ Connection failed:');
        console.error(`   ${result.error}`);
        
        if (options.verbose) {
          console.error('\n🔧 Troubleshooting:');
          console.error('   • Check your .env file has all required variables');
          console.error('   • Verify Proxmox server is running and accessible');
          console.error('   • Confirm API token has proper permissions');
          console.error('   • For self-signed certificates, ensure NODE_ENV=development');
        }
        
        process.exit(1);
      }
      
    } catch (error) {
      console.error('💥 Unexpected error:');
      console.error(`   ${error instanceof Error ? error.message : String(error)}`);
      
      if (options.verbose) {
        console.error('\n🐛 Debug info:');
        console.error(error);
      }
      
      process.exit(1);
    }
  });

// List nodes command
program
  .command('list-nodes')
  .description('List cluster nodes')
  .option('-v, --verbose', 'show detailed node information')
  .option('-o, --output <format>', 'output format (table, json, yaml)', 'table')
  .option('--status <status>', 'filter by node status (online, offline)')
  .action(async (options) => {
    const spinner = new Spinner();
    
    try {
      spinner.start('Fetching cluster nodes...');
      
      const config = loadProxmoxConfig();
      const client = new ProxmoxClient(config);
      
      const nodes = await client.getNodes();
      spinner.stop();
      
      // Apply filters
      let filteredNodes = nodes;
      if (options.status) {
        filteredNodes = nodes.filter(node => node.status === options.status);
      }
      
      // Handle quiet output
      if (options.output === 'quiet') {
        return;
      }
      
      // Format output based on requested format
      if (options.output === 'json') {
        console.log(formatOutput(filteredNodes, 'json'));
        return;
      }
      
      if (options.output === 'yaml') {
        console.log(formatOutput(filteredNodes, 'yaml'));
        return;
      }
      
      // Table format (default)
      displaySuccess(`Found ${filteredNodes.length} node(s)`);
      console.log();
      
      if (filteredNodes.length === 0) {
        displayInfo('No nodes match the specified criteria');
        return;
      }
      
      filteredNodes.forEach(node => {
        console.log(`${Colors.cyan}📍 ${node.node}${Colors.reset}`);
        console.log(`   Status: ${node.status === 'online' ? Colors.green : Colors.red}${node.status}${Colors.reset}`);
        console.log(`   CPU: ${node.cpu}/${node.maxcpu} cores`);
        console.log(`   Memory: ${Math.round(node.mem / 1024 / 1024)}MB / ${Math.round(node.maxmem / 1024 / 1024)}MB`);
        
        if (options.verbose) {
          console.log(`   Uptime: ${Math.floor(node.uptime / 86400)} days`);
          if ((node as any).level) console.log(`   Level: ${(node as any).level}`);
          if ((node as any).id) console.log(`   ID: ${(node as any).id}`);
        }
        console.log();
      });
      
    } catch (error) {
      spinner.fail('Failed to list nodes');
      displayError(`${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

// Discover VMs command
program
  .command('discover-vms')
  .description('Discover and list all VMs from cluster with filtering')
  .option('-v, --verbose', 'show detailed VM information')
  .option('-n, --node <node>', 'discover VMs from specific node only')
  .option('-o, --output <format>', 'output format (table, json, yaml)', 'table')
  .option('--status <status>', 'filter by VM status (running, stopped, paused)')
  .option('--tags <tags>', 'filter by tags (partial match)')
  .option('--name <name>', 'filter by name (partial match)')
  .addHelpText('after', `
Examples:
  $ proxmox-mpc discover-vms                            # List all VMs
  $ proxmox-mpc discover-vms --status running --verbose # Show running VMs with details
  $ proxmox-mpc discover-vms --output json              # JSON output for scripts
  $ proxmox-mpc discover-vms --tags production          # Filter by tags
  $ proxmox-mpc discover-vms --node pve-node1           # Single node only
  $ proxmox-mpc discover-vms --name web --status running # Running VMs with "web" in name

Output Formats:
  • table (default): Human-readable with colors and icons
  • json: Machine-readable JSON format
  • yaml: YAML format for configuration files
  • quiet: No output (useful for scripts)
`)
  .action(async (options) => {
    const spinner = new Spinner();
    
    try {
      spinner.start('Discovering VMs...');
      
      const config = loadProxmoxConfig();
      const client = new ProxmoxClient(config);
      
      let nodesToQuery = [];
      
      if (options.node) {
        // Validate the specified node exists
        const nodeValidation = await validateNode(client, options.node);
        if (!nodeValidation.valid) {
          spinner.fail('Node validation failed');
          displayError(`${nodeValidation.error}`);
          process.exit(1);
        }
        nodesToQuery = [{ node: options.node }];
      } else {
        nodesToQuery = await client.getNodes();
      }
      
      let allVMs: any[] = [];
      
      for (const nodeInfo of nodesToQuery) {
        try {
          const vms = await client.getVMs(nodeInfo.node);
          // Add node information to each VM
          const vmsWithNode = vms.map(vm => ({ ...vm, node: nodeInfo.node }));
          allVMs = allVMs.concat(vmsWithNode);
        } catch (error) {
          console.error(`\n❌ Failed to get VMs from node ${nodeInfo.node}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      
      spinner.stop();
      
      // Apply filters
      const filteredVMs = filterResources(allVMs, {
        status: options.status,
        node: options.node,
        tags: options.tags,
        name: options.name
      });
      
      // Handle different output formats
      if (options.output === 'quiet') {
        return;
      }
      
      if (options.output === 'json') {
        console.log(formatOutput(filteredVMs, 'json'));
        return;
      }
      
      if (options.output === 'yaml') {
        console.log(formatOutput(filteredVMs, 'yaml'));
        return;
      }
      
      // Table format (default)
      displaySuccess(`Found ${filteredVMs.length} VMs total`);
      console.log();
      
      if (filteredVMs.length === 0) {
        displayInfo('No VMs match the specified criteria');
        return;
      }
      
      // Group VMs by node for better organization
      const vmsByNode = filteredVMs.reduce((acc: Record<string, any[]>, vm: any) => {
        if (!acc[vm.node]) acc[vm.node] = [];
        acc[vm.node].push(vm);
        return acc;
      }, {} as Record<string, any[]>);
      
      for (const [nodeName, vms] of Object.entries(vmsByNode)) {
        console.log(`${Colors.cyan}📍 ${nodeName} (${vms.length} VMs):${Colors.reset}`);
        
        for (const vm of vms) {
          const statusColor = vm.status === 'running' ? Colors.green : 
                            vm.status === 'stopped' ? Colors.red : Colors.yellow;
          
          console.log(`   🖥️  VM ${vm.vmid}: ${Colors.bright}${vm.name || 'unnamed'}${Colors.reset}`);
          console.log(`      Status: ${statusColor}${vm.status}${Colors.reset}`);
          
          if (options.verbose) {
            console.log(`      CPU: ${vm.cpu?.toFixed(2) || 'N/A'}% (${vm.cpus || 'N/A'} cores)`);
            console.log(`      Memory: ${vm.mem ? Math.round(vm.mem / 1024 / 1024) : 'N/A'}MB / ${vm.maxmem ? Math.round(vm.maxmem / 1024 / 1024) : 'N/A'}MB`);
            if (vm.uptime) {
              console.log(`      Uptime: ${Math.floor(vm.uptime / 86400)} days`);
            }
            if (vm.template) {
              console.log(`      ${Colors.yellow}Template: Yes${Colors.reset}`);
            }
            if (vm.tags) {
              console.log(`      Tags: ${Colors.dim}${vm.tags}${Colors.reset}`);
            }
          }
          console.log();
        }
      }
      
    } catch (error) {
      spinner.fail('VM discovery failed');
      displayError(`${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

// Discover containers command
program
  .command('discover-containers')
  .description('Discover and list all containers from cluster')
  .option('-v, --verbose', 'show detailed container information')
  .option('-n, --node <node>', 'discover containers from specific node only')
  .action(async (options) => {
    try {
      console.log('📦 Discovering containers...');
      
      const config = loadProxmoxConfig();
      const client = new ProxmoxClient(config);
      
      let nodesToQuery = [];
      
      if (options.node) {
        nodesToQuery = [{ node: options.node }];
      } else {
        nodesToQuery = await client.getNodes();
      }
      
      let totalContainers = 0;
      
      for (const nodeInfo of nodesToQuery) {
        try {
          const containers = await client.getContainers(nodeInfo.node);
          totalContainers += containers.length;
          
          if (containers.length === 0) {
            console.log(`📍 ${nodeInfo.node}: No containers found`);
            continue;
          }
          
          console.log(`\n📍 ${nodeInfo.node} (${containers.length} containers):`);
          
          for (const container of containers) {
            console.log(`   📦 CT ${container.vmid}: ${container.name || 'unnamed'}`);
            console.log(`      Status: ${container.status}`);
            
            if (options.verbose) {
              console.log(`      CPU: ${container.cpu?.toFixed(2) || 'N/A'}% (${container.cpus || 'N/A'} cores)`);
              console.log(`      Memory: ${container.mem ? Math.round(container.mem / 1024 / 1024) : 'N/A'}MB / ${container.maxmem ? Math.round(container.maxmem / 1024 / 1024) : 'N/A'}MB`);
              if (container.uptime) {
                console.log(`      Uptime: ${Math.floor(container.uptime / 86400)} days`);
              }
              if (container.template) {
                console.log(`      Template: Yes`);
              }
              if (container.tags) {
                console.log(`      Tags: ${container.tags}`);
              }
            }
            console.log();
          }
        } catch (error) {
          console.error(`❌ Failed to get containers from node ${nodeInfo.node}:`);
          console.error(`   ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      
      console.log(`✅ Discovery complete. Found ${totalContainers} containers total.`);
      
    } catch (error) {
      console.error('❌ Failed to discover containers:');
      console.error(`   ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

// Discover storage command
program
  .command('discover-storage')
  .description('Discover and list all storage pools')
  .option('-v, --verbose', 'show detailed storage information')
  .action(async (options) => {
    try {
      console.log('💾 Discovering storage pools...');
      
      const config = loadProxmoxConfig();
      const client = new ProxmoxClient(config);
      
      const storagePools = await client.getStoragePools();
      
      console.log(`\n✅ Found ${storagePools.length} storage pool(s):\n`);
      
      for (const storage of storagePools) {
        console.log(`💾 ${storage.storage}`);
        console.log(`   Type: ${storage.type}`);
        console.log(`   Enabled: ${storage.enabled ? 'Yes' : 'No'}`);
        console.log(`   Shared: ${storage.shared ? 'Yes' : 'No'}`);
        
        if (storage.total && storage.used && storage.avail) {
          const totalGB = Math.round(storage.total / 1024 / 1024 / 1024);
          const usedGB = Math.round(storage.used / 1024 / 1024 / 1024);
          const availGB = Math.round(storage.avail / 1024 / 1024 / 1024);
          const usedPercent = Math.round((storage.used / storage.total) * 100);
          
          console.log(`   Usage: ${usedGB}GB / ${totalGB}GB (${usedPercent}%)`);
          console.log(`   Available: ${availGB}GB`);
        }
        
        if (options.verbose) {
          if (storage.content) {
            console.log(`   Content types: ${storage.content}`);
          }
          if (storage.nodes) {
            console.log(`   Available on nodes: ${storage.nodes}`);
          }
        }
        console.log();
      }
      
    } catch (error) {
      console.error('❌ Failed to discover storage:');
      console.error(`   ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

// Discover tasks command
program
  .command('discover-tasks')
  .description('Discover and list recent tasks from cluster')
  .option('-v, --verbose', 'show detailed task information')
  .option('-n, --node <node>', 'discover tasks from specific node only')
  .option('-l, --limit <number>', 'limit number of tasks shown per node', '10')
  .action(async (options) => {
    try {
      console.log('📋 Discovering tasks...');
      
      const config = loadProxmoxConfig();
      const client = new ProxmoxClient(config);
      
      let nodesToQuery = [];
      
      if (options.node) {
        nodesToQuery = [{ node: options.node }];
      } else {
        nodesToQuery = await client.getNodes();
      }
      
      let totalTasks = 0;
      const limit = parseInt(options.limit);
      
      for (const nodeInfo of nodesToQuery) {
        try {
          const tasks = await client.getTasks(nodeInfo.node);
          const limitedTasks = tasks.slice(0, limit);
          totalTasks += tasks.length;
          
          if (tasks.length === 0) {
            console.log(`📍 ${nodeInfo.node}: No recent tasks found`);
            continue;
          }
          
          console.log(`\n📍 ${nodeInfo.node} (showing ${limitedTasks.length} of ${tasks.length} tasks):`);
          
          for (const task of limitedTasks) {
            const startDate = new Date(task.starttime * 1000);
            const duration = task.endtime ? 
              `${Math.round((task.endtime - task.starttime))}s` : 
              'Running';
            
            console.log(`   📋 ${task.type} (${task.upid.split(':')[3]})`);
            console.log(`      Status: ${task.status}`);
            console.log(`      Started: ${startDate.toLocaleString()}`);
            console.log(`      Duration: ${duration}`);
            
            if (options.verbose) {
              console.log(`      User: ${task.user}`);
              console.log(`      PID: ${task.pid}`);
              if (task.id) {
                console.log(`      Resource ID: ${task.id}`);
              }
              if (task.exitstatus) {
                console.log(`      Exit status: ${task.exitstatus}`);
              }
              console.log(`      UPID: ${task.upid}`);
            }
            console.log();
          }
        } catch (error) {
          console.error(`❌ Failed to get tasks from node ${nodeInfo.node}:`);
          console.error(`   ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      
      console.log(`✅ Discovery complete. Found ${totalTasks} tasks total.`);
      
    } catch (error) {
      console.error('❌ Failed to discover tasks:');
      console.error(`   ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

// Discover all resources command
program
  .command('discover-all')
  .description('Discover all resources (nodes, VMs, containers, storage, tasks)')
  .option('-v, --verbose', 'show detailed information for all resources')
  .action(async (options) => {
    try {
      console.log('🔍 Discovering all Proxmox resources...\n');
      
      const config = loadProxmoxConfig();
      const client = new ProxmoxClient(config);
      
      // Get nodes first
      console.log('📍 Nodes:');
      const nodes = await client.getNodes();
      console.log(`   Found ${nodes.length} node(s)`);
      
      let totalVMs = 0;
      let totalContainers = 0;
      let totalTasks = 0;
      
      // Discover VMs and containers from each node
      for (const node of nodes) {
        try {
          const [vms, containers, tasks] = await Promise.all([
            client.getVMs(node.node),
            client.getContainers(node.node),
            client.getTasks(node.node)
          ]);
          
          totalVMs += vms.length;
          totalContainers += containers.length;
          totalTasks += tasks.length;
          
          if (options.verbose) {
            console.log(`   └─ ${node.node}: ${vms.length} VMs, ${containers.length} containers, ${tasks.length} tasks`);
          }
        } catch (error) {
          console.error(`   └─ ${node.node}: Error - ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      
      // Discover storage
      console.log('\n💾 Storage:');
      try {
        const storage = await client.getStoragePools();
        console.log(`   Found ${storage.length} storage pool(s)`);
        
        if (options.verbose) {
          storage.forEach(s => {
            const usage = s.total && s.used ? 
              ` (${Math.round((s.used / s.total) * 100)}% used)` : '';
            console.log(`   └─ ${s.storage} (${s.type})${usage}`);
          });
        }
      } catch (error) {
        console.error(`   Error discovering storage: ${error instanceof Error ? error.message : String(error)}`);
      }
      
      // Summary
      console.log('\n📊 Discovery Summary:');
      console.log(`   • Nodes: ${nodes.length}`);
      console.log(`   • VMs: ${totalVMs}`);
      console.log(`   • Containers: ${totalContainers}`);
      console.log(`   • Recent tasks: ${totalTasks}`);
      
      console.log('\n✅ Resource discovery complete!');
      console.log('\n💡 Use specific discovery commands for detailed information:');
      console.log('   • npm run cli discover-vms --verbose');
      console.log('   • npm run cli discover-containers --verbose');
      console.log('   • npm run cli discover-storage --verbose');
      console.log('   • npm run cli discover-tasks --verbose');
      
    } catch (error) {
      console.error('❌ Failed to discover resources:');
      console.error(`   ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

// VM management commands
const vmCommand = program
  .command('vm')
  .description('VM management operations');

// Batch VM operations
vmCommand
  .command('batch-start <vmids...>')
  .description('Start multiple VMs with progress tracking')
  .option('-n, --node <node>', 'Target node (defaults to config node)')
  .option('-v, --verbose', 'Show detailed output')
  .option('--wait', 'Wait for all VMs to start')
  .option('--continue-on-error', 'Continue if some VMs fail to start')
  .option('--dry-run', 'Show what would be started without actually starting')
  .addHelpText('after', `
Examples:
  $ proxmox-mpc vm batch-start 100 101 102              # Start multiple VMs
  $ proxmox-mpc vm batch-start 100 101 --wait           # Wait for completion
  $ proxmox-mpc vm batch-start 100 101 --dry-run        # Preview operation
  $ proxmox-mpc vm batch-start 100-105 --continue-on-error  # Continue despite failures

Features:
  • Progress tracking for each VM
  • Automatic validation before starting
  • Skips VMs that are already running
  • Optional waiting for completion
`)
  .action(async (vmids, options) => {
    const spinner = new Spinner();
    
    try {
      const vmidNums = vmids.map((vmid: string) => {
        const num = parseInt(vmid);
        if (isNaN(num)) {
          throw new Error(`Invalid VM ID: ${vmid}`);
        }
        return num;
      });
      
      const config = loadProxmoxConfig();
      const client = new ProxmoxClient(config);
      const targetNode = options.node || config.node;
      
      displayInfo(`Starting batch operation for ${vmidNums.length} VMs`);
      
      if (options.dryRun) {
        vmidNums.forEach((vmid: number) => {
          displayDryRun('start', `VM ${vmid} on node ${targetNode}`);
        });
        return;
      }
      
      const results = await processBatchOperation(
        vmidNums,
        async (vmid: number) => {
          // Validate VM first
          const validation = await validateVM(client, targetNode, vmid);
          if (!validation.valid) {
            throw new Error(`VM validation failed: ${validation.error}`);
          }
          
          const vm = validation.resource;
          if (vm.status === 'running') {
            console.log(`${Colors.dim}  VM ${vmid} is already running${Colors.reset}`);
            return;
          }
          
          await client.startVM(targetNode, vmid);
          
          if (options.wait) {
            await client.waitForVMStatus(targetNode, vmid, 'running');
          }
        },
        {
          itemName: (vmid: number) => `VM ${vmid}`,
          operationName: 'start',
          continueOnError: options.continueOnError
        }
      );
      
      if (results.failed > 0) {
        process.exit(1);
      }
      
    } catch (error) {
      displayError(`Batch start failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

vmCommand
  .command('batch-stop <vmids...>')
  .description('Stop multiple VMs')
  .option('-n, --node <node>', 'Target node (defaults to config node)')
  .option('-v, --verbose', 'Show detailed output')
  .option('--force', 'Force stop (hard shutdown)')
  .option('--wait', 'Wait for all VMs to stop')
  .option('--continue-on-error', 'Continue if some VMs fail to stop')
  .option('--dry-run', 'Show what would be stopped without actually stopping')
  .action(async (vmids, options) => {
    try {
      const vmidNums = vmids.map((vmid: string) => {
        const num = parseInt(vmid);
        if (isNaN(num)) {
          throw new Error(`Invalid VM ID: ${vmid}`);
        }
        return num;
      });
      
      const config = loadProxmoxConfig();
      const client = new ProxmoxClient(config);
      const targetNode = options.node || config.node;
      
      displayInfo(`Stopping batch operation for ${vmidNums.length} VMs`);
      
      if (options.dryRun) {
        vmidNums.forEach((vmid: number) => {
          displayDryRun(options.force ? 'force stop' : 'stop', `VM ${vmid} on node ${targetNode}`);
        });
        return;
      }
      
      const results = await processBatchOperation(
        vmidNums,
        async (vmid: number) => {
          // Validate VM first
          const validation = await validateVM(client, targetNode, vmid);
          if (!validation.valid) {
            throw new Error(`VM validation failed: ${validation.error}`);
          }
          
          const vm = validation.resource;
          if (vm.status === 'stopped') {
            console.log(`${Colors.dim}  VM ${vmid} is already stopped${Colors.reset}`);
            return;
          }
          
          await client.stopVM(targetNode, vmid, options.force);
          
          if (options.wait) {
            await client.waitForVMStatus(targetNode, vmid, 'stopped');
          }
        },
        {
          itemName: (vmid: number) => `VM ${vmid}`,
          operationName: options.force ? 'force stop' : 'stop',
          continueOnError: options.continueOnError
        }
      );
      
      if (results.failed > 0) {
        process.exit(1);
      }
      
    } catch (error) {
      displayError(`Batch stop failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

// VM create command
vmCommand
  .command('create')
  .description('Create a new VM')
  .requiredOption('--vmid <number>', 'VM ID (must be unique)', parseInt)
  .option('--name <name>', 'VM name')
  .option('--cores <number>', 'Number of CPU cores', parseInt)
  .option('--sockets <number>', 'Number of CPU sockets', parseInt)
  .option('--memory <mb>', 'Memory in MB', parseInt)
  .option('--ostype <type>', 'OS type (l26, win10, etc.)')
  .option('--storage <storage>', 'Default storage pool')
  .option('--template <template>', 'Clone from template')
  .option('--start', 'Start VM after creation')
  .option('--description <desc>', 'VM description')
  .option('-n, --node <node>', 'Target node (defaults to config node)')
  .option('-v, --verbose', 'Show detailed output')
  .option('--wait', 'Wait for creation to complete')
  .action(async (options) => {
    try {
      console.log('🖥️  Creating VM...');
      
      const config = loadProxmoxConfig();
      const client = new ProxmoxClient(config);
      
      // Use specified node or default from config
      const targetNode = options.node || config.node;
      
      if (options.verbose) {
        console.log('📋 VM Configuration:');
        console.log(`   VM ID: ${options.vmid}`);
        console.log(`   Node: ${targetNode}`);
        console.log(`   Name: ${options.name || 'unnamed'}`);
        console.log(`   Cores: ${options.cores || 'default'}`);
        console.log(`   Memory: ${options.memory ? options.memory + 'MB' : 'default'}`);
        console.log(`   OS Type: ${options.ostype || 'default'}`);
        console.log(`   Storage: ${options.storage || 'default'}`);
        if (options.template) {
          console.log(`   Template: ${options.template}`);
        }
        console.log();
      }
      
      // Build VM configuration
      const vmConfig: Record<string, any> = {
        vmid: options.vmid,
        name: options.name,
        cores: options.cores,
        sockets: options.sockets,
        memory: options.memory,
        ostype: options.ostype,
        storage: options.storage,
        template: options.template,
        start: options.start,
        description: options.description
      };
      
      // Remove undefined values
      Object.keys(vmConfig).forEach(key => {
        if (vmConfig[key] === undefined) {
          delete vmConfig[key];
        }
      });
      
      // Create the VM
      const result = await client.createVM(targetNode, vmConfig as VMCreateConfig);
      
      console.log('✅ VM creation initiated successfully!');
      console.log(`   VM ID: ${result.vmid}`);
      console.log(`   Node: ${result.node}`);
      console.log(`   Task ID: ${result.upid}`);
      console.log(`   Status: ${result.task.status}`);
      
      if (options.verbose) {
        console.log(`   User: ${result.task.user}`);
        console.log(`   Type: ${result.task.type}`);
        console.log(`   Started: ${new Date(result.task.starttime * 1000).toLocaleString()}`);
      }
      
      // Wait for completion if requested
      if (options.wait) {
        console.log('\n⏳ Waiting for VM creation to complete...');
        try {
          const vm = await client.waitForVMCreation(targetNode, options.vmid);
          console.log('✅ VM created successfully!');
          console.log(`   Status: ${vm.status}`);
          
          if (options.verbose) {
            console.log(`   CPU: ${vm.cpus || 'N/A'} cores`);
            console.log(`   Memory: ${vm.maxmem ? Math.round(vm.maxmem / 1024 / 1024) : 'N/A'}MB`);
          }
        } catch (error) {
          console.error('⚠️  VM creation may have completed, but status check failed:');
          console.error(`   ${error instanceof Error ? error.message : String(error)}`);
        }
      } else {
        console.log('\n💡 Use --wait flag to wait for completion, or check status with:');
        console.log(`   npm run cli discover-vms --node ${targetNode} --verbose`);
      }
      
    } catch (error) {
      console.error('❌ Failed to create VM:');
      console.error(`   ${error instanceof Error ? error.message : String(error)}`);
      
      if (options.verbose) {
        console.error('\n🔧 Common issues:');
        console.error('   • VM ID already exists');
        console.error('   • Insufficient resources on target node');
        console.error('   • Storage pool not available');
        console.error('   • Template not found (if using --template)');
      }
      
      process.exit(1);
    }
  });

// VM start command
vmCommand
  .command('start <vmid>')
  .description('Start a VM')
  .option('-n, --node <node>', 'Target node (defaults to config node)')
  .option('-v, --verbose', 'Show detailed output')
  .option('--wait', 'Wait for VM to start')
  .option('--dry-run', 'Show what would be started without actually starting')
  .action(async (vmid, options) => {
    const spinner = new Spinner();
    
    try {
      const vmidNum = parseInt(vmid);
      if (isNaN(vmidNum)) {
        throw new Error('VM ID must be a number');
      }
      
      const config = loadProxmoxConfig();
      const client = new ProxmoxClient(config);
      const targetNode = options.node || config.node;
      
      // Validate VM exists and get current state
      spinner.start('Validating VM...');
      const validation = await validateVM(client, targetNode, vmidNum);
      spinner.stop();
      
      if (!validation.valid) {
        displayError(`VM validation failed: ${validation.error}`);
        process.exit(1);
      }
      
      const vm = validation.resource;
      
      // Check if VM is already running
      if (vm.status === 'running') {
        displayInfo(`VM ${vmidNum} is already running`);
        return;
      }
      
      // Display warnings
      if (validation.warnings) {
        displayValidationWarnings(validation.warnings);
      }
      
      // Dry run mode
      if (options.dryRun) {
        displayDryRun('start', `VM ${vmidNum} (${vm.name || 'unnamed'}) on node ${targetNode}`);
        console.log(`${Colors.dim}Current Status: ${vm.status}${Colors.reset}`);
        return;
      }
      
      spinner.start(`Starting VM ${vmidNum}...`);
      const task = await client.startVM(targetNode, vmidNum);
      
      spinner.succeed(`VM ${vmidNum} start initiated successfully!`);
      displayInfo(`Task ID: ${task.upid}`);
      displayInfo(`Status: ${task.status}`);
      
      if (options.wait) {
        spinner.start('Waiting for VM to start...');
        try {
          const runningVm = await client.waitForVMStatus(targetNode, vmidNum, 'running');
          spinner.succeed('VM started successfully!');
          displayInfo(`Final Status: ${runningVm.status}`);
        } catch (error) {
          spinner.fail('Status check failed');
          displayError(
            'VM start may have completed, but status check failed',
            error instanceof Error ? error.message : String(error)
          );
        }
      }
      
    } catch (error) {
      spinner.fail('VM start failed');
      displayError(
        `Failed to start VM: ${error instanceof Error ? error.message : String(error)}`
      );
      process.exit(1);
    }
  });

// VM stop command
vmCommand
  .command('stop <vmid>')
  .description('Stop a VM')
  .option('-n, --node <node>', 'Target node (defaults to config node)')
  .option('-v, --verbose', 'Show detailed output')
  .option('--force', 'Force stop (hard shutdown)')
  .option('--wait', 'Wait for VM to stop')
  .action(async (vmid, options) => {
    try {
      const vmidNum = parseInt(vmid);
      if (isNaN(vmidNum)) {
        throw new Error('VM ID must be a number');
      }
      
      console.log(`🛑 ${options.force ? 'Force stopping' : 'Stopping'} VM ${vmidNum}...`);
      
      const config = loadProxmoxConfig();
      const client = new ProxmoxClient(config);
      const targetNode = options.node || config.node;
      
      const task = await client.stopVM(targetNode, vmidNum, options.force);
      
      console.log('✅ VM stop initiated successfully!');
      console.log(`   Task ID: ${task.upid}`);
      console.log(`   Status: ${task.status}`);
      
      if (options.wait) {
        console.log('\n⏳ Waiting for VM to stop...');
        try {
          const vm = await client.waitForVMStatus(targetNode, vmidNum, 'stopped');
          console.log('✅ VM stopped successfully!');
          console.log(`   Status: ${vm.status}`);
        } catch (error) {
          console.error('⚠️  VM stop may have completed, but status check failed:');
          console.error(`   ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      
    } catch (error) {
      console.error('❌ Failed to stop VM:');
      console.error(`   ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

// VM shutdown command (graceful)
vmCommand
  .command('shutdown <vmid>')
  .description('Gracefully shutdown a VM')
  .option('-n, --node <node>', 'Target node (defaults to config node)')
  .option('-v, --verbose', 'Show detailed output')
  .option('--wait', 'Wait for VM to shutdown')
  .action(async (vmid, options) => {
    try {
      const vmidNum = parseInt(vmid);
      if (isNaN(vmidNum)) {
        throw new Error('VM ID must be a number');
      }
      
      console.log(`🔄 Gracefully shutting down VM ${vmidNum}...`);
      
      const config = loadProxmoxConfig();
      const client = new ProxmoxClient(config);
      const targetNode = options.node || config.node;
      
      const task = await client.shutdownVM(targetNode, vmidNum);
      
      console.log('✅ VM shutdown initiated successfully!');
      console.log(`   Task ID: ${task.upid}`);
      console.log(`   Status: ${task.status}`);
      
      if (options.wait) {
        console.log('\n⏳ Waiting for VM to shutdown...');
        try {
          const vm = await client.waitForVMStatus(targetNode, vmidNum, 'stopped');
          console.log('✅ VM shutdown successfully!');
          console.log(`   Status: ${vm.status}`);
        } catch (error) {
          console.error('⚠️  VM shutdown may have completed, but status check failed:');
          console.error(`   ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      
    } catch (error) {
      console.error('❌ Failed to shutdown VM:');
      console.error(`   ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

// VM delete command
vmCommand
  .command('delete <vmid>')
  .description('Delete a VM with safety confirmation')
  .option('-n, --node <node>', 'Target node (defaults to config node)')
  .option('-v, --verbose', 'Show detailed output')
  .option('--confirm', 'Skip confirmation prompt')
  .option('--force', 'Force delete (skip locks)')
  .option('--purge-disks', 'Also delete unreferenced disks')
  .option('--dry-run', 'Show what would be deleted without actually deleting')
  .addHelpText('after', `
Examples:
  $ proxmox-mpc vm delete 100 --dry-run                 # Preview deletion
  $ proxmox-mpc vm delete 100                           # Interactive deletion with safety prompts
  $ proxmox-mpc vm delete 100 --confirm --purge-disks  # Skip prompts and delete disks
  $ proxmox-mpc vm delete 100 --force                   # Force delete even if locked

Safety: This command requires explicit confirmation unless --confirm is used.
Running VMs will prompt for additional confirmation before deletion.
`)
  .action(async (vmid, options) => {
    const spinner = new Spinner();
    
    try {
      const vmidNum = parseInt(vmid);
      if (isNaN(vmidNum)) {
        throw new Error('VM ID must be a number');
      }
      
      const config = loadProxmoxConfig();
      const client = new ProxmoxClient(config);
      const targetNode = options.node || config.node;
      
      // Validate VM exists and get current state
      spinner.start('Validating VM...');
      const validation = await validateVM(client, targetNode, vmidNum);
      spinner.stop();
      
      if (!validation.valid) {
        displayError(`VM validation failed: ${validation.error}`);
        process.exit(1);
      }
      
      const vm = validation.resource;
      
      // Display warnings
      if (validation.warnings) {
        displayValidationWarnings(validation.warnings);
      }
      
      // Dry run mode
      if (options.dryRun) {
        displayDryRun('delete', `VM ${vmidNum} (${vm.name || 'unnamed'}) on node ${targetNode}`);
        console.log(`${Colors.dim}VM Details:${Colors.reset}`);
        console.log(`   Status: ${vm.status}`);
        console.log(`   Memory: ${vm.maxmem ? Math.round(vm.maxmem / 1024 / 1024) : 'N/A'}MB`);
        console.log(`   CPU: ${vm.cpus || 'N/A'} cores`);
        if (vm.tags) console.log(`   Tags: ${vm.tags}`);
        
        if (options.purgeDisks) {
          console.log(`${Colors.yellow}Would also delete unreferenced disks${Colors.reset}`);
        }
        return;
      }
      
      // Safety confirmation unless --confirm is used
      if (!options.confirm) {
        const confirmed = await promptConfirmation(
          `Are you sure you want to DELETE VM ${vmidNum} (${vm.name || 'unnamed'}) on node ${targetNode}?`,
          {
            destructive: true,
            requireExplicitYes: true,
            warningMessage: 'This action cannot be undone and will permanently destroy the VM and its data!'
          }
        );
        
        if (!confirmed) {
          displayInfo('Operation cancelled by user');
          process.exit(0);
        }
      }
      
      // Additional confirmation for running VMs
      if (vm.status === 'running' && !options.confirm) {
        const runningConfirmed = await promptConfirmation(
          'VM is currently running. Delete anyway?',
          { requireExplicitYes: true }
        );
        
        if (!runningConfirmed) {
          displayInfo('Operation cancelled. Stop the VM first or use --force flag');
          process.exit(0);
        }
      }
      
      spinner.start(`Deleting VM ${vmidNum}...`);
      
      const deleteOptions = {
        force: options.force,
        destroyUnreferencedDisks: options.purgeDisks
      };
      
      const task = await client.deleteVM(targetNode, vmidNum, deleteOptions);
      
      spinner.succeed(`VM ${vmidNum} deletion initiated successfully!`);
      
      displayInfo(`Task ID: ${task.upid}`);
      displayInfo(`Status: ${task.status}`);
      
      if (options.verbose) {
        console.log(`${Colors.dim}Delete Options:${Colors.reset}`);
        console.log(`   Force: ${options.force ? 'Yes' : 'No'}`);
        console.log(`   Purge disks: ${options.purgeDisks ? 'Yes' : 'No'}`);
      }
      
    } catch (error) {
      spinner.fail('VM deletion failed');
      displayError(
        `Failed to delete VM: ${error instanceof Error ? error.message : String(error)}`,
        options.verbose ? 'Use --verbose for more details' : undefined
      );
      process.exit(1);
    }
  });

// Container management commands
const containerCommand = program
  .command('container')
  .description('Container (LXC) management operations');

// Container create command
containerCommand
  .command('create')
  .description('Create a new container')
  .requiredOption('--vmid <number>', 'Container ID (must be unique)', parseInt)
  .requiredOption('--ostemplate <template>', 'OS template (e.g., local:vztmpl/ubuntu-20.04-standard_20.04-1_amd64.tar.gz)')
  .option('--hostname <hostname>', 'Container hostname')
  .option('--cores <number>', 'Number of CPU cores', parseInt)
  .option('--memory <mb>', 'Memory in MB', parseInt)
  .option('--swap <mb>', 'Swap in MB', parseInt)
  .option('--rootfs <config>', 'Root filesystem configuration (e.g., local-lvm:8)')
  .option('--net0 <config>', 'Network configuration (e.g., name=eth0,bridge=vmbr0,ip=dhcp)')
  .option('--storage <storage>', 'Default storage pool')
  .option('--start', 'Start container after creation')
  .option('--description <desc>', 'Container description')
  .option('--unprivileged', 'Create as unprivileged container (default: true)')
  .option('--features <features>', 'Container features (e.g., nesting=1)')
  .option('--password <password>', 'Root password')
  .option('--ssh-keys <keys>', 'SSH public keys for root user')
  .option('--onboot', 'Start on boot')
  .option('--tags <tags>', 'Tags for container')
  .option('-n, --node <node>', 'Target node (defaults to config node)')
  .option('-v, --verbose', 'Show detailed output')
  .option('--wait', 'Wait for creation to complete')
  .action(async (options) => {
    try {
      console.log('📦 Creating container...');
      
      const config = loadProxmoxConfig();
      const client = new ProxmoxClient(config);
      
      // Use specified node or default from config
      const targetNode = options.node || config.node;
      
      if (options.verbose) {
        console.log('📋 Container Configuration:');
        console.log(`   Container ID: ${options.vmid}`);
        console.log(`   Node: ${targetNode}`);
        console.log(`   Hostname: ${options.hostname || 'auto-generated'}`);
        console.log(`   OS Template: ${options.ostemplate}`);
        console.log(`   Cores: ${options.cores || 'default'}`);
        console.log(`   Memory: ${options.memory ? options.memory + 'MB' : 'default'}`);
        console.log(`   Swap: ${options.swap ? options.swap + 'MB' : 'default'}`);
        console.log(`   Root FS: ${options.rootfs || 'default'}`);
        console.log(`   Network: ${options.net0 || 'default'}`);
        console.log(`   Storage: ${options.storage || 'default'}`);
        console.log(`   Unprivileged: ${options.unprivileged !== false ? 'Yes' : 'No'}`);
        if (options.features) {
          console.log(`   Features: ${options.features}`);
        }
        console.log();
      }
      
      // Build container configuration
      const containerConfig: Record<string, any> = {
        vmid: options.vmid,
        ostemplate: options.ostemplate,
        hostname: options.hostname,
        cores: options.cores,
        memory: options.memory,
        swap: options.swap,
        rootfs: options.rootfs,
        net0: options.net0,
        storage: options.storage,
        start: options.start,
        description: options.description,
        unprivileged: options.unprivileged !== false, // Default to true
        features: options.features,
        password: options.password,
        ssh_public_keys: options.sshKeys,
        onboot: options.onboot,
        tags: options.tags
      };
      
      // Remove undefined values
      Object.keys(containerConfig).forEach(key => {
        if (containerConfig[key] === undefined) {
          delete containerConfig[key];
        }
      });
      
      // Create the container
      const result = await client.createContainer(targetNode, containerConfig as ContainerCreateConfig);
      
      console.log('✅ Container creation initiated successfully!');
      console.log(`   Container ID: ${result.vmid}`);
      console.log(`   Node: ${result.node}`);
      console.log(`   Task ID: ${result.upid}`);
      console.log(`   Status: ${result.task.status}`);
      
      if (options.verbose) {
        console.log(`   User: ${result.task.user}`);
        console.log(`   Type: ${result.task.type}`);
        console.log(`   Started: ${new Date(result.task.starttime * 1000).toLocaleString()}`);
      }
      
      // Wait for completion if requested
      if (options.wait) {
        console.log('\n⏳ Waiting for container creation to complete...');
        try {
          const container = await client.waitForContainerCreation(targetNode, options.vmid);
          console.log('✅ Container created successfully!');
          console.log(`   Status: ${container.status}`);
          
          if (options.verbose) {
            console.log(`   CPU: ${container.cpus || 'N/A'} cores`);
            console.log(`   Memory: ${container.maxmem ? Math.round(container.maxmem / 1024 / 1024) : 'N/A'}MB`);
          }
        } catch (error) {
          console.error('⚠️  Container creation may have completed, but status check failed:');
          console.error(`   ${error instanceof Error ? error.message : String(error)}`);
        }
      } else {
        console.log('\n💡 Use --wait flag to wait for completion, or check status with:');
        console.log(`   npm run cli discover-containers --node ${targetNode} --verbose`);
      }
      
    } catch (error) {
      console.error('❌ Failed to create container:');
      console.error(`   ${error instanceof Error ? error.message : String(error)}`);
      
      if (options.verbose) {
        console.error('\n🔧 Common issues:');
        console.error('   • Container ID already exists');
        console.error('   • OS template not found or invalid path');
        console.error('   • Insufficient resources on target node');
        console.error('   • Storage pool not available');
        console.error('   • Network configuration invalid');
      }
      
      process.exit(1);
    }
  });

// Container start command
containerCommand
  .command('start <vmid>')
  .description('Start a container')
  .option('-n, --node <node>', 'Target node (defaults to config node)')
  .option('-v, --verbose', 'Show detailed output')
  .option('--wait', 'Wait for container to start')
  .action(async (vmid, options) => {
    try {
      const vmidNum = parseInt(vmid);
      if (isNaN(vmidNum)) {
        throw new Error('Container ID must be a number');
      }
      
      console.log(`🚀 Starting container ${vmidNum}...`);
      
      const config = loadProxmoxConfig();
      const client = new ProxmoxClient(config);
      const targetNode = options.node || config.node;
      
      const task = await client.startContainer(targetNode, vmidNum);
      
      console.log('✅ Container start initiated successfully!');
      console.log(`   Task ID: ${task.upid}`);
      console.log(`   Status: ${task.status}`);
      
      if (options.wait) {
        console.log('\n⏳ Waiting for container to start...');
        try {
          const container = await client.waitForContainerStatus(targetNode, vmidNum, 'running');
          console.log('✅ Container started successfully!');
          console.log(`   Status: ${container.status}`);
        } catch (error) {
          console.error('⚠️  Container start may have completed, but status check failed:');
          console.error(`   ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      
    } catch (error) {
      console.error('❌ Failed to start container:');
      console.error(`   ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

// Container stop command
containerCommand
  .command('stop <vmid>')
  .description('Stop a container')
  .option('-n, --node <node>', 'Target node (defaults to config node)')
  .option('-v, --verbose', 'Show detailed output')
  .option('--force', 'Force stop (hard shutdown)')
  .option('--wait', 'Wait for container to stop')
  .action(async (vmid, options) => {
    try {
      const vmidNum = parseInt(vmid);
      if (isNaN(vmidNum)) {
        throw new Error('Container ID must be a number');
      }
      
      console.log(`🛑 ${options.force ? 'Force stopping' : 'Stopping'} container ${vmidNum}...`);
      
      const config = loadProxmoxConfig();
      const client = new ProxmoxClient(config);
      const targetNode = options.node || config.node;
      
      const task = await client.stopContainer(targetNode, vmidNum, options.force);
      
      console.log('✅ Container stop initiated successfully!');
      console.log(`   Task ID: ${task.upid}`);
      console.log(`   Status: ${task.status}`);
      
      if (options.wait) {
        console.log('\n⏳ Waiting for container to stop...');
        try {
          const container = await client.waitForContainerStatus(targetNode, vmidNum, 'stopped');
          console.log('✅ Container stopped successfully!');
          console.log(`   Status: ${container.status}`);
        } catch (error) {
          console.error('⚠️  Container stop may have completed, but status check failed:');
          console.error(`   ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      
    } catch (error) {
      console.error('❌ Failed to stop container:');
      console.error(`   ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

// Container shutdown command (graceful)
containerCommand
  .command('shutdown <vmid>')
  .description('Gracefully shutdown a container')
  .option('-n, --node <node>', 'Target node (defaults to config node)')
  .option('-v, --verbose', 'Show detailed output')
  .option('--wait', 'Wait for container to shutdown')
  .action(async (vmid, options) => {
    try {
      const vmidNum = parseInt(vmid);
      if (isNaN(vmidNum)) {
        throw new Error('Container ID must be a number');
      }
      
      console.log(`🔄 Gracefully shutting down container ${vmidNum}...`);
      
      const config = loadProxmoxConfig();
      const client = new ProxmoxClient(config);
      const targetNode = options.node || config.node;
      
      const task = await client.shutdownContainer(targetNode, vmidNum);
      
      console.log('✅ Container shutdown initiated successfully!');
      console.log(`   Task ID: ${task.upid}`);
      console.log(`   Status: ${task.status}`);
      
      if (options.wait) {
        console.log('\n⏳ Waiting for container to shutdown...');
        try {
          const container = await client.waitForContainerStatus(targetNode, vmidNum, 'stopped');
          console.log('✅ Container shutdown successfully!');
          console.log(`   Status: ${container.status}`);
        } catch (error) {
          console.error('⚠️  Container shutdown may have completed, but status check failed:');
          console.error(`   ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      
    } catch (error) {
      console.error('❌ Failed to shutdown container:');
      console.error(`   ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

// Container reboot command
containerCommand
  .command('reboot <vmid>')
  .description('Reboot a container')
  .option('-n, --node <node>', 'Target node (defaults to config node)')
  .option('-v, --verbose', 'Show detailed output')
  .option('--wait', 'Wait for container to reboot')
  .action(async (vmid, options) => {
    try {
      const vmidNum = parseInt(vmid);
      if (isNaN(vmidNum)) {
        throw new Error('Container ID must be a number');
      }
      
      console.log(`🔄 Rebooting container ${vmidNum}...`);
      
      const config = loadProxmoxConfig();
      const client = new ProxmoxClient(config);
      const targetNode = options.node || config.node;
      
      const task = await client.rebootContainer(targetNode, vmidNum);
      
      console.log('✅ Container reboot initiated successfully!');
      console.log(`   Task ID: ${task.upid}`);
      console.log(`   Status: ${task.status}`);
      
      if (options.wait) {
        console.log('\n⏳ Waiting for container to reboot...');
        try {
          // Wait a moment for the reboot to actually start
          await new Promise(resolve => setTimeout(resolve, 5000));
          const container = await client.waitForContainerStatus(targetNode, vmidNum, 'running');
          console.log('✅ Container rebooted successfully!');
          console.log(`   Status: ${container.status}`);
        } catch (error) {
          console.error('⚠️  Container reboot may have completed, but status check failed:');
          console.error(`   ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      
    } catch (error) {
      console.error('❌ Failed to reboot container:');
      console.error(`   ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

// Container delete command
containerCommand
  .command('delete <vmid>')
  .description('Delete a container')
  .option('-n, --node <node>', 'Target node (defaults to config node)')
  .option('-v, --verbose', 'Show detailed output')
  .option('--confirm', 'Skip confirmation prompt')
  .option('--force', 'Force delete (skip locks)')
  .option('--purge', 'Remove container from all related configurations')
  .option('--dry-run', 'Show what would be deleted without actually deleting')
  .action(async (vmid, options) => {
    const spinner = new Spinner();
    
    try {
      const vmidNum = parseInt(vmid);
      if (isNaN(vmidNum)) {
        throw new Error('Container ID must be a number');
      }
      
      const config = loadProxmoxConfig();
      const client = new ProxmoxClient(config);
      const targetNode = options.node || config.node;
      
      // Validate container exists and get current state
      spinner.start('Validating container...');
      const validation = await validateContainer(client, targetNode, vmidNum);
      spinner.stop();
      
      if (!validation.valid) {
        displayError(`Container validation failed: ${validation.error}`);
        process.exit(1);
      }
      
      const container = validation.resource;
      
      // Display warnings
      if (validation.warnings) {
        displayValidationWarnings(validation.warnings);
      }
      
      // Dry run mode
      if (options.dryRun) {
        displayDryRun('delete', `Container ${vmidNum} (${container.name || 'unnamed'}) on node ${targetNode}`);
        console.log(`${Colors.dim}Container Details:${Colors.reset}`);
        console.log(`   Status: ${container.status}`);
        console.log(`   Memory: ${container.maxmem ? Math.round(container.maxmem / 1024 / 1024) : 'N/A'}MB`);
        console.log(`   CPU: ${container.cpus || 'N/A'} cores`);
        if (container.tags) console.log(`   Tags: ${container.tags}`);
        
        if (options.purge) {
          console.log(`${Colors.yellow}Would also purge from all related configurations${Colors.reset}`);
        }
        return;
      }
      
      // Safety confirmation unless --confirm is used
      if (!options.confirm) {
        const confirmed = await promptConfirmation(
          `Are you sure you want to DELETE container ${vmidNum} (${container.name || 'unnamed'}) on node ${targetNode}?`,
          {
            destructive: true,
            requireExplicitYes: true,
            warningMessage: 'This action cannot be undone and will permanently destroy the container and its data!'
          }
        );
        
        if (!confirmed) {
          displayInfo('Operation cancelled by user');
          process.exit(0);
        }
      }
      
      // Additional confirmation for running containers
      if (container.status === 'running' && !options.confirm) {
        const runningConfirmed = await promptConfirmation(
          'Container is currently running. Delete anyway?',
          { requireExplicitYes: true }
        );
        
        if (!runningConfirmed) {
          displayInfo('Operation cancelled. Stop the container first or use --force flag');
          process.exit(0);
        }
      }
      
      spinner.start(`Deleting container ${vmidNum}...`);
      
      const deleteOptions = {
        force: options.force,
        purge: options.purge
      };
      
      const task = await client.deleteContainer(targetNode, vmidNum, deleteOptions);
      
      spinner.succeed(`Container ${vmidNum} deletion initiated successfully!`);
      
      displayInfo(`Task ID: ${task.upid}`);
      displayInfo(`Status: ${task.status}`);
      
      if (options.verbose) {
        console.log(`${Colors.dim}Delete Options:${Colors.reset}`);
        console.log(`   Force: ${options.force ? 'Yes' : 'No'}`);
        console.log(`   Purge: ${options.purge ? 'Yes' : 'No'}`);
      }
      
    } catch (error) {
      spinner.fail('Container deletion failed');
      displayError(
        `Failed to delete container: ${error instanceof Error ? error.message : String(error)}`,
        options.verbose ? 'Use --verbose for more details' : undefined
      );
      process.exit(1);
    }
  });

program.parse();