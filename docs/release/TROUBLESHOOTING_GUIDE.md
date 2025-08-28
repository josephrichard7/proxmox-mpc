# Release Troubleshooting Guide

**Comprehensive Problem-Solving Guide for Proxmox-MPC Release Issues**

## Overview

This guide provides systematic troubleshooting procedures for common issues encountered during the Proxmox-MPC release process, from preparation through deployment and post-release monitoring.

## Quick Diagnosis

### Release Health Check

Run this comprehensive diagnostic before troubleshooting specific issues:

```bash
#!/bin/bash
# scripts/release-health-check.sh
echo "🔍 Proxmox-MPC Release Health Check"

# 1. Environment validation
echo "📋 Environment Status:"
node --version || echo "❌ Node.js not found"
npm --version || echo "❌ npm not found"
git --version || echo "❌ Git not found"

# 2. Repository status
echo -e "\n📂 Repository Status:"
git status --porcelain | wc -l | xargs echo "Uncommitted files:"
git describe --tags --abbrev=0 | xargs echo "Latest tag:"

# 3. Build and test status
echo -e "\n🔨 Build Status:"
npm run build 2>/dev/null && echo "✅ Build successful" || echo "❌ Build failed"
npm run test 2>/dev/null | grep -E "(passing|failing)" || echo "❌ Tests failed"

# 4. Package validation
echo -e "\n📦 Package Status:"
npm pack --dry-run 2>/dev/null | wc -l | xargs echo "Package files:"
npm audit --level high 2>/dev/null | grep -E "(high|critical)" | wc -l | xargs echo "Security issues:"

# 5. Release script validation
echo -e "\n🚀 Release Scripts:"
for script in prepare-release.sh create-release-tag.sh publish-npm-package.sh; do
    if [[ -x "scripts/$script" ]]; then
        echo "✅ $script"
    else
        echo "❌ $script missing or not executable"
    fi
done
```

### Common Issue Quick Fixes

