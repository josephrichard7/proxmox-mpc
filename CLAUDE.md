# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Proxmox-MPC is a comprehensive management system for Proxmox Virtual Environment (PVE) with three main components:

1. **Console Tool (CLI)** - Command-line interface for direct server management
2. **Web Application** - React-based browser interface for visual management  
3. **Model Context Protocol (MCP) Server** - AI integration for natural language interactions

The system maintains complete Proxmox server state in a database and provides Kubernetes/Helm-style declarative configuration management with automatic reconciliation.

## Architecture

### Core Components
- **State Engine**: Maintains desired vs actual state reconciliation (like Kubernetes controllers)
- **Proxmox API Client**: Interfaces with Proxmox VE REST API
- **Database Layer**: Stores configuration, state, and history (SQLite for dev, PostgreSQL for prod)
- **Configuration Parser**: Handles YAML/JSON declarative configs
- **Natural Language Processor**: Translates human commands to API calls

### Multi-Interface Design
The system exposes the same core functionality through three interfaces:
- **CLI Tool**: Direct command-line access for power users
- **Web UI**: Dashboard and visual management interface
- **MCP Server**: Protocol server enabling AI model integration
- **REST API**: Backend API that serves all interfaces

## Technology Stack

- **Backend**: Node.js/TypeScript with Express.js or Fastify
- **Database**: SQLite (development) / PostgreSQL (production) with Prisma or TypeORM
- **Frontend**: React with TypeScript, Material-UI or Ant Design, Vite build tool
- **CLI**: Commander.js framework with Cosmiconfig for configuration
- **MCP**: Official MCP SDK with stdio or HTTP transport

## Development Process

This project follows an 8-phase incremental development approach where each phase produces working, testable functionality. Current status is tracked in Plan.md with checkboxes.

### Current Phase: Foundation & Core Infrastructure
Focus on basic Proxmox API connectivity and project structure setup.

## State Management Concept

The system works like Helm/Kubernetes by:
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
- `.env` file with Proxmox server connection details
- Configuration files defining desired infrastructure state
- Database connection configuration