#!/usr/bin/env node

/**
 * Proxmox-MPC Interactive Console
 * Main entry point for the Claude Code-like interactive console
 */

import { InteractiveConsole } from './console/repl';
import { Logger } from './observability/logger';

async function main() {
  const logger = Logger.getInstance();
  
  try {
    const console = new InteractiveConsole();
    await console.start();
  } catch (error) {
    logger.error('Failed to start interactive console', error as Error, {
      workspace: 'startup',
      resourcesAffected: ['console']
    }, ['Check configuration', 'Verify permissions', 'Check dependencies']);
    
    // Still show user-friendly message
    console.error('❌ Failed to start interactive console:');
    console.error(`   ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  const logger = Logger.getInstance();
  logger.error('Unhandled promise rejection', reason as Error, {
    workspace: 'global',
    resourcesAffected: ['process']
  }, ['Check async code', 'Add proper error handling']);
  
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  const logger = Logger.getInstance();
  logger.error('Uncaught exception in main process', error, {
    workspace: 'global',
    resourcesAffected: ['process']
  }, ['Check code for unhandled errors', 'Review recent changes']);
  
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

if (require.main === module) {
  main();
}