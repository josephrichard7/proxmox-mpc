# Basic VM Management Tutorial

This comprehensive tutorial covers essential virtual machine management operations using Proxmox-MPC. Learn to create, configure, monitor, and manage VMs through both the interactive console and CLI.

## 🎯 Learning Objectives

By completing this tutorial, you'll master:

- ✅ **VM Creation**: Create VMs with custom configurations
- ✅ **Lifecycle Management**: Start, stop, restart, and delete VMs
- ✅ **Configuration Management**: Modify VM settings and resources
- ✅ **Monitoring**: Monitor VM status, performance, and health
- ✅ **Troubleshooting**: Diagnose and resolve common VM issues
- ✅ **Automation**: Script VM operations for efficiency

**Prerequisites**: 
- Proxmox-MPC installed and configured ([Installation Guide](../getting-started/installation.md))
- Active Proxmox server with proper authentication ([Authentication Guide](../getting-started/authentication.md))
- Basic familiarity with the interactive console ([Interactive Console Guide](../user-guide/interactive-console.md))

**Time Required**: 45-60 minutes

## 🚀 Section 1: VM Discovery and Inventory

### Discover Existing VMs

Start by exploring your current VM infrastructure:

```bash
# Launch Proxmox-MPC console
proxmox-mpc

# Discover existing VMs
proxmox-mpc> list vms

📊 Virtual Machines (3):
┌──────┬─────────────────┬─────────┬─────────────────┬─────────┬─────────┬─────────────────────┐
│ VMID │ Name           │ Status  │ Node            │ Cores   │ Memory  │ IP Address          │
├──────┼─────────────────┼─────────┼─────────────────┼─────────┼─────────┼─────────────────────┤
│ 100  │ web-server     │ running │ proxmox-node-01 │ 2       │ 4096MB  │ 192.168.1.102      │
│ 101  │ database-server│ stopped │ proxmox-node-01 │ 4       │ 8192MB  │ --                 │
│ 102  │ backup-server  │ running │ proxmox-node-02 │ 2       │ 2048MB  │ 192.168.1.104      │
└──────┴─────────────────┴─────────┴─────────────────┴─────────┴─────────┴─────────────────────┘
```

### Get Detailed VM Information

Examine specific VM configurations:

```bash
# Get detailed information about a specific VM
proxmox-mpc> describe vm 100

🖥️ VM Details: web-server (VMID: 100)

📊 Basic Information:
  Name: web-server
  VMID: 100
  Status: running
  Node: proxmox-node-01
  IP Address: 192.168.1.102

💻 Hardware Configuration:
  CPU Cores: 2
  Memory: 4096 MB
  Architecture: x86_64
  Machine Type: q35

💾 Storage Configuration:
  Disk 0 (scsi0): 32 GB (local-lvm)
    Used: 12.3 GB (38.4%)
    Type: raw
    Cache: none

🌐 Network Configuration:
  Network 0 (net0):
    Model: virtio
    Bridge: vmbr0
    Link State: up
    MAC: 02:00:00:12:34:56

🔧 Advanced Settings:
  Boot Order: scsi0
  Agent: enabled
  Start at Boot: yes
  Protection: disabled

⏱️ Timestamps:
  Created: 2025-01-20 14:30:22
  Last Started: 2025-01-26 09:15:43
  Uptime: 2d 14h 23m
```

### Using CLI for Discovery

Alternative CLI commands for VM discovery:

```bash
# Exit console temporarily
proxmox-mpc> /exit

# Use CLI for discovery operations
npm run cli vm list                    # Basic VM list
npm run cli vm list -v                 # Verbose output
npm run cli vm list --status running   # Filter by status
npm run cli vm list --node proxmox-node-01  # Filter by node
npm run cli vm list --format json      # JSON output for scripting
```

## 🏗️ Section 2: Creating Virtual Machines

### Basic VM Creation

Create a new VM with basic configuration:

```bash
# Return to interactive console
proxmox-mpc

# Create a basic VM
proxmox-mpc> create vm --name tutorial-vm --vmid 150 --cores 2 --memory 4096

🏗️ Creating VM configuration for 'tutorial-vm'...

📝 VM Configuration Summary:
  Name: tutorial-vm
  VMID: 150
  Node: proxmox-node-01 (auto-selected)
  Cores: 2
  Memory: 4096 MB
  Disk: 32G (local-lvm, auto-assigned)
  Network: vmbr0 (virtio)
  OS Type: Linux (default)

✅ VM configuration validated
✅ Generated terraform/vms/tutorial-vm.tf
✅ Generated ansible/playbooks/tutorial-vm.yml
✅ Generated tests/vms/tutorial-vm.test.js
✅ Updated project documentation

🎯 Next Steps:
  1. Review generated configuration: describe vm 150
  2. Deploy the VM: /apply
  3. Start the VM: start vm 150
```

### Advanced VM Creation

Create a VM with custom specifications:

```bash
proxmox-mpc> create vm \
  --name production-app \
  --vmid 151 \
  --cores 8 \
  --memory 16384 \
  --disk-size 100 \
  --storage local-lvm \
  --network-bridge vmbr0 \
  --os-type linux \
  --description "Production application server"

🏗️ Creating VM with advanced configuration...

📝 Advanced VM Configuration:
  Name: production-app
  VMID: 151
  Description: Production application server
  
💻 Hardware Specs:
  CPU Cores: 8
  Memory: 16384 MB (16 GB)
  Disk: 100 GB (local-lvm)
  
🌐 Network Configuration:
  Bridge: vmbr0
  Model: virtio (high performance)
  
🔧 Additional Settings:
  OS Type: Linux (optimized settings)
  Agent: Enabled (for better integration)
  Boot Order: scsi0 (primary disk)
  Start at Boot: Disabled (manual start)

✅ VM created successfully
💡 Use 'describe vm 151' to review full configuration
```

### Creating from Templates

If you have VM templates available:

```bash
# List available templates
proxmox-mpc> list templates

📋 Available VM Templates:
┌──────┬──────────────────┬─────────────────┬─────────┬─────────┐
│ VMID │ Name            │ Node            │ Cores   │ Memory  │
├──────┼──────────────────┼─────────────────┼─────────┼─────────┤
│ 9000 │ ubuntu-22.04-tpl │ proxmox-node-01 │ 2       │ 2048MB  │
│ 9001 │ centos-8-tpl     │ proxmox-node-01 │ 2       │ 2048MB  │
└──────┴──────────────────┴─────────────────┴─────────┴─────────┘

# Create VM from template
proxmox-mpc> create vm \
  --name web-frontend \
  --vmid 152 \
  --template 9000 \
  --cores 4 \
  --memory 8192 \
  --clone-type full

🔄 Cloning VM from template ubuntu-22.04-tpl...
✅ Full clone operation initiated
⏳ Clone progress: 45% (estimated 2 minutes remaining)
✅ VM cloned successfully from template
📝 Applied custom configuration (cores: 4, memory: 8192MB)
```

## ⚡ Section 3: VM Lifecycle Management

### Starting and Stopping VMs

Manage VM power states effectively:

```bash
# Start a VM
proxmox-mpc> start vm 150

🚀 Starting VM: tutorial-vm (VMID: 150)
⏳ VM startup initiated...
✅ VM 150 started successfully
💡 IP address will be assigned via DHCP

# Start with wait option (wait for boot completion)
proxmox-mpc> start vm 151 --wait

🚀 Starting VM: production-app (VMID: 151)
⏳ Waiting for VM to boot completely...
🔧 QEMU Guest Agent detected
🌐 Network configuration active
✅ VM 151 is fully operational
📍 IP Address: 192.168.1.105
⏱️ Boot time: 1m 23s
```

### Graceful Shutdown Operations

