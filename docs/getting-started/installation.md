# Installation Guide

This comprehensive guide covers all installation methods for Proxmox-MPC, from simple global installation to advanced development setups. Choose the method that best fits your use case.

## System Requirements

### Minimum Requirements

- **Node.js**: Version 18.0 or higher
- **npm**: Version 8.0 or higher (included with Node.js)
- **Proxmox VE**: Version 7.0 or higher (tested with 8.4.1+)
- **Operating System**: Linux, macOS, or Windows
- **Memory**: 512MB RAM minimum, 2GB recommended
- **Storage**: 500MB free disk space

### Recommended Requirements

- **Node.js**: Version 20.0 LTS
- **Proxmox VE**: Version 8.0+
- **Memory**: 4GB RAM for large infrastructure management
- **Storage**: 2GB free disk space for project workspaces

## Installation Methods

### Method 1: Global NPM Installation (Recommended)

The easiest way to install Proxmox-MPC is via npm global installation:

```bash
# Install globally via npm
npm install -g proxmox-mpc

# Verify installation
proxmox-mpc --version

# Launch interactive console
proxmox-mpc
```

!!! tip "Global Installation Benefits" - Available from any directory like the `claude` command - Automatic PATH configuration - Easy updates with `npm update -g proxmox-mpc` - No need to navigate to specific directories

### Method 2: From Source (Development)

For development or if you want the latest features:

```bash
# Clone the repository
git clone https://github.com/proxmox-mpc/proxmox-mpc.git
cd proxmox-mpc

# Install dependencies
npm install

# Build the project
npm run build

# Create global link (recommended for development)
npm link

# Run development version
npm run console  # Interactive console
npm run cli      # CLI commands
```

!!! tip "Development Installation Benefits" - Changes to source code are immediately reflected globally - Perfect for development and testing - No need to reinstall after code changes - Can delete and recreate global link easily

### Method 3: Local Development Setup

For local development without global installation:

```bash
# Clone and setup development environment
git clone https://github.com/proxmox-mpc/proxmox-mpc.git
cd proxmox-mpc
npm install

# Run directly from source
npm run console    # Launch interactive console
npm run cli test-connection  # Run CLI commands

# Development workflow
npm test          # Run test suite
npm run typecheck # TypeScript validation
npm run build     # Build the project
```

!!! note "Development Environment"
This method is ideal for:

    - Contributing to the project
    - Testing unreleased features
    - Local development without affecting global installation
    - Running test suites and development tools

### Method 4: Using npx (No Installation)

Try Proxmox-MPC without installing:

```bash
# Run directly with npx
npx proxmox-mpc

# Run specific CLI commands
npx proxmox-mpc cli test-connection
```

## Alternative Installation Methods

### npm link Method (Development)

If you're working with the source code and want global access:

```bash
# From the proxmox-mpc project directory
npm link

# Now available globally as 'proxmox-mpc'
proxmox-mpc

# To unlink later
npm unlink -g proxmox-mpc
```

### Direct Binary Link (Advanced)

Create a direct symlink to the binary:

```bash
# Create symlink in /usr/local/bin (requires sudo)
sudo ln -s /path/to/proxmox-mpc/bin/proxmox-mpc /usr/local/bin/proxmox-mpc

# Make sure it's executable
sudo chmod +x /usr/local/bin/proxmox-mpc
```

### Add to PATH Method

Add the bin directory to your PATH:

```bash
# Add to ~/.bashrc or ~/.zshrc
export PATH="$PATH:/path/to/proxmox-mpc/bin"

# Reload shell configuration
source ~/.bashrc  # or source ~/.zshrc
```

## Post-Installation Setup

### 1. Verify Installation

Check that Proxmox-MPC is properly installed:

```bash
# Check version
proxmox-mpc --version

# Check help
proxmox-mpc --help

# Test interactive console
proxmox-mpc
```

You should see output similar to:

```
Proxmox-MPC Interactive Console v1.0.0
Type /help for available commands or /exit to quit.

proxmox-mpc>
```

### 2. Environment Setup

Create a dedicated directory for your Proxmox projects:

```bash
# Create projects directory
mkdir ~/proxmox-projects
cd ~/proxmox-projects

# Launch console in project directory
proxmox-mpc
```

### 3. Configure Shell Integration (Optional)

Add bash completion and aliases:

```bash
# Add to your ~/.bashrc or ~/.zshrc
echo 'alias pmpc="proxmox-mpc"' >> ~/.bashrc
echo 'alias pmpc-cli="proxmox-mpc cli"' >> ~/.bashrc

# Reload shell configuration
source ~/.bashrc
```

## Platform-Specific Instructions

### Linux (Ubuntu/Debian)

```bash
# Update package manager
sudo apt update

# Install Node.js (if not already installed)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Proxmox-MPC
npm install -g proxmox-mpc
```

