# Development Guide

This guide contains essential information for developing and testing Proxmox-MPC.

## Essential Commands

```bash
npm run build          # Compile TypeScript to JavaScript
npm run console        # Start interactive console (main interface)
npm run cli            # Run CLI commands (legacy interface)
npm test               # Run all tests
npm run test:watch     # Run tests in watch mode
npm run test:coverage  # Run tests with coverage report
npm run lint           # Lint source code
npm run format         # Format code with Prettier
npm run typecheck      # TypeScript compilation check
```

## Running Individual Tests

```bash
# Run a specific test file
npx jest src/console/__tests__/session.test.ts

# Run tests matching a pattern
npx jest --testNamePattern="init command"

# Run tests with verbose output
npx jest --verbose

# Run a specific test suite
npx jest src/database/__tests__/repository-integration.test.ts -t "VMRepository"
```

## Code Style Guidelines

### Imports
- Use ES6 import syntax
- Import third-party libraries first, then local modules
- Use specific imports rather than namespace imports
- Group imports logically (Node.js core, external libraries, internal modules)

### Formatting
- 2-space indentation
- No trailing whitespace
- Line length maximum 100 characters
- Consistent spacing around operators
- Trailing commas in multiline objects/arrays

### Types and Naming
- Use TypeScript interfaces for data structures
- PascalCase for classes, interfaces, and types
- camelCase for variables, functions, and methods
- UPPER_CASE for constants
- Descriptive variable names over abbreviations

### Error Handling
- Use custom error classes (RepositoryError, NotFoundError, ValidationError)
- Throw errors with descriptive messages
- Handle errors at appropriate levels
- Use try/catch blocks for async operations

### General Conventions
- Use async/await for asynchronous operations
- Write comprehensive tests for new functionality
- Document public APIs with JSDoc comments
- Follow existing patterns in the codebase
- Maintain high test coverage

## Testing the /init Command

### Test Instructions

1. **Create Test Workspace**
```bash
mkdir ~/test-proxmox-init
cd ~/test-proxmox-init
```

2. **Launch Global Console**
```bash
proxmox-mpc
```

3. **Try the /init Command**
```bash
proxmox-mpc> /init
```

**Expected behavior:**
- Should start interactive workspace initialization
- Prompts for Proxmox server details
- Creates `.proxmox/` directory with config and database
- Generates project structure (terraform/, ansible/, docs/)

### Example Input Values
```
Proxmox Host: 192.168.1.100
Port: 8006
Username: root@pam
API Token ID: proxmox-mpc
API Token Secret: your-secret-here
Default Node: pve
Reject unauthorized SSL: n
```

### Expected Results
```
✅ Project workspace initialized successfully!
   📁 Project: [generated name]
   🗄️  Database: .proxmox/state.db
   ⚙️  Config: .proxmox/config.yml

🎯 Next steps:
   • Use /status to check server connectivity
   • Use /sync to import existing infrastructure
   • Start creating resources with "create vm --name <name>"
```

## Global Installation Setup

The `proxmox-mpc` command is globally accessible. For configuration:

### Environment Variables (Recommended)
Add to shell profile (`~/.bashrc`, `~/.zshrc`):

```bash
export PROXMOX_HOST="192.168.x.x"
export PROXMOX_USERNAME="root@pam"
export PROXMOX_TOKEN_ID="proxmox-mpc"
export PROXMOX_TOKEN_SECRET="your-secret-here"
export PROXMOX_SKIP_TLS_VERIFY="true"
```

### Global Config File
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

## Proxmox API Token Setup

1. Access Proxmox Web UI: `https://your-proxmox-ip:8006`
2. Navigate: Datacenter → Permissions → API Tokens
3. Add Token:
   - User: `root@pam`
   - Token ID: `proxmox-mpc`
   - Privilege Separation: **Unchecked** (for testing)
4. Copy the secret (you only see it once!)
5. Update your config with the token details

## Interactive Input Fixes

### What Was Fixed
1. **Readline Interface Conflict**: Main console and init command were competing for stdin
2. **Character Echo Issues**: Password input now properly uses raw mode
3. **Input Handling**: All prompts use the same readline interface

### Architecture Changes
- `ConsoleSession` includes `rl: readline.Interface` property
- `InitCommand` uses session's readline interface
- Password input properly manages raw mode and input echoing
- All interactive prompts share the same event loop

## Test Suite Recovery Notes

### Quality Metrics
- Target test success rate: >90%
- Lint errors: 0 remaining issues
- TypeScript compilation: No errors
- Build process: Successful completion

### Common Issues and Prevention
1. **Test Isolation**: Tests affecting each other's state
2. **Mock Configuration**: Improper mock setup causing failures
3. **Timeout Management**: Insufficient timeouts for complex operations
4. **Code Quality Drift**: Accumulated technical debt

### Prevention Strategies
1. Pre-commit hooks for lint checking
2. Test quality gates with >90% success rate requirement
3. Regular validation through weekly test suite runs
4. Accurate progress tracking and documentation