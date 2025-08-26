# Common Issues & Troubleshooting

This guide helps you diagnose and resolve common issues when using Proxmox-MPC. Issues are organized by category with step-by-step solutions.

## 🔧 Quick Diagnostic Commands

When encountering issues, start with these diagnostic commands:

```bash
# Test basic connectivity
npm run cli test-connection -v

# Check system health
npm run cli health-check -v

# Validate configuration
npm run cli validate-config -v

# Check Proxmox-MPC version and environment
npm run cli version -v

# Enable debug logging
export DEBUG=proxmox-mpc:*
proxmox-mpc /status
```

## 🌐 Connection and Authentication Issues

### Issue 1: "Connection Failed" or "ECONNREFUSED"

**Symptoms:**
```bash
❌ Error: connect ECONNREFUSED 192.168.1.100:8006
❌ Connection failed to Proxmox server
```

**Diagnosis Steps:**
```bash
# 1. Test basic network connectivity
ping 192.168.1.100

# 2. Test port connectivity
telnet 192.168.1.100 8006
# or
nc -zv 192.168.1.100 8006

# 3. Test HTTPS endpoint manually
curl -k https://192.168.1.100:8006/api2/json/version
```

**Solutions:**

**Solution A: Network Configuration**
```bash
# Check if Proxmox web interface is accessible
# Open https://192.168.1.100:8006 in browser

# Verify IP address and port in configuration
cat .proxmox/config.yml
# Ensure host and port match your Proxmox server
```

**Solution B: Firewall Issues**
```bash
# Check if firewall is blocking connections
# On Proxmox server:
iptables -L | grep 8006

# On client machine:
sudo ufw status
# Ensure outbound HTTPS (443) and Proxmox API (8006) are allowed
```

**Solution C: Proxmox Service Status**
```bash
# On Proxmox server, check if pveproxy is running:
systemctl status pveproxy
systemctl status pvedaemon

# Restart if needed:
systemctl restart pveproxy
systemctl restart pvedaemon
```

### Issue 2: "Authentication Failed" (401 Unauthorized)

**Symptoms:**
```bash
❌ Error: Authentication failed (401 Unauthorized)
❌ API token authentication failed
```

**Diagnosis Steps:**
```bash
# Test API token manually
curl -k -H "Authorization: PVEAPIToken=USER@REALM!TOKENID=SECRET" \
  https://your-proxmox-server:8006/api2/json/version

# Check token configuration
npm run cli validate-config -v
```

**Solutions:**

**Solution A: Verify Token Details**
```yaml
# Check .proxmox/config.yml
proxmox:
  username: "root@pam"              # Must match token user
  token_id: "proxmox-mpc-automation"  # Must match exactly
  token_secret: "your-secret-here"   # Must be correct

# Common mistakes:
# ❌ Missing @pam suffix in username
# ❌ Wrong token ID (case sensitive)
# ❌ Incorrect or expired token secret
```

**Solution B: Recreate API Token**
```bash
# In Proxmox web interface:
# 1. Go to Datacenter → Permissions → API Tokens
# 2. Delete old token
# 3. Create new token with same ID
# 4. Copy new secret to configuration
# 5. Ensure proper permissions are assigned
```

**Solution C: Check Token Permissions**
```bash
# In Proxmox web interface:
# Datacenter → Permissions → Check token has required roles:
# - VM.Audit, VM.Config.*, VM.PowerMgmt
# - Datastore.Audit, Datastore.AllocateSpace  
# - Node.Audit
```

### Issue 3: SSL Certificate Problems

**Symptoms:**
```bash
❌ Error: self signed certificate in certificate chain
❌ SSL verification failed
```

**Solutions:**

**Solution A: Homelab/Self-Signed Certificates**
```yaml
# .proxmox/config.yml - Disable SSL verification
proxmox:
  host: "192.168.1.100"
  ssl:
    verify: false  # For homelab with self-signed certificates
```

**Solution B: Enterprise/Proper Certificates**  
```yaml
# .proxmox/config.yml - Use proper CA certificate
proxmox:
  host: "proxmox.company.com"
  ssl:
    verify: true
    ca_file: "/etc/ssl/certs/company-ca.crt"
```