### Linux (RHEL/CentOS/Fedora)

```bash
# Install Node.js (if not already installed)
sudo dnf install nodejs npm

# Or using NodeSource repository
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install nodejs

# Install Proxmox-MPC
npm install -g proxmox-mpc
```

### macOS

```bash
# Using Homebrew (recommended)
brew install node

# Install Proxmox-MPC
npm install -g proxmox-mpc

# Alternative: Using MacPorts
sudo port install nodejs18 +universal
npm install -g proxmox-mpc
```

### Windows

1. **Install Node.js**:
   - Download from [nodejs.org](https://nodejs.org/)
   - Choose LTS version
   - Run installer with default options

2. **Install Proxmox-MPC**:

   ```cmd
   # Open Command Prompt or PowerShell as Administrator
   npm install -g proxmox-mpc

   # Verify installation
   proxmox-mpc --version
   ```

3. **Windows-specific notes**:
   - Use PowerShell or Command Prompt
   - Some features may require Windows Subsystem for Linux (WSL)
   - File paths use backslashes in Windows

## Docker Installation (Advanced)

For containerized deployment:

```bash
# Pull the Docker image (when available)
docker pull proxmox-mpc/proxmox-mpc:latest

# Run in container
docker run -it --rm \
  -v $(pwd):/workspace \
  -v ~/.proxmox:/root/.proxmox \
  proxmox-mpc/proxmox-mpc:latest

# Create alias for easier use
echo 'alias pmpc-docker="docker run -it --rm -v \$(pwd):/workspace proxmox-mpc/proxmox-mpc:latest"' >> ~/.bashrc
```

## Troubleshooting Installation

### Common Issues

#### Permission Errors (Linux/macOS)

```bash
# If you get permission errors with global install
sudo npm install -g proxmox-mpc

# Or configure npm to use a different directory
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
npm install -g proxmox-mpc
```

#### Node.js Version Issues

```bash
# Check Node.js version
node --version

# Update Node.js using Node Version Manager (nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
nvm use 20
npm install -g proxmox-mpc
```

#### Network/Proxy Issues

```bash
# Configure npm proxy (if behind corporate firewall)
npm config set proxy http://proxy.company.com:8080
npm config set https-proxy https://proxy.company.com:8080

# Or use registry mirror
npm config set registry https://registry.npmmirror.com/
```

#### Windows Path Issues

```cmd
# Add npm global directory to PATH
setx PATH "%PATH%;%APPDATA%\npm"

# Restart Command Prompt and try again
proxmox-mpc --version
```

### Verification Steps

After installation, verify everything is working:

```bash
# 1. Check command availability
which proxmox-mpc

# 2. Check version
proxmox-mpc --version

# 3. Check interactive console
proxmox-mpc
# Type /help and /exit

# 4. Check CLI functionality
proxmox-mpc cli --help
```

### Getting Help

If you encounter issues during installation:

1. **Check the logs**: Look for error messages in the installation output
2. **Verify requirements**: Ensure Node.js and npm versions are supported
3. **Clear npm cache**: `npm cache clean --force`
4. **Reinstall**: `npm uninstall -g proxmox-mpc && npm install -g proxmox-mpc`
5. **Check GitHub Issues**: [Installation issues](https://github.com/proxmox-mpc/proxmox-mpc/issues?q=label%3Ainstallation)

## Next Steps

Once installation is complete:

1. **[Quick Start](quick-start.md)** - 5-minute walkthrough
2. **[Authentication Setup](authentication.md)** - Configure Proxmox access
3. **[First Project](first-project.md)** - Create your first project
4. **[System Requirements](requirements.md)** - Detailed requirements

## Updating Proxmox-MPC

Keep your installation up to date:

```bash
# Update global installation
npm update -g proxmox-mpc

# Check for latest version
npm list -g proxmox-mpc

# Reinstall if needed
npm uninstall -g proxmox-mpc
npm install -g proxmox-mpc@latest
```

## Uninstalling Proxmox-MPC

To completely remove Proxmox-MPC from your system:

```bash
# Global npm installation
npm uninstall -g proxmox-mpc

# npm link installation
npm unlink -g proxmox-mpc

# Direct binary symlink (if used)
sudo rm /usr/local/bin/proxmox-mpc

# Remove from PATH (if added manually)
# Edit ~/.bashrc or ~/.zshrc to remove PATH export

# Clean npm cache (optional)
npm cache clean --force
```

!!! tip "Complete Cleanup"
After uninstalling, you may also want to remove any project-specific configuration:

    ```bash
    # Remove global configuration (if any)
    rm -rf ~/.proxmox-mpc

    # Remove project workspaces (manual)
    # These contain your infrastructure definitions
    ```

---

**Next**: [Quick Start Guide](quick-start.md) to get up and running in 5 minutes.
