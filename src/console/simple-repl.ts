#!/usr/bin/env node

/**
 * Simple Interactive Console for Testing
 * Basic REPL to test the interactive console concept
 */

import * as readline from 'readline';

export class SimpleInteractiveConsole {
  private rl: readline.Interface;
  private isRunning: boolean = false;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: 'proxmox-mpc> ',
      historySize: 1000,
    });

    this.setupEventHandlers();
  }

  async start(): Promise<void> {
    this.isRunning = true;
    this.displayWelcome();
    this.rl.prompt();
  }

  stop(): void {
    this.isRunning = false;
    this.rl.close();
  }

  private setupEventHandlers(): void {
    this.rl.on('line', async (input: string) => {
      await this.handleInput(input.trim());
      if (this.isRunning) {
        this.rl.prompt();
      }
    });

    this.rl.on('close', () => {
      console.log('\n👋 Goodbye!');
      process.exit(0);
    });

    this.rl.on('SIGINT', () => {
      console.log('\n👋 Goodbye!');
      process.exit(0);
    });
  }

  private async handleInput(input: string): Promise<void> {
    if (!input) return;

    if (input === 'help' || input === '/help') {
      this.displayHelp();
    } else if (input === 'exit' || input === 'quit' || input === '/exit') {
      this.stop();
    } else if (input.startsWith('/')) {
      const command = input.slice(1);
      console.log(`🚧 Slash command not yet implemented: /${command}`);
    } else {
      console.log(`🚧 Command not yet implemented: ${input}`);
      console.log('   Type "help" for available commands');
    }
  }

  private displayWelcome(): void {
    console.log('🔧 Proxmox Infrastructure Console v0.1.0');
    console.log('Welcome! This is a basic test version of the interactive console.\n');
    console.log('💡 Available commands: help, /help, exit, quit, /exit\n');
  }

  private displayHelp(): void {
    console.log('\n📚 Simple Console Commands:\n');
    console.log('  help, /help          Show this help message');
    console.log('  exit, quit, /exit    Exit the console');
    console.log('  Ctrl+C               Exit console\n');
    console.log('🚧 This is a basic test version. More features coming soon!\n');
  }
}

async function main() {
  try {
    const console = new SimpleInteractiveConsole();
    await console.start();
  } catch (error) {
    console.error('❌ Failed to start console:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}