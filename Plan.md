# Proxmox-MPC Test Stabilization & Core Functionality Plan

**Target**: Achieve >90% test success rate (450+ passing tests) and stabilize core functionality
**Current Status**: 86.1% success rate (427/496 tests passing, 69 failing)
**Timeline**: 3-4 days intensive focus

## Phase 1: Database Foundation Layer (Critical Priority)
*Dependencies: None | Timeline: Day 1 (6-8 hours) | Target: Fix all database-related test failures*

### TEST-001: Fix Database Test Cleanup & Isolation Issues
**File**: `src/__tests__/utils/database-test-helper.ts`
**Issue**: Foreign key constraint violations during test cleanup
**Priority**: P0 (Blocking all DB tests)
- [ ] Add proper transaction rollback mechanism for test isolation
- [ ] Implement database state verification before/after each test
- [ ] Add retry logic for cleanup operations with exponential backoff
- [ ] Create database schema validation utilities
**Validation**: All database tests should complete cleanup without foreign key errors
**Estimated Time**: 45 minutes

### TEST-002: Resolve Storage Table Unique Constraint Violations
**File**: `src/database/__tests__/integration.test.ts:46`
**Issue**: Unique constraint failed on storage.id during test execution
**Priority**: P0 (Blocking integration tests)
- [ ] Add unique ID generation for test storage entries
- [ ] Implement test-specific storage cleanup between test cases
- [ ] Add storage table existence validation before operations
- [ ] Create storage factory for test data generation
**Validation**: Integration tests create storage without unique constraint errors
**Estimated Time**: 30 minutes

### TEST-003: Fix Database Repository Pattern Implementation
**File**: `src/database/__tests__/repository-pattern.test.ts`
**Issue**: Repository CRUD operations failing due to validation layer issues
**Priority**: P1 (Core functionality)
- [ ] Fix repository create/update validation logic
- [ ] Implement proper error handling for database constraint violations
- [ ] Add input sanitization and validation for all repository operations
- [ ] Create repository method unit tests with mocked database calls
**Validation**: All repository CRUD operations work with proper validation
**Estimated Time**: 60 minutes

### TEST-004: Stabilize Database CRUD Operations Layer
**File**: `src/database/__tests__/crud-operations.test.ts`
**Issue**: Basic CRUD operations failing due to schema/validation issues
**Priority**: P1 (Foundation layer)
- [ ] Fix node-vm-container relationship handling in CRUD operations
- [ ] Implement proper cascade delete rules and validation
- [ ] Add transaction support for multi-table operations
- [ ] Create comprehensive CRUD operation error handling
**Validation**: All basic CRUD operations pass with proper relationship handling
**Estimated Time**: 75 minutes

### TEST-005: Fix Repository Integration Test Suite
**File**: `src/database/__tests__/repository-integration.test.ts`
**Issue**: Complete lifecycle simulation failing due to relationship issues
**Priority**: P1 (End-to-end database functionality)
- [ ] Fix node creation and dependency relationship setup
- [ ] Implement proper test data factory patterns
- [ ] Add integration test data seeding and cleanup utilities
- [ ] Create repository health check validation
**Validation**: Complete Proxmox cluster simulation test passes
**Estimated Time**: 90 minutes

### TEST-006: Database Validation Layer Fixes
**File**: `src/database/__tests__/repository-validation.test.ts`
**Issue**: Validation logic not properly catching constraint violations
**Priority**: P1 (Data integrity)
- [ ] Fix validation schema for all entity types (Node, VM, Container, Storage)
- [ ] Implement proper foreign key relationship validation
- [ ] Add field-level validation with meaningful error messages
- [ ] Create validation test utilities for edge cases
**Validation**: All validation tests pass with proper error messages
**Estimated Time**: 60 minutes

**Phase 1 Success Criteria**: 
- All 6 database test files passing (0 failing database tests)
- Database cleanup working without foreign key violations
- Repository pattern fully functional with proper validation
- Estimated total phase time: 6 hours

## Phase 2: Console Integration Layer (User-Facing Priority)
*Dependencies: Phase 1 complete | Timeline: Day 2 (6-8 hours) | Target: Stabilize interactive console*

