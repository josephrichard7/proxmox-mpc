# Proxmox-MPC Version Alignment Fix Plan

**Target**: Synchronize all version references across the product to use package.json as single source of truth
**Current Issues**: Multiple hardcoded version strings (0.1.0) inconsistent with package.json (0.1.3)
**Timeline**: 1-2 hours focused work

## Phase 1: Version Discovery and Inventory (Priority: P0)
*Timeline: 30 minutes | Critical dependency for all subsequent phases*

### TASK-001: Complete Version Reference Audit
**Issue**: Multiple hardcoded version strings found across the codebase
**Priority**: P0 (Foundation for all fixes)
- [ ] Create comprehensive inventory of all version references
- [ ] Document each location with file path and line number
- [ ] Classify version references by type (display, configuration, tests, documentation)
- [ ] Identify impact of each hardcoded version on user experience
**Found Locations**:
- `src/console/repl.ts:157` - Console welcome message: "v0.1.0" (CRITICAL - user-facing)
- `src/cli/index.ts:34` - CLI version command: "0.1.0" (CRITICAL - user-facing)
- `src/config/index.ts:221` - Default workspace config: "0.1.0" (HIGH - affects workspace creation)
- `src/workspace/index.ts:104` - Workspace creation: "0.1.0" (HIGH - affects workspace creation)
- `src/workspace/__tests__/index.test.ts:110,153` - Test expectations: "0.1.0" (MEDIUM - test consistency)
**Validation**: All version references documented with impact assessment
**Estimated Time**: 30 minutes

## Phase 2: Dynamic Version Loading Infrastructure (Priority: P0)
*Timeline: 45 minutes | Core infrastructure for version synchronization*

### TASK-002: Create Version Utility Module
**Issue**: No centralized way to load version from package.json
**Priority**: P0 (Required for all dynamic version loading)
- [ ] Create `src/utils/version.ts` utility module
- [ ] Implement `getVersion()` function that reads from package.json
- [ ] Add error handling for missing or invalid package.json
- [ ] Include TypeScript type definitions for version utility
- [ ] Add unit tests for version utility functionality
**Implementation Strategy**:
```typescript
// src/utils/version.ts
export function getVersion(): string {
  try {
    const packageJson = require('../../package.json');
    return packageJson.version || 'unknown';
  } catch (error) {
    return 'unknown';
  }
}

export function getFormattedVersion(): string {
  return `v${getVersion()}`;
}
```
**Validation**: Version utility returns correct version from package.json
**Estimated Time**: 30 minutes

### TASK-003: Update Package.json Import Strategy
**Issue**: Need reliable way to import package.json in different contexts
**Priority**: P1 (Improves reliability)
- [ ] Ensure package.json is accessible from dist/ build output
- [ ] Test version loading in development and production builds
- [ ] Add fallback mechanism for version loading failures
- [ ] Document version loading strategy in code comments
**Validation**: Version loading works in all build environments
**Estimated Time**: 15 minutes

## Phase 3: Console and CLI Version Updates (Priority: P0)
*Timeline: 30 minutes | User-facing version displays*

### TASK-004: Fix Console Welcome Message
**File**: `src/console/repl.ts:157`
**Issue**: Hardcoded "v0.1.0" in displayWelcome() method
**Priority**: P0 (Primary user interface)
- [ ] Import getFormattedVersion() from version utility
- [ ] Replace hardcoded version string with dynamic version
- [ ] Test console startup displays correct version
- [ ] Ensure version display formatting remains consistent
**Before**: `console.log('🔧 Proxmox Infrastructure Console v0.1.0');`
**After**: `console.log('🔧 Proxmox Infrastructure Console ' + getFormattedVersion());`
**Validation**: Console displays current package.json version on startup
**Estimated Time**: 10 minutes

### TASK-005: Fix CLI Version Command
**File**: `src/cli/index.ts:34`
**Issue**: Hardcoded "0.1.0" in Commander.js version setting
**Priority**: P0 (CLI version command affects scripts and automation)
- [ ] Import getVersion() from version utility
- [ ] Replace hardcoded version in .version() call
- [ ] Test `proxmox-mpc --version` command output
- [ ] Verify version appears correctly in CLI help text
**Before**: `.version('0.1.0')`
**After**: `.version(getVersion())`
**Validation**: CLI --version command shows current package.json version
**Estimated Time**: 10 minutes

### TASK-006: Update CLI Help and Documentation References
**File**: `src/cli/index.ts` (various help text sections)
**Issue**: May contain version references in help text
**Priority**: P2 (Documentation consistency)
- [ ] Search for any hardcoded version references in CLI help text
- [ ] Update any version references to use dynamic loading
- [ ] Ensure help text remains properly formatted
- [ ] Test help command output for version consistency
**Validation**: All CLI help text references current version
**Estimated Time**: 10 minutes

## Phase 4: Configuration and Workspace Updates (Priority: P1)
*Timeline: 30 minutes | Internal configuration consistency*

### TASK-007: Fix Default Workspace Configuration
**File**: `src/config/index.ts:221`
**Issue**: Hardcoded "0.1.0" in createDefaultWorkspaceConfig()
**Priority**: P1 (Affects new workspace creation)
- [ ] Import getVersion() from version utility
- [ ] Replace hardcoded version in default config
- [ ] Update workspace configuration creation logic
- [ ] Test new workspace creation uses current version
**Before**: `version: '0.1.0',`
**After**: `version: getVersion(),`
**Validation**: New workspaces created with current version
**Estimated Time**: 10 minutes

