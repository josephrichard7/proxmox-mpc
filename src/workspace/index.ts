/**
 * Project Workspace Management
 * Handles initialization and management of Proxmox project workspaces
 */

import * as fs from 'fs/promises';
import * as path from 'path';

import { ConfigManager, WorkspaceConfig } from '../config';

/**
 * Represents a Proxmox-MPC project workspace
 * 
 * A workspace is a directory containing project configuration, database,
 * and generated Infrastructure-as-Code files. Each workspace is tied to
 * a specific Proxmox server and contains all resources for that environment.
 * 
 * @example
 * ```typescript
 * // Create a new workspace
 * const config = {
 *   host: 'pve.example.com',
 *   port: 8006,
 *   username: 'root@pam',
 *   tokenId: 'my-token',
 *   tokenSecret: 'secret',
 *   node: 'pve'
 * };
 * 
 * const workspace = await ProjectWorkspace.create('/path/to/project', config);
 * console.log(`Workspace created: ${workspace.name}`);
 * 
 * // Detect existing workspace
 * const existing = await ProjectWorkspace.detect('/path/to/existing');
 * if (existing) {
 *   console.log(`Found workspace: ${existing.name}`);
 *   console.log(`Server: ${existing.config.host}`);
 * }
 * ```
 */
export class ProjectWorkspace {
  public readonly rootPath: string;
  public readonly name: string;
  public readonly configPath: string;
  public readonly databasePath: string;
  public readonly config: WorkspaceConfig;

  constructor(rootPath: string, config: WorkspaceConfig) {
    this.rootPath = rootPath;
    this.name = config.name || path.basename(rootPath);
    this.configPath = path.join(rootPath, '.proxmox', 'config.yml');
    this.databasePath = path.join(rootPath, '.proxmox', 'state.db');
    this.config = config;
  }

  /**
   * Get a database client connected to this workspace's database
   */
  async getDatabaseClient(): Promise<any> {
    const { PrismaClient } = await import('@prisma/client');
    
    // Create client with workspace-specific database URL
    const client = new PrismaClient({
      datasources: {
        db: {
          url: `file:${this.databasePath}`
        }
      },
      log: process.env.NODE_ENV === 'development' ? ['error'] : ['error']
    });
    
    return client;
  }

