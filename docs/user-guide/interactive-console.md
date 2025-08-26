# Interactive Console Guide

The Interactive Console is the primary interface for Proxmox-MPC, providing a **Claude Code-like experience** for managing your Proxmox infrastructure. This comprehensive guide covers all aspects of using the interactive console effectively.

## Overview

The Proxmox-MPC Interactive Console offers:

- **Natural language commands** for infrastructure management
- **Project workspace integration** with automatic context awareness
- **Real-time state synchronization** between server and local database
- **Built-in help system** and command completion
- **Session management** with command history and workspace persistence

## Launching the Console

### Basic Launch
```bash
# Launch from any directory
proxmox-mpc

# Launch in specific project directory
cd ~/my-datacenter
proxmox-mpc
```

### Console Startup
When you launch the console, you'll see:
```
Proxmox-MPC Interactive Console v0.1.2

🔍 Workspace Detection:
   📁 Project: my-datacenter
   🔗 Server: https://192.168.1.100:8006
   📊 Status: Connected (15 VMs, 5 containers)

Type /help for available commands or /exit to quit.

proxmox-mpc> 
```

## Command Categories

### Core Slash Commands

#### Project Management
```bash
# Initialize new project
proxmox-mpc> /init

# Show project and server status  
proxmox-mpc> /status

# Sync state between server and local
proxmox-mpc> /sync

# Exit console with session summary
proxmox-mpc> /exit
```

#### Infrastructure Operations
```bash
# Preview changes before applying
proxmox-mpc> /plan

# Deploy infrastructure changes
proxmox-mpc> /apply

# Run infrastructure tests
proxmox-mpc> /test

# Validate configuration without changes
proxmox-mpc> /validate
```

#### State and History
```bash
# Compare local vs server state
proxmox-mpc> /diff

# Rollback to previous state
proxmox-mpc> /rollback snapshot-20240101-1200

# Export project for deployment elsewhere
proxmox-mpc> /export ../production-environment
```

#### Utilities and Help
```bash
# Show all available commands
proxmox-mpc> /help

# Show detailed command help
proxmox-mpc> /help create

# Show system and health information
proxmox-mpc> /health

# Debug information and troubleshooting
proxmox-mpc> /debug
```

### Resource Management Commands

#### Virtual Machine Operations
```bash
# Create VM with basic configuration
proxmox-mpc> create vm --name web-01 --cores 2 --memory 4096

# Create VM with advanced options
proxmox-mpc> create vm --name db-01 \
  --cores 4 \
  --memory 16384 \
  --disk 100 \
  --storage local-lvm \
  --network vmbr0 \
  --ostype linux

# List all VMs
proxmox-mpc> list vms

# List VMs with filters
proxmox-mpc> list vms --status running
proxmox-mpc> list vms --node proxmox-01

# Get detailed VM information
proxmox-mpc> describe vm 101
proxmox-mpc> describe vm web-01

# VM lifecycle operations
proxmox-mpc> vm start 101
proxmox-mpc> vm stop 101 --force
proxmox-mpc> vm restart 101
proxmox-mpc> vm shutdown 101

# Modify existing VM
proxmox-mpc> update vm 101 --cores 4 --memory 8192

# Delete VM (with safety confirmation)
proxmox-mpc> delete vm 101
```

#### Container Operations
```bash
# Create LXC container
proxmox-mpc> create container --name proxy-01 \
  --cores 1 \
  --memory 1024 \
  --disk 20 \
  --template ubuntu-22.04

# Container lifecycle operations
proxmox-mpc> container start 201
proxmox-mpc> container stop 201
proxmox-mpc> container restart 201

# List containers
proxmox-mpc> list containers

# Container details
proxmox-mpc> describe container 201
```

#### Resource Discovery
```bash
# List all resources
proxmox-mpc> list all

# List nodes and their status
proxmox-mpc> list nodes

# List storage pools
proxmox-mpc> list storage

# List networks
proxmox-mpc> list networks

# Show resource usage summary
proxmox-mpc> list resources --summary
```

## Command Syntax and Options

### Universal Options
Most commands support these common options:

```bash
--help              # Show command-specific help
--verbose, -v       # Detailed output
--dry-run          # Preview without executing
--force            # Skip confirmations (use carefully)
--node <name>      # Target specific node
--timeout <seconds> # Operation timeout
```

