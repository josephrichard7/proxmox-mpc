# Infrastructure as Code

Proxmox-MPC automatically transforms your Proxmox Virtual Environment into declarative, version-controlled Infrastructure-as-Code with comprehensive Terraform and Ansible generation.

## 🎯 Overview

Infrastructure as Code (IaC) with Proxmox-MPC provides:

- **✅ Automatic Generation**: Convert existing infrastructure to IaC configurations
- **🔄 Bidirectional Sync**: Keep IaC files synchronized with server state  
- **📝 Declarative Management**: Define desired state, let Proxmox-MPC handle implementation
- **🧪 Test Integration**: Automatic test generation for infrastructure validation
- **📚 Version Control**: Full Git integration for infrastructure versioning

## 🏗️ Generated Infrastructure Structure

### Complete Project Layout

When you initialize a Proxmox-MPC project, it creates a comprehensive IaC structure:

```
my-proxmox-project/
├── .proxmox/
│   ├── config.yml           # Server connection configuration
│   ├── state.db            # Local SQLite database
│   └── history/            # Infrastructure state snapshots
├── terraform/
│   ├── main.tf             # Main Terraform configuration
│   ├── variables.tf        # Input variables
│   ├── outputs.tf          # Output values
│   ├── providers.tf        # Provider configurations
│   ├── vms/
│   │   ├── web-server.tf   # Individual VM configurations
│   │   ├── database.tf     # Database server configuration
│   │   └── app-server.tf   # Application server configuration
│   └── containers/
│       ├── monitoring.tf   # LXC container configurations
│       └── logging.tf      # Logging container configuration
├── ansible/
│   ├── inventory.yml       # Dynamic inventory
│   ├── ansible.cfg         # Ansible configuration
│   ├── playbooks/
│   │   ├── site.yml        # Main playbook
│   │   ├── vm-baseline.yml # VM base configuration
│   │   └── container-config.yml # Container configuration
│   ├── roles/
│   │   ├── common/         # Common server setup
│   │   ├── monitoring/     # Monitoring setup
│   │   └── security/       # Security hardening
│   └── group_vars/
│       ├── all.yml         # Global variables
│       └── proxmox_vms.yml # VM-specific variables
├── tests/
│   ├── infrastructure.test.js  # Main infrastructure tests
│   ├── vms/
│   │   ├── connectivity.test.js # VM connectivity tests
│   │   └── performance.test.js  # Performance validation
│   └── containers/
│       └── health.test.js      # Container health tests
└── docs/
    ├── README.md           # Project documentation
    └── architecture.md    # Infrastructure architecture
```

## 🔧 Terraform Integration

### Automatic Terraform Generation

Proxmox-MPC generates production-ready Terraform configurations from your existing infrastructure:

```hcl
# Generated terraform/main.tf
terraform {
  required_version = ">= 1.0"
  
  required_providers {
    proxmox = {
      source  = "bpg/proxmox"
      version = "~> 0.60"
    }
  }
}

provider "proxmox" {
  endpoint  = var.proxmox_endpoint
  api_token = var.proxmox_api_token
  ssh {
    agent    = true
    username = var.proxmox_ssh_username
  }
}

# Import all VM and container modules
module "vms" {
  source = "./vms"
  
  proxmox_endpoint = var.proxmox_endpoint
  default_storage  = var.default_storage
  default_network  = var.default_network
}

module "containers" {
  source = "./containers"
  
  proxmox_endpoint = var.proxmox_endpoint
  default_storage  = var.default_storage
}
```

### Generated VM Configuration

Each VM gets its own Terraform file with complete configuration:

```hcl
# Generated terraform/vms/web-server.tf
resource "proxmox_vm_qemu" "web_server" {
  name         = "web-server"
  vmid         = "100"
  target_node  = "proxmox-node-01"
  clone        = var.vm_template_name
  full_clone   = true
  
  # Hardware configuration
  cores   = 4
  memory  = 8192
  scsihw  = "virtio-scsi-pci"
  
  # Boot configuration
  boot    = "order=scsi0;ide0;net0"
  agent   = 1
  
  # Disk configuration
  disks {
    scsi {
      scsi0 {
        disk {
          storage = var.vm_storage
          size    = "50G"
          format  = "raw"
          iothread = true
        }
      }
    }
  }
  
  # Network configuration
  network {
    model  = "virtio"
    bridge = "vmbr0"
    tag    = var.vlan_id
  }
  
  # Cloud-init configuration (if applicable)
  cicustom = "vendor=local:snippets/vendor-data.yml"
  
  # VM-specific configuration
  startup  = "order=1,up=30"
  onboot   = true
  
  # Resource tags for organization
  tags = "environment:${var.environment},role:web,managed_by:proxmox-mpc"
  
  # Lifecycle management
  lifecycle {
    prevent_destroy = true
    ignore_changes = [
      network,  # Allow manual network changes
      disk,     # Allow manual disk additions
    ]
  }
}

# Output VM information for other resources
output "web_server_id" {
  value = proxmox_vm_qemu.web_server.id
}

output "web_server_ip" {
  value = proxmox_vm_qemu.web_server.default_ipv4_address
}
```

### Container Configuration

LXC containers are also fully templated:

```hcl
# Generated terraform/containers/monitoring.tf
resource "proxmox_lxc" "monitoring" {
  vmid         = "200"
  hostname     = "monitoring-ct"
  target_node  = "proxmox-node-01"
  ostemplate   = "local:vztmpl/ubuntu-22.04-standard_22.04-1_amd64.tar.zst"
  password     = var.container_password
  unprivileged = true
  
  # Resource allocation
  cores  = 2
  memory = 2048
  swap   = 512
  
  # Root filesystem
  rootfs {
    storage = var.container_storage
    size    = "20G"
  }
  
  # Network configuration
  network {
    name   = "eth0"
    bridge = "vmbr0"
    ip     = "dhcp"
    ip6    = "auto"
  }
  
  # Container features
  features {
    nesting = true
    mount   = "nfs"
  }
  
  # Auto-start configuration
  onboot  = true
  startup = "order=2,up=60"
  
  tags = "environment:${var.environment},type:container,service:monitoring"
}
```

### Variables and Configuration

Terraform variables for flexible configuration:

```hcl
# Generated terraform/variables.tf
variable "proxmox_endpoint" {
  description = "Proxmox VE API endpoint"
  type        = string
  default     = "https://192.168.1.100:8006"
}

variable "proxmox_api_token" {
  description = "Proxmox VE API token for authentication"
  type        = string
  sensitive   = true
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "development"
}

variable "vm_template_name" {
  description = "Default VM template to clone from"
  type        = string
  default     = "ubuntu-22.04-template"
}

variable "vm_storage" {
  description = "Default storage for VM disks"
  type        = string
  default     = "local-lvm"
}

variable "container_storage" {
  description = "Default storage for containers"
  type        = string
  default     = "local"
}

variable "default_network" {
  description = "Default network bridge"
  type        = string
  default     = "vmbr0"
}

variable "vlan_id" {
  description = "VLAN ID for VM networks"
  type        = number
  default     = null
}

# Environment-specific configurations
variable "vm_configs" {
  description = "VM-specific configurations"
  type = map(object({
    cores      = number
    memory     = number
    disk_size  = string
    template   = string
    startup    = string
  }))
  
  default = {
    web-server = {
      cores     = 4
      memory    = 8192
      disk_size = "50G"
      template  = "ubuntu-22.04-template"
      startup   = "order=1,up=30"
    }
    database = {
      cores     = 8
      memory    = 16384
      disk_size = "100G"
      template  = "ubuntu-22.04-template"
      startup   = "order=2,up=60"
    }
  }
}
```

## 📖 Ansible Integration

### Dynamic Inventory Generation

Proxmox-MPC generates dynamic Ansible inventories that automatically update:

```yaml
# Generated ansible/inventory.yml
all:
  children:
    proxmox_vms:
      hosts:
        web-server:
          ansible_host: "{{ hostvars['web-server']['ansible_default_ipv4']['address'] | default('192.168.1.102') }}"
          proxmox_vmid: 100
          proxmox_node: "proxmox-node-01"
          vm_role: "web"
          vm_environment: "development"
          
        database-server:
          ansible_host: "{{ hostvars['database-server']['ansible_default_ipv4']['address'] | default('192.168.1.103') }}"
          proxmox_vmid: 101
          proxmox_node: "proxmox-node-01"
          vm_role: "database"
          vm_environment: "development"
          
    proxmox_containers:
      hosts:
        monitoring-ct:
          ansible_host: "{{ hostvars['monitoring-ct']['ansible_default_ipv4']['address'] | default('192.168.1.200') }}"
          proxmox_vmid: 200
          proxmox_node: "proxmox-node-01"
          container_role: "monitoring"
          container_type: "lxc"
          
    # Group by roles
    web_servers:
      hosts:
        web-server:
      vars:
        nginx_version: "1.22"
        ssl_enabled: true
        
    database_servers:
      hosts:
        database-server:
      vars:
        mysql_version: "8.0"
        backup_enabled: true
        
    monitoring_systems:
      hosts:
        monitoring-ct:
      vars:
        prometheus_version: "2.40"
        grafana_version: "9.3"

  vars:
    # Global variables
    ansible_user: "ubuntu"
    ansible_ssh_private_key_file: "~/.ssh/proxmox_key"
    ansible_python_interpreter: "/usr/bin/python3"
    
    # Proxmox-specific variables
    proxmox_api_host: "192.168.1.100"
    proxmox_api_port: 8006
    proxmox_cluster_name: "homelab"
```

### Configuration Playbooks

Main site playbook for orchestrating all configuration:

```yaml
# Generated ansible/playbooks/site.yml
---
- name: Configure all Proxmox infrastructure
  hosts: all
  become: true
  gather_facts: true
  
  pre_tasks:
    - name: Update package cache
      apt:
        update_cache: true
        cache_valid_time: 3600
      when: ansible_os_family == "Debian"
      
    - name: Install common packages
      package:
        name:
          - curl
          - wget
          - htop
          - vim
          - git
        state: present

  roles:
    - common
    - { role: security, tags: ['security'] }
    - { role: monitoring, tags: ['monitoring'] }

- name: Configure web servers
  hosts: web_servers
  become: true
  roles:
    - nginx
    - ssl-certificates
    - { role: firewall, tags: ['security'] }

- name: Configure database servers  
  hosts: database_servers
  become: true
  roles:
    - mysql
    - database-backup
    - { role: security, tags: ['security'] }

- name: Configure monitoring systems
  hosts: monitoring_systems
  become: true
  roles:
    - prometheus
    - grafana
    - alertmanager
```

### Role-Based Configuration

Generated Ansible roles for common tasks:

```yaml
# Generated ansible/roles/common/tasks/main.yml
---
- name: Set hostname
  hostname:
    name: "{{ inventory_hostname }}"

- name: Configure timezone
  timezone:
    name: "{{ system_timezone | default('UTC') }}"

- name: Create administrative user
  user:
    name: "{{ admin_user | default('admin') }}"
    groups: sudo
    shell: /bin/bash
    create_home: true
    password: "{{ admin_password | password_hash('sha512') }}"

- name: Configure SSH keys
  authorized_key:
    user: "{{ admin_user | default('admin') }}"
    key: "{{ item }}"
  loop: "{{ ssh_public_keys }}"
  when: ssh_public_keys is defined

- name: Configure system limits
  pam_limits:
    domain: "*"
    limit_type: "{{ item.type }}"
    limit_item: "{{ item.item }}"
    value: "{{ item.value }}"
  loop:
    - { type: 'soft', item: 'nofile', value: '65536' }
    - { type: 'hard', item: 'nofile', value: '65536' }

- name: Configure logrotate
  template:
    src: logrotate.conf.j2
    dest: /etc/logrotate.d/{{ service_name | default('custom') }}
    mode: '0644'
  when: logrotate_config is defined

- name: Install monitoring agent
  include_tasks: monitoring.yml
  tags: ['monitoring']
```

