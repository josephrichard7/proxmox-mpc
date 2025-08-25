# Phase 2.3: Resource Management Implementation Plan

## 🎯 **Overview**

**Goal**: Enable programmatic VM/Container lifecycle management (kubectl create/delete equivalent)
**Priority**: CRITICAL - Required for declarative management system
**Timeline**: 4-6 weeks
**Target API Coverage**: 45% (up from current 25%)

This phase transforms our tool from read-only monitoring to full resource management, enabling the foundation for declarative configuration management.

## 📋 **Current Status Assessment**

### ✅ **Foundation Ready (Phase 2.2 Complete)**
- Complete resource discovery across VMs, containers, storage, tasks
- 25% Proxmox API coverage with comprehensive monitoring
- Professional CLI interface with 5 discovery commands
- Robust database infrastructure with state tracking
- Live validation with production Proxmox servers

### ❌ **Critical Missing Capabilities**
- **Cannot create VMs or containers** - No programmatic resource creation
- **Cannot manage lifecycle** - No start/stop/restart operations
- **Cannot modify configurations** - No resource updates
- **Cannot delete resources** - No cleanup capabilities
- **No management CLI commands** - Only monitoring commands exist

### 🎯 **Phase 2.3 Success Criteria**
- [ ] Can create VMs and containers programmatically via API and CLI
- [ ] Can start, stop, restart VMs and containers with proper error handling
- [ ] Can modify VM/container configurations safely
- [ ] Can delete resources with confirmation and safety checks
- [ ] All operations properly tracked in database with task monitoring
- [ ] Comprehensive CLI interface matching kubectl usability patterns
- [ ] 45% Proxmox API coverage achieved
- [ ] Foundation ready for declarative configuration system (Phase 4)

## 🗓️ **Detailed Implementation Schedule**

### **Week 1-2: VM Lifecycle Operations**

#### **Day 1-3: VM Creation API**
**Target Endpoint**: `POST /nodes/{node}/qemu`

**Implementation Tasks**:
```typescript
// New ProxmoxClient methods
async createVM(node: string, config: VMCreateConfig): Promise<VMCreationResult>
async waitForVMCreation(node: string, vmid: number): Promise<VMInfo>
```

**VM Creation Configuration**:
```typescript
interface VMCreateConfig {
  vmid: number;
  name?: string;
  cores?: number;
  sockets?: number;
  memory?: number;           // MB
  ostype?: string;          // l26, win10, etc.
  ide0?: string;            // Boot disk configuration
  net0?: string;            // Network configuration
  template?: string;        // Clone from template
  storage?: string;         // Default storage pool
  start?: boolean;          // Start after creation
}
```

**CLI Command**:
```bash
# Basic VM creation
npm run cli vm create --vmid 150 --name web-server --cores 4 --memory 8192

# Template-based creation
npm run cli vm create --vmid 151 --template debian-12 --name app-server

# From configuration file
npm run cli vm create -f vm-config.json
```

#### **Day 4-7: VM Start/Stop/Restart Operations**
**Target Endpoints**:
- `POST /nodes/{node}/qemu/{vmid}/status/start`
- `POST /nodes/{node}/qemu/{vmid}/status/stop`
- `POST /nodes/{node}/qemu/{vmid}/status/shutdown`
- `POST /nodes/{node}/qemu/{vmid}/status/reboot`

**Implementation Tasks**:
```typescript
// New ProxmoxClient methods
async startVM(node: string, vmid: number): Promise<TaskInfo>
async stopVM(node: string, vmid: number, force?: boolean): Promise<TaskInfo>
async shutdownVM(node: string, vmid: number): Promise<TaskInfo>
async rebootVM(node: string, vmid: number): Promise<TaskInfo>
async waitForVMStatus(node: string, vmid: number, targetStatus: string): Promise<VMInfo>
```

