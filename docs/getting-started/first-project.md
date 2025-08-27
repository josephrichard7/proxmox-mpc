# First Project Tutorial

This comprehensive tutorial walks you through creating your first Proxmox infrastructure project with Proxmox-MPC. You'll learn the complete workflow from initialization to deployment.

## 🎯 What You'll Learn

By the end of this tutorial, you'll have:

- ✅ Created and configured a new Proxmox project workspace
- ✅ Connected to your Proxmox server with proper authentication
- ✅ Synchronized existing infrastructure into IaC files
- ✅ Created new VMs using declarative configuration
- ✅ Generated and executed infrastructure tests
- ✅ Deployed changes to your Proxmox server

**Time Required**: 30-45 minutes  
**Prerequisites**: [Installation](installation.md) and [Authentication](authentication.md) completed

## 🚀 Step 1: Project Initialization

### Create Project Directory

Start by creating a dedicated directory for your infrastructure project:

```bash
# Create and navigate to project directory
mkdir ~/my-proxmox-datacenter
cd ~/my-proxmox-datacenter

# Launch Proxmox-MPC interactive console
proxmox-mpc
```

You'll see the welcome message:
```
🚀 Proxmox-MPC Interactive Console v0.1.3
📁 Workspace: ~/my-proxmox-datacenter
🔧 Type /help for available commands or /exit to quit.

proxmox-mpc> 
```

### Initialize Project Workspace

Use the interactive `/init` command to set up your project:

```bash
proxmox-mpc> /init
```

The initialization wizard will guide you through setup:

```
🏗️ Initializing Proxmox-MPC project workspace...

📋 Project Configuration:
? Project name: my-proxmox-datacenter
? Description: Home lab infrastructure management
? Default environment: development

🌐 Proxmox Server Configuration:
? Proxmox server hostname/IP: 192.168.1.100
? Port (default 8006): 8006
? Username: root@pam
? API Token ID: proxmox-mpc-automation
? API Token Secret: [hidden input]

🔐 SSL Configuration:
? SSL certificate verification: No (homelab self-signed)

🧪 Testing connection...
✅ Connection successful!
✅ API version: Proxmox VE 8.4.1
✅ Permissions validated

📁 Creating project structure...
✅ Created .proxmox/ directory
✅ Created configuration files
✅ Initialized local database
✅ Generated project documentation

🎉 Project initialization complete!
```

### Explore Project Structure

After initialization, examine the created project structure:

```bash
proxmox-mpc> /exit

$ ls -la
total 0
drwxr-xr-x  6 user user  192 Jan 26 10:00 .
drwxr-xr-x  3 user user   96 Jan 26 10:00 ..
drwxr-xr-x  3 user user   96 Jan 26 10:00 .proxmox
drwxr-xr-x  2 user user   64 Jan 26 10:00 ansible
drwxr-xr-x  2 user user   64 Jan 26 10:00 terraform
drwxr-xr-x  2 user user   64 Jan 26 10:00 tests

$ tree
my-proxmox-datacenter/
├── .proxmox/
│   ├── config.yml          # Server connection configuration
│   ├── state.db           # Local SQLite database
│   └── project.yml        # Project metadata
├── terraform/             # Generated Terraform configurations
│   └── .gitkeep
├── ansible/              # Generated Ansible playbooks
│   └── .gitkeep
├── tests/                # Generated infrastructure tests
│   └── .gitkeep
└── README.md             # Generated project documentation
```

## 🔄 Step 2: Infrastructure Discovery

### Sync Existing Infrastructure

Launch the console again and discover your existing Proxmox infrastructure:

```bash
$ proxmox-mpc

proxmox-mpc> /sync
```

The sync process will discover and import your infrastructure:

```
🔄 Synchronizing infrastructure with Proxmox server...

🔍 Discovering resources on proxmox-node-01...
📊 Found: 3 VMs, 2 containers, 1 storage pool

📝 Importing VMs:
  ✅ VM 100: web-server (running) - 2 cores, 4GB RAM
  ✅ VM 101: database-server (running) - 4 cores, 8GB RAM  
  ✅ VM 102: backup-server (stopped) - 2 cores, 2GB RAM

📦 Importing Containers:
  ✅ CT 200: monitoring-ct (running) - 1GB RAM
  ✅ CT 201: log-collector (running) - 512MB RAM

💾 Updating local database...
✅ Stored 3 VMs, 2 containers

🏗️ Generating Infrastructure as Code...
✅ Generated terraform/main.tf
✅ Generated terraform/vms/web-server.tf
✅ Generated terraform/vms/database-server.tf  
✅ Generated terraform/vms/backup-server.tf
✅ Generated terraform/containers/monitoring-ct.tf
✅ Generated terraform/containers/log-collector.tf

📖 Generated Ansible configurations:
✅ Generated ansible/inventory.yml
✅ Generated ansible/playbooks/vm-configuration.yml
✅ Generated ansible/playbooks/container-configuration.yml

🧪 Generated infrastructure tests:
✅ Generated tests/vm-connectivity.test.js
✅ Generated tests/service-health.test.js
✅ Generated tests/performance-baseline.test.js

🎉 Infrastructure sync complete!
📊 Summary: 3 VMs, 2 containers imported as Infrastructure as Code
```

### Review Generated Files

Examine the generated Terraform configuration:

```hcl
# terraform/vms/web-server.tf
resource "proxmox_vm_qemu" "web_server" {
  name        = "web-server"
  vmid        = "100"
  target_node = "proxmox-node-01"
  
  cores    = 2
  memory   = 4096
  scsihw   = "virtio-scsi-pci"
  bootdisk = "scsi0"
  
  disk {
    slot    = 0
    type    = "scsi"
    storage = "local-lvm"
    size    = "32G"
  }
  
  network {
    model  = "virtio"
    bridge = "vmbr0"
  }
  
  # Generated from existing VM configuration
  tags = "managed-by-proxmox-mpc"
}
```

Check the Ansible inventory:

```yaml
# ansible/inventory.yml
all:
  children:
    proxmox_vms:
      hosts:
        web-server:
          ansible_host: "{{ vm_ip_100 }}"
          proxmox_vmid: 100
          proxmox_node: "proxmox-node-01"
        database-server:
          ansible_host: "{{ vm_ip_101 }}"
          proxmox_vmid: 101
          proxmox_node: "proxmox-node-01"
```

## 🏗️ Step 3: Create New Infrastructure

### Create a New VM

Now let's create a new VM using the interactive console:

```bash
proxmox-mpc> create vm --name app-server --vmid 103 --cores 4 --memory 8192

🏗️ Creating VM configuration for 'app-server'...

📝 VM Configuration:
  Name: app-server
  VMID: 103
  Node: proxmox-node-01 (auto-selected)
  Cores: 4
  Memory: 8192 MB
  Disk: 32G (local-lvm)
  Network: vmbr0 (virtio)

✅ Generated terraform/vms/app-server.tf
✅ Generated ansible/playbooks/app-server.yml
✅ Generated tests/vms/app-server.test.js
✅ Updated terraform/main.tf with new resource
✅ Updated ansible/inventory.yml

🎯 Next steps:
  1. Review generated configuration files
  2. Run /plan to preview changes
  3. Run /test to validate configuration
  4. Run /apply to create the VM
```

### Review and Plan Changes

Before deploying, review what will be created:

```bash
proxmox-mpc> /plan

🔍 Analyzing infrastructure changes...

📊 Terraform Plan:
Plan: 1 to add, 0 to change, 0 to destroy.

+ proxmox_vm_qemu.app_server
    cores    = 4
    memory   = 8192
    name     = "app-server"
    vmid     = "103"
    
🔄 Changes will be applied to:
  📍 Node: proxmox-node-01
  💾 Storage: local-lvm (32G disk)
  🌐 Network: vmbr0 bridge

✅ Plan looks good! Ready to apply.
```

## 🧪 Step 4: Test Infrastructure

### Run Generated Tests

Before deployment, validate your infrastructure configuration:

```bash
proxmox-mpc> /test

🧪 Running infrastructure tests...

📋 Test Suite: Infrastructure Validation
  ✅ Configuration syntax validation (3/3 passed)
  ✅ Resource naming conventions (3/3 passed)
  ✅ Network connectivity tests (5/5 passed)
  ✅ Storage capacity validation (3/3 passed)
  ✅ Security baseline checks (8/8 passed)

📋 Test Suite: VM Health Checks  
  ✅ Existing VM status validation (3/3 passed)
  ✅ Resource usage within limits (3/3 passed)
  ✅ Service availability checks (5/5 passed)

📋 Test Suite: Container Health Checks
  ✅ Container status validation (2/2 passed)
  ✅ Container resource usage (2/2 passed)

🎉 All tests passed! (31/31 successful)
⏱️ Test execution time: 45 seconds

🚀 Infrastructure is ready for deployment!
```

