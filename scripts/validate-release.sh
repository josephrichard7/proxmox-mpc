#!/bin/bash

# Proxmox-MPC Release Validation Script
# Comprehensive pre-release validation and quality checks

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Validation results
VALIDATION_PASSED=true
VALIDATION_WARNINGS=0
VALIDATION_ERRORS=0

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[⚠]${NC} $1"
    ((VALIDATION_WARNINGS++))
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
    ((VALIDATION_ERRORS++))
    VALIDATION_PASSED=false
}

print_header() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Function to check file existence
check_file_exists() {
    if [[ -f "$1" ]]; then
        print_success "File exists: $1"
        return 0
    else
        print_error "Missing file: $1"
        return 1
    fi
}

# Function to validate JSON file
validate_json() {
    if command -v jq >/dev/null 2>&1; then
        if jq empty "$1" 2>/dev/null; then
            print_success "Valid JSON: $1"
            return 0
        else
            print_error "Invalid JSON: $1"
            return 1
        fi
    else
        print_warning "jq not installed, skipping JSON validation for $1"
        return 0
    fi
}

# Function to run command and capture result
run_validation_command() {
    local cmd="$1"
    local description="$2"
    
    if eval "$cmd" >/dev/null 2>&1; then
        print_success "$description"
        return 0
    else
        print_error "$description"
        return 1
    fi
}

print_header "Proxmox-MPC Release Validation"

# Basic project structure validation
print_header "📁 Project Structure Validation"

REQUIRED_FILES=(
    "package.json"
    "package-lock.json"
    "tsconfig.json"
    "README.md"
    "CHANGELOG.md"
    "LICENSE"
    ".gitignore"
    "src/index.ts"
    "bin/proxmox-mpc"
)

for file in "${REQUIRED_FILES[@]}"; do
    check_file_exists "$file"
done

REQUIRED_DIRS=(
    "src"
    "src/api"
    "src/console"
    "src/database" 
    "src/types"
    "src/utils"
    "bin"
    "scripts"
    "docs"
)

for dir in "${REQUIRED_DIRS[@]}"; do
    if [[ -d "$dir" ]]; then
        print_success "Directory exists: $dir"
    else
        print_error "Missing directory: $dir"
    fi
done

# Package.json validation
print_header "📦 Package Configuration Validation"

if [[ -f "package.json" ]]; then
    validate_json "package.json"
    
    # Check essential package.json fields
    PACKAGE_VERSION=$(node -p "require('./package.json').version || ''" 2>/dev/null)
    PACKAGE_NAME=$(node -p "require('./package.json').name || ''" 2>/dev/null)
    PACKAGE_DESCRIPTION=$(node -p "require('./package.json').description || ''" 2>/dev/null)
    PACKAGE_BIN=$(node -p "require('./package.json').bin || ''" 2>/dev/null)
    
    if [[ -n "$PACKAGE_VERSION" ]]; then
        print_success "Package version: $PACKAGE_VERSION"
    else
        print_error "Missing package version"
    fi
    
    if [[ "$PACKAGE_NAME" == "proxmox-mpc" ]]; then
        print_success "Package name: $PACKAGE_NAME"
    else
        print_error "Incorrect package name: $PACKAGE_NAME (expected: proxmox-mpc)"
    fi
    
    if [[ -n "$PACKAGE_DESCRIPTION" ]]; then
        print_success "Package description present"
    else
        print_warning "Missing package description"
    fi
    
    if [[ "$PACKAGE_BIN" != "undefined" ]]; then
        print_success "Binary entry point configured"
    else
        print_error "Missing binary entry point"
    fi
fi

# Git repository validation
print_header "🔄 Git Repository Validation"

if [[ -d ".git" ]]; then
    print_success "Git repository initialized"
    
    # Check if working directory is clean
    if [[ -z $(git status --porcelain) ]]; then
        print_success "Working directory is clean"
    else
        print_error "Working directory has uncommitted changes"
        git status --short
    fi
    
    # Check current branch
    CURRENT_BRANCH=$(git branch --show-current)
    if [[ "$CURRENT_BRANCH" == "main" ]]; then
        print_success "On main branch"
    else
        print_warning "Not on main branch (current: $CURRENT_BRANCH)"
    fi
    
    # Check for tags
    TAG_COUNT=$(git tag | wc -l)
    if [[ $TAG_COUNT -gt 0 ]]; then
        LATEST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "none")
        print_success "Git tags present (latest: $LATEST_TAG)"
    else
        print_warning "No git tags found"
    fi
    
else
    print_error "Not a git repository"
fi

# Dependencies validation
print_header "📚 Dependencies Validation"

if [[ -f "package-lock.json" ]]; then
    print_success "package-lock.json present"
else
    print_warning "Missing package-lock.json"
fi

if [[ -d "node_modules" ]]; then
    print_success "node_modules directory present"
    
    # Check for critical dependencies
    CRITICAL_DEPS=(
        "@prisma/client"
        "commander"
        "axios"
        "express"
        "typescript"
        "jest"
    )
    
    for dep in "${CRITICAL_DEPS[@]}"; do
        if [[ -d "node_modules/$dep" ]]; then
            print_success "Dependency installed: $dep"
        else
            print_error "Missing dependency: $dep"
        fi
    done
else
    print_error "node_modules directory missing - run 'npm install'"
fi

# Build validation
print_header "🔨 Build Validation"

run_validation_command "npm run typecheck" "TypeScript compilation check"

if [[ -d "dist" ]]; then
    print_success "Build output directory exists"
    
    BUILT_FILES=(
        "dist/index.js"
        "dist/index.d.ts"
        "dist/cli.js"
    )
    
    for file in "${BUILT_FILES[@]}"; do
        check_file_exists "$file"
    done
