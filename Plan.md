# Proxmox-MPC Project Plan

## Project Vision

Build a **Kubernetes/Helm-style declarative management system for Proxmox** that enables:
- **Infrastructure as Code** using YAML configurations
- **Declarative resource management** with automatic reconciliation  
- **Template-based deployments** similar to Helm charts
- **GitOps workflows** for infrastructure management
- **Continuous state synchronization** and drift detection

## System Components

1. **CLI Tool** - Kubernetes-style command interface (`kubectl` equivalent)
2. **Configuration Engine** - YAML parsing and validation system  
3. **Reconciliation Engine** - Continuous state synchronization (Kubernetes controller equivalent)
4. **Template System** - Helm-style chart-based deployments
5. **Web Dashboard** - Visual interface for declarative management
6. **MCP Integration** - AI-powered natural language operations

The system maintains complete Proxmox server state in a database and provides continuous reconciliation between desired state (YAML configs) and actual infrastructure state.

## Architecture Components

### Core Components
- **✅ Proxmox API Client**: Complete interface with Proxmox VE API (25% coverage)
- **✅ Database Layer**: Stores configuration, state, and history with change tracking
- **✅ State Discovery**: Real-time cluster resource monitoring and discovery
- **🚧 Resource Management**: VM/Container lifecycle operations (CRUD)
- **⏳ Configuration Engine**: YAML/JSON declarative config parsing and validation
- **⏳ Reconciliation Engine**: Continuous desired vs actual state synchronization
- **⏳ Template System**: Helm-style chart-based deployments with values

### Target Interface (Kubernetes/Helm Style)
```bash
# Resource management (kubectl-style)
proxmox-cli get vms                    # List all VMs
proxmox-cli apply -f infrastructure.yaml  # Apply declarative config
proxmox-cli diff -f infrastructure.yaml   # Show configuration diff
proxmox-cli delete vm web-server          # Delete specific resource

# Template management (helm-style)  
proxmox-cli install my-app ./charts/web-app  # Deploy chart
proxmox-cli upgrade my-app ./charts/web-app  # Update deployment
proxmox-cli rollback my-app 1                # Rollback to previous version
```

## Implementation Phases

**Target**: Full Kubernetes/Helm parity for declarative Proxmox management
**Timeline**: 5-7 months for complete implementation
**Analysis**: See [Declarative Management Analysis](docs/declarative-management-analysis.md)

## Phase 1: Foundation & Core Infrastructure ✅ COMPLETED

### 1.1 Project Setup ✅ COMPLETED
- [x] Initialize git repository with comprehensive structure
- [x] TypeScript/Node.js development environment
- [x] Technology stack: Prisma, Jest, Commander.js
- [x] Basic testing framework and CI/CD foundation

### 1.2 Basic Proxmox Connection ✅ COMPLETED
- [x] Complete Proxmox VE API client implementation
- [x] Token-based authentication with SSL handling
- [x] Connection testing and error handling
- [x] CLI foundation with test-connection and list-nodes
- [x] Comprehensive testing (24 tests, 81% coverage)

**🎉 Achievement**: Solid foundation with live Proxmox server validation

## Phase 2: State Management Infrastructure ✅ COMPLETED

### 2.1 Database Design ✅ COMPLETED
- [x] Complete database schema for all Proxmox resources
- [x] Repository pattern with type-safe CRUD operations  
- [x] State tracking with historical change detection
- [x] Factory pattern with dependency injection
- [x] Comprehensive validation and error handling

### 2.2 Resource Discovery ✅ COMPLETED
- [x] 12 new Proxmox API discovery endpoints
- [x] VM, Container, Storage, and Task monitoring
- [x] 5 professional CLI discovery commands
- [x] Real-time cluster resource visibility
- [x] 25% API coverage achieved

**🎉 Achievement**: Complete visibility into Proxmox infrastructure (kubectl get equivalent)

## Phase 2.3: Resource Management 🚧 NEXT PRIORITY (4-6 weeks)

**Goal**: Enable programmatic VM/Container lifecycle management
**Target**: 45% API coverage, kubectl create/delete equivalent functionality

### 2.3.1 VM Lifecycle Operations (2-3 weeks)
- [ ] VM Creation API (`POST /nodes/{node}/qemu`)
- [ ] VM Start/Stop/Restart (`POST /nodes/{node}/qemu/{vmid}/status/*`)
- [ ] VM Configuration Updates (`PUT /nodes/{node}/qemu/{vmid}/config`)
- [ ] VM Deletion with safety checks (`DELETE /nodes/{node}/qemu/{vmid}`)
- [ ] Enhanced CLI commands: `vm create`, `vm start`, `vm stop`, `vm delete`

