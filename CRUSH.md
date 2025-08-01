# CRUSH.md - Development Guide for Proxmox-MPC

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