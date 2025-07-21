# Proxmox VE API Research

## API Overview

Proxmox VE provides a comprehensive RESTful API with JSON as the primary data format. The API is formally defined using JSON Schema and provides programmatic access to all functionality available in the web GUI.

**Base URL**: `https://your.server:8006/api2/json/`

## Authentication

### API Tokens (Recommended for Applications)
- **Format**: `PVEAPIToken=USER@REALM!TOKENID=UUID`
- **Header**: `Authorization: PVEAPIToken=root@pam!monitoring=aaaaaaaaa-bbb-cccc-dddd-ef0123456789`
- **Benefits**: Stateless, can have separate permissions and expiration dates
- **No CSRF Required**: API tokens don't need CSRF tokens for POST/PUT/DELETE

### Ticket-based Authentication
- **Endpoint**: `/access/ticket`
- **Expiration**: 2 hours
- **CSRF Required**: Write operations need CSRFPreventionToken header

## Core API Endpoints

### Cluster & Node Management
- `GET /version` - Get API version
- `GET /nodes` - List all cluster nodes
- `GET /nodes/{node}` - Get node information
- `GET /nodes/{node}/status` - Get node status
- `GET /cluster` - Cluster information

### Virtual Machines (QEMU)
- `GET /nodes/{node}/qemu` - List VMs on node
- `GET /nodes/{node}/qemu/{vmid}` - Get VM configuration
- `GET /nodes/{node}/qemu/{vmid}/status/current` - Get VM status
- `POST /nodes/{node}/qemu` - Create VM
- `POST /nodes/{node}/qemu/{vmid}/status/start` - Start VM
- `POST /nodes/{node}/qemu/{vmid}/status/stop` - Stop VM
- `POST /nodes/{node}/qemu/{vmid}/status/shutdown` - Shutdown VM
- `DELETE /nodes/{node}/qemu/{vmid}` - Delete VM

### Containers (LXC)
- `GET /nodes/{node}/lxc` - List containers on node
- `GET /nodes/{node}/lxc/{vmid}` - Get container configuration
- `GET /nodes/{node}/lxc/{vmid}/status/current` - Get container status
- `POST /nodes/{node}/lxc` - Create container
- `POST /nodes/{node}/lxc/{vmid}/status/start` - Start container
- `POST /nodes/{node}/lxc/{vmid}/status/stop` - Stop container
- `DELETE /nodes/{node}/lxc/{vmid}` - Delete container

### Storage
- `GET /storage` - List storage
- `GET /nodes/{node}/storage` - List storage on node
- `GET /nodes/{node}/storage/{storage}` - Get storage configuration

### Access Management
- `GET /access/users` - List users
- `GET /access/groups` - List groups
- `GET /access/roles` - List roles

## Key Implementation Notes

1. **Task-based Operations**: Many operations return a task ID (UPID) for tracking async operations
2. **Response Format**: All responses follow JSON format with consistent structure
3. **Error Handling**: Standard HTTP status codes with JSON error responses
4. **Permissions**: Operations respect Proxmox user permissions and roles
5. **Version Compatibility**: API stays compatible within major versions (e.g., 8.x)
6. **SSL Certificates**: Proxmox uses self-signed certificates by default in homelab environments
7. **Certificate Validation**: API clients must handle certificate validation (ignore for homelab, verify for production)

## Response Structure Details

### Successful Task Creation Response
```json
{ "data": "UPID:pve4:00002F9D:000DC5EA:57500527:vzcreate:602:root@pam:" }
```

### UPID Format
`UPID:<node>:<pid_hex>:<pstart_hex>:<starttime_hex>:<type>:<id>:<user>@<realm>:`

### Task Status Response
```json
{
  "data": {
    "id": "123",
    "status": "stopped",
    "node": "node01",
    "starttime": 1603726401,
    "type": "qmsnapshot",
    "exitstatus": "OK",
    "upid": "UPID:node01:003B39D7:0342BCB8:5F96EC41:qmsnapshot:123:user@pve!token:"
  }
}
```

### Error Response
```json
{ 
  "data": null, 
  "errors": { 
    "upid": "unable to parse worker upid" 
  } 
}
```

## Additional Critical Endpoints

### Task Management
- `GET /nodes/{node}/tasks/{upid}/status` - Get task status
- `GET /nodes/{node}/tasks/{upid}/log` - Get task log
- `GET /nodes/{node}/tasks` - List node tasks

### Certificate/SSL Handling
- **Default**: Self-signed certificates on port 8006
- **Homelab**: Disable SSL verification (`verify: false` in requests)
- **Production**: Use proper CA certificates or Let's Encrypt

## Required Environment Variables

```bash
PROXMOX_HOST=your-proxmox-server.local
PROXMOX_PORT=8006
PROXMOX_USERNAME=root@pam
PROXMOX_TOKEN_ID=your-token-id
PROXMOX_TOKEN_SECRET=your-token-secret
PROXMOX_NODE=pve
```

## Next Implementation Steps

1. Create basic API client with token authentication
2. Implement connection testing
3. Add basic resource listing (nodes, VMs, containers)
4. Handle async task polling for operations
5. Add comprehensive error handling

## Implementation Considerations

### SSL/Certificate Handling
```javascript
// For homelab (ignore self-signed certificates)
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

// For production (verify certificates)
const httpsAgent = new https.Agent({
  rejectUnauthorized: true
});
```

### Task Polling Strategy
- **Polling Interval**: 1-2 seconds for short tasks, 5-10 seconds for long tasks
- **Timeout**: 5 minutes for VM operations, 30 minutes for storage operations
- **Status Check**: Monitor `exitstatus` field ("OK" = success, other = error)

### Rate Limiting
- **Recommendation**: Max 10 requests per second per API token
- **Batch Operations**: Use single calls with multiple resources when possible

## Testing Requirements

- Connection test with valid/invalid credentials
- API endpoint availability verification  
- Response format validation (success and error cases)
- Error handling for network issues
- Token expiration/permission handling
- SSL certificate validation bypass (homelab)
- Task polling timeout scenarios
- UPID parsing and status tracking