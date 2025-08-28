# Team Release Guide

**Proxmox-MPC Release Management - Complete Team Guide**

## Overview

This guide provides comprehensive documentation for team members to execute releases for Proxmox-MPC. Our release process follows semantic versioning and includes automated validation, testing, and deployment workflows.

## Quick Reference

### Release Types

- **Patch** (0.1.3 → 0.1.4): Bug fixes, security patches
- **Minor** (0.1.3 → 0.2.0): New features, backward-compatible changes
- **Major** (0.1.3 → 1.0.0): Breaking changes, major architectural changes
- **Prerelease** (0.1.3 → 0.2.0-alpha.1): Pre-release versions for testing

### One-Command Release

```bash
# Recommended: Full automated release
./scripts/release-orchestrator.sh --type auto

# Preview changes first (recommended for new team members)
./scripts/release-orchestrator.sh --type auto --dry-run
```

## Prerequisites

### Required Tools

- **Node.js** ≥18.0.0 and **npm** ≥8.0.0
- **Git** with clean working directory
- **GPG Key** configured for signed tags (recommended)
- **npm Authentication** for package publishing

### Environment Setup

```bash
# 1. Verify Node.js version
node --version  # Should be ≥18.0.0

# 2. Install dependencies
npm install

# 3. Verify release tools
./scripts/release-orchestrator.sh --help

# 4. Check current project status
npm run release:validate
```

### Access Requirements

- **Repository**: Write access to main branch
- **npm Registry**: Publish permissions for `proxmox-mpc` package
- **GPG Signing**: Configured GPG key (optional but recommended)

## Release Workflow

### Phase 1: Preparation

**Duration**: 10-15 minutes  
**Automated**: Full automation with validation checks

```bash
# All-in-one release command
./scripts/release-orchestrator.sh --type minor --verbose

# Or step-by-step approach:
./scripts/prepare-release.sh --type minor
```

**What happens during preparation:**

1. **Environment Validation**: Node.js, npm, Git status checks
2. **Dependency Audit**: Security vulnerabilities, outdated packages
3. **Build Process**: TypeScript compilation, asset bundling
4. **Test Execution**: Full test suite (>95% success rate required)
5. **Code Quality**: Linting, formatting, type checking
6. **Version Calculation**: Semantic version bump based on commit history
7. **Changelog Generation**: Automatic changelog updates from conventional commits

### Phase 2: Release Creation

**Duration**: 5-10 minutes  
**Automated**: GPG-signed tags and package publishing

```bash
# Executed automatically in orchestrator, or manually:
./scripts/create-release-tag.sh
./scripts/publish-npm-package.sh
```

**What happens during creation:**

1. **Git Tagging**: GPG-signed release tags with metadata
2. **Package Build**: Production-ready package compilation
3. **Security Scanning**: Final security validation before publishing
4. **npm Publishing**: Automated package publication with proper tagging
5. **Verification**: Post-publish smoke testing and validation

### Phase 3: Communication

**Duration**: 5-10 minutes  
**Optional**: Can be skipped for patch releases

```bash
# Generate announcements (included in orchestrator)
./scripts/generate-release-announcement.sh
./scripts/notify-release.sh
```

**What happens during communication:**

1. **GitHub Release**: Automated GitHub release creation with notes
2. **Release Notes**: Formatted release notes with feature highlights
3. **Notifications**: Optional Discord, Slack, or email notifications
4. **Documentation**: Update version references in documentation

## Team Roles and Responsibilities

### Release Manager (Primary)

**Required Skills**: Git, npm, basic DevOps knowledge  
**Responsibilities**:

- Execute release workflow using orchestration scripts
- Monitor release process and handle any issues
- Verify successful deployment and package availability
- Communicate release completion to team and stakeholders

**Typical Workflow**:

```bash
# 1. Verify clean state
git status  # Should be clean
npm run test  # Should pass >95%

# 2. Execute release
./scripts/release-orchestrator.sh --type auto --verbose

# 3. Verify deployment
npm install -g proxmox-mpc@latest
proxmox-mpc --version  # Should match released version

# 4. Update team
# Post in team chat with release notes link
```

### Developer (Secondary)

**Required Skills**: Git, conventional commits  
**Responsibilities**:

- Follow conventional commit message format
- Test changes locally before merging
- Contribute to release notes review
- Participate in hotfix deployments when needed

