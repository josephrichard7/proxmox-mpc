#!/usr/bin/env node

/**
 * CLI entry point for Proxmox-MPC
 */

import { Command } from 'commander';

const program = new Command();

program
  .name('proxmox-mpc')
  .description('Proxmox Management and Control with natural language support')
  .version('0.1.0');

// Connection test command - our first minimal feature
program
  .command('test-connection')
  .description('Test connection to Proxmox server')
  .action(async () => {
    console.log('Testing Proxmox connection...');
    console.log('Connection test not implemented yet');
    process.exit(1);
  });

program.parse();