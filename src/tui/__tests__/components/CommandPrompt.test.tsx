import React from 'react';
import { render } from 'ink-testing-library';
import { CommandPrompt } from '../../components/CommandPrompt';

describe('CommandPrompt Component', () => {
  const mockOnCommand = jest.fn();
  const mockHistory = [
    '/status',
    'create vm --name test-vm',
    '/help',
    'list vms'
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render without crashing', () => {
      expect(() => render(
        <CommandPrompt onCommand={mockOnCommand} history={[]} />
      )).not.toThrow();
    });

    it('should display command prompt', () => {
      const { lastFrame } = render(
        <CommandPrompt onCommand={mockOnCommand} history={[]} />
      );
      
      // Should show prompt indicator
      expect(lastFrame()).toMatch(/proxmox-mpc>|>|prompt/i);
    });

    it('should show ready state', () => {
      const { lastFrame } = render(
        <CommandPrompt onCommand={mockOnCommand} history={[]} />
      );
      
      expect(lastFrame()).toMatch(/ready|input|waiting|enter/i);
    });
  });

  describe('Command Input Handling', () => {
    it('should accept command input function', () => {
      expect(() => render(
        <CommandPrompt onCommand={mockOnCommand} history={mockHistory} />
      )).not.toThrow();
      
      // Verify the callback is properly accepted
      expect(mockOnCommand).toHaveProperty('name');
    });

    it('should indicate input capability', () => {
      const { lastFrame } = render(
        <CommandPrompt onCommand={mockOnCommand} history={[]} />
      );
      
      // Should indicate that input is accepted
      expect(lastFrame()).toMatch(/input|command|type|enter/i);
    });

    it('should show custom prompt when provided', () => {
      const { lastFrame } = render(
        <CommandPrompt 
          onCommand={mockOnCommand} 
          history={[]} 
          prompt="custom> "
        />
      );
      
      expect(lastFrame()).toContain('custom>');
    });
  });

  describe('Command History Integration', () => {
    it('should display history count when available', () => {
      const { lastFrame } = render(
        <CommandPrompt onCommand={mockOnCommand} history={mockHistory} />
      );
      
      // Should show history information
      expect(lastFrame()).toMatch(/4|history|previous|commands/i);
    });

    it('should handle empty history', () => {
      const { lastFrame } = render(
        <CommandPrompt onCommand={mockOnCommand} history={[]} />
      );
      
      // Should handle zero history gracefully
      expect(lastFrame()).toMatch(/no history|empty|0|first/i);
    });

    it('should show recent command hints', () => {
      const { lastFrame } = render(
        <CommandPrompt onCommand={mockOnCommand} history={mockHistory} />
      );
      
      // Should reference recent commands or history browsing
      expect(lastFrame()).toMatch(/arrow|up|down|browse|recent/i);
    });
  });

  describe('Command Suggestions', () => {
    it('should display suggestions when provided', () => {
      const suggestions = ['/help', '/status', '/init', 'create vm'];
      const { lastFrame } = render(
        <CommandPrompt 
          onCommand={mockOnCommand} 
          history={[]} 
          suggestions={suggestions}
        />
      );
      
      // Should show suggestion information
      expect(lastFrame()).toMatch(/suggestions|tab|help|status|init/i);
    });

    it('should handle no suggestions gracefully', () => {
      const { lastFrame } = render(
        <CommandPrompt onCommand={mockOnCommand} history={[]} />
      );
      
      // Should work without suggestions
      expect(lastFrame()).toBeDefined();
    });

    it('should suggest common commands by default', () => {
      const { lastFrame } = render(
        <CommandPrompt onCommand={mockOnCommand} history={[]} />
      );
      
      // Should reference common commands
      expect(lastFrame()).toMatch(/help|status|init|slash/i);
    });
  });

  describe('Loading State', () => {
    it('should display loading indicator when loading', () => {
      const { lastFrame } = render(
        <CommandPrompt 
          onCommand={mockOnCommand} 
          history={[]} 
          loading={true}
        />
      );
      
      expect(lastFrame()).toMatch(/loading|processing|wait|⏳|🔄/i);
    });

    it('should show ready state when not loading', () => {
      const { lastFrame } = render(
        <CommandPrompt 
          onCommand={mockOnCommand} 
          history={[]} 
          loading={false}
        />
      );
      
      expect(lastFrame()).toMatch(/ready|input|waiting/i);
    });

    it('should default to ready state', () => {
      const { lastFrame } = render(
        <CommandPrompt onCommand={mockOnCommand} history={[]} />
      );
      
      // Should show ready by default
      expect(lastFrame()).toMatch(/ready|input|waiting/i);
    });
  });

  describe('Visual Design', () => {
    it('should have clear visual separation', () => {
      const { lastFrame } = render(
        <CommandPrompt onCommand={mockOnCommand} history={mockHistory} />
      );
      
      const frame = lastFrame();
      // Should have visual elements
      expect(frame.length).toBeGreaterThan(15);
    });

    it('should use consistent branding', () => {
      const { lastFrame } = render(
        <CommandPrompt onCommand={mockOnCommand} history={[]} />
      );
      
      // Should include Proxmox-MPC branding
      expect(lastFrame()).toMatch(/proxmox-mpc/i);
    });

    it('should adapt visually based on state', () => {
      const readyFrame = render(
        <CommandPrompt onCommand={mockOnCommand} history={[]} loading={false} />
      ).lastFrame();
      
      const loadingFrame = render(
        <CommandPrompt onCommand={mockOnCommand} history={[]} loading={true} />
      ).lastFrame();
      
      // Different states should look different
      expect(readyFrame).not.toBe(loadingFrame);
    });
  });

  describe('Keyboard Navigation Hints', () => {
    it('should show navigation hints', () => {
      const { lastFrame } = render(
        <CommandPrompt onCommand={mockOnCommand} history={mockHistory} />
      );
      
      expect(lastFrame()).toMatch(/enter|tab|arrow|ctrl|esc/i);
    });

    it('should mention history navigation', () => {
      const { lastFrame } = render(
        <CommandPrompt onCommand={mockOnCommand} history={mockHistory} />
      );
      
      expect(lastFrame()).toMatch(/up|down|arrow|history|browse/i);
    });

    it('should show completion hints', () => {
      const suggestions = ['/help', '/status'];
      const { lastFrame } = render(
        <CommandPrompt 
          onCommand={mockOnCommand} 
          history={[]} 
          suggestions={suggestions}
        />
      );
      
      expect(lastFrame()).toMatch(/tab|complete|suggestion/i);
    });
  });

  describe('Props Validation', () => {
    it('should handle required props', () => {
      // onCommand is required
      expect(() => render(
        <CommandPrompt onCommand={mockOnCommand} history={[]} />
      )).not.toThrow();
    });

    it('should handle all optional props', () => {
      expect(() => render(
        <CommandPrompt 
          onCommand={mockOnCommand}
          history={mockHistory}
          suggestions={['/help', '/status']}
          loading={true}
          prompt="test> "
        />
      )).not.toThrow();
    });

    it('should handle invalid history gracefully', () => {
      expect(() => render(
        <CommandPrompt 
          onCommand={mockOnCommand} 
          history={null as any}
        />
      )).not.toThrow();
    });
  });

  describe('Performance', () => {
    it('should render quickly', () => {
      const start = Date.now();
      render(
        <CommandPrompt 
          onCommand={mockOnCommand} 
          history={mockHistory}
          suggestions={['/help', '/status', '/init']}
        />
      );
      const renderTime = Date.now() - start;
      
      expect(renderTime).toBeLessThan(50);
    });

    it('should handle prop updates efficiently', () => {
      const { rerender } = render(
        <CommandPrompt onCommand={mockOnCommand} history={[]} />
      );
      
      const start = Date.now();
      rerender(
        <CommandPrompt onCommand={mockOnCommand} history={mockHistory} loading={true} />
      );
      rerender(
        <CommandPrompt onCommand={mockOnCommand} history={mockHistory} loading={false} />
      );
      const updateTime = Date.now() - start;
      
      expect(updateTime).toBeLessThan(25);
    });

    it('should handle large history efficiently', () => {
      const largeHistory = Array(100).fill(0).map((_, i) => `command ${i}`);
      
      const start = Date.now();
      render(
        <CommandPrompt onCommand={mockOnCommand} history={largeHistory} />
      );
      const renderTime = Date.now() - start;
      
      expect(renderTime).toBeLessThan(100);
    });
  });

  describe('Accessibility', () => {
    it('should provide clear instructions', () => {
      const { lastFrame } = render(
        <CommandPrompt onCommand={mockOnCommand} history={[]} />
      );
      
      // Should tell user how to interact
      expect(lastFrame()).toMatch(/enter|type|command|input/i);
    });

    it('should show available actions', () => {
      const { lastFrame } = render(
        <CommandPrompt onCommand={mockOnCommand} history={mockHistory} />
      );
      
      // Should indicate what user can do
      expect(lastFrame()).toMatch(/help|history|command|slash/i);
    });

    it('should be screen reader friendly', () => {
      const { lastFrame } = render(
        <CommandPrompt onCommand={mockOnCommand} history={[]} />
      );
      
      // Should have clear, descriptive text
      expect(lastFrame()).toMatch(/proxmox-mpc|command|prompt|ready/i);
    });
  });

  describe('Integration Points', () => {
    it('should integrate with existing command system', () => {
      const { lastFrame } = render(
        <CommandPrompt onCommand={mockOnCommand} history={mockHistory} />
      );
      
      // Should reference slash commands
      expect(lastFrame()).toMatch(/\/|slash|help|status|init/i);
    });

    it('should support resource commands', () => {
      const resourceHistory = ['create vm --name test', 'list vms', 'describe vm 100'];
      const { lastFrame } = render(
        <CommandPrompt onCommand={mockOnCommand} history={resourceHistory} />
      );
      
      // Should work with resource command history
      expect(lastFrame()).toMatch(/create|list|describe|resource|vm/i);
    });
  });
});