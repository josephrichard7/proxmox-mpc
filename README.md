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

## Getting Started

### Prerequisites

- Proxmox VE server access
- Node.js (for development)
- Database (SQLite/PostgreSQL)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/$(gh api user --jq .login)/proxmox-mpc.git
   cd proxmox-mpc
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure Proxmox connection:
   ```bash
   cp .env.example .env
   # Edit .env with your Proxmox server details
   ```

### Usage

See [Plan.md](Plan.md) for detailed implementation roadmap and usage instructions.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.