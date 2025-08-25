# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Proxmox-MPC** is an **Interactive Infrastructure-as-Code Console** for Proxmox Virtual Environment, similar to Claude Code's experience. It provides a project-based workspace where infrastructure is managed through interactive commands and automatically generates Terraform/Ansible configurations.

### **Core Concept: Project-Based Infrastructure Console**

```bash
$ proxmox-mpc                    # Launch interactive console
proxmox-mpc> /init              # Initialize new project workspace  
proxmox-mpc> /sync              # Discover & sync existing infrastructure
proxmox-mpc> create vm --name web-01  # Generate IaC files for new resources
proxmox-mpc> /test              # Validate infrastructure changes
proxmox-mpc> /apply             # Deploy to Proxmox server
```

### **Key Features:**
1. **Interactive Console** - Claude Code-like experience with slash commands
2. **Project Workspaces** - Each directory becomes a Proxmox infrastructure project
3. **Automatic IaC Generation** - Creates Terraform + Ansible configs from existing infrastructure
4. **Test-Driven Infrastructure** - Generates and runs tests before deployment
5. **State Synchronization** - Bidirectional sync between server and local SQLite database
6. **Multi-Server Deployment** - Export configurations to replicate infrastructure

## Current Implementation Status

### ✅ Phase 1: Foundation & Core Infrastructure (COMPLETED)
- **1.1 Project Setup**: Complete TypeScript/Node.js project with Jest testing
- **1.2 Basic Proxmox Connection**: Working API client with authentication and CLI commands

**Available CLI Commands:**
- `npm run cli test-connection [-v]` - Test Proxmox API connectivity
- `npm run cli list-nodes [-v]` - List cluster nodes with resource usage

### ✅ Phase 2: Database & State Management (COMPLETED)
- **2.1 Database Design**: Comprehensive schema implemented with Prisma ORM ✅
- **2.2 State Synchronization**: Resource discovery and state tracking implemented ✅  
- **2.3 Resource Management**: VM/Container lifecycle operations implemented ✅

### ✅ Phase 4: Interactive Console Foundation (COMPLETED)
- **4.1 Interactive Console REPL**: Claude Code-like experience with readline interface ✅
- **4.2 Slash Command System**: Comprehensive command registry with help, init, status, exit ✅
- **4.3 Project Workspace Initialization**: Interactive `/init` command with proper input handling ✅
- **4.4 Global Installation**: Works from any directory like `claude` command ✅
- **4.5 Session Management**: Command history, workspace detection, graceful exit ✅

**Available Console Commands:**
- `proxmox-mpc` - Launch interactive console from any directory
- `/init` - Initialize new Proxmox project workspace with interactive setup
- `/help` - Show all available commands and usage
- `/status` - Display project and server connectivity status
- `/exit` - Exit console with session summary

## Architecture

### Core Components
- **✅ Proxmox API Client**: Full-featured client with token auth and SSL handling
- **✅ Database Layer**: Prisma ORM with SQLite (dev) / PostgreSQL (prod) implemented
- **✅ Resource Management**: Complete VM/Container lifecycle operations (CRUD)
- **🚧 Configuration Parser**: Handles YAML/JSON declarative configs - next priority
- **⏳ State Engine**: Maintains desired vs actual state reconciliation - future
- **⏳ Natural Language Processor**: Translates human commands to API calls - future

### Multi-Interface Design
The system will expose core functionality through three interfaces:
- **✅ CLI Tool**: Professional interface with 20+ commands (resource management complete)
- **✅ Interactive Console**: Claude Code-like REPL with project workspace management
- **⏳ Web UI**: Dashboard and visual management interface - future
- **⏳ MCP Server**: Protocol server enabling AI model integration - future
- **⏳ REST API**: Backend API that serves all interfaces - future

## Technology Stack

- **Backend**: Node.js/TypeScript with Express.js (chosen)
- **Database**: Prisma ORM with SQLite (development) / PostgreSQL (production)
- **Testing**: Jest with 93% test success rate (163/175 tests passing)
- **CLI**: Commander.js framework implemented
- **Frontend**: React with TypeScript, Material-UI, Vite (planned)
- **MCP**: Official MCP SDK with stdio or HTTP transport (planned)

## Development Process

This project follows a 9-phase incremental development approach where each phase produces working, testable functionality. Current status is tracked in PLAN.md with detailed progress indicators.

**Development Guidelines:**
- Create detailed implementation plans before coding (see docs/phase-*.md)
- Update Plan.md and CLAUDE.md with each phase completion
- Commit frequently with descriptive messages
- Maintain >80% test coverage
- Test manually with real Proxmox server before phase completion

### Current Focus: Final Implementation Tasks & Production Readiness (Phase 5.9)
With complete codebase cleanup achieved, focus is on completing final implementation tasks and preparing for observability phase.

