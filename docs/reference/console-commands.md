# Console Commands Reference

Complete reference for all Proxmox-MPC Interactive Console commands. This reference covers every command, parameter, and option available in the interactive console.

!!! tip "Quick Reference"
    Use `/help` in the console for contextual help, or `/help <command>` for detailed command information.

## Command Categories

### Core Slash Commands

#### `/init` - Initialize Project Workspace

Initialize a new Proxmox project workspace with interactive configuration wizard.

**Syntax:**
```bash
/init [--config <file>] [--template <name>] [--force]
```

**Options:**
- `--config <file>`: Use configuration file instead of interactive wizard
- `--template <name>`: Use project template (basic, advanced, enterprise)
- `--force`: Overwrite existing project configuration
- `--dry-run`: Preview initialization without creating files

**Examples:**
```bash
# Interactive initialization (recommended)
/init

# Use configuration file
/init --config ./proxmox-config.yml

# Force overwrite existing project
/init --force

# Use enterprise template
/init --template enterprise
```

**Generated Structure:**
- `.proxmox/config.yml` - Server connection configuration
- `.proxmox/state.db` - Local SQLite database
- `terraform/` - Terraform configuration directory
- `ansible/` - Ansible playbooks directory
- `tests/` - Infrastructure tests directory

---

#### `/sync` - Synchronize State

Bidirectional synchronization between Proxmox server, local database, and Infrastructure-as-Code files.

**Syntax:**
```bash
/sync [--direction <direction>] [--resources <types>] [--force] [--dry-run]
```

**Options:**
- `--direction <direction>`: Sync direction
  - `both` (default): Bidirectional sync
  - `pull`: Server → Local only
  - `push`: Local → Server only
- `--resources <types>`: Resource types to sync
  - `all` (default): All resource types
  - `vms`: Virtual machines only
  - `containers`: Containers only
  - `nodes`: Node information only
- `--force`: Override conflict resolution prompts
- `--dry-run`: Preview sync changes without executing

**Examples:**
```bash
# Full bidirectional sync
/sync

# Pull only from server
/sync --direction pull

# Sync only VMs
/sync --resources vms

# Preview sync changes
/sync --dry-run
```

**Output:**
```
🔄 Synchronizing infrastructure state...

Discovery:
  📊 3 nodes discovered
  💻 12 VMs found (2 new, 1 modified)
  📦 5 containers found (1 new)

Generated Files:
  📝 terraform/nodes.tf (updated)
  📝 terraform/vms/web-03.tf (new)
  📝 ansible/inventory.yml (updated)

✅ Sync completed: 3 resources added, 1 updated, 0 removed
```

---

#### `/status` - Show Project Status

Display comprehensive project and server status information.

**Syntax:**
```bash
/status [--verbose] [--json] [--health-check]
```

**Options:**
- `--verbose, -v`: Show detailed status information
- `--json`: Output in JSON format
- `--health-check`: Include detailed health checks

**Examples:**
```bash
# Basic status
/status

# Detailed status with health checks
/status --verbose --health-check

# JSON output for scripting
/status --json
```

**Output:**
```
📊 Proxmox-MPC Project Status

Project Information:
  📁 Workspace: /home/user/my-datacenter
  🏷️  Name: my-datacenter
  📝 Description: Production datacenter infrastructure
  📅 Created: 2024-01-15 (10 days ago)
  📅 Last Sync: 2024-01-25 14:30:15 (5 minutes ago)

Server Connection:
  🔗 URL: https://192.168.1.100:8006
  ✅ Status: Connected (198ms)
  🔑 Authentication: Valid token (expires in 45 days)
  📊 API Version: 8.1.3

Infrastructure Overview:
  📊 3 nodes (all online)
  💻 15 VMs (12 running, 2 stopped, 1 template)
  📦 5 containers (4 running, 1 stopped)
  💾 8 storage pools (234.5 GB used, 1.2 TB available)

Local Database:
  🗄️  Records: 1,247
  📈 Size: 2.3 MB
  ✅ Integrity: OK
```

---

#### `/apply` - Deploy Infrastructure Changes

Deploy Infrastructure-as-Code changes to the Proxmox server.

**Syntax:**
```bash
/apply [--plan-file <file>] [--auto-approve] [--parallelism <n>]
```

**Options:**
- `--plan-file <file>`: Apply specific plan file
- `--auto-approve`: Skip confirmation prompts
- `--parallelism <n>`: Number of parallel operations (default: 3)
- `--target <resource>`: Apply changes to specific resource only
- `--dry-run`: Show what would be applied without executing

**Examples:**
```bash
# Apply all planned changes (with confirmation)
/apply

# Auto-approve for CI/CD
/apply --auto-approve

# Apply with limited parallelism
/apply --parallelism 1

# Apply only specific resource
/apply --target vm.web-01
```

**Process Flow:**
1. **Validation**: Checks configuration and connectivity
2. **Planning**: Generates execution plan
3. **Confirmation**: Shows changes and requests approval
4. **Execution**: Applies changes with progress tracking
5. **Verification**: Validates successful deployment

---

#### `/plan` - Preview Infrastructure Changes