else
    print_warning "No build output found - run 'npm run build'"
fi

# Test validation
print_header "🧪 Test Validation"

if [[ -f "jest.config.js" ]]; then
    print_success "Jest configuration present"
else
    print_warning "Missing Jest configuration"
fi

# Count test files
TEST_COUNT=$(find src -name "*.test.ts" | wc -l)
if [[ $TEST_COUNT -gt 0 ]]; then
    print_success "Test files found: $TEST_COUNT"
else
    print_error "No test files found"
fi

# Run tests
run_validation_command "npm test -- --passWithNoTests" "Test execution"

# Code quality validation
print_header "✨ Code Quality Validation"

run_validation_command "npm run lint" "ESLint validation"
run_validation_command "npm run format -- --check" "Prettier formatting check" || print_warning "Code formatting issues found"

# Configuration validation
print_header "⚙️ Configuration Validation"

CONFIG_FILES=(
    "tsconfig.json"
    "jest.config.js" 
    "commitlint.config.js"
    ".versionrc"
)

for file in "${CONFIG_FILES[@]}"; do
    if check_file_exists "$file"; then
        if [[ "$file" == *.json ]]; then
            validate_json "$file"
        fi
    fi
done

# Documentation validation
print_header "📖 Documentation Validation"

DOC_FILES=(
    "README.md"
    "CHANGELOG.md"
    "CLAUDE.md"
)

for file in "${DOC_FILES[@]}"; do
    if check_file_exists "$file"; then
        # Check if file has content
        if [[ -s "$file" ]]; then
            print_success "Documentation has content: $file"
        else
            print_warning "Documentation file is empty: $file"
        fi
    fi
done

# Check for proper README sections
if [[ -f "README.md" ]]; then
    REQUIRED_SECTIONS=("Installation" "Usage" "Features")
    
    for section in "${REQUIRED_SECTIONS[@]}"; do
        if grep -q "## $section\|# $section" README.md; then
            print_success "README section present: $section"
        else
            print_warning "README missing section: $section"
        fi
    done
fi

# Release readiness validation
print_header "🚀 Release Readiness"

# Check if version follows semver
if [[ -n "$PACKAGE_VERSION" ]]; then
    if [[ "$PACKAGE_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?(\+[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$ ]]; then
        print_success "Version follows semantic versioning: $PACKAGE_VERSION"
    else
        print_error "Version does not follow semantic versioning: $PACKAGE_VERSION"
    fi
fi

# Check for changelog entry
if [[ -f "CHANGELOG.md" ]] && [[ -n "$PACKAGE_VERSION" ]]; then
    if grep -q "\[$PACKAGE_VERSION\]" CHANGELOG.md; then
        print_success "Changelog entry exists for version $PACKAGE_VERSION"
    else
        print_warning "No changelog entry for version $PACKAGE_VERSION"
    fi
fi

# Security validation
print_header "🛡️ Security Validation"

# Check for sensitive files that shouldn't be in repo
SENSITIVE_PATTERNS=(
    "*.pem"
    "*.key"
    ".env"
    "*.env"
    "config/production.json"
)

for pattern in "${SENSITIVE_PATTERNS[@]}"; do
    if find . -name "$pattern" -not -path "./node_modules/*" | grep -q .; then
        print_error "Sensitive files found matching pattern: $pattern"
    else
        print_success "No sensitive files found for pattern: $pattern"
    fi
done

# Audit dependencies for vulnerabilities
if command -v npm >/dev/null 2>&1; then
    print_status "Running npm audit..."
    if npm audit --audit-level moderate >/dev/null 2>&1; then
        print_success "No moderate+ vulnerabilities found in dependencies"
    else
        print_error "Security vulnerabilities found in dependencies - run 'npm audit' for details"
    fi
else
    print_warning "npm not found, skipping dependency audit"
fi

# Version consistency validation
print_header "🏷️ Version Consistency Validation"

if [[ -n "$PACKAGE_VERSION" ]]; then
    # Check version.ts consistency
    if [[ -f "src/types/version.ts" ]]; then
        VERSION_TS=$(grep "export const VERSION = " src/types/version.ts | sed "s/.*'\(.*\)'.*/\1/" || echo "")
        if [[ "$VERSION_TS" == "$PACKAGE_VERSION" ]]; then
            print_success "version.ts matches package.json ($PACKAGE_VERSION)"
        else
            print_error "Version mismatch: package.json($PACKAGE_VERSION) != version.ts($VERSION_TS)"
        fi
    fi
    
    # Check if dist version matches (if built)
    if [[ -f "dist/types/version.js" ]]; then
        DIST_VERSION=$(node -p "require('./dist/types/version.js').VERSION" 2>/dev/null || echo "")
        if [[ "$DIST_VERSION" == "$PACKAGE_VERSION" ]]; then
            print_success "Built version matches package.json ($PACKAGE_VERSION)"
        else
            print_warning "Built version mismatch - run 'npm run build'"
        fi
    fi
fi

# Final validation summary
print_header "📊 Validation Summary"

echo ""
if [[ "$VALIDATION_PASSED" == "true" ]]; then
    print_success "All critical validations passed! ✨"
    echo -e "${GREEN}The project is ready for release.${NC}"
else
    print_error "Validation failed with $VALIDATION_ERRORS error(s)"
    echo -e "${RED}Please fix the errors before releasing.${NC}"
fi

if [[ $VALIDATION_WARNINGS -gt 0 ]]; then
    print_warning "$VALIDATION_WARNINGS warning(s) found - review recommended"
fi

echo ""
echo "Validation completed at $(date)"
echo ""

# Exit with error code if validation failed
if [[ "$VALIDATION_PASSED" != "true" ]]; then
    exit 1
fi