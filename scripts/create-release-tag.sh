#!/bin/bash

# Proxmox-MPC Git Release Tagging Script
# Professional git tagging with GPG signing and verification
# Part of Phase 3: Release Automation Workflows (WORKFLOW-002)

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration flags
DRY_RUN=false
FORCE_TAG=false
SKIP_GPG=false
VERBOSE=false
VERSION=""
TAG_MESSAGE=""
GPG_KEY_ID=""

# Tag validation
TAG_EXISTS=false
GPG_AVAILABLE=false

# Functions for output
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

Professional git tagging with GPG signing for Proxmox-MPC releases

OPTIONS:
    -v, --version VERSION    Version to tag (e.g., 1.0.0) - auto-detects from package.json if not provided
    -m, --message MESSAGE    Custom tag message (auto-generates if not provided)
    -k, --gpg-key KEY_ID    GPG key ID for signing (uses default signing key if not specified)
    -d, --dry-run           Show what would be done without executing
    -f, --force             Force creation of tag (overwrites existing)
    --skip-gpg              Skip GPG signing (not recommended for releases)
    --verbose               Enable verbose output
    -h, --help              Show this help message

EXAMPLES:
    $0                      # Auto-detect version from package.json and create signed tag
    $0 1.0.0               # Create signed tag for version 1.0.0
    $0 --version 1.2.3     # Create signed tag for version 1.2.3 with auto-generated message
    $0 --dry-run --verbose # Preview tag creation with detailed output
    $0 --force 1.0.0       # Force tag creation, overwriting existing tag

GPG SIGNING:
    - GPG signatures provide cryptographic verification of release authenticity
    - Tags are signed with your default GPG key unless --gpg-key is specified
    - Use --skip-gpg only for development or testing (not recommended for releases)
    
TAG FORMAT:
    - Tags follow the format: v{VERSION} (e.g., v1.0.0, v2.1.3-beta.1)
    - Semantic versioning compliance is validated
    - Tag messages include version details and changelog references

VERIFICATION:
    - Created tags can be verified with: git tag -v v{VERSION}
    - GPG signatures can be validated with: git verify-tag v{VERSION}

EOF
}

parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -v|--version)
                VERSION="$2"
                shift 2
                ;;
            -m|--message)
                TAG_MESSAGE="$2"
                shift 2
                ;;
            -k|--gpg-key)
                GPG_KEY_ID="$2"
                shift 2
                ;;
            -d|--dry-run)
                DRY_RUN=true
                shift
                ;;
            -f|--force)
                FORCE_TAG=true
                shift
                ;;
            --skip-gpg)
                SKIP_GPG=true
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
    print_status "Validating environment..."
    
    # Check if we're in a git repository
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        print_error "Not in a git repository"
        exit 1
    fi
    
    # Check for uncommitted changes
    if ! git diff-index --quiet HEAD --; then
        print_error "Working directory has uncommitted changes"
        git status --short
        exit 1
    fi
    
    # Check GPG availability
    if command -v gpg &> /dev/null; then
        GPG_AVAILABLE=true
        
        # Check if we have GPG keys available
        if ! gpg --list-secret-keys &> /dev/null; then
            print_warning "No GPG secret keys found"
            if [[ "$SKIP_GPG" != "true" ]]; then
                print_error "GPG signing requested but no secret keys available"
                print_status "Either configure GPG keys or use --skip-gpg flag"
                exit 1
            fi
        fi
        
        # Validate specific GPG key if provided
        if [[ -n "$GPG_KEY_ID" ]]; then
            if ! gpg --list-secret-keys "$GPG_KEY_ID" &> /dev/null; then
                print_error "GPG key not found: $GPG_KEY_ID"
                exit 1
            fi
            print_success "GPG key validated: $GPG_KEY_ID"
        fi
    else
        GPG_AVAILABLE=false
        if [[ "$SKIP_GPG" != "true" ]]; then
            print_warning "GPG not available - signing will be skipped"
            SKIP_GPG=true
        fi
    fi
    
    print_success "Environment validated"
}

