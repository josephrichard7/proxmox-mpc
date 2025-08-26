# CLI Commands Guide

This guide provides comprehensive information about using Proxmox-MPC's professional CLI interface for scripting, automation, and batch operations.

## 🎯 CLI Overview

The Proxmox-MPC CLI provides 20+ professional-grade commands designed for:
- **Automation**: Script infrastructure deployment and management
- **CI/CD Integration**: Integrate with continuous deployment pipelines
- **Batch Operations**: Perform bulk operations across multiple resources
- **Monitoring**: Automated health checks and performance monitoring

### Quick Reference

```bash
# Connection and Discovery
npm run cli test-connection              # Test server connectivity
npm run cli list-nodes                   # List cluster nodes
npm run cli discover-vms                 # Discover all VMs
npm run cli discover-containers          # Discover all containers

# VM Management
npm run cli vm list                      # List all VMs
npm run cli vm create --vmid 100 --name web-01  # Create VM
npm run cli vm start 100                 # Start VM
npm run cli vm stop 100                  # Stop VM
npm run cli vm delete 100 --purge        # Delete VM

# Container Management
npm run cli container list               # List containers
npm run cli container create --vmid 200 --hostname app-ct
npm run cli container start 200         # Start container
npm run cli container exec 200 -- "ls -la"  # Execute command

# Infrastructure Operations
npm run cli sync-state                   # Sync infrastructure state
npm run cli health-check                 # Comprehensive health check
npm run cli validate-config              # Validate configuration
```

## 🔌 Getting Started with CLI

### Installation and Setup

If you haven't already, install Proxmox-MPC globally:

```bash
# Install globally for easy CLI access
npm install -g proxmox-mpc

# Or use project-local installation
cd your-proxmox-project
npm install

# Test CLI access
npm run cli --help
# or if installed globally:
proxmox-mpc cli --help
```

### First CLI Commands

Start with these essential commands:

```bash
# 1. Test connectivity to your Proxmox server
npm run cli test-connection -v

# 2. Explore your infrastructure
npm run cli list-nodes
npm run cli discover-vms
npm run cli discover-containers

# 3. Check system health
npm run cli health-check
```

## 🖥️ VM Management Commands

### Basic VM Operations

**List VMs with detailed information:**
```bash
# Basic listing
npm run cli vm list

# Filter by status
npm run cli vm list --status running
npm run cli vm list --status stopped

# Filter by node
npm run cli vm list --node proxmox-node-01

# Verbose output with resource details
npm run cli vm list -v

# JSON output for scripting
npm run cli vm list --format json
```

**Create new VMs:**
```bash
# Basic VM creation
npm run cli vm create \
  --vmid 150 \
  --name development-vm \
  --cores 2 \
  --memory 4096

# Full configuration example
npm run cli vm create \
  --vmid 151 \
  --name production-web \
  --node proxmox-node-01 \
  --cores 8 \
  --memory 16384 \
  --disk-size 100 \
  --storage local-lvm \
  --network vmbr0 \
  --ostype linux \
  --start \
  --description "Production web server"

# Create from template
npm run cli vm create \
  --vmid 152 \
  --name from-template \
  --template 9000 \
  --cores 4 \
  --memory 8192 \
  --start
```

**VM Lifecycle Management:**
```bash
# Start VMs
npm run cli vm start 150
npm run cli vm start 150 --wait  # Wait for boot completion

# Stop VMs
npm run cli vm stop 150          # Graceful shutdown
npm run cli vm stop 150 --force  # Force stop

# Restart VMs
npm run cli vm restart 150
npm run cli vm restart 150 --wait

# Delete VMs
npm run cli vm delete 150                    # Keep disks
npm run cli vm delete 150 --purge           # Remove disks
npm run cli vm delete 150 --force --purge   # No confirmation
```

### Advanced VM Operations

**VM Configuration Management:**
```bash
# View VM configuration
npm run cli vm config 150
npm run cli vm config 150 --format json

# Update VM configuration
npm run cli vm config 150 --memory 8192
npm run cli vm config 150 --cores 4 --memory 8192
npm run cli vm config 150 --description "Updated configuration"

# Bulk configuration changes
npm run cli vm config 150,151,152 --memory 8192  # Multiple VMs
```

