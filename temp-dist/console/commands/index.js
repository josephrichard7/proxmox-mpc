"use strict";
/**
 * Slash Command Registry
 * Manages registration and execution of slash commands
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SlashCommandRegistry = void 0;
const help_1 = require("./help");
const init_1 = require("./init");
const status_1 = require("./status");
const exit_1 = require("./exit");
class SlashCommandRegistry {
    constructor() {
        this.commands = new Map();
        this.registerBuiltinCommands();
    }
    registerBuiltinCommands() {
        this.register('help', new help_1.HelpCommand().execute);
        this.register('init', new init_1.InitCommand().execute);
        this.register('status', new status_1.StatusCommand().execute);
        this.register('exit', new exit_1.ExitCommand().execute);
        // Aliases
        this.register('quit', new exit_1.ExitCommand().execute);
    }
    /**
     * Register a new slash command
     */
    register(name, handler) {
        this.commands.set(name, handler);
    }
    /**
     * Check if a command exists
     */
    has(name) {
        return this.commands.has(name);
    }
    /**
     * Execute a slash command
     */
    async execute(name, args, session) {
        const handler = this.commands.get(name);
        if (!handler) {
            throw new Error(`Unknown command: /${name}`);
        }
        await handler(args, session);
    }
    /**
     * Get list of available commands
     */
    getAvailableCommands() {
        return Array.from(this.commands.keys()).sort();
    }
}
exports.SlashCommandRegistry = SlashCommandRegistry;