determine_version() {
    if [[ -z "$VERSION" ]]; then
        # Auto-detect from package.json
        if [[ -f "package.json" ]]; then
            VERSION=$(jq -r '.version' package.json)
            print_status "Auto-detected version from package.json: $VERSION"
        else
            print_error "No version specified and package.json not found"
            print_status "Please specify version with --version or ensure package.json exists"
            exit 1
        fi
    fi
    
    # Validate semantic versioning
    if ! node -e "const semver=require('semver'); if (!semver.valid('$VERSION')) process.exit(1)" 2>/dev/null; then
        print_error "Invalid semantic version: $VERSION"
        print_status "Version must follow semantic versioning (e.g., 1.0.0, 2.1.3-beta.1)"
        exit 1
    fi
    
    print_success "Version validated: $VERSION"
}

check_existing_tag() {
    local tag_name="v$VERSION"
    
    if git tag | grep -q "^${tag_name}$"; then
        TAG_EXISTS=true
        print_warning "Tag already exists: $tag_name"
        
        if [[ "$FORCE_TAG" != "true" ]]; then
            print_error "Tag $tag_name already exists"
            print_status "Use --force to overwrite existing tag or choose a different version"
            exit 1
        else
            print_warning "Will overwrite existing tag due to --force flag"
        fi
    else
        print_success "Tag name available: $tag_name"
    fi
}

generate_tag_message() {
    local tag_name="v$VERSION"
    
    if [[ -n "$TAG_MESSAGE" ]]; then
        print_status "Using provided tag message"
        return
    fi
    
    # Generate comprehensive tag message
    local release_date=$(date '+%Y-%m-%d')
    local commit_count=$(git rev-list --count HEAD)
    local current_branch=$(git branch --show-current)
    
    TAG_MESSAGE=$(cat << EOF
Proxmox-MPC Release ${VERSION}

Release Information:
- Version: ${VERSION}
- Release Date: ${release_date}
- Branch: ${current_branch}
- Total Commits: ${commit_count}

This release includes:
EOF
)
    
    # Try to extract changelog information for this version
    if [[ -f "CHANGELOG.md" ]]; then
        local changelog_section=$(awk "/## \[${VERSION}\]/{flag=1; next} flag && /## \[.*\]/{flag=0} flag && NF" CHANGELOG.md 2>/dev/null | head -10)
        if [[ -n "$changelog_section" ]]; then
            TAG_MESSAGE+=$'\n\n'"Recent Changes:"$'\n'"$changelog_section"
        fi
    fi
    
    # Add verification information
    TAG_MESSAGE+=$'\n\n'"Verification:"
    TAG_MESSAGE+=$'\n'"- Tag: git tag -v ${tag_name}"
    if [[ "$SKIP_GPG" != "true" ]]; then
        TAG_MESSAGE+=$'\n'"- GPG: git verify-tag ${tag_name}"
    fi
    TAG_MESSAGE+=$'\n'"- Checksum: git show ${tag_name} --format='%H'"
    
    TAG_MESSAGE+=$'\n\n'"For full changelog: https://github.com/proxmox-mpc/proxmox-mpc/blob/main/CHANGELOG.md"
    
    if [[ "$VERBOSE" == "true" ]]; then
        print_status "Generated tag message:"
        echo "---"
        echo "$TAG_MESSAGE"
        echo "---"
    fi
}

