# Proxmox-MPC v1.0.0 Breaking Changes & Backward Compatibility

**Document Version**: 1.0  
**Release Date**: August 28, 2025  
**Effective Version**: v1.0.0

## Executive Summary

Proxmox-MPC v1.0.0 introduces **minimal breaking changes** with comprehensive backward compatibility strategies. The breaking changes are primarily related to **modernization requirements** (Node.js version, configuration format) rather than functional API changes. All breaking changes have **automatic migration paths** or **clear upgrade procedures**.

## Breaking Changes Analysis

### 🔴 **BREAKING CHANGE 1**: Node.js Version Requirement

#### Change Details

- **Previous Requirement**: Node.js >=16.0.0
- **New Requirement**: Node.js >=18.0.0
- **Rationale**: Access to modern JavaScript features, improved performance, security updates

#### Impact Assessment

- **Risk Level**: **LOW** - Node.js 18 is widely adopted and stable
- **User Impact**: Requires Node.js upgrade for users on older versions
- **Compatibility**: Node.js 18.x, 20.x, 22.x all supported

#### Migration Strategy

```bash
# Check current Node.js version
node --version

# If < 18.0.0, upgrade using Node Version Manager
# macOS/Linux
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18

# Windows
# Download and install from https://nodejs.org/
# Or use Chocolatey: choco install nodejs --version=18.19.0
```

#### Backward Compatibility

- **None Required**: Node.js version is a runtime requirement, not an API change
- **Detection**: Application will fail to start on Node.js <18 with clear error message
- **Validation**: Package.json engines field enforces minimum version

### 🔴 **BREAKING CHANGE 2**: Configuration Format Evolution

#### Change Details

- **Previous Format**: JSON-based configuration files
- **New Format**: YAML-based configuration with enhanced structure
- **Files Affected**: `config.json` → `config.yml`, workspace configurations

#### Impact Assessment

- **Risk Level**: **LOW** - Automatic migration available
- **User Impact**: Existing projects require one-time configuration migration
- **Compatibility**: Both formats supported during v1.0.x transition period

#### Migration Strategy

**Automatic Migration** (Recommended):

```bash
# Launch console in existing project
proxmox-mpc

# System detects old config.json and prompts for migration
proxmox-mpc> /init --migrate
🔄 Legacy configuration detected
✅ Migrated config.json → config.yml
📁 Backup created: config.json.backup
```

**Manual Migration**:

```yaml
# Old format (config.json)
{
  "server": {
    "host": "192.168.1.100",
    "port": 8006,
    "username": "root@pam",
    "token_id": "automation"
  }
}

# New format (config.yml)
server:
  host: "192.168.1.100"
  port: 8006
  username: "root@pam"
  token_id: "automation"
  verify_ssl: true
  timeout: 30000

workspace:
  name: "my-datacenter"
  terraform_version: "1.6.0"
  ansible_version: "8.5.0"
```

#### Backward Compatibility

- **Transition Period**: v1.0.x will read both JSON and YAML formats
- **Automatic Detection**: System automatically detects and migrates legacy configurations
- **Fallback**: If migration fails, manual configuration wizard available
- **Validation**: Schema validation ensures configuration correctness

### 🔴 **BREAKING CHANGE 3**: CLI Command Structure Refinement

#### Change Details

- **Previous Commands**: Some inconsistent command names and parameters
- **New Commands**: Standardized kubectl-style command structure
- **Affected Commands**: Resource management commands renamed for consistency

#### Impact Assessment

- **Risk Level**: **VERY LOW** - Aliases provided for all changed commands
- **User Impact**: Existing scripts may need minor updates
- **Compatibility**: Legacy command aliases maintained in v1.0.x

#### Migration Strategy

**Command Mapping**:

```bash
# Old → New (with maintained aliases)
npm run cli vm-list        →  npm run cli list vms
npm run cli container-list →  npm run cli list containers
npm run cli vm-create      →  npm run cli create vm
npm run cli vm-info        →  npm run cli describe vm

# All old commands still work with deprecation warnings
npm run cli vm-list
⚠️  Warning: 'vm-list' is deprecated, use 'list vms' instead
```

**Script Migration**:

```bash
# Update existing scripts gradually
# Old scripts continue working with warnings
# New scripts should use standardized commands

# Recommended approach for v1.0.0
npm run cli list vms --format json
npm run cli create vm --name web-01 --cores 4
npm run cli describe vm 100 --format yaml
```

#### Backward Compatibility

- **Command Aliases**: All old commands available as aliases with deprecation warnings
- **Gradual Deprecation**: Aliases will be maintained through v1.x series
- **Documentation**: Clear migration guide provided in CLI help
- **Validation**: Help system shows both old and new command formats

### 🔴 **BREAKING CHANGE 4**: Database Schema Evolution

#### Change Details

- **Previous Schema**: Basic v0.x database schema
- **New Schema**: Enhanced v1.0.0 schema with improved relationships and performance
- **Migration**: Automatic database migration on first v1.0.0 startup

#### Impact Assessment

- **Risk Level**: **LOW** - Fully automated migration with rollback capability
- **User Impact**: Transparent to users, may see one-time migration message
- **Compatibility**: Automatic migration preserves all existing data