**Commit Message Format**:

```bash
# Feature additions
git commit -m "feat: add interactive console command for VM management"

# Bug fixes
git commit -m "fix: resolve database connection timeout in sync operations"

# Breaking changes
git commit -m "feat!: redesign API authentication with token-based system"
```

### QA Engineer (Support)

**Required Skills**: Testing, verification  
**Responsibilities**:

- Validate release candidates in staging environment
- Execute manual testing for critical user workflows
- Verify documentation accuracy and completeness
- Sign off on release quality before production deployment

## Release Commands Reference

### Standard Release Workflow

```bash
# Full release with auto-detected version bump
./scripts/release-orchestrator.sh

# Specific version type
./scripts/release-orchestrator.sh --type major
./scripts/release-orchestrator.sh --type minor
./scripts/release-orchestrator.sh --type patch

# Preview mode (safe for testing)
./scripts/release-orchestrator.sh --type minor --dry-run --verbose
```

### Individual Script Usage

```bash
# 1. Preparation only
./scripts/prepare-release.sh --type minor --verbose

# 2. Create tags only
./scripts/create-release-tag.sh --verbose

# 3. Publish package only
./scripts/publish-npm-package.sh --verbose

# 4. Generate announcements only
./scripts/generate-release-announcement.sh --verbose

# 5. Send notifications only
./scripts/notify-release.sh --auto-confirm
```

### Validation and Testing

```bash
# Pre-release validation
npm run release:validate

# Changelog validation
npm run changelog:validate

# Test release process (no changes)
./scripts/test-release-process.sh --dry-run

# Rollback if needed
./scripts/rollback-release.sh --auto-confirm
```

## Version Strategy

### Semantic Versioning Rules

- **MAJOR** (1.0.0): Breaking changes, API incompatibilities
- **MINOR** (0.1.0): New features, backward-compatible additions
- **PATCH** (0.0.1): Bug fixes, security patches, performance improvements

### Version Bump Detection

Our system automatically detects version bumps from conventional commits:

```bash
# Commit types that trigger version bumps:
feat: ...        # → MINOR version bump
fix: ...         # → PATCH version bump
feat!: ...       # → MAJOR version bump (breaking change)
fix!: ...        # → MAJOR version bump (breaking fix)

# Commit types that don't trigger bumps:
docs: ...        # Documentation only
style: ...       # Code formatting only
refactor: ...    # Code refactoring only
test: ...        # Test changes only
chore: ...       # Build/tool changes only
```

### Pre-release Versions

```bash
# Create pre-release
./scripts/release-orchestrator.sh --type prerelease

# Results in versions like:
0.1.4-alpha.1
0.2.0-beta.1
1.0.0-rc.1
```

## Quality Standards

### Pre-Release Requirements

- ✅ **Test Success Rate**: >95% (currently achieving 95.6%)
- ✅ **Build Success**: TypeScript compilation without errors
- ✅ **Code Quality**: ESLint and Prettier validation passing
- ✅ **Security**: No high/critical vulnerabilities in dependencies
- ✅ **Documentation**: Updated changelog and release notes

### Post-Release Verification

```bash
# Verify npm package
npm install -g proxmox-mpc@latest
proxmox-mpc --version

# Verify GitHub release
curl -s https://api.github.com/repos/proxmox-mpc/proxmox-mpc/releases/latest

# Verify package content
npm pack proxmox-mpc@latest
tar -tf proxmox-mpc-*.tgz
```

## Troubleshooting

### Common Issues

#### "Git working directory not clean"

```bash
# Check status
git status

# Stash changes temporarily
git stash
./scripts/release-orchestrator.sh --type minor
git stash pop
```

#### "Tests failing"

```bash
# Run tests to identify issues
npm run test

# Run specific test categories
npm run test:database
npm run test:coverage

# Fix failing tests before release
```

#### "npm authentication failed"

```bash
# Check npm authentication
npm whoami

# Login to npm
npm login

# Verify permissions
npm access list packages proxmox-mpc
```

#### "GPG signing failed"

```bash
# Check GPG keys
gpg --list-secret-keys

# Configure Git to use GPG
git config --global user.signingkey YOUR_KEY_ID
git config --global commit.gpgsign true
git config --global tag.gpgsign true
```

### Emergency Procedures

