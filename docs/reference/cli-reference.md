# CLI Reference Guide

Complete reference for all Proxmox-MPC command-line interface (CLI) commands. The CLI provides 20+ professional-grade commands for scripting, automation, and batch operations.

## 🎯 CLI Overview

### Command Structure
```bash
# CLI command structure
npm run cli <command> [subcommand] [options] [flags]

# Alternative using global installation
proxmox-mpc cli <command> [subcommand] [options] [flags]

# Examples
npm run cli test-connection -v
npm run cli vm create --vmid 100 --name web-01
npm run cli container list --format json
```

### Global Options
| Flag | Description | Default |
|------|-------------|---------|
| `-v, --verbose` | Verbose output with detailed information | false |
| `--format <type>` | Output format: table, json, yaml | table |
| `--config <path>` | Custom configuration file path | .proxmox/config.yml |
| `--dry-run` | Show what would be done without executing | false |
| `--help` | Display help for command | - |

## 🔌 Connection Commands

### test-connection
Test connectivity and authentication with Proxmox server.

```bash
# Basic connectivity test
npm run cli test-connection

# Verbose output with detailed diagnostics
npm run cli test-connection -v

# Test specific server configuration
npm run cli test-connection --config production.yml
```

**Output Example:**
```
✅ Connection successful
🏥 Server: proxmox-node-01:8006
📊 Version: Proxmox VE 8.4.1
👤 User: root@pam
🔑 Token: proxmox-mpc-automation
⏱️ Response time: 145ms
```

**Verbose Output:**
```
🔍 Testing connection to proxmox-node-01:8006
🔐 Using token authentication: root@pam!proxmox-mpc-automation
🌐 SSL verification: disabled (self-signed certificate)
📡 API version check... ✅
🖥️ Node list retrieval... ✅ (2 nodes found)
💾 Storage list retrieval... ✅ (3 storage pools found)
🔧 Permission validation... ✅ (all required permissions granted)

📊 Performance Metrics:
  • API version: 42ms
  • Node list: 67ms
  • Storage list: 89ms
  • Permissions: 31ms
  • Total time: 229ms
```

### list-nodes
List all cluster nodes with resource information.

```bash
# Basic node listing
npm run cli list-nodes

# Detailed resource information
npm run cli list-nodes -v

# JSON output for scripting
npm run cli list-nodes --format json
```

**Output Example:**
```
📊 Proxmox Cluster Nodes (2):
┌─────────────────┬─────────┬──────────┬─────────────┬──────────┬─────────────────┐
│ Node            │ Status  │ CPU      │ Memory      │ Storage  │ Version         │
├─────────────────┼─────────┼──────────┼─────────────┼──────────┼─────────────────┤
│ proxmox-node-01 │ online  │ 15.2%    │ 45.8%       │ 67.3%    │ 8.4.1           │
│ proxmox-node-02 │ online  │ 22.1%    │ 38.2%       │ 52.8%    │ 8.4.1           │
└─────────────────┴─────────┴──────────┴─────────────┴──────────┴─────────────────┘
```

## 🖥️ VM Management Commands

### vm list
List virtual machines with status and configuration details.

```bash
# List all VMs
npm run cli vm list

# List VMs on specific node
npm run cli vm list --node proxmox-node-01

# List running VMs only
npm run cli vm list --status running

# Detailed output with resource information
npm run cli vm list -v

# JSON output for automation
npm run cli vm list --format json
```

**Output Example:**
```
🖥️ Virtual Machines (4):
┌──────┬─────────────────┬─────────┬─────────────────┬─────────┬─────────┬─────────────────────┐
│ VMID │ Name           │ Status  │ Node            │ Cores   │ Memory  │ IP Address          │
├──────┼─────────────────┼─────────┼─────────────────┼─────────┼─────────┼─────────────────────┤
│ 100  │ web-server     │ running │ proxmox-node-01 │ 2       │ 4096MB  │ 192.168.1.102      │
│ 101  │ database-server│ running │ proxmox-node-01 │ 4       │ 8192MB  │ 192.168.1.103      │
│ 102  │ backup-server  │ stopped │ proxmox-node-02 │ 2       │ 2048MB  │ --                 │
│ 103  │ app-server     │ running │ proxmox-node-01 │ 4       │ 8192MB  │ 192.168.1.105      │
└──────┴─────────────────┴─────────┴─────────────────┴─────────┴─────────┴─────────────────────┘

💡 Total: 4 VMs (3 running, 1 stopped) | 12 cores, 22GB RAM allocated
```

