/**
 * Tab Completion System for Proxmox-MPC Console
 * Provides intelligent auto-completion for commands, resources, and parameters
 */

import { SlashCommandRegistry } from './commands';
import { ProjectWorkspace } from '../workspace';
import { CommandHistory } from './history';

export interface CompletionContext {
  workspace: ProjectWorkspace | null;
  history: CommandHistory;
  commands: SlashCommandRegistry;
}

export interface CompletionResult {
  completions: string[];
  commonPrefix: string;
}

export class TabCompletion {
  private context: CompletionContext;

  constructor(context: CompletionContext) {
    this.context = context;
  }

  public complete(line: string, cursor: number = line.length): [string[], string] {
    const beforeCursor = line.substring(0, cursor);
    const result = this.getCompletions(beforeCursor);
    
    return [result.completions, result.commonPrefix];
  }

  private getCompletions(input: string): CompletionResult {
    const trimmed = input.trim();
    
    // Empty input - show most common commands
    if (!trimmed) {
      return this.getDefaultCompletions();
    }
    
    // Slash commands
    if (trimmed.startsWith('/')) {
      return this.completeSlashCommand(trimmed);
    }
    
    // Resource commands
    if (this.isResourceCommand(trimmed)) {
      return this.completeResourceCommand(trimmed);
    }
    
    // General command completion
    return this.completeGeneralCommand(trimmed);
  }

  private getDefaultCompletions(): CompletionResult {
    const defaults = ['/help', '/init', '/status', 'help', 'create', 'list'];
    return {
      completions: defaults,
      commonPrefix: '',
    };
  }

  private completeSlashCommand(input: string): CompletionResult {
    const command = input.slice(1); // Remove '/'
    const parts = command.split(' ');
    
    if (parts.length === 1) {
      // Complete slash command name
      const availableCommands = this.context.commands.getAvailableCommands();
      const matches = availableCommands.filter(cmd => cmd.startsWith(command));
      
      return {
        completions: matches.map(cmd => `/${cmd}`),
        commonPrefix: `/${this.findCommonPrefix(matches)}`,
      };
    } else {
      // Complete slash command arguments
      return this.completeSlashCommandArgs(parts[0], parts.slice(1));
    }
  }

  private completeSlashCommandArgs(command: string, args: string[]): CompletionResult {
    switch (command) {
      case 'init':
        return this.completeInitArgs(args);
      
      case 'help':
        return this.completeHelpArgs(args);
      
      case 'sync':
        return this.completeSyncArgs(args);
      
      case 'apply':
        return this.completeApplyArgs(args);
      
      case 'test':
        return this.completeTestArgs(args);
      
      default:
        return { completions: [], commonPrefix: '' };
    }
  }

  private completeInitArgs(args: string[]): CompletionResult {
    if (args.length === 0) {
      return {
        completions: ['--name', '--server', '--template'],
        commonPrefix: '--',
      };
    }
    
    const lastArg = args[args.length - 1];
    
    if (lastArg === '--template') {
      return {
        completions: ['basic', 'homelab', 'production', 'development'],
        commonPrefix: '',
      };
    }
    
    return { completions: [], commonPrefix: '' };
  }

  private completeHelpArgs(args: string[]): CompletionResult {
    if (args.length === 0) {
      const commands = this.context.commands.getAvailableCommands();
      return {
        completions: commands,
        commonPrefix: '',
      };
    }
    
    return { completions: [], commonPrefix: '' };
  }

  private completeSyncArgs(args: string[]): CompletionResult {
    const syncOptions = ['--dry-run', '--force', '--verbose', '--filter'];
    const partial = args[args.length - 1] || '';
    
    const matches = syncOptions.filter(opt => opt.startsWith(partial));
    
    return {
      completions: matches,
      commonPrefix: this.findCommonPrefix(matches),
    };
  }

  private completeApplyArgs(args: string[]): CompletionResult {
    const applyOptions = ['--dry-run', '--auto-approve', '--target', '--parallelism'];
    const partial = args[args.length - 1] || '';
    
    const matches = applyOptions.filter(opt => opt.startsWith(partial));
    
    return {
      completions: matches,
      commonPrefix: this.findCommonPrefix(matches),
    };
  }

  private completeTestArgs(args: string[]): CompletionResult {
    const testOptions = ['--verbose', '--filter', '--timeout', '--parallel'];
    const partial = args[args.length - 1] || '';
    
    const matches = testOptions.filter(opt => opt.startsWith(partial));
    
    return {
      completions: matches,
      commonPrefix: this.findCommonPrefix(matches),
    };
  }

