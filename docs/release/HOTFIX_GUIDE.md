# Hotfix Release Guide

**Emergency Release Procedures for Critical Issues**

## Overview

This guide covers emergency hotfix procedures for critical issues that require immediate deployment outside the normal release cycle. Hotfixes are used for security vulnerabilities, critical bugs, or production-breaking issues.

## When to Use Hotfix Releases

### Critical Issues Requiring Hotfix

- **Security Vulnerabilities**: CVE-rated vulnerabilities, data exposure, authentication bypass
- **Production Failures**: Application crashes, data corruption, complete service unavailability
- **Performance Degradation**: >50% performance regression affecting core functionality
- **Legal/Compliance**: Issues required by legal or regulatory compliance

### Issues NOT Requiring Hotfix

- Minor bugs with workarounds
- Feature requests or enhancements
- Documentation updates
- Non-critical performance improvements
- Cosmetic issues

## Hotfix Process Overview

**Timeline**: 30-60 minutes from identification to deployment  
**Required Personnel**: Release Manager + Developer + QA (if available)  
**Validation Level**: Reduced but focused testing on affected area

### Emergency Decision Matrix

| Severity     | User Impact                  | Timeline              | Approval Required                |
| ------------ | ---------------------------- | --------------------- | -------------------------------- |
| **Critical** | Complete service failure     | Immediate (15-30 min) | Release Manager                  |
| **High**     | Major functionality broken   | Fast (30-60 min)      | Release Manager + Lead Developer |
| **Medium**   | Minor functionality affected | Standard (1-4 hours)  | Full team review                 |

## Step-by-Step Hotfix Procedure

### 1. Issue Assessment and Triage

**Duration**: 5-10 minutes

```bash
# 1. Identify current production version
git describe --tags --abbrev=0  # e.g., v1.2.3

# 2. Assess impact scope
git log v1.2.3..HEAD --oneline  # Changes since last release

# 3. Document issue details
echo "HOTFIX REQUIRED" >> HOTFIX_LOG_$(date +%Y%m%d_%H%M%S).txt
```

**Questions to Answer**:

- What is the specific issue or vulnerability?
- How many users are affected?
- Is there a temporary workaround?
- What is the root cause?
- What is the minimal fix required?

### 2. Create Hotfix Branch

**Duration**: 2-3 minutes

```bash
# 1. Create hotfix branch from latest release tag
git checkout -b hotfix/v1.2.4 v1.2.3

# 2. Verify clean state
git status  # Should show clean working directory

# 3. Create tracking branch
git push -u origin hotfix/v1.2.4
```

**Branch Naming Convention**:

- `hotfix/v1.2.4` - Standard patch version bump
- `hotfix/security-2024-001` - Security-specific hotfixes
- `hotfix/critical-auth-fix` - Critical issue descriptive name

### 3. Implement Fix

**Duration**: 10-30 minutes

```bash
# 1. Make minimal, targeted changes
# Focus only on the specific issue
# Avoid any refactoring or cleanup

# 2. Test fix locally
npm run test  # Run full test suite
npm run test:database  # If database-related fix

# 3. Commit with clear message
git commit -m "fix: critical authentication bypass vulnerability (HOTFIX)"

# 4. Push changes
git push origin hotfix/v1.2.4
```

**Implementation Guidelines**:

- **Minimal Changes**: Fix only the specific issue, nothing else
- **Targeted Testing**: Focus testing on affected functionality
- **Clear Documentation**: Document what was changed and why
- **Risk Assessment**: Ensure fix doesn't introduce new issues

### 4. Hotfix Release Execution

**Duration**: 10-15 minutes

```bash
# 1. Execute hotfix release with confirmation bypass
./scripts/release-orchestrator.sh --type patch --auto-confirm --verbose

# Alternative: Step-by-step hotfix
./scripts/prepare-release.sh --type patch --skip-full-tests
./scripts/create-release-tag.sh --auto-confirm
./scripts/publish-npm-package.sh --auto-confirm
```

**Automated Hotfix Script** (recommended for emergencies):

```bash
#!/bin/bash
# hotfix-emergency-release.sh
set -euo pipefail

echo "🚨 EMERGENCY HOTFIX RELEASE"
echo "Current branch: $(git branch --show-current)"
echo "Last commit: $(git log -1 --oneline)"

read -p "Confirm emergency hotfix release? [yes/NO] " -r
if [[ $REPLY != "yes" ]]; then
    echo "Hotfix cancelled"
    exit 1
fi

# Execute minimal release process
./scripts/prepare-release.sh --type patch --skip-full-tests --auto-confirm
./scripts/create-release-tag.sh --auto-confirm
./scripts/publish-npm-package.sh --auto-confirm

echo "✅ Emergency hotfix deployed successfully"
```

### 5. Immediate Verification

**Duration**: 5-10 minutes