```bash
# Graceful shutdown (recommended)
proxmox-mpc> stop vm 150

🛑 Stopping VM: tutorial-vm (VMID: 150)
⏳ Sending shutdown signal...
✅ VM 150 stopped gracefully
⏱️ Shutdown time: 15 seconds

# Force shutdown (use with caution)
proxmox-mpc> stop vm 151 --force

⚠️ Force stopping VM: production-app (VMID: 151)
🛑 Sending immediate stop command...
✅ VM 151 force stopped
⚠️ Warning: Forced shutdown may cause data loss
```

### Restart Operations

```bash
# Standard restart
proxmox-mpc> restart vm 150

🔄 Restarting VM: tutorial-vm (VMID: 150)
🛑 Graceful shutdown initiated...
⏳ Waiting for complete shutdown...
🚀 Starting VM...
✅ VM 150 restarted successfully
⏱️ Total restart time: 42 seconds

# Restart with wait for full boot
proxmox-mpc> restart vm 151 --wait

🔄 Restarting VM with boot wait: production-app (VMID: 151)
🛑 Shutdown phase: 18 seconds
🚀 Boot phase: 1m 31s
🌐 Network ready: 192.168.1.105
✅ VM 151 fully operational after restart
```

## 🔧 Section 4: VM Configuration Management

### Viewing VM Configuration

```bash
# View complete VM configuration
proxmox-mpc> describe vm 150

# Or get specific configuration aspects
proxmox-mpc> config vm 150

📋 Current Configuration: tutorial-vm (VMID: 150)

💻 Compute Resources:
  CPU Cores: 2
  CPU Type: host (passthrough)
  Memory: 4096 MB
  NUMA: disabled

💾 Storage:
  scsi0: local-lvm:vm-150-disk-0 (32G)
    Format: raw
    Cache: none
    Discard: ignore

🌐 Network:
  net0: virtio,bridge=vmbr0
    MAC: 02:00:00:ab:cd:ef
    Link State: up

🔧 Options:
  Boot Order: scsi0
  OS Type: l26 (Linux 2.6+)
  Agent: 1 (enabled)
  Start at Boot: 0 (disabled)
  Protection: 0 (disabled)
```

### Modifying VM Resources

**Update CPU configuration:**
```bash
# Increase CPU cores
proxmox-mpc> config vm 150 --cores 4

🔧 Updating VM configuration: tutorial-vm (VMID: 150)
📝 Changing CPU cores: 2 → 4
⚠️ VM must be stopped for this change
🛑 Stopping VM...
🔧 Applying configuration changes...
✅ CPU cores updated to 4
💡 Start VM to apply changes: start vm 150
```

**Update Memory configuration:**
```bash
# Increase memory (can be done while running if supported)
proxmox-mpc> config vm 150 --memory 8192

🔧 Updating VM configuration: tutorial-vm (VMID: 150)
📝 Changing memory: 4096 MB → 8192 MB
✅ Memory updated successfully
💡 Changes applied immediately (hot-plug supported)
🔍 Verify with: describe vm 150
```

**Update multiple settings:**
```bash
proxmox-mpc> config vm 151 --cores 6 --memory 12288 --description "Updated production app server"

🔧 Batch configuration update: production-app (VMID: 151)
📝 Changes to apply:
  • CPU cores: 8 → 6
  • Memory: 16384 MB → 12288 MB  
  • Description: "Production application server" → "Updated production app server"

⚠️ VM must be stopped for CPU changes
🛑 Stopping VM...
🔧 Applying all configuration changes...
✅ All changes applied successfully
```

### Managing VM Disks

**Add additional disk:**
```bash
proxmox-mpc> config vm 150 --add-disk 50G --storage local-lvm

💾 Adding disk to VM: tutorial-vm (VMID: 150)
🔧 New disk configuration:
  Size: 50 GB
  Storage: local-lvm  
  Interface: scsi1 (next available)
  Format: raw

⏳ Creating disk...
✅ Disk created: local-lvm:vm-150-disk-1
🔧 Attached as scsi1
💡 Disk will be available after VM restart
```

