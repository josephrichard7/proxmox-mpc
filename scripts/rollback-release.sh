#!/bin/bash

# Proxmox-MPC Release Rollback Script
# Comprehensive rollback procedures for failed releases
# Part of Phase 3: Release Automation Workflows (WORKFLOW-005)

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKUP_DIR="${PROJECT_ROOT}/.release-backup"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration flags
VERSION=""
TARGET_VERSION=""
DRY_RUN=false
FORCE_ROLLBACK=false
KEEP_BACKUP=true
AUTO_CONFIRM=false
VERBOSE=false

# Rollback state
ROLLBACK_PLAN=()
BACKUP_CREATED=false
GIT_BACKUP_BRANCH=""
NPM_ROLLBACK_AVAILABLE=false

print_header() {
    echo ""
    echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"
    echo ""
}

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[⚠]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

show_usage() {
    cat << EOF
Usage: $0 [OPTIONS] [VERSION]

Comprehensive release rollback procedures for Proxmox-MPC

OPTIONS:
    -v, --version VERSION       Current problematic version to rollback from
    -t, --target VERSION        Target version to rollback to (auto-detects previous)
    -d, --dry-run              Preview rollback actions without executing
    -f, --force                Force rollback even with warnings
    --auto-confirm             Automatically confirm rollback actions
    --no-backup                Don't keep backup of current state
    --verbose                  Enable verbose output
    -h, --help                 Show this help message

ROLLBACK SCENARIOS:
    1. Failed npm publication
    2. Broken git tags or commits
    3. Package corruption or errors
    4. Documentation inconsistencies
    5. Version conflicts
    6. Production deployment issues

ROLLBACK ACTIONS:
    - Revert git commits and tags
    - Restore previous package.json version
    - Remove or deprecate npm package versions
    - Restore backup files and configurations
    - Update documentation and changelog
    - Notify stakeholders of rollback

EXAMPLES:
    $0                         # Rollback current version to previous
    $0 --version 1.2.3        # Rollback from specific version
    $0 --target 1.2.0         # Rollback to specific target version
    $0 --dry-run --verbose     # Preview rollback with detailed output
    $0 --force --auto-confirm  # Force rollback with no prompts

SAFETY FEATURES:
    - Automatic backup creation before rollback
    - Dry-run mode for safe testing
    - Multi-step confirmation prompts
    - Rollback plan generation and review
    - Post-rollback verification

EOF
}

parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -v|--version)
                VERSION="$2"
                shift 2
                ;;
            -t|--target)
                TARGET_VERSION="$2"
                shift 2
                ;;
            -d|--dry-run)
                DRY_RUN=true
                shift
                ;;
            -f|--force)
                FORCE_ROLLBACK=true
                shift
                ;;
            --auto-confirm)
                AUTO_CONFIRM=true
                shift
                ;;
            --no-backup)
                KEEP_BACKUP=false
                shift
                ;;
            --verbose)
                VERBOSE=true
                shift
                ;;
            -h|--help)
                show_usage
                exit 0
                ;;
            -*)
                print_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
            *)
                # Positional argument - treat as version
                if [[ -z "$VERSION" ]]; then
                    VERSION="$1"
                else
                    print_error "Too many positional arguments"
                    show_usage
                    exit 1
                fi
                shift
                ;;
        esac
    done
}

