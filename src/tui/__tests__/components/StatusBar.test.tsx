import React from 'react';
import { render } from 'ink-testing-library';
import { StatusBar } from '../../components/StatusBar';
import { ConsoleSession } from '../../types';
import { ProjectWorkspace } from '../../../workspace';

// Mock workspace
const mockWorkspace: ProjectWorkspace = {
  name: 'test-workspace',
  config: {
    host: '192.168.1.100',
    port: 8006,
    node: 'pve-01',
    username: 'test@pam',
    tokenId: 'test-token',
    tokenSecret: 'test-secret',
    rejectUnauthorized: false,
  },
  rootPath: '/test/workspace',
  configPath: '/test/workspace/.proxmox/config.yml',
  databasePath: '/test/workspace/.proxmox/state.db',
  getDatabaseClient: jest.fn(),
  testDatabaseConnection: jest.fn(),
} as ProjectWorkspace;

const mockSession: ConsoleSession = {
  workspace: mockWorkspace,
  client: undefined,
  rl: {} as any,
  history: ['command1', 'command2', 'command3'],
  startTime: new Date(Date.now() - 300000), // 5 minutes ago
};

const mockSessionNoWorkspace: ConsoleSession = {
  workspace: undefined,
  client: undefined,
  rl: {} as any,
  history: [],
  startTime: new Date(Date.now() - 60000), // 1 minute ago
};

