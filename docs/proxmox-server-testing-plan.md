# Proxmox Server Testing Plan 🏠
**Test your home Proxmox server with proxmox-mpc**

## 🎯 Overview
You can test significant functionality right now with your home Proxmox server! This plan progresses from basic connectivity to advanced features, giving you confidence in the system's real-world capabilities.

## 📋 Prerequisites

### ✅ Proxmox Server Requirements
- [ ] Proxmox VE server running at home
- [ ] API access enabled (usually on port 8006)
- [ ] API token created for authentication
- [ ] Network connectivity from your development machine

### ✅ Authentication Setup
1. **Create API Token in Proxmox:**
   ```bash
   # In Proxmox web UI: Datacenter → Permissions → API Tokens
   # Create token: root@pam!proxmox-mcp-token
   # Note down: Token ID and Secret
   ```

2. **Gather Connection Details:**
   - [ ] Proxmox IP/hostname (e.g., `192.168.1.100`)
   - [ ] Port (usually `8006`)
   - [ ] Username (e.g., `root@pam`)
   - [ ] Token ID (e.g., `proxmox-mcp-token`)
   - [ ] Token Secret

---

## 🚀 Phase 1: Foundation Testing

### ✅ Task 1.1: Basic Connectivity
Test the fundamental connection to your Proxmox server.

```bash
# Test basic API connectivity
npm run cli test-connection --host 192.168.0.19 --port 8006 --username root@pam --token-id proxmox-mcp-token --verbose
```

**Expected Results:**
- [ ] ✅ Connection successful
- [ ] Version information displayed
- [ ] API authentication working
- [ ] SSL/TLS validation (or skip if self-signed)

**If this fails:**
- Check firewall settings (port 8006)
- Verify API token is active
- Try with `--skip-tls-verify` flag for self-signed certificates

### ✅ Task 1.2: Resource Discovery
Test discovery of your actual infrastructure.

```bash
# List all nodes in your cluster
npm run cli list-nodes

# List VMs on specific node (replace 'pve' with your node name)
npm run cli list-vms

# List containers
npm run cli list-containers
```

**Expected Results:**
- [ ] Your actual node names displayed
- [ ] Real VM names and IDs shown
- [ ] Container information (if any)
- [ ] Resource usage statistics
- [ ] Status information (running, stopped, etc.)

---

## 🎮 Phase 2: Interactive Console Testing

### ✅ Task 2.1: Console Launch
Test the Claude Code-like interactive experience.

```bash
# Launch interactive console
proxmox-mpc
```

**Expected Results:**
- [ ] Welcome message displayed
- [ ] Interactive prompt shown: `proxmox-mpc>`
- [ ] Command completion working (try TAB)
- [ ] Help available with `/help`

### ✅ Task 2.2: Workspace Initialization
Create a workspace for your home lab.

```bash
# Inside the console
proxmox-mpc> /init
```

**Follow the prompts with your details:**
- [ ] Proxmox host IP
- [ ] Port (8006)
- [ ] Username (root@pam)
- [ ] Token ID
- [ ] Node name (your primary node)
- [ ] TLS settings

**Expected Results:**
- [ ] `.proxmox/config.yml` created
- [ ] SQLite database initialized
- [ ] Connection test successful
- [ ] Workspace ready message

### ✅ Task 2.3: Status and Sync
Test workspace status and synchronization.

```bash
# Check workspace status
proxmox-mpc> /status

# Sync with your Proxmox server
proxmox-mpc> /sync
```

**Expected Results:**
- [ ] Connection status shown
- [ ] Resource counts displayed
- [ ] Sync discovers your actual VMs/containers
- [ ] Database populated with real data
- [ ] State snapshot created

---

## 🔍 Phase 3: Database Integration Testing

### ✅ Task 3.1: State Verification
Verify that your real infrastructure is properly stored.

```bash
# Check what was discovered and stored
npm run cli show-state --workspace .

# Show specific resources
npm run cli show-vms --workspace .
npm run cli show-containers --workspace .
```

**Expected Results:**
- [ ] Your actual VM names and configurations
- [ ] Real resource allocations (CPU, memory, disk)
- [ ] Current status of each resource
- [ ] Node assignments
- [ ] Storage information

### ✅ Task 3.2: Configuration Validation
Test configuration parsing and validation.

```bash
# Inside console - check configuration
proxmox-mpc> /validate

# Test configuration file
cat .proxmox/config.yml
```

**Expected Results:**
- [ ] Configuration file properly formatted
- [ ] All connection details present
- [ ] Validation passes
- [ ] No configuration errors

---

## 📊 Phase 4: Observability Testing

### ✅ Task 4.1: Logging System
Test the comprehensive logging system.

