# Release Branch Strategy

## Overview

Proxmox-MPC follows a **Git Flow-inspired** branch strategy designed for professional release management with semantic versioning and automated deployment pipelines.

## Branch Types

### Main Branches

#### `main`
- **Purpose**: Production-ready code
- **Protection**: Protected branch with required status checks
- **Merge Strategy**: Squash merge from release branches only
- **Deployment**: Automatically deploys to production
- **Tags**: All production releases are tagged from main

#### `develop` 
- **Purpose**: Integration branch for ongoing development
- **Protection**: Protected branch with required status checks
- **Merge Strategy**: Merge commits from feature branches
- **Testing**: Continuous integration testing
- **Deployment**: Automatically deploys to staging environment

### Supporting Branches

#### Feature Branches: `feature/*`
- **Naming**: `feature/description-of-feature`
- **Source**: Created from `develop`
- **Merge Target**: `develop`
- **Lifetime**: Until feature is complete and merged
- **Examples**:
  - `feature/interactive-console`
  - `feature/terraform-generation`
  - `feature/multi-server-support`

#### Release Branches: `release/v*`
- **Naming**: `release/v1.2.0`
- **Source**: Created from `develop`
- **Merge Target**: Both `main` and `develop`
- **Purpose**: Release preparation, bug fixes, version bumping
- **Lifetime**: Until release is deployed to production

#### Hotfix Branches: `hotfix/v*`
- **Naming**: `hotfix/v1.2.1-critical-security-fix`
- **Source**: Created from `main`
- **Merge Target**: Both `main` and `develop`
- **Purpose**: Critical production fixes
- **Priority**: Immediate deployment

## Branch Protection Rules

### `main` Branch Protection
```yaml
protection_rules:
  required_status_checks:
    - "ci/tests"
    - "ci/build"
    - "ci/security-scan"
    - "ci/integration-tests"
  enforce_admins: true
  required_pull_request_reviews:
    required_approving_review_count: 2
    dismiss_stale_reviews: true
    require_code_owner_reviews: true
  restrictions:
    users: []
    teams: ["core-maintainers"]
  allow_force_pushes: false
  allow_deletions: false
```

### `develop` Branch Protection
```yaml
protection_rules:
  required_status_checks:
    - "ci/tests"
    - "ci/build" 
    - "ci/lint"
  enforce_admins: false
  required_pull_request_reviews:
    required_approving_review_count: 1
    dismiss_stale_reviews: true
  allow_force_pushes: false
  allow_deletions: false
```

## Release Workflow

### 1. Feature Development
```bash
# Create feature branch
git checkout develop
git pull origin develop
git checkout -b feature/new-awesome-feature

# Development work with conventional commits
git commit -m "feat: implement awesome feature core logic"
git commit -m "test: add comprehensive test coverage for awesome feature"
git commit -m "docs: document awesome feature usage"

# Push and create PR to develop
git push origin feature/new-awesome-feature
# Create PR: feature/new-awesome-feature → develop
```

### 2. Release Preparation
```bash
# Create release branch from develop
git checkout develop
git pull origin develop
git checkout -b release/v1.2.0

# Version bump and changelog generation
npm run release:prepare
npm run changelog:generate

# Final testing and bug fixes
git commit -m "fix: resolve edge case in awesome feature"
git commit -m "chore(release): prepare v1.2.0"

# Push release branch
git push origin release/v1.2.0
# Create PR: release/v1.2.0 → main
```

### 3. Production Release
```bash
# Merge to main (creates production release)
git checkout main
git merge --no-ff release/v1.2.0
git tag -a v1.2.0 -m "Release v1.2.0: Awesome Feature"

# Back-merge to develop
git checkout develop
git merge --no-ff release/v1.2.0

# Clean up release branch
git branch -d release/v1.2.0
git push origin --delete release/v1.2.0
```