## 🧪 Test Integration

### Automatic Test Generation

Proxmox-MPC generates comprehensive test suites for infrastructure validation:

```javascript
// Generated tests/infrastructure.test.js
const { ProxmoxClient } = require('../src/api');
const { describe, test, expect, beforeAll, afterAll } = require('@jest/globals');

describe('Infrastructure Validation', () => {
  let proxmox;
  
  beforeAll(async () => {
    proxmox = new ProxmoxClient({
      host: process.env.PROXMOX_HOST,
      port: process.env.PROXMOX_PORT,
      username: process.env.PROXMOX_USERNAME,
      token: process.env.PROXMOX_TOKEN_SECRET
    });
    
    await proxmox.connect();
  });

  afterAll(async () => {
    await proxmox.disconnect();
  });

  describe('VM Infrastructure Tests', () => {
    test('All VMs should be running', async () => {
      const vms = await proxmox.getVMs();
      const runningVMs = vms.filter(vm => vm.status === 'running');
      
      expect(runningVMs.length).toBeGreaterThan(0);
      
      // Specific VMs that should be running
      const expectedRunningVMs = ['web-server', 'database-server', 'app-server'];
      
      for (const vmName of expectedRunningVMs) {
        const vm = vms.find(v => v.name === vmName);
        expect(vm).toBeDefined();
        expect(vm.status).toBe('running');
      }
    });

    test('VM resource allocation should be correct', async () => {
      const vmConfigs = {
        'web-server': { cores: 4, memory: 8192 },
        'database-server': { cores: 8, memory: 16384 },
        'app-server': { cores: 4, memory: 8192 }
      };

      for (const [vmName, expectedConfig] of Object.entries(vmConfigs)) {
        const vm = await proxmox.getVMByName(vmName);
        expect(vm.cores).toBe(expectedConfig.cores);
        expect(vm.memory).toBe(expectedConfig.memory);
      }
    });

    test('VM network connectivity should be established', async () => {
      const vms = await proxmox.getRunningVMs();
      
      for (const vm of vms) {
        // Test if VM has IP address
        expect(vm.ipAddress).toBeDefined();
        expect(vm.ipAddress).toMatch(/^\d+\.\d+\.\d+\.\d+$/);
        
        // Test if VM is reachable (ping test)
        const isReachable = await pingHost(vm.ipAddress);
        expect(isReachable).toBe(true);
      }
    });
  });

  describe('Container Infrastructure Tests', () => {
    test('All containers should be running', async () => {
      const containers = await proxmox.getContainers();
      const runningContainers = containers.filter(ct => ct.status === 'running');
      
      expect(runningContainers.length).toBeGreaterThan(0);
      
      const expectedContainers = ['monitoring-ct', 'logging-ct'];
      
      for (const containerName of expectedContainers) {
        const container = containers.find(ct => ct.name === containerName);
        expect(container).toBeDefined();
        expect(container.status).toBe('running');
      }
    });

    test('Container services should be healthy', async () => {
      const containers = await proxmox.getRunningContainers();
      
      for (const container of containers) {
        // Test service-specific health checks
        if (container.name === 'monitoring-ct') {
          const prometheusHealth = await checkServiceHealth(
            container.ipAddress, 
            9090, 
            '/api/v1/status/config'
          );
          expect(prometheusHealth).toBe(true);
        }
      }
    });
  });

  describe('Storage and Performance Tests', () => {
    test('Storage usage should be within limits', async () => {
      const storages = await proxmox.getStorages();
      
      for (const storage of storages) {
        const usagePercent = (storage.used / storage.total) * 100;
        expect(usagePercent).toBeLessThan(90); // Less than 90% full
      }
    });

    test('Node resource usage should be reasonable', async () => {
      const nodes = await proxmox.getNodes();
      
      for (const node of nodes) {
        expect(node.cpu_usage).toBeLessThan(80); // Less than 80% CPU
        expect(node.memory_usage).toBeLessThan(85); // Less than 85% RAM
      }
    });
  });

  describe('Security and Compliance Tests', () => {
    test('All VMs should have required security tags', async () => {
      const vms = await proxmox.getVMs();
      
      for (const vm of vms) {
        expect(vm.tags).toContain('managed_by:proxmox-mpc');
        expect(vm.tags).toMatch(/environment:(development|staging|production)/);
      }
    });

    test('Network security should be configured', async () => {
      const vms = await proxmox.getVMs();
      
      for (const vm of vms) {
        // Verify firewall is enabled (if applicable)
        if (vm.firewall !== undefined) {
          expect(vm.firewall.enabled).toBe(true);
        }
      }
    });
  });
});

// Helper functions
async function pingHost(ipAddress) {
  try {
    const response = await fetch(`http://${ipAddress}:80`, { 
      timeout: 5000,
      method: 'HEAD'
    });
    return response.ok || response.status < 500;
  } catch (error) {
    // Try ping alternative
    return false;
  }
}

