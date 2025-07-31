#!/usr/bin/env node

/**
 * Proxmox-MPC Interactive Console
 * Main entry point for the Claude Code-like interactive console
 */

import { InteractiveConsole } from './console/repl';

async function main() {
  try {
    const console = new InteractiveConsole();
    await console.start();
  } catch (error) {
    console.error('❌ Failed to start interactive console:');
    console.error(`   ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

if (require.main === module) {
  main();
}