validate_environment() {
    print_status "Validating rollback environment..."
    
    # Check required tools
    local missing_deps=()
    local required_commands=("git" "node" "npm" "jq")
    
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            missing_deps+=("$cmd")
        fi
    done
    
    if [[ ${#missing_deps[@]} -ne 0 ]]; then
        print_error "Missing required dependencies: ${missing_deps[*]}"
        exit 1
    fi
    
    # Check if we're in a git repository
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        print_error "Not in a git repository"
        exit 1
    fi
    
    # Check if package.json exists
    if [[ ! -f "package.json" ]]; then
        print_error "package.json not found"
        exit 1
    fi
    
    # Check npm authentication for package operations
    local npm_user=$(npm whoami 2>/dev/null || echo "")
    if [[ -n "$npm_user" ]]; then
        print_success "npm authenticated as: $npm_user"
    else
        print_warning "npm not authenticated - package rollback will be limited"
    fi
    
    print_success "Environment validated"
}

determine_versions() {
    print_status "Determining rollback versions..."
    
    # Get current version if not specified
    if [[ -z "$VERSION" ]]; then
        VERSION=$(jq -r '.version' package.json)
        print_status "Current version: $VERSION"
    fi
    
    # Validate current version
    if ! node -e "const semver=require('semver'); if (!semver.valid('$VERSION')) process.exit(1)" 2>/dev/null; then
        print_error "Invalid current version: $VERSION"
        exit 1
    fi
    
    # Determine target version if not specified
    if [[ -z "$TARGET_VERSION" ]]; then
        # Try to find the previous tag
        local previous_tag=$(git tag --sort=-version:refname | grep -v "^v${VERSION}$" | head -1 | sed 's/^v//' || echo "")
        
        if [[ -n "$previous_tag" ]]; then
            TARGET_VERSION="$previous_tag"
            print_status "Auto-detected target version: $TARGET_VERSION"
        else
            # Fallback to patch decrement
            TARGET_VERSION=$(node -e "
                const semver = require('semver');
                const current = '$VERSION';
                const decremented = semver.inc(current, 'patch', false, -1);
                console.log(decremented || semver.inc(current, 'prepatch'));
            " 2>/dev/null || echo "")
            
            if [[ -n "$TARGET_VERSION" ]]; then
                print_warning "No previous tag found, using decremented version: $TARGET_VERSION"
            else
                print_error "Cannot determine target version automatically"
                print_status "Please specify target version with --target"
                exit 1
            fi
        fi
    fi
    
    # Validate target version
    if ! node -e "const semver=require('semver'); if (!semver.valid('$TARGET_VERSION')) process.exit(1)" 2>/dev/null; then
        print_error "Invalid target version: $TARGET_VERSION"
        exit 1
    fi
    
    # Ensure target version is different from current
    if [[ "$VERSION" == "$TARGET_VERSION" ]]; then
        print_error "Target version cannot be the same as current version"
        exit 1
    fi
    
    print_success "Rollback plan: $VERSION → $TARGET_VERSION"
}

analyze_rollback_scope() {
    print_status "Analyzing rollback scope..."
    
    ROLLBACK_PLAN=()
    
    # Check if git tag exists for current version
    if git tag | grep -q "^v${VERSION}$"; then
        ROLLBACK_PLAN+=("Remove git tag: v${VERSION}")
        
        # Check if commits need to be reverted
        local target_commit=""
        if git tag | grep -q "^v${TARGET_VERSION}$"; then
            target_commit=$(git rev-list -n 1 "v${TARGET_VERSION}")
        else
            print_warning "Target version tag not found: v${TARGET_VERSION}"
        fi
        
        if [[ -n "$target_commit" ]]; then
            local commits_to_revert=$(git rev-list --count "${target_commit}..HEAD")
            if [[ $commits_to_revert -gt 0 ]]; then
                ROLLBACK_PLAN+=("Revert $commits_to_revert commits since v${TARGET_VERSION}")
            fi
        fi
    else
        print_warning "Git tag not found: v${VERSION}"
    fi
    
    # Check if npm package needs rollback
    if npm info "proxmox-mpc@${VERSION}" &>/dev/null; then
        ROLLBACK_PLAN+=("Deprecate npm package: proxmox-mpc@${VERSION}")
        NPM_ROLLBACK_AVAILABLE=true
    else
        print_status "npm package not found: proxmox-mpc@${VERSION}"
    fi
    
    # Check for version consistency issues
    local version_files=(
        "package.json"
        "src/types/version.ts"
    )
    
    for file in "${version_files[@]}"; do
        if [[ -f "$file" ]]; then
            ROLLBACK_PLAN+=("Restore version in: $file")
        fi
    done
    
    # Check for build artifacts that need cleaning
    if [[ -d "dist" ]]; then
        ROLLBACK_PLAN+=("Clean build artifacts: dist/")
    fi
    
    # Check for changelog updates
    if [[ -f "CHANGELOG.md" ]] && grep -q "\[${VERSION}\]" "CHANGELOG.md"; then
        ROLLBACK_PLAN+=("Update CHANGELOG.md entry for v${VERSION}")
    fi
    
    if [[ "$VERBOSE" == "true" ]]; then
        print_status "Rollback plan (${#ROLLBACK_PLAN[@]} actions):"
        for action in "${ROLLBACK_PLAN[@]}"; do
            echo "  - $action"
        done
    fi
}

create_rollback_backup() {
    if [[ "$KEEP_BACKUP" != "true" ]]; then
        print_status "Backup creation skipped (--no-backup)"
        return 0
    fi
    
    print_status "Creating rollback backup..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        print_status "[DRY RUN] Would create backup in: $BACKUP_DIR"
        return 0
    fi
    
    mkdir -p "$BACKUP_DIR"
    
    # Create timestamp for backup
    local backup_timestamp=$(date '+%Y%m%d-%H%M%S')
    local backup_name="rollback-${VERSION}-${backup_timestamp}"
    local backup_path="${BACKUP_DIR}/${backup_name}"
    
    mkdir -p "$backup_path"
    
    # Backup current state files
    local files_to_backup=(
        "package.json"
        "package-lock.json"
        "CHANGELOG.md"
    )
    
    for file in "${files_to_backup[@]}"; do
        if [[ -f "$file" ]]; then
            cp "$file" "$backup_path/"
            if [[ "$VERBOSE" == "true" ]]; then
                print_status "Backed up: $file"
            fi
        fi
    done
    
    # Backup version.ts if it exists
    if [[ -f "src/types/version.ts" ]]; then
        mkdir -p "$backup_path/src/types"
        cp "src/types/version.ts" "$backup_path/src/types/"
    fi
    
    # Create git backup branch
    GIT_BACKUP_BRANCH="backup/pre-rollback-${VERSION}-${backup_timestamp}"
    git checkout -b "$GIT_BACKUP_BRANCH"
    git checkout -
    
    # Save backup metadata
    cat > "$backup_path/backup-metadata.json" << EOF
{
  "created": "$(date -u '+%Y-%m-%d %H:%M:%S UTC')",
  "rollbackFrom": "$VERSION",
  "rollbackTo": "$TARGET_VERSION",
  "gitBranch": "$GIT_BACKUP_BRANCH",
  "gitCommit": "$(git rev-parse HEAD)",
  "backupPath": "$backup_path"
}
EOF
    
    BACKUP_CREATED=true
    print_success "Backup created: $backup_name"
    print_status "Git backup branch: $GIT_BACKUP_BRANCH"
}

confirm_rollback_plan() {
    if [[ "$AUTO_CONFIRM" == "true" ]] || [[ "$DRY_RUN" == "true" ]]; then
        return 0
    fi
    
    print_header "Rollback Confirmation"
    
    print_status "Rollback Summary:"
    echo "  From Version: $VERSION"
    echo "  To Version: $TARGET_VERSION"
    echo "  Actions: ${#ROLLBACK_PLAN[@]}"
    echo "  Backup: $(if [[ "$KEEP_BACKUP" == "true" ]]; then echo "Yes"; else echo "No"; fi)"
    echo ""
    
    print_warning "This rollback will perform the following actions:"
    for action in "${ROLLBACK_PLAN[@]}"; do
        echo "  - $action"
    done
    echo ""
    
    if [[ "$BACKUP_CREATED" == "true" ]]; then
        print_success "✅ Backup created - rollback can be undone"
    else
        print_error "⚠️  No backup created - rollback may be irreversible"
    fi
    
    echo ""
    read -p "Continue with rollback? [y/N] " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_status "Rollback cancelled by user"
        exit 0
    fi
    
    # Additional confirmation for destructive actions
    if [[ "$NPM_ROLLBACK_AVAILABLE" == "true" ]]; then
        echo ""
        print_warning "This will deprecate the npm package version $VERSION"
        read -p "Are you sure you want to deprecate the npm package? [y/N] " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_status "npm package rollback skipped"
            NPM_ROLLBACK_AVAILABLE=false
        fi
    fi
}

execute_git_rollback() {
    print_status "Executing git rollback..."
    
    # Remove problematic tag
    if git tag | grep -q "^v${VERSION}$"; then
        if [[ "$DRY_RUN" == "true" ]]; then
            print_status "[DRY RUN] Would remove git tag: v${VERSION}"
        else
            print_status "Removing git tag: v${VERSION}"
            git tag -d "v${VERSION}"
            
            # Remove from remote if it exists
            if git ls-remote --tags origin | grep -q "refs/tags/v${VERSION}"; then
                print_status "Removing remote tag: v${VERSION}"
                git push origin ":refs/tags/v${VERSION}" || print_warning "Failed to remove remote tag"
            fi
            
            print_success "Git tag removed: v${VERSION}"
        fi
    fi
    
    # Revert commits if needed
    if git tag | grep -q "^v${TARGET_VERSION}$"; then
        local target_commit=$(git rev-list -n 1 "v${TARGET_VERSION}")
        local current_commit=$(git rev-parse HEAD)
        
        if [[ "$target_commit" != "$current_commit" ]]; then
            if [[ "$DRY_RUN" == "true" ]]; then
                print_status "[DRY RUN] Would reset to commit: $target_commit"
            else
                print_status "Resetting to target version commit: $target_commit"
                
                # Create a soft reset to preserve changes as staged
                git reset --soft "$target_commit"
                
                print_success "Git reset completed"
            fi
        fi
    fi
}

execute_package_rollback() {
    print_status "Executing package configuration rollback..."
    
    # Update package.json version
    if [[ "$DRY_RUN" == "true" ]]; then
        print_status "[DRY RUN] Would update package.json version to: $TARGET_VERSION"
    else
        print_status "Updating package.json version: $VERSION → $TARGET_VERSION"
        
        # Use npm version to update package.json
        npm version "$TARGET_VERSION" --no-git-tag-version
        
        print_success "package.json updated"
    fi
    
    # Update version.ts if it exists
    if [[ -f "src/types/version.ts" ]]; then
        if [[ "$DRY_RUN" == "true" ]]; then
            print_status "[DRY RUN] Would update src/types/version.ts"
        else
            print_status "Updating src/types/version.ts"
            
            sed -i.bak "s/export const VERSION = .*/export const VERSION = '$TARGET_VERSION';/" src/types/version.ts
            rm -f src/types/version.ts.bak
            
            print_success "version.ts updated"
        fi
    fi
}

execute_npm_rollback() {
    if [[ "$NPM_ROLLBACK_AVAILABLE" != "true" ]]; then
        return 0
    fi
    
    print_status "Executing npm package rollback..."
    
    # Check if user is authenticated
    local npm_user=$(npm whoami 2>/dev/null || echo "")
    if [[ -z "$npm_user" ]]; then
        print_warning "npm authentication required for package operations"
        return 0
    fi
    
    # Deprecate the problematic version
    if [[ "$DRY_RUN" == "true" ]]; then
        print_status "[DRY RUN] Would deprecate: proxmox-mpc@${VERSION}"
    else
        print_status "Deprecating npm package: proxmox-mpc@${VERSION}"
        
        local deprecation_message="This version has been rolled back due to issues. Please use v${TARGET_VERSION} or later."
        
        if npm deprecate "proxmox-mpc@${VERSION}" "$deprecation_message"; then
            print_success "npm package deprecated"
        else
            print_error "Failed to deprecate npm package"
        fi
    fi
}

clean_build_artifacts() {
    print_status "Cleaning build artifacts..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        print_status "[DRY RUN] Would clean: dist/, node_modules/.cache"
        return 0
    fi
    
    # Remove build output
    if [[ -d "dist" ]]; then
        rm -rf dist/
        print_status "Removed: dist/"
    fi
    
    # Remove cache directories
    if [[ -d "node_modules/.cache" ]]; then
        rm -rf node_modules/.cache/
        print_status "Removed: node_modules/.cache"
    fi
    
    print_success "Build artifacts cleaned"
}

update_changelog() {
    if [[ ! -f "CHANGELOG.md" ]]; then
        return 0
    fi
    
    print_status "Updating changelog..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        print_status "[DRY RUN] Would update CHANGELOG.md"
        return 0
    fi
    
    # Check if there's an entry for the rolled-back version
    if ! grep -q "\[${VERSION}\]" CHANGELOG.md; then
        print_status "No changelog entry found for v${VERSION}"
        return 0
    fi
    
    # Create backup of changelog
    cp CHANGELOG.md CHANGELOG.md.bak
    
    # Add rollback notice to the changelog
    local rollback_date=$(date '+%Y-%m-%d')
    local rollback_entry="## [${VERSION}] - ${rollback_date} [ROLLED BACK]

This version has been rolled back due to issues encountered after release.
Please use version ${TARGET_VERSION} or later.

**Rollback Date**: ${rollback_date}  
**Target Version**: ${TARGET_VERSION}  
**Reason**: Post-release issues detected

"
    
    # Insert rollback entry after the header
    awk -v entry="$rollback_entry" '
        /^# / && !inserted {
            print $0
            while ((getline line < "/dev/stdin") > 0 && line !~ /^## /) {
                print line
            }
            print entry
            print line
            inserted = 1
            next
        }
        { print }
    ' CHANGELOG.md.bak > CHANGELOG.md
    
    print_success "Changelog updated with rollback notice"
}

verify_rollback() {
    print_status "Verifying rollback..."
    
    local verification_errors=()
    
    # Verify package.json version
    local current_pkg_version=$(jq -r '.version' package.json)
    if [[ "$current_pkg_version" != "$TARGET_VERSION" ]]; then
        verification_errors+=("package.json version mismatch: $current_pkg_version != $TARGET_VERSION")
    fi
    
    # Verify version.ts if it exists
    if [[ -f "src/types/version.ts" ]]; then
        local version_ts_content=$(grep "export const VERSION = " src/types/version.ts | sed "s/.*'\(.*\)'.*/\1/" || echo "")
        if [[ "$version_ts_content" != "$TARGET_VERSION" ]]; then
            verification_errors+=("version.ts mismatch: $version_ts_content != $TARGET_VERSION")
        fi
    fi
    
    # Verify git tag removal
    if [[ "$DRY_RUN" != "true" ]] && git tag | grep -q "^v${VERSION}$"; then
        verification_errors+=("Git tag still exists: v${VERSION}")
    fi
    
    # Report verification results
    if [[ ${#verification_errors[@]} -eq 0 ]]; then
        print_success "Rollback verification passed"
    else
        print_error "Rollback verification failed:"
        for error in "${verification_errors[@]}"; do
            print_error "  - $error"
        done
        return 1
    fi
}

generate_rollback_report() {
    local report_file="${BACKUP_DIR}/rollback-report-$(date '+%Y%m%d-%H%M%S').md"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        print_status "[DRY RUN] Would generate rollback report"
        return 0
    fi
    
    mkdir -p "$BACKUP_DIR"
    
    cat > "$report_file" << EOF
# Proxmox-MPC Rollback Report

**Date**: $(date -u '+%Y-%m-%d %H:%M:%S UTC')  
**From Version**: $VERSION  
**To Version**: $TARGET_VERSION  
**Rollback Reason**: Post-release issues detected  

## Rollback Actions Performed

EOF
    
    for action in "${ROLLBACK_PLAN[@]}"; do
        echo "- ✅ $action" >> "$report_file"
    done
    
    cat >> "$report_file" << EOF

## Backup Information

$(if [[ "$BACKUP_CREATED" == "true" ]]; then
    echo "- **Backup Created**: Yes"
    echo "- **Backup Location**: $BACKUP_DIR"
    echo "- **Git Backup Branch**: $GIT_BACKUP_BRANCH"
else
    echo "- **Backup Created**: No"
fi)

## Post-Rollback Status

- **Current Version**: $(jq -r '.version' package.json 2>/dev/null || echo "N/A")
- **Git Status**: $(if git diff-index --quiet HEAD --; then echo "Clean"; else echo "Modified"; fi)
- **npm Package**: $(if [[ "$NPM_ROLLBACK_AVAILABLE" == "true" ]]; then echo "Deprecated v$VERSION"; else echo "No changes"; fi)

## Recovery Instructions

If you need to recover from this rollback:

1. **Restore from Git Backup**:
   \`\`\`bash
   git checkout $GIT_BACKUP_BRANCH
   git checkout -b recovery-branch
   \`\`\`

2. **Restore Files**:
   \`\`\`bash
   # Copy backed up files from: $BACKUP_DIR
   \`\`\`

3. **Republish npm Package** (if needed):
   \`\`\`bash
   npm undeprecate proxmox-mpc@$VERSION
   \`\`\`

## Next Steps

1. **Investigate Issues**: Identify root cause of rollback
2. **Fix Problems**: Address issues in v$TARGET_VERSION
3. **Test Thoroughly**: Validate fixes before next release
4. **Plan Re-release**: Prepare new version when ready

---

*Generated by Proxmox-MPC Rollback Script*
EOF
    
    print_success "Rollback report generated: $(basename "$report_file")"
}

main() {
    print_header "Proxmox-MPC Release Rollback"
    
    parse_arguments "$@"
    
    cd "$PROJECT_ROOT"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        print_warning "DRY RUN MODE - No changes will be made"
    fi
    
    if [[ "$FORCE_ROLLBACK" == "true" ]]; then
        print_warning "FORCE MODE - Bypassing some safety checks"
    fi
    
    # Execute rollback workflow
    validate_environment
    determine_versions
    analyze_rollback_scope
    create_rollback_backup
    confirm_rollback_plan
    
    # Perform rollback actions
    execute_git_rollback
    execute_package_rollback
    execute_npm_rollback
    clean_build_artifacts
    update_changelog
    
    # Verify and report
    if [[ "$DRY_RUN" != "true" ]]; then
        verify_rollback
    fi
    
    generate_rollback_report
    
    # Final summary
    print_header "Rollback Summary"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        print_success "🔍 Rollback preview completed successfully!"
        print_status "Run without --dry-run to perform the actual rollback"
        echo ""
        print_status "Planned actions:"
        for action in "${ROLLBACK_PLAN[@]}"; do
            print_status "  - $action"
        done
    else
        print_success "🔄 Release rollback completed successfully!"
        echo ""
        print_status "✅ Rolled back: $VERSION → $TARGET_VERSION"
        print_status "🔄 Actions performed: ${#ROLLBACK_PLAN[@]}"
        if [[ "$BACKUP_CREATED" == "true" ]]; then
            print_status "💾 Backup created: $GIT_BACKUP_BRANCH"
        fi
        if [[ "$NPM_ROLLBACK_AVAILABLE" == "true" ]]; then
            print_status "📦 npm package deprecated: v$VERSION"
        fi
        echo ""
        print_status "🚀 Next steps:"
        print_status "   1. Investigate root cause of rollback"
        print_status "   2. Fix issues identified"
        print_status "   3. Test fixes thoroughly"
        print_status "   4. Plan next release"
        echo ""
        print_status "📋 Recovery information available in: $BACKUP_DIR"
    fi
    
    echo ""
}

# Execute main function
main "$@"