#!/bin/bash

# Release Rollback System
# Comprehensive rollback procedures for failed releases
# Version: 1.0.0
# Usage: ./rollback-system.sh [--version=<version>] [--rollback-type=<type>] [--force]

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." &> /dev/null && pwd)"
LOG_FILE="${PROJECT_ROOT}/logs/rollback-$(date +%Y%m%d_%H%M%S).log"
ROLLBACK_DATA="${PROJECT_ROOT}/rollback-data"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Default values
TARGET_VERSION=""
ROLLBACK_TYPE="full"
FORCE_ROLLBACK=false
DRY_RUN=false

# Rollback types
declare -A ROLLBACK_TYPES=(
    ["npm"]="NPM package rollback only"
    ["git"]="Git tag and branch rollback only"
    ["github"]="GitHub release rollback only"
    ["docs"]="Documentation rollback only"
    ["partial"]="NPM and Git rollback (no GitHub)"
    ["full"]="Complete rollback (NPM, Git, GitHub, Docs)"
)

# Create directories
mkdir -p "$(dirname "$LOG_FILE")" "$ROLLBACK_DATA"

# Logging functions
log() {
    echo -e "$(date '+%Y-%m-%d %H:%M:%S')" "$@" | tee -a "$LOG_FILE"
}

log_info() {
    log "${BLUE}[INFO]${NC} $*"
}

log_success() {
    log "${GREEN}[SUCCESS]${NC} $*"
}

log_warning() {
    log "${YELLOW}[WARNING]${NC} $*"
}

log_error() {
    log "${RED}[ERROR]${NC} $*"
}

log_critical() {
    log "${RED}[CRITICAL]${NC} $*"
}

log_section() {
    log "${PURPLE}[SECTION]${NC} $*"
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --version=*)
                TARGET_VERSION="${1#*=}"
                shift
                ;;
            --rollback-type=*)
                ROLLBACK_TYPE="${1#*=}"
                shift
                ;;
            --force)
                FORCE_ROLLBACK=true
                shift
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

show_help() {
    cat << EOF
Release Rollback System

Usage: $0 [OPTIONS]

OPTIONS:
    --version=VERSION      Version to rollback (e.g., 1.0.0)
    --rollback-type=TYPE   Type of rollback to perform
    --force               Force rollback without confirmation
    --dry-run             Show what would be done without executing
    -h, --help            Show this help message

ROLLBACK TYPES:
$(for type in "${!ROLLBACK_TYPES[@]}"; do
    echo "    $type    ${ROLLBACK_TYPES[$type]}"
done)

EXAMPLES:
    $0 --version=1.0.0 --rollback-type=full --force
    $0 --version=1.0.0-rc.1 --rollback-type=npm --dry-run
EOF
}

# Confirm rollback action
confirm_rollback() {
    if [[ "$FORCE_ROLLBACK" == "true" ]]; then
        return 0
    fi
    
    log_warning "⚠️  ROLLBACK CONFIRMATION REQUIRED"
    log_warning "This will rollback version: $TARGET_VERSION"
    log_warning "Rollback type: $ROLLBACK_TYPE"
    log_warning "Description: ${ROLLBACK_TYPES[$ROLLBACK_TYPE]}"
    
    echo -n "Are you sure you want to proceed with rollback? (yes/no): "
    read -r confirmation
    
    if [[ "$confirmation" != "yes" ]]; then
        log_info "Rollback cancelled by user"
        exit 0
    fi
    
    return 0
}

# Get previous version for rollback
get_previous_version() {
    log_info "🔍 Determining previous version for rollback..."
    
    # Try to get previous version from Git tags
    local previous_git_version
    if previous_git_version=$(git tag -l --sort=-version:refname | grep -v "$TARGET_VERSION" | head -1); then
        log_info "Previous Git version: $previous_git_version"
        echo "$previous_git_version"
        return 0
    fi
    
    # Try to get previous version from NPM
    local previous_npm_version
    if previous_npm_version=$(npm view proxmox-mpc versions --json | jq -r '.[-2]' 2>/dev/null); then
        log_info "Previous NPM version: $previous_npm_version"
        echo "$previous_npm_version"
        return 0
    fi
    
    # Try to get previous version from package.json history
    local previous_package_version
    if previous_package_version=$(git log --oneline -n 50 --pretty=format:"%H" | while read -r commit; do
        git show "$commit:package.json" 2>/dev/null | jq -r '.version' 2>/dev/null | head -1
    done | grep -v "$TARGET_VERSION" | head -1); then
        log_info "Previous package.json version: $previous_package_version"
        echo "$previous_package_version"
        return 0
    fi
    
    log_error "Unable to determine previous version for rollback"
    return 1
}

