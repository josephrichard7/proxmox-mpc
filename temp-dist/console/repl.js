"use strict";
/**
 * Interactive Console REPL Interface
 * Provides Claude Code-like interactive experience for infrastructure management
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.InteractiveConsole = void 0;
const readline = __importStar(require("readline"));
const commands_1 = require("./commands");
const workspace_1 = require("../workspace");
class InteractiveConsole {
    constructor() {
        this.isRunning = false;
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: 'proxmox-mpc> ',
            historySize: 1000,
        });
        this.session = {
            history: [],
            startTime: new Date(),
        };
        this.commandRegistry = new commands_1.SlashCommandRegistry();
        this.setupEventHandlers();
    }
    /**
     * Start the interactive console
     */
    async start() {
        this.isRunning = true;
        this.displayWelcome();
        // Check if we're in an existing workspace
        await this.detectWorkspace();
        this.rl.prompt();
    }
    /**
     * Stop the interactive console
     */
    stop() {
        this.isRunning = false;
        this.rl.close();
    }
    setupEventHandlers() {
        this.rl.on('line', async (input) => {
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
    async handleInput(input) {
        if (!input)
            return;
        // Add to history
        this.session.history.push(input);
        try {
            if (input.startsWith('/')) {
                // Handle slash commands
                await this.handleSlashCommand(input);
            }
            else if (input.startsWith('create ') || input.startsWith('delete ') ||
                input.startsWith('list ') || input.startsWith('describe ')) {
                // Handle resource commands
                await this.handleResourceCommand(input);
            }
            else if (input === 'help') {
                this.displayHelp();
            }
            else if (input === 'exit' || input === 'quit') {
                this.stop();
            }
            else {
                console.log(`Unknown command: ${input}`);
                console.log('Type "help" or "/help" for available commands');
            }
        }
        catch (error) {
            console.error(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async handleSlashCommand(input) {
        const [command, ...args] = input.slice(1).split(' ');
        if (this.commandRegistry.has(command)) {
            await this.commandRegistry.execute(command, args, this.session);
        }
        else {
            console.log(`❌ Unknown slash command: /${command}`);
            console.log('Available slash commands: /help, /init, /status, /exit');
        }
    }
    async handleResourceCommand(input) {
        // TODO: Implement resource command parsing and execution
        console.log(`🚧 Resource commands not yet implemented: ${input}`);
        console.log('   This will generate Terraform/Ansible configurations');
    }
    async detectWorkspace() {
        try {
            const workspace = await workspace_1.ProjectWorkspace.detect(process.cwd());
            if (workspace) {
                this.session.workspace = workspace;
                console.log(`📁 Workspace detected: ${workspace.name}`);
                console.log(`   Server: ${workspace.config.host}`);
                console.log(`   Node: ${workspace.config.node}`);
            }
        }
        catch (error) {
            // No workspace detected, that's fine
        }
    }
    displayWelcome() {
        console.log('🔧 Proxmox Infrastructure Console v0.1.0');
        console.log('Welcome! Type /help for commands or /init to get started.\n');
        if (!this.session.workspace) {
            console.log('💡 Tip: Use /init to initialize a new Proxmox project workspace');
            console.log('   or navigate to an existing project directory\n');
        }
    }
    displayHelp() {
        console.log('\n📚 Available Commands:\n');
        console.log('🔧 Slash Commands:');
        console.log('  /help                 Show this help message');
        console.log('  /init                 Initialize new project workspace');
        console.log('  /status               Show project and server status');
        console.log('  /sync                 Sync infrastructure state');
        console.log('  /exit                 Exit the console\n');
        console.log('🏗️  Resource Commands (Future):');
        console.log('  create vm --name <name>     Generate VM configuration');
        console.log('  create container --name <name>  Generate container configuration');
        console.log('  list vms                    Show VMs');
        console.log('  describe vm <id>            Show VM details\n');
        console.log('⌨️  Shortcuts:');
        console.log('  help, exit, quit            Alternative commands');
        console.log('  Ctrl+C                      Exit console');
        console.log('  Up/Down arrows             Command history\n');
    }
    displayGoodbye() {
        const duration = Date.now() - this.session.startTime.getTime();
        const seconds = Math.round(duration / 1000);
        console.log(`\n👋 Session ended (${seconds}s)`);
        console.log('Thank you for using Proxmox-MPC!');
    }
}
exports.InteractiveConsole = InteractiveConsole;
