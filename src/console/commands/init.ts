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
      const workspace = await this.createWorkspaceInteractively();
      
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

  private async createWorkspaceInteractively(): Promise<ProjectWorkspace> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    try {
      console.log('📋 Please provide your Proxmox server details:\n');

      const host = await this.prompt(rl, '   Proxmox Host (IP or domain): ');
      const port = await this.prompt(rl, '   Port [8006]: ') || '8006';
      const username = await this.prompt(rl, '   Username [root@pam]: ') || 'root@pam';
      const tokenId = await this.prompt(rl, '   API Token ID: ');
      const tokenSecret = await this.promptPassword(rl, '   API Token Secret: ');
      const node = await this.prompt(rl, '   Default Node: ');

      console.log('\n⚙️  Optional settings:');
      const rejectUnauthorized = await this.prompt(rl, '   Reject unauthorized SSL [n]: ') || 'n';

      const config = {
        host: host.trim(),
        port: parseInt(port.trim()),
        username: username.trim(),
        tokenId: tokenId.trim(),
        tokenSecret: tokenSecret.trim(),
        node: node.trim(),
        rejectUnauthorized: rejectUnauthorized.toLowerCase().startsWith('y')
      };

      // Validate required fields
      if (!config.host || !config.tokenId || !config.tokenSecret || !config.node) {
        throw new Error('Host, Token ID, Token Secret, and Node are required');
      }

      console.log('\n🔧 Creating project structure...');
      const workspace = await ProjectWorkspace.create(process.cwd(), config);

      return workspace;

    } finally {
      rl.close();
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
      process.stdout.write(question);
      
      let password = '';
      const onData = (char: Buffer) => {
        const c = char.toString();
        
        if (c === '\r' || c === '\n') {
          process.stdin.removeListener('data', onData);
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
          process.stdout.write('\n');
          process.exit(0);
        } else if (c >= ' ' && c <= '~') {
          // Printable characters
          password += c;
          process.stdout.write('*');
        }
      };
      
      process.stdin.on('data', onData);
    });
  }
}