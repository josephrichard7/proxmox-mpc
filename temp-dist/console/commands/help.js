"use strict";
/**
 * Help Command
 * Displays available commands and usage information
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.HelpCommand = void 0;
class HelpCommand {
    async execute(args, session) {
        if (args.length > 0) {
            await this.showSpecificHelp(args[0], session);
        }
        else {
            await this.showGeneralHelp(session);
        }
    }
    async showGeneralHelp(session) {
        console.log('\n📚 Proxmox-MPC Interactive Console Help\n');
        console.log('🔧 Core Slash Commands:');
        console.log('  /help                 Show this help message');
        console.log('  /init                 Initialize new project workspace');
        console.log('  /status               Show project and server status');
        console.log('  /sync                 Sync infrastructure state (future)');
        console.log('  /apply                Deploy changes to server (future)');
        console.log('  /test                 Run infrastructure tests (future)');
        console.log('  /exit                 Exit the console\n');
        console.log('🏗️  Resource Commands (Future):');
        console.log('  create vm --name <name>         Generate VM configuration');
        console.log('  create container --name <name>  Generate container configuration');
        console.log('  update vm <id> --cores <n>      Modify VM configuration');
        console.log('  delete vm <id>                  Remove VM configuration');
        console.log('  list vms [filters]              Show VMs');
        console.log('  describe vm <id>                Show detailed VM info\n');
        console.log('⌨️  Navigation & Shortcuts:');
        console.log('  help, exit, quit              Alternative commands');
        console.log('  Ctrl+C                        Exit console');
        console.log('  Up/Down arrows               Command history');
        console.log('  Tab                          Auto-completion (future)\n');
        if (!session.workspace) {
            console.log('💡 Getting Started:');
            console.log('  1. Use /init to create a new project workspace');
            console.log('  2. Configure your Proxmox server connection');
            console.log('  3. Use /sync to import existing infrastructure');
            console.log('  4. Start managing resources with create/update/delete commands\n');
        }
        else {
            console.log('📁 Current Workspace:');
            console.log(`  Project: ${session.workspace.name}`);
            console.log(`  Server: ${session.workspace.config.host}:${session.workspace.config.port}`);
            console.log(`  Node: ${session.workspace.config.node}\n`);
        }
        console.log('📖 For detailed help on a specific command, use: /help <command>');
        console.log('🌐 Documentation: See VISION.md and PLAN.md in the project root\n');
    }
    async showSpecificHelp(command, session) {
        switch (command) {
            case 'init':
                console.log('\n/init - Initialize Project Workspace\n');
                console.log('Creates a new Proxmox infrastructure project in the current directory.');
                console.log('This command will:');
                console.log('  • Create .proxmox/ directory with configuration');
                console.log('  • Set up local SQLite database');
                console.log('  • Create terraform/ and ansible/ directories');
                console.log('  • Create tests/ directory for infrastructure validation');
                console.log('  • Guide you through server connection setup\n');
                console.log('Usage: /init');
                console.log('Example: /init\n');
                break;
            case 'status':
                console.log('\n/status - Show Project Status\n');
                console.log('Displays current project and server information including:');
                console.log('  • Project workspace status');
                console.log('  • Proxmox server connectivity');
                console.log('  • Resource counts (VMs, containers, etc.)');
                console.log('  • Last synchronization time');
                console.log('  • Configuration drift status (future)\n');
                console.log('Usage: /status');
                console.log('Example: /status\n');
                break;
            case 'sync':
                console.log('\n/sync - Synchronize Infrastructure State\n');
                console.log('Bidirectional synchronization between:');
                console.log('  • Proxmox server (actual infrastructure)');
                console.log('  • Local database (cached state)');
                console.log('  • Terraform files (desired configuration)');
                console.log('  • Ansible playbooks (configuration management)\n');
                console.log('This command will:');
                console.log('  • Import existing VMs and containers');
                console.log('  • Generate Terraform resource configurations');
                console.log('  • Create Ansible inventory and playbooks');
                console.log('  • Update local database with current state\n');
                console.log('Usage: /sync');
                console.log('Example: /sync\n');
                break;
            default:
                console.log(`\n❌ No specific help available for: ${command}`);
                console.log('Use /help to see all available commands\n');
        }
    }
}
exports.HelpCommand = HelpCommand;