### vm create
Create new virtual machines with specified configuration.

```bash
# Basic VM creation
npm run cli vm create --vmid 200 --name test-vm

# Full VM configuration
npm run cli vm create \
  --vmid 200 \
  --name web-frontend \
  --node proxmox-node-01 \
  --cores 4 \
  --memory 8192 \
  --disk-size 50 \
  --storage local-lvm \
  --network vmbr0 \
  --ostype linux \
  --start

# Create with template
npm run cli vm create \
  --vmid 201 \
  --name from-template \
  --template 9000 \
  --cores 2 \
  --memory 4096
```

**Parameters:**
| Parameter | Required | Description | Default |
|-----------|----------|-------------|---------|
| `--vmid` | ✅ | Unique VM identifier | - |
| `--name` | ✅ | VM display name | - |
| `--node` | ❌ | Target Proxmox node | auto-select |
| `--cores` | ❌ | Number of CPU cores | 1 |
| `--memory` | ❌ | RAM in MB | 1024 |
| `--disk-size` | ❌ | Disk size in GB | 20 |
| `--storage` | ❌ | Storage pool | local-lvm |
| `--network` | ❌ | Network bridge | vmbr0 |
| `--ostype` | ❌ | OS type (linux/windows) | linux |
| `--template` | ❌ | Clone from template VMID | - |
| `--start` | ❌ | Start VM after creation | false |

### vm start / stop / restart
Control VM power state.

```bash
# Start VM
npm run cli vm start 100

# Start with wait for boot completion
npm run cli vm start 100 --wait

# Stop VM gracefully
npm run cli vm stop 100

# Force stop VM
npm run cli vm stop 100 --force

# Restart VM
npm run cli vm restart 100

# Restart with wait
npm run cli vm restart 100 --wait
```

### vm delete
Delete virtual machines with cleanup options.

```bash
# Delete VM (keeps disks)
npm run cli vm delete 100

# Delete VM and purge all disks
npm run cli vm delete 100 --purge

# Force delete without confirmation
npm run cli vm delete 100 --force --purge

# Delete with backup first
npm run cli vm delete 100 --backup --purge
```

### vm config
View and modify VM configuration.

```bash
# Show VM configuration
npm run cli vm config 100

# Show configuration in specific format
npm run cli vm config 100 --format json

# Update VM memory
npm run cli vm config 100 --memory 8192

# Update multiple parameters
npm run cli vm config 100 --cores 4 --memory 8192 --description "Updated config"
```

## 📦 Container Management Commands

### container list
List LXC containers with status information.

```bash
# List all containers
npm run cli container list

# List containers on specific node
npm run cli container list --node proxmox-node-01

# List running containers only
npm run cli container list --status running

# Detailed output
npm run cli container list -v
```

### container create
Create new LXC containers.

```bash
# Basic container creation
npm run cli container create \
  --vmid 300 \
  --hostname web-container \
  --ostemplate ubuntu-22.04-standard

# Full container configuration
npm run cli container create \
  --vmid 301 \
  --hostname app-container \
  --ostemplate ubuntu-22.04-standard \
  --cores 2 \
  --memory 2048 \
  --rootfs-size 20 \
  --storage local-lvm \
  --network name=eth0,bridge=vmbr0,ip=dhcp \
  --start \
  --unprivileged
```

**Parameters:**
| Parameter | Required | Description | Default |
|-----------|----------|-------------|---------|
| `--vmid` | ✅ | Container ID | - |
| `--hostname` | ✅ | Container hostname | - |
| `--ostemplate` | ✅ | Container template | - |
| `--cores` | ❌ | CPU cores | 1 |
| `--memory` | ❌ | RAM in MB | 512 |
| `--rootfs-size` | ❌ | Root filesystem size (GB) | 8 |
| `--storage` | ❌ | Storage pool | local |
| `--network` | ❌ | Network configuration | eth0,bridge=vmbr0,ip=dhcp |
| `--start` | ❌ | Start after creation | false |
| `--unprivileged` | ❌ | Create unprivileged container | false |

### container start / stop
Control container state.

```bash
# Start container
npm run cli container start 300

# Stop container
npm run cli container stop 300

# Restart container
npm run cli container restart 300
```

### container exec
Execute commands inside containers.

```bash
# Execute single command
npm run cli container exec 300 -- "ls -la /home"

# Interactive shell
npm run cli container exec 300 --interactive

# Execute as specific user
npm run cli container exec 300 --user www-data -- "whoami"

# Execute with custom environment
npm run cli container exec 300 --env "PATH=/custom/path" -- "echo $PATH"
```

