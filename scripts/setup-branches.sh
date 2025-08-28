#!/bin/bash
set -e

# Proxmox-MPC Release Branch Setup Script
# This script initializes the Git Flow branch strategy

echo "🌿 Setting up Proxmox-MPC release branch strategy..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    print_error "Not in a git repository"
    exit 1
fi

# Check current branch
CURRENT_BRANCH=$(git branch --show-current)
print_status "Current branch: $CURRENT_BRANCH"

# Ensure we're on main branch
if [ "$CURRENT_BRANCH" != "main" ]; then
    print_warning "Switching to main branch..."
    git checkout main
fi

# Fetch all remotes
print_status "Fetching from remote..."
git fetch --all

# Create develop branch if it doesn't exist
if git show-ref --verify --quiet refs/heads/develop; then
    print_status "develop branch already exists"
else
    print_status "Creating develop branch from main..."
    git checkout -b develop
    git push -u origin develop
    print_success "develop branch created and pushed"
fi

# Switch back to main
git checkout main

# Set up branch protection rules (requires GitHub CLI)
if command -v gh &> /dev/null; then
    print_status "Setting up branch protection rules with GitHub CLI..."
    
    # Main branch protection
    print_status "Protecting main branch..."
    gh api repos/:owner/:repo/branches/main/protection \
        --method PUT \
        --field required_status_checks='{"strict":true,"contexts":["ci/tests","ci/build"]}' \
        --field enforce_admins=true \
        --field required_pull_request_reviews='{"required_approving_review_count":2,"dismiss_stale_reviews":true,"require_code_owner_reviews":false}' \
        --field restrictions=null \
        --field allow_force_pushes=false \
        --field allow_deletions=false \
        || print_warning "Could not set main branch protection (may need admin rights)"

    # Develop branch protection  
    print_status "Protecting develop branch..."
    gh api repos/:owner/:repo/branches/develop/protection \
        --method PUT \
        --field required_status_checks='{"strict":true,"contexts":["ci/tests","ci/build","ci/lint"]}' \
        --field enforce_admins=false \
        --field required_pull_request_reviews='{"required_approving_review_count":1,"dismiss_stale_reviews":true,"require_code_owner_reviews":false}' \
        --field restrictions=null \
        --field allow_force_pushes=false \
        --field allow_deletions=false \
        || print_warning "Could not set develop branch protection (may need admin rights)"
        
    print_success "Branch protection rules configured"
else
    print_warning "GitHub CLI not found. Branch protection rules must be set manually."
    print_status "Visit: https://github.com/proxmox-mpc/proxmox-mpc/settings/branches"
fi

# Create git aliases for common operations
print_status "Setting up git aliases for release workflow..."

git config alias.start-feature '!f() { git checkout develop && git pull origin develop && git checkout -b feature/$1; }; f'
git config alias.start-release '!f() { git checkout develop && git pull origin develop && git checkout -b release/v$1; }; f'
git config alias.start-hotfix '!f() { git checkout main && git pull origin main && git checkout -b hotfix/v$1; }; f'
git config alias.finish-feature '!f() { git checkout develop && git merge --no-ff feature/$1 && git branch -d feature/$1; }; f'
git config alias.finish-release '!f() { git checkout main && git merge --no-ff release/v$1 && git tag -a v$1 -m "Release v$1" && git checkout develop && git merge --no-ff release/v$1 && git branch -d release/v$1; }; f'
git config alias.finish-hotfix '!f() { git checkout main && git merge --no-ff hotfix/v$1 && git tag -a v$1 -m "Hotfix v$1" && git checkout develop && git merge --no-ff hotfix/v$1 && git branch -d hotfix/v$1; }; f'

print_success "Git aliases configured"

# Display available aliases
echo ""
print_status "Available git aliases:"
echo "  git start-feature <name>    - Start a new feature branch"
echo "  git start-release <version> - Start a new release branch"  
echo "  git start-hotfix <version>  - Start a new hotfix branch"
echo "  git finish-feature <name>   - Complete a feature branch"
echo "  git finish-release <version> - Complete a release branch"
echo "  git finish-hotfix <version> - Complete a hotfix branch"

echo ""
print_status "Example workflows:"
echo "  git start-feature interactive-console"
echo "  git start-release 1.2.0"
echo "  git start-hotfix 1.1.1"

# Verify setup
echo ""
print_status "Verifying branch setup..."

if git show-ref --verify --quiet refs/heads/main && git show-ref --verify --quiet refs/heads/develop; then
    print_success "✅ Both main and develop branches exist"
else
    print_error "❌ Branch setup incomplete"
    exit 1
fi

if git config --get alias.start-feature > /dev/null; then
    print_success "✅ Git aliases configured"
else
    print_error "❌ Git aliases not configured properly"
    exit 1
fi

echo ""
print_success "🎉 Branch strategy setup complete!"
print_status "📖 Read docs/release/branch-strategy.md for detailed workflow information"
print_status "🔧 Current branch: $(git branch --show-current)"

# Show current branch status
echo ""
print_status "Current repository status:"
git status --short
git log --oneline -5