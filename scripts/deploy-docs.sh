#!/bin/bash

# Documentation deployment script for Proxmox-MPC
# Supports version management with mike for MkDocs

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
VERSION="latest"
ALIAS=""
DRY_RUN=false
VERBOSE=false

# Functions
log() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

usage() {
    cat << EOF
Documentation Deployment Script for Proxmox-MPC

Usage: $0 [OPTIONS]

Options:
    -v, --version VERSION    Documentation version to deploy (default: latest)
    -a, --alias ALIAS        Version alias (latest, stable, dev)
    -d, --dry-run           Preview changes without deploying
    -V, --verbose           Enable verbose output
    -h, --help              Show this help message

Examples:
    $0                                  # Deploy as 'latest'
    $0 -v 1.0.0 -a stable             # Deploy v1.0.0 and alias as 'stable'
    $0 -v 1.1.0                        # Deploy v1.1.0 without alias
    $0 -v dev -a latest                # Deploy development docs as 'latest'
    $0 --dry-run -v 1.0.0 -a stable   # Preview deployment

Environment Variables:
    MIKE_REMOTE      Git remote for deployment (default: origin)
    MIKE_BRANCH      Git branch for deployment (default: gh-pages)
EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -v|--version)
            VERSION="$2"
            shift 2
            ;;
        -a|--alias)
            ALIAS="$2"
            shift 2
            ;;
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -V|--verbose)
            VERBOSE=true
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            error "Unknown option: $1"
            ;;
    esac
done

# Validation
if [[ -z "$VERSION" ]]; then
    error "Version is required"
fi

# Check if mike is installed
if ! command -v mike &> /dev/null; then
    error "mike is not installed. Please install it with: pip install mike"
fi

# Check if mkdocs.yml exists
if [[ ! -f "mkdocs.yml" ]]; then
    error "mkdocs.yml not found. Please run this script from the project root."
fi

# Check if we're in a git repository
if ! git rev-parse --git-dir &> /dev/null; then
    error "Not in a git repository"
fi

# Check for uncommitted changes
if [[ $(git status --porcelain) && "$DRY_RUN" != true ]]; then
    warn "You have uncommitted changes. Consider committing them first."
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

log "Starting documentation deployment..."
log "Version: $VERSION"
[[ -n "$ALIAS" ]] && log "Alias: $ALIAS"
log "Dry run: $DRY_RUN"

# Build documentation first
log "Building documentation..."
if [[ "$VERBOSE" == true ]]; then
    mkdocs build --strict --verbose
else
    mkdocs build --strict
fi

# Prepare mike command
MIKE_CMD="mike deploy"

if [[ "$DRY_RUN" == true ]]; then
    MIKE_CMD="$MIKE_CMD --list"
    log "DRY RUN: Would execute the following commands:"
fi

if [[ "$VERBOSE" == true ]]; then
    MIKE_CMD="$MIKE_CMD --verbose"
fi

# Add push flag for actual deployment
if [[ "$DRY_RUN" != true ]]; then
    MIKE_CMD="$MIKE_CMD --push --update-aliases"
fi

# Add version and alias
if [[ -n "$ALIAS" ]]; then
    MIKE_CMD="$MIKE_CMD $VERSION $ALIAS"
else
    MIKE_CMD="$MIKE_CMD $VERSION"
fi

# Execute mike command
log "Executing: $MIKE_CMD"
if [[ "$DRY_RUN" == true ]]; then
    echo "  $MIKE_CMD"
else
    eval "$MIKE_CMD"
fi

# Set default if alias is latest or stable
if [[ "$DRY_RUN" != true && ("$ALIAS" == "latest" || "$ALIAS" == "stable") ]]; then
    log "Setting default version to: $ALIAS"
    MIKE_DEFAULT_CMD="mike set-default --push $ALIAS"
    if [[ "$VERBOSE" == true ]]; then
        MIKE_DEFAULT_CMD="$MIKE_DEFAULT_CMD --verbose"
    fi
    eval "$MIKE_DEFAULT_CMD"
fi

# List current versions
log "Current documentation versions:"
mike list

if [[ "$DRY_RUN" == true ]]; then
    warn "This was a dry run. No changes were made."
    log "To deploy for real, run without the --dry-run flag"
else
    success "Documentation deployed successfully!"
    log "View at: https://proxmox-mpc.github.io/"
fi

# Additional information
cat << EOF

📚 Documentation Management Commands:

  List versions:     mike list
  Delete version:    mike delete <version>
  Set default:       mike set-default <version>
  Serve locally:     mike serve

🔗 Useful Links:

  Documentation:     https://proxmox-mpc.github.io/
  Repository:        https://github.com/proxmox-mpc/proxmox-mpc
  Issues:           https://github.com/proxmox-mpc/proxmox-mpc/issues

EOF