# Quick Start Guide

Get up and running with Proxmox-MPC in just 5 minutes! This guide will take you from installation to creating your first virtual machine.

!!! tip "Prerequisites" - Proxmox-MPC installed ([Installation Guide](installation.md)) - Proxmox VE server with API access - API token generated ([Authentication Guide](authentication.md))

## Step 1: Launch Interactive Console

Open your terminal and launch the interactive console:

```bash
# Navigate to your projects directory
mkdir ~/my-datacenter && cd ~/my-datacenter

# Launch Proxmox-MPC interactive console
proxmox-mpc
```

You should see:

```
Proxmox-MPC Interactive Console v1.0.0
Type /help for available commands or /exit to quit.

proxmox-mpc>
```

## Step 2: Initialize Your First Project

Initialize a new Proxmox project workspace:

```bash
proxmox-mpc> /init
```

The initialization wizard will prompt you for:

```
🏗️  Initializing new Proxmox project...

Server Configuration:
? Proxmox server URL: https://192.168.1.100:8006
? API token ID: root@pam!automation
? API token secret: ********
? Skip SSL verification? (for homelab): Yes

Project Configuration:
? Project name: my-datacenter
? Description: My first Proxmox-MPC project

✅ Project initialized successfully!
```

## Step 3: Sync Existing Infrastructure

Discover and import your existing Proxmox infrastructure:

```bash
proxmox-mpc> /sync
```

You'll see output like:

```
🔄 Connecting to Proxmox server...
✅ Connected successfully!

🔍 Discovering infrastructure...
   📊 Found 3 nodes
   💻 Found 12 VMs
   📦 Found 5 containers
   💾 Found 8 storage pools

🏗️  Generating Infrastructure-as-Code files...
   📝 Generated terraform/main.tf
   📝 Generated terraform/nodes.tf
   📝 Generated terraform/vms/
   📝 Generated ansible/inventory.yml
   📝 Generated ansible/playbooks/

🧪 Generating tests...
   📝 Generated tests/infrastructure.test.js

✅ Infrastructure imported as code!
```

## Step 4: Create Your First VM

Now create a new virtual machine using natural language commands:

```bash
proxmox-mpc> create vm --name web-server-01 --cores 2 --memory 4096 --disk 50
```

Output:

```
🏗️  Creating VM configuration...

VM Specification:
  Name: web-server-01
  CPU Cores: 2
  Memory: 4096 MB
  Disk: 50 GB
  OS Type: Linux (detected)

📝 Generated terraform/vms/web-server-01.tf
📝 Generated ansible/playbooks/web-server-01.yml
🧪 Generated tests/vms/web-server-01.test.js

✅ VM configuration created!
```

## Step 5: Preview Changes

Before applying changes, preview what will be created:

```bash
proxmox-mpc> /plan
```

You'll see:

```
📋 Infrastructure Plan:

Changes to apply:
  + proxmox_vm_qemu.web-server-01
    name         = "web-server-01"
    cores        = 2
    memory       = 4096
    disk {
      size     = "50G"
      type     = "virtio"
      storage  = "local-lvm"
    }

✅ Plan shows 1 resource to add, 0 to change, 0 to destroy.
```

## Step 6: Test Your Changes

Run the generated tests to validate your configuration:

```bash
proxmox-mpc> /test
```

Output:

```
🧪 Running infrastructure tests...

  ✅ Infrastructure validation tests
    ✅ VM configuration is valid
    ✅ Resource requirements are met
    ✅ Network configuration is correct
    ✅ Storage allocation is available

  ✅ Integration tests
    ✅ Proxmox API connectivity
    ✅ Authentication working
    ✅ Required permissions available

🎉 All tests passed! Ready to deploy.
```

## Step 7: Deploy Infrastructure

Apply your changes to create the VM:

```bash
proxmox-mpc> /apply
```

You'll see:

```
🚀 Deploying infrastructure changes...

proxmox_vm_qemu.web-server-01: Creating...
proxmox_vm_qemu.web-server-01: Still creating... [10s elapsed]
proxmox_vm_qemu.web-server-01: Still creating... [20s elapsed]
proxmox_vm_qemu.web-server-01: Creation complete after 23s [id=101]

✅ VM web-server-01 created successfully!
   📍 VM ID: 101
   🌐 IP Address: (will be assigned on boot)
   ⚡ Status: Stopped (ready to start)
```

## Step 8: Verify and Start VM

Check your VM status and start it:

```bash
proxmox-mpc> describe vm 101
```

```
📊 VM Details: web-server-01 (ID: 101)

Configuration:
  Status: stopped
  CPU: 2 cores
  Memory: 4096 MB
  Disk: 50 GB (virtio)
  OS Type: Linux

Network:
  Interface: virtio (vmbr0)
  MAC: 1A:2B:3C:4D:5E:6F

Storage:
  Disk 0: local-lvm:101/vm-101-disk-0.raw (50G)
```