### VM Creation Options
```bash
create vm [options]
  --name <name>           # VM name (required)
  --vmid <id>            # Specific VM ID (auto-assigned if not specified)
  --cores <number>       # CPU cores (default: 1)
  --memory <mb>          # Memory in MB (default: 2048)
  --disk <gb>            # Disk size in GB (default: 32)
  --storage <name>       # Storage pool (default: local-lvm)
  --network <bridge>     # Network bridge (default: vmbr0)
  --ostype <type>        # OS type: linux, windows, other (default: linux)
  --template <name>      # Clone from template
  --node <name>          # Target node (auto-selected if not specified)
  --start               # Start VM after creation
  --description <text>   # VM description
```

### Container Creation Options
```bash
create container [options]
  --name <name>           # Container name (required)
  --vmid <id>            # Container ID (auto-assigned if not specified)
  --cores <number>       # CPU cores (default: 1)
  --memory <mb>          # Memory in MB (default: 512)
  --disk <gb>            # Disk size in GB (default: 8)
  --storage <name>       # Storage pool (default: local)
  --network <bridge>     # Network bridge (default: vmbr0)
  --template <name>      # OS template (required)
  --node <name>          # Target node
  --start               # Start container after creation
  --unprivileged        # Create unprivileged container (recommended)
```

## Advanced Features

### Command Completion and History

#### Tab Completion
The console supports intelligent tab completion:

```bash
# Command completion
proxmox-mpc> cr<TAB>
create

# Subcommand completion
proxmox-mpc> create <TAB>
vm  container

# Option completion
proxmox-mpc> create vm --<TAB>
--name  --cores  --memory  --disk  --storage  --network
```

#### Command History
Navigate through previous commands:

- **Up/Down arrows**: Browse command history
- **Ctrl+R**: Search command history
- **Ctrl+A**: Beginning of line
- **Ctrl+E**: End of line
- **Ctrl+C**: Cancel current command

```bash
# History is persistent across sessions
proxmox-mpc> /history

Recent commands:
  1. /status
  2. create vm --name web-01 --cores 2 --memory 4096
  3. /test
  4. /apply
  5. /sync
```

### Session Management

#### Workspace Context
The console automatically detects and maintains workspace context:

```bash
# Automatic workspace detection
proxmox-mpc> /status
📊 Project Status:
   📁 Workspace: /home/user/my-datacenter
   🔗 Server: https://192.168.1.100:8006 (Connected)
   📊 Resources: 15 VMs, 5 containers, 3 nodes
   🗄️  Database: 847 records, last sync 2 minutes ago
```

#### Multi-Project Support
```bash
# Switch between projects
cd ~/project-a
proxmox-mpc
proxmox-mpc> /status  # Shows project-a context

# Exit and switch
proxmox-mpc> /exit
cd ~/project-b  
proxmox-mpc
proxmox-mpc> /status  # Shows project-b context
```

### Error Handling and Validation

#### Input Validation
```bash
proxmox-mpc> create vm --memory invalid
❌ Error: Memory must be a number (e.g., 2048, 4096)

proxmox-mpc> create vm --name "vm with spaces"
❌ Error: VM names cannot contain spaces. Use hyphens: vm-with-hyphens
```

#### Connection Issues
```bash
proxmox-mpc> /status
⚠️  Warning: Cannot connect to Proxmox server
   🔗 Server: https://192.168.1.100:8006
   ❌ Error: Connection timeout after 10 seconds
   
💡 Troubleshooting suggestions:
   1. Check network connectivity: ping 192.168.1.100  
   2. Verify server is running: https://192.168.1.100:8006
   3. Check API token permissions
   4. Try: proxmox-mpc> /debug
```

#### Resource Conflicts
```bash
proxmox-mpc> create vm --name web-01
❌ Error: VM name 'web-01' already exists
   
💡 Suggestions:
   - Use different name: web-02, web-01-dev
   - Check existing VM: describe vm web-01
   - Delete existing: delete vm web-01 (if safe)
```

## Configuration and Customization

### Console Preferences
Create `~/.proxmox-mpc/console.yml` for custom preferences:

```yaml
console:
  # Prompt customization
  prompt: "pmpc> "
  colors: true
  
  # Command behavior
  auto_complete: true
  history_size: 1000
  confirm_destructive: true
  
  # Display preferences  
  verbose_output: false
  show_timestamps: true
  table_format: "grid"  # grid, simple, plain
```

### Command Aliases
```bash
# Built-in aliases
proxmox-mpc> ls        # Alias for 'list'
proxmox-mpc> info vm 101  # Alias for 'describe vm 101'
proxmox-mpc> help      # Alias for '/help'

# Custom aliases (in config file)
aliases:
  ll: "list vms --verbose"
  st: "/status"
  sy: "/sync"
```

## Tips and Best Practices

### Efficient Workflows