```bash
# 1. Verify npm package availability
npm view proxmox-mpc@latest version  # Should show new version

# 2. Test package installation
npm install -g proxmox-mpc@latest
proxmox-mpc --version  # Should match released version

# 3. Verify GitHub release
curl -s https://api.github.com/repos/proxmox-mpc/proxmox-mpc/releases/latest | jq .tag_name

# 4. Quick smoke test
proxmox-mpc test-connection  # Basic functionality check
```

### 6. Post-Hotfix Actions

**Duration**: 10-15 minutes

```bash
# 1. Merge hotfix back to main branch
git checkout main
git merge hotfix/v1.2.4 --no-ff -m "Merge hotfix/v1.2.4 - critical authentication fix"

# 2. Update develop branch (if using git-flow)
git checkout develop
git merge hotfix/v1.2.4 --no-ff

# 3. Clean up hotfix branch
git branch -d hotfix/v1.2.4
git push origin --delete hotfix/v1.2.4

# 4. Notify team and users
./scripts/notify-release.sh --emergency --auto-confirm
```

## Emergency Contact Procedures

### Team Notification Escalation

1. **Immediate**: Slack/Discord emergency channel
2. **Within 5 min**: Email to development team
3. **Within 15 min**: Notify stakeholders and users
4. **Within 30 min**: Update status page and documentation

### Communication Templates

#### Emergency Team Notification

```markdown
🚨 HOTFIX RELEASE INITIATED

**Issue**: Critical authentication bypass vulnerability
**Severity**: Critical - immediate action required
**Impact**: All users affected, authentication can be bypassed
**Timeline**: Hotfix deployment in progress (ETA 20 minutes)
**Version**: 1.2.3 → 1.2.4
**Action Required**: Team standby for verification and user support

**Details**:

- Issue identified: [timestamp]
- Root cause: JWT validation logic error
- Fix applied: Restore proper token validation
- Testing: Automated security tests + manual verification

**Next Steps**:

1. Monitor deployment
2. Verify fix effectiveness
3. Prepare user communication
4. Post-incident review scheduled

Release Manager: [Name]
```

#### User Communication (Post-Release)

```markdown
📢 SECURITY UPDATE: Proxmox-MPC v1.2.4

We've released an important security update to address a critical vulnerability.

**What happened**: A vulnerability was discovered that could allow unauthorized access
**Impact**: All versions prior to v1.2.4 are affected
**Action required**: Please update immediately using: `npm install -g proxmox-mpc@latest`

**Technical details**:

- CVE: [if applicable]
- Affected versions: < 1.2.4
- Fixed in version: 1.2.4
- No user data was compromised

**Timeline**:

- Issue discovered: [timestamp]
- Fix deployed: [timestamp]
- Total resolution time: [duration]

For questions, contact our support team or visit our documentation.
```

## Emergency Release Scripts

### Automated Hotfix Validation

```bash
#!/bin/bash
# scripts/hotfix-validation.sh
set -euo pipefail

echo "🔍 Hotfix Validation Checklist"

# 1. Verify branch naming
BRANCH=$(git branch --show-current)
if [[ ! $BRANCH =~ ^hotfix/ ]]; then
    echo "❌ Not on a hotfix branch"
    exit 1
fi

# 2. Verify minimal changes
CHANGED_FILES=$(git diff --name-only HEAD~1)
if [[ $(echo "$CHANGED_FILES" | wc -l) -gt 5 ]]; then
    echo "⚠️  Warning: More than 5 files changed - ensure changes are minimal"
    echo "Changed files:"
    echo "$CHANGED_FILES"
    read -p "Continue with hotfix? [y/N] " -n 1 -r
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# 3. Verify commit message format
COMMIT_MSG=$(git log -1 --pretty=format:"%s")
if [[ ! $COMMIT_MSG =~ HOTFIX ]]; then
    echo "⚠️  Warning: Commit message doesn't contain 'HOTFIX'"
    echo "Current: $COMMIT_MSG"
fi

# 4. Run focused tests
echo "Running focused test suite..."
npm run test:coverage -- --testNamePattern="critical|security|auth"

echo "✅ Hotfix validation completed"
```

### Emergency Rollback Procedure

```bash
#!/bin/bash
# scripts/emergency-rollback.sh
set -euo pipefail

echo "🚨 EMERGENCY ROLLBACK INITIATED"

CURRENT_VERSION=$(jq -r '.version' package.json)
PREVIOUS_TAG=$(git describe --tags --abbrev=0 HEAD~1)

echo "Rolling back from $CURRENT_VERSION to $PREVIOUS_TAG"

read -p "Confirm emergency rollback? [yes/NO] " -r
if [[ $REPLY != "yes" ]]; then
    echo "Rollback cancelled"
    exit 1
fi

# 1. Revert to previous tag
git checkout $PREVIOUS_TAG

# 2. Create rollback release
npm version patch --no-git-tag-version
ROLLBACK_VERSION=$(jq -r '.version' package.json)

# 3. Quick build and publish
npm run build
npm publish --tag rollback

# 4. Notify team
echo "✅ Emergency rollback completed: $ROLLBACK_VERSION"
echo "🔔 Notify team immediately about rollback"
```