### 2.3.2 Container Lifecycle Operations (2-3 weeks)  
- [ ] Container Creation API (`POST /nodes/{node}/lxc`)
- [ ] Container Start/Stop/Restart (`POST /nodes/{node}/lxc/{vmid}/status/*`)
- [ ] Container Configuration Updates (`PUT /nodes/{node}/lxc/{vmid}/config`)
- [ ] Container Deletion with safety checks (`DELETE /nodes/{node}/lxc/{vmid}`)
- [ ] Enhanced CLI commands: `container create`, `container start`, `container stop`

### 2.3.3 Management Infrastructure (1-2 weeks)
- [ ] Task monitoring for all management operations
- [ ] Confirmation prompts for destructive operations
- [ ] Comprehensive error handling and recovery
- [ ] Integration testing for all lifecycle operations

**Deliverable**: Can create, start, stop, and delete VMs/containers programmatically

## Phase 3: CLI Enhancement 🚧 PARTIALLY COMPLETE (2-3 weeks)

**Goal**: Professional kubectl-style interface with comprehensive resource management

### 3.1 Enhanced Command Structure ✅ PARTIALLY COMPLETE
- [x] Discovery commands (discover-all, discover-vms, etc.)
- [ ] Management commands (create, start, stop, delete)
- [ ] Configuration file handling (`-f config.yaml`)
- [ ] Resource filtering and selection (`--selector`, `--field-selector`)

### 3.2 Advanced CLI Features
- [ ] Output formatting (JSON, YAML, table formats)
- [ ] Interactive prompts and confirmations
- [ ] Batch operations and bulk management
- [ ] Progress indicators for long-running operations

**Deliverable**: Production-ready CLI matching kubectl usability

## Phase 4: Declarative Configuration System ⏳ CRITICAL (6-8 weeks)

**Goal**: YAML-based infrastructure as code with validation
**Target**: Core declarative management functionality

### 4.1 Configuration Engine (3-4 weeks)
```yaml
# Target configuration format
apiVersion: proxmox.io/v1
kind: VirtualMachine
metadata:
  name: web-server
  namespace: production
spec:
  node: pve-node1
  cpu: { cores: 4, sockets: 1 }
  memory: 8192
  disks: [{ storage: local-lvm, size: 50G }]
  template: debian-12-template
```

- [ ] YAML/JSON configuration parser and validator
- [ ] Resource specification schemas (VM, Container, Storage)
- [ ] Configuration file validation and error reporting
- [ ] Multi-resource file support

### 4.2 Apply/Delete Operations (2-3 weeks)
- [ ] `proxmox-cli apply -f infrastructure.yaml` - Create/update resources
- [ ] `proxmox-cli delete -f infrastructure.yaml` - Remove resources  
- [ ] `proxmox-cli get -f infrastructure.yaml` - Show current state
- [ ] Dry-run mode for testing configurations

### 4.3 State Diffing (1-2 weeks)
- [ ] `proxmox-cli diff -f infrastructure.yaml` - Show configuration changes
- [ ] `proxmox-cli validate -f infrastructure.yaml` - Validate without applying
- [ ] `proxmox-cli plan -f infrastructure.yaml` - Show execution plan

**Deliverable**: Can manage infrastructure using YAML configurations

## Phase 4.2: State Reconciliation Engine ⏳ CRITICAL (4-6 weeks)

**Goal**: Continuous state synchronization and drift detection
**Target**: Kubernetes controller equivalent functionality

### 4.2.1 Reconciliation Core (2-3 weeks)
```typescript
class ReconciliationEngine {
  async reconcile(configPath: string): Promise<ReconciliationResult>
  async startReconciliationLoop(): Promise<void>
  async detectDrift(): Promise<DriftReport>
}
```

- [ ] State comparison and diff calculation engine
- [ ] Change execution planning with dependency resolution
- [ ] Reconciliation result reporting and logging
- [ ] Error recovery and rollback mechanisms

### 4.2.2 Continuous Sync (2-3 weeks)
- [ ] Background reconciliation daemon
- [ ] Drift detection and alerting system
- [ ] Automatic correction capabilities  
- [ ] Conflict resolution strategies
- [ ] Health checking and validation

**Deliverable**: Infrastructure automatically maintained in desired state

## Phase 5: Template System (Helm Parity) ⏳ ADVANCED (6-8 weeks)

**Goal**: Chart-based deployments with templating and values
**Target**: Full Helm equivalent functionality

### 5.1 Template Engine (3-4 weeks)
```yaml
# templates/vm.yaml
apiVersion: proxmox.io/v1
kind: VirtualMachine
metadata:
  name: {{ .Values.name }}
spec:
  cpu: { cores: {{ .Values.resources.cpu }} }
  memory: {{ .Values.resources.memory }}
```

- [ ] Helm-compatible template syntax and functions
- [ ] Values file processing and override support
- [ ] Conditional logic, loops, and template functions
- [ ] Template validation and debugging tools

