/**
 * Init Command
 * Initializes a new Proxmox project workspace
 */

import { ConsoleSession } from '../repl';
import { ProjectWorkspace } from '../../workspace';
import * as readline from 'readline';

export class InitCommand {
  async execute(args: string[], session: ConsoleSession): Promise<void> {
    console.log('🏗️  Initializing new Proxmox project workspace...\n');

    // Check if already in a workspace
    try {
      const existing = await ProjectWorkspace.detect(process.cwd());
      if (existing) {
        console.log('❌ Already in a Proxmox workspace!');
        console.log(`   Project: ${existing.name}`);
        console.log(`   Config: ${existing.configPath}`);
        console.log('\n💡 Navigate to a different directory to create a new workspace\n');
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
      
      console.log('\n✅ Project workspace initialized successfully!');
      console.log(`   📁 Project: ${workspace.name}`);
      console.log(`   🗄️  Database: ${workspace.databasePath}`);
      console.log(`   ⚙️  Config: ${workspace.configPath}`);
      console.log('\n🎯 Next steps:');
      console.log('   • Use /status to check server connectivity');
      console.log('   • Use /sync to import existing infrastructure');
      console.log('   • Start creating resources with "create vm --name <name>"\n');
      
    } catch (error) {
      console.error(`❌ Failed to initialize workspace: ${error instanceof Error ? error.message : String(error)}\n`);
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

      const config = {
        host: host.trim(),
        port: parseInt(port.trim()),
        username: username.trim(),
        tokenId: tokenId.trim(),
        tokenSecret: tokenSecret.trim(),
        node: node.trim(),
        rejectUnauthorized: skipTLS.toLowerCase().trim() !== 'y'
      };

      const workspace = await ProjectWorkspace.create(process.cwd(), config);
      return workspace;

    } catch (error) {
      console.error('\n❌ Failed to collect configuration interactively');
      console.log('💡 You can manually edit .proxmox/config.yml after initialization\n');
      
      // Fall back to basic configuration
      const config = {
        host: 'your-proxmox-server.local',
        port: 8006,
        username: 'root@pam',
        tokenId: 'proxmox-mpc',
        tokenSecret: 'your-token-secret',
        node: 'pve',
        rejectUnauthorized: false
      };

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