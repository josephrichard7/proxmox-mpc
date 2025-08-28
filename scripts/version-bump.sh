#!/bin/bash
set -e

# Proxmox-MPC Automated Version Bumping Script
# Analyzes commits and bumps version according to semantic versioning

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Default values
BUMP_TYPE=""
DRY_RUN=false
SKIP_VALIDATION=false
FORCE_VERSION=""

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --type)
      BUMP_TYPE="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --skip-validation)
      SKIP_VALIDATION=true
      shift
      ;;
    --force-version)
      FORCE_VERSION="$2"
      shift 2
      ;;
    --help|-h)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --type <patch|minor|major>  Force specific version bump type"
      echo "  --dry-run                   Show what would be done without making changes"
      echo "  --skip-validation          Skip pre-bump validation checks"
      echo "  --force-version <version>   Set specific version (e.g., 1.2.3)"
      echo "  --help, -h                 Show this help message"
      echo ""
      echo "Examples:"
      echo "  $0                         # Auto-detect bump type from commits"
      echo "  $0 --type minor            # Force minor version bump"  
      echo "  $0 --dry-run               # Preview changes without applying"
      echo "  $0 --force-version 2.0.0  # Set specific version"
      exit 0
      ;;
    *)
      print_error "Unknown option: $1"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

# Validate we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    print_error "Not in a git repository"
    exit 1
fi

# Get current version
CURRENT_VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "0.0.0")
print_status "Current version: $CURRENT_VERSION"

# Get last tag for commit analysis
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
if [ -z "$LAST_TAG" ]; then
    COMMIT_RANGE="HEAD"
    print_warning "No previous tags found, analyzing all commits"
else
    COMMIT_RANGE="$LAST_TAG..HEAD"
    print_status "Analyzing commits since: $LAST_TAG"
fi

# Function to analyze commits and determine version bump
analyze_commits() {
    local range="$1"
    local breaking_changes=0
    local features=0
    local fixes=0
    
    print_status "Analyzing commits in range: $range" >&2
    
    # Get commits since last tag
    while IFS= read -r commit_msg; do
        if [[ -z "$commit_msg" ]]; then
            continue
        fi
        
        echo "  📝 $commit_msg" >&2
        
        # Check for breaking changes
        if [[ "$commit_msg" =~ feat!:|fix!:|BREAKING\ CHANGE: ]] || 
           git log --format=%B -n 1 | grep -q "BREAKING CHANGE:"; then
            breaking_changes=$((breaking_changes + 1))
            echo "    🚨 Breaking change detected" >&2
        # Check for features
        elif [[ "$commit_msg" =~ ^feat(\(.+\))?!?: ]]; then
            features=$((features + 1))
            echo "    ✨ Feature detected" >&2
        # Check for fixes
        elif [[ "$commit_msg" =~ ^fix(\(.+\))?: ]]; then
            fixes=$((fixes + 1))
            echo "    🐛 Fix detected" >&2
        fi
    done < <(git log --format="%s" "$range")
    
    echo "" >&2
    print_status "Commit analysis results:" >&2
    echo "  💥 Breaking changes: $breaking_changes" >&2
    echo "  ✨ Features: $features" >&2
    echo "  🐛 Fixes: $fixes" >&2
    
    # Determine version bump type and return it
    if [ $breaking_changes -gt 0 ]; then
        echo "major"
    elif [ $features -gt 0 ]; then
        echo "minor"
    elif [ $fixes -gt 0 ]; then
        echo "patch"
    else
        echo "patch"  # Default to patch for other changes
    fi
}

# Determine version bump type
if [ -n "$FORCE_VERSION" ]; then
    NEW_VERSION="$FORCE_VERSION"
    print_status "Using forced version: $NEW_VERSION"
elif [ -n "$BUMP_TYPE" ]; then
    print_status "Using forced bump type: $BUMP_TYPE"
    case $BUMP_TYPE in
        major|minor|patch)
            NEW_VERSION=$(npx semver -i "$BUMP_TYPE" "$CURRENT_VERSION")
            ;;
        *)
            print_error "Invalid bump type: $BUMP_TYPE. Use major, minor, or patch"
            exit 1
            ;;
    esac