### 5.2 Chart Management (2-3 weeks)
```bash
proxmox-cli create my-chart
proxmox-cli install my-app ./charts/web-app
proxmox-cli upgrade my-app ./charts/web-app
proxmox-cli rollback my-app 1
```

- [ ] Chart creation and scaffolding
- [ ] Chart packaging and versioning
- [ ] Release management with history
- [ ] Rollback and recovery capabilities

### 5.3 Repository System (1-2 weeks)
- [ ] Chart repository management
- [ ] Dependency resolution between charts
- [ ] Chart testing and validation framework
- [ ] Documentation and best practices

**Deliverable**: Full Helm-style template-based deployments

## Phase 6: Web Dashboard ⏳ FUTURE (6-8 weeks)

**Goal**: Visual interface for declarative management

### 6.1 Backend API
- [ ] REST API for all CLI operations
- [ ] WebSocket support for real-time updates
- [ ] Authentication and authorization
- [ ] API documentation and testing

### 6.2 React Frontend
- [ ] Resource visualization and management
- [ ] Configuration editor with validation
- [ ] Template/chart management interface
- [ ] Real-time monitoring dashboard

**Deliverable**: Web-based declarative management interface

## Phase 7: MCP Integration ⏳ FUTURE (4-6 weeks)

**Goal**: AI-powered natural language operations

### 7.1 MCP Server Implementation
- [ ] Natural language to configuration translation
- [ ] AI-powered troubleshooting and optimization
- [ ] Context-aware resource recommendations
- [ ] Automated documentation generation

**Deliverable**: AI-enhanced infrastructure management

## Technology Stack Decisions

### Backend
- **Language**: Node.js/TypeScript (for consistency across components)
- **Database**: SQLite (development) / PostgreSQL (production)
- **API Framework**: Express.js or Fastify
- **ORM**: Prisma or TypeORM

### Frontend
- **Framework**: React with TypeScript
- **UI Library**: Material-UI or Ant Design
- **State Management**: Redux Toolkit or Zustand
- **Build Tool**: Vite

### CLI
- **Framework**: Commander.js
- **Configuration**: Cosmiconfig
- **Validation**: Joi or Yup

### MCP
- **Protocol**: Official MCP SDK
- **Transport**: stdio or HTTP

## Testing Strategy

### Unit Testing
- All core business logic
- API client functions
- State management operations
- Configuration parsing

### Integration Testing
- Database operations
- Proxmox API interactions
- CLI command execution
- Web API endpoints

### End-to-End Testing
- Complete workflows
- Multi-component interactions
- Real Proxmox environment testing

## Next Steps

1. **Choose and set up technology stack**
2. **Create basic project structure**
3. **Implement Proxmox API client**
4. **Set up database with basic schema**
5. **Build minimal CLI with connection testing**

## Success Metrics (Kubernetes/Helm Parity Goals)

### ✅ Foundation Milestones (COMPLETED)
- [x] **Successfully connect to Proxmox server** - Basic API connectivity ✅
- [x] **Complete resource discovery** - kubectl get equivalent functionality ✅  
- [x] **State tracking and history** - Database foundation with change detection ✅

### 🚧 Declarative Management Milestones (IN PROGRESS)
- [ ] **Resource lifecycle management** - kubectl create/delete equivalent (Phase 2.3)
- [ ] **Declarative configuration** - kubectl apply -f config.yaml (Phase 4.1)
- [ ] **State reconciliation** - Kubernetes controller equivalent (Phase 4.2)
- [ ] **Template-based deployments** - Helm install/upgrade equivalent (Phase 5)

### ⏳ Advanced Milestones (FUTURE)
- [ ] **Web dashboard for declarative management** - Visual kubectl/Helm interface (Phase 6)
- [ ] **AI-powered infrastructure management** - Natural language operations (Phase 7)

### 📊 **Current Progress Assessment**
- **Foundation Complete**: 3/3 milestones (100%) ✅
- **Declarative Management**: 0/4 milestones (0%) 🚧
- **Advanced Features**: 0/2 milestones (0%) ⏳
- **Overall Kubernetes/Helm Parity**: 3/9 milestones (33%)

### 🎯 **Next Critical Milestone**
**Phase 2.3: Resource Management** - Enable programmatic VM/Container CRUD operations
- Target: Complete kubectl create/delete equivalent functionality
- Timeline: 4-6 weeks
- Impact: Unlocks path to declarative configuration system

---

## Development Guidelines

- **Incremental Development**: Each phase should produce working, testable functionality
- **Test-Driven**: Write tests before or alongside implementation
- **Documentation**: Keep documentation updated with each phase
- **Version Control**: Tag releases at each major phase completion
- **Feedback Loop**: Test each component thoroughly before moving to next phase