  /**
   * Test database connectivity for this workspace
   */
  async testDatabaseConnection(): Promise<boolean> {
    try {
      const client = await this.getDatabaseClient();
      await client.$connect();
      
      // Simple health check
      await client.node.count();
      
      await client.$disconnect();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Create a new project workspace
   */
  static async create(rootPath: string, config: Omit<WorkspaceConfig, 'name' | 'created' | 'version'>): Promise<ProjectWorkspace> {
    const workspaceConfig: WorkspaceConfig = {
      ...config,
      name: path.basename(rootPath),
      created: new Date().toISOString(),
      version: '0.1.0'
    };

    // Create directory structure
    await this.createDirectoryStructure(rootPath);

    // Save configuration using unified config manager
    const configPath = ConfigManager.getWorkspaceConfigPath(rootPath);
    await ConfigManager.saveWorkspaceConfig(configPath, workspaceConfig);

    // Create initial database
    await this.initializeDatabase(rootPath);

    // Create README files
    await this.createDocumentation(rootPath, workspaceConfig);

    return new ProjectWorkspace(rootPath, workspaceConfig);
  }

  /**
   * Detect existing workspace in directory
   */
  static async detect(searchPath: string): Promise<ProjectWorkspace | null> {
    const configPath = ConfigManager.getWorkspaceConfigPath(searchPath);
    
    try {
      // Use synchronous version to maintain compatibility
      const fsSync = require('fs');
      const configContent = fsSync.readFileSync(configPath, 'utf8');
      const yaml = require('js-yaml');
      const config = yaml.load(configContent) as WorkspaceConfig;
      
      // Validate the loaded configuration
      ConfigManager.validateWorkspaceConfig(config);
      
      return new ProjectWorkspace(searchPath, config);
    } catch (error) {
      // No workspace found or invalid configuration
      return null;
    }
  }

  private static async createDirectoryStructure(rootPath: string): Promise<void> {
    const directories = [
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

    for (const dir of directories) {
      await fs.mkdir(path.join(rootPath, dir), { recursive: true });
    }
  }

  private static async initializeDatabase(rootPath: string): Promise<void> {
    const dbPath = path.join(rootPath, '.proxmox', 'state.db');
    
    // Set DATABASE_URL environment variable for this workspace
    const originalDatabaseUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = `file:${dbPath}`;
    
    try {
      // Import Prisma client and create database schema
      const { PrismaClient } = await import('@prisma/client');
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      // Find the project root directory (where schema.prisma is located)
      const { findPackageRoot } = await import('../utils/find-package-root');
      let projectRoot: string;
      try {
        projectRoot = findPackageRoot(__dirname);
      } catch {
        // Fallback - assume we're in the project
        projectRoot = path.resolve(__dirname, '../..');
      }
      
      const schemaPath = path.join(projectRoot, 'prisma', 'schema.prisma');
      
      // Run Prisma migration to create database schema
      await execAsync(`npx prisma db push --accept-data-loss --schema="${schemaPath}"`, {
        env: {
          ...process.env,
          DATABASE_URL: `file:${dbPath}`
        },
        cwd: projectRoot
      });
      
      // Test database connection
      const prisma = new PrismaClient();
      await prisma.$connect();
      
      // Verify schema by counting tables (should not throw)
      await prisma.node.count();
      await prisma.vM.count();
      await prisma.container.count();
      await prisma.storage.count();
      await prisma.task.count();
      await prisma.stateSnapshot.count();
      
      await prisma.$disconnect();
      
    } catch (error) {
      // Clean up database file on failure
      try {
        await fs.unlink(dbPath);
      } catch (unlinkError) {
        // Ignore cleanup errors
      }
      
      // Restore original DATABASE_URL
      if (originalDatabaseUrl) {
        process.env.DATABASE_URL = originalDatabaseUrl;
      } else {
        delete process.env.DATABASE_URL;
      }
      
      throw new Error(`Failed to initialize database: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    // Restore original DATABASE_URL
    if (originalDatabaseUrl) {
      process.env.DATABASE_URL = originalDatabaseUrl;
    } else {
      delete process.env.DATABASE_URL;
    }
  }

  private static async createDocumentation(rootPath: string, config: WorkspaceConfig): Promise<void> {
    // Create main README
    const readmeContent = `# ${config.name}

Proxmox Infrastructure Project

## Overview

This project manages Proxmox Virtual Environment infrastructure using Infrastructure-as-Code.

**Server**: ${config.host}:${config.port}  
**Node**: ${config.node}  
**Created**: ${config.created}

## Directory Structure

- \`.proxmox/\` - Project configuration and local database
- \`terraform/\` - Terraform infrastructure configurations
- \`ansible/\` - Ansible configuration management
- \`tests/\` - Infrastructure validation tests
- \`docs/\` - Project documentation
- \`scripts/\` - Utility scripts

## Getting Started

1. Launch the interactive console:
   \`\`\`bash
   proxmox-mpc
   \`\`\`

2. Check project status:
   \`\`\`
   proxmox-mpc> /status
   \`\`\`

3. Import existing infrastructure:
   \`\`\`
   proxmox-mpc> /sync
   \`\`\`

4. Create new resources:
   \`\`\`
   proxmox-mpc> create vm --name web-01 --cores 2 --memory 4096
   \`\`\`

5. Test and deploy:
   \`\`\`
   proxmox-mpc> /test
   proxmox-mpc> /apply
   \`\`\`

## Documentation

- [Architecture](docs/architecture.md) - Infrastructure overview
- [Runbooks](docs/runbooks/) - Operational procedures
- [VISION.md](../VISION.md) - Project vision and concepts
- [PLAN.md](../PLAN.md) - Implementation roadmap

Generated by Proxmox-MPC v${config.version}
`;

    await fs.writeFile(path.join(rootPath, 'README.md'), readmeContent);

    // Create Terraform main.tf
    const terraformMain = `# Proxmox Infrastructure Configuration
# Generated by Proxmox-MPC

terraform {
  required_version = ">= 1.0"
  
  required_providers {
    proxmox = {
      source  = "telmate/proxmox"
      version = "~> 2.9"
    }
  }
}

provider "proxmox" {
  pm_api_url          = "https://${config.host}:${config.port}/api2/json"
  pm_api_token_id     = var.proxmox_token_id
  pm_api_token_secret = var.proxmox_token_secret
  pm_tls_insecure     = ${!config.rejectUnauthorized}
}

# Variables
variable "proxmox_token_id" {
  description = "Proxmox API Token ID"
  type        = string
  sensitive   = true
}

variable "proxmox_token_secret" {
  description = "Proxmox API Token Secret"
  type        = string
  sensitive   = true
}

variable "default_node" {
  description = "Default Proxmox node"
  type        = string
  default     = "${config.node}"
}
`;

    await fs.writeFile(path.join(rootPath, 'terraform', 'main.tf'), terraformMain);

    // Create Ansible inventory
    const ansibleInventory = `# Ansible Inventory
# Generated by Proxmox-MPC

all:
  vars:
    ansible_user: root
    ansible_ssh_common_args: '-o StrictHostKeyChecking=no'
  
  children:
    proxmox_nodes:
      hosts:
        ${config.node}:
          ansible_host: ${config.host}
    
    vms:
      hosts:
        # VMs will be added here automatically
    
    containers:
      hosts:
        # Containers will be added here automatically
`;

    await fs.writeFile(path.join(rootPath, 'ansible', 'inventory.yml'), ansibleInventory);

    // Create .gitignore
    const gitignore = `# Proxmox-MPC project files
.proxmox/config.yml
.proxmox/state.db*
.proxmox/cache/

# Terraform files
*.tfstate
*.tfstate.*
*.tfvars
.terraform/
.terraform.lock.hcl

# Ansible files
*.retry
.vault_pass

# IDE files
.vscode/
.idea/
*.swp
*.swo

# OS files
.DS_Store
Thumbs.db
`;

    await fs.writeFile(path.join(rootPath, '.gitignore'), gitignore);
  }
}