### Review Test Details

For more detailed test information:

```bash
proxmox-mpc> /test --verbose

🧪 Detailed test execution:

📋 Configuration Validation:
  ✅ terraform/vms/app-server.tf: Valid HCL syntax
  ✅ ansible/playbooks/app-server.yml: Valid YAML syntax
  ✅ tests/vms/app-server.test.js: Valid test structure

📋 Resource Validation:
  ✅ VMID 103: Available (not in use)
  ✅ Storage local-lvm: 245GB available (32GB required)
  ✅ Node proxmox-node-01: 8GB RAM available (8GB required)

📋 Network Connectivity:
  ✅ Bridge vmbr0: Active and configured
  ✅ DHCP pool: 50+ addresses available
  ✅ DNS resolution: Working
  ✅ Gateway reachability: 192.168.1.1 accessible
  ✅ Internet connectivity: DNS queries successful
```

## 🚀 Step 5: Deploy Infrastructure

### Apply Changes

Deploy your new infrastructure:

```bash
proxmox-mpc> /apply

🚀 Deploying infrastructure changes...

📋 Deployment Plan:
  🔨 Create VM: app-server (VMID 103)
  📦 Configure with Ansible: app-server baseline
  🧪 Run post-deployment tests

⚠️ This will make changes to your Proxmox server.
? Continue with deployment? (y/N): y

🏗️ Executing Terraform deployment...
  ⏳ Creating VM app-server...
  ✅ VM 103 created successfully
  ⏳ Starting VM...
  ✅ VM 103 is now running

📖 Executing Ansible configuration...
  ⏳ Waiting for VM to be accessible...
  ✅ VM is reachable via SSH
  ⏳ Applying baseline configuration...
  ✅ Ansible playbook completed successfully

🧪 Running post-deployment validation...
  ✅ VM status: running
  ✅ Network connectivity: established
  ✅ Resource allocation: correct
  ✅ Services: healthy

🎉 Deployment completed successfully!
📊 Created: 1 VM, 0 containers
⏱️ Total deployment time: 3m 42s

💡 VM Details:
  Name: app-server
  VMID: 103
  IP Address: 192.168.1.105 (DHCP)
  Status: Running
  Resources: 4 cores, 8GB RAM, 32GB disk
```

### Verify Deployment

Check that everything is working correctly:

```bash
proxmox-mpc> /status

📊 Infrastructure Status Report:

🌐 Server Connection:
  ✅ Proxmox API: Connected (proxmox-node-01:8006)
  ✅ Authentication: Token valid
  ⚡ Response time: 125ms average

📊 Resource Overview:
  🖥️ VMs: 4 total (4 running, 0 stopped)
    • VM 100: web-server (running) - 2 cores, 4GB
    • VM 101: database-server (running) - 4 cores, 8GB  
    • VM 102: backup-server (stopped) - 2 cores, 2GB
    • VM 103: app-server (running) - 4 cores, 8GB

  📦 Containers: 2 total (2 running, 0 stopped)
    • CT 200: monitoring-ct (running) - 1GB
    • CT 201: log-collector (running) - 512MB

📁 Project Status:
  ✅ Workspace: ~/my-proxmox-datacenter
  ✅ Database: SQLite with 4 VMs, 2 containers
  ✅ IaC files: 6 Terraform, 4 Ansible files
  ✅ Tests: 12 test suites, all passing

🔄 Last sync: 2 minutes ago
```

## 🔄 Step 6: Ongoing Management

### Regular Synchronization

Keep your IaC files synchronized with server changes:

```bash
# Sync should be run regularly to detect manual changes
proxmox-mpc> /sync

🔄 Checking for infrastructure changes...

📊 Detected changes:
  ℹ️ No changes detected since last sync
  ✅ All resources in sync

💡 Tip: Run /sync regularly to detect manual changes made through Proxmox web interface
```

### Monitor and Maintain

Use ongoing monitoring commands:

```bash
# Check overall system health
proxmox-mpc> /health

🏥 Comprehensive Health Report:
✅ All systems operational
✅ All VMs responding to health checks
✅ Storage usage within normal limits (67% used)
✅ Network connectivity stable
✅ No resource conflicts detected

# View resource utilization
proxmox-mpc> list vms --detailed

📊 Virtual Machines (4):
┌──────┬─────────────────┬─────────┬─────────┬─────────┬─────────────────────┐
│ VMID │ Name           │ Status  │ Cores   │ Memory  │ IP Address          │
├──────┼─────────────────┼─────────┼─────────┼─────────┼─────────────────────┤
│ 100  │ web-server     │ running │ 2       │ 4096MB  │ 192.168.1.102      │
│ 101  │ database-server│ running │ 4       │ 8192MB  │ 192.168.1.103      │
│ 102  │ backup-server  │ stopped │ 2       │ 2048MB  │ --                 │
│ 103  │ app-server     │ running │ 4       │ 8192MB  │ 192.168.1.105      │
└──────┴─────────────────┴─────────┴─────────┴─────────┴─────────────────────┘

💡 Total allocated: 12 cores, 22GB RAM
```

## 📝 Step 7: Documentation and Backup

### Generated Documentation

Proxmox-MPC automatically generates project documentation:

```markdown
# README.md (auto-generated)
# My Proxmox Datacenter

This project manages infrastructure for my home lab datacenter using Proxmox-MPC.

## Infrastructure Overview
- **VMs**: 4 (16 cores, 22GB RAM total)
- **Containers**: 2 (1.5GB RAM total)  
- **Storage**: local-lvm pool
- **Network**: vmbr0 bridge (192.168.1.0/24)

## Recent Changes
- 2025-01-26: Added app-server VM (VMID 103)
- 2025-01-25: Initial infrastructure import

## Usage
```bash
# Launch interactive console
proxmox-mpc

# Quick status check
proxmox-mpc> /status

# Sync with server  
proxmox-mpc> /sync
```

## Backup and Recovery

Create infrastructure snapshots:

```bash
proxmox-mpc> /backup create --name "pre-upgrade-snapshot"

📸 Creating infrastructure snapshot...
✅ Database snapshot: pre-upgrade-snapshot-2025-01-26
✅ Configuration backup: .proxmox/backups/pre-upgrade-snapshot/
✅ Generated rollback script: rollback-to-pre-upgrade-snapshot.sh

💡 To restore this snapshot later:
proxmox-mpc> /backup restore pre-upgrade-snapshot
```

## 🎉 Congratulations!

You've successfully:

✅ **Created** your first Proxmox-MPC project workspace  
✅ **Imported** existing infrastructure as Infrastructure-as-Code  
✅ **Created** a new VM using declarative configuration  
✅ **Tested** your infrastructure with comprehensive validation  
✅ **Deployed** changes to your Proxmox server  
✅ **Monitored** your infrastructure status and health

## 🚀 Next Steps

Now that you have a working project, explore advanced features:

### Advanced Workflows
1. **[Container Management](../tutorials/container-workflows.md)** - Learn container-specific operations
2. **[IaC Deployment](../tutorials/iac-deployment.md)** - Advanced Infrastructure-as-Code patterns
3. **[Testing Framework](../features/testing-framework.md)** - Comprehensive infrastructure testing

### Production Readiness
1. **[Multi-Server Setup](../features/multi-server.md)** - Manage multiple Proxmox clusters
2. **[CI/CD Integration](../tutorials/advanced-scenarios.md)** - Automate infrastructure deployment
3. **[Observability](../features/observability.md)** - Advanced monitoring and alerting

### Reference Materials
1. **[CLI Reference](../reference/cli-reference.md)** - Complete command documentation
2. **[Configuration Guide](../reference/configuration.md)** - Advanced configuration options
3. **[Troubleshooting](../troubleshooting/common-issues.md)** - Solve common problems

---

**Questions or Issues?**

- **Documentation**: Browse the complete [user guide](../user-guide/interactive-console.md)
- **Community**: Join discussions at [GitHub Discussions](https://github.com/proxmox-mpc/proxmox-mpc/discussions)  
- **Support**: Report issues at [GitHub Issues](https://github.com/proxmox-mpc/proxmox-mpc/issues)