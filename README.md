# proxmox-mpc

A console tool, web application, and Model Context Protocol (MCP) server to help manage and create resources in Proxmox home lab servers with natural language interaction and declarative state management.

## Description

This application provides a comprehensive solution for managing Proxmox Virtual Environment (PVE) infrastructure through multiple interfaces:

- **Console Tool**: CLI for direct server management
- **Web Application**: Browser-based interface for visual management  
- **MCP Server**: Model Context Protocol integration for AI-powered interactions
- **State Management**: Kubernetes/Helm-style declarative configuration management
- **Natural Language**: Interact with your Proxmox server using natural language commands

The system maintains the full state of the Proxmox server in a database and works like Helm and Kubernetes, continuously reconciling the actual infrastructure state with the desired state defined in configuration files.

## Features

- 🖥️ Multi-interface support (CLI, Web, MCP)
- 🗣️ Natural language interaction with Proxmox resources
- 📊 Complete state synchronization and management
- 🔄 Declarative configuration with automatic reconciliation
- 🏠 Designed for home lab environments
- 📈 Resource monitoring and management

## Current Status

**🚧 Active Development** - Phase 2.1 (Database Design) in progress

### ✅ Working Features
- **Proxmox API Connection**: Test connectivity to your Proxmox server
- **Node Management**: List cluster nodes with resource usage
- **CLI Interface**: Command-line tools with verbose output options

### 🧪 Tested Configuration
- **Proxmox VE**: 8.4.1 (successfully tested)
- **Authentication**: API token authentication
- **SSL**: Self-signed certificate handling for homelab environments

## Getting Started

### Prerequisites

- Proxmox VE server with API token access
- Node.js 18+ (for development)
- Git for cloning the repository

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/josephrichard7/proxmox-mpc.git
   cd proxmox-mpc
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure Proxmox connection:
   ```bash
   cp .env.example .env
   # Edit .env with your Proxmox server details:
   # - PROXMOX_HOST (your server IP/domain)
   # - PROXMOX_USERNAME (e.g., root@pam)
   # - PROXMOX_TOKEN_ID (create in Proxmox UI)
   # - PROXMOX_TOKEN_SECRET (from Proxmox token creation)
   # - PROXMOX_NODE (your node name)
   ```

### Usage

#### Available CLI Commands

```bash
# Test connection to your Proxmox server
npm run cli test-connection

# Test connection with detailed output
npm run cli test-connection -v

# List cluster nodes with resource usage
npm run cli list-nodes

# List nodes with detailed information
npm run cli list-nodes -v

# Run all tests
npm test

# Check TypeScript compilation
npm run typecheck
```

### API Token Setup

1. Login to your Proxmox web interface
2. Navigate to: **Datacenter → Permissions → API Tokens**
3. Click **Add** to create a new token:
   - **User**: `root@pam` (or your preferred user)
   - **Token ID**: `proxmox-mpc` (or any name)
   - **Privilege Separation**: Uncheck for testing
4. Copy the generated secret and update your `.env` file

### Documentation

- **[Project Plan](Plan.md)**: Complete 8-phase development roadmap
- **[Progress Tracking](docs/PROGRESS.md)**: Current status and achievements
- **[API Research](docs/proxmox-api-research.md)**: Comprehensive Proxmox API documentation
- **[Implementation Plans](docs/)**: Detailed plans for each development phase

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.