**Solution C: Test SSL Configuration**
```bash
# Test certificate chain
openssl s_client -connect your-proxmox-server:8006 -servername your-proxmox-server

# Check certificate validity
echo | openssl s_client -connect your-proxmox-server:8006 2>/dev/null | openssl x509 -noout -dates
```

## 🖥️ VM and Container Management Issues

### Issue 4: "VM Creation Failed"

**Symptoms:**
```bash
❌ Error: VM creation failed - insufficient storage
❌ Error: VMID already in use
❌ Error: Node not found
```

**Solutions:**

**Solution A: Storage Issues**
```bash
# Check available storage
npm run cli storage list -v

# Check node resources
npm run cli list-nodes -v

# Use different storage pool
npm run cli vm create --vmid 100 --name test --storage local-lvm

# Check storage permissions
# In Proxmox: Datacenter → Storage → Permissions
```

**Solution B: VMID Conflicts**
```bash
# List existing VMIDs
npm run cli vm list | grep -E "^\s*[0-9]+"

# Use available VMID
npm run cli vm create --vmid 200 --name new-vm  # Use unused ID

# Auto-assign VMID (if supported)
npm run cli vm create --name new-vm  # Auto-assign next available
```

**Solution C: Node Selection**
```bash
# List available nodes
npm run cli list-nodes

# Specify correct node
npm run cli vm create --vmid 100 --name test --node proxmox-node-01

# Check node status and capacity
npm run cli list-nodes -v
```

### Issue 5: "VM Won't Start" or Boot Issues

**Symptoms:**
```bash
❌ VM start failed
❌ VM stuck in starting state
❌ Boot timeout exceeded
```

**Diagnosis Steps:**
```bash
# Check VM status and configuration
npm run cli vm list --vmid 100 -v

# Check node resources
npm run cli list-nodes -v

# Check storage availability
npm run cli storage list
```

**Solutions:**

**Solution A: Resource Constraints**
```bash
# Check if node has enough resources
npm run cli resources nodes

# Reduce VM resource allocation
npm run cli vm config 100 --memory 2048 --cores 2

# Move VM to different node (if clustered)
npm run cli vm migrate 100 --target-node proxmox-node-02
```

**Solution B: Storage Issues**
```bash
# Check if VM disks are accessible
npm run cli storage usage

# Check for storage locks
# In Proxmox web interface: Check for lock icons on storage

# Unlock storage if needed (Proxmox CLI on server)
qm unlock 100
```

**Solution C: Configuration Issues**
```bash
# Check VM configuration
npm run cli vm config 100

# Reset to known good configuration
npm run cli vm config 100 --cores 2 --memory 4096

# Check for conflicting network configuration
npm run cli vm config 100 --network-model virtio --network-bridge vmbr0
```

## 💾 Database and Sync Issues

### Issue 6: Database Corruption or Lock Issues

**Symptoms:**
```bash
❌ Error: database is locked
❌ Error: SQLITE_CORRUPT: database disk image is malformed
❌ Sync failed - database error
```

**Solutions:**

**Solution A: Database Lock Issues**
```bash
# Check for running Proxmox-MPC processes
ps aux | grep proxmox-mpc

# Kill stuck processes
killall node  # Be careful - kills all Node.js processes
# Or more specifically:
pkill -f proxmox-mpc

# Remove lock file if exists
rm .proxmox/state.db-wal .proxmox/state.db-shm

# Restart application
proxmox-mpc
```

**Solution B: Database Corruption**
```bash
# Backup current database
cp .proxmox/state.db .proxmox/state.db.backup

# Check database integrity
sqlite3 .proxmox/state.db "PRAGMA integrity_check;"

# If corrupted, restore from backup or reinitialize
rm .proxmox/state.db
proxmox-mpc
# Then run: /sync to rebuild database
```

**Solution C: Permission Issues**
```bash
# Check file permissions
ls -la .proxmox/state.db

# Fix permissions
chmod 644 .proxmox/state.db
chown $USER:$USER .proxmox/state.db

# Ensure directory permissions
chmod 755 .proxmox/
```

### Issue 7: Sync Operation Failures

**Symptoms:**
```bash
❌ Sync failed - timeout
❌ Sync incomplete - partial results
❌ IaC generation failed
```

**Solutions:**

