#!/bin/bash

# generate-changelog.sh
# Automated changelog generation workflow for Proxmox-MPC
# Usage: ./scripts/generate-changelog.sh [--version VERSION] [--dry-run] [--release-type TYPE]

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
CHANGELOG_FILE="${PROJECT_ROOT}/CHANGELOG.md"
PACKAGE_JSON="${PROJECT_ROOT}/package.json"
TEMP_CHANGELOG="${PROJECT_ROOT}/.changelog.tmp"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
DRY_RUN=false
VERSION=""
RELEASE_TYPE="auto"
VERBOSE=false

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Automated changelog generation workflow for Proxmox-MPC

OPTIONS:
    --version VERSION       Specific version to generate changelog for (e.g., 1.0.0)
    --release-type TYPE     Release type: major|minor|patch|prerelease|auto (default: auto)
    --dry-run              Show what would be generated without making changes
    --verbose              Enable verbose output
    --help                 Show this help message

EXAMPLES:
    # Generate changelog for next patch version
    $0 --release-type patch

    # Generate changelog for specific version
    $0 --version 1.0.0

    # Preview changes without writing files
    $0 --dry-run --verbose

    # Generate changelog for major release
    $0 --release-type major

EOF
}

parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --version)
                VERSION="$2"
                shift 2
                ;;
            --release-type)
                RELEASE_TYPE="$2"
                shift 2
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --verbose)
                VERBOSE=true
                shift
                ;;
            --help)
                show_usage
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                ;;
        esac
    done
}

validate_dependencies() {
    local missing_deps=()
    
    if ! command -v git &> /dev/null; then
        missing_deps+=("git")
    fi
    
    if ! command -v node &> /dev/null; then
        missing_deps+=("node")
    fi
    
    if ! command -v npm &> /dev/null; then
        missing_deps+=("npm")
    fi
    
    if ! command -v jq &> /dev/null; then
        missing_deps+=("jq")
    fi
    
    if [[ ${#missing_deps[@]} -ne 0 ]]; then
        log_error "Missing dependencies: ${missing_deps[*]}"
    fi
    
    # Check if conventional-changelog-cli is installed
    if ! npm list -g conventional-changelog-cli &> /dev/null && ! npm list conventional-changelog-cli &> /dev/null; then
        log_error "conventional-changelog-cli is not installed. Run: npm install -g conventional-changelog-cli"
    fi
}

get_current_version() {
    jq -r '.version' "${PACKAGE_JSON}"
}

determine_next_version() {
    local current_version=$1
    local release_type=$2
    
    if [[ -n "$VERSION" ]]; then
        echo "$VERSION"
        return
    fi
    
    if [[ "$release_type" == "auto" ]]; then
        # Analyze commits to determine release type
        local breaking_changes=$(git log --grep="BREAKING CHANGE" --oneline --since="$(git describe --tags --abbrev=0)" | wc -l)
        local features=$(git log --grep="^feat" --oneline --since="$(git describe --tags --abbrev=0)" | wc -l)
        local fixes=$(git log --grep="^fix" --oneline --since="$(git describe --tags --abbrev=0)" | wc -l)
        
        if [[ $breaking_changes -gt 0 ]]; then
            release_type="major"
        elif [[ $features -gt 0 ]]; then
            release_type="minor"
        elif [[ $fixes -gt 0 ]]; then
            release_type="patch"
        else
            release_type="patch"
        fi
        
        log_info "Auto-detected release type: $release_type (breaking: $breaking_changes, features: $features, fixes: $fixes)"
    fi
    
    # Use semver to calculate next version
    case $release_type in
        major)
            node -e "
                const semver = require('semver');
                console.log(semver.inc('$current_version', 'major'));
            "
            ;;
        minor)
            node -e "
                const semver = require('semver');
                console.log(semver.inc('$current_version', 'minor'));
            "
            ;;
        patch)
            node -e "
                const semver = require('semver');
                console.log(semver.inc('$current_version', 'patch'));
            "
            ;;
        prerelease)
            node -e "
                const semver = require('semver');
                console.log(semver.inc('$current_version', 'prerelease', 'alpha'));
            "
            ;;
        *)
            log_error "Invalid release type: $release_type"
            ;;
    esac
}

