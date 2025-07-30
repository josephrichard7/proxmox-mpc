# Proxmox-MPC: Interactive Infrastructure Console

**Proxmox-MPC** is an **Interactive Infrastructure-as-Code Console** for Proxmox Virtual Environment, providing a **Claude Code-like experience** for infrastructure operations. It transforms infrastructure management into a conversational, project-based workflow that automatically generates and maintains Infrastructure-as-Code.

## 🎯 Core Concept

```bash
$ proxmox-mpc                           # Launch interactive console
🔧 Proxmox Infrastructure Console v1.0.0
Welcome! Type /help for commands or /init to get started.

proxmox-mpc> /init                      # Initialize project workspace
🏗️  Enter Proxmox server details...
✅ Project initialized!

proxmox-mpc> /sync                      # Import existing infrastructure
🔄 Discovered 12 VMs, 5 containers
🏗️  Generated terraform/ and ansible/ configurations
✅ Infrastructure imported as code!

proxmox-mpc> create vm --name web-01 --cores 2 --memory 4096
📝 Generated terraform/vms/web-01.tf
📝 Generated ansible/playbooks/web-01.yml
🧪 Generated tests/vms/web-01.test.js
✅ Ready to apply!

proxmox-mpc> /test                      # Validate changes
🧪 All tests passed ✅

proxmox-mpc> /apply                     # Deploy to server
🚀 Applying changes...
✅ VM web-01 created successfully!
```

## ✨ Key Features

- **🎮 Interactive Console** - Claude Code-like experience with slash commands
- **📁 Project Workspaces** - Each directory becomes a Proxmox infrastructure project
- **🏗️ Automatic IaC Generation** - Creates Terraform + Ansible configs from existing infrastructure
- **🧪 Test-Driven Infrastructure** - Generates and runs tests before deployment
- **🔄 State Synchronization** - Bidirectional sync between server and local SQLite database
- **🌍 Multi-Server Deployment** - Export configurations to replicate infrastructure

## 🚀 Current Status

**🚧 Phase 4 Development** - Interactive Console & IaC Generation

### ✅ **COMPLETED** (37.5% - 3/8 phases)
- **Foundation & Core Infrastructure** - TypeScript/Node.js project with comprehensive testing
- **Database & State Management** - Complete state tracking with Prisma ORM  
- **CLI Enhancement** - Professional interface with 20+ commands and safety features

### 🎯 **NEXT**: Interactive Console (Phase 4 - 8-10 weeks)
Transform into Claude Code-like interactive console with automatic Infrastructure-as-Code generation

### 🧪 **Tested Configuration**
- **Proxmox VE**: 8.4.1 (successfully tested)  
- **Authentication**: API token authentication
- **Testing**: 163/175 tests passing (93% success rate)
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

#### Current CLI Commands (Legacy Interface)

```bash
# Connection and Discovery
npm run cli test-connection -v            # Test Proxmox API connectivity
npm run cli list-nodes -v                 # List cluster nodes
npm run cli discover-vms --status running # List VMs with filtering
npm run cli discover-containers           # List containers
npm run cli discover-storage              # List storage pools
npm run cli discover-all                  # Complete infrastructure overview

# VM Management  
npm run cli vm create --vmid 100 --name web-01 --cores 2 --memory 4096
npm run cli vm start 100 --wait           # Start VM and wait
npm run cli vm stop 100 --force           # Force stop VM
npm run cli vm delete 100 --confirm       # Delete with confirmation

# Container Management
npm run cli container create --vmid 200 --ostemplate ubuntu-20.04
npm run cli container start 200 --wait    # Start container
npm run cli container stop 200            # Stop container

# Batch Operations
npm run cli vm batch-start 100 101 102 --wait
npm run cli vm batch-stop 100 101 --continue-on-error

# Development
npm test                                   # Run all tests
npm run typecheck                          # TypeScript compilation
```

**🎯 Future**: Interactive console will replace these with conversational commands

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