**Solution A: Network Timeouts**
```bash
# Increase timeout values
export PROXMOX_TIMEOUT=60000  # 60 seconds

# Or in config file:
# .proxmox/config.yml
proxmox:
  timeout: 60000
  retry_attempts: 3
  retry_delay: 2000
```

**Solution B: Large Infrastructure**
```bash
# Sync in smaller batches
npm run cli sync-state --resources vms
npm run cli sync-state --resources containers
npm run cli sync-state --resources storage

# Use node-specific sync
npm run cli discover-vms --node proxmox-node-01
npm run cli discover-vms --node proxmox-node-02
```

**Solution C: IaC Generation Issues**
```bash
# Check Terraform/Ansible installation
terraform version
ansible --version

# Validate generated files manually
cd terraform
terraform validate

cd ../ansible
ansible-playbook --syntax-check playbooks/site.yml

# Regenerate with verbose output
export DEBUG=proxmox-mpc:generators
proxmox-mpc /sync
```

## 🔧 Performance and Resource Issues

### Issue 8: Slow Performance or Timeouts

**Symptoms:**
```bash
❌ Operations taking too long
❌ Frequent timeouts
❌ High memory usage
```

**Solutions:**

**Solution A: Increase Timeout Values**
```yaml
# .proxmox/config.yml
proxmox:
  timeout: 30000          # 30 seconds (default: 10s)
  retry_attempts: 5       # More retries (default: 3)
  retry_delay: 2000       # 2s between retries
```

**Solution B: Optimize Database Performance**
```bash
# Vacuum database to improve performance
sqlite3 .proxmox/state.db "VACUUM;"

# Check database size
ls -lh .proxmox/state.db

# If very large, consider cleanup
sqlite3 .proxmox/state.db "DELETE FROM state_snapshots WHERE timestamp < datetime('now', '-30 days');"
```

**Solution C: Resource Monitoring**
```bash
# Monitor system resources during operations
htop  # or top

# Monitor network usage
iftop  # or nethogs

# Check Proxmox server resources
npm run cli resources nodes -v
```

### Issue 9: Memory Issues

**Symptoms:**
```bash
❌ Error: JavaScript heap out of memory
❌ Process killed (OOM)
```

**Solutions:**

**Solution A: Increase Node.js Memory**
```bash
# Set Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"  # 4GB

# For very large infrastructures
export NODE_OPTIONS="--max-old-space-size=8192"  # 8GB

# Make permanent in shell profile
echo 'export NODE_OPTIONS="--max-old-space-size=4096"' >> ~/.bashrc
```

**Solution B: Batch Operations**
```bash
# Process large infrastructures in smaller batches
npm run cli discover-vms --limit 50
npm run cli sync-state --batch-size 25

# Use streaming operations where available
npm run cli vm list --stream  # Process results as they arrive
```

## 🛡️ Permission and Security Issues

### Issue 10: Insufficient Permissions

**Symptoms:**
```bash
❌ Error: Permission denied for VM.Config.Disk
❌ Error: Access forbidden (403)
```

**Solutions:**

**Solution A: Check API Token Permissions**
```bash
# Test specific permissions
curl -k -H "Authorization: PVEAPIToken=root@pam!TOKEN=SECRET" \
  https://proxmox-server:8006/api2/json/access/permissions

# List required permissions for Proxmox-MPC:
# VM.Audit, VM.Config.*, VM.Console, VM.PowerMgmt
# Datastore.Audit, Datastore.AllocateSpace
# Node.Audit, Pool.Audit (if using pools)
```

**Solution B: Update Token Role**
```bash
# In Proxmox web interface:
# 1. Datacenter → Permissions → API Tokens
# 2. Select your token → Permissions
# 3. Add missing permissions or use Administrator role temporarily
# 4. Apply to path "/" (root) for full access
```

**Solution C: Create Custom Role**
```bash
# In Proxmox web interface:
# 1. Datacenter → Permissions → Roles → Create
# 2. Role name: "ProxmoxMPCRole"  
# 3. Add required privileges (see Authentication guide)
# 4. Assign role to your API token
```

## 🔍 Installation and Environment Issues

### Issue 11: Node.js or npm Issues

**Symptoms:**
```bash
❌ Command not found: proxmox-mpc
❌ Error: Cannot find module
❌ npm permission errors
```

**Solutions:**