Generate and display execution plan for infrastructure changes.

**Syntax:**
```bash
/plan [--out <file>] [--json] [--detailed]
```

**Options:**
- `--out <file>`: Save plan to file
- `--json`: Output in JSON format
- `--detailed`: Show detailed resource attributes
- `--target <resource>`: Plan for specific resource only

**Examples:**
```bash
# Show execution plan
/plan

# Save plan to file
/plan --out infrastructure.plan

# Detailed plan with all attributes
/plan --detailed

# JSON output for processing
/plan --json
```

**Output Example:**
```
📋 Infrastructure Execution Plan

Terraform will perform the following actions:

  # proxmox_vm_qemu.web-03 will be created
  + resource "proxmox_vm_qemu" "web-03" {
      + name         = "web-03"
      + target_node  = "proxmox-01"
      + vmid         = 103
      + cores        = 2
      + memory       = 4096
      + disk {
          + size     = "50G"
          + storage  = "local-lvm"
          + type     = "virtio"
        }
    }

Plan: 1 to add, 0 to change, 0 to destroy.
```

---

#### `/test` - Run Infrastructure Tests

Execute infrastructure validation and integration tests.

**Syntax:**
```bash
/test [--suite <suite>] [--parallel] [--junit <file>] [--coverage]
```

**Options:**
- `--suite <suite>`: Run specific test suite
  - `all` (default): All test suites
  - `validation`: Configuration validation only
  - `integration`: Integration tests with server
  - `performance`: Performance and capacity tests
- `--parallel`: Run tests in parallel
- `--junit <file>`: Output JUnit XML for CI/CD
- `--coverage`: Include test coverage report

**Examples:**
```bash
# Run all tests
/test

# Run only validation tests
/test --suite validation

# Parallel execution with JUnit output
/test --parallel --junit test-results.xml
```

**Output:**
```
🧪 Running Infrastructure Tests

Configuration Validation:
  ✅ VM configurations valid (15/15)
  ✅ Container configurations valid (5/5)
  ✅ Network configurations valid (3/3)
  ✅ Storage allocations available

Integration Tests:
  ✅ Proxmox API connectivity
  ✅ Authentication working
  ✅ Resource creation permissions
  ✅ Network connectivity from VMs

Performance Tests:
  ✅ Resource utilization within limits
  ✅ Storage performance adequate
  ✅ Network latency acceptable

📊 Test Results: 18 passed, 0 failed, 0 skipped
✅ All tests passed! Infrastructure ready for deployment.
```

---

### Resource Management Commands

#### `create vm` - Create Virtual Machine

Create a new virtual machine with specified configuration.

**Syntax:**
```bash
create vm --name <name> [options]
```

**Required Options:**
- `--name <name>`: VM name (must be unique)

**Configuration Options:**
- `--vmid <id>`: Specific VM ID (auto-assigned if not specified)
- `--cores <number>`: CPU cores (default: 1, range: 1-64)
- `--memory <mb>`: Memory in MB (default: 2048, min: 512)
- `--disk <gb>`: Primary disk size in GB (default: 32)
- `--storage <pool>`: Storage pool name (default: local-lvm)
- `--ostype <type>`: OS type (linux, windows, other - default: linux)

**Network Options:**
- `--network <bridge>`: Network bridge (default: vmbr0)
- `--ip <address>`: Static IP address (CIDR notation)
- `--gateway <ip>`: Gateway IP address
- `--dns <servers>`: DNS servers (comma-separated)

**Advanced Options:**
- `--template <name>`: Clone from existing template
- `--node <name>`: Target node (auto-selected if not specified)
- `--description <text>`: VM description
- `--start`: Start VM after creation
- `--enable-backup`: Enable automatic backups
- `--cpu-type <type>`: CPU type (host, kvm64, qemu64)

**Examples:**
```bash
# Basic VM creation
create vm --name web-01 --cores 2 --memory 4096

# Advanced VM with networking
create vm --name db-01 \
  --cores 4 \
  --memory 16384 \
  --disk 100 \
  --storage premium-ssd \
  --ip 192.168.1.50/24 \
  --gateway 192.168.1.1 \
  --start

# Clone from template
create vm --name app-01 --template ubuntu-server-template --start
```

---

#### `create container` - Create LXC Container

Create a new LXC container with specified configuration.

**Syntax:**
```bash
create container --name <name> --template <template> [options]
```

**Required Options:**
- `--name <name>`: Container name (must be unique)
- `--template <template>`: OS template name

**Configuration Options:**
- `--vmid <id>`: Container ID (auto-assigned if not specified)
- `--cores <number>`: CPU cores (default: 1)
- `--memory <mb>`: Memory in MB (default: 512)
- `--disk <gb>`: Disk size in GB (default: 8)
- `--storage <pool>`: Storage pool (default: local)

**Network Options:**
- `--network <bridge>`: Network bridge (default: vmbr0)
- `--ip <address>`: Static IP address
- `--gateway <ip>`: Gateway IP address

**Advanced Options:**
- `--unprivileged`: Create unprivileged container (recommended)
- `--node <name>`: Target node
- `--start`: Start container after creation
- `--ssh-keys <file>`: SSH public keys file