**CLI Commands**:
```bash
# VM lifecycle management
npm run cli vm start 150
npm run cli vm stop 150
npm run cli vm shutdown 150 --graceful
npm run cli vm restart 150

# Bulk operations
npm run cli vm start 150,151,152
npm run cli vm stop --all --confirm
```

#### **Day 8-10: VM Configuration Updates**
**Target Endpoint**: `PUT /nodes/{node}/qemu/{vmid}/config`

**Implementation Tasks**:
```typescript
// New ProxmoxClient methods
async updateVMConfig(node: string, vmid: number, updates: VMConfigUpdate): Promise<TaskInfo>
async getVMConfigDiff(node: string, vmid: number, newConfig: VMConfigUpdate): Promise<ConfigDiff>
```

**CLI Commands**:
```bash
# Configuration updates
npm run cli vm update 150 --cores 8 --memory 16384
npm run cli vm update 150 -f updated-config.json --dry-run
```

#### **Day 11-14: VM Deletion**
**Target Endpoint**: `DELETE /nodes/{node}/qemu/{vmid}`

**Implementation Tasks**:
```typescript
// New ProxmoxClient methods
async deleteVM(node: string, vmid: number, options?: VMDeleteOptions): Promise<TaskInfo>
```

**CLI Commands**:
```bash
# VM deletion with safety checks
npm run cli vm delete 150 --confirm
npm run cli vm delete 150 --force --purge-disks
```

**Safety Features**:
- Confirmation prompts for destructive operations
- Check if VM is running (require stop first)
- Backup configurations before deletion
- Disk cleanup options

### **Week 3-4: Container Lifecycle Operations**

#### **Day 15-17: Container Creation API**
**Target Endpoint**: `POST /nodes/{node}/lxc`

**Implementation Tasks**:
```typescript
// New ProxmoxClient methods
async createContainer(node: string, config: ContainerCreateConfig): Promise<ContainerCreationResult>
```

**Container Creation Configuration**:
```typescript
interface ContainerCreateConfig {
  vmid: number;
  hostname?: string;
  cores?: number;
  memory?: number;           // MB
  swap?: number;             // MB
  ostemplate: string;        // Required: template to use
  rootfs?: string;           // Root filesystem config
  net0?: string;             // Network configuration
  storage?: string;          // Default storage pool
  unprivileged?: boolean;    // Security setting
  start?: boolean;           // Start after creation
}
```

**CLI Commands**:
```bash
# Container creation
npm run cli container create --vmid 250 --hostname web-ct --cores 2 --memory 4096 --template debian-12

# From template
npm run cli container create --vmid 251 --template ubuntu-22.04 --rootfs local-lvm:8
```

#### **Day 18-21: Container Start/Stop/Restart Operations**
**Target Endpoints**:
- `POST /nodes/{node}/lxc/{vmid}/status/start`
- `POST /nodes/{node}/lxc/{vmid}/status/stop`
- `POST /nodes/{node}/lxc/{vmid}/status/shutdown`
- `POST /nodes/{node}/lxc/{vmid}/status/reboot`

**CLI Commands**:
```bash
# Container lifecycle management
npm run cli container start 250
npm run cli container stop 250
npm run cli container restart 250
```

#### **Day 22-24: Container Configuration and Deletion**
**Target Endpoints**:
- `PUT /nodes/{node}/lxc/{vmid}/config`
- `DELETE /nodes/{node}/lxc/{vmid}`

**CLI Commands**:
```bash
# Container management
npm run cli container update 250 --memory 8192
npm run cli container delete 250 --confirm
```

### **Week 5-6: Management Infrastructure & Testing**

#### **Day 25-28: Task Monitoring Integration**
**Enhanced Task Tracking**:
```typescript
interface ManagementTask {
  operation: 'create' | 'start' | 'stop' | 'update' | 'delete';
  resourceType: 'vm' | 'container';
  resourceId: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress?: number;
  logs: string[];
}
```

**CLI Features**:
```bash
# Task monitoring
npm run cli task watch UPID:pve:00001234:12345678:qmcreate:150:root@pam:
npm run cli task logs UPID:pve:00001234:12345678:qmcreate:150:root@pam:
```

