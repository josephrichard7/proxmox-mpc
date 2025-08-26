# Proxmox-MPC Home Lab Testing Plan
**Safety-First Progressive Testing Strategy**

## Overview

This plan provides a comprehensive, safety-first approach to testing Proxmox-MPC with a real Proxmox home lab server. Testing progresses through three carefully controlled phases with built-in safety measures and immediate rollback capabilities.

**Server Details**: Based on implementation - 192.168.0.19 (as referenced in existing tests)
**Testing Duration**: 9 hours total across 3 phases
**Safety Level**: Zero risk to production environment

---

## Pre-Testing Requirements

### Environment Setup (30 minutes)

#### Server Backup Verification
- [ ] **Task**: Verify Proxmox backup system is operational
  - **Command**: `pvesh get /cluster/backup`
  - **Validation**: Confirm recent backups exist for all critical VMs
  - **Rollback**: If no backups, create manual snapshots before testing
  - **Time**: 15 minutes

#### Configuration Backup
- [ ] **Task**: Backup Proxmox configuration
  - **Commands**:
    ```bash
    # Backup entire /etc/pve directory
    tar -czf proxmox-config-backup-$(date +%Y%m%d).tar.gz /etc/pve/
    # Backup user configurations
    cp /etc/pve/user.cfg /tmp/user.cfg.backup
    # Backup storage configuration
    cp /etc/pve/storage.cfg /tmp/storage.cfg.backup
    ```
  - **Validation**: Verify backup files created successfully
  - **Time**: 15 minutes

#### Test Environment Setup
- [ ] **Task**: Prepare isolated testing workspace
  - **Commands**:
    ```bash
    mkdir -p ~/proxmox-mpc-testing/{backups,logs,reports}
    cd ~/proxmox-mpc-testing
    
    # Set up environment variables for testing
    cat > .env.testing << EOF
    PROXMOX_HOST=192.168.0.19
    PROXMOX_PORT=8006
    PROXMOX_NODE=your-node-name
    PROXMOX_USERNAME=root@pam
    PROXMOX_TOKEN_ID=your-token-id
    PROXMOX_TOKEN_SECRET=your-token-secret
    NODE_ENV=development
    EOF
    ```
  - **Validation**: Environment variables loaded correctly
  - **Time**: 10 minutes

---

## Phase 1: Read-Only Discovery & Validation (2 hours)

**Objective**: Verify API connectivity and resource discovery without any modifications
**Risk Level**: Zero - no write operations performed

### 1.1 API Connectivity Testing (30 minutes)

#### Basic Connection Test
- [ ] **Task**: Test basic Proxmox API connection
  - **Command**: `npm run cli test-connection --verbose`
  - **Expected Output**: 
    ```
    ✅ Connection successful!
       Version: 8.x.x
       Node: [node-name]
    ```
  - **Success Criteria**: 
    - Connection established successfully
    - API version retrieved
    - Node information displayed
  - **Rollback**: N/A (read-only)
  - **Time**: 10 minutes

#### Authentication Validation
- [ ] **Task**: Verify API token permissions
  - **Command**: `npm run cli list-nodes --verbose --output json`
  - **Expected Output**: JSON array of node objects with status
  - **Success Criteria**:
    - Node list retrieved without errors
    - Status information displayed correctly
    - No authentication errors
  - **Validation**: `echo $? # Should be 0`
  - **Time**: 10 minutes

#### SSL/TLS Connection Security
- [ ] **Task**: Test secure connection handling
  - **Commands**:
    ```bash
    # Test with development environment (self-signed certs)
    NODE_ENV=development npm run cli test-connection -v
    # Test connection timeout handling
    timeout 30s npm run cli test-connection -v
    ```
  - **Success Criteria**: Connection works with self-signed certificates
  - **Time**: 10 minutes

### 1.2 Resource Discovery Testing (45 minutes)

#### Node Discovery
- [ ] **Task**: Discover all cluster nodes
  - **Command**: `npm run cli list-nodes --verbose --output yaml > logs/nodes-discovery.yaml`
  - **Expected Output**: YAML file with node details
  - **Success Criteria**:
    - All nodes discovered successfully
    - Status, CPU, memory information retrieved
    - No API errors or timeouts
  - **Validation**: 
    ```bash
    cat logs/nodes-discovery.yaml | grep "node:" | wc -l  # Should match expected node count
    ```
  - **Time**: 15 minutes

