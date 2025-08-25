/**
 * Terraform Configuration Generator
 * Generates Terraform HCL configurations from Proxmox infrastructure
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { ProjectWorkspace } from '../workspace';
import { VMInfo, ContainerInfo, StorageContent, StorageInfo } from '../types';
import { ProxmoxClient } from '../api/proxmox-client';

interface TemplateInfo {
  vmTemplates: string[];
  containerTemplates: string[];
  storages: StorageInfo[];
  defaultStorage: string;
  existingProvider?: string;
}

export class TerraformGenerator {
  private workspace: ProjectWorkspace;
  private templateInfo: TemplateInfo | null = null;
  private proxmoxClient: ProxmoxClient | null = null;

  constructor(workspace: ProjectWorkspace) {
    this.workspace = workspace;
  }

  /**
   * Initialize the generator with template detection
   */
  async initialize(): Promise<void> {
    // Create Proxmox client for template detection
    this.proxmoxClient = new ProxmoxClient(this.workspace.config);
    
    // Detect available templates and existing configurations
    this.templateInfo = await this.detectTemplates();
  }

  /**
   * Detect available templates and existing Terraform configurations
   */
  private async detectTemplates(): Promise<TemplateInfo> {
    const templateInfo: TemplateInfo = {
      vmTemplates: [],
      containerTemplates: [],
      storages: [],
      defaultStorage: 'local-lvm',
      existingProvider: undefined
    };

    try {
      // 1. Check for existing provider configuration
      const existingProvider = await this.detectExistingProvider();
      if (existingProvider) {
        templateInfo.existingProvider = existingProvider;
      }

      // 2. Get storage information from Proxmox
      if (this.proxmoxClient) {
        templateInfo.storages = await this.proxmoxClient.getStoragePools();
        
        // Find default storage - prefer local-lvm, then first available
        const defaultStorage = templateInfo.storages.find(s => s.storage === 'local-lvm') ||
                              templateInfo.storages.find(s => s.enabled && s.content?.includes('images')) ||
                              templateInfo.storages[0];
        
        if (defaultStorage) {
          templateInfo.defaultStorage = defaultStorage.storage;
        }

        // 3. Detect VM templates from all storages
        for (const storage of templateInfo.storages) {
          if (storage.enabled && storage.content?.includes('images')) {
            try {
              const content = await this.proxmoxClient.getStorageContent(
                this.workspace.config.node, 
                storage.storage
              );
              
              // Find VM templates (ISOs and VM disk images marked as templates)
              const vmTemplates = content
                .filter(item => 
                  item.content === 'iso' || 
                  (item.content === 'images' && item.volid.includes('template'))
                )
                .map(item => item.volid);
              
              templateInfo.vmTemplates.push(...vmTemplates);
            } catch (error) {
              // Ignore storage access errors, continue with other storages
              console.warn(`Could not access storage ${storage.storage}:`, error);
            }
          }
        }

        // 4. Detect container templates
        for (const storage of templateInfo.storages) {
          if (storage.enabled && storage.content?.includes('vztmpl')) {
            try {
              const content = await this.proxmoxClient.getStorageContent(
                this.workspace.config.node,
                storage.storage
              );
              
              // Find container templates
              const containerTemplates = content
                .filter(item => item.content === 'vztmpl')
                .map(item => item.volid);
              
              templateInfo.containerTemplates.push(...containerTemplates);
            } catch (error) {
              // Ignore storage access errors, continue with other storages
              console.warn(`Could not access storage ${storage.storage}:`, error);
            }
          }
        }
      }

      // 5. Sort and deduplicate templates
      templateInfo.vmTemplates = [...new Set(templateInfo.vmTemplates)].sort();
      templateInfo.containerTemplates = [...new Set(templateInfo.containerTemplates)].sort();

    } catch (error) {
      console.warn('Template detection failed, using defaults:', error);
    }

    return templateInfo;
  }

  /**
   * Check for existing provider configuration in workspace
   */
  private async detectExistingProvider(): Promise<string | undefined> {
    try {
      // Check main.tf in terraform directory
      const mainTfPath = path.join(this.workspace.rootPath, 'terraform', 'main.tf');
      const content = await fs.readFile(mainTfPath, 'utf8');
      
      // Extract provider configuration if it exists
      const providerMatch = content.match(/provider\s+"proxmox"\s*{[\s\S]*?}/);
      return providerMatch?.[0];
    } catch (error) {
      // File doesn't exist or isn't readable
      return undefined;
    }
  }

  /**
   * Generate Terraform configuration for a VM
   */
  async generateVMResource(vm: VMInfo): Promise<void> {
    // Ensure templates are detected
    if (!this.templateInfo) {
      await this.initialize();
    }

    const resourceName = this.sanitizeResourceName(vm.name || `vm-${vm.vmid}`);
    
    // Determine best template to use
    const cloneTemplate = this.selectVMTemplate();
    const storageBackend = this.templateInfo?.defaultStorage || 'local-lvm';
    
    const config = `# VM: ${vm.name || vm.vmid} (ID: ${vm.vmid})
# Generated by Proxmox-MPC from existing infrastructure
# Available templates detected: ${this.templateInfo?.vmTemplates.slice(0, 3).join(', ') || 'none'}

resource "proxmox_vm_qemu" "${resourceName}" {
  name        = "${vm.name || `vm-${vm.vmid}`}"
  target_node = var.default_node
  vmid        = ${vm.vmid}
  
  # VM Configuration
  cores       = ${vm.cpus || 1}
  memory      = ${vm.maxmem ? Math.floor(vm.maxmem / 1024 / 1024) : 1024}
  
  # Template and OS
  ${cloneTemplate ? `clone       = "${cloneTemplate}"` : '# clone       = "your-template-name"  # Set your VM template'}
  full_clone  = true
  
  # Boot and BIOS
  bios        = "ovmf"
  boot        = "order=scsi0"
  
  # Agent and Features
  agent       = 1
  
  # Network Configuration
  network {
    model  = "virtio"
    bridge = "vmbr0"
  }
  
  # Disk Configuration
  disk {
    type    = "scsi"
    storage = "${storageBackend}"
    size    = "${vm.maxdisk ? Math.floor(vm.maxdisk / 1024 / 1024 / 1024) : 20}G"
    cache   = "writethrough"
  }
  
  # Lifecycle
  lifecycle {
    ignore_changes = [
      ${cloneTemplate ? 'clone,' : '# clone,'}
      full_clone,
      disk,
      network,
    ]
  }
  
  # Tags
  tags = "proxmox-mpc,imported,${vm.status}"
}

# Output VM information
output "${resourceName}_info" {
  description = "Information about VM ${vm.name || vm.vmid}"
  value = {
    name      = proxmox_vm_qemu.${resourceName}.name
    vmid      = proxmox_vm_qemu.${resourceName}.vmid
    node      = proxmox_vm_qemu.${resourceName}.target_node
    cores     = proxmox_vm_qemu.${resourceName}.cores
    memory    = proxmox_vm_qemu.${resourceName}.memory
  }
}
`;

    // Write to terraform/vms/ directory
    const vmDir = path.join(this.workspace.rootPath, 'terraform', 'vms');
    await fs.mkdir(vmDir, { recursive: true });
    
    const filePath = path.join(vmDir, `${resourceName}.tf`);
    await fs.writeFile(filePath, config);
  }

  /**
   * Generate Terraform configuration for a container
   */
  async generateContainerResource(container: ContainerInfo): Promise<void> {
    // Ensure templates are detected
    if (!this.templateInfo) {
      await this.initialize();
    }

    const resourceName = this.sanitizeResourceName(container.name || `ct-${container.vmid}`);
    
    // Determine best template to use
    const osTemplate = this.selectContainerTemplate();
    const storageBackend = this.templateInfo?.defaultStorage || 'local-lvm';
    
    const config = `# Container: ${container.name || container.vmid} (ID: ${container.vmid})
# Generated by Proxmox-MPC from existing infrastructure
# Available templates detected: ${this.templateInfo?.containerTemplates.slice(0, 3).join(', ') || 'none'}

resource "proxmox_lxc" "${resourceName}" {
  hostname     = "${container.name || `ct-${container.vmid}`}"
  target_node  = var.default_node
  vmid         = ${container.vmid}
  
  # Container Configuration  
  cores        = ${container.cpus || 1}
  memory       = ${container.maxmem ? Math.floor(container.maxmem / 1024 / 1024) : 512}
  swap         = 512
  
  # Template and Distribution
  ${osTemplate ? `ostemplate   = "${osTemplate}"` : '# ostemplate   = "storage:vztmpl/template-name"  # Set your container template'}
  unprivileged = true
  
  # SSH and Access
  ssh_public_keys = var.ssh_public_keys
  
  # Network Configuration
  network {
    name     = "eth0"
    bridge   = "vmbr0"
    ip       = "dhcp"
    firewall = false
  }
  
  # Root Filesystem
  rootfs {
    storage = "${storageBackend}"
    size    = "${container.maxdisk ? Math.floor(container.maxdisk / 1024 / 1024 / 1024) : 8}G"
  }
  
  # Features
  features {
    nesting = true
    fuse    = true
  }
  
  # Lifecycle
  lifecycle {
    ignore_changes = [
      ${osTemplate ? 'ostemplate,' : '# ostemplate,'}
      ssh_public_keys,
      network,
      rootfs,
    ]
  }
  
  # Tags
  tags = "proxmox-mpc,imported,${container.status}"
}

# Output container information
output "${resourceName}_info" {
  description = "Information about container ${container.name || container.vmid}"
  value = {
    hostname  = proxmox_lxc.${resourceName}.hostname
    vmid      = proxmox_lxc.${resourceName}.vmid
    node      = proxmox_lxc.${resourceName}.target_node
    cores     = proxmox_lxc.${resourceName}.cores
    memory    = proxmox_lxc.${resourceName}.memory
  }
}
`;

    // Write to terraform/containers/ directory
    const containerDir = path.join(this.workspace.rootPath, 'terraform', 'containers');
    await fs.mkdir(containerDir, { recursive: true });
    
    const filePath = path.join(containerDir, `${resourceName}.tf`);
    await fs.writeFile(filePath, config);
  }

  /**
   * Generate main Terraform provider configuration
   */
  async generateProviderConfig(): Promise<void> {
    // Ensure templates are detected
    if (!this.templateInfo) {
      await this.initialize();
    }

    // Use existing provider if available, otherwise generate new one
    const providerConfig = this.templateInfo?.existingProvider || this.generateProviderBlock();
    
    const config = `# Proxmox Infrastructure Configuration
# Generated by Proxmox-MPC
# Last updated: ${new Date().toISOString()}
# Detected storages: ${this.templateInfo?.storages.map(s => s.storage).join(', ') || 'none'}

terraform {
  required_version = ">= 1.0"
  
  required_providers {
    proxmox = {
      source  = "telmate/proxmox"
      version = "~> 2.9"
    }
  }
}

# Proxmox Provider Configuration
${providerConfig}

# Variables
variable "proxmox_token_id" {
  description = "Proxmox API Token ID"
  type        = string
  sensitive   = true
  default     = "${this.workspace.config.tokenId}"
}

variable "proxmox_token_secret" {
  description = "Proxmox API Token Secret"  
  type        = string
  sensitive   = true
  default     = "${this.workspace.config.tokenSecret}"
}

variable "default_node" {
  description = "Default Proxmox node for resources"
  type        = string
  default     = "${this.workspace.config.node}"
}

variable "ssh_public_keys" {
  description = "SSH public keys for container access"
  type        = string
  default     = file("~/.ssh/id_rsa.pub")
}

# Data sources
data "proxmox_nodes" "available" {}

# Local values
locals {
  timestamp = "${new Date().toISOString()}"
  project   = "${this.workspace.name}"
  storages  = [${this.templateInfo?.storages.map(s => `"${s.storage}"`).join(', ') || ''}]
}

# Outputs
output "project_info" {
  description = "Project information"
  value = {
    name      = local.project
    timestamp = local.timestamp
    server    = "${this.workspace.config.host}:${this.workspace.config.port}"
    node      = var.default_node
    storages  = local.storages
  }
}
`;

    const mainPath = path.join(this.workspace.rootPath, 'terraform', 'main.tf');
    await fs.writeFile(mainPath, config);
  }

  /**
   * Generate provider block
   */
  private generateProviderBlock(): string {
    return `provider "proxmox" {
  pm_api_url          = "https://${this.workspace.config.host}:${this.workspace.config.port}/api2/json"
  pm_api_token_id     = var.proxmox_token_id
  pm_api_token_secret = var.proxmox_token_secret
  pm_tls_insecure     = ${!this.workspace.config.rejectUnauthorized}
}`;
  }

  /**
   * Select best VM template from available templates
   */
  private selectVMTemplate(): string | null {
    if (!this.templateInfo || this.templateInfo.vmTemplates.length === 0) {
      return null;
    }

    // Prefer common cloud templates
    const preferred = [
      'ubuntu-cloud',
      'ubuntu-22.04-cloud',
      'ubuntu-20.04-cloud',
      'debian-cloud',
      'centos-cloud'
    ];

    // Look for preferred templates first
    for (const pref of preferred) {
      const match = this.templateInfo.vmTemplates.find(t => 
        t.toLowerCase().includes(pref.toLowerCase())
      );
      if (match) return match;
    }

    // Look for any template containing 'template' or 'cloud'
    const templateMatch = this.templateInfo.vmTemplates.find(t => 
      t.toLowerCase().includes('template') || t.toLowerCase().includes('cloud')
    );
    if (templateMatch) return templateMatch;

    // Return first available template
    return this.templateInfo.vmTemplates[0] || null;
  }

  /**
   * Select best container template from available templates
   */
  private selectContainerTemplate(): string | null {
    if (!this.templateInfo || this.templateInfo.containerTemplates.length === 0) {
      return null;
    }

    // Prefer recent Ubuntu/Debian templates
    const preferred = [
      'ubuntu-22.04',
      'ubuntu-20.04',
      'debian-11',
      'debian-10',
      'ubuntu',
      'debian'
    ];

    // Look for preferred templates first
    for (const pref of preferred) {
      const match = this.templateInfo.containerTemplates.find(t => 
        t.toLowerCase().includes(pref.toLowerCase()) && t.includes('standard')
      );
      if (match) return match;
    }

    // Look for any Ubuntu or Debian template
    const ubuntuMatch = this.templateInfo.containerTemplates.find(t => 
      t.toLowerCase().includes('ubuntu') || t.toLowerCase().includes('debian')
    );
    if (ubuntuMatch) return ubuntuMatch;

    // Return first available template
    return this.templateInfo.containerTemplates[0] || null;
  }

  /**
   * Get template information (for external use)
   */
  async getTemplateInfo(): Promise<TemplateInfo | null> {
    if (!this.templateInfo) {
      await this.initialize();
    }
    return this.templateInfo;
  }

  /**
   * Sanitize names for Terraform resource names
   */
  private sanitizeResourceName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/^([0-9])/, '_$1')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }
}