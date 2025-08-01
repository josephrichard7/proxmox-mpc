/**
 * Help Command
 * Displays available commands and usage information
 */

import { ConsoleSession } from '../repl';

export class HelpCommand {
  async execute(args: string[], session: ConsoleSession): Promise<void> {
    if (args.length > 0) {
      await this.showSpecificHelp(args[0], session);
    } else {
      await this.showGeneralHelp(session);
    }
  }

  private async showGeneralHelp(session: ConsoleSession): Promise<void> {
    console.log('\n📚 Proxmox-MPC Interactive Console Help\n');
    
    console.log('🔧 Core Slash Commands:');
    console.log('  /help                 Show this help message');
    console.log('  /init                 Initialize new project workspace');
    console.log('  /status               Show project and server status');
    console.log('  /sync                 Sync infrastructure and generate IaC + tests');
    console.log('  /validate             Run comprehensive validation checks');
    console.log('  /test                 Validate generated IaC and run TDD tests');
    console.log('  /plan                 Preview infrastructure changes');
    console.log('  /apply                Deploy infrastructure changes');
    console.log('  /destroy              Safely remove infrastructure');
    console.log('  /exit                 Exit the console\n');
    
    console.log('🔍 Observability & Diagnostics:');
    console.log('  /debug [on|off]       Control debug mode and verbose output');
    console.log('  /health [--detailed]  Show comprehensive system health');
    console.log('  /logs [options]       Query and display logs with filtering');
    console.log('  /report-issue <desc>  Generate diagnostic report for AI help\n');
    
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
      console.log('  4. Use /validate to check everything is ready');
      console.log('  5. Use /plan to preview changes before deployment');
      console.log('  6. Use /apply to deploy your infrastructure\n');
    } else {
      console.log('📁 Current Workspace:');
      console.log(`  Project: ${session.workspace.name}`);
      console.log(`  Server: ${session.workspace.config.host}:${session.workspace.config.port}`);
      console.log(`  Node: ${session.workspace.config.node}\n`);
    }
    