#### 1. Start with Status
Always check project status before making changes:
```bash
proxmox-mpc> /status
proxmox-mpc> /sync  # If needed
```

#### 2. Use Test-Driven Infrastructure
```bash
proxmox-mpc> create vm --name web-01 --cores 2 --memory 4096
proxmox-mpc> /test     # Validate configuration
proxmox-mpc> /plan     # Preview changes  
proxmox-mpc> /apply    # Deploy if tests pass
```

#### 3. Regular Synchronization
```bash
# Keep everything in sync
proxmox-mpc> /sync     # Daily or after manual changes
```

#### 4. Use Descriptive Names
```bash
# Good naming conventions
proxmox-mpc> create vm --name web-frontend-01
proxmox-mpc> create vm --name db-postgres-primary
proxmox-mpc> create container --name cache-redis-01
```

### Troubleshooting Workflows

#### 1. Check Connection and Status
```bash
proxmox-mpc> /health
proxmox-mpc> /status
proxmox-mpc> /debug
```

#### 2. Verify Resource States
```bash
proxmox-mpc> list vms --status all
proxmox-mpc> describe vm <name>
proxmox-mpc> /diff  # Check for drift
```

#### 3. Test Infrastructure
```bash
proxmox-mpc> /test
proxmox-mpc> /validate
```

### Performance Optimization

#### 1. Use Filters for Large Environments
```bash
# Instead of listing everything
proxmox-mpc> list vms --node proxmox-01
proxmox-mpc> list vms --status running
```

#### 2. Batch Operations When Possible
```bash
# Group related operations
proxmox-mpc> create vm --name web-01 --cores 2 --memory 4096
proxmox-mpc> create vm --name web-02 --cores 2 --memory 4096
proxmox-mpc> /test && /apply  # Deploy both together
```

## Integration with Other Tools

### Version Control Integration
```bash
# After significant changes
proxmox-mpc> /sync
git add .
git commit -m "Add web-01 and web-02 VMs"
```

### CI/CD Integration
```bash
# In CI/CD pipelines
proxmox-mpc> /plan --json > plan.json
proxmox-mpc> /test --junit > test-results.xml
proxmox-mpc> /apply --auto-approve
```

### Monitoring Integration
```bash
# Export metrics for monitoring
proxmox-mpc> /health --json
proxmox-mpc> list resources --metrics --json
```

## Common Patterns

### Development Environment Setup
```bash
proxmox-mpc> /init
proxmox-mpc> /sync
proxmox-mpc> create vm --name dev-web --cores 1 --memory 2048
proxmox-mpc> create vm --name dev-db --cores 2 --memory 4096
proxmox-mpc> create container --name dev-cache --template ubuntu-22.04
proxmox-mpc> /test && /apply
```

### Production Deployment
```bash
# Import and validate existing infrastructure
proxmox-mpc> /sync
proxmox-mpc> /test
proxmox-mpc> /validate

# Make changes
proxmox-mpc> create vm --name prod-web-03 --cores 4 --memory 8192
proxmox-mpc> /test
proxmox-mpc> /plan
proxmox-mpc> /apply
```

### Disaster Recovery
```bash
# Regular backup
proxmox-mpc> /sync
proxmox-mpc> /export ../backup-$(date +%Y%m%d)

# Recovery on new infrastructure  
cd ../new-datacenter
proxmox-mpc> /init
# Configure new server details
proxmox-mpc> /apply  # Recreate all infrastructure
```

## Console Output Examples

### Successful Operations
```bash
proxmox-mpc> create vm --name web-01 --cores 2 --memory 4096

🏗️  Creating VM: web-01
   ✅ Validation passed
   ✅ Resources available  
   ✅ Configuration generated

📝 Generated Files:
   terraform/vms/web-01.tf
   ansible/playbooks/web-01.yml
   tests/vms/web-01.test.js

✅ VM configuration created successfully!
   💡 Next steps: /test, /plan, /apply
```

### Error Scenarios
```bash
proxmox-mpc> create vm --name existing-vm

❌ Configuration Error
   Problem: VM name 'existing-vm' already exists
   VM ID: 150
   Node: proxmox-02
   Status: running

💡 Resolution Options:
   1. Choose different name: create vm --name existing-vm-2
   2. View existing VM: describe vm existing-vm
   3. Delete if safe: delete vm existing-vm --confirm
```

---

The Interactive Console provides a powerful, intuitive interface for managing your Proxmox infrastructure. Master these commands and patterns to efficiently manage your virtualized environment with Infrastructure-as-Code best practices.

**Next**: Explore [CLI Commands](cli-commands.md) for scripting and automation, or dive into [Resource Management](resource-management.md) for advanced operations.