describe('StatusBar Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render without crashing', () => {
      expect(() => render(
        <StatusBar session={mockSession} connectionStatus="connected" />
      )).not.toThrow();
    });

    it('should display session information', () => {
      const { lastFrame } = render(
        <StatusBar session={mockSession} connectionStatus="connected" />
      );
      
      // Should contain session-related information
      expect(lastFrame()).toMatch(/session|time|duration/i);
    });

    it('should be visually separated from main content', () => {
      const { lastFrame } = render(
        <StatusBar session={mockSession} connectionStatus="connected" />
      );
      
      // Should have visual indicators of being a status bar
      const frame = lastFrame();
      expect(frame.length).toBeGreaterThan(10);
    });
  });

  describe('Session Information Display', () => {
    it('should display session duration', () => {
      const { lastFrame } = render(
        <StatusBar session={mockSession} connectionStatus="connected" />
      );
      
      // Should show time information
      expect(lastFrame()).toMatch(/\d+[ms]|time|duration|second|minute/i);
    });

    it('should display command history count', () => {
      const { lastFrame } = render(
        <StatusBar session={mockSession} connectionStatus="connected" />
      );
      
      // Should show history information
      expect(lastFrame()).toMatch(/3|history|command/i);
    });

    it('should handle empty history', () => {
      const { lastFrame } = render(
        <StatusBar session={mockSessionNoWorkspace} connectionStatus="disconnected" />
      );
      
      // Should handle zero commands gracefully
      expect(lastFrame()).toMatch(/0|empty|no commands/i);
    });
  });

  describe('Connection Status Display', () => {
    it('should display connected status with indicator', () => {
      const { lastFrame } = render(
        <StatusBar session={mockSession} connectionStatus="connected" />
      );
      
      expect(lastFrame()).toMatch(/connected|🟢|✅/i);
    });

    it('should display disconnected status with indicator', () => {
      const { lastFrame } = render(
        <StatusBar session={mockSession} connectionStatus="disconnected" />
      );
      
      expect(lastFrame()).toMatch(/disconnected|🔴|❌/i);
    });

    it('should display connecting status with indicator', () => {
      const { lastFrame } = render(
        <StatusBar session={mockSession} connectionStatus="connecting" />
      );
      
      expect(lastFrame()).toMatch(/connecting|🟡|⏳/i);
    });
  });

  describe('Workspace Status Display', () => {
    it('should show workspace name when available', () => {
      const { lastFrame } = render(
        <StatusBar session={mockSession} connectionStatus="connected" />
      );
      
      expect(lastFrame()).toContain('test-workspace');
    });

    it('should indicate no workspace when not available', () => {
      const { lastFrame } = render(
        <StatusBar session={mockSessionNoWorkspace} connectionStatus="disconnected" />
      );
      
      expect(lastFrame()).toMatch(/no workspace|not configured|none/i);
    });

    it('should display server information when workspace is available', () => {
      const { lastFrame } = render(
        <StatusBar session={mockSession} connectionStatus="connected" />
      );
      
      expect(lastFrame()).toMatch(/192\.168\.1\.100|pve-01/);
    });
  });

  describe('Time Display', () => {
    it('should show time when showTime is true', () => {
      const { lastFrame } = render(
        <StatusBar 
          session={mockSession} 
          connectionStatus="connected" 
          showTime={true}
        />
      );
      
      expect(lastFrame()).toMatch(/time|clock|\d{1,2}:\d{2}|uptime/i);
    });

    it('should not show time when showTime is false', () => {
      const { lastFrame } = render(
        <StatusBar 
          session={mockSession} 
          connectionStatus="connected" 
          showTime={false}
        />
      );
      
      const frame = lastFrame();
      // Should not contain time patterns when disabled
      expect(frame).not.toMatch(/\d{1,2}:\d{2}:\d{2}/);
    });

    it('should show time by default', () => {
      const { lastFrame } = render(
        <StatusBar session={mockSession} connectionStatus="connected" />
      );
      
      // Default behavior should include time information
      expect(lastFrame()).toMatch(/time|duration|second|minute/i);
    });
  });

  describe('Layout and Positioning', () => {
    it('should have left and right sections', () => {
      const { lastFrame } = render(
        <StatusBar session={mockSession} connectionStatus="connected" />
      );
      
      const frame = lastFrame();
      // Should have content distributed (basic check)
      expect(frame.length).toBeGreaterThan(20);
    });

    it('should justify content appropriately', () => {
      const { lastFrame } = render(
        <StatusBar session={mockSession} connectionStatus="connected" />
      );
      
      // Should contain both session info and connection status
      const frame = lastFrame();
      expect(frame).toMatch(/session|time/i);
      expect(frame).toMatch(/connected|disconnected/i);
    });
  });

  describe('Visual Design', () => {
    it('should use appropriate colors for different states', () => {
      const connectedFrame = render(
        <StatusBar session={mockSession} connectionStatus="connected" />
      ).lastFrame();
      
      const disconnectedFrame = render(
        <StatusBar session={mockSession} connectionStatus="disconnected" />
      ).lastFrame();
      
      // Different states should produce different output
      expect(connectedFrame).not.toBe(disconnectedFrame);
    });

    it('should be compact and informative', () => {
      const { lastFrame } = render(
        <StatusBar session={mockSession} connectionStatus="connected" />
      );
      
      const frame = lastFrame();
      // Should be informative but not too verbose
      expect(frame.length).toBeGreaterThan(10);
      expect(frame.length).toBeLessThan(500);
    });
  });

  describe('Props Validation', () => {
    it('should handle all connection status types', () => {
      const statuses: Array<'connected' | 'disconnected' | 'connecting'> = 
        ['connected', 'disconnected', 'connecting'];
      
      statuses.forEach(status => {
        expect(() => render(
          <StatusBar session={mockSession} connectionStatus={status} />
        )).not.toThrow();
      });
    });

    it('should handle sessions with missing data gracefully', () => {
      const invalidSession = {
        ...mockSession,
        history: null as any,
        startTime: null as any,
      };
      
      expect(() => render(
        <StatusBar session={invalidSession} connectionStatus="connected" />
      )).not.toThrow();
    });
  });

  describe('Performance', () => {
    it('should render quickly', () => {
      const start = Date.now();
      render(
        <StatusBar session={mockSession} connectionStatus="connected" />
      );
      const renderTime = Date.now() - start;
      
      expect(renderTime).toBeLessThan(50);
    });

    it('should handle frequent updates efficiently', () => {
      const { rerender } = render(
        <StatusBar session={mockSession} connectionStatus="disconnected" />
      );
      
      const start = Date.now();
      for (let i = 0; i < 5; i++) {
        rerender(
          <StatusBar 
            session={{
              ...mockSession,
              history: [`command ${i}`]
            }} 
            connectionStatus={i % 2 === 0 ? 'connected' : 'disconnected'} 
          />
        );
      }
      const updateTime = Date.now() - start;
      
      expect(updateTime).toBeLessThan(50);
    });
  });

  describe('Accessibility', () => {
    it('should provide clear status information', () => {
      const { lastFrame } = render(
        <StatusBar session={mockSession} connectionStatus="connected" />
      );
      
      // Should clearly communicate current status
      expect(lastFrame()).toMatch(/connected|workspace|session/i);
    });

    it('should show actionable information', () => {
      const { lastFrame } = render(
        <StatusBar session={mockSessionNoWorkspace} connectionStatus="disconnected" />
      );
      
      // Should indicate what state the system is in
      expect(lastFrame()).toMatch(/disconnected|no workspace/i);
    });
  });
});