    console.log('📖 For detailed help on a specific command, use: /help <command>');
    console.log('🌐 Documentation: See VISION.md and PLAN.md in the project root\n');
  }

  private async showSpecificHelp(command: string, session: ConsoleSession): Promise<void> {
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
        
      case 'test':
        console.log('\n/test - Validate Infrastructure-as-Code and Run TDD Tests\n');
        console.log('Comprehensive validation and testing of generated configurations:');
        console.log('  • Phase 1: Validate workspace structure');
        console.log('  • Phase 2: Validate Terraform configurations');
        console.log('  • Phase 3: Validate Ansible configurations');
        console.log('  • Phase 4: Run terraform plan (dry-run)');
        console.log('  • Phase 5: Validate Ansible syntax');
        console.log('  • Phase 6: Run generated TDD test suite\n');
        console.log('This command ensures all configurations are valid and tested.');
        console.log('Usage: /test');
        console.log('Example: /test\n');
        break;

      case 'validate':
        console.log('\n/validate - Comprehensive Infrastructure Validation\n');
        console.log('Runs all validation checks across your infrastructure:');
        console.log('  • Workspace structure validation');
        console.log('  • Configuration file validation');
        console.log('  • Terraform syntax and planning validation');
        console.log('  • Ansible inventory and playbook validation');
        console.log('  • Proxmox connectivity validation');
        console.log('  • Optional: TDD test suite validation');
        console.log('  • Optional: Security validation\n');
        console.log('Options:');
        console.log('  --detailed, -d        Run detailed validation checks');
        console.log('  --tdd                 Include TDD test validation');
        console.log('  --security            Include security validation');
        console.log('  --fix, -f             Attempt to fix issues automatically');
        console.log('  --terraform, -t       Validate only Terraform');
        console.log('  --ansible, -a         Validate only Ansible\n');
        console.log('Usage: /validate [options]');
        console.log('Example: /validate --detailed --security\n');
        break;

      case 'plan':
        console.log('\n/plan - Preview Infrastructure Changes\n');
        console.log('Shows what changes would be made without applying them:');
        console.log('  • Terraform plan with detailed resource changes');
        console.log('  • Ansible dry-run showing configuration changes');
        console.log('  • Summary of all planned modifications');
        console.log('  • Impact analysis and resource counting\n');
        console.log('Options:');
        console.log('  --terraform, -t       Show only Terraform plan');
        console.log('  --ansible, -a         Show only Ansible plan');
        console.log('  --detailed, -d        Show detailed planning output');
        console.log('  --json, -j            Output in JSON format\n');
        console.log('Usage: /plan [options]');
        console.log('Example: /plan --detailed\n');
        break;

      case 'apply':
        console.log('\n/apply - Deploy Infrastructure Changes\n');
        console.log('Deploys your infrastructure using Terraform and Ansible:');
        console.log('  • Phase 1: Pre-deployment validation');
        console.log('  • Phase 2: Terraform infrastructure deployment');
        console.log('  • Phase 3: Ansible configuration application');
        console.log('  • Phase 4: Post-deployment verification\n');
        console.log('Options:');
        console.log('  --terraform, -t       Deploy only Terraform resources');
        console.log('  --ansible, -a         Apply only Ansible configuration');
        console.log('  --dry-run, -n         Preview without making changes');
        console.log('  --auto-approve, -y    Skip confirmation prompts');
        console.log('  --force, -f           Override validation failures');
        console.log('  --continue-on-error   Continue if one phase fails\n');
        console.log('Usage: /apply [options]');
        console.log('Example: /apply --terraform --dry-run\n');
        break;

      case 'destroy':
        console.log('\n/destroy - Safely Remove Infrastructure\n');
        console.log('Destroys infrastructure resources with comprehensive safety checks:');
        console.log('  • Phase 1: Safety checks and warnings');
        console.log('  • Phase 2: Generate destruction plan');
        console.log('  • Phase 3: Execute destruction (with confirmation)');
        console.log('  • Phase 4: Post-destruction cleanup and verification\n');
        console.log('⚠️  WARNING: This operation is IRREVERSIBLE and may cause data loss!');
        console.log('Options:');
        console.log('  --dry-run, -n         Show what would be destroyed');
        console.log('  --auto-approve, -y    Skip final confirmation (DANGEROUS)');
        console.log('  --force, -f           Override safety checks (VERY DANGEROUS)');
        console.log('  --no-backups          Don\'t preserve state file backups');
        console.log('  --target, -t <res>    Destroy only specific resources\n');
        console.log('Usage: /destroy [options]');
        console.log('Example: /destroy --dry-run\n');
        break;

      case 'debug':
        console.log('\n/debug - Debug Mode Control\n');
        console.log('Control debug mode and access diagnostic information:');
        console.log('  • Enable/disable verbose logging');
        console.log('  • View recent logs, metrics, and traces');
        console.log('  • Clear diagnostic data\n');
        console.log('Commands:');
        console.log('  /debug on             Enable debug mode');
        console.log('  /debug off            Disable debug mode');
        console.log('  /debug status         Show debug status');
        console.log('  /debug logs [count]   Show recent logs');
        console.log('  /debug metrics [name] Show performance metrics');
        console.log('  /debug traces [limit] Show operation traces');
        console.log('  /debug clear [type]   Clear debug data\n');
        console.log('Usage: /debug [command]');
        console.log('Example: /debug on\n');
        break;

      case 'health':
        console.log('\n/health - System Health Check\n');
        console.log('Display comprehensive system health and status:');
        console.log('  • Connectivity status (Proxmox, database, workspace)');
        console.log('  • Tool availability (terraform, ansible, etc.)');
        console.log('  • Resource status (VMs, containers, storage)');
        console.log('  • Performance metrics and recommendations\n');
        console.log('Options:');
        console.log('  --detailed, -d        Show detailed health information');
        console.log('  --metrics, -m         Include performance metrics');
        console.log('  --json, -j            Output in JSON format\n');
        console.log('Usage: /health [options]');
        console.log('Example: /health --detailed\n');
        break;

      case 'logs':
        console.log('\n/logs - Query System Logs\n');
        console.log('Query and display logs with filtering and search:');
        console.log('  • Filter by log level, operation, or time range');
        console.log('  • Search in log messages and error details');
        console.log('  • Show log summaries and statistics\n');
        console.log('Options:');
        console.log('  -n, --limit <number>  Limit number of logs (default: 50)');
        console.log('  -l, --level <level>   Filter by level (debug, info, warn, error)');
        console.log('  -o, --operation <op>  Filter by operation name');
        console.log('  -s, --search <text>   Search in log messages');
        console.log('  --since <minutes>     Show logs from last N minutes');
        console.log('  --summary             Show summary statistics\n');
        console.log('Usage: /logs [options]');
        console.log('Example: /logs --level error --since 30\n');
        break;

      case 'report-issue':
        console.log('\n/report-issue - Generate Diagnostic Report\n');
        console.log('Generate comprehensive diagnostic reports for AI assistance:');
        console.log('  • Collect logs, metrics, and system information');
        console.log('  • Generate AI-ready troubleshooting prompt');
        console.log('  • Anonymize sensitive data automatically\n');
        console.log('Options:');
        console.log('  --operation <name>    Specify related operation');
        console.log('  --no-files            Exclude file contents');
        console.log('  --no-anonymize        Don\'t redact sensitive data\n');
        console.log('Usage: /report-issue [description]');
        console.log('Example: /report-issue "terraform apply failed with timeout"\n');
        break;
        
      default:
        console.log(`\n❌ No specific help available for: ${command}`);
        console.log('Use /help to see all available commands\n');
    }
  }
}