**Resize existing disk:**
```bash
proxmox-mpc> config vm 150 --resize-disk scsi0 +20G

💾 Resizing disk: scsi0 on tutorial-vm (VMID: 150)
📝 Current size: 32 GB → New size: 52 GB
⏳ Extending disk...
✅ Disk resized successfully
💡 You may need to extend the filesystem inside the VM
```

## 📊 Section 5: VM Monitoring and Performance

### Real-time VM Status

Monitor VM status and performance:

```bash
# Get current VM status
proxmox-mpc> status vm 150

📊 VM Status: tutorial-vm (VMID: 150)

🟢 Operational Status:
  State: running
  Uptime: 2h 15m 33s
  PID: 1234567
  
💻 Resource Usage:
  CPU: 12.5% (0.5/4 cores utilized)
  Memory: 2.1 GB / 8.0 GB (26.3% used)
  Disk I/O: Read: 234 MB, Write: 156 MB
  Network: RX: 45.2 MB, TX: 23.8 MB

🌐 Network Information:
  IP Address: 192.168.1.106 (DHCP)
  MAC Address: 02:00:00:ab:cd:ef
  Gateway: 192.168.1.1
  DNS: 192.168.1.1, 8.8.8.8

💾 Storage Status:
  scsi0: 15.3 GB / 52 GB used (29.4%)
  scsi1: 2.1 GB / 50 GB used (4.2%)

🔧 Agent Status:
  QEMU Guest Agent: ✅ Running
  Last Heartbeat: 2 seconds ago
```

### Performance History

```bash
# View performance metrics over time
proxmox-mpc> performance vm 150 --duration 1h

📈 Performance History: tutorial-vm (Last 1 hour)

CPU Usage:
  Current: 12.5%
  Average: 8.3%
  Peak: 45.2% (at 14:23)

Memory Usage:
  Current: 26.3% (2.1 GB)
  Average: 24.1% (1.9 GB)
  Peak: 31.7% (2.5 GB)

Disk I/O (per minute):
  Read: Current: 2.3 MB/min, Peak: 15.7 MB/min
  Write: Current: 1.8 MB/min, Peak: 8.4 MB/min

Network I/O (per minute):
  RX: Current: 0.8 MB/min, Peak: 3.2 MB/min
  TX: Current: 0.4 MB/min, Peak: 1.9 MB/min

🎯 Performance Score: 85/100 (Good)
💡 Recommendations: CPU usage optimal, consider monitoring disk I/O patterns
```

### Batch Monitoring

Monitor multiple VMs simultaneously:

```bash
# Monitor all running VMs
proxmox-mpc> status vms --filter running

📊 Running VMs Status Summary:

┌──────┬─────────────────┬─────────┬─────────┬─────────────┬─────────────┐
│ VMID │ Name           │ Uptime  │ CPU     │ Memory      │ Status      │
├──────┼─────────────────┼─────────┼─────────┼─────────────┼─────────────┤
│ 100  │ web-server     │ 2d 14h  │ 15.2%   │ 1.8/4.0 GB │ ✅ Healthy   │
│ 150  │ tutorial-vm    │ 2h 15m  │ 12.5%   │ 2.1/8.0 GB │ ✅ Healthy   │  
│ 151  │ production-app │ 45m     │ 8.1%    │ 3.2/12 GB  │ ✅ Healthy   │
└──────┴─────────────────┴─────────┴─────────┴─────────────┴─────────────┘

🎯 Cluster Summary:
  Total VMs: 3 running, 1 stopped
  CPU Usage: 11.9% average
  Memory Usage: 57% of allocated
  All systems operational
```

## 🔧 Section 6: VM Troubleshooting

### Diagnosing VM Issues

When VMs encounter problems:

```bash
# Comprehensive VM health check
proxmox-mpc> health vm 150

🏥 VM Health Check: tutorial-vm (VMID: 150)

✅ Basic Status:
  VM State: running
  QEMU Process: active (PID: 1234567)
  Configuration: valid

✅ Resource Health:
  CPU: Normal usage (12.5%)
  Memory: Within limits (26.3%)
  Disk Space: Sufficient (29.4% used)

✅ Network Health:
  Interface: up and active
  IP Assignment: successful (192.168.1.106)
  Gateway: reachable (192.168.1.1)
  DNS Resolution: working

⚠️ Warnings:
  • Guest Agent: Minor delay in responses (3s avg)
  • Disk I/O: Slightly elevated read operations

🎯 Overall Health Score: 92/100 (Excellent)
💡 Recommendations: Monitor guest agent responsiveness
```