**VM Cloning and Templates:**
```bash
# Clone VM
npm run cli vm clone 150 --new-vmid 160 --name cloned-vm

# Convert VM to template
npm run cli vm template 150

# Deploy from template
npm run cli vm deploy --template 150 --vmid 170 --name deployed-vm
```

## 📦 Container Management Commands

### Basic Container Operations

**List and manage containers:**
```bash
# List all containers
npm run cli container list

# Filter containers
npm run cli container list --status running
npm run cli container list --node proxmox-node-01

# Detailed container information
npm run cli container list -v
```

**Create containers:**
```bash
# Basic container creation
npm run cli container create \
  --vmid 300 \
  --hostname web-container \
  --ostemplate ubuntu-22.04-standard

# Full container configuration
npm run cli container create \
  --vmid 301 \
  --hostname database-container \
  --ostemplate ubuntu-22.04-standard \
  --cores 4 \
  --memory 4096 \
  --rootfs-size 50 \
  --storage local-lvm \
  --network name=eth0,bridge=vmbr0,ip=192.168.1.50/24 \
  --start \
  --unprivileged \
  --features nesting=1,keyctl=1
```

### Container Operations

**Container lifecycle:**
```bash
# Start/stop containers
npm run cli container start 300
npm run cli container stop 300
npm run cli container restart 300

# Execute commands in containers
npm run cli container exec 300 -- "apt update && apt upgrade -y"
npm run cli container exec 300 --user www-data -- "whoami"

# Interactive shell access
npm run cli container exec 300 --interactive
```

**Container management:**
```bash
# Container configuration
npm run cli container config 300
npm run cli container config 300 --memory 2048

# Container deletion
npm run cli container delete 300
npm run cli container delete 300 --purge --force
```

## 💾 Storage and Resource Commands

### Storage Management

```bash
# List storage pools
npm run cli storage list
npm run cli storage list -v                    # Detailed information
npm run cli storage list --type lvm            # Filter by type
npm run cli storage list --format json         # JSON output

# Storage usage analysis
npm run cli storage usage
npm run cli storage usage --node proxmox-node-01
npm run cli storage usage --threshold 80       # Show pools >80% full

# Create storage (advanced)
npm run cli storage create \
  --id backup-storage \
  --type nfs \
  --server 192.168.1.200 \
  --export /backup \
  --content backup,iso
```

### Resource Monitoring

```bash
# Node resource usage
npm run cli resources nodes
npm run cli resources nodes -v                 # Detailed metrics

# VM resource usage
npm run cli resources vms
npm run cli resources vms --sort-by memory     # Sort by memory usage
npm run cli resources vms --threshold-cpu 80   # High CPU usage

# Container resource usage
npm run cli resources containers
npm run cli resources containers --node proxmox-node-01
```

## 🔄 Infrastructure Synchronization

### State Management

**Synchronize infrastructure state:**
```bash
# Full infrastructure sync
npm run cli sync-state

# Sync specific resource types
npm run cli sync-state --resources vms
npm run cli sync-state --resources containers
npm run cli sync-state --resources vms,containers,storage

# Dry-run sync (preview changes)
npm run cli sync-state --dry-run

# Force sync (ignore timestamps)
npm run cli sync-state --force

# Sync with detailed output
npm run cli sync-state -v
```

**Discovery operations:**
```bash
# Discover and catalog VMs
npm run cli discover-vms
npm run cli discover-vms --node proxmox-node-01
npm run cli discover-vms --update-db           # Update local database

# Discover containers
npm run cli discover-containers
npm run cli discover-containers -v

# Full infrastructure discovery
npm run cli discover-all
npm run cli discover-all --format json > infrastructure.json
```

### Configuration Management

**Validate configurations:**
```bash
# Validate Proxmox-MPC configuration
npm run cli validate-config
npm run cli validate-config --config production.yml
npm run cli validate-config -v                 # Verbose validation

# Validate generated IaC files
npm run cli validate-iac
npm run cli validate-iac --terraform-only
npm run cli validate-iac --ansible-only
```

## 🧪 Testing and Validation

### Infrastructure Testing

