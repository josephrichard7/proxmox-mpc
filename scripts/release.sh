#!/bin/bash

# Proxmox-MPC Release Script
# Professional semantic versioning release automation

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
RELEASE_TYPE="patch"
DRY_RUN=false
SKIP_TESTS=false
SKIP_BUILD=false

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to show usage
show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Professional release automation for Proxmox-MPC

OPTIONS:
    -t, --type TYPE       Release type: patch, minor, major, prerelease (default: patch)
    -d, --dry-run        Show what would be done without executing
    -s, --skip-tests     Skip test execution (not recommended)
    -b, --skip-build     Skip build process (not recommended)
    -h, --help           Show this help message

EXAMPLES:
    $0                   # Create patch release (0.1.3 -> 0.1.4)
    $0 -t minor          # Create minor release (0.1.3 -> 0.2.0)
    $0 -t major          # Create major release (0.1.3 -> 1.0.0)
    $0 -t prerelease     # Create prerelease (0.1.3 -> 0.1.4-alpha.0)
    $0 --dry-run         # Preview changes without executing

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--type)
            RELEASE_TYPE="$2"
            shift 2
            ;;
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -s|--skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        -b|--skip-build)
            SKIP_BUILD=true
            shift
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Validate release type
if [[ ! "$RELEASE_TYPE" =~ ^(patch|minor|major|prerelease)$ ]]; then
    print_error "Invalid release type: $RELEASE_TYPE"
    print_error "Valid types: patch, minor, major, prerelease"
    exit 1
fi

print_status "🚀 Starting Proxmox-MPC release process"
print_status "Release type: $RELEASE_TYPE"
if [[ "$DRY_RUN" == "true" ]]; then
    print_warning "DRY RUN MODE - No changes will be made"
fi

# Get current version
CURRENT_VERSION=$(node -p "require('./package.json').version")
print_status "Current version: $CURRENT_VERSION"

# Validate git repository state
print_status "Validating git repository state..."

if [[ ! -d ".git" ]]; then
    print_error "Not a git repository"
    exit 1
fi

# Check for uncommitted changes
if [[ -n $(git status --porcelain) ]]; then
    print_error "Working directory is not clean. Please commit or stash changes."
    git status --short
    exit 1
fi

# Check if on main branch
CURRENT_BRANCH=$(git branch --show-current)
if [[ "$CURRENT_BRANCH" != "main" ]]; then
    print_warning "Not on main branch (currently on: $CURRENT_BRANCH)"
    read -p "Continue anyway? [y/N] " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_error "Release cancelled"
        exit 1
    fi
fi

# Ensure we're up to date with remote
print_status "Checking remote synchronization..."
git fetch origin

LOCAL_COMMIT=$(git rev-parse HEAD)
REMOTE_COMMIT=$(git rev-parse origin/$CURRENT_BRANCH 2>/dev/null || echo "")

if [[ -n "$REMOTE_COMMIT" && "$LOCAL_COMMIT" != "$REMOTE_COMMIT" ]]; then
    print_error "Local branch is not up to date with remote"
    print_error "Run 'git pull origin $CURRENT_BRANCH' to update"
    exit 1
fi

# Run tests unless skipped
if [[ "$SKIP_TESTS" != "true" ]]; then
    print_status "Running test suite..."
    if [[ "$DRY_RUN" == "true" ]]; then
        print_status "[DRY RUN] Would run: npm test"
    else
        npm test
        print_success "Tests passed successfully"
    fi
else
    print_warning "Skipping tests (not recommended for production releases)"
fi

# Run build unless skipped
if [[ "$SKIP_BUILD" != "true" ]]; then
    print_status "Building project..."
    if [[ "$DRY_RUN" == "true" ]]; then
        print_status "[DRY RUN] Would run: npm run build"
    else
        npm run build
        print_success "Build completed successfully"
    fi
else
    print_warning "Skipping build (not recommended for production releases)"
fi

# Run linting
print_status "Running code quality checks..."
if [[ "$DRY_RUN" == "true" ]]; then
    print_status "[DRY RUN] Would run: npm run lint"
    print_status "[DRY RUN] Would run: npm run typecheck"
else
    npm run lint
    npm run typecheck
    print_success "Code quality checks passed"
fi

# Preview version bump
print_status "Previewing version bump..."
if [[ "$DRY_RUN" == "true" ]]; then
    NEW_VERSION=$(npm version $RELEASE_TYPE --no-git-tag-version --dry-run)
    print_status "[DRY RUN] Would bump version to: $NEW_VERSION"
    
    # Reset any changes made by dry run
    git checkout -- package.json package-lock.json 2>/dev/null || true
else
    # Create release with standard-version
    print_status "Creating release with standard-version..."
    
    if [[ "$RELEASE_TYPE" == "prerelease" ]]; then
        npx standard-version --prerelease alpha
    else
        npx standard-version --release-as $RELEASE_TYPE
    fi
    
    NEW_VERSION=$(node -p "require('./package.json').version")
    print_success "Released version $NEW_VERSION successfully"
fi

# Summary
print_success "Release process completed!"
print_status "Version: $CURRENT_VERSION → $NEW_VERSION"

if [[ "$DRY_RUN" != "true" ]]; then
    print_status "Next steps:"
    print_status "  1. Review the generated CHANGELOG.md"
    print_status "  2. Push changes: git push --follow-tags origin $CURRENT_BRANCH"
    print_status "  3. Publish to npm: npm publish"
    print_status "  4. Create GitHub release from the new tag"
    
    # Ask if user wants to push automatically
    read -p "Push changes to remote now? [y/N] " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_status "Pushing changes to remote..."
        git push --follow-tags origin $CURRENT_BRANCH
        print_success "Changes pushed successfully"
    fi
else
    print_status "This was a dry run. No changes were made."
    print_status "Run without --dry-run to perform the actual release"
fi