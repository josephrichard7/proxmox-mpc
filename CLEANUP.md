# Proxmox-MPC Codebase Cleanup Plan

This document provides a comprehensive plan for cleaning up the Proxmox-MPC codebase. Each task includes a unique identifier, priority level, estimated impact, and risk assessment.

## Overview

Based on analysis of the entire codebase, the following areas need attention:
- **Unused and duplicate files**: Multiple REPL implementations, empty directories
- **Documentation bloat**: 10+ markdown files with overlapping content
- **Build artifacts**: Untracked compiled files and coverage reports
- **Console.log pollution**: 1558+ console statements across 41 files
- **Missing implementations**: TODO comments and stub functions
- **Pattern inconsistencies**: Multiple approaches to similar problems
- **Test redundancy**: Overlapping test files and setups

---

## Phase 1: Remove Unused Files and Dead Code

### High Priority Tasks

- [x] **CLEAN-001**: Remove unused REPL implementations ✅
  - **Impact**: High - Reduces confusion about which REPL to use
  - **Risk**: Low - Multiple REPL classes exist with similar functionality
  - **Files**: `src/console/simple-repl.ts`, `src/console/enhanced-repl.ts` (keep main `repl.ts`)
  - **Verification**: Ensure no imports reference removed files
  - **Time**: 15 minutes
  - **Completed**: Removed both unused REPL implementations and their test files

- [x] **CLEAN-002**: Remove empty generator directories ✅
  - **Impact**: Medium - Cleans up project structure
  - **Risk**: Low - Directories are empty
  - **Files**: `src/generators/ansible/`, `src/generators/terraform/`
  - **Verification**: Check no references to these paths exist
  - **Time**: 5 minutes
  - **Completed**: Removed both empty directories, no code references found

- [x] **CLEAN-003**: Clean up root-level documentation files ✅
  - **Impact**: High - Reduces documentation confusion
  - **Risk**: Medium - Need to preserve important info
  - **Files**: Remove/consolidate: `CRUSH.md`, `TEST-INIT.md`, `MANUAL-TEST.md`, `GLOBAL-SETUP.md`, `RECOVERY-PLAN.md`
  - **Verification**: Archive important content in appropriate files
  - **Time**: 30 minutes
  - **Completed**: Consolidated important information into `docs/DEVELOPMENT.md` and removed original files

- [x] **CLEAN-004**: Remove build artifacts from git tracking ✅
  - **Impact**: Medium - Reduces repo size and confusion
  - **Risk**: Low - Build artifacts shouldn't be tracked
  - **Files**: `dist/`, `temp-dist/`, `.tgz` packages, `coverage/`
  - **Verification**: Update `.gitignore` to prevent future tracking
  - **Time**: 10 minutes
  - **Completed**: Removed all build artifacts and added `temp-dist/` to .gitignore

- [x] **CLEAN-005**: Remove debug and test workspace files ✅
  - **Impact**: Medium - Cleans up working directory
  - **Risk**: Low - These are temporary files
  - **Files**: `debug-workspace.js`, `test-workspace-*/`, `test-status/`, `test-command.js`
  - **Verification**: Ensure no active development dependencies
  - **Time**: 5 minutes
  - **Completed**: Removed debug scripts and test workspaces, moved `test-console.md` to `docs/CONSOLE-TESTING.md`

### Medium Priority Tasks

- [x] **CLEAN-006**: Remove redundant test setup files ✅
  - **Impact**: Medium - Simplifies test configuration
  - **Risk**: Medium - Need to ensure tests still work
  - **Files**: `src/observability/__tests__/setup.js`, duplicate Jest configs
  - **Verification**: Run test suite after removal
  - **Time**: 20 minutes
  - **Completed**: Removed unused Jest config and setup.js files from observability tests - main Jest config handles all tests

- [x] **CLEAN-007**: Remove unused shell scripts
  - **Impact**: Low - Minor cleanup
  - **Risk**: Low - Scripts appear to be one-off utilities
  - **Files**: `setup-test.sh`, `start-console.sh`
  - **Verification**: Check if referenced in package.json or docs
  - **Time**: 10 minutes
  - **Completed**: Removed unused shell scripts - functionality replaced by proper npm scripts and binary setup

---

## Phase 2: Consolidate Duplicate Code

### High Priority Tasks

- [x] **CLEAN-008**: ~~Consolidate REPL event handlers~~ (N/A - already resolved)
  - **Impact**: High - Eliminates duplicate event handling logic
  - **Risk**: Medium - Need to preserve all functionality
  - **Files**: Similar event handlers in `repl.ts`, `simple-repl.ts`, `enhanced-repl.ts`
  - **Verification**: Test all console commands work correctly
  - **Time**: 45 minutes
  - **Note**: Not applicable - simple-repl.ts and enhanced-repl.ts were already removed in CLEAN-001

