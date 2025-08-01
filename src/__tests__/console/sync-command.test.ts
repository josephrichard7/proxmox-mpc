/**
 * Tests for Sync Command
 * Verifies infrastructure discovery and IaC generation
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { SyncCommand } from '../../console/commands/sync';
import { ConsoleSession } from '../../console/repl';
import { ProxmoxClient } from '../../api';
import { TerraformGenerator } from '../../generators/terraform';
import { AnsibleGenerator } from '../../generators/ansible';
import { ProjectWorkspace } from '../../workspace';

// Mock dependencies
jest.mock('../../api');
jest.mock('../../generators/terraform');
jest.mock('../../generators/ansible');
jest.mock('../../workspace');

describe('SyncCommand', () => {
  let syncCommand: SyncCommand;
  let mockSession: ConsoleSession;
  let mockClient: jest.Mocked<ProxmoxClient>;
  let mockWorkspace: jest.Mocked<ProjectWorkspace>;

  beforeEach(() => {
    syncCommand = new SyncCommand();
    
    // Create mock workspace
    mockWorkspace = {
      name: 'test-workspace',
      rootPath: '/test/workspace',
      config: {
        host: '192.168.1.100',
        port: 8006,
        username: 'root@pam',
        tokenId: 'test-token',
        tokenSecret: 'test-secret',
        node: 'proxmox'
      }
    } as any;

    // Create mock client
    mockClient = {
      connect: jest.fn(),
      getNodes: jest.fn(),
      getVMs: jest.fn(),
      getContainers: jest.fn(),
      getStoragePools: jest.fn(),
    } as any;

    // Create mock session
    mockSession = {
      workspace: mockWorkspace,
      client: undefined,
      history: [],
      startTime: new Date(),
      rl: {} as any,
    };

    // Mock console methods
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('execute', () => {
    it('should fail when no workspace is detected', async () => {
      const sessionWithoutWorkspace = { ...mockSession, workspace: undefined };

      await syncCommand.execute([], sessionWithoutWorkspace);

      expect(console.log).toHaveBeenCalledWith('❌ No workspace detected');
      expect(console.log).toHaveBeenCalledWith('   Use /init to create a workspace first');
    });

    it('should fail when connection to Proxmox fails', async () => {
      mockClient.connect.mockResolvedValue({ success: false, error: 'Connection failed' });
      jest.mocked(ProxmoxClient).mockImplementation(() => mockClient);

      await syncCommand.execute([], mockSession);

      expect(console.log).toHaveBeenCalledWith('❌ Failed to connect to Proxmox server');
      expect(console.log).toHaveBeenCalledWith('   Error: Connection failed');
    });

    it('should successfully sync infrastructure when connection succeeds', async () => {
      // Mock successful connection
      mockClient.connect.mockResolvedValue({ 
        success: true, 
        version: '8.0.0',
        details: { endpoint: '192.168.1.100:8006', nodes: 1 }
      });

      // Mock infrastructure discovery
      mockClient.getNodes.mockResolvedValue([
        { node: 'proxmox', status: 'online', cpu: 0.1, maxcpu: 8, mem: 1000000000, maxmem: 8000000000 }
      ]);

      mockClient.getVMs.mockResolvedValue([
        { 
          vmid: 100, 
          name: 'test-vm', 
          status: 'running', 
          node: 'proxmox',
          cpus: 2,
          maxmem: 2147483648,
          maxdisk: 32212254720
        }
      ]);

      mockClient.getContainers.mockResolvedValue([
        { 
          vmid: 101, 
          name: 'test-container', 
          status: 'running', 
          node: 'proxmox',
          cpus: 1,
          maxmem: 1073741824,
          maxdisk: 8589934592
        }
      ]);

      mockClient.getStoragePools.mockResolvedValue([
        { storage: 'local-lvm', type: 'lvm', content: 'images', shared: 0 }
      ]);

      // Mock generators
      const mockTerraformGenerator = {
        generateVMResource: jest.fn(),
        generateContainerResource: jest.fn(),
        generateProviderConfig: jest.fn(),
      };
      const mockAnsibleGenerator = {
        generateInventory: jest.fn(),
        generatePlaybooks: jest.fn(),
      };

      jest.mocked(TerraformGenerator).mockImplementation(() => mockTerraformGenerator as any);
      jest.mocked(AnsibleGenerator).mockImplementation(() => mockAnsibleGenerator as any);
      jest.mocked(ProxmoxClient).mockImplementation(() => mockClient);

      await syncCommand.execute([], mockSession);

      // Verify connection
      expect(mockClient.connect).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith('✅ Connected to Proxmox server');

      // Verify infrastructure discovery
      expect(mockClient.getNodes).toHaveBeenCalled();
      expect(mockClient.getVMs).toHaveBeenCalledWith('proxmox');
      expect(mockClient.getContainers).toHaveBeenCalledWith('proxmox');

      // Verify Terraform generation
      expect(mockTerraformGenerator.generateVMResource).toHaveBeenCalledWith(
        expect.objectContaining({ vmid: 100, name: 'test-vm' })
      );
      expect(mockTerraformGenerator.generateContainerResource).toHaveBeenCalledWith(
        expect.objectContaining({ vmid: 101, name: 'test-container' })
      );
      expect(mockTerraformGenerator.generateProviderConfig).toHaveBeenCalled();

      // Verify Ansible generation
      expect(mockAnsibleGenerator.generateInventory).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ vmid: 100 })]),
        expect.arrayContaining([expect.objectContaining({ vmid: 101 })])
      );
      expect(mockAnsibleGenerator.generatePlaybooks).toHaveBeenCalled();

      // Verify success message
      expect(console.log).toHaveBeenCalledWith('\\n✅ Infrastructure synchronization complete!');
    });

    it('should handle errors during sync gracefully', async () => {
      mockClient.connect.mockResolvedValue({ success: true });
      mockClient.getNodes.mockRejectedValue(new Error('API Error'));
      jest.mocked(ProxmoxClient).mockImplementation(() => mockClient);

      await syncCommand.execute([], mockSession);

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('❌ Sync failed: Infrastructure discovery failed: API Error')
      );
    });

    it('should use existing client if available in session', async () => {
      const existingClient = { ...mockClient };
      existingClient.connect.mockResolvedValue({ success: true });
      existingClient.getNodes.mockResolvedValue([]);
      existingClient.getVMs.mockResolvedValue([]);
      existingClient.getContainers.mockResolvedValue([]);
      existingClient.getStoragePools.mockResolvedValue([]);

      mockSession.client = existingClient;

      const mockTerraformGenerator = {
        generateProviderConfig: jest.fn(),
      };
      const mockAnsibleGenerator = {
        generateInventory: jest.fn(),
        generatePlaybooks: jest.fn(),
      };

      jest.mocked(TerraformGenerator).mockImplementation(() => mockTerraformGenerator as any);
      jest.mocked(AnsibleGenerator).mockImplementation(() => mockAnsibleGenerator as any);

      await syncCommand.execute([], mockSession);

      expect(existingClient.connect).toHaveBeenCalled();
      expect(mockSession.client).toBe(existingClient);
    });
  });

  describe('infrastructure discovery', () => {
    it('should discover multiple nodes', async () => {
      mockClient.connect.mockResolvedValue({ success: true });
      mockClient.getNodes.mockResolvedValue([
        { node: 'proxmox-1', status: 'online' },
        { node: 'proxmox-2', status: 'online' }
      ]);
      mockClient.getVMs.mockResolvedValue([]);
      mockClient.getContainers.mockResolvedValue([]);
      mockClient.getStoragePools.mockResolvedValue([]);

      jest.mocked(ProxmoxClient).mockImplementation(() => mockClient);
      jest.mocked(TerraformGenerator).mockImplementation(() => ({ generateProviderConfig: jest.fn() } as any));
      jest.mocked(AnsibleGenerator).mockImplementation(() => ({ 
        generateInventory: jest.fn(), 
        generatePlaybooks: jest.fn() 
      } as any));

      await syncCommand.execute([], mockSession);

      expect(mockClient.getVMs).toHaveBeenCalledWith('proxmox-1');
      expect(mockClient.getVMs).toHaveBeenCalledWith('proxmox-2');
      expect(mockClient.getContainers).toHaveBeenCalledWith('proxmox-1');
      expect(mockClient.getContainers).toHaveBeenCalledWith('proxmox-2');
    });

    it('should handle node-specific errors gracefully', async () => {
      mockClient.connect.mockResolvedValue({ success: true });
      mockClient.getNodes.mockResolvedValue([
        { node: 'proxmox-1', status: 'online' },
        { node: 'proxmox-2', status: 'offline' }
      ]);
      
      mockClient.getVMs
        .mockResolvedValueOnce([{ vmid: 100, name: 'vm1', status: 'running', node: 'proxmox-1' }])
        .mockRejectedValueOnce(new Error('Node offline'));
      
      mockClient.getContainers
        .mockResolvedValueOnce([])
        .mockRejectedValueOnce(new Error('Node offline'));
      
      mockClient.getStoragePools.mockResolvedValue([]);

      jest.mocked(ProxmoxClient).mockImplementation(() => mockClient);
      jest.mocked(TerraformGenerator).mockImplementation(() => ({ 
        generateVMResource: jest.fn(),
        generateProviderConfig: jest.fn() 
      } as any));
      jest.mocked(AnsibleGenerator).mockImplementation(() => ({ 
        generateInventory: jest.fn(), 
        generatePlaybooks: jest.fn() 
      } as any));

      await syncCommand.execute([], mockSession);

      // Should continue despite errors on one node
      expect(console.log).toHaveBeenCalledWith('✅ Connected to Proxmox server');
      expect(console.log).toHaveBeenCalledWith('\\n✅ Infrastructure synchronization complete!');
    });
  });
});