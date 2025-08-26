# Authentication Setup

This guide explains how to configure authentication between Proxmox-MPC and your Proxmox Virtual Environment servers.

## 🔑 Authentication Overview

Proxmox-MPC uses **API tokens** for secure, programmatic access to Proxmox VE servers. This method is more secure than username/password authentication and supports fine-grained permission control.

### Why API Tokens?
- **Security**: No password storage or transmission
- **Granular Permissions**: Specific privileges for automation
- **Audit Trail**: Clear tracking of API usage
- **Rotation**: Easy token renewal without service disruption
- **Scalability**: Support for multiple tokens per user

## 🏗️ Step-by-Step Setup

### Step 1: Access Proxmox Web Interface

1. Open your Proxmox VE web interface
2. Navigate to `https://your-proxmox-server:8006`
3. Log in with administrative credentials

![Proxmox Login](../assets/proxmox-login.png)

### Step 2: Create API Token

1. **Navigate to API Tokens**:
   - Go to **Datacenter** → **Permissions** → **API Tokens**
   - Click **Add** to create a new token

2. **Configure Token Settings**:
   ```
   User: root@pam (or your preferred user)
   Token ID: proxmox-mpc-automation
   Comment: Proxmox-MPC Interactive Console Access
   Privilege Separation: ✅ Enabled (recommended)
   ```

3. **Copy the Generated Token**:
   ```
   Token ID: root@pam!proxmox-mpc-automation
   Secret: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   ```

!!! warning "Important"
    The token secret is displayed only once. Copy it immediately and store it securely.

### Step 3: Assign Permissions

API tokens with privilege separation need explicit permissions:

1. **Navigate to Permissions**:
   - Go to **Datacenter** → **Permissions**
   - Click **Add** → **API Token Permission**

2. **Configure Required Permissions**:
   ```yaml
   Path: /
   API Token: root@pam!proxmox-mpc-automation
   Role: ProxmoxMPCRole (create custom role - see below)
   ```

### Step 4: Create Custom Role (Recommended)

For security best practices, create a specific role for Proxmox-MPC:

1. **Navigate to Roles**:
   - Go to **Datacenter** → **Permissions** → **Roles**
   - Click **Create**

2. **Configure Custom Role**:
   ```yaml
   Role Name: ProxmoxMPCRole
   Privileges:
     # VM Management
     - VM.Audit          # Read VM configurations
     - VM.Config.Disk    # Manage VM disks
     - VM.Config.CPU     # Manage VM CPU settings
     - VM.Config.Memory  # Manage VM memory
     - VM.Config.Network # Manage VM networks
     - VM.Config.Options # Manage VM options
     - VM.Console        # Access VM console
     - VM.PowerMgmt      # Start/stop/restart VMs
     
     # Container Management  
     - VM.Audit          # Read container configurations
     - VM.Config.*       # Modify container settings
     - VM.Console        # Access container console
     - VM.PowerMgmt      # Start/stop containers
     
     # Storage Management
     - Datastore.Audit        # Read storage information
     - Datastore.AllocateSpace # Create disks and volumes
     
     # Node Information
     - Node.Audit        # Read node information and statistics
     
     # Pool Management (if using resource pools)
     - Pool.Audit        # Read resource pool information
     ```

### Step 5: Test Authentication

Verify the token works correctly:

```bash
# Test API connectivity
curl -k -H "Authorization: PVEAPIToken=root@pam!proxmox-mpc-automation=YOUR-SECRET-HERE" \
  https://your-proxmox-server:8006/api2/json/version

# Expected response:
{
  "data": {
    "release": "8.x",
    "version": "8.x.x",
    "repoid": "xxxxxxxxx"
  }
}
```

## ⚙️ Configuration Files

### Project-Level Configuration

Create a configuration file in your project workspace:

```yaml
# .proxmox/config.yml
proxmox:
  host: "192.168.1.100"
  port: 8006
  username: "root@pam"
  token_id: "proxmox-mpc-automation"  
  token_secret: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
  
  # SSL Configuration
  ssl:
    verify: false  # For homelab self-signed certificates
    # ca_file: "/path/to/ca.crt"  # For enterprise CA certificates
    
  # Connection Settings
  timeout: 30000  # 30 second timeout
  retry_attempts: 3
  retry_delay: 1000  # 1 second between retries

# Optional: Multiple server support
servers:
  production:
    host: "prod-proxmox.company.com"
    port: 8006
    username: "automation@pve"
    token_id: "proxmox-mpc-prod"
    token_secret: "prod-token-secret"
    ssl:
      verify: true
      ca_file: "/etc/ssl/certs/company-ca.crt"
      
  staging:
    host: "staging-proxmox.company.com"
    port: 8006
    username: "automation@pve"
    token_id: "proxmox-mpc-staging"
    token_secret: "staging-token-secret"
```

### Global Configuration (Optional)

For convenience across multiple projects:

```yaml
# ~/.proxmox-mpc/global-config.yml
default_servers:
  homelab:
    host: "192.168.1.100"
    port: 8006
    username: "root@pam"
    token_id: "proxmox-mpc-automation"
    # token_secret loaded from environment variable
    
# Security settings
security:
  token_storage: "environment"  # or "file" or "keyring"
  encryption: true
  audit_logging: true
```

### Environment Variables

For enhanced security, use environment variables:

```bash
# Add to your ~/.bashrc or ~/.zshrc
export PROXMOX_HOST="192.168.1.100"
export PROXMOX_PORT="8006"
export PROXMOX_USERNAME="root@pam"
export PROXMOX_TOKEN_ID="proxmox-mpc-automation"
export PROXMOX_TOKEN_SECRET="your-secret-token"

# Optional: Multiple environments
export PROXMOX_PROD_HOST="prod-proxmox.company.com"
export PROXMOX_PROD_TOKEN_SECRET="prod-secret"
export PROXMOX_STAGING_HOST="staging-proxmox.company.com"
export PROXMOX_STAGING_TOKEN_SECRET="staging-secret"
```

## 🔐 Security Best Practices

### Token Management
1. **Unique Tokens**: Use separate tokens for different purposes
2. **Regular Rotation**: Rotate tokens quarterly or semi-annually
3. **Least Privilege**: Grant only necessary permissions
4. **Monitoring**: Monitor token usage and access patterns

### Storage Security
```yaml
Recommended Practices:
  - Environment Variables: Store secrets in environment variables
  - File Permissions: Restrict config files to user-only (chmod 600)
  - Encryption: Encrypt configuration files containing secrets
  - Version Control: Never commit secrets to version control
  
Security Configurations:
  # .proxmox/config.yml with encrypted secrets
  proxmox:
    host: "192.168.1.100"
    port: 8006
    username: "root@pam"
    token_id: "proxmox-mpc-automation"
    token_secret: "${PROXMOX_TOKEN_SECRET}"  # Environment variable
```

### Network Security
```yaml
SSL/TLS Configuration:
  Homelab (Self-signed):
    ssl:
      verify: false
      # Accept self-signed certificates
      
  Enterprise (Proper CA):
    ssl:
      verify: true
      ca_file: "/path/to/company-ca.crt"
      # Verify against company CA
      
  Development:
    ssl:
      verify: false
      insecure: true  # Development only!
```

## 🌐 Multi-Server Setup

### Configuration for Multiple Proxmox Servers

```yaml
# .proxmox/config.yml for multi-server environment
servers:
  primary:
    host: "proxmox-01.lab.local"
    port: 8006
    username: "automation@pve"
    token_id: "proxmox-mpc-primary"
    token_secret: "${PROXMOX_PRIMARY_SECRET}"
    
  secondary:
    host: "proxmox-02.lab.local" 
    port: 8006
    username: "automation@pve"
    token_id: "proxmox-mpc-secondary"
    token_secret: "${PROXMOX_SECONDARY_SECRET}"

# Default server for operations
default_server: "primary"

# Load balancing and failover
failover:
  enabled: true
  timeout: 5000
  retry_servers: ["secondary"]
```

### Interactive Server Selection

```bash
# Launch with specific server
proxmox-mpc --server production

# Switch servers in console
proxmox-mpc> /server list
Available servers:
  ✅ primary (proxmox-01.lab.local) - Connected
  ✅ secondary (proxmox-02.lab.local) - Connected
  ❌ staging (staging.company.com) - Unreachable

proxmox-mpc> /server switch secondary
✅ Switched to server 'secondary' (proxmox-02.lab.local)
```

