/**
 * Interactive Console REPL Interface
 * Provides Claude Code-like interactive experience for infrastructure management
 */

import * as readline from 'readline';

import { ProxmoxClient } from '../api';
import { ProjectWorkspace } from '../workspace';
import { getDisplayVersion } from '../utils/version';

import { SlashCommandRegistry } from './commands';
import { ResourceCommand } from './commands/resource';
import { SessionManager } from './session';

// Interface expected by console commands
export interface ConsoleSession {
  workspace?: ProjectWorkspace;
  client?: ProxmoxClient;
  rl: readline.Interface;
  history: string[];
  startTime: Date;
}

export class InteractiveConsole {
  private rl: readline.Interface;
  private session: SessionManager;
  private commandRegistry: SlashCommandRegistry;
  private resourceCommand: ResourceCommand;
  private isRunning: boolean = false;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: 'proxmox-mpc> ',
      historySize: 1000,
    });

    this.session = new SessionManager();

    this.commandRegistry = new SlashCommandRegistry();
    this.resourceCommand = new ResourceCommand();
    this.setupEventHandlers();
  }

  /**
   * Get the session interface expected by console commands
   */
  private getConsoleSession(): ConsoleSession {
    return {
      workspace: this.session.workspace || undefined,
      client: undefined, // TODO: Set when client is connected
      rl: this.rl,
      history: this.session.history,
      startTime: this.session.startTime,
    };
  }

  /**
   * Start the interactive console
   */
  async start(): Promise<void> {
    this.isRunning = true;
    this.displayWelcome();
    
    // Check if we're in an existing workspace
    await this.detectWorkspace();
    
    this.rl.prompt();
  }

  /**
   * Stop the interactive console
   */
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
      this.displayGoodbye();
      process.exit(0);
    });

    // Handle Ctrl+C
    this.rl.on('SIGINT', () => {
      console.log('\n\n👋 Goodbye!');
      process.exit(0);
    });
  }

  private async handleInput(input: string): Promise<void> {
    if (!input) return;

    // Add to history
    this.session.history.push(input);

    try {
      if (input.startsWith('/')) {
        // Handle slash commands
        await this.handleSlashCommand(input);
      } else if (input.startsWith('create ') || input.startsWith('delete ') || 
                 input.startsWith('list ') || input.startsWith('describe ')) {
        // Handle resource commands
        await this.handleResourceCommand(input);
      } else if (input === 'help') {
        this.displayHelp();
      } else if (input === 'exit' || input === 'quit') {
        this.stop();
      } else {
        console.log(`Unknown command: ${input}`);
        console.log('Type "help" or "/help" for available commands');
      }
    } catch (error) {
      console.error(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async handleSlashCommand(input: string): Promise<void> {
    const [command, ...args] = input.slice(1).split(' ');
    
    if (this.commandRegistry.has(command)) {
      await this.commandRegistry.execute(command, args, this.getConsoleSession());
    } else {
      console.log(`❌ Unknown slash command: /${command}`);
      console.log('Available slash commands: /help, /init, /status, /exit');
    }
  }

  private async handleResourceCommand(input: string): Promise<void> {
    await this.resourceCommand.execute(input, this.getConsoleSession());
  }

  private async detectWorkspace(): Promise<void> {
    try {
      const workspace = await ProjectWorkspace.detect(process.cwd());
      if (workspace) {
        this.session.updateWorkspace(workspace);
        console.log(`📁 Workspace detected: ${workspace.name}`);
        console.log(`   Server: ${workspace.config.host}`);
        console.log(`   Node: ${workspace.config.node}`);
      }
    } catch (error) {
      // No workspace detected, that's fine
    }
  }

  private displayWelcome(): void {
    console.log(`🔧 Proxmox Infrastructure Console ${getDisplayVersion()}`);
    console.log('Welcome! Type /help for commands or /init to get started.\n');
    
    if (!this.session.workspace) {
      console.log('💡 Tip: Use /init to initialize a new Proxmox project workspace');
      console.log('   or navigate to an existing project directory\n');
    }
  }

  private displayHelp(): void {
    console.log('\n📚 Available Commands:\n');
    
    console.log('🔧 Slash Commands:');
    console.log('  /help                 Show this help message');
    console.log('  /init                 Initialize new project workspace');
    console.log('  /status               Show project and server status');
    console.log('  /sync                 Import existing infrastructure as IaC');
    console.log('  /exit                 Exit the console\n');
    
    console.log('🏗️  Resource Commands:');
    console.log('  create vm --name <name>     Generate VM configuration');
    console.log('  create container --name <name>  Generate container configuration');
    console.log('  list vms                    Show VMs from workspace');
    console.log('  list containers             Show containers from workspace');
    console.log('  describe vm <id|name>       Show VM details');
    console.log('  describe container <id|name> Show container details\n');
    
    console.log('⌨️  Shortcuts:');
    console.log('  help, exit, quit            Alternative commands');
    console.log('  Ctrl+C                      Exit console');
    console.log('  Up/Down arrows             Command history\n');
  }

  private displayGoodbye(): void {
    const summary = this.session.getSessionSummary();
    console.log(`\n👋 Session ended (${summary.duration}s)`);
    console.log('Thank you for using Proxmox-MPC!');
  }
}