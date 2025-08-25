/**
 * Init Command
 * Initializes a new Proxmox project workspace
 */

import * as path from 'path';
import * as readline from 'readline';

import { BaseCommand, CommandMetadata } from './base-command';
import { errorHandler } from '../error-handler';
import { ConsoleSession } from '../repl';
import { ConfigManager, WorkspaceConfig } from '../../config';
import { ProjectWorkspace } from '../../workspace';

export class InitCommand extends BaseCommand {
  getMetadata(): CommandMetadata {
    return {
      name: 'init',
      description: 'Initialize a new Proxmox project workspace',
      usage: '/init',
      examples: [
        '/init - Initialize workspace with interactive setup',
      ],
      requiresWorkspace: false,
      requiresConnection: false
    };
  }

  async execute(args: string[], session: ConsoleSession): Promise<void> {
    console.log('🏗️  Initializing new Proxmox project workspace...\n');

    // Check if already in a workspace
    try {
      const existing = await ProjectWorkspace.detect(process.cwd());
      if (existing) {
        errorHandler.handleError({
          code: 'WORKSPACE_EXISTS',
          message: 'Already in a Proxmox workspace!',
          severity: 'medium',
          context: {
            command: 'init',
            workspace: existing.name,
            suggestions: [
              'Navigate to a different directory to create a new workspace',
              'Use /status to view current workspace details'
            ],
            details: { 
              project: existing.name,
              configPath: existing.configPath
            }
          }
        });
        return;
      }
    } catch (error) {
      // No existing workspace, continue with initialization
    }

    try {
      // Create workspace with interactive configuration
      const workspace = await this.createWorkspaceInteractively(session);
      
      // Update session
      session.workspace = workspace;
      
      errorHandler.showSuccess(
        'Project workspace initialized successfully!',
        [
          `📁 Project: ${workspace.name}`,
          `🗄️  Database: ${workspace.databasePath}`,
          `⚙️  Config: ${workspace.configPath}`,
          '',
          '🎯 Next steps:',
          '• Use /status to check server connectivity',
          '• Use /sync to import existing infrastructure',
          '• Start creating resources with "create vm --name <name>"'
        ]
      );
      
    } catch (error) {
      errorHandler.handleError({
        code: 'WORKSPACE_INIT_FAILED',
        message: 'Failed to initialize workspace',
        severity: 'high',
        originalError: error as Error,
        context: {
          command: 'init',
          operation: 'workspace_creation',
          suggestions: [
            'Check directory permissions for write access',
            'Ensure sufficient disk space is available',
            'Verify the directory is not read-only'
          ]
        }
      });
    }
  }

  private async createWorkspaceInteractively(session: ConsoleSession): Promise<ProjectWorkspace> {
    console.log('📋 Please provide your Proxmox server details:\n');

    try {
      // Use the existing readline interface from the session
      const rl = session.rl;
      
      const host = await this.prompt(rl, '🌐 Proxmox host (e.g., 192.168.1.100): ');
      const port = await this.prompt(rl, '🔌 Port [8006]: ') || '8006';
      const username = await this.prompt(rl, '👤 Username [root@pam]: ') || 'root@pam';
      const tokenId = await this.prompt(rl, '🔑 Token ID: ');
      const tokenSecret = await this.promptPassword(rl, '🔐 Token Secret: ');
      const node = await this.prompt(rl, '🖥️  Default node [pve]: ') || 'pve';
      const skipTLS = await this.prompt(rl, '🔒 Skip TLS verification? [y/N]: ');

      console.log('\n🔧 Creating project structure...');

      const config: Omit<WorkspaceConfig, 'name' | 'created' | 'version'> = {
        host: host.trim(),
        port: parseInt(port.trim()),
        username: username.trim(),
        tokenId: tokenId.trim(),
        tokenSecret: tokenSecret.trim(),
        node: node.trim(),
        rejectUnauthorized: skipTLS.toLowerCase().trim() !== 'y'
      };

      // Validate configuration before creating workspace
      try {
        ConfigManager.validateProxmoxConfig(config);
      } catch (error) {
        throw new Error(`Configuration validation failed: ${error}`);
      }

      const workspace = await ProjectWorkspace.create(process.cwd(), config);
      return workspace;

    } catch (error) {
      errorHandler.showWarning(
        'Failed to collect configuration interactively',
        [
          'You can manually edit .proxmox/config.yml after initialization',
          'Using default configuration template for now'
        ]
      );
      
      // Fall back to default configuration template
      const projectName = path.basename(process.cwd());
      const config = ConfigManager.createDefaultWorkspaceConfig(projectName);

      const workspace = await ProjectWorkspace.create(process.cwd(), config);
      return workspace;
    }
  }


  private prompt(rl: readline.Interface, question: string): Promise<string> {
    return new Promise((resolve) => {
      rl.question(question, (answer) => {
        resolve(answer);
      });
    });
  }

  private promptPassword(rl: readline.Interface, question: string): Promise<string> {
    return new Promise((resolve) => {
      // Temporarily disable echo by setting raw mode
      const stdin = process.stdin;
      const wasRaw = stdin.isRaw;
      
      process.stdout.write(question);
      
      if (stdin.setRawMode) {
        stdin.setRawMode(true);
      }
      
      let password = '';
      
      const onData = (char: Buffer) => {
        const c = char.toString();
        
        if (c === '\r' || c === '\n') {
          stdin.removeListener('data', onData);
          if (stdin.setRawMode) {
            stdin.setRawMode(wasRaw);
          }
          process.stdout.write('\n');
          resolve(password);
        } else if (c === '\x7f' || c === '\x08') {
          // Backspace
          if (password.length > 0) {
            password = password.slice(0, -1);
            process.stdout.write('\b \b');
          }
        } else if (c === '\x03') {
          // Ctrl+C
          stdin.removeListener('data', onData);
          if (stdin.setRawMode) {
            stdin.setRawMode(wasRaw);
          }
          process.stdout.write('\n');
          process.exit(0);
        } else if (c >= ' ' && c <= '~') {
          // Printable characters
          password += c;
          process.stdout.write('*');
        }
      };
      
      stdin.on('data', onData);
    });
  }
}