analyze_commits() {
    local since_tag=$1
    local output_file=$2
    
    log_info "Analyzing commits since $since_tag..."
    
    # Get commit analysis
    local features=$(git log --grep="^feat" --oneline --since="$since_tag" | wc -l)
    local fixes=$(git log --grep="^fix" --oneline --since="$since_tag" | wc -l)
    local docs=$(git log --grep="^docs" --oneline --since="$since_tag" | wc -l)
    local chores=$(git log --grep="^chore" --oneline --since="$since_tag" | wc -l)
    local refactors=$(git log --grep="^refactor" --oneline --since="$since_tag" | wc -l)
    local tests=$(git log --grep="^test" --oneline --since="$since_tag" | wc -l)
    local breaking=$(git log --grep="BREAKING CHANGE" --oneline --since="$since_tag" | wc -l)
    
    cat >> "$output_file" << EOF

## Commit Analysis

- **Features**: $features new features added
- **Bug Fixes**: $fixes issues resolved  
- **Documentation**: $docs documentation updates
- **Maintenance**: $chores maintenance tasks
- **Refactoring**: $refactors code improvements
- **Testing**: $tests test additions/improvements
- **Breaking Changes**: $breaking breaking changes

### Notable Commits

#### Features (feat:)
EOF
    
    git log --grep="^feat" --oneline --since="$since_tag" --format="- %s ([%h](https://github.com/proxmox-mpc/proxmox-mpc/commit/%H))" >> "$output_file"
    
    echo "" >> "$output_file"
    echo "#### Bug Fixes (fix:)" >> "$output_file"
    git log --grep="^fix" --oneline --since="$since_tag" --format="- %s ([%h](https://github.com/proxmox-mpc/proxmox-mpc/commit/%H))" >> "$output_file"
    
    if [[ $breaking -gt 0 ]]; then
        echo "" >> "$output_file"
        echo "#### Breaking Changes" >> "$output_file"
        git log --grep="BREAKING CHANGE" --oneline --since="$since_tag" --format="- %s ([%h](https://github.com/proxmox-mpc/proxmox-mpc/commit/%H))" >> "$output_file"
    fi
}

generate_conventional_changelog() {
    local version=$1
    local output_file=$2
    
    log_info "Generating conventional changelog for version $version..."
    
    # Generate changelog using conventional-changelog
    cd "$PROJECT_ROOT"
    
    # Create temporary changelog
    conventional-changelog -p angular -r 1 > "$TEMP_CHANGELOG"
    
    if [[ $? -ne 0 ]]; then
        log_error "Failed to generate conventional changelog"
    fi
    
    # Process the generated changelog
    {
        echo "## [$version] - $(date '+%Y-%m-%d')"
        echo ""
        cat "$TEMP_CHANGELOG"
        echo ""
    } >> "$output_file"
    
    rm -f "$TEMP_CHANGELOG"
}

update_changelog() {
    local version=$1
    local new_content=$2
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN: Would update CHANGELOG.md with:"
        echo "---"
        cat "$new_content"
        echo "---"
        return
    fi
    
    log_info "Updating CHANGELOG.md..."
    
    # Backup existing changelog
    cp "$CHANGELOG_FILE" "${CHANGELOG_FILE}.backup"
    
    # Create new changelog with updated content
    {
        # Keep the header
        head -n 8 "$CHANGELOG_FILE"
        echo ""
        
        # Add new version content
        cat "$new_content"
        echo ""
        
        # Add existing content (skip unreleased section if it exists)
        tail -n +9 "$CHANGELOG_FILE" | grep -A 999999 "^## \[" || true
    } > "${CHANGELOG_FILE}.new"
    
    # Replace original with new version
    mv "${CHANGELOG_FILE}.new" "$CHANGELOG_FILE"
    
    log_success "CHANGELOG.md updated successfully"
    log_info "Backup saved as: ${CHANGELOG_FILE}.backup"
}

validate_git_state() {
    # Check if we're in a git repository
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        log_error "Not in a git repository"
    fi
    
    # Check for uncommitted changes
    if ! git diff-index --quiet HEAD --; then
        log_warning "There are uncommitted changes in the working directory"
        if [[ "$DRY_RUN" != "true" ]]; then
            read -p "Continue anyway? (y/N) " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                log_error "Aborted due to uncommitted changes"
            fi
        fi
    fi
}

update_package_version() {
    local version=$1
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN: Would update package.json version to $version"
        return
    fi
    
    log_info "Updating package.json version to $version..."
    
    # Update package.json version
    npm version "$version" --no-git-tag-version
    
    log_success "Package version updated to $version"
}

main() {
    log_info "Starting automated changelog generation..."
    
    parse_arguments "$@"
    validate_dependencies
    validate_git_state
    
    cd "$PROJECT_ROOT"
    
    local current_version
    current_version=$(get_current_version)
    
    local next_version
    next_version=$(determine_next_version "$current_version" "$RELEASE_TYPE")
    
    log_info "Current version: $current_version"
    log_info "Next version: $next_version"
    
    # Get the last tag for commit analysis
    local last_tag
    last_tag=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
    
    if [[ -z "$last_tag" ]]; then
        log_warning "No previous tags found, analyzing all commits"
        last_tag="$(git rev-list --max-parents=0 HEAD)"
    fi
    
    # Create temporary file for new changelog content
    local temp_content
    temp_content=$(mktemp)
    
    # Generate changelog content
    generate_conventional_changelog "$next_version" "$temp_content"
    analyze_commits "$last_tag" "$temp_content"
    
    # Update files
    update_changelog "$next_version" "$temp_content"
    update_package_version "$next_version"
    
    # Cleanup
    rm -f "$temp_content"
    
    if [[ "$DRY_RUN" != "true" ]]; then
        log_success "Changelog generation completed successfully!"
        log_info "Next steps:"
        log_info "  1. Review the generated CHANGELOG.md"
        log_info "  2. Commit the changes: git add . && git commit -m 'chore(release): prepare v$next_version'"
        log_info "  3. Create a tag: git tag v$next_version"
        log_info "  4. Push changes: git push && git push --tags"
    else
        log_info "DRY RUN completed - no files were modified"
    fi
}

# Run main function
main "$@"