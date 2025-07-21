# Phase 1.2 Implementation Plan: Basic Proxmox Connection

## Overview
Implement basic Proxmox API client with authentication, connection testing, and error handling based on completed API research.

## Implementation Checklist

### 1. Basic API Client Structure
- [ ] Create `ProxmoxClient` class with configuration interface
- [ ] Implement API token authentication
- [ ] Add SSL certificate handling for homelab environments
- [ ] Set up HTTP client with proper headers and timeout
- [ ] Add base URL construction and endpoint routing

### 2. Core API Methods
- [ ] `connect()` - Test basic connectivity
- [ ] `getVersion()` - Get Proxmox version info
- [ ] `getNodes()` - List cluster nodes
- [ ] `getNodeStatus(node)` - Get specific node status
- [ ] Handle response parsing and error extraction

### 3. Error Handling & Response Processing
- [ ] Implement Proxmox-specific error response handling
- [ ] Add network error handling (timeout, connection refused)
- [ ] Handle SSL certificate errors gracefully
- [ ] Add response validation and type checking
- [ ] Implement retry logic for transient failures

### 4. CLI Integration
- [ ] Update `test-connection` command to use real API client
- [ ] Add verbose output option for debugging
- [ ] Implement configuration loading from environment
- [ ] Add connection status reporting with details

### 5. Testing Implementation
- [ ] Unit tests for API client methods
- [ ] Mock HTTP responses for testing
- [ ] Integration test with connection command
- [ ] Error scenario testing (invalid credentials, network issues)
- [ ] SSL certificate bypass testing

### 6. Configuration Management
- [ ] Environment variable validation
- [ ] Configuration file support (.env loading)
- [ ] Sensitive data handling (tokens, passwords)
- [ ] Connection parameter validation

## Technical Implementation Details

### API Client Architecture
```typescript
interface ProxmoxConfig {
  host: string;
  port: number;
  username: string;
  tokenId: string;
  tokenSecret: string;
  node: string;
  rejectUnauthorized?: boolean; // false for homelab
}

class ProxmoxClient {
  private config: ProxmoxConfig;
  private httpClient: AxiosInstance;
  
  async connect(): Promise<ConnectionResult>;
  async getVersion(): Promise<VersionInfo>;
  async getNodes(): Promise<NodeInfo[]>;
}
```

### Response Handling
```typescript
interface ProxmoxResponse<T = any> {
  data: T;
  errors?: Record<string, string>;
}

interface ConnectionResult {
  success: boolean;
  version?: string;
  node?: string;
  error?: string;
}
```

### Error Classification
- **Network Errors**: Connection refused, timeout, DNS resolution
- **Authentication Errors**: Invalid token, expired credentials
- **SSL Errors**: Certificate validation, self-signed certificates
- **API Errors**: Invalid endpoints, permission denied
- **Response Errors**: Malformed JSON, unexpected structure

## Testing Strategy

### Unit Tests (`src/api/__tests__/proxmox-client.test.ts`)
- API client instantiation and configuration
- HTTP request building and header setting
- Response parsing for success and error cases
- SSL certificate handling options
- Token authentication header formatting

### Integration Tests (`src/__tests__/connection.test.ts`)
- End-to-end connection testing with mock server
- CLI command execution and output validation
- Environment variable loading and validation
- Configuration file parsing

### Manual Testing Checklist
- [ ] CLI help command displays correctly
- [ ] `test-connection` with valid credentials succeeds
- [ ] `test-connection` with invalid credentials fails gracefully
- [ ] Connection works with self-signed certificates
- [ ] Verbose output shows connection details
- [ ] Error messages are user-friendly

## Environment Setup Requirements

### Required Environment Variables
```bash
PROXMOX_HOST=your-proxmox-server.local
PROXMOX_PORT=8006
PROXMOX_USERNAME=root@pam
PROXMOX_TOKEN_ID=your-token-id
PROXMOX_TOKEN_SECRET=your-token-secret
PROXMOX_NODE=pve
NODE_ENV=development
```

### Development vs Production
- **Development**: `rejectUnauthorized: false` for self-signed certs
- **Production**: `rejectUnauthorized: true` with proper CA certificates
- **Timeout**: 10 seconds for connection tests, 30 seconds for operations

## Success Criteria

### Functional Requirements
- [ ] Successfully authenticate with Proxmox API using tokens
- [ ] Retrieve and display Proxmox version information
- [ ] List cluster nodes and their status
- [ ] Handle self-signed SSL certificates in homelab environment
- [ ] Provide meaningful error messages for connection failures

### Technical Requirements
- [ ] All TypeScript code compiles without errors
- [ ] Unit tests achieve >80% code coverage
- [ ] Integration tests pass with mock Proxmox responses
- [ ] CLI commands execute within 5 seconds
- [ ] Error handling covers all identified scenarios

### Documentation Requirements
- [ ] API client interface documented with JSDoc
- [ ] Environment setup instructions updated
- [ ] Connection troubleshooting guide created
- [ ] Code examples for different authentication methods

## Implementation Order

1. **Foundation** (30 minutes)
   - Create ProxmoxClient class structure
   - Set up basic configuration interface
   - Add HTTP client setup with SSL handling

2. **Core Functionality** (45 minutes)
   - Implement authentication headers
   - Add connect() and getVersion() methods
   - Handle response parsing and errors

3. **CLI Integration** (30 minutes)
   - Update test-connection command
   - Add configuration loading
   - Implement output formatting

4. **Testing** (45 minutes)
   - Write unit tests for API client
   - Add integration tests for CLI
   - Manual testing with different scenarios

5. **Documentation & Polish** (30 minutes)
   - Add JSDoc comments
   - Update environment configuration
   - Create troubleshooting guide

**Total Estimated Time**: 3 hours

## Risk Mitigation

### Potential Issues
1. **SSL Certificate Problems**: Implemented bypass for homelab
2. **Authentication Failures**: Clear error messages and validation
3. **Network Connectivity**: Proper timeout and retry logic
4. **Response Format Changes**: Flexible response parsing
5. **Configuration Issues**: Comprehensive validation and defaults

### Fallback Plans
- Mock mode for development without Proxmox server
- Connection testing with different authentication methods
- Detailed logging for debugging connection issues
- Progressive enhancement (basic connectivity first, features later)

## Next Phase Prerequisites

Before moving to Phase 2 (Database & State Management):
- [ ] Basic Proxmox connectivity established
- [ ] API client reliably retrieves node and version information
- [ ] Error handling tested with various failure scenarios
- [ ] CLI provides clear user feedback for connection status
- [ ] All tests passing and code coverage acceptable