#### **Day 29-32: Safety and Confirmation Systems**
**Confirmation Prompts**:
```bash
# Destructive operations require confirmation
$ npm run cli vm delete 150
⚠️  WARNING: This will permanently delete VM 150 (web-server)
   • Status: running (will be stopped first)
   • Disks: 50GB on local-lvm will be removed
   • This action cannot be undone

Are you sure you want to delete VM 150? (yes/no): yes
```

**Safety Checks**:
- Verify resource exists before operations
- Check dependencies (running status, snapshots, etc.)
- Validate node capacity for creation operations
- Backup configurations before destructive changes

#### **Day 33-35: Enhanced CLI Interface**
**Professional CLI Features**:
```bash
# Resource selection and filtering
npm run cli vm list --status running
npm run cli vm list --node pve-node1 --template false

# Output formatting
npm run cli vm list --output json
npm run cli vm list --output yaml
npm run cli vm list --output table

# Batch operations
npm run cli vm start --selector "app=web,tier=frontend"
npm run cli vm stop --all --dry-run
```

#### **Day 36-42: Comprehensive Testing**
**Test Coverage Goals**:
- Integration tests for all CRUD operations
- Error handling and recovery scenarios
- Safety check validation
- CLI command parsing and validation
- Task monitoring and progress tracking
- Real Proxmox server validation

**Test Scenarios**:
```typescript
describe('VM Lifecycle Management', () => {
  it('should create VM with proper configuration')
  it('should handle creation failures gracefully')
  it('should start/stop VMs with task monitoring')
  it('should update configuration safely')
  it('should delete VMs with confirmation')
  it('should handle concurrent operations')
})
```

## 🎯 **API Endpoints Implementation Matrix**

### **VM Management APIs**
| Endpoint | Method | Purpose | Priority | Status |
|----------|--------|---------|----------|--------|
| `/nodes/{node}/qemu` | POST | Create VM | Critical | ❌ TODO |
| `/nodes/{node}/qemu/{vmid}/status/start` | POST | Start VM | Critical | ❌ TODO |
| `/nodes/{node}/qemu/{vmid}/status/stop` | POST | Stop VM | Critical | ❌ TODO |
| `/nodes/{node}/qemu/{vmid}/status/shutdown` | POST | Graceful shutdown | High | ❌ TODO |
| `/nodes/{node}/qemu/{vmid}/status/reboot` | POST | Restart VM | High | ❌ TODO |
| `/nodes/{node}/qemu/{vmid}/config` | PUT | Update config | High | ❌ TODO |
| `/nodes/{node}/qemu/{vmid}` | DELETE | Delete VM | High | ❌ TODO |
| `/nodes/{node}/qemu/{vmid}/clone` | POST | Clone VM | Medium | ⏳ Future |

### **Container Management APIs**
| Endpoint | Method | Purpose | Priority | Status |
|----------|--------|---------|----------|--------|
| `/nodes/{node}/lxc` | POST | Create container | Critical | ❌ TODO |
| `/nodes/{node}/lxc/{vmid}/status/start` | POST | Start container | Critical | ❌ TODO |
| `/nodes/{node}/lxc/{vmid}/status/stop` | POST | Stop container | Critical | ❌ TODO |
| `/nodes/{node}/lxc/{vmid}/status/shutdown` | POST | Graceful shutdown | High | ❌ TODO |
| `/nodes/{node}/lxc/{vmid}/status/reboot` | POST | Restart container | High | ❌ TODO |
| `/nodes/{node}/lxc/{vmid}/config` | PUT | Update config | High | ❌ TODO |
| `/nodes/{node}/lxc/{vmid}` | DELETE | Delete container | High | ❌ TODO |

## 🔧 **Technical Implementation Details**

