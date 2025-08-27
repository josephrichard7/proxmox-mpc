# Release Management Guide

Professional semantic versioning and release management procedures for Proxmox-MPC.

## Overview

Proxmox-MPC follows strict semantic versioning (SemVer) with automated release processes and comprehensive validation. This guide covers the complete release workflow from development to publication.

## Semantic Versioning Strategy

### Version Format: `MAJOR.MINOR.PATCH[-PRERELEASE][+BUILD]`

**MAJOR** (Breaking Changes)
- API removals or incompatible changes
- Database schema changes requiring migration
- Configuration format changes
- CLI command signature changes

**MINOR** (New Features)
- New console commands or CLI features
- New API endpoints or resources
- Database schema additions (backward compatible)
- New configuration options (backward compatible)

**PATCH** (Bug Fixes)
- Bug fixes and security patches
- Performance improvements
- Documentation updates
- Internal refactoring without API changes

**PRERELEASE** (Alpha/Beta/RC)
- `1.0.0-alpha.1` - Early development features
- `1.0.0-beta.1` - Feature complete, testing phase
- `1.0.0-rc.1` - Release candidate, final testing

## Release Workflow

### 1. Pre-Release Validation

Run comprehensive validation before starting release process:

```bash
# Validate release readiness
npm run release:validate

# Check for critical issues
./scripts/validate-release.sh
```

**Validation Checks:**
- ✅ All tests passing (>90% success rate required)
- ✅ TypeScript compilation successful
- ✅ ESLint validation passing
- ✅ Code formatting consistent
- ✅ Git working directory clean
- ✅ Documentation up to date
- ✅ No sensitive files in repository

### 2. Release Types

**Patch Release (Recommended)**
```bash
# Automatic patch release (0.1.3 -> 0.1.4)
npm run release:patch

# Or with explicit type
npm run release -- --type patch
```

**Minor Release**
```bash
# Minor feature release (0.1.3 -> 0.2.0)
npm run release:minor

# Or with explicit type
npm run release -- --type minor
```

**Major Release**
```bash
# Breaking changes release (0.1.3 -> 1.0.0)
npm run release:major

# Or with explicit type
npm run release -- --type major
```

**Prerelease**
```bash
# Alpha/beta release (0.1.3 -> 0.1.4-alpha.0)
npm run release:prerelease

# Or with explicit type
npm run release -- --type prerelease
```

### 3. Dry Run Testing

Always test your release process before executing:

```bash
# Preview what would happen without making changes
npm run release:dry-run

# Test specific release type
./scripts/release.sh --type major --dry-run
```

### 4. Release Execution

The release script automatically:

1. **Validates Environment**
   - Checks git repository state
   - Ensures working directory is clean
   - Verifies branch synchronization

2. **Runs Quality Checks**
   - Executes test suite
   - Runs TypeScript compilation
   - Validates code formatting and linting

3. **Generates Release**
   - Updates version in package.json
   - Generates/updates CHANGELOG.md
   - Creates git commit and tag
   - Pushes to remote repository (optional)

### 5. Post-Release Actions

After successful release:

```bash
# Publish to npm registry
npm run release:publish

# Or manual publish with specific tag
npm publish --tag latest
npm publish --tag beta  # for prerelease
```

## Release Scripts Reference

### Core Scripts

**`./scripts/release.sh`** - Primary release automation
```bash
Usage: ./scripts/release.sh [OPTIONS]

Options:
  -t, --type TYPE       Release type: patch|minor|major|prerelease
  -d, --dry-run        Preview without executing
  -s, --skip-tests     Skip test execution (not recommended)
  -b, --skip-build     Skip build process (not recommended)
  -h, --help           Show help

Examples:
  ./scripts/release.sh                    # Patch release
  ./scripts/release.sh -t minor           # Minor release  
  ./scripts/release.sh --dry-run          # Preview changes
```

**`./scripts/validate-release.sh`** - Comprehensive validation
```bash
# Validates:
# - Project structure and configuration
# - Dependencies and build artifacts
# - Code quality and tests
# - Git repository state
# - Documentation completeness
# - Security compliance
```

### NPM Scripts

**Release Commands**
```bash
npm run release              # Interactive patch release
npm run release:patch        # Patch release (0.1.3 -> 0.1.4)
npm run release:minor        # Minor release (0.1.3 -> 0.2.0)
npm run release:major        # Major release (0.1.3 -> 1.0.0)
npm run release:prerelease   # Prerelease (0.1.3 -> 0.1.4-alpha.0)
npm run release:dry-run      # Preview release without executing
```

**Quality Assurance**
```bash
npm run release:validate     # Run comprehensive validation
npm run release:prepare      # Build, test, lint, typecheck
npm run release:publish      # Publish to npm registry
```

**Development Utilities**
```bash
npm run changelog:generate   # Generate changelog from commits
npm run format:check         # Check code formatting
npm run version:patch        # Bump version without git operations
```

## Conventional Commits

All commits must follow the conventional commits specification:

### Commit Message Format
```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Commit Types

**Release-Triggering Types:**
- `feat:` - New feature (triggers MINOR release)
- `fix:` - Bug fix (triggers PATCH release)

**Non-Release Types:**
- `docs:` - Documentation only changes
- `style:` - Code style changes (formatting, semicolons, etc)
- `refactor:` - Code refactoring without feature changes
- `perf:` - Performance improvements
- `test:` - Test additions or corrections
- `chore:` - Maintenance tasks, dependency updates
- `ci:` - CI/CD configuration changes

### Breaking Changes

Use `BREAKING CHANGE:` in commit footer or `!` after type to indicate breaking changes:

```bash
# Major release trigger
git commit -m "feat!: redesign CLI interface with new command structure"