**Solution A: Node.js Version Issues**
```bash
# Check Node.js version
node --version  # Should be 18.0+

# Install/update Node.js using nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
nvm use 20

# Reinstall Proxmox-MPC
npm uninstall -g proxmox-mpc
npm install -g proxmox-mpc
```

**Solution B: Global Installation Issues**
```bash
# Fix npm global permissions
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc

# Reinstall globally
npm install -g proxmox-mpc
```

**Solution C: Local Installation**
```bash
# If global installation fails, use local
cd your-project
npm install proxmox-mpc

# Use via npm run
npm run proxmox-mpc
# or
npx proxmox-mpc
```

### Issue 12: Configuration File Issues

**Symptoms:**
```bash
❌ Error: Configuration file not found
❌ Error: Invalid configuration format
❌ Configuration validation failed
```

**Solutions:**

**Solution A: Missing Configuration**
```bash
# Check if configuration exists
ls -la .proxmox/config.yml

# If missing, reinitialize project
proxmox-mpc /init

# Or create minimal configuration
mkdir -p .proxmox
cat > .proxmox/config.yml << EOF
proxmox:
  host: "your-proxmox-server"
  port: 8006
  username: "root@pam"
  token_id: "your-token-id"
  token_secret: "your-token-secret"
  ssl:
    verify: false
EOF
```

**Solution B: Invalid YAML Format**
```bash
# Validate YAML syntax
python3 -c "import yaml; yaml.safe_load(open('.proxmox/config.yml'))"

# Or use online YAML validator
# Fix indentation and syntax errors
```

**Solution C: Configuration Validation**
```bash
# Use built-in validation
npm run cli validate-config -v

# Check for common issues:
# - Missing required fields
# - Invalid host/port combinations
# - Malformed token IDs
```

## 🚨 Emergency Recovery Procedures

### Complete System Reset

If all else fails, here's how to completely reset your Proxmox-MPC installation:

```bash
# 1. Backup important data
cp -r .proxmox .proxmox.backup
cp -r terraform terraform.backup
cp -r ansible ansible.backup

# 2. Uninstall Proxmox-MPC
npm uninstall -g proxmox-mpc

# 3. Clear npm cache
npm cache clean --force

# 4. Remove local configuration
rm -rf .proxmox node_modules package-lock.json

# 5. Reinstall fresh
npm install -g proxmox-mpc

# 6. Reinitialize project
proxmox-mpc /init

# 7. Restore backed up configurations if needed
```

### Database Recovery

```bash
# If database is corrupted beyond repair:

# 1. Backup current state
cp .proxmox/state.db .proxmox/corrupted-backup.db

# 2. Remove corrupted database
rm .proxmox/state.db

# 3. Initialize new database
proxmox-mpc /init  # Or start console to auto-create

# 4. Resync from Proxmox server
proxmox-mpc /sync

# 5. Verify recovery
proxmox-mpc /status
```

## 📞 Getting Additional Help

### Enable Debug Logging

```bash
# Enable comprehensive debugging
export DEBUG=proxmox-mpc:*

# Or specific modules
export DEBUG=proxmox-mpc:api,proxmox-mpc:database

# Run operations with debug output
proxmox-mpc /sync
```

### Collect Diagnostic Information

```bash
# Gather system information
npm run cli version -v > diagnostic-info.txt
npm run cli health-check -v >> diagnostic-info.txt
npm run cli validate-config -v >> diagnostic-info.txt

# Include configuration (remove secrets first!)
cat .proxmox/config.yml | sed 's/token_secret:.*/token_secret: [REDACTED]/' >> diagnostic-info.txt

# Include recent logs if available
tail -100 ~/.proxmox-mpc/logs/proxmox-mpc.log >> diagnostic-info.txt
```

### Community Support

- **GitHub Issues**: [Report bugs and request features](https://github.com/proxmox-mpc/proxmox-mpc/issues)
- **GitHub Discussions**: [Get community help](https://github.com/proxmox-mpc/proxmox-mpc/discussions)
- **Documentation**: Browse the complete [documentation](../index.md)

---

**Related Guides:**
- **[Authentication Setup](../getting-started/authentication.md)** - Resolve authentication issues
- **[Installation Guide](../getting-started/installation.md)** - Fix installation problems  
- **[Configuration Reference](../reference/configuration.md)** - Advanced configuration options