- [x] **CLEAN-009**: Merge duplicate console test files ✅
  - **Impact**: Medium - Reduces test maintenance burden
  - **Risk**: Medium - Need to preserve test coverage
  - **Files**: `__tests__/console-integration.test.ts`, `__tests__/console/repl.test.ts`
  - **Verification**: Ensure test coverage remains >80%
  - **Time**: 30 minutes
  - **Completed**: Removed duplicate `commands-simple.test.ts` file. The `console-integration.test.ts` was already removed in CLEAN-001. Main REPL tests in `repl.test.ts` are preserved with comprehensive coverage of InteractiveConsole functionality.

- [x] **CLEAN-010**: Consolidate repository export patterns ✅ **COMPLETED**
  - **Impact**: Medium - Standardizes export approach  
  - **Risk**: Low - Just reorganizing exports
  - **Files**: Removed redundant `repositories.ts`, consolidated exports through `repositories/index.ts`
  - **Verification**: All imports resolve correctly, TypeScript compilation passes
  - **Time**: 15 minutes

### Medium Priority Tasks

- [x] **CLEAN-011**: Unify error handling patterns ✅ **COMPLETED**
  - **Impact**: High - Improves consistency and debugging
  - **Risk**: Medium - Changes error handling behavior
  - **Files**: Inconsistent error handling across console commands
  - **Verification**: Test error scenarios work correctly
  - **Time**: 60 minutes
  - **Completed**: Created unified error handler with consistent message formatting, validation, and user guidance across all console commands

- [x] **CLEAN-012**: Standardize import/export patterns ✅ **COMPLETED**
  - **Impact**: Medium - Improves code organization
  - **Risk**: Low - Mostly reorganization
  - **Files**: Mix of `export *` and named exports across modules
  - **Verification**: Ensure all imports compile correctly
  - **Time**: 30 minutes
  - **Completed**: Standardized all import/export patterns to use explicit named exports for better tree-shaking, IDE support, and clarity. Removed unused default export from console/index.ts. All TypeScript compilation passes.

---

## Phase 3: Replace Console.log with Proper Logging

### High Priority Tasks

- [ ] **CLEAN-013**: Replace console.log in core console commands
  - **Impact**: High - Improves debugging and production behavior
  - **Risk**: Low - Logger system already exists
  - **Files**: Console commands (41 files, ~1558 occurrences)
  - **Verification**: Test commands produce expected output
  - **Time**: 90 minutes

- [ ] **CLEAN-014**: Replace console.log in API client
  - **Impact**: High - Improves API debugging
  - **Risk**: Low - Replace with structured logging
  - **Files**: `src/api/proxmox-client.ts` (4 occurrences)
  - **Verification**: Test API operations log correctly
  - **Time**: 15 minutes

- [ ] **CLEAN-015**: Replace console.log in database repositories
  - **Impact**: Medium - Improves database operation visibility
  - **Risk**: Low - Repository operations need proper logging
  - **Files**: All repository files (6 occurrences)
  - **Verification**: Test database operations log correctly
  - **Time**: 20 minutes

### Low Priority Tasks

- [ ] **CLEAN-016**: Clean up test console.log statements
  - **Impact**: Low - Cleaner test output
  - **Risk**: Low - Test-only changes
  - **Files**: Test files with console.log (reduce to necessary only)
  - **Verification**: Tests still provide useful output
  - **Time**: 30 minutes

---

## Phase 4: Implement Missing Features and Remove TODOs

### High Priority Tasks

- [ ] **CLEAN-017**: Implement resource command parsing (console/repl.ts)
  - **Impact**: High - Core functionality missing
  - **Risk**: High - Significant implementation work
  - **Files**: `src/console/repl.ts:99` - TODO comment
  - **Verification**: Test resource commands work end-to-end
  - **Time**: 120 minutes

- [ ] **CLEAN-018**: Implement database synchronization (sync command)
  - **Impact**: High - Key feature missing
  - **Risk**: High - Complex state management
  - **Files**: `src/console/commands/sync.ts` - TODO comment
  - **Verification**: Test sync operation with real Proxmox server
  - **Time**: 180 minutes

- [ ] **CLEAN-019**: Implement workspace database initialization
  - **Impact**: High - Project setup functionality
  - **Risk**: Medium - Database schema already defined
  - **Files**: `src/workspace/index.ts` - TODO comment
  - **Verification**: Test workspace initialization creates database
  - **Time**: 60 minutes

### Medium Priority Tasks

- [ ] **CLEAN-020**: Configure Terraform template detection
  - **Impact**: Medium - Makes generated configs more accurate
  - **Risk**: Low - Enhancement to existing generation
  - **Files**: `src/generators/terraform.ts` - 3 TODO comments
  - **Verification**: Generated Terraform uses correct templates
  - **Time**: 45 minutes