**Recently Completed (Phase 5.5):**
1. ✅ Complete codebase cleanup (30/30 tasks completed - 5,000+ lines improved/removed)
2. ✅ Unified error handling and structured logging throughout entire system
3. ✅ Complete resource command system (create/list/describe VMs and containers)
4. ✅ End-to-end database synchronization from Proxmox servers to local SQLite
5. ✅ Professional logging architecture with correlation IDs and trace context
6. ✅ File organization cleanup and standardized import/export patterns
7. ✅ Observability consolidation with singleton pattern unification
8. ✅ Diagnostics system simplification and async/await standardization

**Final Implementation Tasks (Phase 5.9):**
1. Complete workspace database initialization with full Prisma client integration
2. Finish database synchronization implementation in sync command  
3. Complete resource command parsing with comprehensive validation and IaC generation
4. Enhance error handling and user-facing validation systems
5. Optimize observability system for Phase 6 integration

## Project Structure

### **Source Code Structure**
```
src/
├── api/              # Proxmox API client (✅ implemented)
├── console/          # Interactive console interface (✅ implemented)
├── generators/       # Terraform/Ansible code generators (⏳ planned)
├── workspace/        # Project workspace management (⏳ planned)
├── sync/             # State synchronization engine (⏳ planned)
├── database/         # Database layer (✅ implemented)
├── types/            # TypeScript definitions (✅ implemented)
└── utils/            # Utility functions (✅ implemented)
```

### **Generated Project Workspace Structure**
```
my-proxmox-project/          # User project directory
├── .proxmox/
│   ├── config.yml           # Server connection details
│   ├── state.db            # Local SQLite database
│   └── history/            # Infrastructure state snapshots
├── terraform/
│   ├── main.tf             # Generated main configuration
│   ├── nodes.tf            # Node resources
│   ├── vms/                # Individual VM configurations
│   └── containers/         # Individual container configurations
├── ansible/
│   ├── inventory.yml       # Generated inventory
│   ├── playbooks/          # Configuration playbooks
│   └── roles/              # Reusable roles
├── tests/
│   ├── infrastructure.test.js  # Generated infrastructure tests
│   └── integration/        # Integration test suites
└── docs/
    └── architecture.md     # Generated documentation
```

## Interactive Console Commands

### **Core Slash Commands**
- **`/init`** - Initialize new Proxmox project workspace with configuration wizard
- **`/sync`** - Bidirectional sync: server ↔ database ↔ IaC files
- **`/apply`** - Deploy Terraform/Ansible changes to Proxmox server
- **`/plan`** - Preview infrastructure changes before applying
- **`/test`** - Run generated infrastructure tests
- **`/status`** - Show project status, server health, and resource overview
- **`/diff`** - Compare local state vs server state
- **`/rollback <snapshot>`** - Revert to previous infrastructure state
- **`/export <target-dir>`** - Export configuration for deployment to other servers

### **Resource Management Commands**
- **`create vm --name <name> [options]`** - Generate VM Terraform/Ansible configs
- **`create container --name <name> [options]`** - Generate container configs  
- **`update vm <id> [options]`** - Modify existing VM configuration
- **`delete vm <id>`** - Remove VM from infrastructure (with safety prompts)
- **`list vms [filters]`** - Show VMs with status and configuration
- **`describe vm <id>`** - Detailed VM information and configuration

## Prerequisites

- Proxmox VE server access with API tokens
- Node.js development environment
- Database setup (SQLite for local development)

## Workflow Example

### **Typical Usage Flow**
```bash
# 1. Create new project directory
mkdir my-datacenter && cd my-datacenter

# 2. Launch interactive console
proxmox-mpc

# 3. Initialize project workspace
proxmox-mpc> /init
🏗️  Enter Proxmox server details...
✅ Project initialized!

# 4. Import existing infrastructure
proxmox-mpc> /sync
🔄 Discovered 12 VMs, 5 containers
🏗️  Generated terraform/ and ansible/ configurations
✅ Infrastructure imported as code!

# 5. Make changes
proxmox-mpc> create vm --name web-02 --cores 4 --memory 8192
📝 Generated terraform/vms/web-02.tf
📝 Generated ansible/playbooks/web-02.yml
🧪 Generated tests/vms/web-02.test.js

# 6. Test and deploy
proxmox-mpc> /test
🧪 All tests passed ✅

proxmox-mpc> /apply
🚀 Deploying changes...
✅ VM web-02 created successfully!

# 7. Keep in sync
proxmox-mpc> /sync
🔄 Updated local state database
```

## Testing

- **Unit Tests**: 163/175 tests passing (93% success rate)
- **Manual Testing**: Tested with real Proxmox server (192.168.0.19)
- **CLI Testing**: All 20+ management commands work with professional interface