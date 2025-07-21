# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Proxmox-MPC is a comprehensive management system for Proxmox Virtual Environment (PVE) with three main components:

1. **Console Tool (CLI)** - Command-line interface for direct server management
2. **Web Application** - React-based browser interface for visual management  
3. **Model Context Protocol (MCP) Server** - AI integration for natural language interactions

The system maintains complete Proxmox server state in a database and provides Kubernetes/Helm-style declarative configuration management with automatic reconciliation.

## Current Implementation Status

### ✅ Phase 1: Foundation & Core Infrastructure (COMPLETED)
- **1.1 Project Setup**: Complete TypeScript/Node.js project with Jest testing
- **1.2 Basic Proxmox Connection**: Working API client with authentication and CLI commands

**Available CLI Commands:**
- `npm run cli test-connection [-v]` - Test Proxmox API connectivity
- `npm run cli list-nodes [-v]` - List cluster nodes with resource usage

### 🚧 Phase 2: Database & State Management (PLANNING)
- **2.1 Database Design**: Comprehensive schema planned (see docs/phase-2.1-implementation.md)
- **2.2 State Synchronization**: Planned for resource discovery and comparison

## Architecture

### Core Components
- **✅ Proxmox API Client**: Full-featured client with token auth and SSL handling
- **🚧 Database Layer**: Prisma ORM with SQLite (dev) / PostgreSQL (prod) - planned
- **⏳ State Engine**: Maintains desired vs actual state reconciliation - future
- **⏳ Configuration Parser**: Handles YAML/JSON declarative configs - future
- **⏳ Natural Language Processor**: Translates human commands to API calls - future

### Multi-Interface Design
The system will expose core functionality through three interfaces:
- **✅ CLI Tool**: Basic commands implemented (test-connection, list-nodes)
- **⏳ Web UI**: Dashboard and visual management interface - future
- **⏳ MCP Server**: Protocol server enabling AI model integration - future
- **⏳ REST API**: Backend API that serves all interfaces - future

## Technology Stack

- **Backend**: Node.js/TypeScript with Express.js (chosen)
- **Database**: Prisma ORM with SQLite (development) / PostgreSQL (production)
- **Testing**: Jest with 81% code coverage achieved
- **CLI**: Commander.js framework implemented
- **Frontend**: React with TypeScript, Material-UI, Vite (planned)
- **MCP**: Official MCP SDK with stdio or HTTP transport (planned)

## Development Process

This project follows an 8-phase incremental development approach where each phase produces working, testable functionality. Current status is tracked in Plan.md with checkboxes.

**Development Guidelines:**
- Create detailed implementation plans before coding (see docs/phase-*.md)
- Update Plan.md and CLAUDE.md with each phase completion
- Commit frequently with descriptive messages
- Maintain >80% test coverage
- Test manually with real Proxmox server before phase completion

### Current Phase: Database Design (Phase 2.1)
Focus on creating database schema for Proxmox resources with Prisma ORM.

**Next Implementation Steps:**
1. Install and configure Prisma with SQLite
2. Create schema for nodes, VMs, containers, storage, tasks
3. Implement repository pattern with CRUD operations
4. Add comprehensive testing

## Project Structure

```
src/
├── api/              # Proxmox API client (✅ implemented)
│   ├── proxmox-client.ts
│   ├── config.ts
│   └── __tests__/
├── cli/              # Command-line interface (✅ basic commands)
│   └── index.ts
├── database/         # Database layer (🚧 planned)
├── types/            # TypeScript definitions (✅ basic types)
└── utils/            # Utility functions

docs/                 # Implementation plans and API research
├── proxmox-api-research.md      # ✅ Complete API documentation
├── phase-1.2-implementation.md  # ✅ Phase 1.2 completed
└── phase-2.1-implementation.md  # ✅ Phase 2.1 planning
```

## State Management Concept

The system will work like Helm/Kubernetes by:
1. Reading declarative configuration files (YAML/JSON)
2. Comparing desired state vs actual Proxmox server state
3. Automatically reconciling differences through API calls
4. Maintaining complete state history and audit trails

## Prerequisites

- Proxmox VE server access with API tokens
- Node.js development environment
- Database setup (SQLite for local development)

## Configuration

The system expects:
- `.env` file with Proxmox server connection details (see .env.example)
- Configuration files defining desired infrastructure state (future)
- Database connection configuration

## Testing

- **Unit Tests**: 24 tests with 81% coverage
- **Manual Testing**: Tested with real Proxmox server (192.168.0.19)
- **CLI Testing**: All commands work with verbose output options