### 4. Hotfix Process
```bash
# Create hotfix from main
git checkout main
git pull origin main
git checkout -b hotfix/v1.2.1-security-fix

# Critical fix
git commit -m "fix!: resolve critical security vulnerability CVE-2024-XXXX"

# Version bump
npm version patch
git commit -m "chore(release): prepare v1.2.1 hotfix"

# Deploy to production
git checkout main
git merge --no-ff hotfix/v1.2.1-security-fix
git tag -a v1.2.1 -m "Hotfix v1.2.1: Security Fix"

# Back-merge to develop
git checkout develop
git merge --no-ff hotfix/v1.2.1-security-fix

# Cleanup
git branch -d hotfix/v1.2.1-security-fix
```

## Semantic Versioning Integration

### Version Calculation
Based on commit analysis since last release:
- **MAJOR**: Breaking changes (`feat!:`, `BREAKING CHANGE:`)
- **MINOR**: New features (`feat:`)  
- **PATCH**: Bug fixes (`fix:`) and other changes

### Automated Version Bumping
```bash
# Automatic version calculation
npm run release:auto        # Analyzes commits and bumps appropriately
npm run release:patch       # Force patch version (1.0.0 → 1.0.1)
npm run release:minor       # Force minor version (1.0.0 → 1.1.0)  
npm run release:major       # Force major version (1.0.0 → 2.0.0)
```

## Continuous Integration Integration

### Feature Branch CI
```yaml
on:
  pull_request:
    branches: [develop]
jobs:
  test:
    - lint-and-format
    - unit-tests
    - integration-tests
    - build-verification
```

### Release Branch CI
```yaml
on:
  pull_request:
    branches: [main]
    types: [opened, synchronize]
jobs:
  release:
    - comprehensive-test-suite
    - security-scan
    - performance-benchmarks
    - release-notes-generation
    - deployment-simulation
```

### Main Branch CI
```yaml
on:
  push:
    branches: [main]
jobs:
  deploy:
    - production-deployment
    - monitoring-setup
    - rollback-preparation
    - notification-dispatch
```

## Branch Naming Conventions

### Feature Branches
- `feature/description-with-hyphens`
- `feature/ISSUE-123-short-description`
- `feature/epic-name/specific-feature`

### Release Branches
- `release/v1.2.0` (exact version)
- `release/v1.2.0-rc.1` (release candidate)

### Hotfix Branches
- `hotfix/v1.2.1-critical-description`
- `hotfix/v1.2.1-CVE-2024-XXXX`

### Bugfix Branches (if needed)
- `bugfix/specific-bug-description`
- `bugfix/ISSUE-456-memory-leak`

## Quality Gates

### Pre-merge Requirements
1. **All Tests Pass**: Unit, integration, and E2E tests
2. **Code Coverage**: Minimum 80% coverage maintained
3. **Security Scan**: No high/critical vulnerabilities
4. **Performance**: No degradation in benchmarks
5. **Documentation**: Updated documentation for changes
6. **Conventional Commits**: All commits follow conventional format

### Release Checklist
- [ ] Version bumped appropriately
- [ ] CHANGELOG.md updated
- [ ] All tests passing
- [ ] Security scan clean
- [ ] Performance benchmarks acceptable
- [ ] Documentation updated
- [ ] Migration guides (if breaking changes)
- [ ] Release notes prepared

## Emergency Procedures

### Critical Production Issue
1. **Immediate**: Create hotfix branch from main
2. **Fix**: Minimal, targeted fix with tests
3. **Test**: Accelerated testing on hotfix branch
4. **Deploy**: Direct hotfix deployment to production
5. **Communicate**: Incident communication to stakeholders
6. **Document**: Post-incident review and documentation

### Rollback Process
1. **Identify**: Problem commit or release
2. **Revert**: Git revert or rollback deployment
3. **Validate**: Confirm system stability
4. **Investigate**: Root cause analysis
5. **Plan**: Corrective action plan

---
*This branch strategy ensures reliable, traceable, and automated release management for Proxmox-MPC.*