**Examples:**
```bash
# Basic container
create container --name proxy-01 --template ubuntu-22.04

# Advanced container with networking
create container --name cache-01 \
  --template ubuntu-22.04 \
  --cores 2 \
  --memory 2048 \
  --ip 192.168.1.60/24 \
  --unprivileged \
  --start
```

---

#### `list` - List Resources

List and display various types of resources with filtering options.

**Syntax:**
```bash
list <resource-type> [filters] [options]
```

**Resource Types:**
- `vms`: Virtual machines
- `containers`: LXC containers
- `nodes`: Proxmox nodes
- `storage`: Storage pools
- `networks`: Network bridges
- `all`: All resources

**Filter Options:**
- `--status <status>`: Filter by status
  - For VMs: `running`, `stopped`, `paused`, `template`
  - For containers: `running`, `stopped`
  - For nodes: `online`, `offline`
- `--node <name>`: Resources on specific node
- `--name-pattern <pattern>`: Filter by name pattern (regex)
- `--tag <tag>`: Filter by tag

**Display Options:**
- `--format <format>`: Output format (table, json, csv, yaml)
- `--columns <columns>`: Specific columns to display
- `--sort <column>`: Sort by column
- `--limit <n>`: Limit number of results

**Examples:**
```bash
# List all VMs
list vms

# List running VMs only
list vms --status running

# List VMs on specific node
list vms --node proxmox-01

# List with custom columns and JSON output
list vms --columns name,status,memory,cores --format json

# List containers with name pattern
list containers --name-pattern "^web-"
```

---

#### `describe` - Detailed Resource Information

Show detailed information about a specific resource.

**Syntax:**
```bash
describe <resource-type> <identifier> [options]
```

**Resource Types:**
- `vm <vmid|name>`: Virtual machine details
- `container <vmid|name>`: Container details  
- `node <name>`: Node information
- `storage <name>`: Storage pool details

**Options:**
- `--json`: Output in JSON format
- `--yaml`: Output in YAML format
- `--include-config`: Include full configuration
- `--include-stats`: Include performance statistics

**Examples:**
```bash
# VM details by ID
describe vm 101

# VM details by name
describe vm web-01

# Container with full configuration
describe container proxy-01 --include-config

# Node information with statistics
describe node proxmox-01 --include-stats
```

---

### Utility and Management Commands

#### `/help` - Show Help Information

Display help information for commands and general usage.

**Syntax:**
```bash
/help [command] [--detailed] [--examples]
```

**Options:**
- `command`: Show help for specific command
- `--detailed`: Show detailed help with all options
- `--examples`: Include usage examples

**Examples:**
```bash
# General help
/help

# Command-specific help
/help create

# Detailed help with examples
/help create vm --detailed --examples
```

---

#### `/exit` - Exit Console

Exit the interactive console with optional session summary.

**Syntax:**
```bash
/exit [--summary] [--save-session]
```

**Options:**
- `--summary`: Show session summary before exit
- `--save-session`: Save current session for later resume

**Examples:**
```bash
# Simple exit
/exit

# Exit with session summary
/exit --summary
```

**Session Summary Example:**
```
📊 Session Summary

Duration: 45 minutes 23 seconds
Commands executed: 23
Resources created: 2 VMs, 1 container
Resources modified: 1 VM (web-01)
Tests run: 3 suites (all passed)
Sync operations: 2

Recent activity:
  ✅ Created VM: web-03
  ✅ Updated VM: web-01 (increased memory)
  ✅ Ran tests: all passed
  ✅ Deployed changes: 2 resources

👋 Goodbye! Your workspace has been saved.
```

---

## Global Options

These options can be used with most commands:

- `--help, -h`: Show command help
- `--verbose, -v`: Verbose output with detailed information
- `--quiet, -q`: Suppress non-essential output
- `--json`: Output in JSON format
- `--yaml`: Output in YAML format  
- `--dry-run`: Preview action without executing
- `--force`: Skip confirmations (use with caution)
- `--timeout <seconds>`: Command timeout (default: 300)

## Error Handling

All commands provide clear error messages with suggested solutions:

```bash
proxmox-mpc> create vm --memory invalid

❌ Invalid Parameter: memory
   Value: 'invalid'
   Expected: Number (MB)
   Examples: 2048, 4096, 8192

💡 Suggestion: create vm --name myvm --memory 4096
```

## Command Aliases

Built-in command aliases for efficiency:

- `ls` → `list`
- `info` → `describe`
- `help` → `/help`
- `quit` → `/exit`
- `sync` → `/sync`
- `test` → `/test`

---

This reference provides comprehensive coverage of all console commands. For additional examples and workflows, see the [User Guide](../user-guide/interactive-console.md) and [Tutorials](../tutorials/basic-vm-management.md).

**Quick Navigation:**
- [Interactive Console Guide](../user-guide/interactive-console.md) - Complete usage guide
- [CLI Reference](cli-reference.md) - Command-line interface reference
- [Configuration Reference](configuration.md) - Configuration file options