## Hotfix Quality Standards

### Reduced Testing Requirements

Given the emergency nature, hotfix testing is focused but thorough:

**Required Tests**:

- ✅ **Unit Tests**: All existing tests must pass
- ✅ **Security Tests**: Specific to the vulnerability/issue being fixed
- ✅ **Smoke Tests**: Basic functionality verification
- ✅ **Regression Tests**: Ensure fix doesn't break existing functionality

**Optional Tests** (time permitting):

- Integration tests for affected components
- End-to-end user workflow tests
- Performance impact assessment
- Cross-platform compatibility checks

### Code Review Requirements

**Emergency Releases** (Critical severity):

- ✅ **Self-Review**: Developer reviews own changes thoroughly
- ✅ **Automated Checks**: All automated quality gates must pass
- ⏭️ **Peer Review**: Can be post-deployment if time-critical

**High Priority Releases**:

- ✅ **Peer Review**: At least one other developer reviews changes
- ✅ **Security Review**: For security-related fixes
- ✅ **Automated Checks**: All quality gates must pass

## Documentation Requirements

### Hotfix Documentation Checklist

- [ ] **Issue Description**: What was the problem?
- [ ] **Root Cause Analysis**: Why did it happen?
- [ ] **Fix Description**: What changes were made?
- [ ] **Impact Assessment**: Who was affected and how?
- [ ] **Testing Summary**: What testing was performed?
- [ ] **Deployment Timeline**: Key timestamps for the hotfix process
- [ ] **User Communication**: How users were notified
- [ ] **Prevention Measures**: How to prevent similar issues

### Post-Hotfix Review Template

```markdown
# Hotfix Post-Incident Review: v1.2.4

## Issue Summary

**Date**: 2024-01-15
**Duration**: 45 minutes (discovery to deployment)
**Severity**: Critical
**Impact**: All users could bypass authentication

## Timeline

- 09:15 UTC: Issue reported by security researcher
- 09:20 UTC: Issue confirmed and assessed as critical
- 09:25 UTC: Hotfix branch created
- 09:45 UTC: Fix implemented and tested
- 10:00 UTC: Hotfix v1.2.4 deployed and verified

## Root Cause

JWT validation logic was incorrectly updated in v1.2.2, allowing empty tokens to pass validation.

## Resolution

Restored proper JWT validation with comprehensive unit tests to prevent regression.

## What Went Well

- Fast issue identification and assessment
- Automated release process worked smoothly
- Team coordination was effective
- Fix was minimal and targeted

## What Could Be Improved

- Earlier security testing could have caught this
- Need better regression tests for authentication changes
- User notification could have been faster

## Action Items

- [ ] Add authentication regression tests to CI pipeline
- [ ] Implement automated security scanning in pre-commit hooks
- [ ] Create dedicated security review checklist
- [ ] Update emergency contact procedures

## Prevention

- Enhanced security testing in CI/CD
- Authentication changes require security team review
- Automated vulnerability scanning on all releases
```

## Training and Preparedness

### Hotfix Drill Schedule

**Monthly Drills**: Practice hotfix procedures with non-critical mock issues
**Quarterly Reviews**: Review and update emergency procedures
**Annual Training**: Full team training on emergency response

### Team Preparation Checklist

- [ ] All team members have repository write access
- [ ] npm publishing permissions configured
- [ ] Emergency contact information updated
- [ ] GPG keys configured for all release managers
- [ ] Communication channels tested and working
- [ ] Backup release managers identified and trained

### Mock Emergency Scenarios

1. **Authentication Bypass**: Practice hotfix for security vulnerability
2. **Database Corruption**: Simulate data integrity issue requiring immediate fix
3. **Performance Regression**: Handle 80% performance degradation hotfix
4. **Dependencies Vulnerability**: Fix high-severity dependency vulnerability

---

## Quick Reference Commands

### Emergency Hotfix (30 seconds)

```bash
# 1. Create hotfix branch from latest release
git checkout -b hotfix/v$(date +%Y%m%d_%H%M) $(git describe --tags --abbrev=0)

# 2. Make fix, commit, and deploy
# [implement fix]
git commit -m "fix: emergency hotfix for critical issue (HOTFIX)"
./scripts/release-orchestrator.sh --type patch --auto-confirm

# 3. Verify immediately
npm install -g proxmox-mpc@latest && proxmox-mpc --version
```

### Emergency Rollback (15 seconds)

```bash
# Quick rollback to previous version
git checkout $(git describe --tags --abbrev=0 HEAD~1)
npm publish --force --tag emergency-rollback
```

This guide provides comprehensive emergency procedures while maintaining quality and security standards appropriate for critical production fixes.