### VM Log Analysis

```bash
# View VM logs for troubleshooting
proxmox-mpc> logs vm 150

📜 VM Logs: tutorial-vm (VMID: 150) - Last 50 entries

2025-01-26 16:30:15 INFO: VM started successfully
2025-01-26 16:30:18 INFO: Guest agent connected
2025-01-26 16:30:22 INFO: Network interface eth0 up
2025-01-26 16:30:25 INFO: DHCP lease acquired: 192.168.1.106
2025-01-26 16:31:02 WARN: Guest agent response timeout (5s)
2025-01-26 16:31:45 INFO: Guest agent connection restored
2025-01-26 16:45:12 INFO: Disk snapshot created for backup
2025-01-26 17:15:33 WARN: High disk I/O detected (15.7 MB/min read)

💡 Log Analysis:
  • No critical errors detected
  • Guest agent connectivity issues resolved
  • Recent backup operation completed successfully
  • Monitor disk I/O patterns for optimization
```

### Common Issue Resolution

**VM won't start:**
```bash
# Check node resources
proxmox-mpc> status node proxmox-node-01

📊 Node Status: proxmox-node-01
  CPU: 45.2% used
  Memory: 28.3 GB / 32 GB used (88.4%)  ← High memory usage
  Storage: 67.3% used

# Solution: Free up memory or move VM to different node
proxmox-mpc> config vm 150 --memory 4096  # Reduce memory requirement
# Or migrate to less loaded node
proxmox-mpc> migrate vm 150 --target-node proxmox-node-02
```

**Network connectivity issues:**
```bash
# Check VM network configuration
proxmox-mpc> config vm 150 --show-network

🌐 Network Configuration:
  net0: virtio,bridge=vmbr0,tag=100  ← VLAN tag present

# Solution: Remove VLAN tag if not needed
proxmox-mpc> config vm 150 --network-bridge vmbr0 --network-vlan none
```

## 🤖 Section 7: Automation and Scripting

### Bulk VM Operations

Create multiple VMs efficiently:

```bash
# Create multiple VMs with pattern
proxmox-mpc> create vms \
  --pattern "web-server-{1..3}" \
  --vmid-start 200 \
  --cores 2 \
  --memory 4096 \
  --template 9000

🏗️ Bulk VM Creation: web-server-{1..3}

Creating VMs:
  ✅ web-server-1 (VMID: 200) - Created
  ✅ web-server-2 (VMID: 201) - Created  
  ✅ web-server-3 (VMID: 202) - Created

📊 Summary:
  VMs Created: 3
  Total Cores: 6
  Total Memory: 12 GB
  Template Used: ubuntu-22.04-tpl
  Time Elapsed: 2m 15s

💡 Next Steps:
  • Start VMs: start vms 200-202
  • Configure load balancing
  • Set up monitoring
```

### CLI Automation Scripts

Example automation script:

```bash
#!/bin/bash
# vm-deployment-script.sh

echo "🚀 Automated VM Deployment Starting..."

# Configuration
VMS_TO_CREATE=(
  "200:web-01:4:8192:production"
  "201:web-02:4:8192:production"  
  "202:db-01:8:16384:database"
)

# Function to create and configure VM
deploy_vm() {
  local vmid=$1 name=$2 cores=$3 memory=$4 role=$5
  
  echo "📝 Creating VM: $name (VMID: $vmid)"
  
  # Create VM
  npm run cli vm create \
    --vmid "$vmid" \
    --name "$name" \
    --cores "$cores" \
    --memory "$memory" \
    --template 9000 \
    --description "Automated deployment - Role: $role"
    
  if [ $? -eq 0 ]; then
    echo "✅ VM $name created successfully"
    
    # Start VM
    npm run cli vm start "$vmid" --wait
    
    # Configure based on role
    if [ "$role" = "production" ]; then
      npm run cli vm config "$vmid" --start-at-boot true
    fi
    
    echo "🎯 VM $name deployment complete"
  else
    echo "❌ Failed to create VM $name"
    return 1
  fi
}

# Deploy all VMs
for vm_spec in "${VMS_TO_CREATE[@]}"; do
  IFS=':' read -r vmid name cores memory role <<< "$vm_spec"
  deploy_vm "$vmid" "$name" "$cores" "$memory" "$role"
  sleep 30  # Wait between deployments
done

# Verify deployment
echo "🔍 Verifying deployment..."
npm run cli vm list --format json | jq '.[] | select(.vmid >= 200 and .vmid <= 202)'

echo "✅ Automated VM deployment complete!"
```

### Scheduled Operations

```bash
# Create cron job for regular VM health checks
crontab -e

# Add line for hourly health checks:
0 * * * * /usr/local/bin/npm run cli health-check >> /var/log/proxmox-mpc-health.log

# Weekly VM cleanup (stopped VMs older than 7 days)
0 2 * * 0 /usr/local/bin/npm run cli vm cleanup --age 7d --dry-run >> /var/log/vm-cleanup.log
```

## 🎯 Section 8: Best Practices

### VM Naming and Organization

```bash
# Good naming conventions
create vm --name "prod-web-01" --vmid 100    # Environment-Service-Instance
create vm --name "dev-db-primary" --vmid 150 # Environment-Role-Type
create vm --name "staging-app-worker-1" --vmid 200 # Environment-App-Role-Instance

# Use descriptions for context
config vm 100 --description "Production web server - nginx 1.22, PHP 8.1"
```

### Resource Management

```bash
# Right-size resources based on actual usage
performance vm 100 --duration 7d  # Check week-long patterns
config vm 100 --memory 6144       # Adjust based on actual usage

# Use resource limits appropriately
config vm 100 --cpu-limit 50      # Limit CPU if shared node
config vm 100 --memory-balloon     # Enable memory ballooning
```

### Backup and Recovery

```bash
# Create VM snapshots before major changes
snapshot vm 100 --name "pre-upgrade-$(date +%Y%m%d)"

# Regular backup schedule
backup vm 100 --storage backup-nfs --compress --notification email
```

## ✅ Conclusion and Next Steps

Congratulations! You've mastered essential VM management with Proxmox-MPC:

### What You've Learned
- ✅ **VM Discovery**: Inventory and explore existing VMs
- ✅ **VM Creation**: Create VMs with basic and advanced configurations
- ✅ **Lifecycle Management**: Start, stop, restart, and delete VMs safely
- ✅ **Configuration**: Modify VM resources and settings
- ✅ **Monitoring**: Track performance and diagnose issues
- ✅ **Automation**: Script repetitive tasks and bulk operations

### Advanced Topics to Explore

1. **Container Management**: [Container Workflows Tutorial](container-workflows.md)
2. **Infrastructure as Code**: [IaC Deployment Guide](iac-deployment.md)  
3. **Testing**: [Infrastructure Testing Framework](testing-infrastructure.md)
4. **Multi-Server**: [Advanced Scenarios](advanced-scenarios.md)

### Key Takeaways

1. **Always verify** configuration changes before applying
2. **Use descriptive names** and documentation for maintainability
3. **Monitor resource usage** to optimize performance and costs
4. **Implement automation** for repetitive tasks
5. **Keep backups** and snapshots for critical VMs

---

**Ready for Advanced Topics?**

- **[Container Workflows](container-workflows.md)** - Master LXC container management
- **[IaC Deployment](iac-deployment.md)** - Infrastructure as Code workflows
- **[CLI Reference](../reference/cli-reference.md)** - Complete command reference
- **[Troubleshooting](../troubleshooting/common-issues.md)** - Solve complex problems