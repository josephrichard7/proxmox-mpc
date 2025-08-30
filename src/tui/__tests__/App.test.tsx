/**
 * Tests for TUI App Component
 * Following TDD methodology
 */

import React from 'react';
import { render } from 'ink-testing-library';
import { App } from '../App';
import { ConsoleSession } from '../types';

// Mock session data for testing
const mockSession: ConsoleSession = {
  rl: null,
  history: [],
  startTime: new Date(),
};

const mockSessionWithWorkspace: ConsoleSession = {
  ...mockSession,
  workspace: {
    name: 'test-workspace',
    config: {
      host: 'test.example.com',
      node: 'test-node',
      projectName: 'Test Project',
    },
  } as any,
};

describe('TUI App Component', () => {
  test('renders without crashing', () => {
    const { lastFrame } = render(
      <App 
        session={mockSession} 
        connectionStatus="disconnected"
      />
    );
    expect(lastFrame()).toBeDefined();
  });

  test('displays app header with name and version', () => {
    const { lastFrame } = render(
      <App 
        session={mockSession} 
        connectionStatus="disconnected"
      />
    );
    const frame = lastFrame();
    expect(frame).toMatch(/Proxmox-MPC/);
    expect(frame).toMatch(/\d+\.\d+\.\d+/);
  });

  test('shows connection status', () => {
    const { lastFrame } = render(
      <App 
        session={mockSession} 
        connectionStatus="disconnected"
      />
    );
    const frame = lastFrame();
    expect(frame).toMatch(/DISCONNECTED/);
  });

  test('displays no workspace message when none initialized', () => {
    const { lastFrame } = render(
      <App 
        session={mockSession} 
        connectionStatus="disconnected"
      />
    );
    const frame = lastFrame();
    expect(frame).toMatch(/No workspace initialized/);
  });

  test('displays workspace information when available', () => {
    const { lastFrame } = render(
      <App 
        session={mockSessionWithWorkspace} 
        connectionStatus="connected"
      />
    );
    const frame = lastFrame();
    expect(frame).toMatch(/test-workspace/);
    expect(frame).toMatch(/test.example.com/);
    expect(frame).toMatch(/test-node/);
  });

  test('shows command history count when available', () => {
    const sessionWithHistory: ConsoleSession = {
      ...mockSession,
      history: ['/init', '/status', '/help'],
    };
    
    const { lastFrame } = render(
      <App 
        session={sessionWithHistory} 
        connectionStatus="disconnected"
      />
    );
    const frame = lastFrame();
    expect(frame).toMatch(/3 previous commands/);
  });

  test('displays command prompt area', () => {
    const { lastFrame } = render(
      <App 
        session={mockSession} 
        connectionStatus="disconnected"
      />
    );
    const frame = lastFrame();
    expect(frame).toMatch(/proxmox-mpc>/);
  });
});