#### Migration Strategy

**Automatic Migration**:

```bash
# First launch after upgrade
proxmox-mpc
🔄 Database migration required (v0.x → v1.0.0)
📦 Creating backup: .proxmox/state.db.v0.backup
🚀 Migrating schema...
✅ Migration completed successfully
📊 Migrated 15 VMs, 8 containers, 3 storage pools
```

**Manual Backup** (Optional):

```bash
# Create manual backup before upgrade (optional)
cp .proxmox/state.db .proxmox/state.db.manual-backup

# Verify migration success
proxmox-mpc
proxmox-mpc> /status
✅ Database: v1.0.0 schema (migrated from v0.x)
```

#### Backward Compatibility

- **Automatic Backup**: System creates backup before migration
- **Rollback Available**: Can revert to v0.x if needed
- **Data Preservation**: All existing data preserved during migration
- **Validation**: Post-migration validation ensures data integrity

## Non-Breaking Changes with Enhanced Capabilities

### ✅ **API Enhancements** (Backward Compatible)

- **Enhanced Error Handling**: Improved error messages and recovery suggestions
- **Performance Improvements**: Faster API responses and reduced memory usage
- **New Features**: Additional slash commands and CLI capabilities
- **Security**: Enhanced authentication and SSL validation

### ✅ **Console Experience Improvements** (Backward Compatible)

- **Tab Completion**: Enhanced auto-completion for commands and parameters
- **Command History**: Persistent history across sessions
- **Help System**: Improved contextual help and examples
- **Session Management**: Better session state management

## Migration Checklist for v1.0.0 Upgrade

### **Pre-Upgrade Preparation**

- [ ] **Node.js Version**: Verify Node.js >=18.0.0 or upgrade
- [ ] **Backup Projects**: Create backups of important project directories
- [ ] **Document Custom Scripts**: List any automation scripts that use CLI commands
- [ ] **Review Configuration**: Note any custom configuration modifications

### **Upgrade Process**

```bash
# 1. Backup existing installation (optional)
cp -r ~/.config/proxmox-mpc ~/.config/proxmox-mpc.backup

# 2. Upgrade to v1.0.0
npm update -g proxmox-mpc

# 3. Verify installation
proxmox-mpc --version
# Should show: v1.0.0

# 4. Test in existing project
cd /path/to/existing/project
proxmox-mpc
# Follow any migration prompts
```

### **Post-Upgrade Validation**

- [ ] **Configuration Migration**: Verify config.yml created successfully
- [ ] **Database Migration**: Check database migration completed
- [ ] **Command Testing**: Test key CLI commands and console operations
- [ ] **Project Functionality**: Verify existing projects work correctly
- [ ] **Script Updates**: Update any automation scripts to use new command structure

## Rollback Procedures

### **Emergency Rollback to v0.1.3**

```bash
# 1. Install previous version
npm install -g proxmox-mpc@0.1.3

# 2. Restore database if needed
cd /path/to/project
cp .proxmox/state.db.v0.backup .proxmox/state.db

# 3. Restore configuration if needed
cp config.json.backup config.json
rm config.yml
```

### **Selective Rollback Options**

- **Database Only**: Restore from automatic backup created during migration
- **Configuration Only**: Revert to JSON format using backup files
- **Full Rollback**: Complete restoration to v0.1.3 environment

## Support & Migration Assistance

### **Automatic Migration Support**

- **Detection**: System automatically detects legacy configurations and prompts for migration
- **Validation**: Post-migration validation ensures successful upgrade
- **Documentation**: Built-in help system provides migration guidance
- **Error Recovery**: Clear error messages with recovery suggestions

### **Community Support**

- **GitHub Issues**: Report migration issues for assistance
- **Documentation**: Comprehensive migration guides available
- **Examples**: Sample configurations and migration scripts provided
- **FAQ**: Common migration questions and solutions documented

### **Enterprise Support**

Professional migration assistance available for enterprise deployments with complex configurations or large-scale environments.

## Risk Assessment Summary

| Breaking Change    | Risk Level   | Migration Effort | Support Level |
| ------------------ | ------------ | ---------------- | ------------- |
| Node.js >=18.0.0   | **LOW**      | **MINIMAL**      | Automated     |
| YAML Configuration | **LOW**      | **LOW**          | Automated     |
| CLI Commands       | **VERY LOW** | **MINIMAL**      | Aliases       |
| Database Schema    | **LOW**      | **NONE**         | Automated     |

**Overall Risk**: **LOW** - All breaking changes have automated migration paths and comprehensive backward compatibility support.

## Conclusion

Proxmox-MPC v1.0.0 prioritizes **user experience and compatibility** while introducing necessary modernization improvements. The minimal breaking changes are offset by:

1. **Automated Migration**: All changes have automatic migration tools
2. **Backward Compatibility**: Transition period support for legacy formats
3. **Clear Documentation**: Comprehensive upgrade guides and procedures
4. **Rollback Options**: Safe rollback procedures if issues arise
5. **Community Support**: Active support for migration assistance

The upgrade to v1.0.0 represents a **low-risk, high-value** modernization that sets the foundation for future enhancements while respecting existing user investments and workflows.
