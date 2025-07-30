/**
 * Tests for ProjectWorkspace
 * Testing workspace creation, detection, and management
 */

import { ProjectWorkspace, WorkspaceConfig } from '../index';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';

// Mock fs operations
jest.mock('fs/promises');
const mockFs = fs as jest.Mocked<typeof fs>;

// Mock yaml
jest.mock('js-yaml');
const mockYaml = yaml as jest.Mocked<typeof yaml>;

describe('ProjectWorkspace', () => {
  const testRootPath = '/test/workspace';
  const testConfig: WorkspaceConfig = {
    host: 'test.example.com',
    port: 8006,
    username: 'root@pam',
    tokenId: 'test-token',
    tokenSecret: 'test-secret',
    node: 'test-node',
    rejectUnauthorized: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize workspace with correct properties', () => {
      const configWithName = { ...testConfig, name: 'test-project' };
      const workspace = new ProjectWorkspace(testRootPath, configWithName);

      expect(workspace.rootPath).toBe(testRootPath);
      expect(workspace.name).toBe('test-project');
      expect(workspace.configPath).toBe(path.join(testRootPath, '.proxmox', 'config.yml'));
      expect(workspace.databasePath).toBe(path.join(testRootPath, '.proxmox', 'state.db'));
      expect(workspace.config).toEqual(configWithName);
    });

    it('should use directory name as default project name', () => {
      const workspace = new ProjectWorkspace('/path/to/my-project', testConfig);

      expect(workspace.name).toBe('my-project');
    });
  });

  describe('create', () => {
    beforeEach(() => {
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
      mockYaml.dump.mockReturnValue('config: yaml');
    });

    it('should create workspace with correct structure', async () => {
      const workspace = await ProjectWorkspace.create(testRootPath, testConfig);

      expect(workspace.rootPath).toBe(testRootPath);
      expect(workspace.name).toBe('workspace');
      expect(workspace.config.name).toBe('workspace');
      expect(workspace.config.created).toBeDefined();
      expect(workspace.config.version).toBe('0.1.0');
    });

    it('should create all required directories', async () => {
      await ProjectWorkspace.create(testRootPath, testConfig);

      const expectedDirectories = [
        '.proxmox',
        '.proxmox/history',
        '.proxmox/cache',
        'terraform',
        'terraform/vms',
        'terraform/containers',
        'terraform/networks',
        'terraform/storage',
        'ansible',
        'ansible/group_vars',
        'ansible/host_vars',
        'ansible/playbooks',
        'ansible/roles',
        'tests',
        'tests/integration',
        'tests/performance',
        'docs',
        'scripts'
      ];

      expectedDirectories.forEach(dir => {
        expect(mockFs.mkdir).toHaveBeenCalledWith(
          path.join(testRootPath, dir),
          { recursive: true }
        );
      });
    });

    it('should save configuration as YAML', async () => {
      await ProjectWorkspace.create(testRootPath, testConfig);

      expect(mockYaml.dump).toHaveBeenCalledWith(
        expect.objectContaining({
          ...testConfig,
          name: 'workspace',
          created: expect.any(String),
          version: '0.1.0'
        }),
        { indent: 2, lineWidth: -1 }
      );

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        path.join(testRootPath, '.proxmox', 'config.yml'),
        'config: yaml'
      );
    });

    it('should create database file', async () => {
      await ProjectWorkspace.create(testRootPath, testConfig);

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        path.join(testRootPath, '.proxmox', 'state.db'),
        ''
      );
    });

    it('should create documentation files', async () => {
      await ProjectWorkspace.create(testRootPath, testConfig);

      // Should create README.md
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        path.join(testRootPath, 'README.md'),
        expect.stringContaining('# workspace')
      );

      // Should create terraform/main.tf
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        path.join(testRootPath, 'terraform', 'main.tf'),
        expect.stringContaining('terraform {')
      );

      // Should create ansible/inventory.yml
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        path.join(testRootPath, 'ansible', 'inventory.yml'),
        expect.stringContaining('all:')
      );

      // Should create .gitignore
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        path.join(testRootPath, '.gitignore'),
        expect.stringContaining('.proxmox/config.yml')
      );
    });
  });

  describe('detect', () => {
    it('should return workspace when config exists', async () => {
      const mockConfig = { ...testConfig, name: 'existing-project' };
      mockFs.readFile.mockResolvedValue('config content');
      mockYaml.load.mockReturnValue(mockConfig);

      const workspace = await ProjectWorkspace.detect(testRootPath);

      expect(mockFs.readFile).toHaveBeenCalledWith(
        path.join(testRootPath, '.proxmox', 'config.yml'),
        'utf8'
      );
      expect(mockYaml.load).toHaveBeenCalledWith('config content');
      expect(workspace).toBeInstanceOf(ProjectWorkspace);
      expect(workspace?.config).toEqual(mockConfig);
    });

    it('should return null when config does not exist', async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      const workspace = await ProjectWorkspace.detect(testRootPath);

      expect(workspace).toBeNull();
    });

    it('should return null when config is invalid', async () => {
      mockFs.readFile.mockResolvedValue('invalid yaml');
      mockYaml.load.mockImplementation(() => {
        throw new Error('Invalid YAML');
      });

      const workspace = await ProjectWorkspace.detect(testRootPath);

      expect(workspace).toBeNull();
    });
  });

  describe('generated files content', () => {
    beforeEach(() => {
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
      mockYaml.dump.mockReturnValue('config: yaml');
    });

    it('should generate README with correct project information', async () => {
      const configWithName = { ...testConfig, name: 'my-awesome-project' };
      await ProjectWorkspace.create('/test/my-awesome-project', configWithName);

      const readmeCall = mockFs.writeFile.mock.calls.find(call => 
        call[0].toString().endsWith('README.md')
      );
      const readmeContent = readmeCall?.[1] as string;

      expect(readmeContent).toContain('# my-awesome-project');
      expect(readmeContent).toContain('**Server**: test.example.com:8006');
      expect(readmeContent).toContain('**Node**: test-node');
      expect(readmeContent).toContain('proxmox-mpc');
    });

    it('should generate Terraform main.tf with correct provider config', async () => {
      await ProjectWorkspace.create(testRootPath, testConfig);

      const terraformCall = mockFs.writeFile.mock.calls.find(call => 
        call[0].toString().endsWith('terraform/main.tf')
      );
      const terraformContent = terraformCall?.[1] as string;

      expect(terraformContent).toContain('required_providers {');
      expect(terraformContent).toContain('telmate/proxmox');
      expect(terraformContent).toContain('https://test.example.com:8006/api2/json');
      expect(terraformContent).toContain('pm_tls_insecure     = true');
      expect(terraformContent).toContain('default     = "test-node"');
    });

    it('should generate Ansible inventory with correct hosts', async () => {
      await ProjectWorkspace.create(testRootPath, testConfig);

      const ansibleCall = mockFs.writeFile.mock.calls.find(call => 
        call[0].toString().endsWith('ansible/inventory.yml')
      );
      const ansibleContent = ansibleCall?.[1] as string;

      expect(ansibleContent).toContain('proxmox_nodes:');
      expect(ansibleContent).toContain('test-node:');
      expect(ansibleContent).toContain('ansible_host: test.example.com');
    });

    it('should generate .gitignore with security-sensitive files', async () => {
      await ProjectWorkspace.create(testRootPath, testConfig);

      const gitignoreCall = mockFs.writeFile.mock.calls.find(call => 
        call[0].toString().endsWith('.gitignore')
      );
      const gitignoreContent = gitignoreCall?.[1] as string;

      expect(gitignoreContent).toContain('.proxmox/config.yml');
      expect(gitignoreContent).toContain('.proxmox/state.db');
      expect(gitignoreContent).toContain('*.tfstate');
      expect(gitignoreContent).toContain('*.tfvars');
      expect(gitignoreContent).toContain('.vault_pass');
    });
  });
});