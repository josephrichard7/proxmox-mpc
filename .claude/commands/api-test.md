---
description: Test Proxmox API endpoints and validate responses
tools: ["Read", "Write", "Edit", "Bash", "Grep", "Glob"]
---

# Proxmox API Testing for Proxmox-MPC

Test Proxmox API endpoints, validate responses, and ensure robust error handling.

## Task Description
$ARGUMENTS

## Implementation Guidelines

### API Client Context
- **Client Location**: `src/api/proxmox-client.ts`
- **Authentication**: API token with SSL certificate bypass for homelab
- **Base URL**: Currently configured for `192.168.0.19:8006`
- **API Version**: Proxmox VE API v2

### Current API Capabilities
```typescript
// Available methods in ProxmoxClient
class ProxmoxClient {
  async testConnection(): Promise<ApiResponse>
  async getNodes(): Promise<ApiResponse>
  async getNodeStatus(node: string): Promise<ApiResponse>
  async getVMs(node: string): Promise<ApiResponse>
  async getContainers(node: string): Promise<ApiResponse>
  async getStorage(node?: string): Promise<ApiResponse>
  async getTasks(node: string): Promise<ApiResponse>
  // + 5 more discovery endpoints
}
```

### Testing Requirements

#### 1. API Response Validation
- Verify response structure matches Proxmox API documentation
- Check status codes (200, 401, 403, 500, etc.)
- Validate JSON schema of response data
- Test pagination for large datasets

#### 2. Authentication Testing
- Valid API token scenarios
- Invalid/expired token handling
- Missing authentication headers
- Permission-based access restrictions

#### 3. Network Error Handling
- Connection timeouts
- SSL certificate issues (homelab self-signed)
- Network connectivity problems
- DNS resolution failures

#### 4. Error Response Testing
- HTTP error codes with proper messages
- Proxmox-specific error formats
- Rate limiting responses
- Malformed request handling

### Testing Process

#### Manual Testing Against Real Server
```bash
# Test connection
npm run cli test-connection -v

# Test node listing
npm run cli list-nodes -v

# Test discovery commands
npm run cli discover-all -v
npm run cli discover-vms -v
npm run cli discover-containers -v
```

#### Unit Testing Pattern
```typescript
// Follow existing test pattern from __tests__/
describe('ProxmoxClient API Tests', () => {
  beforeEach(() => {
    // Setup mock or real client
  })
  
  it('should handle successful API response', async () => {
    // Test implementation
  })
  
  it('should handle authentication errors', async () => {
    // Test auth failures
  })
})
```

### API Coverage Tracking
- **Current Coverage**: 25% (12/48 core endpoints)
- **Target for Phase 2.3**: 45% coverage
- **Priority Endpoints**: VM/Container lifecycle operations

### Error Handling Standards
```typescript
// Expected error handling pattern
try {
  const response = await proxmoxClient.getVMs(nodeName)
  if (!response.success) {
    throw new ProxmoxApiError(response.error, response.status)
  }
  return response.data
} catch (error) {
  if (error instanceof NetworkError) {
    // Handle network issues
  } else if (error instanceof AuthenticationError) {
    // Handle auth issues
  }
  throw error
}
```

### Documentation Requirements
- Update API coverage in `docs/proxmox-api-coverage.md`
- Document new endpoints with examples
- Record error scenarios and solutions
- Update CLI help text for new commands

### Commands to Run After Testing
```bash
# Run API-specific tests
npm test -- --testPathPattern=api

# Run CLI integration tests
npm test -- --testPathPattern=cli

# Check overall coverage
npm run test:coverage

# Manual validation
npm run cli test-connection -v
```

## Context Files to Reference
- `@src/api/proxmox-client.ts` - Main API client implementation
- `@src/api/config.ts` - Configuration and environment setup
- `@docs/proxmox-api-research.md` - Comprehensive API documentation
- `@docs/proxmox-api-coverage.md` - Current API coverage tracking
- `@src/cli/index.ts` - CLI integration for manual testing