### TEST-007: Fix Console Init Command Integration
**File**: `src/__tests__/console/init-command.test.ts`
**Issue**: Workspace initialization failing due to database integration issues
**Priority**: P1 (Primary user workflow)
- [ ] Fix ProjectWorkspace.create() integration with database client
- [ ] Implement proper workspace directory creation and validation
- [ ] Add database initialization as part of workspace setup
- [ ] Create workspace configuration validation and error recovery
**Validation**: `/init` command creates functional workspace with database
**Estimated Time**: 75 minutes

### TEST-008: Stabilize Console REPL Session Management
**File**: `src/__tests__/console/repl.test.ts`
**Issue**: REPL session management and command routing failing
**Priority**: P1 (Core user interface)
- [ ] Fix ConsoleSession initialization and workspace detection
- [ ] Implement proper command routing and error handling
- [ ] Add session persistence and recovery mechanisms
- [ ] Create REPL state management and cleanup utilities
**Validation**: Console REPL starts, executes commands, and exits properly
**Estimated Time**: 90 minutes

### TEST-009: Fix Console Sync Command Implementation
**File**: `src/__tests__/console/sync-command.test.ts`
**Issue**: Resource synchronization between Proxmox API and database failing
**Priority**: P1 (Critical workflow)
- [ ] Implement complete sync command with API-to-database integration
- [ ] Add resource discovery, comparison, and update logic
- [ ] Create proper error handling for API connectivity issues
- [ ] Add sync progress tracking and user feedback
**Validation**: `/sync` command successfully synchronizes Proxmox resources to database
**Estimated Time**: 120 minutes

### TEST-010: Fix Console Completion System
**File**: `src/console/__tests__/completion.test.ts`
**Issue**: Command auto-completion not working properly
**Priority**: P2 (User experience)
- [ ] Fix command completion logic for slash commands and natural language
- [ ] Implement context-aware completion suggestions
- [ ] Add dynamic completion based on current workspace state
- [ ] Create completion caching and performance optimization
**Validation**: Tab completion works for all available commands and options
**Estimated Time**: 45 minutes

**Phase 2 Success Criteria**:
- Console REPL fully functional with command routing
- `/init` command creates complete workspace with database
- `/sync` command successfully bridges API and database
- Interactive console provides good user experience
- Estimated total phase time: 5.5 hours

## Phase 3: Integration & Generator Layer (Production Readiness)
*Dependencies: Phases 1-2 complete | Timeline: Day 3 (6-8 hours) | Target: End-to-end workflows*

### TEST-011: Fix VM Lifecycle Integration Test
**File**: `src/__tests__/integration/vm-lifecycle.test.ts`
**Issue**: Complete VM lifecycle (create, start, stop, delete) failing
**Priority**: P1 (Core functionality validation)
- [ ] Implement end-to-end VM lifecycle with API, database, and state tracking
- [ ] Add proper VM state synchronization and validation
- [ ] Create VM lifecycle error handling and rollback mechanisms
- [ ] Add integration test utilities for complex workflows
**Validation**: Complete VM lifecycle test passes from creation to deletion
**Estimated Time**: 120 minutes

### TEST-012: Fix Terraform Generator Implementation
**File**: `src/__tests__/generators/terraform.test.ts`
**Issue**: Terraform configuration generation not working
**Priority**: P2 (IaC functionality)
- [ ] Implement Terraform configuration generation from database state
- [ ] Add template system for different resource types (VM, Container, Storage)
- [ ] Create proper file generation and validation utilities
- [ ] Add Terraform syntax validation and formatting
**Validation**: Generated Terraform configurations are valid and deployable
**Estimated Time**: 90 minutes

### TEST-013: Fix Ansible Generator Implementation
**File**: `src/__tests__/generators/ansible.test.ts`
**Issue**: Ansible playbook generation not working
**Priority**: P2 (Configuration management)
- [ ] Implement Ansible playbook generation from database state
- [ ] Add playbook templates for different configuration scenarios
- [ ] Create inventory generation and variable management
- [ ] Add Ansible syntax validation and best practices
**Validation**: Generated Ansible playbooks are valid and executable
**Estimated Time**: 90 minutes

