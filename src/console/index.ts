/**
 * Console Module Exports
 * Main entry point for interactive console functionality
 */

export { InteractiveConsole } from './repl';
export { SimpleInteractiveConsole } from './simple-repl';
export { EnhancedInteractiveConsole } from './enhanced-repl';
export { SlashCommandRegistry } from './commands';
export type { ConsoleSession } from './repl';

// Re-export for convenience
import { InteractiveConsole } from './repl';
export default InteractiveConsole;