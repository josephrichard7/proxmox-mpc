# 🌍 Global Proxmox-MPC Setup Guide

## ✅ **SUCCESS! Global Installation Complete**

Your `proxmox-mpc` command is now globally accessible, just like the `claude` command!

## 🚀 **Quick Test**

```bash
# From ANY directory, run:
proxmox-mpc
```

You should see the interactive console start up!

## 🔧 **Global Configuration Setup**

Since the tool is now global, you need to set up the configuration in a global location:

### **Method 1: Environment Variables (Recommended)**

Add these to your shell profile (`~/.bashrc`, `~/.zshrc`, etc.):

```bash
# Proxmox-MPC Global Configuration
export PROXMOX_HOST="192.168.x.x"                    # Your Proxmox server IP
export PROXMOX_USERNAME="root@pam"
export PROXMOX_TOKEN_ID="proxmox-mpc"                # API token you'll create
export PROXMOX_TOKEN_SECRET="your-secret-here"       # Token secret from Proxmox
export PROXMOX_SKIP_TLS_VERIFY="true"               # For self-signed certificates
```

Then reload your shell:
```bash
source ~/.bashrc  # or ~/.zshrc
```

### **Method 2: Global Config File**

The tool will look for configuration in these locations:
1. `~/.proxmox-mpc/config.yml`
2. Current working directory `.env` file
3. Environment variables

Create the global config:
```bash
mkdir -p ~/.proxmox-mpc

cat > ~/.proxmox-mpc/config.yml << EOF
proxmox:
  host: "192.168.x.x"
  username: "root@pam"
  tokenId: "proxmox-mpc"
  tokenSecret: "your-secret-here"
  skipTlsVerify: true
EOF
```

## 🧪 **Testing from Any Directory**

```bash
# Go to any directory
cd ~/Documents
# or
cd ~/test-workspace

# Launch the console
proxmox-mpc
```

**In the console, try:**
- `help` - Show available commands
- `/help` - Show slash commands  
- `/init` - Initialize workspace in current directory
- `/status` - Show connection status
- `exit` - Quit

## 🏗️ **Creating Proxmox Projects**

Now you can create infrastructure projects anywhere:

```bash
# Create a new project
mkdir ~/my-homelab
cd ~/my-homelab

# Launch console and initialize
proxmox-mpc
# In console:
/init
```

This will create the project structure:
```
my-homelab/
├── .proxmox/
│   ├── config.yml     # Project-specific config
│   └── state.db       # Local database
├── terraform/         # Generated Terraform files
├── ansible/          # Generated Ansible files
└── docs/             # Generated documentation
```

## 🔗 **Proxmox API Token Setup**

1. **Access Proxmox Web UI**: `https://your-proxmox-ip:8006`
2. **Navigate**: Datacenter → Permissions → API Tokens
3. **Add Token**:
   - User: `root@pam`
   - Token ID: `proxmox-mpc`
   - Privilege Separation: **Unchecked** (for testing)
4. **Copy the secret** (you only see it once!)
5. **Update your config** with the token details

## 🧪 **Test Connection**

The CLI commands should also work globally now:

```bash
# Test from any directory
proxmox-mpc --version

# Check if CLI works (this might need some adjustment)
# We'll set this up in the next step
```

## 🎯 **What Works Now**

- ✅ **Global Command**: `proxmox-mpc` works from anywhere
- ✅ **Interactive Console**: Full readline interface with history
- ✅ **Project Initialization**: Create workspace structure anywhere
- ✅ **Command System**: Help, status, and workspace commands
- ✅ **Configuration**: Global and project-specific config support

## 🔮 **What's Coming Next**

The enhanced features we built are ready to integrate:
- **Tab Completion**: Smart auto-completion for commands
- **Persistent History**: Command history across sessions
- **Session Management**: Save and restore console sessions
- **Core Commands**: `/sync`, `/apply`, `/test` for real infrastructure operations

## 🐛 **Troubleshooting**

### **Command Not Found**
```bash
# Check if installed
npm list -g proxmox-mpc

# Reinstall if needed
npm install -g proxmox-mpc-0.1.0.tgz
```

### **Permission Issues**
```bash
# Check permissions
ls -la ~/.proxmox-mpc/

# Fix if needed
chmod 600 ~/.proxmox-mpc/config.yml
```

### **Connection Issues**
```bash
# Test environment variables
echo $PROXMOX_HOST
echo $PROXMOX_TOKEN_ID

# Test with curl
curl -k -H "Authorization: PVEAPIToken=$PROXMOX_USERNAME!$PROXMOX_TOKEN_ID=$PROXMOX_TOKEN_SECRET" \
  https://$PROXMOX_HOST:8006/api2/json/nodes
```

---

🎉 **You now have a globally accessible Proxmox infrastructure console!** 

Just like `claude`, you can run `proxmox-mpc` from anywhere to start managing your homelab infrastructure.