### TEST-014: Fix Workspace Index Implementation
**File**: `src/workspace/__tests__/index.test.ts`
**Issue**: Workspace management functionality failing
**Priority**: P1 (Project management)
- [ ] Implement complete workspace lifecycle (create, load, save, delete)
- [ ] Add workspace configuration management and validation
- [ ] Create workspace migration and upgrade utilities
- [ ] Add workspace backup and recovery mechanisms
**Validation**: Workspace can be created, configured, and managed properly
**Estimated Time**: 75 minutes

**Phase 3 Success Criteria**:
- VM lifecycle fully functional from API to database to IaC
- Terraform and Ansible generators produce valid configurations
- Workspace management handles all project lifecycle operations
- End-to-end workflows complete successfully
- Estimated total phase time: 6.25 hours

## Phase 4: Observability & Diagnostics Layer (Stability & Monitoring)
*Dependencies: Phases 1-3 complete | Timeline: Day 4 (4-6 hours) | Target: >90% success rate*

### TEST-015: Fix Observability Commands Integration
**File**: `src/observability/__tests__/commands-integration.test.ts`
**Issue**: Observability system not properly integrated with console commands
**Priority**: P2 (Monitoring and debugging)
- [ ] Fix observability integration with console command execution
- [ ] Implement proper metrics collection and reporting
- [ ] Add performance tracking and resource usage monitoring
- [ ] Create diagnostics and health check utilities
**Validation**: All console commands properly report metrics and performance data
**Estimated Time**: 60 minutes

### TEST-016: Stabilize All Remaining Test Failures
**Files**: Various remaining failing tests
**Issue**: Final cleanup of edge cases and minor failures
**Priority**: P2 (Test suite completion)
- [ ] Address any remaining test failures after phases 1-3
- [ ] Fix flaky tests and timing-related issues  
- [ ] Improve test performance and reliability
- [ ] Add comprehensive integration test coverage
**Validation**: >90% test success rate achieved (450+ passing tests)
**Estimated Time**: 120 minutes

**Phase 4 Success Criteria**:
- Complete observability integration working
- Test success rate >90% (450+ tests passing)
- All critical functionality tested and working
- System ready for production use
- Estimated total phase time: 3 hours

## Success Validation & Quality Gates

### Validation Commands
```bash
# Phase 1 Validation
npm test -- --testPathPattern="database" --verbose

# Phase 2 Validation  
npm test -- --testPathPattern="console" --verbose

# Phase 3 Validation
npm test -- --testPathPattern="integration|generators|workspace" --verbose

# Final Validation
npm test --verbose
npm run cli test-connection
npm run build
```

### Success Criteria Checkpoints
- **Phase 1**: All 6 database test files passing (0 DB failures)
- **Phase 2**: Console commands functional, REPL working
- **Phase 3**: End-to-end workflows complete, generators working
- **Phase 4**: >90% test success rate, production ready

### Risk Mitigation Strategies
1. **Database Layer Risks**: Create backup test database, implement rollback mechanisms
2. **Integration Risks**: Mock external dependencies, create integration test isolation
3. **Timeline Risks**: Prioritize P0/P1 tasks, defer P2 tasks if needed
4. **Quality Risks**: Implement continuous validation, automated quality gates

### Dependencies & Constraints
- **Critical Path**: Database fixes → Console integration → End-to-end workflows
- **Resource Constraints**: Single developer, 3-4 day timeline
- **Quality Constraints**: Must maintain >80% test coverage, all P0/P1 issues fixed
- **Scope Constraints**: Focus on core functionality, defer advanced features

## Implementation Approach

1. **Layer-by-Layer Strategy**: Fix foundational issues first, build upward
2. **Test-Driven Fixes**: Run tests, fix failures, verify fixes, repeat
3. **Incremental Validation**: Validate each phase before moving to next
4. **Evidence-Based Progress**: Document test metrics and progress at each step
5. **Risk-First Approach**: Address highest-risk, highest-impact issues first

**Total Estimated Timeline**: 20-22 hours over 3-4 days
**Expected Outcome**: >90% test success rate, stable core functionality, production-ready system