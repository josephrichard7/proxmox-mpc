/**
 * Tests for Tab Completion System
 * Testing intelligent auto-completion for commands, resources, and parameters
 */

import { ProjectWorkspace } from '../../workspace';
import { SlashCommandRegistry } from '../commands';
import { TabCompletion, CompletionContext } from '../completion';
import { CommandHistory } from '../history';

// Mock dependencies
jest.mock('../commands');
jest.mock('../history');
jest.mock('../../workspace');

const MockSlashCommandRegistry = SlashCommandRegistry as jest.MockedClass<typeof SlashCommandRegistry>;
const MockCommandHistory = CommandHistory as jest.MockedClass<typeof CommandHistory>;

describe('TabCompletion', () => {
  let completion: TabCompletion;
  let mockCommands: jest.Mocked<SlashCommandRegistry>;
  let mockHistory: jest.Mocked<CommandHistory>;
  let mockWorkspace: jest.Mocked<ProjectWorkspace>;
  let context: CompletionContext;

  beforeEach(() => {
    // Mock command registry
    mockCommands = {
      getAvailableCommands: jest.fn().mockReturnValue(['help', 'init', 'status', 'sync', 'apply']),
    } as any;

    // Mock command history
    mockHistory = {
      getCommandSuggestions: jest.fn().mockReturnValue(['help', 'create vm']),
    } as any;

    // Mock workspace
    mockWorkspace = {
      name: 'test-workspace',
      rootPath: '/test',
    } as any;

    // Setup context
    context = {
      workspace: mockWorkspace,
      history: mockHistory,
      commands: mockCommands,
    };

    completion = new TabCompletion(context);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with provided context', () => {
      expect(completion).toBeDefined();
    });
  });

  describe('complete', () => {
    it('should complete slash commands', () => {
      const [completions, prefix] = completion.complete('/he');
      
      expect(completions).toContain('/help');
      expect(prefix).toBe('/he');
    });

    it('should complete slash command arguments', () => {
      const [completions, prefix] = completion.complete('/init --');
      
      expect(completions).toContain('--name');
      expect(completions).toContain('--server');
      expect(completions).toContain('--template');
    });

    it('should complete resource commands', () => {
      const [completions, prefix] = completion.complete('cre');
      
      expect(completions).toContain('create');
    });

    it('should complete resource types', () => {
      const [completions, prefix] = completion.complete('create v');
      
      expect(completions).toContain('vm');
    });

    it('should return default completions for empty input', () => {
      const [completions, prefix] = completion.complete('');
      
      expect(completions).toContain('/help');
      expect(completions).toContain('create');
      expect(prefix).toBe('');
    });
  });

  describe('slash command completion', () => {
    it('should complete slash command names', () => {
      const [completions] = completion.complete('/s');
      
      expect(completions).toContain('/status');
      expect(completions).toContain('/sync');
    });

    it('should find common prefix for slash commands', () => {
      const [, prefix] = completion.complete('/st');
      
      expect(prefix).toBe('/st');
    });

    it('should complete init command arguments', () => {
      const [completions] = completion.complete('/init ');
      
      expect(completions).toContain('--name');
      expect(completions).toContain('--server');
      expect(completions).toContain('--template');
    });

    it('should complete template values for init command', () => {
      const [completions] = completion.complete('/init --template ');
      
      expect(completions).toContain('basic');
      expect(completions).toContain('homelab');
      expect(completions).toContain('production');
      expect(completions).toContain('development');
    });

    it('should complete help command with available commands', () => {
      const [completions] = completion.complete('/help ');
      
      expect(completions).toContain('help');
      expect(completions).toContain('init');
      expect(completions).toContain('status');
    });

    it('should complete sync command options', () => {
      const [completions] = completion.complete('/sync --');
      
      expect(completions).toContain('--dry-run');
      expect(completions).toContain('--force');
      expect(completions).toContain('--verbose');
      expect(completions).toContain('--filter');
    });

    it('should complete apply command options', () => {
      const [completions] = completion.complete('/apply --');
      
      expect(completions).toContain('--dry-run');
      expect(completions).toContain('--auto-approve');
      expect(completions).toContain('--target');
      expect(completions).toContain('--parallelism');
    });

    it('should complete test command options', () => {
      const [completions] = completion.complete('/test --');
      
      expect(completions).toContain('--verbose');
      expect(completions).toContain('--filter');
      expect(completions).toContain('--timeout');
      expect(completions).toContain('--parallel');
    });
  });

  describe('resource command completion', () => {
    it('should complete resource action names', () => {
      const [completions] = completion.complete('cr');
      
      expect(completions).toContain('create');
    });

    it('should complete all resource actions', () => {
      const actions = ['create', 'delete', 'update', 'list', 'describe'];
      
      actions.forEach(action => {
        const [completions] = completion.complete(action.substring(0, 2));
        expect(completions).toContain(action);
      });
    });

    it('should complete resource types after action', () => {
      const [completions] = completion.complete('create ');
      
      expect(completions).toContain('vm');
      expect(completions).toContain('container');
      expect(completions).toContain('network');
      expect(completions).toContain('storage');
      expect(completions).toContain('node');
    });

    it('should filter resource types by partial match', () => {
      const [completions] = completion.complete('create con');
      
      expect(completions).toContain('container');
      expect(completions).not.toContain('vm');
    });

    it('should complete VM resource options', () => {
      const [completions] = completion.complete('create vm --');
      
      expect(completions).toContain('--name');
      expect(completions).toContain('--cores');
      expect(completions).toContain('--memory');
      expect(completions).toContain('--disk');
      expect(completions).toContain('--network');
      expect(completions).toContain('--template');
      expect(completions).toContain('--node');
      expect(completions).toContain('--storage');
      expect(completions).toContain('--ostype');
    });

    it('should complete container resource options', () => {
      const [completions] = completion.complete('create container --');
      
      expect(completions).toContain('--name');
      expect(completions).toContain('--cores');
      expect(completions).toContain('--memory');
      expect(completions).toContain('--unprivileged');
    });

    it('should complete network resource options', () => {
      const [completions] = completion.complete('create network --');
      
      expect(completions).toContain('--name');
      expect(completions).toContain('--type');
      expect(completions).toContain('--bridge');
      expect(completions).toContain('--vlan');
      expect(completions).toContain('--cidr');
    });

    it('should complete storage resource options', () => {
      const [completions] = completion.complete('create storage --');
      
      expect(completions).toContain('--name');
      expect(completions).toContain('--type');
      expect(completions).toContain('--path');
      expect(completions).toContain('--content');
      expect(completions).toContain('--shared');
    });
  });

  describe('option value completion', () => {
    it('should complete OS types for --ostype option', () => {
      const [completions] = completion.complete('create vm --ostype ');
      
      expect(completions).toContain('ubuntu');
      expect(completions).toContain('debian');
      expect(completions).toContain('centos');
      expect(completions).toContain('alpine');
      expect(completions).toContain('arch');
    });

    it('should filter OS types by partial match', () => {
      const [completions] = completion.complete('create vm --ostype ub');
      
      expect(completions).toContain('ubuntu');
      expect(completions).not.toContain('debian');
    });

    it('should complete type values', () => {
      const [completions] = completion.complete('create network --type ');
      
      expect(completions).toContain('bridge');
      expect(completions).toContain('vlan');
    });

    it('should complete template values when workspace is available', () => {
      const [completions] = completion.complete('create vm --template ');
      
      expect(completions).toContain('basic');
      expect(completions).toContain('web-server');
      expect(completions).toContain('database');
      expect(completions).toContain('monitoring');
    });
  });

  describe('general command completion', () => {
    it('should complete common commands', () => {
      const [completions] = completion.complete('he');
      
      expect(completions).toContain('help');
    });

    it('should include history suggestions', () => {
      mockHistory.getCommandSuggestions.mockReturnValue(['help previous', 'help command']);
      
      const [completions] = completion.complete('help');
      
      expect(completions).toContain('help previous');
      expect(completions).toContain('help command');
    });

    it('should deduplicate suggestions', () => {
      mockHistory.getCommandSuggestions.mockReturnValue(['help', 'help']); // Duplicate
      
      const [completions] = completion.complete('he');
      
      const helpCount = completions.filter(c => c === 'help').length;
      expect(helpCount).toBe(1);
    });
  });

  describe('common prefix finding', () => {
    it('should find common prefix for similar completions', () => {
      const [, prefix] = completion.complete('/st');
      
      expect(prefix).toBe('/st');
    });

    it('should return empty prefix when no common prefix exists', () => {
      const [, prefix] = completion.complete('x'); // No matches
      
      expect(prefix).toBe('');
    });

    it('should handle single completion', () => {
      const [completions, prefix] = completion.complete('/help');
      
      if (completions.length === 1) {
        expect(prefix).toBe('/help');
      }
    });
  });

  describe('updateContext', () => {
    it('should update workspace context', () => {
      const newWorkspace = { name: 'new-workspace', rootPath: '/new' } as any;
      
      completion.updateContext({ workspace: newWorkspace });
      
      // Test that new workspace affects completion
      const [completions] = completion.complete('create vm --template ');
      expect(completions).toContain('basic'); // Should still work with new workspace
    });

    it('should update history context', () => {
      const newHistory = {
        getCommandSuggestions: jest.fn().mockReturnValue(['new suggestion']),
      } as any;
      
      completion.updateContext({ history: newHistory });
      
      const [completions] = completion.complete('new');
      expect(completions).toContain('new suggestion');
    });

    it('should update commands context', () => {
      const newCommands = {
        getAvailableCommands: jest.fn().mockReturnValue(['new-command']),
      } as any;
      
      completion.updateContext({ commands: newCommands });
      
      const [completions] = completion.complete('/new');
      expect(completions).toContain('/new-command');
    });
  });

  describe('edge cases', () => {
    it('should handle empty completions gracefully', () => {
      mockCommands.getAvailableCommands.mockReturnValue([]);
      mockHistory.getCommandSuggestions.mockReturnValue([]);
      
      const [completions, prefix] = completion.complete('nonexistent');
      
      expect(completions).toEqual([]);
      expect(prefix).toBe('');
    });

    it('should handle null workspace', () => {
      completion.updateContext({ workspace: null });
      
      const [completions] = completion.complete('create vm --template ');
      
      // Should still return some completions even without workspace
      expect(completions.length).toBeGreaterThan(0);
    });

    it('should handle long command lines', () => {
      const longCommand = 'create vm --name test --cores 4 --memory 8192 --disk 100G --network bridge=vmbr0 --';
      
      const [completions] = completion.complete(longCommand);
      
      expect(completions).toContain('--ostype');
      expect(completions).toContain('--template');
    });

    it('should handle cursor position in middle of line', () => {
      const [completions, prefix] = completion.complete('create vm --name test', 10); // Cursor at position 10
      
      expect(completions).toBeDefined();
      expect(prefix).toBeDefined();
    });
  });
});