# Or in footer
git commit -m "feat: add new authentication system

BREAKING CHANGE: old token format no longer supported"
```

### Examples

```bash
# Patch release
git commit -m "fix: resolve database connection timeout issues"

# Minor release
git commit -m "feat(console): add new /status command with health monitoring"

# Major release
git commit -m "feat!: restructure API client with breaking interface changes"

# No release
git commit -m "docs: update installation guide with new requirements"
```

## Git Hooks and Automation

### Commit Message Validation

Husky automatically validates commit messages:

```bash
# .husky/commit-msg
npx commitlint --edit $1
```

**Configuration** (`.commitlint.config.js`):
- Enforces conventional commit format
- Validates commit types and scopes
- Checks subject and body formatting

### Pre-Push Validation

Automatic quality checks before pushing:

```bash
# .husky/pre-push
npm run release:prepare
```

Ensures:
- All tests pass
- TypeScript compiles successfully
- Code passes linting
- Build completes without errors

## Branch Management Strategy

### Main Branch Protection

**`main`** branch requirements:
- All commits must pass CI checks
- Requires pull request reviews
- Linear commit history preferred
- Direct pushes restricted to maintainers

### Release Branches (Future)

For complex releases, use release branches:

```bash
# Create release branch
git checkout -b release/1.0.0

# Finalize release on branch
npm run release:major

# Merge back to main
git checkout main
git merge --no-ff release/1.0.0
git push origin main
```

### Hotfix Process

Critical production fixes:

```bash
# Create hotfix branch from latest tag
git checkout -b hotfix/1.0.1 v1.0.0

# Apply fix and test
git commit -m "fix: critical security vulnerability in auth system"

# Release hotfix
npm run release:patch

# Merge to main
git checkout main
git merge --no-ff hotfix/1.0.1
```

## Release Checklist

### Pre-Release Validation
- [ ] All tests passing with >90% success rate
- [ ] TypeScript compilation successful
- [ ] ESLint validation passing
- [ ] Code formatting consistent
- [ ] Documentation updated
- [ ] CHANGELOG.md reflects changes
- [ ] Version number follows SemVer
- [ ] Git working directory clean
- [ ] No sensitive files in repository

### Release Execution
- [ ] Run `npm run release:validate`
- [ ] Execute appropriate release command
- [ ] Verify generated CHANGELOG.md
- [ ] Confirm git tag created
- [ ] Push to remote repository
- [ ] Publish to npm registry

### Post-Release Verification
- [ ] Verify npm package published
- [ ] Test global installation: `npm install -g proxmox-mpc`
- [ ] Validate CLI functionality
- [ ] Update documentation site
- [ ] Communicate release to stakeholders

## Troubleshooting

### Common Issues

**Working Directory Not Clean**
```bash
# Check what's uncommitted
git status

# Stash changes if needed
git stash push -m "temp stash for release"

# Or commit changes
git add .
git commit -m "chore: prepare for release"
```

**Tests Failing**
```bash
# Run tests with verbose output
npm test -- --verbose

# Run specific test file
npm test -- database.test.ts

# Update snapshots if needed
npm test -- --updateSnapshot
```

**Build Errors**
```bash
# Clean build directory
rm -rf dist/

# Rebuild
npm run build

# Check TypeScript errors
npm run typecheck
```

**Validation Errors**
```bash
# Run full validation with detailed output
./scripts/validate-release.sh

# Fix specific issues identified
npm run lint --fix
npm run format
```

### Recovery Procedures

**Revert Failed Release**
```bash
# If release created but not pushed
git reset --hard HEAD~1
git tag -d v1.0.0  # delete local tag

# If already pushed
git revert HEAD
git push origin main
```

**Fix Broken Package**
```bash
# Deprecate broken version
npm deprecate proxmox-mpc@1.0.0 "Broken release, use 1.0.1 instead"

# Release fixed version
npm run release:patch
```

## Best Practices

### Development
- Write conventional commits from the start
- Run `npm run release:validate` regularly
- Test releases with `--dry-run` first
- Keep CHANGELOG.md up to date

### Release Timing
- Release patches quickly for critical fixes
- Bundle minor features for scheduled releases
- Plan major releases with stakeholder communication
- Use prereleases for testing new features

### Quality Assurance
- Maintain >90% test success rate
- Validate releases in staging environment
- Monitor post-release metrics and issues
- Document breaking changes thoroughly

### Communication
- Use clear, descriptive commit messages
- Document breaking changes with migration guides
- Announce major releases to stakeholders
- Maintain public roadmap for upcoming releases

## Configuration Files

### `.versionrc` - Standard Version Configuration
```json
{
  "header": "# Changelog\n\nAll notable changes...",
  "types": [
    {"type": "feat", "section": "🚀 Features"},
    {"type": "fix", "section": "🐛 Bug Fixes"},
    {"type": "docs", "section": "📚 Documentation"}
  ]
}
```

### `commitlint.config.js` - Commit Message Validation
```javascript
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', ['feat', 'fix', 'docs', ...]],
    'subject-max-length': [2, 'always', 72]
  }
}
```

This comprehensive release management system ensures consistent, high-quality releases while maintaining professional development practices and stakeholder communication.