#### VM Discovery
- [ ] **Task**: Discover all VMs across cluster
  - **Command**: `npm run cli discover-vms --verbose --output json > logs/vms-discovery.json`
  - **Expected Output**: JSON file with all VMs
  - **Success Criteria**:
    - All VMs discovered from all nodes
    - Status, configuration details retrieved
    - Template VMs properly identified
  - **Validation**:
    ```bash
    jq '.[] | select(.template == true)' logs/vms-discovery.json  # List templates
    jq '.[] | .status' logs/vms-discovery.json | sort | uniq -c  # Status summary
    ```
  - **Time**: 15 minutes

#### Container Discovery
- [ ] **Task**: Discover all LXC containers
  - **Command**: `npm run cli discover-containers --verbose > logs/containers-discovery.log`
  - **Expected Output**: Container list with details
  - **Success Criteria**: All containers discovered with status information
  - **Time**: 10 minutes

#### Storage & Task Discovery
- [ ] **Task**: Complete resource discovery
  - **Commands**:
    ```bash
    npm run cli discover-storage --verbose > logs/storage-discovery.log
    npm run cli discover-tasks --limit 20 --verbose > logs/tasks-discovery.log
    npm run cli discover-all --verbose > logs/complete-discovery.log
    ```
  - **Success Criteria**: All resource types discovered successfully
  - **Time**: 5 minutes

### 1.3 Database State Verification (30 minutes)

#### Database Connection
- [ ] **Task**: Test database initialization
  - **Commands**:
    ```bash
    cd ~/proxmox-mpc-testing
    proxmox-mpc  # Launch interactive console
    # In console:
    /init
    # Follow prompts to initialize workspace
    /exit
    ```
  - **Expected Behavior**: 
    - Console starts without errors
    - Database file created in `.proxmox/state.db`
    - Configuration saved successfully
  - **Success Criteria**: Workspace created with valid database
  - **Validation**: `ls -la .proxmox/` should show `config.yml` and `state.db`
  - **Time**: 20 minutes

#### Database Schema Validation
- [ ] **Task**: Verify database schema integrity
  - **Commands**:
    ```bash
    sqlite3 .proxmox/state.db ".schema" > logs/database-schema.sql
    sqlite3 .proxmox/state.db "SELECT name FROM sqlite_master WHERE type='table';" > logs/database-tables.txt
    ```
  - **Success Criteria**: All expected tables created with proper schema
  - **Expected Tables**: Node, VM, Container, Storage, Task (based on Prisma schema)
  - **Time**: 10 minutes

### 1.4 Console Interface Validation (15 minutes)

#### Interactive Console Testing
- [ ] **Task**: Test console commands
  - **Commands**:
    ```bash
    proxmox-mpc
    # Test each command:
    /help
    /status  
    # Should show server connectivity and workspace status
    /exit
    ```
  - **Success Criteria**: 
    - All commands execute without errors
    - Help system displays available commands
    - Status shows correct server connection
  - **Time**: 15 minutes

---

## Phase 2: Controlled Operations & Synchronization (3 hours)

**Objective**: Test database operations and state synchronization with comprehensive backup
**Risk Level**: Low - database operations only, no server modifications

### 2.1 Database Operations Testing (60 minutes)

#### Database Backup Creation
- [ ] **Task**: Create safety backup before testing
  - **Commands**:
    ```bash
    cp .proxmox/state.db backups/state-db-backup-$(date +%Y%m%d-%H%M%S).db
    cp .proxmox/config.yml backups/config-backup-$(date +%Y%m%d-%H%M%S).yml
    ```
  - **Success Criteria**: Backup files created successfully
  - **Time**: 5 minutes

#### Database Synchronization Test
- [ ] **Task**: Test full resource synchronization
  - **Commands**:
    ```bash
    proxmox-mpc
    /sync  # Full synchronization from server to database
    /status  # Check synchronization results
    /exit
    ```
  - **Expected Behavior**: 
    - Server resources discovered and stored in database
    - Progress feedback during sync process
    - Success confirmation with resource count
  - **Success Criteria**:
    - All discovered resources stored in database
    - No API errors during sync
    - Database populated with current server state
  - **Validation**:
    ```bash
    sqlite3 .proxmox/state.db "SELECT COUNT(*) FROM Node;" > logs/db-node-count.txt
    sqlite3 .proxmox/state.db "SELECT COUNT(*) FROM VM;" > logs/db-vm-count.txt
    sqlite3 .proxmox/state.db "SELECT COUNT(*) FROM Container;" > logs/db-container-count.txt
    ```
  - **Time**: 30 minutes