async function checkServiceHealth(host, port, path = '/health') {
  try {
    const response = await fetch(`http://${host}:${port}${path}`, {
      timeout: 10000
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}
```

## 🔄 State Management Workflow

### Synchronization Process

The IaC synchronization follows a comprehensive workflow:

```mermaid
graph TD
    A[Manual Changes<br/>in Proxmox] --> B[/sync Command]
    B --> C[Discover Resources]
    C --> D[Compare with Database]
    D --> E{Changes Detected?}
    E -->|Yes| F[Update Database]
    E -->|No| G[No Action Needed]
    F --> H[Regenerate IaC Files]
    H --> I[Update Terraform Configs]
    H --> J[Update Ansible Playbooks] 
    H --> K[Update Test Suites]
    I --> L[Validate Generated Code]
    J --> L
    K --> L
    L --> M[Commit to Version Control]
    M --> N[Generate Change Report]
```

### Configuration Drift Detection

```bash
# Detect configuration drift
proxmox-mpc> /sync --check-drift

🔍 Checking for configuration drift...

📊 Drift Analysis Results:
  ✅ VMs in sync: 8/10
  ⚠️ VMs with drift: 2/10
    • web-server (VMID 100): Memory changed 4096MB → 8192MB
    • app-server (VMID 103): Cores changed 2 → 4
  
  ✅ Containers in sync: 3/3
  ✅ Storage configuration: No drift detected
  
🔄 Resolution Options:
  1. Import changes to IaC: /sync --import-changes
  2. Restore from IaC: /apply --restore-state  
  3. Review changes: /diff --detailed

Would you like to import these changes? (y/N): y

✅ Changes imported successfully
📝 Updated terraform/vms/web-server.tf
📝 Updated terraform/vms/app-server.tf
🧪 Updated corresponding test files
```

### Version Control Integration

```bash
# Automatic Git integration
cd my-proxmox-project

# After sync operations, changes are ready for commit
git status
# On branch main
# Changes to be committed:
#   (use "git reset HEAD <file>..." to unstage)
#
#   modified:   terraform/vms/web-server.tf
#   modified:   terraform/vms/app-server.tf
#   modified:   tests/vms/web-server.test.js
#   new file:   .proxmox/history/sync-2025-01-26-14-30-22.json

# Generated commit message
git commit -m "chore: sync infrastructure changes

- web-server: Increase memory from 4GB to 8GB
- app-server: Increase cores from 2 to 4
- Updated corresponding test validations
- State snapshot: sync-2025-01-26-14-30-22

Generated by Proxmox-MPC v0.1.3"
```

## 🚀 Advanced IaC Features

### Multi-Environment Support

```hcl
# terraform/environments/development.tfvars
environment = "development"
vm_storage = "local-lvm"
backup_enabled = false

vm_configs = {
  web-server = {
    cores = 2
    memory = 4096
    disk_size = "20G"
  }
}

# terraform/environments/production.tfvars  
environment = "production"
vm_storage = "production-ssd"
backup_enabled = true

vm_configs = {
  web-server = {
    cores = 8
    memory = 16384
    disk_size = "100G"
  }
}
```

### Template and Module System

```hcl
# terraform/modules/vm-cluster/main.tf
variable "cluster_name" {
  description = "Name of the VM cluster"
  type        = string
}

variable "vm_count" {
  description = "Number of VMs in cluster"
  type        = number
  default     = 3
}

variable "vm_config" {
  description = "VM configuration"
  type = object({
    cores     = number
    memory    = number
    disk_size = string
  })
}

# Create multiple VMs with consistent configuration
resource "proxmox_vm_qemu" "cluster_vms" {
  count = var.vm_count
  
  name        = "${var.cluster_name}-${count.index + 1}"
  vmid        = "${var.base_vmid + count.index}"
  target_node = "proxmox-node-0${(count.index % 2) + 1}"
  
  cores  = var.vm_config.cores
  memory = var.vm_config.memory
  
  # Shared cluster configuration
  tags = "cluster:${var.cluster_name},instance:${count.index + 1}"
}
```

### Conditional Resource Creation

```hcl
# terraform/vms/conditional-resources.tf
# Create backup VM only in production
resource "proxmox_vm_qemu" "backup_server" {
  count = var.environment == "production" ? 1 : 0
  
  name        = "backup-server"
  vmid        = "199"
  target_node = var.backup_node
  
  cores  = 4
  memory = 8192
  
  # Large disk for backups
  disks {
    scsi {
      scsi0 {
        disk {
          storage = var.backup_storage
          size    = "500G"
        }
      }
    }
  }
}

# Create development tools VM only in dev environment
resource "proxmox_vm_qemu" "dev_tools" {
  count = var.environment == "development" ? 1 : 0
  
  name        = "dev-tools"
  vmid        = "150"
  target_node = var.dev_node
  
  cores  = 2
  memory = 4096
}
```

## 🔧 Customization and Extension

### Custom IaC Templates

You can customize the generated IaC by modifying templates:

```yaml
# .proxmox/templates/terraform/vm.tf.j2
resource "proxmox_vm_qemu" "{{ vm.name | replace('-', '_') }}" {
  name        = "{{ vm.name }}"
  vmid        = "{{ vm.vmid }}"
  target_node = "{{ vm.node }}"
  
  {% if vm.template %}
  clone      = "{{ vm.template }}"
  full_clone = true
  {% endif %}
  
  # Custom organization tags
  tags = "{{ vm.tags }},project:{{ project_name }},owner:{{ project_owner }}"
  
  # Custom startup configuration
  {% if vm.startup_order %}
  startup = "order={{ vm.startup_order }},up=30"
  {% endif %}
  
  # Environment-specific overrides
  {% if environment == 'production' %}
  onboot = true
  protection = true  # Prevent accidental deletion
  {% endif %}
}
```

### Integration Hooks

```javascript
// .proxmox/hooks/pre-sync.js
module.exports = async function preSyncHook(context) {
  console.log('🔍 Running pre-sync validation...');
  
  // Custom validation logic
  const criticalVMs = ['database-server', 'production-web'];
  
  for (const vmName of criticalVMs) {
    const vm = await context.proxmox.getVMByName(vmName);
    if (vm && vm.status !== 'running') {
      throw new Error(`Critical VM ${vmName} is not running!`);
    }
  }
  
  // Check resource constraints
  const nodes = await context.proxmox.getNodes();
  for (const node of nodes) {
    if (node.memory_usage > 90) {
      console.warn(`⚠️ Node ${node.name} has high memory usage: ${node.memory_usage}%`);
    }
  }
  
  return { validated: true, timestamp: Date.now() };
};
```

---

**Ready to Master IaC?**

1. **[First Project Tutorial](../getting-started/first-project.md)** - Hands-on IaC creation
2. **[State Synchronization Guide](state-synchronization.md)** - Advanced sync features
3. **[Testing Framework](testing-framework.md)** - Comprehensive testing strategies
4. **[CLI Reference](../reference/cli-reference.md)** - All IaC-related commands