```bash
# Run comprehensive infrastructure tests
npm run cli test-infrastructure
npm run cli test-infrastructure -v

# Run specific test categories
npm run cli test-infrastructure --category connectivity
npm run cli test-infrastructure --category performance
npm run cli test-infrastructure --category security

# Generate test reports
npm run cli test-infrastructure --report tests/report.json
npm run cli test-infrastructure --report tests/report.html --format html
```

### Health Checks

```bash
# System health check
npm run cli health-check
npm run cli health-check -v                    # Detailed analysis
npm run cli health-check --metrics             # Include performance metrics

# Export health data
npm run cli health-check --export health.json
npm run cli health-check --export health.csv --format csv

# Continuous monitoring
npm run cli health-check --watch               # Monitor continuously
npm run cli health-check --watch --interval 30 # Check every 30 seconds
```

## 📊 Monitoring and Performance

### Performance Metrics

```bash
# Current performance metrics
npm run cli performance-metrics
npm run cli performance-metrics --detailed

# Historical performance data
npm run cli performance-metrics --history 1d   # Last day
npm run cli performance-metrics --history 7d   # Last week
npm run cli performance-metrics --history 30d  # Last month

# Export metrics for external monitoring
npm run cli performance-metrics --export metrics.json
npm run cli performance-metrics --export metrics.prom --format prometheus
```

### System Monitoring

```bash
# Real-time system monitoring
npm run cli monitor
npm run cli monitor --refresh 5                # Refresh every 5 seconds

# Monitor specific resources
npm run cli monitor --vms                      # VMs only
npm run cli monitor --containers               # Containers only
npm run cli monitor --storage                  # Storage only

# Alert-based monitoring
npm run cli monitor --alerts                   # Show only alerts
npm run cli monitor --threshold-cpu 80         # CPU > 80%
npm run cli monitor --threshold-memory 85      # Memory > 85%
```

## 🔧 Automation and Scripting

### Batch Operations

**Bulk VM operations:**
```bash
# Start multiple VMs
npm run cli vm start 100,101,102
npm run cli vm start --pattern "web-*"         # All VMs matching pattern

# Update multiple VMs
npm run cli vm config 100-105 --memory 8192    # Range of VMIDs
npm run cli vm config --tag production --cores 4  # All VMs with tag

# Bulk deletion (be careful!)
npm run cli vm delete 150-155 --dry-run        # Preview first
npm run cli vm delete --status stopped --purge # Delete all stopped VMs
```

**Scripting examples:**
```bash
#!/bin/bash
# Automated VM deployment script

# Array of VMs to create
VMs=(
  "100:web-01:2:4096"
  "101:web-02:2:4096" 
  "102:db-01:4:8192"
  "103:db-02:4:8192"
)

# Create VMs in loop
for vm_spec in "${VMs[@]}"; do
  IFS=':' read -r vmid name cores memory <<< "$vm_spec"
  
  echo "Creating VM: $name (ID: $vmid)"
  npm run cli vm create \
    --vmid "$vmid" \
    --name "$name" \
    --cores "$cores" \
    --memory "$memory" \
    --start \
    --format json > "results/vm-$vmid.json"
    
  if [ $? -eq 0 ]; then
    echo "✅ VM $name created successfully"
  else
    echo "❌ Failed to create VM $name"
  fi
done

# Wait for all VMs to be running
echo "Waiting for VMs to start..."
sleep 30

# Verify all VMs are running
npm run cli vm list --status running --format json | \
  jq -r '.[] | select(.vmid as $id | [100,101,102,103] | index($id)) | "\(.vmid): \(.name) - \(.status)"'
```

### JSON Processing and Integration

**Using jq for advanced processing:**
```bash
# Extract specific VM information
npm run cli vm list --format json | \
  jq '.[] | {vmid: .vmid, name: .name, status: .status, memory: .memory}'

# Find VMs using more than 8GB RAM
npm run cli vm list --format json | \
  jq '.[] | select(.memory > 8192) | {name, memory, node}'

# Group VMs by status
npm run cli vm list --format json | \
  jq 'group_by(.status) | map({status: .[0].status, count: length})'

# Generate Ansible inventory from CLI output
npm run cli vm list --status running --format json | \
  jq -r '
    {
      all: {
        children: {
          proxmox_vms: {
            hosts: (
              .[] | {
                (.name): {
                  ansible_host: .ip_address,
                  proxmox_vmid: .vmid,
                  proxmox_node: .node
                }
              }
            )
          }
        }
      }
    }
  ' > inventory.json
```