  private completeResourceCommand(input: string): CompletionResult {
    const parts = input.split(' ');
    const action = parts[0];
    
    if (parts.length === 1) {
      // Complete action
      const actions = ['create', 'delete', 'update', 'list', 'describe'];
      const matches = actions.filter(act => act.startsWith(action));
      
      return {
        completions: matches,
        commonPrefix: this.findCommonPrefix(matches),
      };
    } else if (parts.length === 2) {
      // Complete resource type
      return this.completeResourceType(parts[1]);
    } else {
      // Complete resource-specific options
      return this.completeResourceOptions(action, parts[1], parts.slice(2));
    }
  }

  private completeResourceType(partial: string): CompletionResult {
    const resourceTypes = ['vm', 'container', 'network', 'storage', 'node'];
    const matches = resourceTypes.filter(type => type.startsWith(partial));
    
    return {
      completions: matches,
      commonPrefix: this.findCommonPrefix(matches),
    };
  }

  private completeResourceOptions(action: string, resourceType: string, args: string[]): CompletionResult {
    const options = this.getResourceOptions(action, resourceType);
    const partial = args[args.length - 1] || '';
    
    if (partial.startsWith('--')) {
      const matches = options.filter(opt => opt.startsWith(partial));
      return {
        completions: matches,
        commonPrefix: this.findCommonPrefix(matches),
      };
    }
    
    // Complete option values
    if (args.length >= 2) {
      const optionName = args[args.length - 2];
      return this.completeOptionValue(optionName, partial);
    }
    
    return {
      completions: options,
      commonPrefix: '--',
    };
  }

  private getResourceOptions(action: string, resourceType: string): string[] {
    const baseOptions = ['--help', '--verbose', '--dry-run'];
    
    switch (resourceType) {
      case 'vm':
        return [
          ...baseOptions,
          '--name', '--cores', '--memory', '--disk', '--network',
          '--template', '--node', '--storage', '--ostype',
        ];
      
      case 'container':
        return [
          ...baseOptions,
          '--name', '--cores', '--memory', '--disk', '--network',
          '--template', '--node', '--storage', '--ostype', '--unprivileged',
        ];
      
      case 'network':
        return [
          ...baseOptions,
          '--name', '--type', '--bridge', '--vlan', '--cidr',
        ];
      
      case 'storage':
        return [
          ...baseOptions,
          '--name', '--type', '--path', '--content', '--shared',
        ];
      
      default:
        return baseOptions;
    }
  }

  private completeOptionValue(optionName: string, partial: string): CompletionResult {
    switch (optionName) {
      case '--ostype':
        const osTypes = ['ubuntu', 'debian', 'centos', 'alpine', 'arch'];
        const matches = osTypes.filter(os => os.startsWith(partial));
        return {
          completions: matches,
          commonPrefix: this.findCommonPrefix(matches),
        };
      
      case '--type':
        const types = ['qemu', 'lxc', 'bridge', 'vlan'];
        const typeMatches = types.filter(type => type.startsWith(partial));
        return {
          completions: typeMatches,
          commonPrefix: this.findCommonPrefix(typeMatches),
        };
      
      case '--template':
        if (this.context.workspace) {
          // Get templates from workspace if available
          const templates = ['basic', 'web-server', 'database', 'monitoring'];
          const templateMatches = templates.filter(tmpl => tmpl.startsWith(partial));
          return {
            completions: templateMatches,
            commonPrefix: this.findCommonPrefix(templateMatches),
          };
        }
        break;
    }
    
    return { completions: [], commonPrefix: '' };
  }

  private completeGeneralCommand(input: string): CompletionResult {
    const words = input.split(' ');
    const firstWord = words[0];
    
    // Common commands
    const commands = ['help', 'exit', 'quit', 'clear', 'history'];
    const matches = commands.filter(cmd => cmd.startsWith(firstWord));
    
    // Add history-based suggestions
    const historySuggestions = this.context.history.getCommandSuggestions(firstWord);
    const allMatches = [...new Set([...matches, ...historySuggestions])];
    
    return {
      completions: allMatches,
      commonPrefix: this.findCommonPrefix(allMatches),
    };
  }

  private isResourceCommand(input: string): boolean {
    const resourceActions = ['create', 'delete', 'update', 'list', 'describe'];
    const firstWord = input.split(' ')[0];
    return resourceActions.includes(firstWord);
  }

  private findCommonPrefix(strings: string[]): string {
    if (strings.length === 0) return '';
    if (strings.length === 1) return strings[0];
    
    let prefix = strings[0];
    
    for (let i = 1; i < strings.length; i++) {
      while (!strings[i].startsWith(prefix)) {
        prefix = prefix.slice(0, -1);
        if (prefix === '') break;
      }
    }
    
    return prefix;
  }

  // Update context for dynamic completions
  public updateContext(context: Partial<CompletionContext>): void {
    this.context = { ...this.context, ...context };
  }
}