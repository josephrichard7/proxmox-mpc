import React from 'react';
import { render } from 'ink-testing-library';
import { Header } from '../../components/Header';
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

describe('Header Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render without crashing', () => {
      expect(() => render(
        <Header connectionStatus="disconnected" />
      )).not.toThrow();
    });

    it('should display application name and version', () => {
      const { lastFrame } = render(
        <Header connectionStatus="disconnected" />
      );
      
      expect(lastFrame()).toContain('Proxmox-MPC');
      expect(lastFrame()).toMatch(/v?\d+\.\d+\.\d+/);
    });

    it('should display subtitle or tagline', () => {
      const { lastFrame } = render(
        <Header connectionStatus="disconnected" />
      );
      
      expect(lastFrame()).toMatch(/infrastructure|console|interactive/i);
    });
  });

  describe('Connection Status Display', () => {
    it('should display connected status', () => {
      const { lastFrame } = render(
        <Header connectionStatus="connected" />
      );
      
      expect(lastFrame()).toMatch(/connected|online|✅|🟢/i);
    });

    it('should display disconnected status', () => {
      const { lastFrame } = render(
        <Header connectionStatus="disconnected" />
      );
      
      expect(lastFrame()).toMatch(/disconnected|offline|❌|🔴/i);
    });

    it('should display connecting status', () => {
      const { lastFrame } = render(
        <Header connectionStatus="connecting" />
      );
      
      expect(lastFrame()).toMatch(/connecting|loading|⏳|🟡/i);
    });
  });

  describe('Workspace Information', () => {
    it('should display workspace name when provided', () => {
      const { lastFrame } = render(
        <Header 
          connectionStatus="connected" 
          workspace={mockWorkspace} 
        />
      );
      
      expect(lastFrame()).toContain('test-workspace');
    });

    it('should display server information when workspace is provided', () => {
      const { lastFrame } = render(
        <Header 
          connectionStatus="connected" 
          workspace={mockWorkspace} 
        />
      );
      
      expect(lastFrame()).toContain('192.168.1.100');
      expect(lastFrame()).toContain('pve-01');
    });

    it('should handle missing workspace gracefully', () => {
      const { lastFrame } = render(
        <Header connectionStatus="disconnected" />
      );
      
      // Should not crash and should indicate no workspace
      expect(lastFrame()).toBeDefined();
      expect(lastFrame()).toMatch(/no workspace|not configured/i);
    });
  });

  describe('Current Screen Display', () => {
    it('should display current screen when provided', () => {
      const { lastFrame } = render(
        <Header 
          connectionStatus="connected" 
          currentScreen="Resource List" 
        />
      );
      
      expect(lastFrame()).toContain('Resource List');
    });

    it('should display default screen when not provided', () => {
      const { lastFrame } = render(
        <Header connectionStatus="connected" />
      );
      
      expect(lastFrame()).toMatch(/main|home|console/i);
    });
  });

  describe('Visual Design', () => {
    it('should have consistent branding elements', () => {
      const { lastFrame } = render(
        <Header connectionStatus="connected" />
      );
      
      // Should include branded elements
      expect(lastFrame()).toMatch(/🔧|⚡|🏗️|proxmox/i);
    });

    it('should provide visual separation', () => {
      const { lastFrame } = render(
        <Header connectionStatus="connected" workspace={mockWorkspace} />
      );
      
      const frame = lastFrame();
      // Should have multiple sections or visual elements
      expect(frame.length).toBeGreaterThan(20);
    });

    it('should adapt to different connection states visually', () => {
      const connectedFrame = render(
        <Header connectionStatus="connected" workspace={mockWorkspace} />
      ).lastFrame();
      
      const disconnectedFrame = render(
        <Header connectionStatus="disconnected" workspace={mockWorkspace} />
      ).lastFrame();
      
      // Frames should be different for different connection states
      expect(connectedFrame).not.toBe(disconnectedFrame);
    });
  });

  describe('Props Validation', () => {
    it('should handle all connection status options', () => {
      const statuses: Array<'connected' | 'disconnected' | 'connecting'> = 
        ['connected', 'disconnected', 'connecting'];
      
      statuses.forEach(status => {
        expect(() => render(
          <Header connectionStatus={status} />
        )).not.toThrow();
      });
    });

    it('should handle optional props gracefully', () => {
      // Should work with minimal props
      expect(() => render(
        <Header connectionStatus="disconnected" />
      )).not.toThrow();
      
      // Should work with all props
      expect(() => render(
        <Header 
          connectionStatus="connected" 
          workspace={mockWorkspace}
          currentScreen="Test Screen"
        />
      )).not.toThrow();
    });
  });

  describe('Performance', () => {
    it('should render quickly', () => {
      const start = Date.now();
      render(
        <Header 
          connectionStatus="connected" 
          workspace={mockWorkspace}
          currentScreen="Performance Test"
        />
      );
      const renderTime = Date.now() - start;
      
      expect(renderTime).toBeLessThan(50);
    });

    it('should handle prop updates efficiently', () => {
      const { rerender } = render(
        <Header connectionStatus="disconnected" />
      );
      
      const start = Date.now();
      rerender(
        <Header connectionStatus="connected" workspace={mockWorkspace} />
      );
      rerender(
        <Header connectionStatus="connecting" workspace={mockWorkspace} />
      );
      const updateTime = Date.now() - start;
      
      expect(updateTime).toBeLessThan(25);
    });
  });

  describe('Accessibility', () => {
    it('should provide clear status indicators', () => {
      const { lastFrame } = render(
        <Header connectionStatus="connected" workspace={mockWorkspace} />
      );
      
      // Should have clear status information (Connected indicates connection status)
      expect(lastFrame()).toMatch(/connected|disconnected|connecting|status|state/i);
    });

    it('should show workspace context clearly', () => {
      const { lastFrame } = render(
        <Header connectionStatus="connected" workspace={mockWorkspace} />
      );
      
      // Should clearly indicate workspace context
      expect(lastFrame()).toMatch(/workspace|project|environment/i);
    });
  });
});