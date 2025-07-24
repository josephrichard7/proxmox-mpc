#!/usr/bin/env node

/**
 * CLI entry point for Proxmox-MPC
 */

import { Command } from 'commander';
import { ProxmoxClient, loadProxmoxConfig, validateConfig, sanitizeConfig } from '../api';

const program = new Command();

program
  .name('proxmox-mpc')
  .description('Proxmox Management and Control with natural language support')
  .version('0.1.0');

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
  .action(async (options) => {
    try {
      console.log('🖥️  Fetching cluster nodes...');
      
      const config = loadProxmoxConfig();
      const client = new ProxmoxClient(config);
      
      const nodes = await client.getNodes();
      
      console.log(`✅ Found ${nodes.length} node(s):\n`);
      
      nodes.forEach(node => {
        console.log(`📍 ${node.node}`);
        console.log(`   Status: ${node.status}`);
        console.log(`   CPU: ${node.cpu}/${node.maxcpu}`);
        console.log(`   Memory: ${Math.round(node.mem / 1024 / 1024)}MB/${Math.round(node.maxmem / 1024 / 1024)}MB`);
        
        if (options.verbose) {
          console.log(`   Uptime: ${Math.floor(node.uptime / 86400)} days`);
        }
        console.log();
      });
      
    } catch (error) {
      console.error('❌ Failed to list nodes:');
      console.error(`   ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

// Discover VMs command
program
  .command('discover-vms')
  .description('Discover and list all VMs from cluster')
  .option('-v, --verbose', 'show detailed VM information')
  .option('-n, --node <node>', 'discover VMs from specific node only')
  .action(async (options) => {
    try {
      console.log('🖥️  Discovering VMs...');
      
      const config = loadProxmoxConfig();
      const client = new ProxmoxClient(config);
      
      let nodesToQuery = [];
      
      if (options.node) {
        nodesToQuery = [{ node: options.node }];
      } else {
        nodesToQuery = await client.getNodes();
      }
      
      let totalVMs = 0;
      
      for (const nodeInfo of nodesToQuery) {
        try {
          const vms = await client.getVMs(nodeInfo.node);
          totalVMs += vms.length;
          
          if (vms.length === 0) {
            console.log(`📍 ${nodeInfo.node}: No VMs found`);
            continue;
          }
          
          console.log(`\n📍 ${nodeInfo.node} (${vms.length} VMs):`);
          
          for (const vm of vms) {
            console.log(`   🖥️  VM ${vm.vmid}: ${vm.name || 'unnamed'}`);
            console.log(`      Status: ${vm.status}`);
            
            if (options.verbose) {
              console.log(`      CPU: ${vm.cpu?.toFixed(2) || 'N/A'}% (${vm.cpus || 'N/A'} cores)`);
              console.log(`      Memory: ${vm.mem ? Math.round(vm.mem / 1024 / 1024) : 'N/A'}MB / ${vm.maxmem ? Math.round(vm.maxmem / 1024 / 1024) : 'N/A'}MB`);
              if (vm.uptime) {
                console.log(`      Uptime: ${Math.floor(vm.uptime / 86400)} days`);
              }
              if (vm.template) {
                console.log(`      Template: Yes`);
              }
              if (vm.tags) {
                console.log(`      Tags: ${vm.tags}`);
              }
            }
            console.log();
          }
        } catch (error) {
          console.error(`❌ Failed to get VMs from node ${nodeInfo.node}:`);
          console.error(`   ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      
      console.log(`✅ Discovery complete. Found ${totalVMs} VMs total.`);
      
    } catch (error) {
      console.error('❌ Failed to discover VMs:');
      console.error(`   ${error instanceof Error ? error.message : String(error)}`);
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

program.parse();