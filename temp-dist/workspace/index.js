"use strict";
/**
 * Project Workspace Management
 * Handles initialization and management of Proxmox project workspaces
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectWorkspace = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const yaml = __importStar(require("js-yaml"));
class ProjectWorkspace {
    constructor(rootPath, config) {
        this.rootPath = rootPath;
        this.name = config.name || path.basename(rootPath);
        this.configPath = path.join(rootPath, '.proxmox', 'config.yml');
        this.databasePath = path.join(rootPath, '.proxmox', 'state.db');
        this.config = config;
    }
    /**
     * Create a new project workspace
     */
    static async create(rootPath, config) {
        const workspaceConfig = {
            ...config,
            name: path.basename(rootPath),
            created: new Date().toISOString(),
            version: '0.1.0'
        };
        // Create directory structure
        await this.createDirectoryStructure(rootPath);
        // Save configuration
        const configPath = path.join(rootPath, '.proxmox', 'config.yml');
        await fs.writeFile(configPath, yaml.dump(workspaceConfig, {
            indent: 2,
            lineWidth: -1
        }));
        // Create initial database
        await this.initializeDatabase(rootPath);
        // Create README files
        await this.createDocumentation(rootPath, workspaceConfig);
        return new ProjectWorkspace(rootPath, workspaceConfig);
    }
    /**
     * Detect existing workspace in directory
     */
    static async detect(searchPath) {
        const configPath = path.join(searchPath, '.proxmox', 'config.yml');
        try {
            const configContent = await fs.readFile(configPath, 'utf8');
            const config = yaml.load(configContent);
            return new ProjectWorkspace(searchPath, config);
        }
        catch (error) {
            // No workspace found
            return null;
        }
    }
    static async createDirectoryStructure(rootPath) {
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
    static async initializeDatabase(rootPath) {
        // TODO: Initialize SQLite database
        // For now, just create an empty file
        const dbPath = path.join(rootPath, '.proxmox', 'state.db');
        await fs.writeFile(dbPath, '');
    }
    static async createDocumentation(rootPath, config) {
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
exports.ProjectWorkspace = ProjectWorkspace;
