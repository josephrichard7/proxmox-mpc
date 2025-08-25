/**
 * Tests for Terraform Generator
 * Verifies Terraform HCL configuration generation
 */

import * as fs from 'fs/promises';
import * as path from 'path';

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

import { TerraformGenerator } from '../../generators/terraform';
import { VMInfo, ContainerInfo } from '../../types';
import { ProjectWorkspace } from '../../workspace';

// Mock fs module
jest.mock('fs/promises');

describe('TerraformGenerator', () => {
  let generator: TerraformGenerator;
  let mockWorkspace: ProjectWorkspace;
  let mockFS: jest.Mocked<typeof fs>;

  beforeEach(() => {
    mockWorkspace = {
      name: 'test-workspace',
      rootPath: '/test/workspace',
      config: {
        host: '192.168.1.100',
        port: 8006,
        username: 'root@pam',
        tokenId: 'test-token',
        tokenSecret: 'test-secret',
        node: 'proxmox',
        rejectUnauthorized: false
      }
    } as any;

    generator = new TerraformGenerator(mockWorkspace);
    mockFS = jest.mocked(fs);
    
    // Mock fs methods
    mockFS.mkdir = jest.fn().mockResolvedValue(undefined);
    mockFS.writeFile = jest.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('generateVMResource', () => {
    it('should generate proper Terraform configuration for a VM', async () => {
      const vm: VMInfo = {
        vmid: 100,
        name: 'test-vm',
        status: 'running',
        node: 'proxmox',
        cpus: 4,
        maxmem: 4294967296, // 4GB in bytes
        maxdisk: 42949672960, // 40GB in bytes
        netin: 0,
        netout: 0,
        diskread: 0,
        diskwrite: 0,
        cpu: 0.1,
        mem: 1000000000,
        uptime: 3600
      };

      await generator.generateVMResource(vm);

      // Verify directory creation
      expect(mockFS.mkdir).toHaveBeenCalledWith('/test/workspace/terraform/vms', { recursive: true });

      // Verify file write
      expect(mockFS.writeFile).toHaveBeenCalledWith(
        '/test/workspace/terraform/vms/test_vm.tf',
        expect.stringContaining('resource "proxmox_vm_qemu" "test_vm"')
      );

      // Verify content includes VM details
      const writtenContent = (mockFS.writeFile as jest.Mock).mock.calls[0][1];
      expect(writtenContent).toContain('name        = "test-vm"');
      expect(writtenContent).toContain('vmid        = 100');
      expect(writtenContent).toContain('cores       = 4');
      expect(writtenContent).toContain('memory      = 4096'); // Should convert bytes to MB
      expect(writtenContent).toContain('size    = "40G"'); // Should convert bytes to GB
      expect(writtenContent).toContain('tags = "proxmox-mpc,imported,running"');
    });

    it('should handle VMs without names', async () => {
      const vm: VMInfo = {
        vmid: 101,
        name: undefined,
        status: 'stopped',
        node: 'proxmox',
        cpus: 2,
        maxmem: 2147483648, // 2GB
        maxdisk: 21474836480, // 20GB
        netin: 0,
        netout: 0,
        diskread: 0,
        diskwrite: 0,
        cpu: 0,
        mem: 0,
        uptime: 0
      } as any;

      await generator.generateVMResource(vm);

      const writtenContent = (mockFS.writeFile as jest.Mock).mock.calls[0][1];
      expect(writtenContent).toContain('name        = "vm-101"');
      expect(writtenContent).toContain('resource "proxmox_vm_qemu" "vm_101"');
    });

    it('should sanitize resource names properly', async () => {
      const vm: VMInfo = {
        vmid: 102,
        name: 'test-vm-with-special!@#chars',
        status: 'running',
        node: 'proxmox',
        cpus: 1,
        maxmem: 1073741824,
        maxdisk: 10737418240,
        netin: 0,
        netout: 0,
        diskread: 0,
        diskwrite: 0,
        cpu: 0.05,
        mem: 500000000,
        uptime: 1800
      };

      await generator.generateVMResource(vm);

      expect(mockFS.writeFile).toHaveBeenCalledWith(
        '/test/workspace/terraform/vms/test_vm_with_special_chars.tf',
        expect.stringContaining('resource "proxmox_vm_qemu" "test_vm_with_special_chars"')
      );
    });

    it('should handle VMs with missing optional fields', async () => {
      const vm: VMInfo = {
        vmid: 103,
        name: 'minimal-vm',
        status: 'running',
        node: 'proxmox',
        // Missing cpus, maxmem, maxdisk
        netin: 0,
        netout: 0,
        diskread: 0,
        diskwrite: 0,
        cpu: 0,
        mem: 0,
        uptime: 0
      } as any;

      await generator.generateVMResource(vm);

      const writtenContent = (mockFS.writeFile as jest.Mock).mock.calls[0][1];
      expect(writtenContent).toContain('cores       = 1'); // Default value
      expect(writtenContent).toContain('memory      = 1024'); // Default value
      expect(writtenContent).toContain('size    = "20G"'); // Default value
    });
  });

  describe('generateContainerResource', () => {
    it('should generate proper Terraform configuration for a container', async () => {
      const container: ContainerInfo = {
        vmid: 200,
        name: 'test-container',
        status: 'running',
        node: 'proxmox',
        cpus: 2,
        maxmem: 1073741824, // 1GB
        maxswap: 1073741824, // 1GB
        maxdisk: 8589934592, // 8GB
        netin: 0,
        netout: 0,
        diskread: 0,
        diskwrite: 0,
        cpu: 0.05,
        mem: 500000000,
        uptime: 7200
      };

      await generator.generateContainerResource(container);

      // Verify directory creation
      expect(mockFS.mkdir).toHaveBeenCalledWith('/test/workspace/terraform/containers', { recursive: true });

      // Verify file write
      expect(mockFS.writeFile).toHaveBeenCalledWith(
        '/test/workspace/terraform/containers/test_container.tf',
        expect.stringContaining('resource "proxmox_lxc" "test_container"')
      );

      // Verify content includes container details
      const writtenContent = (mockFS.writeFile as jest.Mock).mock.calls[0][1];
      expect(writtenContent).toContain('hostname     = "test-container"');
      expect(writtenContent).toContain('vmid         = 200');
      expect(writtenContent).toContain('cores        = 2');
      expect(writtenContent).toContain('memory       = 1024'); // Should convert bytes to MB
      expect(writtenContent).toContain('swap         = 1024'); // Should convert bytes to MB
      expect(writtenContent).toContain('size    = "8G"'); // Should convert bytes to GB
      expect(writtenContent).toContain('tags = "proxmox-mpc,imported,running"');
    });

    it('should handle containers without names', async () => {
      const container: ContainerInfo = {
        vmid: 201,
        name: undefined,
        status: 'stopped',
        node: 'proxmox',
        cpus: 1,
        maxmem: 536870912, // 512MB
        maxswap: 536870912,
        maxdisk: 4294967296, // 4GB
        netin: 0,
        netout: 0,
        diskread: 0,
        diskwrite: 0,
        cpu: 0,
        mem: 0,
        uptime: 0
      } as any;

      await generator.generateContainerResource(container);

      const writtenContent = (mockFS.writeFile as jest.Mock).mock.calls[0][1];
      expect(writtenContent).toContain('hostname     = "ct-201"');
      expect(writtenContent).toContain('resource "proxmox_lxc" "ct_201"');
    });
  });

  describe('generateProviderConfig', () => {
    it('should generate proper main.tf with provider configuration', async () => {
      await generator.generateProviderConfig();

      expect(mockFS.writeFile).toHaveBeenCalledWith(
        '/test/workspace/terraform/main.tf',
        expect.stringContaining('terraform {')
      );

      const writtenContent = (mockFS.writeFile as jest.Mock).mock.calls[0][1];
      
      // Verify provider configuration
      expect(writtenContent).toContain('provider "proxmox"');
      expect(writtenContent).toContain('pm_api_url          = "https://192.168.1.100:8006/api2/json"');
      expect(writtenContent).toContain('pm_tls_insecure     = true');
      
      // Verify variables
      expect(writtenContent).toContain('variable "proxmox_token_id"');
      expect(writtenContent).toContain('variable "proxmox_token_secret"');
      expect(writtenContent).toContain('variable "default_node"');
      
      // Verify defaults
      expect(writtenContent).toContain('default     = "test-token"');
      expect(writtenContent).toContain('default     = "test-secret"');
      expect(writtenContent).toContain('default     = "proxmox"');
      
      // Verify outputs
      expect(writtenContent).toContain('output "project_info"');
      expect(writtenContent).toContain('name      = local.project');
    });

    it('should handle SSL verification correctly', async () => {
      // Test with SSL verification enabled
      mockWorkspace.config.rejectUnauthorized = true;
      generator = new TerraformGenerator(mockWorkspace);

      await generator.generateProviderConfig();

      const writtenContent = (mockFS.writeFile as jest.Mock).mock.calls[0][1];
      expect(writtenContent).toContain('pm_tls_insecure     = false');
    });
  });

  describe('resource name sanitization', () => {
    it('should sanitize various problematic characters', async () => {
      const testCases = [
        { input: 'test-vm', expected: 'test_vm' },
        { input: 'test.vm', expected: 'test_vm' },
        { input: 'test@vm', expected: 'test_vm' },
        { input: '123vm', expected: '_123vm' }, // Leading number
        { input: 'test___vm', expected: 'test_vm' }, // Multiple underscores
        { input: '_test_vm_', expected: 'test_vm' }, // Leading/trailing underscores
        { input: 'TEST-VM', expected: 'test_vm' }, // Uppercase
      ];

      for (const testCase of testCases) {
        const vm: VMInfo = {
          vmid: 100,
          name: testCase.input,
          status: 'running',
          node: 'proxmox',
          cpus: 1,
          maxmem: 1073741824,
          maxdisk: 10737418240,
          netin: 0,
          netout: 0,
          diskread: 0,
          diskwrite: 0,
          cpu: 0,
          mem: 0,
          uptime: 0
        };

        await generator.generateVMResource(vm);

        const fileName = path.basename((mockFS.writeFile as jest.Mock).mock.calls.slice(-1)[0][0]);
        expect(fileName).toBe(`${testCase.expected}.tf`);

        jest.clearAllMocks();
      }
    });
  });
});