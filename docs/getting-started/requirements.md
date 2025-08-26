# System Requirements

This page details the complete system requirements for running Proxmox-MPC in different environments and deployment scenarios.

## 🔧 Minimum Requirements

### System Requirements
| Component | Minimum | Recommended | Enterprise |
|-----------|---------|-------------|------------|
| **CPU** | Single core | Dual core | Quad core+ |
| **RAM** | 512 MB | 2 GB | 8 GB+ |
| **Storage** | 500 MB | 2 GB | 10 GB+ |
| **Node.js** | 18.0+ | 20.0 LTS | 20.0+ LTS |
| **npm** | 8.0+ | 9.0+ | 10.0+ |

### Operating System Support
| Platform | Support Level | Notes |
|----------|---------------|-------|
| **Linux** | ✅ Full Support | Ubuntu 20.04+, RHEL 8+, Debian 11+ |
| **macOS** | ✅ Full Support | macOS 10.15+ (Intel & Apple Silicon) |
| **Windows** | ✅ Full Support | Windows 10+, PowerShell or WSL recommended |
| **Docker** | ✅ Container Support | Official Docker images available |

## 🌐 Network Requirements

### Proxmox Server Connectivity
```yaml
Required Connections:
  - Proxmox VE API: HTTPS (port 8006)
  - Optional SSH: SSH (port 22) for advanced features
  - Network Access: Same subnet or routed network

Firewall Requirements:
  - Outbound HTTPS (443) for package downloads
  - Outbound HTTP (80) for package repositories  
  - Proxmox API access (8006) to target servers

Optional Features:
  - Git connectivity for version control
  - Docker registry access for containerized deployment
```

### Network Performance
- **Minimum**: 1 Mbps connection to Proxmox servers
- **Recommended**: 10 Mbps for real-time operations
- **Enterprise**: 100 Mbps+ for large-scale infrastructure management

## 🔐 Proxmox VE Requirements

### Supported Proxmox Versions
| Version | Support Level | Features |
|---------|---------------|----------|
| **Proxmox VE 8.0+** | 🌟 Optimized | Full feature set, best performance |
| **Proxmox VE 7.0+** | ✅ Full Support | Complete compatibility |
| **Proxmox VE 6.x** | ⚠️ Limited | Basic features only |

### Authentication Requirements
Proxmox-MPC requires API token authentication:

```bash
# Required Proxmox permissions for API token
Privileges:
  - VM.Audit (read VM configurations)
  - VM.Config.* (modify VM settings) 
  - VM.Console (access VM console)
  - VM.PowerMgmt (start/stop/restart VMs)
  - Datastore.Audit (read storage information)
  - Datastore.AllocateSpace (create disks)
  - Node.Audit (read node information)
  - Pool.Audit (read resource pools)

# API Token Setup (on Proxmox server)
# Datacenter -> Permissions -> API Tokens -> Add
Token ID: proxmox-mpc@pve!automation
Privileges: As listed above
```

### SSL Certificate Considerations
| Environment | SSL Configuration | Notes |
|-------------|-------------------|-------|
| **Homelab** | Self-signed OK | Set `ssl.verify: false` in config |
| **Enterprise** | Valid certificates | Use proper CA certificates |
| **Development** | Self-signed OK | Development mode available |

## 💾 Storage Requirements

### Database Storage
```yaml
SQLite (Development):
  Initial: ~1 MB
  Per VM: ~10 KB
  Per Container: ~5 KB
  History: ~100 KB per day

PostgreSQL (Production):
  Connection Pool: 10-100 connections
  Storage Growth: 1-10 MB per 1000 VMs
  Backup Space: 2x database size recommended
```

### IaC File Storage
```yaml
Generated Files per VM:
  Terraform: ~2-5 KB per resource
  Ansible: ~1-3 KB per resource  
  Tests: ~3-8 KB per resource
  Documentation: ~5-10 KB per resource

Project Workspace:
  Small Project (1-10 VMs): ~50 MB
  Medium Project (10-100 VMs): ~200 MB
  Large Project (100+ VMs): ~1 GB+
```

## 🚀 Performance Considerations

### Development Environment
```yaml
Recommended Specs:
  - CPU: 4 cores, 2.0 GHz+
  - RAM: 8 GB
  - SSD: 500 GB
  - Network: 100 Mbps
  
Performance Expectations:
  - API Response: <500ms
  - VM Creation: 2-5 minutes
  - Sync Operations: <30 seconds for 50 VMs
  - Test Execution: <2 minutes for comprehensive suite
```

### Production Environment
```yaml
Recommended Specs:
  - CPU: 8+ cores, 3.0 GHz+
  - RAM: 16+ GB
  - SSD: 1+ TB NVMe
  - Network: 1+ Gbps
  
Performance Targets:
  - API Response: <200ms
  - Concurrent Users: 10-50 simultaneous operations
  - VM Management: 1000+ VMs per instance
  - High Availability: Multi-instance deployment
```

## 🐳 Container Requirements

### Docker Deployment
```dockerfile
# Resource requirements for containerized deployment
FROM node:20-alpine

# System requirements in container
RUN apk add --no-cache git sqlite

# Resource limits
MEMORY: 512MB minimum, 2GB recommended
CPU: 0.5 cores minimum, 2 cores recommended
STORAGE: 1GB volume for persistent data
```