#### State Consistency Verification
- [ ] **Task**: Compare database state with server state
  - **Commands**:
    ```bash
    # Export database state
    sqlite3 .proxmox/state.db "SELECT vmid, name, status FROM VM;" > logs/db-vm-state.txt
    # Compare with fresh server discovery
    npm run cli discover-vms --output json | jq -r '.[] | "\(.vmid),\(.name // "unnamed"),\(.status)"' > logs/server-vm-state.txt
    # Compare results
    diff logs/db-vm-state.txt logs/server-vm-state.txt > logs/state-diff.txt
    ```
  - **Success Criteria**: Database state matches server state exactly
  - **Time**: 20 minutes

#### Rollback Testing
- [ ] **Task**: Test database rollback capability
  - **Commands**:
    ```bash
    # Test rollback from backup
    cp backups/state-db-backup-*.db .proxmox/state.db
    proxmox-mpc
    /status  # Should show pre-sync state
    /exit
    ```
  - **Success Criteria**: Database successfully restored to previous state
  - **Time**: 5 minutes

### 2.2 Workspace Management Testing (45 minutes)

#### Multiple Workspace Testing
- [ ] **Task**: Test workspace creation and switching
  - **Commands**:
    ```bash
    mkdir ~/test-workspace-2
    cd ~/test-workspace-2
    proxmox-mpc
    /init  # Create second workspace
    /status
    /exit
    ```
  - **Success Criteria**: Multiple independent workspaces created
  - **Time**: 20 minutes

#### Configuration Management
- [ ] **Task**: Test configuration handling
  - **Commands**:
    ```bash
    # Test configuration validation
    cat .proxmox/config.yml
    # Test with invalid configuration
    cp .proxmox/config.yml .proxmox/config.yml.backup
    echo "invalid: yaml: content" >> .proxmox/config.yml
    proxmox-mpc  # Should handle gracefully
    /exit
    # Restore configuration
    mv .proxmox/config.yml.backup .proxmox/config.yml
    ```
  - **Success Criteria**: Invalid configuration handled gracefully with error messages
  - **Time**: 15 minutes

#### Workspace Migration Testing
- [ ] **Task**: Test workspace portability
  - **Commands**:
    ```bash
    # Copy workspace to new location
    cp -r ~/proxmox-mpc-testing ~/proxmox-mpc-testing-copy
    cd ~/proxmox-mpc-testing-copy
    proxmox-mpc
    /status  # Should work in new location
    /exit
    ```
  - **Success Criteria**: Workspace functions correctly in new location
  - **Time**: 10 minutes

### 2.3 Performance & Error Handling Testing (75 minutes)

#### Performance Benchmarking
- [ ] **Task**: Measure operation performance
  - **Commands**:
    ```bash
    time npm run cli discover-all --verbose > logs/performance-discovery.log 2>&1
    time (proxmox-mpc << EOF
    /sync
    /exit
    EOF
    ) > logs/performance-sync.log 2>&1
    ```
  - **Success Criteria**: Operations complete within reasonable time (< 30s for discovery, < 60s for sync)
  - **Performance Targets**:
    - Discovery: < 30 seconds for full cluster
    - Sync: < 60 seconds for typical home lab
    - Console startup: < 5 seconds
  - **Time**: 30 minutes

#### Error Handling Testing
- [ ] **Task**: Test error conditions
  - **Commands**:
    ```bash
    # Test invalid server configuration
    PROXMOX_HOST=invalid.server npm run cli test-connection
    # Test invalid credentials
    PROXMOX_TOKEN_SECRET=invalid npm run cli test-connection
    # Test network timeout
    timeout 5s npm run cli discover-all
    ```
  - **Expected Behavior**: Graceful error handling with informative messages
  - **Success Criteria**: No crashes, clear error messages provided
  - **Time**: 30 minutes

#### Resource Limit Testing
- [ ] **Task**: Test with resource constraints
  - **Commands**:
    ```bash
    # Test with limited memory (if possible in your environment)
    # Test concurrent operations
    npm run cli discover-vms --verbose & 
    npm run cli discover-containers --verbose &
    wait
    ```
  - **Success Criteria**: Operations complete successfully even under constraints
  - **Time**: 15 minutes

---

## Phase 3: Integration Testing & Production Readiness (4 hours)

**Objective**: End-to-end workflow validation and production readiness verification
**Risk Level**: Medium - includes validation of all workflows

### 3.1 End-to-End Workflow Testing (120 minutes)