Start the VM:

```bash
proxmox-mpc> vm start 101
```

## Step 9: Keep Everything in Sync

Keep your local state synchronized with the server:

```bash
proxmox-mpc> /sync
```

```
🔄 Synchronizing state...
   ✅ Local database updated
   ✅ Terraform state refreshed
   ✅ Ansible inventory updated

🎯 Infrastructure Status:
   📊 3 nodes online
   💻 13 VMs (12 existing + 1 new)
   📦 5 containers
   🆕 1 change detected and synchronized
```

## What You've Accomplished

In just 5 minutes, you've:

✅ **Initialized** a Proxmox project workspace  
✅ **Imported** existing infrastructure as code  
✅ **Created** a new VM using natural language  
✅ **Generated** Terraform, Ansible, and test files  
✅ **Tested** your infrastructure changes  
✅ **Deployed** the VM to your Proxmox server  
✅ **Synchronized** everything back to your local database

## Your Generated Project Structure

Your project directory now contains:

```
my-datacenter/
├── .proxmox/
│   ├── config.yml              # Your server configuration
│   ├── state.db               # Local SQLite database
│   └── history/               # State snapshots
├── terraform/
│   ├── main.tf                # Main Terraform configuration
│   ├── nodes.tf               # Node resources
│   ├── vms/
│   │   └── web-server-01.tf   # Your new VM
│   └── existing-vms.tf        # Imported VMs
├── ansible/
│   ├── inventory.yml          # Generated inventory
│   ├── playbooks/
│   │   └── web-server-01.yml  # VM configuration
│   └── roles/                 # Reusable roles
└── tests/
    ├── infrastructure.test.js  # Main tests
    └── vms/
        └── web-server-01.test.js  # VM-specific tests
```

## Essential Commands Learned

| Command       | Purpose                             |
| ------------- | ----------------------------------- |
| `proxmox-mpc` | Launch interactive console          |
| `/init`       | Initialize project workspace        |
| `/sync`       | Sync state between server and local |
| `create vm`   | Create VM configuration             |
| `/plan`       | Preview infrastructure changes      |
| `/test`       | Run infrastructure tests            |
| `/apply`      | Deploy changes to Proxmox           |
| `/status`     | Show project and server status      |
| `/help`       | Show all available commands         |

## Next Steps

Now that you've mastered the basics, explore more advanced features:

### 🎯 Immediate Next Steps

1. **[Authentication Setup](authentication.md)** - Secure your API access
2. **[Project Workspaces](../user-guide/project-workspaces.md)** - Organize multiple projects
3. **[Resource Management](../user-guide/resource-management.md)** - Advanced VM/container operations

### 🚀 Advanced Features

1. **[Infrastructure as Code](../features/infrastructure-as-code.md)** - Deep dive into IaC generation
2. **[State Synchronization](../features/state-synchronization.md)** - Advanced sync strategies
3. **[Testing Framework](../features/testing-framework.md)** - Comprehensive testing workflows

### 📚 Learn More

1. **[Console Commands](../reference/console-commands.md)** - Complete command reference
2. **[CLI Reference](../reference/cli-reference.md)** - All CLI commands
3. **[Tutorials](../tutorials/basic-vm-management.md)** - Step-by-step guides

## Getting Help

If you run into issues:

```bash
# Get help in the console
proxmox-mpc> /help

# Check project status
proxmox-mpc> /status

# View detailed error information
proxmox-mpc> /debug
```

- **Documentation**: [Full documentation site](../../)
- **GitHub Issues**: [Report problems](https://github.com/proxmox-mpc/proxmox-mpc/issues)
- **Community**: [GitHub Discussions](https://github.com/proxmox-mpc/proxmox-mpc/discussions)

## Common Next Actions

### Create More VMs

```bash
proxmox-mpc> create vm --name database-01 --cores 4 --memory 8192 --disk 100
proxmox-mpc> create vm --name cache-01 --cores 1 --memory 2048 --disk 20
```

### Create Containers

```bash
proxmox-mpc> create container --name web-proxy --cores 1 --memory 1024 --template ubuntu-22.04
```

### Manage Existing Resources

```bash
proxmox-mpc> list vms
proxmox-mpc> describe vm 100
proxmox-mpc> vm stop 100
proxmox-mpc> vm start 100
```

### Export for Multi-Server Deployment

```bash
proxmox-mpc> /export ../production-datacenter
```

---

**Congratulations!** 🎉 You've successfully completed the Proxmox-MPC quick start. You now have a working Infrastructure-as-Code setup for your Proxmox environment.

**Next**: Dive deeper with our [comprehensive guides](../user-guide/interactive-console.md) or explore [advanced features](../features/infrastructure-as-code.md).
