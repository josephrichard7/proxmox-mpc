# Local Installation Guide for Proxmox-MPC

!!! warning "Deprecated Guide"
    This guide is deprecated. For comprehensive installation instructions, please refer to the official **[Installation Guide](https://proxmox-mpc.dev/getting-started/installation/)** in the documentation.
    
    The information below is kept for reference but may be outdated.

---

This guide explains how to install and use Proxmox-MPC globally on your local machine.

## 🚀 Quick Installation (Already Completed)

The tool is already installed globally on your machine and can be used from anywhere:

```bash
# From any directory, simply run:
proxmox-mpc
```

## 📦 Installation Methods

### Method 1: NPM Link (Current Installation) ✅

This method creates a global symlink to your development directory:

```bash
# From the proxmox-mpc project directory
npm link

# Now available globally as 'proxmox-mpc'
proxmox-mpc
```

**Advantages:**
- Changes to the source code are immediately reflected globally
- Perfect for development and testing
- No need to reinstall after code changes

**Current Status:** ✅ **Already installed using this method**

### Method 2: Global NPM Installation

For a permanent installation independent of the source directory:

```bash
# From the proxmox-mpc project directory
npm install -g .

# Or from anywhere if published to npm
npm install -g proxmox-mpc
```

**Advantages:**
- Stable installation independent of source directory
- Can delete development directory after installation
- Standard npm global package management

### Method 3: Direct Binary Installation

Create a direct symlink to the binary:

```bash
# Create symlink in /usr/local/bin (requires sudo)
sudo ln -s /home/dev/dev/proxmox-mpc/bin/proxmox-mpc /usr/local/bin/proxmox-mpc

# Make sure it's executable
sudo chmod +x /usr/local/bin/proxmox-mpc
```

**Advantages:**
- Works without npm/node in PATH
- Direct system-level installation
- Can be managed by system package managers

### Method 4: Add to PATH

Add the bin directory to your PATH:

```bash
# Add to ~/.bashrc or ~/.zshrc
export PATH="$PATH:/home/dev/dev/proxmox-mpc/bin"

# Reload shell configuration
source ~/.bashrc  # or source ~/.zshrc
```

**Advantages:**
- No installation required
- Easy to update PATH for different versions
- Can maintain multiple versions

## 🔧 Usage

Once installed globally, you can use proxmox-mpc from any directory:

```bash
# Launch interactive console from anywhere
proxmox-mpc

# Initialize a new project in current directory
mkdir my-infrastructure
cd my-infrastructure
proxmox-mpc
# Then use: /init

# Use with existing project
cd existing-project
proxmox-mpc
# Automatically detects workspace configuration
```

## 🎯 Common Commands

```bash
# Interactive console commands
proxmox-mpc              # Launch interactive console
proxmox-mpc --help       # Show help (currently exits to console)
proxmox-mpc --version    # Show version (currently exits to console)
```

Inside the interactive console:
- `/init` - Initialize new Proxmox project workspace
- `/sync` - Synchronize with Proxmox server
- `/status` - Show project and server status
- `/help` - Show all available commands
- `/exit` - Exit the console

## 🔍 Verify Installation

Check if proxmox-mpc is installed globally:

```bash
# Check if command is available
which proxmox-mpc
# Output: /home/dev/.local/share/mise/installs/node/23/bin/proxmox-mpc

# Check npm global packages
npm ls -g --depth=0 | grep proxmox-mpc
# Output: proxmox-mpc@0.1.3 -> ./../../../dev/proxmox-mpc

# Test from any directory
cd /tmp
proxmox-mpc
# Should launch the interactive console
```

## 🔄 Update Installation

To update the global installation after code changes:

```bash
# If using npm link (current method)
# Changes are automatically reflected, no update needed

# If using global npm install
cd /home/dev/dev/proxmox-mpc
npm install -g .

# If using direct binary symlink
# No update needed, changes are immediate
```

## ❌ Uninstall

To remove the global installation:

```bash
# If installed with npm link
npm unlink -g proxmox-mpc

# If installed with npm install -g
npm uninstall -g proxmox-mpc

# If using direct binary symlink
sudo rm /usr/local/bin/proxmox-mpc

# If added to PATH
# Remove the export line from ~/.bashrc or ~/.zshrc
```

## 📝 Current Installation Details

**Installation Method:** NPM Link
**Version:** 0.1.3
**Location:** `/home/dev/dev/proxmox-mpc`
**Global Command:** `proxmox-mpc`
**Status:** ✅ **Fully Operational**

## 🎉 Ready to Use!

Proxmox-MPC is now installed globally on your machine and ready to use from any directory. Simply run `proxmox-mpc` to start managing your Proxmox infrastructure with the Interactive Infrastructure-as-Code Console!

## 🚀 Quick Start Example

```bash
# Create a new infrastructure project
mkdir ~/my-datacenter
cd ~/my-datacenter

# Launch Proxmox-MPC
proxmox-mpc

# In the console:
proxmox-mpc> /init
# Follow the prompts to set up your Proxmox connection

proxmox-mpc> /sync
# Discover and import your existing infrastructure

proxmox-mpc> /status
# View your infrastructure status

proxmox-mpc> create vm --name web-01 --cores 4 --memory 8192
# Create new infrastructure definitions
```

Enjoy using Proxmox-MPC to manage your infrastructure! 🎯