/**
 * Exit Command
 * Gracefully exits the interactive console
 */

import { ConsoleSession } from '../repl';

export class ExitCommand {
  async execute(args: string[], session: ConsoleSession): Promise<void> {
    console.log('\n👋 Exiting Proxmox Infrastructure Console...');
    
    // Show session summary
    const duration = Date.now() - session.startTime.getTime();
    const seconds = Math.round(duration / 1000);
    
    console.log(`   Session duration: ${this.formatDuration(duration)}`);
    console.log(`   Commands executed: ${session.history.length}`);
    
    if (session.workspace) {
      console.log(`   Project: ${session.workspace.name}`);
    }
    
    console.log('\nThank you for using Proxmox-MPC! 🚀\n');
    
    // Exit the process
    process.exit(0);
  }

  private formatDuration(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
}