/**
 * Simplified Tab Completion Tests
 * Testing basic completion functionality that matches actual implementation
 */

import { TabCompletion } from '../completion';
import { SlashCommandRegistry } from '../commands';
import { CommandHistory } from '../history';

describe('TabCompletion - Simplified', () => {
  let completion: TabCompletion;
  let mockCommands: jest.Mocked<SlashCommandRegistry>;
  let mockHistory: jest.Mocked<CommandHistory>;

  beforeEach(() => {
    mockCommands = {
      getAvailableCommands: jest.fn().mockReturnValue(['help', 'init', 'status', 'sync', 'apply']),
    } as any;

    mockHistory = {
      getCommandSuggestions: jest.fn().mockReturnValue(['help']),
    } as any;

    completion = new TabCompletion({
      workspace: null,
      history: mockHistory,
      commands: mockCommands,
    });
  });

  describe('basic completion functionality', () => {
    it('should complete slash commands', () => {
      const [completions] = completion.complete('/he');
      
      expect(completions).toEqual(['/help']);
    });

    it('should complete multiple slash commands', () => {
      const [completions] = completion.complete('/');
      
      expect(completions).toContain('/help');
      expect(completions).toContain('/init');
      expect(completions).toContain('/status');
    });

    it('should return default completions for empty input', () => {
      const [completions] = completion.complete('');
      
      expect(completions).toContain('/help');
      expect(completions).toContain('create');
    });

    it('should handle partial matches', () => {
      const [completions] = completion.complete('he');
      
      expect(completions).toContain('help'); // From history suggestions
    });
  });

  describe('context updates', () => {
    it('should update context successfully', () => {
      const newHistory = {
        getCommandSuggestions: jest.fn().mockReturnValue(['new suggestion']),
      } as any;
      
      expect(() => {
        completion.updateContext({ history: newHistory });
      }).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle empty results gracefully', () => {
      mockCommands.getAvailableCommands.mockReturnValue([]);
      mockHistory.getCommandSuggestions.mockReturnValue([]);
      
      const [completions, prefix] = completion.complete('nonexistent');
      
      expect(Array.isArray(completions)).toBe(true);
      expect(typeof prefix).toBe('string');
    });

    it('should handle null workspace', () => {
      completion.updateContext({ workspace: null });
      
      const [completions] = completion.complete('test');
      
      expect(Array.isArray(completions)).toBe(true);
    });
  });
});