```bash
# Generate some operations and check logs
proxmox-mpc> /sync
proxmox-mpc> /status

# Check generated logs
cat .proxmox/logs/proxmox-mcp.log
```

**Expected Results:**
- [ ] Structured JSON logging
- [ ] Operation context captured
- [ ] Error tracking (if any)
- [ ] Performance metrics
- [ ] Resource access logging

### ✅ Task 4.2: Metrics and Diagnostics
Test the observability features.

```bash
# Run diagnostics
proxmox-mpc> /debug health
proxmox-mpc> /debug metrics
proxmox-mpc> /debug logs
```

**Expected Results:**
- [ ] System health information
- [ ] API response times
- [ ] Resource utilization metrics
- [ ] Connection stability data
- [ ] Operation success rates

---

## 🔧 Phase 5: Advanced Features Testing

### ✅ Task 5.1: State Snapshots
Test state management with real data.

```bash
# Create state snapshot
proxmox-mcp> /sync --snapshot "initial-discovery"

# Check snapshot history
ls -la .proxmox/snapshots/
```

**Expected Results:**
- [ ] Snapshot files created
- [ ] Timestamp in filename
- [ ] Complete infrastructure state captured
- [ ] Diff capabilities available

### ✅ Task 5.2: Resource Monitoring
Test ongoing monitoring capabilities.

```bash
# Monitor changes over time
# 1. Make a change in Proxmox (start/stop a VM)
# 2. Sync again
proxmox-mcp> /sync

# Check for detected changes
proxmox-mcp> /status --detailed
```

**Expected Results:**
- [ ] Changes detected automatically
- [ ] State differences shown
- [ ] Resource status updates
- [ ] Change history maintained

---

## 🌟 Phase 6: Readiness Testing

### ✅ Task 6.1: Export Configuration
Test configuration export for other environments.

```bash
# Export current workspace
proxmox-mcp> /export ./my-home-lab-export

# Check exported files
ls -la my-home-lab-export/
```

**Expected Results:**
- [ ] Infrastructure configuration exported
- [ ] State files included
- [ ] Documentation generated
- [ ] Ready for version control

### ✅ Task 6.2: MCP Server Preparation
Test MCP server functionality (future integration).

```bash
# Check MCP server status
npm test src/mcp/__tests__/mcp-server.test.ts

# Verify MCP resources work with your data
# (This tests the MCP integration with your real Proxmox data)
```

**Expected Results:**
- [ ] MCP server starts successfully
- [ ] Resources properly exposed
- [ ] Tools function correctly
- [ ] Ready for Claude Code integration

---

## 🎉 Success Criteria

### ✅ Foundation Success
- [ ] Connect to your Proxmox server
- [ ] Authenticate successfully
- [ ] Discover real resources

### ✅ Integration Success
- [ ] Interactive console working
- [ ] Workspace properly configured
- [ ] Database populated with real data
- [ ] State synchronization functional

### ✅ Advanced Success
- [ ] Observability capturing real metrics
- [ ] State management with snapshots
- [ ] Configuration export working
- [ ] Ready for IaC generation

---

## 🛠️ Troubleshooting

### Common Issues

**Connection Failures:**
```bash
# Test with verbose output
npm run cli test-connection --verbose --skip-tls-verify

# Check network connectivity
ping 192.168.1.100
telnet 192.168.1.100 8006
```

**Authentication Issues:**
```bash
# Verify token in Proxmox UI
# Check token permissions
# Ensure token is not expired
```

**SSL/TLS Issues:**
```bash
# For self-signed certificates
--skip-tls-verify
```

### Debug Commands
```bash
# Enable debug logging
DEBUG=proxmox-mcp:* proxmox-mpc

# Check logs
tail -f .proxmox/logs/proxmox-mcp.log

# Test specific components
npm test src/api/__tests__/proxmox-client.test.ts
```

---

## 🚀 What This Testing Proves

By completing this testing plan, you'll have validated:

1. **Real Infrastructure Management**: Your tool can discover and manage actual Proxmox resources
2. **Production Readiness**: Core functionality works with real servers, not just mocks
3. **Data Persistence**: Your infrastructure state is properly captured and stored
4. **Observability**: You can monitor and debug real operations
5. **Foundation for AI**: Everything is ready for Claude Code integration

This is **significant progress** - you're managing real infrastructure with a sophisticated, professionally-built tool! 🏆

---

## 🔮 Next Steps After Testing

Once you've validated these features:

1. **Generate Terraform/Ansible** from your real infrastructure
2. **Test IaC generation** with your actual VMs and containers
3. **Prepare for Claude Code integration** using the MCP server
4. **Create infrastructure documentation** from your real setup
5. **Share your success** - you've built something impressive!

**Ready to test your home lab? Let's see your real Proxmox infrastructure managed by proxmox-mcp!** ✨