#### Complete Project Workflow
- [ ] **Task**: Test full project lifecycle
  - **Commands**:
    ```bash
    mkdir ~/production-test-workspace
    cd ~/production-test-workspace
    
    # Step 1: Initialize project
    proxmox-mpc
    /init
    
    # Step 2: Sync infrastructure
    /sync
    
    # Step 3: Check status
    /status
    
    # Step 4: Exit and validate files
    /exit
    
    # Step 5: Validate generated files
    ls -la .proxmox/
    find . -name "*.tf" -o -name "*.yml" -o -name "*.yaml" | head -10
    ```
  - **Expected Behavior**:
    - Project initialized successfully
    - Infrastructure synchronized
    - Configuration files generated (when implemented)
  - **Success Criteria**: Complete workflow executes without errors
  - **Time**: 60 minutes

#### CLI Integration Testing
- [ ] **Task**: Test comprehensive CLI workflows
  - **Commands**:
    ```bash
    # Test discovery pipeline
    npm run cli discover-all --output json > production-discovery.json
    
    # Test filtering capabilities
    npm run cli discover-vms --status running --verbose
    npm run cli discover-vms --node [your-node] --verbose
    
    # Test output formats
    npm run cli list-nodes --output yaml > nodes.yaml
    npm run cli discover-storage --verbose > storage.txt
    ```
  - **Success Criteria**: All CLI commands work correctly with various options
  - **Time**: 45 minutes

#### Console Integration Testing
- [ ] **Task**: Test all console commands thoroughly
  - **Commands**:
    ```bash
    proxmox-mpc
    /help      # List all commands
    /status    # Check all systems
    /sync      # Full sync
    /status    # Verify sync results
    /exit      # Clean exit
    ```
  - **Success Criteria**: All console commands function correctly
  - **Time**: 15 minutes

### 3.2 IaC Generation Testing (60 minutes)

*Note: This section tests infrastructure-as-code generation capability when implemented*

#### Terraform Generation Testing
- [ ] **Task**: Test Terraform configuration generation
  - **Commands**:
    ```bash
    # If implemented:
    find . -name "terraform" -type d
    find . -name "*.tf" | head -10
    # Validate Terraform syntax if files exist:
    if [ -d terraform ]; then
        cd terraform && terraform validate && cd ..
    fi
    ```
  - **Expected Behavior**: Valid Terraform configurations generated
  - **Success Criteria**: Terraform files are syntactically correct
  - **Time**: 30 minutes

#### Ansible Generation Testing
- [ ] **Task**: Test Ansible playbook generation
  - **Commands**:
    ```bash
    # If implemented:
    find . -name "ansible" -type d
    find . -name "*.yml" -path "*/ansible/*" | head -10
    # Validate Ansible syntax if files exist:
    if [ -d ansible ]; then
        ansible-playbook --syntax-check ansible/*.yml
    fi
    ```
  - **Expected Behavior**: Valid Ansible playbooks generated
  - **Success Criteria**: Ansible files are syntactically correct
  - **Time**: 30 minutes

### 3.3 Security & Safety Validation (60 minutes)

#### Security Testing
- [ ] **Task**: Validate security practices
  - **Commands**:
    ```bash
    # Check for exposed credentials
    grep -r "password\|secret\|token" . --exclude-dir=node_modules --exclude="*.log" || true
    
    # Verify secure configuration storage
    cat .proxmox/config.yml | grep -v "token_secret" | grep -v "password"
    
    # Test with invalid permissions
    chmod 000 .proxmox/config.yml 2>/dev/null || true
    proxmox-mpc  # Should handle gracefully
    chmod 644 .proxmox/config.yml
    ```
  - **Success Criteria**: 
    - No credentials exposed in logs or config files
    - Graceful handling of permission issues
  - **Time**: 30 minutes

#### Data Safety Validation
- [ ] **Task**: Verify data protection mechanisms
  - **Commands**:
    ```bash
    # Test database corruption handling
    cp .proxmox/state.db .proxmox/state.db.backup
    echo "corrupted" > .proxmox/state.db
    proxmox-mpc
    /status  # Should detect corruption
    /exit
    
    # Restore database
    mv .proxmox/state.db.backup .proxmox/state.db
    proxmox-mpc
    /status  # Should work again
    /exit
    ```
  - **Success Criteria**: Corruption detected and handled gracefully
  - **Time**: 30 minutes

### 3.4 Production Readiness Assessment (60 minutes)

