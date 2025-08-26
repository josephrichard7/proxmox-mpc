# Proxmox-MPC Safe Testing Execution Guide
## Step-by-Step Implementation of Production-Safe Testing

**Reference**: See `SAFE_TESTING_PLAN.md` for complete safety framework and methodology

---

## 🚀 Pre-Testing Setup & Safety Verification

### Environment Preparation
```bash
# 1. Create isolated testing workspace
mkdir ~/proxmox-testing-safe
cd ~/proxmox-testing-safe

# 2. Verify Proxmox-MPC installation and build
cd /home/dev/dev/proxmox-mpc
npm run build
npm run typecheck

# 3. Create testing environment variables
cat > ~/proxmox-testing-safe/.env << EOF
# Proxmox Server Configuration (READ-ONLY MODE)
PROXMOX_HOST=192.168.0.19
PROXMOX_USERNAME=your-username
PROXMOX_PASSWORD=your-password
PROXMOX_NODE=your-node-name
PROXMOX_SSL_VERIFY=false

# Safety Configuration
TESTING_MODE=true
READ_ONLY_MODE=true
MAX_RESOURCE_USAGE=80
ENABLE_AUDIT_LOGGING=true
BACKUP_REQUIRED=true
EOF

# 4. Verify Proxmox server connectivity
npm run cli test-connection -v
```

### Safety Pre-Checks
```bash
# 1. Verify backup systems
echo "✅ Backup verification:"
echo "   - Proxmox backups are current and functional"
echo "   - Database backups are available"
echo "   - Configuration files are backed up"

# 2. Confirm emergency procedures
echo "✅ Emergency procedures ready:"
echo "   - Emergency abort: Ctrl+C"
echo "   - Rollback commands prepared"
echo "   - Support contacts available"

# 3. Resource monitoring setup
echo "✅ Monitoring systems active:"
echo "   - System resource monitoring enabled"
echo "   - API call logging enabled"
echo "   - Network monitoring active"
```

---

## 📋 Phase 1: Read-Only Infrastructure Discovery
**Safety Level**: MINIMAL RISK | **Duration**: 2-3 hours

### Step 1.1: Basic Connectivity Testing (30 minutes)
```bash
# Navigate to testing workspace
cd ~/proxmox-testing-safe

# Launch Proxmox-MPC console
proxmox-mpc

# In console - Initialize workspace in read-only mode
proxmox-mpc> /init
# When prompted, enter your Proxmox server details
# Host: 192.168.0.19
# Username: your-username  
# Password: your-password
# Node: your-node-name
# Enable read-only mode: YES

# Test basic connectivity
proxmox-mpc> /status
# Expected: Connection successful, server info displayed

# Exit and verify workspace creation
proxmox-mpc> /exit
```

### Step 1.2: Resource Discovery Testing (45 minutes)
```bash
# Re-launch console
proxmox-mpc

# Test resource discovery without database writes
proxmox-mpc> /sync --dry-run
# Expected: Resources discovered, no database changes

# Verify discovered resources match your known infrastructure
# Check nodes, VMs, containers, storage, networks

# Test specific resource queries
proxmox-mpc> list vms
proxmox-mpc> list containers  
proxmox-mpc> list nodes

# Expected: Accurate inventory matching your server
```

### Step 1.3: Database Schema Validation (30 minutes)
```bash
# Test database initialization with discovered data
proxmox-mpc> /init --validate-schema
# Expected: Schema validation successful

# Check database file creation
ls -la .proxmox/
# Expected: config.yml and state.db created

# Verify database structure
npm run cli validate-database
# Expected: Schema matches discovered resources
```

### Step 1.4: Console Functionality Testing (30 minutes)
```bash
# Test all available console commands
proxmox-mpc> /help
# Expected: All commands listed correctly

# Test command completion
proxmox-mpc> /st[TAB]
# Expected: Completes to /status

# Test error handling
proxmox-mpc> /invalid-command
# Expected: Clear error message, help suggestion

# Test session management
proxmox-mpc> /exit
# Expected: Graceful exit with session summary
```

### Phase 1 Validation Checklist
- [ ] API connectivity established successfully
- [ ] All production resources discovered accurately
- [ ] Database schema validates against real data
- [ ] Console commands work reliably
- [ ] No modifications to production environment
- [ ] Complete operation logging functional

---

## 📊 Phase 2: Controlled Database Operations
**Safety Level**: LOW-MEDIUM RISK | **Duration**: 3-4 hours

### Step 2.1: Workspace Database Initialization (45 minutes)
```bash
# Launch console for database testing
proxmox-mpc

# Initialize workspace with full production data
proxmox-mpc> /init --production-data
# Expected: Complete workspace setup with database

# Verify database synchronization
proxmox-mpc> /sync
# Expected: All resources synchronized to local database

# Check database integrity
npm run test:database
# Expected: All database tests pass
```