## 🧪 Testing Authentication

### Built-in Authentication Tests

```bash
# Test API connectivity
proxmox-mpc cli test-connection

Expected Output:
✅ Connection successful
🏥 Server: proxmox-01.lab.local:8006
📊 Version: Proxmox VE 8.4.1
👤 User: root@pam
🔑 Token: proxmox-mpc-automation
⏱️ Response time: 145ms

# Verbose testing with details
proxmox-mpc cli test-connection -v

Extended Output:
🔍 Testing connection to proxmox-01.lab.local:8006
🔐 Using token authentication: root@pam!proxmox-mpc-automation
🌐 SSL verification: disabled (self-signed certificate)
📡 API version check... ✅
🖥️ Node list retrieval... ✅ (2 nodes found)
💾 Storage list retrieval... ✅ (3 storage pools found)
🔧 Permission validation... ✅ (all required permissions granted)
```

### Interactive Authentication Test

```bash
# Test from interactive console
proxmox-mpc> /health

🏥 System Health Report:
✅ Proxmox API: Connected (proxmox-01.lab.local:8006)
✅ Authentication: Token valid (expires: 2025-12-31)
✅ Permissions: All required permissions granted
✅ Network: 98ms average response time
✅ Database: SQLite - 23 VMs, 8 containers tracked
```

## 🔧 Troubleshooting Authentication

### Common Issues and Solutions

#### Issue 1: "Authentication Failed"
```bash
❌ Error: Authentication failed (401 Unauthorized)

Solutions:
1. Verify token ID and secret are correct
2. Check token hasn't expired
3. Ensure user exists and is active
4. Verify token has privilege separation disabled OR has proper permissions
```

#### Issue 2: "Permission Denied"
```bash
❌ Error: Permission denied for VM.Config.Disk (403 Forbidden)

Solutions:
1. Add missing permissions to API token
2. Check role includes required privileges
3. Verify token permissions are applied to correct path (/)
4. Consider using Administrator role temporarily for testing
```

#### Issue 3: "SSL Certificate Error"
```bash
❌ Error: self signed certificate in certificate chain

Solutions:
1. Set ssl.verify: false in config for homelab
2. Add proper CA certificate for enterprise
3. Use curl -k to test API manually
4. Check certificate chain with openssl s_client
```

#### Issue 4: "Connection Timeout"
```bash
❌ Error: connect ETIMEDOUT

Solutions:
1. Verify Proxmox server is reachable: ping proxmox-server
2. Check port 8006 is accessible: telnet proxmox-server 8006
3. Verify firewall rules allow HTTPS traffic
4. Increase timeout in configuration
```

### Diagnostic Commands

```bash
# Manual API testing with curl
curl -k -H "Authorization: PVEAPIToken=USER@REALM!TOKENID=SECRET" \
  https://proxmox-server:8006/api2/json/access/permissions

# Test specific permissions
curl -k -H "Authorization: PVEAPIToken=USER@REALM!TOKENID=SECRET" \
  https://proxmox-server:8006/api2/json/nodes

# Network connectivity test
telnet proxmox-server 8006

# SSL certificate inspection
openssl s_client -connect proxmox-server:8006 -servername proxmox-server
```

## 📚 Advanced Authentication

### LDAP Integration (Enterprise)
```yaml
# For enterprise LDAP setups
proxmox:
  host: "proxmox-enterprise.company.com"
  username: "service-account@ldap.company.com"
  token_id: "automation-token"
  # LDAP authentication still uses API tokens
  # But user management is centralized
```

### Role-Based Access Control
```yaml
# Different tokens for different purposes
tokens:
  read_only:
    token_id: "readonly-token"
    permissions: ["VM.Audit", "Node.Audit", "Datastore.Audit"]
    
  vm_management:
    token_id: "vm-mgmt-token"
    permissions: ["VM.*", "Datastore.AllocateSpace"]
    
  full_access:
    token_id: "admin-token"
    permissions: ["Administrator"]  # Use sparingly
```

---

**Next Steps:**

Once authentication is configured:

1. **[Quick Start](quick-start.md)** - Test your setup with a 5-minute walkthrough
2. **[First Project](first-project.md)** - Create your first infrastructure project
3. **[Interactive Console](../user-guide/interactive-console.md)** - Master the console interface