#### Performance Under Load
- [ ] **Task**: Test with realistic home lab scale
  - **Commands**:
    ```bash
    # Stress test discovery
    for i in {1..5}; do
        echo "Run $i:"
        time npm run cli discover-all --verbose >> logs/load-test-$i.log 2>&1
        sleep 10
    done
    
    # Test concurrent console sessions (if possible)
    proxmox-mpc &
    CONSOLE_PID=$!
    sleep 5
    kill $CONSOLE_PID 2>/dev/null || true
    ```
  - **Success Criteria**: Consistent performance across multiple runs
  - **Time**: 30 minutes

#### Resource Usage Monitoring
- [ ] **Task**: Monitor system resource usage
  - **Commands**:
    ```bash
    # Monitor during operations
    top -b -n 1 | grep -E "(node|proxmox)" || true
    ps aux | grep -E "(node|proxmox)" || true
    
    # Check disk usage
    du -sh . > logs/disk-usage.txt
    du -sh .proxmox/ >> logs/disk-usage.txt
    ```
  - **Success Criteria**: Reasonable resource usage (< 100MB memory, < 10% CPU)
  - **Time**: 15 minutes

#### Final Integration Test
- [ ] **Task**: Complete system validation
  - **Commands**:
    ```bash
    # Final comprehensive test
    npm test 2>&1 | tee logs/final-test-results.txt
    npm run build 2>&1 | tee logs/final-build-results.txt
    
    # Test installed binary
    which proxmox-mpc
    proxmox-mpc --version || echo "Version command not available"
    
    # Final console test
    echo "/help\n/status\n/exit" | proxmox-mpc
    ```
  - **Success Criteria**: All systems functional, build successful
  - **Time**: 15 minutes

---

## Success Criteria & Validation

### Phase 1 Success Criteria
- [ ] **API Connection**: Successful connection to Proxmox server
- [ ] **Resource Discovery**: All resources discovered without errors
- [ ] **Database Initialization**: Workspace created with valid database
- [ ] **Console Interface**: Interactive console works correctly

### Phase 2 Success Criteria
- [ ] **Database Sync**: Server state successfully synchronized to database
- [ ] **State Consistency**: Database state matches server state exactly
- [ ] **Performance**: Operations complete within time targets
- [ ] **Error Handling**: Graceful error handling with informative messages

### Phase 3 Success Criteria
- [ ] **End-to-End Workflows**: Complete project lifecycle works
- [ ] **Security Validation**: No security issues or credential exposure
- [ ] **Production Readiness**: System ready for production use
- [ ] **Resource Efficiency**: Reasonable resource usage under load

---

## Emergency Procedures

### Immediate Rollback Steps
1. **Stop all operations**: `Ctrl+C` to interrupt any running commands
2. **Restore database**: `cp backups/state-db-backup-*.db .proxmox/state.db`
3. **Restore configuration**: `cp backups/config-backup-*.yml .proxmox/config.yml`
4. **Verify Proxmox server**: Access web interface to confirm no changes made

### Server Safety Verification
```bash
# Quick server health check
curl -k https://192.168.0.19:8006/api2/json/version
ssh root@192.168.0.19 "pveversion"
```

### Contact Information
- **Proxmox Web Interface**: https://192.168.0.19:8006
- **Project Directory**: `~/dev/proxmox-mpc`
- **Test Logs Location**: `~/proxmox-mpc-testing/logs/`

---

## Post-Testing Report Template

### Test Results Summary
```bash
# Generate final report
cat > logs/testing-report-$(date +%Y%m%d).md << 'EOF'
# Proxmox-MPC Home Lab Testing Report

## Phase 1: Read-Only Discovery
- [ ] API Connection: PASS/FAIL
- [ ] Resource Discovery: PASS/FAIL  
- [ ] Database Initialization: PASS/FAIL
- [ ] Console Interface: PASS/FAIL

## Phase 2: Controlled Operations
- [ ] Database Synchronization: PASS/FAIL
- [ ] State Consistency: PASS/FAIL
- [ ] Performance Benchmarks: PASS/FAIL
- [ ] Error Handling: PASS/FAIL

## Phase 3: Integration Testing
- [ ] End-to-End Workflows: PASS/FAIL
- [ ] Security Validation: PASS/FAIL
- [ ] Production Readiness: PASS/FAIL

## Issues Found
- 

## Recommendations
- 

## Next Steps
- 
EOF
```

This comprehensive testing plan ensures thorough validation of Proxmox-MPC while maintaining zero risk to your production Proxmox environment through progressive testing phases and comprehensive safety measures.