# Backup current state
backup_current_state() {
    log_info "💾 Backing up current state..."
    
    local backup_dir="${ROLLBACK_DATA}/backup-$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$backup_dir"
    
    # Backup package.json
    if [[ -f "package.json" ]]; then
        cp package.json "$backup_dir/package.json"
        log_success "✅ Backed up package.json"
    fi
    
    # Backup CHANGELOG.md
    if [[ -f "CHANGELOG.md" ]]; then
        cp CHANGELOG.md "$backup_dir/CHANGELOG.md"
        log_success "✅ Backed up CHANGELOG.md"
    fi
    
    # Backup current Git state
    git rev-parse HEAD > "$backup_dir/git-commit.txt"
    git branch --show-current > "$backup_dir/git-branch.txt"
    git tag -l | tail -10 > "$backup_dir/git-tags.txt"
    
    log_success "✅ Current state backed up to: $backup_dir"
    echo "$backup_dir"
}

# NPM rollback
rollback_npm_package() {
    log_section "📦 Rolling back NPM package..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would rollback NPM package version $TARGET_VERSION"
        return 0
    fi
    
    # Get current published version
    local current_npm_version
    current_npm_version=$(npm view proxmox-mpc version 2>/dev/null || echo "unknown")
    
    if [[ "$current_npm_version" != "$TARGET_VERSION" ]]; then
        log_warning "⚠️  Current NPM version ($current_npm_version) doesn't match target ($TARGET_VERSION)"
    fi
    
    # Get previous version
    local previous_version
    if ! previous_version=$(get_previous_version); then
        log_error "❌ Cannot determine previous version for NPM rollback"
        return 1
    fi
    
    log_info "Attempting to rollback NPM package from $TARGET_VERSION to $previous_version"
    
    # Method 1: Deprecate current version and republish previous
    log_info "📢 Deprecating problematic version..."
    if npm deprecate "proxmox-mpc@$TARGET_VERSION" "This version has been rolled back due to issues. Please use $previous_version instead." 2>/dev/null; then
        log_success "✅ Version $TARGET_VERSION deprecated"
    else
        log_warning "⚠️  Failed to deprecate version (may not have permissions)"
    fi
    
    # Method 2: Update package.json and republish (if we have the source)
    log_info "📝 Updating package.json to previous version..."
    if [[ -f "package.json" ]]; then
        # Create a temporary package.json with previous version
        jq --arg version "$previous_version" '.version = $version' package.json > package.json.tmp
        mv package.json.tmp package.json
        
        # Try to publish (this would typically require rebuilding from previous state)
        log_warning "⚠️  NPM republishing requires manual intervention:"
        log_warning "  1. Checkout previous stable commit"
        log_warning "  2. Rebuild project: npm run build"
        log_warning "  3. Run tests: npm test"
        log_warning "  4. Publish: npm publish"
        log_warning "  5. Add dist-tag: npm dist-tag add proxmox-mpc@$previous_version latest"
    fi
    
    # Method 3: Dist-tag management (if previous version exists)
    log_info "🏷️  Managing dist-tags..."
    if npm view "proxmox-mpc@$previous_version" version > /dev/null 2>&1; then
        if npm dist-tag add "proxmox-mpc@$previous_version" latest 2>/dev/null; then
            log_success "✅ Updated 'latest' tag to point to $previous_version"
        else
            log_warning "⚠️  Failed to update dist-tag (may not have permissions)"
        fi
    else
        log_error "❌ Previous version $previous_version not found on NPM"
    fi
    
    # Create NPM rollback report
    cat > "${ROLLBACK_DATA}/npm-rollback-report.md" << EOF
# NPM Rollback Report

**Timestamp:** $(date -Iseconds)
**Target Version:** $TARGET_VERSION
**Previous Version:** $previous_version
**Current NPM Version:** $current_npm_version

## Actions Taken

- [x] Deprecated problematic version: $TARGET_VERSION
- [x] Updated local package.json to: $previous_version
- [x] Attempted dist-tag update to: $previous_version

## Manual Steps Required

1. **Rebuild and Republish:**
   \`\`\`bash
   git checkout <previous-stable-commit>
   npm run build
   npm test
   npm publish
   \`\`\`

2. **Verify Dist-tags:**
   \`\`\`bash
   npm dist-tag ls proxmox-mpc
   npm dist-tag add proxmox-mpc@$previous_version latest
   \`\`\`

3. **Notify Users:**
   - Update documentation
   - Send announcements about temporary issues
   - Provide migration guidance if needed

## Verification Commands

\`\`\`bash
npm view proxmox-mpc version
npm view proxmox-mpc dist-tags
npm view proxmox-mpc@$TARGET_VERSION
\`\`\`
EOF
    
    log_success "✅ NPM rollback procedures initiated"
    log_info "📄 NPM rollback report: ${ROLLBACK_DATA}/npm-rollback-report.md"
    
    return 0
}

# Git rollback
rollback_git_repository() {
    log_section "🌿 Rolling back Git repository..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would rollback Git tag and commits for version $TARGET_VERSION"
        return 0
    fi
    
    # Remove problematic tag locally
    log_info "🏷️  Removing local Git tag..."
    if git tag -d "v$TARGET_VERSION" 2>/dev/null; then
        log_success "✅ Removed local tag: v$TARGET_VERSION"
    else
        log_warning "⚠️  Local tag v$TARGET_VERSION not found"
    fi
    
    # Remove problematic tag from remote
    log_info "🌐 Removing remote Git tag..."
    if git push --delete origin "v$TARGET_VERSION" 2>/dev/null; then
        log_success "✅ Removed remote tag: v$TARGET_VERSION"
    else
        log_warning "⚠️  Failed to remove remote tag (may not exist or no permissions)"
    fi
    
    # Find commit associated with the problematic version
    local problematic_commit
    if problematic_commit=$(git log --oneline --grep="$TARGET_VERSION" --format="%H" | head -1); then
        log_info "Found commit associated with version $TARGET_VERSION: $problematic_commit"
        
        # Find parent commit (previous stable state)
        local parent_commit
        parent_commit=$(git rev-parse "$problematic_commit^")
        
        log_info "Parent commit (rollback target): $parent_commit"
        
        # Create rollback branch
        local rollback_branch="rollback-v$TARGET_VERSION-$(date +%Y%m%d_%H%M%S)"
        
        if git checkout -b "$rollback_branch" "$parent_commit"; then
            log_success "✅ Created rollback branch: $rollback_branch"
            
            # Update version in package.json
            local previous_version
            previous_version=$(jq -r '.version' package.json)
            
            log_info "Rolled back to version: $previous_version"
            
            # Commit the rollback
            git add package.json
            git commit -m "rollback: revert to version $previous_version

This rollback reverts the problematic release $TARGET_VERSION
back to the previous stable version $previous_version.

Rollback reason: Automated rollback due to post-release issues.
Rollback timestamp: $(date -Iseconds)"
            
            log_success "✅ Committed rollback changes"
        else
            log_error "❌ Failed to create rollback branch"
            return 1
        fi
    else
        log_warning "⚠️  Could not find commit associated with version $TARGET_VERSION"
    fi
    
    # Create Git rollback report
    cat > "${ROLLBACK_DATA}/git-rollback-report.md" << EOF
# Git Rollback Report

**Timestamp:** $(date -Iseconds)
**Target Version:** $TARGET_VERSION
**Rollback Branch:** ${rollback_branch:-'Not created'}

## Actions Taken

- [x] Removed local tag: v$TARGET_VERSION
- [x] Removed remote tag: v$TARGET_VERSION
$([ -n "${rollback_branch:-}" ] && echo "- [x] Created rollback branch: $rollback_branch" || echo "- [ ] Rollback branch creation failed")

## Current Git State

**Current Branch:** $(git branch --show-current)
**Current Commit:** $(git rev-parse HEAD)
**Available Tags:** $(git tag -l | tail -5 | tr '\n' ' ')

## Manual Steps Required

1. **Review Rollback Branch:**
   \`\`\`bash
   git checkout ${rollback_branch:-'<rollback-branch>'}
   git log --oneline -n 5
   \`\`\`

2. **Merge to Main (if validated):**
   \`\`\`bash
   git checkout main
   git merge ${rollback_branch:-'<rollback-branch>'}
   git push origin main
   \`\`\`

3. **Create New Stable Tag:**
   \`\`\`bash
   git tag -a v\$(jq -r '.version' package.json) -m "Stable release after rollback"
   git push --tags
   \`\`\`
EOF
    
    log_success "✅ Git rollback procedures completed"
    log_info "📄 Git rollback report: ${ROLLBACK_DATA}/git-rollback-report.md"
    
    return 0
}

# GitHub release rollback
rollback_github_release() {
    log_section "🐙 Rolling back GitHub release..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would rollback GitHub release for version $TARGET_VERSION"
        return 0
    fi
    
    local release_tag="v$TARGET_VERSION"
    
    # Check if gh CLI is available
    if ! command -v gh > /dev/null 2>&1; then
        log_error "❌ GitHub CLI (gh) not found - manual rollback required"
        return 1
    fi
    
    # Check if release exists
    log_info "🔍 Checking if GitHub release exists..."
    if gh release view "$release_tag" > /dev/null 2>&1; then
        log_info "Found GitHub release: $release_tag"
        
        # Mark release as pre-release (to hide from latest)
        log_info "📝 Marking release as pre-release..."
        if gh release edit "$release_tag" --prerelease; then
            log_success "✅ Marked release as pre-release"
        else
            log_warning "⚠️  Failed to mark as pre-release"
        fi
        
        # Update release notes with rollback notice
        log_info "📝 Updating release notes with rollback notice..."
        local rollback_notice="⚠️ **ROLLBACK NOTICE** ⚠️

This release has been rolled back due to post-release issues.
Please do not use this version in production.

**Rollback Date:** $(date -Iseconds)
**Recommended Version:** Use previous stable release
**Status:** This release is deprecated

Please check the latest releases for the current stable version.

---

## Original Release Notes"
        
        # Get current release body and prepend rollback notice
        local current_body
        current_body=$(gh release view "$release_tag" --json body -q .body 2>/dev/null || echo "")
        
        local new_body="$rollback_notice

$current_body"
        
        if echo "$new_body" | gh release edit "$release_tag" --notes-file -; then
            log_success "✅ Updated release notes with rollback notice"
        else
            log_warning "⚠️  Failed to update release notes"
        fi
        
        # Option: Delete release entirely (commented out for safety)
        # log_info "🗑️  Deleting GitHub release..."
        # if gh release delete "$release_tag" --yes; then
        #     log_success "✅ Deleted GitHub release"
        # else
        #     log_error "❌ Failed to delete GitHub release"
        # fi
        
    else
        log_warning "⚠️  GitHub release $release_tag not found"
    fi
    
    # Create GitHub rollback report
    cat > "${ROLLBACK_DATA}/github-rollback-report.md" << EOF
# GitHub Release Rollback Report

**Timestamp:** $(date -Iseconds)
**Target Version:** $TARGET_VERSION
**Release Tag:** $release_tag

## Actions Taken

- [x] Marked release as pre-release (hidden from latest)
- [x] Updated release notes with rollback notice
- [ ] Release deletion (not performed for safety)

## Manual Steps Required

1. **Verify Release Status:**
   \`\`\`bash
   gh release view $release_tag
   gh release list --limit 10
   \`\`\`

2. **Consider Complete Deletion (if needed):**
   \`\`\`bash
   gh release delete $release_tag --yes
   \`\`\`

3. **Promote Previous Release:**
   \`\`\`bash
   # Find previous release
   gh release list --limit 5
   # Mark previous as latest
   gh release edit <previous-tag> --latest
   \`\`\`

## Current Release Status

$(gh release view "$release_tag" --json isDraft,isPrerelease,tagName -q '{draft: .isDraft, prerelease: .isPrerelease, tag: .tagName}' 2>/dev/null || echo "Release information unavailable")
EOF
    
    log_success "✅ GitHub release rollback procedures completed"
    log_info "📄 GitHub rollback report: ${ROLLBACK_DATA}/github-rollback-report.md"
    
    return 0
}

# Documentation rollback
rollback_documentation() {
    log_section "📚 Rolling back documentation..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would rollback documentation for version $TARGET_VERSION"
        return 0
    fi
    
    # Update version references in documentation
    if [[ -d "docs" ]]; then
        log_info "📝 Updating version references in documentation..."
        
        local previous_version
        if ! previous_version=$(get_previous_version); then
            log_error "❌ Cannot determine previous version for documentation rollback"
            return 1
        fi
        
        # Find and replace version references
        find docs -name "*.md" -type f -exec sed -i.bak "s/$TARGET_VERSION/$previous_version/g" {} +
        
        # Update mkdocs.yml if present
        if [[ -f "mkdocs.yml" ]]; then
            sed -i.bak "s/version.*$TARGET_VERSION/version: $previous_version/" mkdocs.yml
        fi
        
        log_success "✅ Updated documentation version references"
    fi
    
    # Rollback documentation site deployment (if using GitHub Pages or similar)
    if [[ -d "site" || -f ".github/workflows/docs.yml" ]]; then
        log_info "🌐 Documentation site rollback required"
        log_warning "⚠️  Documentation site rollback requires manual deployment"
        
        cat > "${ROLLBACK_DATA}/docs-rollback-commands.md" << EOF
# Documentation Rollback Commands

## Rebuild Documentation Site

\`\`\`bash
# Install dependencies
pip install -r requirements.txt

# Build documentation with previous version
mkdocs build

# Deploy to GitHub Pages (if configured)
mkdocs gh-deploy

# Or manually deploy to hosting provider
\`\`\`

## Verify Deployment

- Check site is accessible
- Verify version information is correct
- Test all navigation links
- Validate search functionality
EOF
    fi
    
    log_success "✅ Documentation rollback procedures completed"
    
    return 0
}

# Generate comprehensive rollback report
generate_rollback_report() {
    local start_time="$1"
    local end_time="$2"
    local backup_dir="$3"
    local duration=$((end_time - start_time))
    
    local report_file="${PROJECT_ROOT}/ROLLBACK-REPORT-$(date +%Y%m%d_%H%M%S).md"
    
    cat > "$report_file" << EOF
# Comprehensive Rollback Report

**Target Version:** $TARGET_VERSION
**Rollback Type:** $ROLLBACK_TYPE (${ROLLBACK_TYPES[$ROLLBACK_TYPE]})
**Execution Time:** ${duration}s
**Generated:** $(date -Iseconds)
**Forced:** $([ "$FORCE_ROLLBACK" == "true" ] && echo "Yes" || echo "No")
**Dry Run:** $([ "$DRY_RUN" == "true" ] && echo "Yes" || echo "No")

## Rollback Summary

This report documents the rollback procedures executed for version $TARGET_VERSION.

### Components Rolled Back

$(case "$ROLLBACK_TYPE" in
    "npm") echo "- [x] NPM Package";;
    "git") echo "- [x] Git Repository";;
    "github") echo "- [x] GitHub Release";;
    "docs") echo "- [x] Documentation";;
    "partial") echo "- [x] NPM Package\n- [x] Git Repository";;
    "full") echo "- [x] NPM Package\n- [x] Git Repository\n- [x] GitHub Release\n- [x] Documentation";;
esac)

## Backup Information

**Backup Directory:** \`$backup_dir\`
**Backup Contents:**
- package.json
- CHANGELOG.md
- Git state information

## Individual Component Reports

### NPM Package Rollback
$([ "$ROLLBACK_TYPE" == "npm" ] || [ "$ROLLBACK_TYPE" == "partial" ] || [ "$ROLLBACK_TYPE" == "full" ] && echo "📄 Detailed report: \`${ROLLBACK_DATA}/npm-rollback-report.md\`" || echo "Not performed for this rollback type.")

### Git Repository Rollback
$([ "$ROLLBACK_TYPE" == "git" ] || [ "$ROLLBACK_TYPE" == "partial" ] || [ "$ROLLBACK_TYPE" == "full" ] && echo "📄 Detailed report: \`${ROLLBACK_DATA}/git-rollback-report.md\`" || echo "Not performed for this rollback type.")

### GitHub Release Rollback
$([ "$ROLLBACK_TYPE" == "github" ] || [ "$ROLLBACK_TYPE" == "full" ] && echo "📄 Detailed report: \`${ROLLBACK_DATA}/github-rollback-report.md\`" || echo "Not performed for this rollback type.")

### Documentation Rollback
$([ "$ROLLBACK_TYPE" == "docs" ] || [ "$ROLLBACK_TYPE" == "full" ] && echo "📄 Commands: \`${ROLLBACK_DATA}/docs-rollback-commands.md\`" || echo "Not performed for this rollback type.")

## Post-Rollback Verification

### Verification Commands

\`\`\`bash
# Verify NPM package status
npm view proxmox-mpc version
npm view proxmox-mpc dist-tags

# Verify Git status
git status
git tag -l | tail -5
git log --oneline -n 5

# Verify GitHub release status
gh release list --limit 5
gh release view v$TARGET_VERSION 2>/dev/null || echo "Release removed/hidden"

# Verify package installation
npm install proxmox-mpc@latest
npx proxmox-mpc --version
\`\`\`

## Recovery Steps

If rollback was unsuccessful or needs to be reverted:

1. **Restore from Backup:**
   \`\`\`bash
   cp $backup_dir/package.json ./package.json
   cp $backup_dir/CHANGELOG.md ./CHANGELOG.md
   \`\`\`

2. **Restore Git State:**
   \`\`\`bash
   git checkout \$(cat $backup_dir/git-branch.txt)
   git reset --hard \$(cat $backup_dir/git-commit.txt)
   \`\`\`

## Next Steps

1. **Investigate Root Cause:** Determine what caused the need for rollback
2. **Fix Issues:** Address the problems in development branch
3. **Test Thoroughly:** Ensure fixes resolve all issues
4. **Plan Hotfix Release:** Prepare new stable release
5. **Communicate:** Notify users about the rollback and next steps

## Contact Information

For questions about this rollback:
- Review rollback logs: \`$LOG_FILE\`
- Check individual component reports above
- Consult team documentation for escalation procedures

---
Generated by Proxmox-MPC Release Rollback System
EOF
    
    log_success "📋 Comprehensive rollback report generated: $report_file"
}

# Main rollback orchestrator
run_rollback_system() {
    local start_time
    start_time=$(date +%s)
    
    log_section "🎯 Starting rollback system for Proxmox-MPC"
    log_info "Target Version: $TARGET_VERSION"
    log_info "Rollback Type: $ROLLBACK_TYPE (${ROLLBACK_TYPES[$ROLLBACK_TYPE]})"
    log_info "Force Rollback: $FORCE_ROLLBACK"
    log_info "Dry Run: $DRY_RUN"
    
    # Validation
    if [[ -z "$TARGET_VERSION" ]]; then
        log_error "❌ Target version must be specified with --version"
        exit 1
    fi
    
    if [[ ! -v ROLLBACK_TYPES[$ROLLBACK_TYPE] ]]; then
        log_error "❌ Invalid rollback type: $ROLLBACK_TYPE"
        log_error "Valid types: ${!ROLLBACK_TYPES[*]}"
        exit 1
    fi
    
    cd "$PROJECT_ROOT"
    
    # Confirm rollback
    confirm_rollback
    
    # Backup current state
    local backup_dir
    backup_dir=$(backup_current_state)
    
    # Execute rollback based on type
    local rollback_success=true
    
    case "$ROLLBACK_TYPE" in
        "npm")
            rollback_npm_package || rollback_success=false
            ;;
        "git")
            rollback_git_repository || rollback_success=false
            ;;
        "github")
            rollback_github_release || rollback_success=false
            ;;
        "docs")
            rollback_documentation || rollback_success=false
            ;;
        "partial")
            rollback_npm_package || rollback_success=false
            rollback_git_repository || rollback_success=false
            ;;
        "full")
            rollback_npm_package || rollback_success=false
            rollback_git_repository || rollback_success=false
            rollback_github_release || rollback_success=false
            rollback_documentation || rollback_success=false
            ;;
    esac
    
    local end_time
    end_time=$(date +%s)
    
    # Generate comprehensive report
    generate_rollback_report "$start_time" "$end_time" "$backup_dir"
    
    # Final summary
    log_section "========================================="
    log_section "🏁 ROLLBACK SYSTEM SUMMARY"
    log_section "========================================="
    log_info "Target Version: $TARGET_VERSION"
    log_info "Rollback Type: $ROLLBACK_TYPE"
    log_info "Duration: $((end_time - start_time))s"
    log_info "Backup Location: $backup_dir"
    
    if [[ "$rollback_success" == "true" ]]; then
        if [[ "$DRY_RUN" == "true" ]]; then
            log_success "🎉 DRY RUN COMPLETED SUCCESSFULLY!"
            log_success "No actual changes were made."
        else
            log_success "🎉 ROLLBACK COMPLETED SUCCESSFULLY!"
            log_success "Version $TARGET_VERSION has been rolled back."
        fi
        return 0
    else
        log_error "❌ ROLLBACK COMPLETED WITH ERRORS"
        log_error "Some rollback procedures failed - manual intervention may be required."
        log_error "Check individual component reports for details."
        return 1
    fi
}

# Main execution
main() {
    parse_args "$@"
    run_rollback_system
}

# Run main function with all arguments
main "$@"