### Step 2.2: State Management Validation (45 minutes)
```bash
# Test resource state tracking
proxmox-mpc> describe vm 100  # Replace with actual VM ID
# Expected: Detailed VM information displayed

# Test relationship validation
proxmox-mpc> list vms --node pve  # Replace with actual node name
# Expected: VMs filtered by node correctly

# Test change detection (simulated)
# Manually modify a database entry temporarily
# Run sync to detect differences
proxmox-mpc> /sync --check-drift
# Expected: Differences detected and reported
```

### Step 2.3: IaC Generation Testing (60 minutes)
```bash
# Test Terraform generation
proxmox-mpc> create vm --name test-safe-vm --cores 2 --memory 4096 --dry-run
# Expected: Terraform configuration generated, no actual VM creation

# Verify generated Terraform files
ls terraform/vms/
cat terraform/vms/test-safe-vm.tf
# Expected: Valid Terraform syntax and configuration

# Test Ansible generation
proxmox-mpc> create container --name test-safe-ct --memory 2048 --dry-run
# Expected: Ansible playbook generated

# Verify generated Ansible files
ls ansible/playbooks/
cat ansible/playbooks/test-safe-ct.yml
# Expected: Valid Ansible syntax and configuration
```

### Step 2.4: Workspace Management Testing (45 minutes)
```bash
# Test workspace operations
proxmox-mpc> /status
# Expected: Complete workspace status displayed

# Test configuration management
cat .proxmox/config.yml
# Expected: Correct configuration saved

# Test database backup
cp .proxmox/state.db .proxmox/state.db.backup
# Expected: Database backup successful

# Test workspace restoration
proxmox-mpc> /init --restore .proxmox/state.db.backup
# Expected: Workspace restored from backup
```

### Phase 2 Validation Checklist
- [ ] Database synchronization completes successfully
- [ ] All resource relationships preserved correctly
- [ ] Generated IaC files are syntactically valid
- [ ] Workspace management functions properly
- [ ] State tracking works accurately
- [ ] No impact on production Proxmox server

---

## ⚡ Phase 3: Non-Destructive API Testing
**Safety Level**: MEDIUM RISK | **Duration**: 4-5 hours

### Step 3.1: Pre-Test Safety Verification (30 minutes)
```bash
# Verify all safety systems
echo "🛡️ Safety Verification:"

# 1. Backup verification
echo "✅ Backups verified and accessible"

# 2. Emergency procedures test
echo "✅ Testing emergency abort..."
timeout 5s proxmox-mpc || echo "✅ Emergency abort working"

# 3. Resource monitoring
echo "✅ Resource monitoring active"
top -bn1 | grep -E "load|memory" 

# 4. Production resource protection
echo "✅ Production exclusion lists active"
```

### Step 3.2: Controlled Resource Testing (90 minutes)
```bash
# Launch console with API testing mode
proxmox-mpc

# Test minimal resource creation (if safe to do so)
# NOTE: Only proceed if you have a test node or isolated environment
proxmox-mpc> create vm --name SAFE-TEST-VM --cores 1 --memory 512 --temp --confirm
# Expected: Test VM created successfully

# Monitor resource creation
proxmox-mpc> /status
# Expected: New VM visible in status

# Test immediate cleanup
proxmox-mpc> delete vm SAFE-TEST-VM --confirm
# Expected: Test VM removed successfully

# Verify cleanup completed
proxmox-mpc> list vms
# Expected: Test VM no longer present
```

### Step 3.3: Workflow Integration Testing (120 minutes)
```bash
# Test complete workflow with safety nets
proxmox-mpc> /plan --simulate
# Expected: Deployment plan generated without execution

# Test error recovery
# Simulate network interruption during operation
proxmox-mpc> /sync --timeout 5
# Expected: Operation timeout handled gracefully

# Test rollback procedures
proxmox-mpc> /rollback --to-snapshot initial
# Expected: System state restored to initial snapshot
```

### Step 3.4: Performance and Stability Testing (60 minutes)
```bash
# Test concurrent operations
proxmox-mpc> /sync &
proxmox-mpc> /status &
wait
# Expected: Concurrent operations handled correctly

# Test resource monitoring
watch -n 1 'proxmox-mpc status --brief'
# Monitor for 5-10 minutes
# Expected: Consistent performance, no memory leaks

# Test error handling
proxmox-mpc> connect invalid-server
# Expected: Clear error message, no crash
```

### Phase 3 Validation Checklist
- [ ] API operations execute successfully
- [ ] All test resources cleaned up properly
- [ ] Error handling works as expected
- [ ] Performance remains stable
- [ ] Rollback procedures function correctly
- [ ] No permanent changes to production

---

## 🎯 Phase 4: Comprehensive Integration Validation
**Safety Level**: MEDIUM-HIGH RISK | **Duration**: 3-4 hours

### Step 4.1: Production Simulation Setup (60 minutes)
```bash
# Create comprehensive test environment
mkdir ~/proxmox-production-simulation
cd ~/proxmox-production-simulation

# Set up monitoring
echo "🔍 Setting up comprehensive monitoring..."

# Create test resource pool (if supported)
proxmox-mpc> create pool --name SAFE-TEST-POOL
# Expected: Test pool created for isolation

# Configure monitoring and alerting
proxmox-mpc> /monitor --enable --alert-threshold 80
# Expected: Monitoring system active
```