create_release_tag() {
    local tag_name="v$VERSION"
    
    print_status "Creating release tag: $tag_name"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        print_status "[DRY RUN] Tag creation command:"
        
        if [[ "$SKIP_GPG" == "true" ]]; then
            echo "git tag -a \"$tag_name\" -m \"$TAG_MESSAGE\""
        else
            if [[ -n "$GPG_KEY_ID" ]]; then
                echo "git tag -s \"$tag_name\" -u \"$GPG_KEY_ID\" -m \"$TAG_MESSAGE\""
            else
                echo "git tag -s \"$tag_name\" -m \"$TAG_MESSAGE\""
            fi
        fi
        
        if [[ "$FORCE_TAG" == "true" ]]; then
            print_status "[DRY RUN] Would use --force flag to overwrite existing tag"
        fi
        
        return 0
    fi
    
    # Delete existing tag if force is enabled
    if [[ "$TAG_EXISTS" == "true" ]] && [[ "$FORCE_TAG" == "true" ]]; then
        print_status "Removing existing tag..."
        git tag -d "$tag_name"
        
        # Also remove from remote if it exists
        if git ls-remote --tags origin | grep -q "refs/tags/$tag_name"; then
            print_status "Removing tag from remote..."
            git push origin ":refs/tags/$tag_name" || print_warning "Failed to remove remote tag"
        fi
    fi
    
    # Create the tag
    local tag_cmd="git tag"
    
    # Add appropriate flags
    if [[ "$SKIP_GPG" == "true" ]]; then
        tag_cmd+=" -a"
    else
        tag_cmd+=" -s"
        if [[ -n "$GPG_KEY_ID" ]]; then
            tag_cmd+=" -u \"$GPG_KEY_ID\""
        fi
    fi
    
    # Add tag name and message
    tag_cmd+=" \"$tag_name\" -m \"$TAG_MESSAGE\""
    
    if [[ "$VERBOSE" == "true" ]]; then
        print_status "Executing: $tag_cmd"
    fi
    
    # Execute tag creation
    if eval "$tag_cmd"; then
        print_success "Tag created successfully: $tag_name"
    else
        print_error "Failed to create tag: $tag_name"
        exit 1
    fi
    
    # Verify tag creation
    if git tag | grep -q "^${tag_name}$"; then
        print_success "Tag verification: $tag_name exists"
    else
        print_error "Tag verification failed: $tag_name not found"
        exit 1
    fi
    
    # Verify GPG signature if signed
    if [[ "$SKIP_GPG" != "true" ]] && [[ "$GPG_AVAILABLE" == "true" ]]; then
        print_status "Verifying GPG signature..."
        if git verify-tag "$tag_name" 2>/dev/null; then
            print_success "GPG signature verified"
        else
            print_warning "GPG signature verification failed or not available"
        fi
    fi
}

display_tag_information() {
    local tag_name="v$VERSION"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        return 0
    fi
    
    print_status "Tag information:"
    echo ""
    
    # Display tag details
    echo "Tag: $tag_name"
    echo "Object: $(git rev-parse "$tag_name^{}")"
    echo "Type: $(git cat-file -t "$tag_name")"
    
    if [[ "$SKIP_GPG" != "true" ]]; then
        echo "Signed: $(git tag -v "$tag_name" &>/dev/null && echo "Yes" || echo "No")"
    fi
    
    echo ""
    
    # Display tag message
    print_status "Tag message:"
    git show "$tag_name" --format='%B' --no-patch | head -20
    
    echo ""
}

generate_verification_commands() {
    local tag_name="v$VERSION"
    
    print_status "Verification commands:"
    echo ""
    echo "# Verify tag exists:"
    echo "git tag -l \"$tag_name\""
    echo ""
    echo "# Show tag information:"
    echo "git show \"$tag_name\""
    echo ""
    
    if [[ "$SKIP_GPG" != "true" ]]; then
        echo "# Verify GPG signature:"
        echo "git verify-tag \"$tag_name\""
        echo ""
    fi
    
    echo "# Push tag to remote:"
    echo "git push origin \"$tag_name\""
    echo ""
    echo "# List all tags:"
    echo "git tag --sort=-version:refname"
    echo ""
}

main() {
    print_header "Proxmox-MPC Git Release Tagging"
    
    parse_arguments "$@"
    
    cd "$PROJECT_ROOT"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        print_warning "DRY RUN MODE - No changes will be made"
    fi
    
    # Execute tagging workflow
    validate_environment
    determine_version
    check_existing_tag
    generate_tag_message
    create_release_tag
    
    if [[ "$DRY_RUN" != "true" ]]; then
        display_tag_information
    fi
    
    generate_verification_commands
    
    # Final summary
    print_header "Release Tag Summary"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        print_status "🔍 This was a dry run - no tag was created"
        print_status "Run without --dry-run to create the actual tag"
    else
        print_success "🏷️  Release tag created successfully!"
        echo ""
        print_status "✅ Tag: v$VERSION"
        if [[ "$SKIP_GPG" != "true" ]]; then
            print_status "🔒 GPG: Signed"
        else
            print_status "⚠️  GPG: Not signed"
        fi
        print_status "📝 Message: Auto-generated with changelog references"
        echo ""
        print_status "🚀 Next steps:"
        print_status "   1. Review tag: git show v$VERSION"
        if [[ "$SKIP_GPG" != "true" ]]; then
            print_status "   2. Verify signature: git verify-tag v$VERSION"
        fi
        print_status "   3. Push to remote: git push origin v$VERSION"
        print_status "   4. Create GitHub release from tag"
    fi
    
    echo ""
}

# Execute main function
main "$@"