else
    # Auto-detect from commits
    DETECTED_BUMP=$(analyze_commits "$COMMIT_RANGE")
    NEW_VERSION=$(npx semver -i "$DETECTED_BUMP" "$CURRENT_VERSION")
    print_status "Auto-detected bump type: $DETECTED_BUMP"
fi

print_status "Version change: $CURRENT_VERSION → $NEW_VERSION"

# Dry run mode - exit after showing what would happen
if [ "$DRY_RUN" = true ]; then
    print_status "DRY RUN MODE - No changes will be made"
    echo ""
    print_status "Would update:"
    echo "  📦 package.json: $CURRENT_VERSION → $NEW_VERSION"
    echo "  📄 src/types/version.ts: $CURRENT_VERSION → $NEW_VERSION"
    echo "  📋 CHANGELOG.md: Generate changelog entries"
    echo "  🏷️  Git tag: v$NEW_VERSION"
    exit 0
fi

# Pre-bump validation
if [ "$SKIP_VALIDATION" != true ]; then
    print_status "Running pre-bump validation..."
    
    # Check working directory is clean
    if ! git diff --quiet || ! git diff --cached --quiet; then
        print_error "Working directory is not clean. Commit or stash changes first."
        git status --porcelain
        exit 1
    fi
    
    # Run tests
    print_status "Running test suite..."
    npm test || {
        print_error "Tests failed. Fix tests before bumping version."
        exit 1
    }
    
    # Run linting
    print_status "Running linter..."
    npm run lint || {
        print_error "Linting failed. Fix lint errors before bumping version."
        exit 1
    }
    
    # Type checking
    print_status "Running type checks..."
    npm run typecheck || {
        print_error "Type checking failed. Fix type errors before bumping version."
        exit 1
    }
    
    print_success "✅ All validation checks passed"
fi

# Update package.json
print_status "Updating package.json..."
npm version "$NEW_VERSION" --no-git-tag-version

# Update src/types/version.ts
print_status "Updating src/types/version.ts..."
if [ -f "src/types/version.ts" ]; then
    sed -i "s/export const VERSION = '.*';/export const VERSION = '$NEW_VERSION';/" src/types/version.ts
    print_success "Updated version.ts"
else
    print_warning "src/types/version.ts not found, skipping"
fi

# Generate changelog
print_status "Generating changelog..."
npx conventional-changelog -p angular -i CHANGELOG.md -s -r 0

# Build the project to ensure version consistency
print_status "Building project..."
npm run build

# Stage changes
git add package.json package-lock.json CHANGELOG.md
if [ -f "src/types/version.ts" ]; then
    git add src/types/version.ts
fi
if [ -d "dist" ]; then
    git add dist/
fi

# Commit version bump
COMMIT_MESSAGE="chore(release): bump version to $NEW_VERSION"
print_status "Creating release commit..."
git commit -m "$COMMIT_MESSAGE"

# Create git tag
print_status "Creating git tag v$NEW_VERSION..."
git tag -a "v$NEW_VERSION" -m "Release v$NEW_VERSION"

print_success "🎉 Version bumped to $NEW_VERSION"

# Show summary
echo ""
print_status "📋 Release Summary:"
echo "  📦 Version: $CURRENT_VERSION → $NEW_VERSION"
echo "  📄 Files updated: package.json, version.ts, CHANGELOG.md"
echo "  🏷️  Git tag: v$NEW_VERSION"
echo "  💾 Commit: $COMMIT_MESSAGE"

echo ""
print_status "Next steps:"
echo "  🔍 Review changes: git show HEAD"
echo "  📤 Push release: git push && git push --tags"
echo "  🚀 Deploy: npm run release:publish"

# Verify version consistency
PACKAGE_VERSION=$(node -p "require('./package.json').version")
VERSION_TS=$(node -p "require('./dist/types/version.js').VERSION" 2>/dev/null || echo "not-built")

if [ "$PACKAGE_VERSION" = "$NEW_VERSION" ] && [ "$VERSION_TS" = "$NEW_VERSION" ]; then
    print_success "✅ Version consistency verified"
else
    print_warning "⚠️  Version inconsistency detected:"
    echo "    package.json: $PACKAGE_VERSION"
    echo "    version.ts:   $VERSION_TS"
fi