- [ ] **CLEAN-021**: Enable disabled integration tests
  - **Impact**: Medium - Improves test coverage
  - **Risk**: Medium - Tests may need implementation work
  - **Files**: `src/__tests__/console-integration.test.ts` - TODO comment
  - **Verification**: Integration tests pass consistently
  - **Time**: 60 minutes

---

## Phase 5: Simplify Over-engineered Solutions

### Medium Priority Tasks

- [ ] **CLEAN-022**: Simplify diagnostics system complexity
  - **Impact**: Medium - Reduces maintenance burden
  - **Risk**: Medium - Complex singleton pattern with multiple dependencies
  - **Files**: `src/observability/diagnostics.ts` - Overly complex for current needs
  - **Verification**: Health checks still work correctly
  - **Time**: 90 minutes

- [ ] **CLEAN-023**: Simplify MCP server implementation
  - **Impact**: Medium - Reduces complexity for unused feature
  - **Risk**: Low - Feature not actively used yet
  - **Files**: `src/mcp/` directory - Complex implementation for future feature
  - **Verification**: MCP tests still pass if keeping implementation
  - **Time**: 60 minutes

- [ ] **CLEAN-024**: Consolidate observability singleton patterns
  - **Impact**: Medium - Reduces pattern complexity
  - **Risk**: Medium - Multiple singleton classes with similar patterns
  - **Files**: `Logger`, `MetricsCollector`, `Tracer`, `DiagnosticsCollector`
  - **Verification**: All observability features work correctly
  - **Time**: 75 minutes

### Low Priority Tasks

- [ ] **CLEAN-025**: Simplify session management
  - **Impact**: Low - Complex session handling for simple use case
  - **Risk**: Low - Session management could be simplified
  - **Files**: `src/console/session.ts` - Complex state management
  - **Verification**: Console sessions work correctly
  - **Time**: 45 minutes

---

## Phase 6: Standardize Patterns and Conventions

### Medium Priority Tasks

- [ ] **CLEAN-026**: Standardize command interface patterns
  - **Impact**: High - Improves consistency and maintainability
  - **Risk**: Medium - Changes to multiple command implementations
  - **Files**: Console commands use different patterns for similar operations
  - **Verification**: All commands work consistently
  - **Time**: 90 minutes

- [ ] **CLEAN-027**: Standardize async/await patterns
  - **Impact**: Medium - Improves code consistency
  - **Risk**: Low - Mostly style changes
  - **Files**: Mix of Promise and async/await patterns throughout codebase
  - **Verification**: All async operations work correctly
  - **Time**: 60 minutes

- [ ] **CLEAN-028**: Unify configuration handling patterns
  - **Impact**: Medium - Centralizes configuration logic
  - **Risk**: Medium - Configuration used in multiple places
  - **Files**: Configuration handling spread across multiple files
  - **Verification**: Configuration loading works in all contexts
  - **Time**: 45 minutes

### Low Priority Tasks

- [ ] **CLEAN-029**: Standardize TypeScript import order
  - **Impact**: Low - Code style improvement
  - **Risk**: Low - Only affects code organization
  - **Files**: Inconsistent import ordering throughout codebase
  - **Verification**: Code compiles correctly
  - **Time**: 30 minutes

- [ ] **CLEAN-030**: Standardize JSDoc comment patterns
  - **Impact**: Low - Documentation consistency
  - **Risk**: Low - Documentation-only changes
  - **Files**: Inconsistent JSDoc usage across files
  - **Verification**: Generated docs look consistent
  - **Time**: 45 minutes

---

## Summary Statistics

**Total Tasks**: 30
- **High Priority**: 12 tasks (~19 hours)
- **Medium Priority**: 14 tasks (~12 hours) 
- **Low Priority**: 4 tasks (~3 hours)

**Total Estimated Time**: ~34 hours

**Risk Distribution**:
- **High Risk**: 3 tasks (significant implementation work)
- **Medium Risk**: 12 tasks (require careful testing)
- **Low Risk**: 15 tasks (safe refactoring)

**Expected Impact**:
- **Codebase size reduction**: ~20% (removing unused files, duplicate code)
- **Maintainability improvement**: Significant (consistent patterns, proper logging)
- **Test coverage**: Maintained at >80%
- **Documentation clarity**: Major improvement (consolidated docs)

## Execution Strategy

1. **Start with Phase 1**: Remove unused files (low risk, immediate impact)
2. **Prioritize high-priority tasks**: Address core functionality gaps
3. **Batch related changes**: Group similar tasks for efficiency
4. **Test incrementally**: Run tests after each phase
5. **Document changes**: Update CLAUDE.md and README.md as needed

## Validation Checklist

After completing each phase:
- [ ] All tests pass (`npm test`)
- [ ] TypeScript compiles without errors (`npm run typecheck`)
- [ ] Linting passes (`npm run lint`)
- [ ] Manual console testing works
- [ ] CLI commands function correctly
- [ ] No broken imports or missing dependencies