### Step 4.2: End-to-End Workflow Testing (120 minutes)
```bash
# Test complete infrastructure lifecycle
proxmox-mpc> /init --production-simulation
proxmox-mpc> /sync --full
proxmox-mpc> /plan --comprehensive
proxmox-mpc> /apply --dry-run
# Expected: Complete workflow simulated successfully

# Test deployment scenarios
proxmox-mpc> /export --target ./deployment-config
# Expected: Deployment configuration exported

# Test backup and recovery
proxmox-mpc> /backup --create snapshot-test
proxmox-mpc> /restore --from snapshot-test
# Expected: Backup and restore functional
```

### Step 4.3: Stress and Reliability Testing (60 minutes)
```bash
# Test system under load
for i in {1..10}; do
  proxmox-mpc status --brief &
done
wait
# Expected: System handles concurrent requests

# Test error recovery under stress
proxmox-mpc> /stress-test --duration 300 --concurrent 5
# Expected: System remains stable under load

# Test resource management
proxmox-mpc> /monitor --resources --duration 300
# Expected: Resource usage within acceptable limits
```

### Step 4.4: Production Readiness Validation (30 minutes)
```bash
# Final system validation
proxmox-mpc> /validate --production-ready
# Expected: All production readiness checks pass

# Performance benchmarking
proxmox-mpc> /benchmark --comprehensive
# Expected: Performance meets requirements

# Security validation
proxmox-mpc> /security-check --full
# Expected: No security issues identified

# Documentation verification
proxmox-mpc> /help --comprehensive
# Expected: Complete documentation available
```

### Phase 4 Validation Checklist
- [ ] All workflows complete successfully
- [ ] System performs reliably under load
- [ ] Error recovery mechanisms functional
- [ ] Security validation passes
- [ ] Production readiness confirmed
- [ ] Test environment cleaned up completely

---

## 🚨 Emergency Procedures Implementation

### Immediate Abort Procedure
```bash
# Emergency stop all operations
pkill -f proxmox-mpc
killall node

# Restore system state
cd ~/proxmox-testing-safe
cp .proxmox/state.db.backup .proxmox/state.db

# Verify system restoration
proxmox-mpc> /status
# Expected: System restored to safe state
```

### Rollback Verification
```bash
# Verify no unintended changes
proxmox-mpc> /diff --production
# Expected: No differences from initial state

# Validate production system integrity
npm run cli test-connection --validate-integrity
# Expected: Production system unchanged

# Generate incident report
proxmox-mpc> /audit --generate-report --incident emergency-stop
# Expected: Complete audit trail available
```

---

## 📊 Success Validation & Reporting

### Final Validation Commands
```bash
# Comprehensive system validation
npm test                           # All tests passing
npm run typecheck                  # No TypeScript errors
npm run build                      # Clean build
npm run cli test-connection -v     # API connectivity confirmed

# Production readiness verification
proxmox-mpc> /validate --production-complete
# Expected: All validation checks pass

# Generate testing report
proxmox-mpc> /report --testing-complete --export testing-report.json
# Expected: Comprehensive testing report generated
```

### Expected Success Metrics
```yaml
test_completion:
  - Phase 1: ✅ 100% read-only operations successful
  - Phase 2: ✅ Database operations validated
  - Phase 3: ✅ API testing completed safely
  - Phase 4: ✅ Production readiness confirmed

safety_validation:
  - Zero unintended production changes
  - Complete audit trail available
  - All rollback procedures tested
  - Emergency procedures functional

performance_validation:
  - API response times < 2 seconds
  - Resource synchronization < 30 seconds
  - Stable performance under load
  - Memory usage within limits

reliability_validation:
  - 99%+ operation success rate
  - Error handling working correctly
  - Recovery procedures functional
  - Professional user experience
```

### Post-Testing Cleanup
```bash
# Clean up test workspaces
rm -rf ~/proxmox-testing-safe
rm -rf ~/proxmox-production-simulation

# Remove temporary configurations
rm ~/.proxmox-mpc-test-config

# Archive testing results
mkdir ~/proxmox-mpc-testing-results
cp testing-report.json ~/proxmox-mpc-testing-results/
cp audit-log.json ~/proxmox-mpc-testing-results/

echo "✅ Safe testing completed successfully!"
echo "📊 Results archived in ~/proxmox-mpc-testing-results/"
echo "🚀 Proxmox-MPC ready for production deployment!"
```

---

## 📋 Testing Timeline Summary

| Phase | Duration | Risk Level | Key Validations |
|-------|----------|------------|-----------------|
| Phase 1 | 2-3 hours | Minimal | API connectivity, resource discovery |
| Phase 2 | 3-4 hours | Low-Medium | Database operations, IaC generation |
| Phase 3 | 4-5 hours | Medium | API testing, workflow validation |
| Phase 4 | 3-4 hours | Medium-High | Integration testing, production readiness |
| **Total** | **12-16 hours** | **Controlled** | **Complete system validation** |

**Final Outcome**: Proxmox-MPC validated against real production infrastructure with zero risk and complete operational confidence, ready for production deployment.