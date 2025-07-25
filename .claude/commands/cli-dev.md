---
description: Develop CLI commands using Commander.js framework
tools: ["Read", "Write", "Edit", "Bash", "Grep", "Glob"]
---

# CLI Development for Proxmox-MPC

Develop professional CLI commands using Commander.js framework with consistent patterns and user experience.

## Task Description
$ARGUMENTS

## Implementation Guidelines

### CLI Framework
- **Library**: Commander.js v11+
- **Entry Point**: `src/cli/index.ts`
- **Pattern**: Command-based with subcommands
- **Output**: Structured JSON/table formats with verbose modes

### Current CLI Structure
```bash
# Available commands
npm run cli test-connection [-v]    # Test Proxmox API connectivity
npm run cli list-nodes [-v]         # List cluster nodes
npm run cli discover-all [-v]       # Discover all resources
npm run cli discover-vms [-v]       # Discover VMs only
npm run cli discover-containers [-v] # Discover containers only
npm run cli discover-storage [-v]   # Discover storage pools
npm run cli discover-tasks [-v]     # Discover recent tasks
```

### Command Development Pattern

#### Basic Command Structure
```typescript
// Follow this pattern from existing commands
program
  .command('command-name')
  .description('Clear description of what this command does')
  .option('-v, --verbose', 'Enable verbose output')
  .option('-f, --format <type>', 'Output format (json|table)', 'table')
  .action(async (options) => {
    try {
      // 1. Initialize clients (API, database)
      // 2. Execute operation with proper error handling
      // 3. Format and display results
      // 4. Handle verbose output if requested
    } catch (error) {
      // Consistent error handling
    }
  })
```

#### Output Formatting Standards
```typescript
// Use these helpers for consistent output
interface CommandOutput {
  success: boolean
  data?: any
  message?: string
  details?: any
}

// For verbose mode
if (options.verbose) {
  console.log('Debug information:', details)
}

// For table output (default)
console.table(formattedData)

// For JSON output
if (options.format === 'json') {
  console.log(JSON.stringify(data, null, 2))
}
```

### Command Categories

#### 1. Discovery Commands (✅ IMPLEMENTED)
- `discover-all` - Complete resource discovery
- `discover-vms` - VM discovery only  
- `discover-containers` - Container discovery only
- `discover-storage` - Storage discovery
- `discover-tasks` - Task history

#### 2. Management Commands (🚧 PHASE 2.3 TARGET)
- `vm create` - Create new VM
- `vm start/stop/restart` - VM lifecycle
- `vm delete` - Remove VM with confirmation
- `container create/start/stop/delete` - Container operations

#### 3. Configuration Commands (⏳ PHASE 4 TARGET)
- `apply -f config.yaml` - Apply declarative configuration
- `diff -f config.yaml` - Show configuration differences  
- `validate -f config.yaml` - Validate configuration files

#### 4. Advanced Commands (⏳ FUTURE PHASES)
- `install chart-name` - Deploy template-based resources
- `upgrade/rollback` - Manage deployments

### CLI Integration Requirements

#### Database Integration
```typescript
// Initialize database client for commands that need persistence
const dbClient = createDatabaseClient()
const nodeRepo = new NodeRepository(dbClient)

// Store discovered state for comparison
await nodeRepo.saveDiscoveredState(nodeData)
```

#### API Client Integration
```typescript
// Use existing API client
const apiClient = createProxmoxClient()
const response = await apiClient.getVMs(nodeName)

if (!response.success) {
  throw new Error(`API Error: ${response.error}`)
}
```

#### Error Handling Standards
```typescript
// Consistent error handling across all commands
try {
  // Command implementation
} catch (error) {
  if (error instanceof ProxmoxApiError) {
    console.error(`❌ API Error: ${error.message}`)
  } else if (error instanceof DatabaseError) {
    console.error(`❌ Database Error: ${error.message}`)
  } else {
    console.error(`❌ Unexpected Error: ${error.message}`)
  }
  
  if (options.verbose) {
    console.error('Stack trace:', error.stack)
  }
  
  process.exit(1)
}
```

### User Experience Requirements

#### Confirmation Prompts for Destructive Operations
```typescript
import { confirm } from '@inquirer/prompts'

// For delete operations
const confirmed = await confirm({
  message: `Are you sure you want to delete VM "${vmName}"?`,
  default: false
})

if (!confirmed) {
  console.log('Operation cancelled.')
  return
}
```

#### Progress Indicators for Long Operations
```typescript
import ora from 'ora'

const spinner = ora('Creating VM...').start()
try {
  await createVM(vmConfig)
  spinner.succeed('VM created successfully')
} catch (error) {
  spinner.fail('Failed to create VM')
  throw error
}
```

#### Help Text and Examples
```typescript
.command('vm create')
.description('Create a new virtual machine')
.argument('<name>', 'VM name')
.option('-n, --node <node>', 'Target node name')
.option('-m, --memory <mb>', 'Memory in MB', '2048')
.option('-c, --cores <count>', 'CPU cores', '2')
.addOption(new Option('-t, --template <name>', 'VM template to use'))
.addHelpText('after', `
Examples:
  $ proxmox-cli vm create web-server --node pve-node1 --memory 4096 --cores 4
  $ proxmox-cli vm create database --node pve-node2 --template debian-12
`)
```

### Testing Requirements

#### CLI Integration Testing
```bash
# Test all commands manually
npm run cli test-connection -v
npm run cli discover-all -v

# Run CLI-specific tests
npm test -- --testPathPattern=cli

# Check for consistent output formats
npm run cli discover-vms --format json | jq .
```

#### Test Coverage Requirements
- Unit tests for command logic
- Integration tests with mock API responses
- Error scenario testing
- Output format validation

### Commands to Run During Development
```bash
# Run CLI in development mode
npm run dev:cli command-name --verbose

# Build and test
npm run build
npm test -- --testPathPattern=cli

# Manual testing
npm run cli help
npm run cli command-name --help
```

## Context Files to Reference
- `@src/cli/index.ts` - Current CLI implementation
- `@src/api/proxmox-client.ts` - API client for integration
- `@src/database/repositories/` - Database repositories for state management
- `@package.json` - CLI script definitions and dependencies
- `@docs/phase-2.2-implementation.md` - Discovery command implementation details