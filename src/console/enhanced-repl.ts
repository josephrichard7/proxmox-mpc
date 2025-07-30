/**
 * Enhanced REPL for Proxmox-MPC Interactive Console
 * Provides command history, auto-completion, and session management
 */

import * as readline from 'readline';
import { SlashCommandRegistry } from './commands';
import { ProjectWorkspace } from '../workspace';
import { CommandHistory } from './history';
import { TabCompletion } from './completion';
import { SessionManager, SessionState } from './session';

// Re-export types for backward compatibility
export type { SessionState as ConsoleSession } from './session';

export class EnhancedInteractiveConsole {
  private rl!: readline.Interface;
  private commands: SlashCommandRegistry;
  private history: CommandHistory;
  private completion: TabCompletion;
  private sessionManager: SessionManager;
  private isRunning: boolean = false;

  constructor() {
    this.commands = new SlashCommandRegistry();
    this.history = new CommandHistory();
    this.sessionManager = new SessionManager();
    
    this.completion = new TabCompletion({
      workspace: null,
      history: this.history,
      commands: this.commands,
    });

    this.setupReadline();
  }

  private setupReadline(): void {
    const session = this.sessionManager.getCurrentSession();
    
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: session.preferences.prompt,
      historySize: session.preferences.historySize,
      completer: (line: string) => this.completion.complete(line),
    });

    // Load command history into readline
    const historyEntries = this.history.getSimpleHistory();
    if (historyEntries.length > 0) {
      // @ts-ignore - accessing private property for history initialization
      this.rl.history = [...historyEntries].reverse();
    }

    this.setupEventHandlers();
  }


  private setupEventHandlers(): void {
    this.rl.on('line', async (input: string) => {
      await this.handleInput(input.trim());
    });

    this.rl.on('close', () => {
      this.handleExit();
    });

    this.rl.on('SIGINT', () => {
      console.log('\n👋 Use "exit" or Ctrl+D to quit');
      this.rl.prompt();
    });

    // Note: History is automatically managed by the CommandHistory class
  }

  private async handleInput(input: string): Promise<void> {
    if (!input) {
      this.rl.prompt();
      return;
    }

    const session = this.sessionManager.getCurrentSession();
    let success = true;

    try {
      if (input.startsWith('/')) {
        await this.handleSlashCommand(input);
      } else {
        await this.handleResourceCommand(input);
      }
    } catch (error) {
      success = false;
      console.log(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Record command in history and session
    this.history.add(
      input, 
      session.workspace?.name, 
      success ? 0 : 1
    );
    this.sessionManager.recordCommand(input, success);

    this.rl.prompt();
  }

  private async handleSlashCommand(input: string): Promise<void> {
    const parts = input.slice(1).split(' ');
    const command = parts[0];
    const args = parts.slice(1);

    if (this.commands.has(command)) {
      const session = this.sessionManager.getCurrentSession();
      // Create adapter for backward compatibility
      const legacySession = {
        workspace: session.workspace ? {
          name: session.workspace.name,
          rootPath: session.workspace.path,
        } : null,
        history: this.history.getSimpleHistory(),
        startTime: session.startTime,
        preferences: session.preferences,
        context: session.context,
      };
      await this.commands.execute(command, args, legacySession as any);
    } else {
      console.log(`🚧 Slash command not yet implemented: /${command}`);
      console.log('   Type "/help" for available commands');
    }
  }

  private async handleResourceCommand(input: string): Promise<void> {
    const parts = input.split(' ');
    const action = parts[0];
    
    switch (action) {
      case 'create':
      case 'delete':
      case 'update':
      case 'list':
      case 'describe':
        console.log(`🚧 Resource command not yet implemented: ${input}`);
        console.log('   Natural language command parser coming soon!');
        break;
      
      case 'help':
        const session = this.sessionManager.getCurrentSession();
        const legacySession = {
          workspace: session.workspace ? {
            name: session.workspace.name,
            rootPath: session.workspace.path,
          } : null,
          history: this.history.getSimpleHistory(),
          startTime: session.startTime,
          preferences: session.preferences,
          context: session.context,
        };
        await this.commands.execute('help', [], legacySession as any);
        break;
        
      case 'exit':
      case 'quit':
        this.handleExit();
        break;
        
      default:
        console.log(`🚧 Command not yet implemented: ${action}`);
        console.log('   Type "help" for available commands');
        break;
    }
  }

  private handleExit(): void {
    this.history.save();
    
    const summary = this.sessionManager.getSessionSummary();
    const minutes = Math.round(summary.duration / 60);
    
    console.log('\n👋 Session Summary:');
    console.log(`   Commands executed: ${summary.commands}`);
    console.log(`   Success rate: ${summary.successRate}%`);
    console.log(`   Session duration: ${minutes} minutes`);
    if (summary.workspace) {
      console.log(`   Workspace: ${summary.workspace}`);
    }
    console.log('   Goodbye!');
    
    this.sessionManager.cleanup();
    process.exit(0);
  }


  public async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }
    
    this.isRunning = true;
    const session = this.sessionManager.getCurrentSession();
    
    // Display welcome message
    console.log('🔧 Proxmox Infrastructure Console v0.2.0');
    console.log('Enhanced interactive console with history and auto-completion\n');
    
    // Show session info
    console.log(`📁 Working directory: ${session.context.currentPath}`);
    if (session.workspace) {
      console.log(`🏗️  Project workspace: ${session.workspace.name}`);
    } else {
      console.log('💡 Tip: Use "/init" to initialize a project workspace');
    }
    
    // Show recent workspaces if any
    const recentWorkspaces = this.sessionManager.getRecentWorkspaces(3);
    if (recentWorkspaces.length > 0) {
      console.log(`🕒 Recent workspaces: ${recentWorkspaces.map(w => w.name).join(', ')}`);
    }
    
    console.log('💬 Use Tab for auto-completion, ↑↓ for history navigation\n');
    
    this.rl.prompt();
  }

  public stop(): void {
    if (this.isRunning) {
      this.isRunning = false;
      this.rl.close();
    }
  }

  // Public getters for testing and external access
  public getSession(): SessionState {
    return this.sessionManager.getCurrentSession();
  }

  public getCommands(): SlashCommandRegistry {
    return this.commands;
  }

  public getHistory(): CommandHistory {
    return this.history;
  }

  public setWorkspace(workspace: ProjectWorkspace | null): void {
    this.sessionManager.updateWorkspace(workspace);
    
    // Update completion context
    this.completion.updateContext({ workspace });
    
    // Update prompt to show workspace
    const session = this.sessionManager.getCurrentSession();
    if (workspace) {
      const prompt = `proxmox-mpc:${workspace.name}> `;
      this.sessionManager.updatePreferences({ prompt });
      this.rl.setPrompt(prompt);
    } else {
      const prompt = 'proxmox-mpc> ';
      this.sessionManager.updatePreferences({ prompt });
      this.rl.setPrompt(prompt);
    }
  }
}