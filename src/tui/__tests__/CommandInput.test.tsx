/**
 * Tests for CommandInput Component
 * Testing TUI command input with autocomplete and history
 */

import React from 'react';
import { render } from 'ink-testing-library';
import { CommandInput } from '../components/CommandInput';

const mockOnCommand = jest.fn();

describe('CommandInput Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders command prompt', () => {
    const { lastFrame } = render(
      <CommandInput 
        onCommand={mockOnCommand}
        history={[]}
      />
    );
    
    const frame = lastFrame();
    expect(frame).toMatch(/proxmox-mpc>/);
  });

  test('displays custom prompt when provided', () => {
    const { lastFrame } = render(
      <CommandInput 
        onCommand={mockOnCommand}
        history={[]}
        prompt="test> "
      />
    );
    
    const frame = lastFrame();
    expect(frame).toMatch(/test>/);
  });

  test('shows loading state', () => {
    const { lastFrame } = render(
      <CommandInput 
        onCommand={mockOnCommand}
        history={[]}
        loading={true}
      />
    );
    
    const frame = lastFrame();
    expect(frame).toMatch(/processing/);
  });

  test('displays cursor when not loading', () => {
    const { lastFrame } = render(
      <CommandInput 
        onCommand={mockOnCommand}
        history={[]}
        loading={false}
      />
    );
    
    const frame = lastFrame();
    expect(frame).toMatch(/_/); // Cursor character
  });

  // Note: Testing user input and suggestions requires more complex setup
  // with ink's testing utilities and may need integration tests
});