### CI/CD Integration

**GitLab CI example:**
```yaml
# .gitlab-ci.yml
stages:
  - test
  - deploy

variables:
  PROXMOX_HOST: "proxmox.company.com"
  PROXMOX_USERNAME: "ci@pve"
  
test_infrastructure:
  stage: test
  script:
    - npm install -g proxmox-mpc
    - npm run cli test-connection
    - npm run cli validate-config
    - npm run cli test-infrastructure --report tests/report.json
  artifacts:
    reports:
      junit: tests/report.xml
    paths:
      - tests/

deploy_staging:
  stage: deploy
  script:
    - npm run cli sync-state --dry-run
    - npm run cli vm create --vmid 200 --name staging-app --start
    - npm run cli health-check
  only:
    - staging
    
deploy_production:
  stage: deploy
  script:
    - npm run cli validate-config --config production.yml
    - npm run cli sync-state --force
    - npm run cli health-check --metrics
  only:
    - main
  when: manual
```

## 🔧 Advanced CLI Features

### Output Formatting and Processing

```bash
# Different output formats
npm run cli vm list --format table              # Default table format
npm run cli vm list --format json               # JSON for scripting
npm run cli vm list --format yaml               # YAML format
npm run cli vm list --format csv                # CSV for spreadsheets

# Custom field selection
npm run cli vm list --fields vmid,name,status,memory
npm run cli vm list --fields vmid,name --format json

# Sorting and filtering
npm run cli vm list --sort-by memory --descending
npm run cli vm list --filter "memory>4096"
npm run cli vm list --filter "status=running" --sort-by name
```

### Configuration and Profiles

```bash
# Use different configuration files
npm run cli test-connection --config ~/.proxmox-mpc/homelab.yml
npm run cli vm list --config environments/production.yml

# Profile management
npm run cli profile list
npm run cli profile set homelab
npm run cli profile create production --host prod.company.com

# Environment variables
export PROXMOX_CONFIG=production.yml
npm run cli vm list  # Uses production.yml automatically
```

### Debug and Troubleshooting

```bash
# Enable debug output
export DEBUG=proxmox-mpc:*
npm run cli test-connection

# Verbose logging
npm run cli vm create --vmid 200 --name debug-vm -v

# Dry-run mode for safety
npm run cli vm delete 200 --dry-run
npm run cli sync-state --dry-run

# Timeout configuration
npm run cli test-connection --timeout 60000     # 60 second timeout
npm run cli vm start 100 --wait --timeout 300   # 5 minute boot timeout
```

## 🎯 Best Practices

### Production Usage

1. **Always use version control** for your infrastructure projects
2. **Test with --dry-run** before destructive operations
3. **Use specific VMID ranges** for different environments
4. **Implement proper backup strategies** before major changes
5. **Monitor resource usage** regularly with health-check commands

### Security Considerations

```bash
# Use environment variables for secrets
export PROXMOX_TOKEN_SECRET="your-secret-token"
npm run cli test-connection  # Token loaded from environment

# Limit token permissions to minimum required
# Create separate tokens for different CI/CD pipelines

# Regular token rotation
npm run cli validate-config  # Check for expired tokens
```

### Performance Optimization

```bash
# Use parallel operations where possible
npm run cli vm start 100,101,102  # Parallel VM starts

# Batch similar operations
npm run cli vm config 100-105 --memory 8192  # Bulk updates

# Use appropriate timeout values
npm run cli health-check --timeout 30000     # 30-second timeout

# Cache expensive operations
npm run cli discover-all --cache 300         # Cache for 5 minutes
```

---

**Ready to Master the CLI?**

- **[CLI Reference](../reference/cli-reference.md)** - Complete command documentation
- **[Interactive Console](interactive-console.md)** - Compare with console commands
- **[Configuration Guide](../reference/configuration.md)** - Advanced configuration options
- **[Automation Examples](../examples/integration-patterns.md)** - Real-world automation patterns