| Issue             | Quick Fix                    | Full Solution                                    |
| ----------------- | ---------------------------- | ------------------------------------------------ |
| Git dirty state   | `git stash`                  | [Git Issues](#git-and-version-control-issues)    |
| Tests failing     | `npm run test -- --verbose`  | [Testing Issues](#testing-and-validation-issues) |
| Build failure     | `npm run build -- --verbose` | [Build Issues](#build-and-packaging-issues)      |
| npm auth error    | `npm login`                  | [npm Issues](#npm-publishing-issues)             |
| GPG signing error | `git config user.signingkey` | [GPG Issues](#gpg-signing-issues)                |

## Pre-Release Issues

### Environment and Dependencies

#### Node.js Version Compatibility

**Symptoms**: Build failures, package installation errors, runtime issues  
**Diagnosis**:

```bash
# Check Node.js version
node --version  # Should be >=18.0.0

# Check npm version
npm --version   # Should be >=8.0.0

# Verify package.json engines
jq '.engines' package.json
```

**Solutions**:

```bash
# Update Node.js using nvm
nvm install 18
nvm use 18
nvm alias default 18

# Update npm
npm install -g npm@latest

# Clear npm cache if needed
npm cache clean --force
```

#### Dependency Installation Issues

**Symptoms**: `npm install` failures, missing dependencies, version conflicts  
**Diagnosis**:

```bash
# Check for dependency issues
npm audit
npm outdated
npm ls --depth=0

# Check for conflicting dependencies
npm ls --depth=0 | grep -E "UNMET|invalid"
```

**Solutions**:

```bash
# Clean install
rm -rf node_modules package-lock.json
npm install

# Fix audit issues
npm audit fix

# Update outdated dependencies
npm update

# Force resolution of conflicts
npm install --force  # Use with caution
```

### Build and Packaging Issues

#### TypeScript Compilation Errors

**Symptoms**: `tsc` errors, type checking failures, missing type definitions  
**Diagnosis**:

```bash
# Run TypeScript compiler directly
npx tsc --noEmit

# Check TypeScript configuration
cat tsconfig.json

# Verify type dependencies
npm ls @types/node @types/jest typescript
```

**Solutions**:

```bash
# Fix common TypeScript issues
npm install --save-dev @types/node@latest @types/jest@latest
npm install --save-dev typescript@latest

# Clear TypeScript cache
rm -rf dist/
npx tsc --build --clean

# Rebuild with verbose output
npm run build -- --verbose
```

#### Package Bundling Problems

**Symptoms**: Missing files in package, incorrect file permissions, large package size  
**Diagnosis**:

```bash
# Check package contents
npm pack --dry-run

# Verify package.json files field
jq '.files' package.json

# Check package size
npm pack proxmox-mpc
ls -lh proxmox-mpc-*.tgz
```

**Solutions**:

```bash
# Update files field in package.json
jq '.files = ["dist/**/*", "bin/**/*", "README.md", "CHANGELOG.md", "LICENSE"]' package.json > tmp.json && mv tmp.json package.json

# Fix file permissions
chmod +x bin/proxmox-mpc
chmod +x scripts/*.sh

# Reduce package size
echo "node_modules/" >> .npmignore
echo "src/" >> .npmignore
echo "*.test.ts" >> .npmignore
```

### Testing and Validation Issues

#### Test Suite Failures

**Symptoms**: Jest tests failing, timeout errors, database connection issues  
**Diagnosis**:

```bash
# Run tests with detailed output
npm run test -- --verbose --no-cache

# Run specific test categories
npm run test:database
npm run test:coverage

# Check test configuration
cat jest.config.js
```

**Solutions**:

```bash
# Fix common test issues
npm run test -- --clearCache

# Update test snapshots
npm run test -- --updateSnapshot

# Fix database test issues
rm -f prisma/test.db
npm run test:database

# Run tests in band (avoid concurrency issues)
npm run test -- --runInBand
```

#### Quality Gate Failures

**Symptoms**: ESLint errors, Prettier formatting issues, low test coverage  
**Diagnosis**:

```bash
# Check linting issues
npm run lint

# Check formatting issues
npm run format:check

# Check test coverage
npm run test:coverage
```

**Solutions**:

```bash
# Fix linting and formatting
npm run lint -- --fix
npm run format

# Improve test coverage (if below 80%)
# Add tests for uncovered code
npm run test:coverage -- --collectCoverageFrom="src/**/*.ts" --coverageReporters="text"
```

## Release Process Issues

### Git and Version Control Issues

#### Dirty Working Directory

**Symptoms**: "Git working directory not clean" error  
**Diagnosis**:

```bash
git status
git diff --name-only
```

**Solutions**:

```bash
# Option 1: Commit changes
git add .
git commit -m "chore: prepare for release"

# Option 2: Stash changes temporarily
git stash push -m "temporary stash for release"
# ... perform release ...
git stash pop

# Option 3: Clean working directory (dangerous)
git reset --hard HEAD
git clean -fd  # This removes untracked files!
```

#### Tag Creation Failures

**Symptoms**: Tag creation fails, tag already exists, GPG signing errors  
**Diagnosis**:

```bash
# Check existing tags
git tag -l | grep $(jq -r '.version' package.json)

# Check GPG configuration
git config user.signingkey
gpg --list-secret-keys
```

**Solutions**:

```bash
# Delete existing tag if needed
git tag -d v1.0.0
git push origin :refs/tags/v1.0.0

# Fix GPG signing
git config --global user.signingkey YOUR_GPG_KEY_ID
git config --global commit.gpgsign true
git config --global tag.gpgsign true

# Test GPG signing
echo "test" | gpg --clearsign
```

#### Branch Strategy Issues

**Symptoms**: Wrong branch for release, merge conflicts, missing commits  
**Diagnosis**:

```bash
# Check current branch
git branch --show-current

# Check branch history
git log --oneline --graph --decorate --all -10

# Check for merge conflicts
git status | grep -E "(modified|deleted|added)"
```

**Solutions**:

```bash
# Switch to correct branch
git checkout main

# Resolve merge conflicts
git pull origin main
# Fix conflicts manually
git add .
git commit -m "resolve merge conflicts"

# Ensure branch is up to date
git fetch origin
git rebase origin/main
```

### Version Management Issues

#### Semantic Version Calculation

**Symptoms**: Wrong version bump, version conflicts, pre-release format errors  
**Diagnosis**:

```bash
# Check current version
jq '.version' package.json

# Analyze commits for version bump
git log $(git describe --tags --abbrev=0)..HEAD --oneline

# Check version calculation logic
./scripts/version-bump.sh --dry-run
```

**Solutions**:

```bash
# Manual version correction
npm version patch --no-git-tag-version  # For bug fixes
npm version minor --no-git-tag-version  # For features
npm version major --no-git-tag-version  # For breaking changes

# Fix pre-release format
npm version 1.0.0-alpha.1 --no-git-tag-version

# Reset version if needed
git checkout package.json package-lock.json
```

#### Changelog Generation Issues

**Symptoms**: Empty changelog, formatting errors, missing entries  
**Diagnosis**:

```bash
# Check changelog generation
./scripts/generate-changelog.sh --dry-run

# Verify commit message format
git log --oneline -10 | grep -E "^(feat|fix|docs|style|refactor|test|chore)"

# Check changelog configuration
cat .versionrc.json
```

**Solutions**:

```bash
# Regenerate changelog
rm CHANGELOG.md
./scripts/generate-changelog.sh --force

# Fix commit message format for future commits
# Use conventional commits: feat:, fix:, docs:, etc.

# Manual changelog editing if needed
# Edit CHANGELOG.md directly following Keep a Changelog format
```

### GPG Signing Issues

#### GPG Key Configuration

**Symptoms**: "gpg: signing failed", "no secret key", GPG agent errors  
**Diagnosis**:

```bash
# List GPG keys
gpg --list-secret-keys

# Check Git GPG configuration
git config user.signingkey

# Test GPG signing
echo "test" | gpg --clearsign
```

**Solutions**:

```bash
# Generate new GPG key if needed
gpg --full-generate-key

# Configure Git to use GPG key
GPG_KEY=$(gpg --list-secret-keys --keyid-format LONG | grep sec | awk '{print $2}' | cut -d'/' -f2)
git config --global user.signingkey $GPG_KEY

# Start GPG agent if needed
gpg-agent --daemon

# Add GPG key to GitHub (if using GitHub)
gpg --armor --export $GPG_KEY
# Copy output and add to GitHub Settings > SSH and GPG keys
```

#### GPG Agent Issues

**Symptoms**: GPG agent timeout, password prompts, signing hangs  
**Diagnosis**:

```bash
# Check GPG agent status
gpg-connect-agent 'getinfo pid' /bye

# Check GPG configuration
cat ~/.gnupg/gpg.conf
cat ~/.gnupg/gpg-agent.conf
```

**Solutions**:

```bash
# Restart GPG agent
gpg-connect-agent reloadagent /bye

# Configure GPG agent
echo "default-cache-ttl 28800" >> ~/.gnupg/gpg-agent.conf
echo "max-cache-ttl 86400" >> ~/.gnupg/gpg-agent.conf

# Use pinentry for password prompts
echo "pinentry-program /usr/bin/pinentry-curses" >> ~/.gnupg/gpg-agent.conf
```

## Publishing Issues

### npm Publishing Issues

#### Authentication Failures

**Symptoms**: "npm ERR! 401 Unauthorized", "Login required", authentication errors  
**Diagnosis**:

```bash
# Check npm authentication
npm whoami

# Check npm configuration
npm config list

# Check package access
npm access list packages proxmox-mpc
```

**Solutions**:

```bash
# Login to npm
npm login

# Configure npm registry
npm config set registry https://registry.npmjs.org/

# Use authentication token if available
npm config set //registry.npmjs.org/:_authToken=$NPM_TOKEN

# Verify authentication
npm whoami
```

#### Package Publishing Errors

**Symptoms**: "Package already exists", "Version already published", publishing failures  
**Diagnosis**:

```bash
# Check published versions
npm view proxmox-mpc versions --json

# Check package configuration
jq '.publishConfig' package.json

# Verify package content
npm pack --dry-run
```

**Solutions**:

```bash
# Bump version if already published
npm version patch --no-git-tag-version

# Force publishing (use with caution)
npm publish --force

# Publish with specific tag
npm publish --tag beta

# Unpublish if within 24 hours (use with extreme caution)
npm unpublish proxmox-mpc@1.0.0
```

#### Registry and Network Issues

**Symptoms**: Network timeouts, registry unavailable, proxy errors  
**Diagnosis**:

```bash
# Test registry connectivity
npm ping

# Check network configuration
npm config get proxy
npm config get https-proxy

# Check DNS resolution
nslookup registry.npmjs.org
```

**Solutions**:

```bash
# Configure registry mirrors
npm config set registry https://registry.npmjs.org/

# Configure proxy if needed
npm config set proxy http://proxy.company.com:8080
npm config set https-proxy http://proxy.company.com:8080

# Clear npm cache
npm cache clean --force

# Retry with different network
# Consider using mobile hotspot or different connection
```

## Post-Release Issues

### Package Verification Issues

#### Installation Failures

**Symptoms**: `npm install -g proxmox-mpc` fails, missing binary, permission errors  
**Diagnosis**:

```bash
# Test package installation
npm install -g proxmox-mpc@latest

# Check binary availability
which proxmox-mpc
proxmox-mpc --version

# Check package contents
npm pack proxmox-mpc@latest
tar -tf proxmox-mpc-*.tgz
```

**Solutions**:

```bash
# Fix binary permissions in package
chmod +x bin/proxmox-mpc

# Update package.json bin field
jq '.bin = {"proxmox-mpc": "bin/proxmox-mpc"}' package.json > tmp.json && mv tmp.json package.json

# Fix global installation permissions
sudo chown -R $(whoami) $(npm config get prefix)/{lib/node_modules,bin,share}

# Use different global directory
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
```

#### Runtime Errors

**Symptoms**: Command crashes, missing dependencies, configuration errors  
**Diagnosis**:

```bash
# Test basic functionality
proxmox-mpc --help
proxmox-mpc --version

# Check error details
proxmox-mpc test-connection --verbose 2>&1

# Verify dependencies
npm ls -g proxmox-mpc
```

**Solutions**:

```bash
# Reinstall package
npm uninstall -g proxmox-mpc
npm install -g proxmox-mpc@latest

# Check for missing system dependencies
# Ensure required system packages are installed

# Clear user configuration if needed
rm -rf ~/.proxmox-mpc/
```

### Release Communication Issues

#### GitHub Release Creation

**Symptoms**: Release not created, release notes missing, automation failures  
**Diagnosis**:

```bash
# Check GitHub releases
curl -s https://api.github.com/repos/proxmox-mpc/proxmox-mpc/releases/latest

# Check GitHub authentication
gh auth status

# Verify release notes
cat RELEASE_NOTES_*.md
```

**Solutions**:

```bash
# Manually create GitHub release
gh release create v1.0.0 --title "v1.0.0" --notes-file RELEASE_NOTES_v1.0.0.md

# Fix GitHub authentication
gh auth login

# Regenerate release notes
./scripts/generate-release-announcement.sh --version 1.0.0
```

#### Documentation Updates

**Symptoms**: Documentation site not updated, version references outdated  
**Diagnosis**:

```bash
# Check documentation deployment
curl -s https://proxmox-mpc.dev | grep -o "v[0-9]\+\.[0-9]\+\.[0-9]\+"

# Check MkDocs configuration
cat mkdocs.yml | grep version

# Verify documentation build
mkdocs build --verbose
```

**Solutions**:

```bash
# Update version references in documentation
find docs/ -name "*.md" -exec sed -i 's/v1\.0\.0/v1.0.1/g' {} +

# Rebuild and deploy documentation
mkdocs build
mkdocs gh-deploy

# Manually trigger documentation deployment
./scripts/deploy-docs.sh
```

## Emergency Recovery Procedures

### Release Rollback

#### Quick Rollback Process

When a release needs immediate rollback:

```bash
#!/bin/bash
# Emergency rollback procedure

echo "🚨 EMERGENCY ROLLBACK INITIATED"

CURRENT_VERSION=$(jq -r '.version' package.json)
PREVIOUS_VERSION=$(git describe --tags --abbrev=0 HEAD~1)

echo "Rolling back from $CURRENT_VERSION to $PREVIOUS_VERSION"

# 1. Revert repository state
git checkout $PREVIOUS_VERSION

# 2. Create rollback version
ROLLBACK_VERSION="${PREVIOUS_VERSION}-rollback.$(date +%s)"
npm version $ROLLBACK_VERSION --no-git-tag-version

# 3. Quick publish
npm run build
npm publish --tag rollback

# 4. Update latest tag to previous stable
npm dist-tag add proxmox-mpc@$PREVIOUS_VERSION latest

echo "✅ Rollback complete to $ROLLBACK_VERSION"
echo "🔔 Notify team and users immediately"
```

#### Git State Recovery

```bash
# Recover from git state issues
git reflog  # Find commit to recover to
git reset --hard HEAD@{5}  # Reset to specific reflog entry

# Recover deleted tags
git fsck --full --no-reflogs --unreachable --lost-found
# Examine .git/lost-found/ for missing objects
```

### Data Recovery

#### Configuration Backup Recovery

```bash
# Restore release configuration
cp .versionrc.json.backup .versionrc.json
cp package.json.backup package.json

# Restore git configuration
git config --global --unset user.signingkey
git config --global user.signingkey BACKUP_KEY_ID
```

#### Release State Recovery

```bash
# Recover release state from backup
cp scripts/backup/release-state-$(date +%Y%m%d).json .release-state
./scripts/restore-release-state.sh
```

## Advanced Troubleshooting

### Debug Mode Operations

```bash
# Enable debug mode for all scripts
export DEBUG=1
export VERBOSE=1

# Run release with maximum debugging
./scripts/release-orchestrator.sh --type patch --dry-run --verbose --debug

# Enable npm debug logging
npm config set loglevel verbose
```

### Performance Troubleshooting

```bash
# Analyze release process performance
time ./scripts/prepare-release.sh --dry-run

# Profile test execution
npm run test -- --detectOpenHandles --forceExit

# Monitor system resources during release
htop &
./scripts/release-orchestrator.sh --type patch
```

### Network Troubleshooting

```bash
# Test network connectivity
ping registry.npmjs.org
curl -I https://registry.npmjs.org/

# Test DNS resolution
nslookup registry.npmjs.org
dig registry.npmjs.org

# Check proxy settings
echo $HTTP_PROXY
echo $HTTPS_PROXY
npm config get proxy
```

## Prevention and Monitoring

### Automated Health Monitoring

```bash
#!/bin/bash
# scripts/health-monitor.sh - Run before each release

# Check repository health
git fsck --full

# Check dependency health
npm audit --audit-level high

# Check build reproducibility
npm run build && npm run build  # Should produce identical results

# Check test stability
for i in {1..3}; do npm run test:coverage; done  # All runs should pass
```

### Release Quality Gates

Implement these checks in CI/CD:

```yaml
# .github/workflows/release-quality-gates.yml
name: Release Quality Gates
on:
  workflow_dispatch:
jobs:
  quality-gates:
    runs-on: ubuntu-latest
    steps:
      - name: Repository Health Check
        run: ./scripts/health-monitor.sh

      - name: Security Audit
        run: npm audit --audit-level high --production

      - name: Build Reproducibility
        run: |
          npm run build
          HASH1=$(find dist -type f -exec md5sum {} \; | sort | md5sum)
          npm run build  
          HASH2=$(find dist -type f -exec md5sum {} \; | sort | md5sum)
          [ "$HASH1" = "$HASH2" ] || exit 1

      - name: Package Validation
        run: |
          npm pack --dry-run
          SIZE=$(npm pack --dry-run | wc -l)
          [ $SIZE -gt 10 ] || exit 1  # Ensure package has content
```

---

## Quick Reference

### Emergency Commands

```bash
# Health check
./scripts/release-health-check.sh

# Emergency rollback
./scripts/emergency-rollback.sh

# Force clean state
git reset --hard HEAD && git clean -fd

# Restart release process
git stash && ./scripts/release-orchestrator.sh --type patch --auto-confirm
```

### Common File Locations

- **Logs**: `~/.npm/_logs/`, `./release-*.log`
- **Config**: `.versionrc.json`, `commitlint.config.js`, `package.json`
- **Scripts**: `./scripts/` directory
- **Backups**: `./backups/` directory (if created)

### Support Resources

- **Documentation**: `./docs/release/`
- **Issue Tracking**: GitHub Issues with `release` label
- **Team Communication**: Slack `#releases` channel
- **Emergency Contact**: Release Manager on-call rotation

This troubleshooting guide covers the most common issues and provides systematic approaches to resolution, helping maintain smooth release operations even when problems occur.
