# Testing the Interactive Console

## 🚀 Quick Start Guide

### 1. **Launch the Interactive Console**
```bash
npm run console
```

### 2. **Try Basic Commands**
Once in the console, test these commands:

```bash
# Get help
help
/help

# Test command handling
create vm
list nodes
/init

# Check workspace functionality
/status

# Exit when done
exit
```

### 3. **Test with Real Proxmox Server**

#### A. Set up Environment Variables
Create a `.env` file in the project root:

```bash
# Proxmox server configuration
PROXMOX_HOST=your-proxmox-ip
PROXMOX_USERNAME=root@pam
PROXMOX_TOKEN_ID=your-token-id
PROXMOX_TOKEN_SECRET=your-token-secret

# Optional: Skip SSL verification for self-signed certificates
PROXMOX_SKIP_TLS_VERIFY=true
```

#### B. Test CLI Commands First
```bash
# Test connection
npm run cli test-connection -v

# List nodes
npm run cli list-nodes -v

# List VMs
npm run cli list-vms -v
```

#### C. Test Workspace Initialization
```bash
# Create test directory
mkdir ~/test-proxmox-workspace
cd ~/test-proxmox-workspace

# Launch console
npm run console

# Initialize workspace
/init
```

## 🎯 What You Should See

### **Interactive Console Features**
- ✅ **Prompt**: `proxmox-mpc> `
- ✅ **Command History**: Use ↑↓ arrow keys
- ✅ **Help System**: Type `help` or `/help`
- ✅ **Slash Commands**: `/init`, `/status`, `/help`
- ✅ **Exit Handling**: `exit`, `quit`, or Ctrl+C

### **Current Capabilities**
- ✅ Basic interactive console with readline
- ✅ Command history navigation
- ✅ Help system with command discovery
- ✅ Workspace initialization (basic)
- ✅ Status reporting
- 🚧 Enhanced REPL (implemented but not yet integrated)
- 🚧 Tab completion (implemented but not yet active)
- 🚧 Session persistence (implemented but not yet active)

### **Expected Behavior**
1. **Console launches** with welcome message
2. **Commands respond** with appropriate messages
3. **History works** with arrow key navigation
4. **Exit works** cleanly with session summary

## 🔧 Proxmox Server Setup

### **1. Create API Token**
In your Proxmox web interface:
1. Go to **Datacenter → Permissions → API Tokens**
2. Click **Add**
3. Choose **User**: `root@pam`
4. **Token ID**: `proxmox-mpc`
5. **Privilege Separation**: Unchecked (for testing)
6. **Save** and copy the secret

### **2. Test Connection**
```bash
# Replace with your actual values
export PROXMOX_HOST="192.168.1.100"
export PROXMOX_USERNAME="root@pam"
export PROXMOX_TOKEN_ID="proxmox-mpc"
export PROXMOX_TOKEN_SECRET="your-secret-here"

# Test
npm run cli test-connection -v
```

## 🐛 Troubleshooting

### **Console Won't Start**
- Check Node.js version: `node --version` (need 18+)
- Install dependencies: `npm install`
- Check for errors: `npm run console 2>&1`

### **Proxmox Connection Issues**
- Verify server is reachable: `ping your-proxmox-ip`
- Check API token permissions
- Try with `PROXMOX_SKIP_TLS_VERIFY=true` for self-signed certs
- Test with curl:
```bash
curl -k -H "Authorization: PVEAPIToken=root@pam!proxmox-mpc=your-secret" \
  https://your-proxmox-ip:8006/api2/json/nodes
```

### **Commands Not Working**
- Current implementation is basic - many commands show "not yet implemented"
- Focus on testing: `/help`, `/init`, `/status`, basic navigation
- Enhanced features are implemented but not yet integrated

## 📋 Testing Checklist

- [ ] Console starts successfully
- [ ] Help commands work (`help`, `/help`)
- [ ] Command history with arrow keys
- [ ] Slash commands recognized (`/init`, `/status`)
- [ ] Exit works cleanly
- [ ] CLI commands work with real server
- [ ] Workspace initialization creates directory structure

## 🔮 What's Coming Next

The enhanced REPL features we built (tab completion, persistent history, session management) are ready for integration. Next steps:
1. Integrate enhanced REPL as the default console
2. Connect workspace management to real Proxmox operations
3. Implement core slash commands (`/sync`, `/apply`, `/test`)
4. Add natural language command parsing