### TASK-008: Fix Workspace Creation Logic
**File**: `src/workspace/index.ts:104`
**Issue**: Hardcoded "0.1.0" in ProjectWorkspace.create()
**Priority**: P1 (Affects workspace initialization)
- [ ] Import getVersion() from version utility
- [ ] Replace hardcoded version in workspace creation
- [ ] Update workspace metadata setting
- [ ] Test workspace creation and configuration saving
**Before**: `version: '0.1.0'`
**After**: `version: getVersion()`
**Validation**: Workspace creation uses current version
**Estimated Time**: 10 minutes

### TASK-009: Update Workspace Template Generation
**File**: `src/workspace/index.ts:306`
**Issue**: Template generation may reference version
**Priority**: P2 (Generated file consistency)
- [ ] Check if version is used in generated Terraform/Ansible comments
- [ ] Update any template generation to use dynamic version
- [ ] Test generated file comments include correct version
- [ ] Ensure generated files have consistent version metadata
**Validation**: Generated files reference current version
**Estimated Time**: 10 minutes

## Phase 5: Test Suite Updates (Priority: P1)
*Timeline: 20 minutes | Test consistency and validation*

### TASK-010: Update Test Version Expectations
**File**: `src/workspace/__tests__/index.test.ts:110,153`
**Issue**: Test expectations hardcoded to "0.1.0"
**Priority**: P1 (Test suite accuracy)
- [ ] Import getVersion() in test files
- [ ] Replace hardcoded version expectations with dynamic version
- [ ] Update test assertions to use current version
- [ ] Run tests to ensure they pass with dynamic version
**Before**: `expect(workspace.config.version).toBe('0.1.0');`
**After**: `expect(workspace.config.version).toBe(getVersion());`
**Validation**: All version-related tests pass with dynamic version
**Estimated Time**: 15 minutes

### TASK-011: Create Version Utility Tests
**File**: `src/utils/__tests__/version.test.ts`
**Issue**: New version utility needs comprehensive test coverage
**Priority**: P1 (Quality assurance)
- [ ] Create test suite for version utility functions
- [ ] Test getVersion() returns correct version from package.json
- [ ] Test getFormattedVersion() returns correctly formatted version
- [ ] Test error handling when package.json is missing
- [ ] Achieve >90% test coverage for version utility
**Validation**: Version utility has comprehensive test coverage
**Estimated Time**: 5 minutes

## Phase 6: Documentation and Validation (Priority: P2)
*Timeline: 15 minutes | Documentation consistency and final validation*

### TASK-012: Update Documentation References
**Files**: Various .md files with version references
**Issue**: Documentation may contain outdated version references
**Priority**: P2 (Documentation consistency)
- [ ] Search all documentation files for hardcoded version references
- [ ] Update any version references to reflect current state
- [ ] Ensure documentation accurately describes version management
- [ ] Update LOCAL_INSTALLATION_GUIDE.md version reference (line 178)
**Found References**:
- `LOCAL_INSTALLATION_GUIDE.md:178` - "Version:** 0.1.3" (should be dynamic or removed)
- Various documentation files may contain version references
**Validation**: Documentation references are current and accurate
**Estimated Time**: 10 minutes

### TASK-013: Final Integration Testing
**Issue**: Need comprehensive validation of version synchronization
**Priority**: P1 (Quality gate)
- [ ] Test console startup displays correct version
- [ ] Test CLI --version command shows correct version
- [ ] Test new workspace creation uses correct version
- [ ] Test all version utilities work in different contexts
- [ ] Verify no hardcoded versions remain in codebase
- [ ] Run complete test suite to ensure no regressions
**Validation Commands**:
```bash
# Test version consistency
npm run console  # Check console welcome message
npm run cli -- --version  # Check CLI version
npm test -- --testPathPattern="version|workspace"  # Run version-related tests
grep -r "0\.1\.[0-9]" src/  # Verify no hardcoded versions remain
```
**Validation**: All version displays show consistent version from package.json
**Estimated Time**: 5 minutes

## Success Criteria and Quality Gates

### Phase Completion Criteria
- **Phase 1**: Complete inventory of all version references with impact assessment
- **Phase 2**: Working version utility with comprehensive error handling
- **Phase 3**: Console and CLI display current version from package.json
- **Phase 4**: Configuration and workspace creation use dynamic version
- **Phase 5**: Test suite validates version consistency
- **Phase 6**: Documentation is current and accurate

### Final Success Validation
1. **Version Consistency**: All version displays show same version from package.json
2. **No Hardcoded Versions**: Search confirms no hardcoded version strings remain
3. **Test Coverage**: All version-related functionality has test coverage
4. **User Experience**: Console and CLI provide consistent version information
5. **Future-Proof**: Version changes in package.json automatically reflect everywhere

### Risk Mitigation Strategies
1. **Test Coverage**: Run tests before and after changes to prevent regressions
2. **Incremental Changes**: Update one file at a time and validate immediately
3. **Fallback Handling**: Version utility gracefully handles missing package.json
4. **Documentation**: Clear documentation of version management strategy

### Quality Gates
- All existing tests must continue to pass
- New version utility must have >90% test coverage
- No hardcoded version strings remain in source code
- Version displays are consistent across all interfaces

## Implementation Approach

1. **Sequential Execution**: Complete phases in order due to dependencies
2. **Test-Driven**: Run tests after each change to catch regressions
3. **Incremental Validation**: Validate each component before moving to next
4. **Evidence-Based**: Document test results and validation evidence

**Total Estimated Timeline**: 2.5 hours
**Critical Path**: Phase 2 → Phase 3 → Phase 4 → Phase 5
**Expected Outcome**: Complete version synchronization with single source of truth

## Current Test Status Reference
- **Package.json Version**: 0.1.3 (official source of truth)
- **Hardcoded Versions Found**: 0.1.0 (5 locations in source code)
- **Impact**: User-facing displays show outdated version information
- **Solution**: Dynamic version loading from package.json as single source of truth