### **Error Handling Strategy**
```typescript
class ProxmoxManagementError extends Error {
  constructor(
    public operation: string,
    public resourceType: string,
    public resourceId: number,
    public proxmoxError: any,
    public context?: any
  ) {
    super(`${operation} failed for ${resourceType} ${resourceId}: ${proxmoxError.message}`);
  }
}
```

### **Configuration Validation**
```typescript
interface VMConfigValidator {
  validateCreateConfig(config: VMCreateConfig): ValidationResult;
  validateUpdateConfig(current: VMConfig, updates: VMConfigUpdate): ValidationResult;
  validateNodeCapacity(node: string, requirements: ResourceRequirements): CapacityResult;
}
```

### **Task Progress Tracking**
```typescript
class TaskMonitor {
  async monitorTask(taskId: string): Promise<AsyncIterator<TaskProgress>>;
  async waitForCompletion(taskId: string, timeout?: number): Promise<TaskResult>;
  async cancelTask(taskId: string): Promise<boolean>;
}
```

## 📊 **Success Metrics**

### **API Coverage Targets**
- **Current Coverage**: 25% (discovery only)
- **Target Coverage**: 45% (discovery + lifecycle management)
- **New Endpoints**: 14 critical management endpoints
- **Quality Goal**: All endpoints with comprehensive error handling

### **CLI Usability Targets**
- **Management Commands**: 20+ new commands (vm/container create/start/stop/delete)
- **Safety Features**: Confirmation prompts, dry-run mode, safety checks
- **Professional Output**: Progress indicators, formatted output, error messages
- **kubectl Similarity**: Familiar command patterns and option flags

### **Testing Targets**
- **Unit Tests**: 30+ new tests for all management operations
- **Integration Tests**: 15+ tests with real Proxmox server
- **Error Scenarios**: 20+ error handling and recovery tests
- **CLI Tests**: 25+ command parsing and validation tests

## 🚀 **Phase 2.3 Deliverables**

### **Core Functionality**
- [x] ✅ **Complete VM lifecycle management** - Create, start, stop, update, delete
- [x] ✅ **Complete container lifecycle management** - Create, start, stop, update, delete
- [x] ✅ **Professional CLI interface** - kubectl-style commands with safety features
- [x] ✅ **Task monitoring integration** - Real-time progress tracking for all operations
- [x] ✅ **Comprehensive error handling** - Graceful failure handling and recovery

### **Technical Quality**
- [x] ✅ **45% API coverage achieved** - Foundation for declarative management
- [x] ✅ **Production-ready code** - Type safety, validation, comprehensive testing
- [x] ✅ **Safety and confirmation systems** - Prevent accidental resource destruction
- [x] ✅ **Database integration** - All operations properly tracked and audited

### **Path to Declarative Management**
- [x] ✅ **Resource CRUD foundation** - Enables YAML-based resource management
- [x] ✅ **State change capabilities** - Enables reconciliation between desired and actual state
- [x] ✅ **Operation tracking** - Enables rollback and change history
- [x] ✅ **Configuration validation** - Foundation for declarative config schemas

## 🎉 **Phase 2.3 Completion Criteria**

**Phase 2.3 will be considered COMPLETE when:**

1. **✅ All 14 critical management endpoints implemented and tested**
2. **✅ Complete CLI interface with 20+ management commands**
3. **✅ Can create, start, stop, update, and delete VMs and containers**
4. **✅ All operations include task monitoring and progress tracking**
5. **✅ Safety systems prevent accidental resource destruction**
6. **✅ 45% Proxmox API coverage achieved with comprehensive testing**
7. **✅ Live validation with production Proxmox server successful**
8. **✅ Foundation ready for Phase 4 declarative configuration system**

**Timeline**: 4-6 weeks from start
**Success Measure**: Can manage Proxmox infrastructure programmatically via CLI (kubectl create/delete equivalent)
**Next Phase**: Phase 4 - Declarative Configuration System (YAML-based infrastructure management)

This phase transforms our monitoring tool into a full infrastructure management platform and unlocks the path to Kubernetes/Helm-style declarative configuration management.