### Kubernetes Deployment
```yaml
# Kubernetes resource requirements
apiVersion: apps/v1
kind: Deployment
metadata:
  name: proxmox-mpc
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: proxmox-mpc
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "2Gi" 
            cpu: "2000m"
```

## 🔧 Development Requirements

### Local Development Setup
```yaml
Required Tools:
  - Node.js 20.0+ LTS
  - TypeScript 5.0+
  - Git 2.30+
  - Code Editor (VS Code recommended)
  
Optional Tools:
  - Docker Desktop for container testing
  - PostgreSQL for production database testing
  - Terraform CLI for IaC validation
  - Ansible for playbook testing
```

### Testing Requirements
```yaml
Unit Testing:
  - Jest testing framework
  - 91.4% test success rate achieved
  - <2 second test execution time
  
Integration Testing:
  - Real Proxmox server (recommended)
  - Mock server for CI/CD
  - Test database isolation
```

## 🎯 Deployment Scenarios

### Scenario 1: Single User Development
```yaml
Hardware:
  - Laptop/Desktop: 8GB RAM, 4 cores
  - Proxmox Server: Homelab setup
  - Network: Home network with Proxmox access

Usage:
  - 1-20 VMs managed
  - Development and testing workflows
  - Learning and experimentation
```

### Scenario 2: Team Collaboration
```yaml
Hardware:
  - Workstations: 16GB RAM, 8 cores each
  - Shared Proxmox Cluster: Production-grade
  - Network: Corporate network with proper security

Usage:
  - 20-200 VMs managed
  - Multiple team members
  - CI/CD integration
  - Version control workflows
```

### Scenario 3: Enterprise Production
```yaml
Hardware:
  - Application Servers: 32GB+ RAM, 16+ cores
  - Proxmox Clusters: Multiple enterprise clusters
  - Network: Enterprise networking with redundancy

Usage:
  - 200+ VMs managed
  - High availability deployment
  - Role-based access control
  - Compliance and auditing
```

## 📊 Capacity Planning

### VM Management Scale
| Scale | VMs | RAM Usage | API Calls/min | Sync Time |
|-------|-----|-----------|---------------|-----------|
| **Small** | 1-20 | 100-200 MB | 10-50 | <10s |
| **Medium** | 20-100 | 200-500 MB | 50-200 | 10-30s |
| **Large** | 100-500 | 500MB-2GB | 200-1000 | 30-120s |
| **Enterprise** | 500+ | 2GB+ | 1000+ | 2-10 min |

### Database Growth Estimation
```python
# Database size calculation
def calculate_db_size(vms: int, containers: int, days: int) -> str:
    base_size = 1  # MB
    vm_size = vms * 0.01  # 10KB per VM
    container_size = containers * 0.005  # 5KB per container  
    history_size = (vms + containers) * 0.1 * days  # 100KB per resource per day
    
    total_mb = base_size + vm_size + container_size + history_size
    return f"{total_mb:.1f} MB"

# Examples:
# Small: 10 VMs, 5 containers, 30 days = 1.6 MB
# Medium: 50 VMs, 20 containers, 90 days = 7.8 MB  
# Large: 200 VMs, 100 containers, 365 days = 112.5 MB
```

## ⚡ Performance Optimization

### System Tuning
```bash
# Linux system optimizations
echo 'fs.file-max = 65536' >> /etc/sysctl.conf
echo 'net.core.somaxconn = 1024' >> /etc/sysctl.conf

# Node.js optimizations
export NODE_OPTIONS="--max-old-space-size=4096"
export UV_THREADPOOL_SIZE=128

# Database optimizations (PostgreSQL)
shared_buffers = 256MB
effective_cache_size = 1GB
max_connections = 100
```

### Monitoring & Alerts
```yaml
Recommended Monitoring:
  - CPU usage: Alert at 80%
  - Memory usage: Alert at 85%
  - Disk usage: Alert at 90%
  - API response time: Alert at >1s
  - Database connections: Alert at 90% of limit
  - Failed API calls: Alert at >5% error rate
```

## 🔍 Troubleshooting Requirements

### Common Environment Issues
1. **Node.js Version Conflicts**: Use nvm for version management
2. **Permission Issues**: Avoid running as root, use proper user permissions
3. **Network Connectivity**: Ensure Proxmox API access and proper routing
4. **SSL Certificate Issues**: Configure proper certificate handling
5. **Database Permissions**: Ensure proper file system permissions for SQLite

### Diagnostic Commands
```bash
# System verification
node --version                    # Check Node.js version
npm --version                     # Check npm version
proxmox-mpc --version            # Check installed version
proxmox-mpc /health              # Check system health

# Network verification
ping your-proxmox-server         # Basic connectivity
curl -k https://your-proxmox-server:8006/  # HTTPS access
telnet your-proxmox-server 8006  # Port accessibility

# Performance testing
proxmox-mpc cli test-connection -v  # API performance test
proxmox-mpc /debug enable          # Enable debug logging
```

---

**Ready to Install?**

Now that you understand the requirements, proceed with:

1. **[Installation Guide](installation.md)** - Install Proxmox-MPC
2. **[Authentication Setup](authentication.md)** - Configure Proxmox access  
3. **[Quick Start](quick-start.md)** - Get up and running
4. **[First Project](first-project.md)** - Create your first project