### container delete
Delete containers with cleanup options.

```bash
# Delete container
npm run cli container delete 300

# Delete with disk cleanup
npm run cli container delete 300 --purge

# Force delete without confirmation
npm run cli container delete 300 --force
```

## 💾 Storage Commands

### storage list
List available storage pools.

```bash
# List all storage pools
npm run cli storage list

# Show detailed storage information
npm run cli storage list -v

# Filter by storage type
npm run cli storage list --type lvm

# JSON output
npm run cli storage list --format json
```

**Output Example:**
```
💾 Storage Pools (3):
┌─────────────┬─────────┬─────────┬─────────────┬─────────────┬─────────────┐
│ Storage     │ Type    │ Status  │ Size        │ Used        │ Available   │
├─────────────┼─────────┼─────────┼─────────────┼─────────────┼─────────────┤
│ local       │ dir     │ active  │ 234.5 GB    │ 45.2 GB     │ 189.3 GB    │
│ local-lvm   │ lvm     │ active  │ 456.8 GB    │ 123.4 GB    │ 333.4 GB    │  
│ backup-nfs  │ nfs     │ active  │ 1.2 TB      │ 345.6 GB    │ 854.4 GB    │
└─────────────┴─────────┴─────────┴─────────────┴─────────────┴─────────────┘
```

### storage create
Create new storage pools (advanced).

```bash
# Create directory storage
npm run cli storage create \
  --id backup-local \
  --type dir \
  --path /mnt/backup \
  --content backup,iso

# Create LVM storage  
npm run cli storage create \
  --id vm-storage-lvm \
  --type lvm \
  --vgname vm-storage \
  --content images
```

## 🔄 Sync and State Commands

### discover-vms
Discover and catalog VMs without full sync.

```bash
# Basic VM discovery
npm run cli discover-vms

# Discovery with resource details
npm run cli discover-vms -v

# Discover on specific node
npm run cli discover-vms --node proxmox-node-01

# Update local database
npm run cli discover-vms --update-db
```

### discover-containers  
Discover and catalog containers.

```bash
# Basic container discovery
npm run cli discover-containers

# Discovery with details
npm run cli discover-containers -v

# Update database
npm run cli discover-containers --update-db
```

### sync-state
Synchronize infrastructure state (CLI version of console `/sync`).

```bash
# Full infrastructure sync
npm run cli sync-state

# Sync specific resource types
npm run cli sync-state --resources vms,containers

# Dry-run sync to preview changes
npm run cli sync-state --dry-run

# Force sync ignoring timestamps
npm run cli sync-state --force
```

## 🧪 Testing Commands

### validate-config
Validate Proxmox-MPC configuration files.

```bash
# Validate default configuration
npm run cli validate-config

# Validate specific config file
npm run cli validate-config --config production.yml

# Verbose validation with details
npm run cli validate-config -v
```

### test-infrastructure
Run infrastructure validation tests.

```bash
# Run all infrastructure tests
npm run cli test-infrastructure

# Run specific test categories
npm run cli test-infrastructure --category connectivity,performance

# Run tests with detailed output
npm run cli test-infrastructure -v

# Generate test report
npm run cli test-infrastructure --report tests/report.json
```

## 📊 Monitoring Commands

### health-check
Comprehensive system health check.

```bash
# Basic health check
npm run cli health-check

# Detailed health analysis
npm run cli health-check -v

# Health check with metrics
npm run cli health-check --metrics

# Export health report
npm run cli health-check --export health-report.json
```

**Output Example:**
```
🏥 System Health Report:

🔌 Connectivity:
  ✅ Proxmox API: Connected (145ms avg response)
  ✅ Database: SQLite healthy (23 VMs, 8 containers)
  ✅ Storage: All pools accessible

📊 Resource Status:
  ✅ VMs: 23 running, 2 stopped, 0 errors
  ✅ Containers: 8 running, 0 stopped, 0 errors  
  ✅ Storage: 67% utilization (within limits)
  ✅ Memory: 78% cluster utilization
  
🔧 Configuration:
  ✅ Config files: Valid syntax
  ✅ Permissions: All required permissions granted
  ✅ SSL: Configured appropriately
  
⚠️ Warnings:
  • VM 102: High memory usage (95%)
  • Storage backup-nfs: Low space warning (90% full)

🎯 Overall Health Score: 92/100 (Excellent)
```

### performance-metrics
Display performance metrics and statistics.