#### Failed Release Recovery

```bash
# Automatic rollback
./scripts/rollback-release.sh --auto-confirm

# Manual rollback steps
git tag -d v1.0.0  # Delete local tag
git push --delete origin v1.0.0  # Delete remote tag
npm unpublish proxmox-mpc@1.0.0  # Remove from npm (within 24h only)
```

#### Hotfix Release (see HOTFIX_GUIDE.md for details)

```bash
# Create hotfix branch from latest release
git checkout -b hotfix/1.0.1 v1.0.0

# Make fix and commit
git commit -m "fix: critical security vulnerability in API authentication"

# Release hotfix
./scripts/release-orchestrator.sh --type patch --auto-confirm
```

## Best Practices

### Before Release

1. **Review Changes**: Check `git log` for all changes since last release
2. **Test Locally**: Run `npm run test` and manual testing
3. **Check Dependencies**: Run `npm audit` for security issues
4. **Validate Documentation**: Ensure README and docs are up-to-date
5. **Coordinate Team**: Inform team members of planned release

### During Release

1. **Monitor Process**: Watch for errors in orchestrator output
2. **Validate Each Step**: Confirm successful completion of each phase
3. **Test Immediately**: Install and test released package
4. **Document Issues**: Record any problems encountered for process improvement

### After Release

1. **Verify Availability**: Check npm and GitHub release pages
2. **Test Installation**: Install package on clean system
3. **Monitor Feedback**: Watch for issues reported by users
4. **Update Team**: Share release completion and any learnings

### Release Communication

#### Internal Team Updates

```bash
# Slack/Discord message template:
🚀 Proxmox-MPC v1.2.0 Released!

📋 Release Type: Minor
🆕 Features: Interactive console improvements, new VM templates
🐛 Fixes: Database sync issues, CLI parsing errors
📊 Quality: 96.2% test success rate
📦 Install: `npm install -g proxmox-mpc@latest`
🔗 Details: https://github.com/proxmox-mpc/proxmox-mpc/releases/tag/v1.2.0
```

#### External Announcements

- **GitHub Release**: Automatically created by orchestrator
- **npm Registry**: Package published with proper tags
- **Documentation Site**: Version references updated automatically
- **Community**: Consider posting in relevant forums for major releases

## Scripts Overview

### Core Release Scripts

| Script                             | Purpose                                | Usage                            |
| ---------------------------------- | -------------------------------------- | -------------------------------- |
| `release-orchestrator.sh`          | Master workflow coordinator            | Primary release command          |
| `prepare-release.sh`               | Pre-release validation and preparation | Environment setup and testing    |
| `create-release-tag.sh`            | Git tagging with GPG signing           | Version tagging and metadata     |
| `publish-npm-package.sh`           | npm package publishing                 | Package deployment               |
| `generate-release-announcement.sh` | Release notes and announcements        | Communication materials          |
| `notify-release.sh`                | Release notification system            | Team and community notifications |

### Utility Scripts

| Script                    | Purpose                           | Usage                       |
| ------------------------- | --------------------------------- | --------------------------- |
| `version-bump.sh`         | Version calculation and bumping   | Semantic version management |
| `generate-changelog.sh`   | Changelog generation from commits | Documentation updates       |
| `validate-release.sh`     | Release readiness validation      | Quality assurance           |
| `rollback-release.sh`     | Emergency release rollback        | Error recovery              |
| `test-release-process.sh` | Release workflow testing          | Process validation          |

### Configuration Files

| File                   | Purpose                                             |
| ---------------------- | --------------------------------------------------- |
| `.versionrc.json`      | Version bump and changelog configuration            |
| `commitlint.config.js` | Commit message validation rules                     |
| `package.json`         | npm scripts and release configuration               |
| `CHANGELOG.md`         | Project changelog following Keep a Changelog format |

---

## Next Steps

After reading this guide:

1. **Practice with Dry Run**: Execute `./scripts/release-orchestrator.sh --dry-run` to familiarize yourself with the process
2. **Review Other Documentation**: Read `HOTFIX_GUIDE.md` for emergency procedures
3. **Set Up Environment**: Configure GPG signing and npm authentication
4. **Join Release Training**: Participate in guided release walkthrough with experienced team member

For questions or issues not covered in this guide, consult the troubleshooting documentation or reach out to the development team.
