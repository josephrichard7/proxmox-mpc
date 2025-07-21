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

program.parse();