```bash
# Current performance metrics
npm run cli performance-metrics

# Historical performance data
npm run cli performance-metrics --history 7d

# Export metrics for monitoring systems
npm run cli performance-metrics --export metrics.json --format prometheus
```

## 🔧 Utility Commands

### completion
Generate shell completion scripts.

```bash
# Generate bash completion
npm run cli completion bash > /etc/bash_completion.d/proxmox-mpc

# Generate zsh completion  
npm run cli completion zsh > ~/.zsh/completions/_proxmox-mpc

# Fish shell completion
npm run cli completion fish > ~/.config/fish/completions/proxmox-mpc.fish
```

### version
Display version information.

```bash
# Basic version info
npm run cli version

# Detailed version and environment info
npm run cli version -v
```

**Output Example:**
```
🚀 Proxmox-MPC CLI v0.1.3

📦 Environment:
  • Node.js: v20.10.0
  • npm: v10.2.3
  • Platform: linux x64
  • Proxmox API: v8.4.1

🔗 Repository:
  • URL: https://github.com/proxmox-mpc/proxmox-mpc
  • Branch: main
  • Commit: a1b2c3d4

⚡ Performance:
  • Startup time: 234ms
  • Memory usage: 45.2MB
  • Test success rate: 91.4% (445/487)
  
🔧 Version Management:
  • Dynamic version loading: Enabled
  • Version source: package.json
  • Build environment: production
```

### help
Display command help information.

```bash
# General help
npm run cli help

# Help for specific command
npm run cli help vm create

# List all available commands
npm run cli help --list

# Help in different formats
npm run cli help --format json
```

## 🎯 Advanced Usage Patterns

### Scripting Examples

```bash
#!/bin/bash
# Automated VM deployment script

# Check connectivity first
if ! npm run cli test-connection --quiet; then
    echo "❌ Cannot connect to Proxmox server"
    exit 1
fi

# Create VMs in loop
for i in {101..105}; do
    npm run cli vm create \
        --vmid $i \
        --name "auto-vm-$i" \
        --cores 2 \
        --memory 4096 \
        --start \
        --format json > "vm-$i-result.json"
done

# Verify all VMs are running
npm run cli vm list --status running --format json | \
    jq '.[] | select(.name | startswith("auto-vm")) | .vmid'
```

### JSON Output Processing

```bash
# Get list of running VMs as JSON
npm run cli vm list --status running --format json

# Extract specific information with jq
npm run cli vm list --format json | \
    jq '.[] | {vmid: .vmid, name: .name, memory: .memory}'

# Count VMs by status
npm run cli vm list --format json | \
    jq 'group_by(.status) | map({status: .[0].status, count: length})'

# Find VMs using more than 8GB RAM
npm run cli vm list --format json | \
    jq '.[] | select(.memory > 8192) | {name, memory}'
```

### Error Handling

```bash
# CLI commands return proper exit codes
if npm run cli vm start 100 --quiet; then
    echo "✅ VM started successfully"
else
    echo "❌ Failed to start VM"
    npm run cli vm list --vmid 100  # Check current status
fi

# Use --dry-run to preview operations
npm run cli vm delete 100 --dry-run
if [ $? -eq 0 ]; then
    npm run cli vm delete 100 --force
fi
```

## 🔍 Troubleshooting CLI Issues

### Common Problems

**Issue: Command not found**
```bash
# Solution 1: Use full npm run command
npm run cli vm list

# Solution 2: Install globally and use direct command
npm install -g proxmox-mpc
proxmox-mpc cli vm list
```

**Issue: Permission denied errors**
```bash
# Check API token permissions
npm run cli test-connection -v

# Verify configuration
npm run cli validate-config -v
```

**Issue: Connection timeouts**
```bash
# Test basic connectivity
ping your-proxmox-server

# Test API endpoint manually
curl -k https://your-proxmox-server:8006/api2/json/version

# Use verbose mode for diagnostics
npm run cli test-connection -v --timeout 60000
```

### Debug Mode

```bash
# Enable debug logging for all CLI operations
export DEBUG=proxmox-mpc:*
npm run cli vm list

# Debug specific modules only
export DEBUG=proxmox-mpc:api
npm run cli test-connection
```

---

**See Also:**

- **[Interactive Console Commands](console-commands.md)** - Console-specific commands
- **[Configuration Reference](configuration.md)** - Configuration file options  
- **[API Reference](api-reference.md)** - Programmatic API access
- **[Troubleshooting Guide](../troubleshooting/common-issues.md)** - Solve common problems