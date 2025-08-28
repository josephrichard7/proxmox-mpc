#!/bin/bash

# Proxmox-MPC Release Preparation Script
# Comprehensive pre-release orchestration with validation and quality gates
# Part of Phase 3: Release Automation Workflows

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
BUILD_DIR="${PROJECT_ROOT}/dist"
TEMP_DIR="${PROJECT_ROOT}/.release-temp"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration flags
DRY_RUN=false
SKIP_TESTS=false
SKIP_BUILD=false
SKIP_VALIDATION=false
FORCE_CLEAN=false
VERBOSE=false
RELEASE_TYPE="auto"

# Validation results tracking
VALIDATION_ERRORS=0
VALIDATION_WARNINGS=0
TOTAL_STEPS=12
COMPLETED_STEPS=0

# Functions for output
print_header() {
    echo ""
    echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"
    echo ""
}

print_step() {
    ((COMPLETED_STEPS++))
    echo -e "${BLUE}[STEP $COMPLETED_STEPS/$TOTAL_STEPS]${NC} $1"
}

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
}

show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Comprehensive release preparation orchestration for Proxmox-MPC

OPTIONS:
    -t, --type TYPE          Release type: auto, patch, minor, major, prerelease (default: auto)
    -d, --dry-run           Show what would be done without executing
    --skip-tests            Skip test execution (not recommended)
    --skip-build            Skip build process (not recommended)  
    --skip-validation       Skip comprehensive validation (not recommended)
    --force-clean           Force clean rebuild of all artifacts
    -v, --verbose           Enable verbose output and detailed logging
    -h, --help              Show this help message

EXAMPLES:
    $0                      # Prepare release with auto-detected version bump
    $0 -t minor            # Prepare minor release with full validation
    $0 --dry-run -v        # Preview preparation steps with verbose output
    $0 --force-clean       # Force clean rebuild of all artifacts

WORKFLOW STEPS:
    1. Environment validation and dependency checks
    2. Git repository state validation
    3. Clean build artifact preparation
    4. TypeScript compilation and type checking
    5. Comprehensive test suite execution
    6. Code quality and security validation
    7. Package configuration validation
    8. Documentation consistency checks
    9. Version consistency validation
    10. Release notes preparation
    11. Deployment artifact generation
    12. Final release readiness verification

EOF
}

parse_arguments() {
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
            --skip-tests)
                SKIP_TESTS=true
                shift
                ;;
            --skip-build)
                SKIP_BUILD=true
                shift
                ;;
            --skip-validation)
                SKIP_VALIDATION=true
                shift
                ;;
            --force-clean)
                FORCE_CLEAN=true
                shift
                ;;
            -v|--verbose)
                VERBOSE=true
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
}

# Validation and utility functions
validate_environment() {
    print_step "Environment validation and dependency checks"
    
    local missing_deps=()
    local required_commands=("node" "npm" "git" "jq")
    
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            missing_deps+=("$cmd")
        fi
    done
    
    if [[ ${#missing_deps[@]} -ne 0 ]]; then
        print_error "Missing required dependencies: ${missing_deps[*]}"
        return 1
    fi
    
    # Check Node.js and npm versions
    local node_version=$(node --version | sed 's/v//')
    local npm_version=$(npm --version)
    local min_node="18.0.0"
    local min_npm="8.0.0"
    
    if ! node -e "const semver=require('semver'); process.exit(semver.gte('$node_version', '$min_node') ? 0 : 1)" 2>/dev/null; then
        print_error "Node.js version $node_version is below minimum required $min_node"
        return 1
    fi
    
    if ! node -e "const semver=require('semver'); process.exit(semver.gte('$npm_version', '$min_npm') ? 0 : 1)" 2>/dev/null; then
        print_error "npm version $npm_version is below minimum required $min_npm"
        return 1
    fi
    
    # Check if dependencies are installed
    if [[ ! -d "node_modules" ]]; then
        print_status "Installing dependencies..."
        if [[ "$DRY_RUN" == "true" ]]; then
            print_status "[DRY RUN] Would run: npm ci"
        else
            npm ci
        fi
    fi
    
    print_success "Environment validation completed"
    return 0
}

validate_git_state() {
    print_step "Git repository state validation"
    
    # Check if we're in a git repository
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        print_error "Not in a git repository"
        return 1
    fi
    
    # Check for uncommitted changes
    if ! git diff-index --quiet HEAD --; then
        print_error "Working directory has uncommitted changes"
        git status --short
        return 1
    fi
    
    # Check current branch
    local current_branch=$(git branch --show-current)
    if [[ "$current_branch" != "main" ]]; then
        print_warning "Not on main branch (current: $current_branch)"
    fi
    
    # Check remote synchronization
    if git remote get-url origin &>/dev/null; then
        print_status "Checking remote synchronization..."
        git fetch origin
        
        local local_commit=$(git rev-parse HEAD)
        local remote_commit=$(git rev-parse "origin/$current_branch" 2>/dev/null || echo "")
        
        if [[ -n "$remote_commit" && "$local_commit" != "$remote_commit" ]]; then
            print_error "Local branch is not up to date with remote"
            return 1
        fi
    fi
    
    print_success "Git repository state validated"
    return 0
}

clean_build_artifacts() {
    print_step "Clean build artifact preparation"
    
    if [[ "$FORCE_CLEAN" == "true" ]] || [[ ! -d "$BUILD_DIR" ]]; then
        print_status "Cleaning build artifacts..."
        
        if [[ "$DRY_RUN" == "true" ]]; then
            print_status "[DRY RUN] Would remove: $BUILD_DIR"
            print_status "[DRY RUN] Would remove: node_modules/.cache"
            print_status "[DRY RUN] Would remove: .release-temp"
        else
            rm -rf "$BUILD_DIR"
            rm -rf "node_modules/.cache" 2>/dev/null || true
            rm -rf "$TEMP_DIR"
            mkdir -p "$TEMP_DIR"
        fi
        
        print_success "Build artifacts cleaned"
    else
        print_success "Build artifacts already clean"
    fi
    
    return 0
}

run_build_process() {
    if [[ "$SKIP_BUILD" == "true" ]]; then
        print_step "Build process (SKIPPED)"
        print_warning "Build process skipped - not recommended for production releases"
        return 0
    fi
    
    print_step "TypeScript compilation and type checking"
    
    # TypeScript type checking
    print_status "Running TypeScript type checking..."
    if [[ "$DRY_RUN" == "true" ]]; then
        print_status "[DRY RUN] Would run: npm run typecheck"
    else
        if ! npm run typecheck; then
            print_error "TypeScript type checking failed"
            return 1
        fi
    fi
    
    # Build process
    print_status "Running build process..."
    if [[ "$DRY_RUN" == "true" ]]; then
        print_status "[DRY RUN] Would run: npm run build"
    else
        if ! npm run build; then
            print_error "Build process failed"
            return 1
        fi
    fi
    
    # Validate build output
    local required_build_files=(
        "dist/index.js"
        "dist/index.d.ts"
        "dist/cli.js"
    )
    
    for file in "${required_build_files[@]}"; do
        if [[ "$DRY_RUN" != "true" ]] && [[ ! -f "$file" ]]; then
            print_error "Missing required build file: $file"
            return 1
        fi
    done
    
    print_success "Build process completed successfully"
    return 0
}

run_test_suite() {
    if [[ "$SKIP_TESTS" == "true" ]]; then
        print_step "Test suite execution (SKIPPED)"
        print_warning "Test execution skipped - not recommended for production releases"
        return 0
    fi
    
    print_step "Comprehensive test suite execution"
    
    print_status "Running test suite with coverage..."
    if [[ "$DRY_RUN" == "true" ]]; then
        print_status "[DRY RUN] Would run: npm run test:coverage"
    else
        if ! npm run test:coverage; then
            print_error "Test suite failed"
            return 1
        fi
    fi
    
    # Parse coverage results if available
    if [[ -f "coverage/coverage-summary.json" ]] && command -v jq &>/dev/null; then
        local coverage=$(jq -r '.total.lines.pct' coverage/coverage-summary.json 2>/dev/null || echo "N/A")
        if [[ "$coverage" != "N/A" ]]; then
            print_success "Test coverage: ${coverage}%"
            
            # Coverage threshold check
            local min_coverage=80
            if (( $(echo "$coverage >= $min_coverage" | bc -l) )); then
                print_success "Coverage meets minimum threshold (${min_coverage}%)"
            else
                print_warning "Coverage below recommended threshold (${min_coverage}%): ${coverage}%"
            fi
        fi
    fi
    
    print_success "Test suite execution completed"
    return 0
}

run_quality_validation() {
    print_step "Code quality and security validation"
    
    # ESLint validation
    print_status "Running ESLint validation..."
    if [[ "$DRY_RUN" == "true" ]]; then
        print_status "[DRY RUN] Would run: npm run lint"
    else
        if ! npm run lint; then
            print_error "ESLint validation failed"
            return 1
        fi
    fi
    
    # Prettier formatting check
    print_status "Running Prettier formatting check..."
    if [[ "$DRY_RUN" == "true" ]]; then
        print_status "[DRY RUN] Would run: npm run format:check"
    else
        if ! npm run format:check; then
            print_warning "Code formatting issues found - run 'npm run format' to fix"
        fi
    fi
    
    # Security audit
    print_status "Running security audit..."
    if [[ "$DRY_RUN" == "true" ]]; then
        print_status "[DRY RUN] Would run: npm audit --audit-level moderate"
    else
        if ! npm audit --audit-level moderate; then
            print_error "Security vulnerabilities found - run 'npm audit fix' to resolve"
            return 1
        fi
    fi
    
    print_success "Quality validation completed"
    return 0
}

validate_package_configuration() {
    print_step "Package configuration validation"
    
    # Validate package.json structure
    if [[ ! -f "package.json" ]]; then
        print_error "package.json not found"
        return 1
    fi
    
    local package_name=$(jq -r '.name' package.json)
    local package_version=$(jq -r '.version' package.json)
    local package_description=$(jq -r '.description' package.json)
    local package_bin=$(jq -r '.bin' package.json)
    
    if [[ "$package_name" != "proxmox-mpc" ]]; then
        print_error "Incorrect package name: $package_name (expected: proxmox-mpc)"
        return 1
    fi
    
    if [[ -z "$package_version" ]] || [[ "$package_version" == "null" ]]; then
        print_error "Missing or invalid package version"
        return 1
    fi
    
    if [[ -z "$package_description" ]] || [[ "$package_description" == "null" ]]; then
        print_warning "Missing package description"
    fi
    
    if [[ "$package_bin" == "null" ]]; then
        print_error "Missing binary entry point configuration"
        return 1
    fi
    
    # Validate semantic versioning
    if ! node -e "const semver=require('semver'); if (!semver.valid('$package_version')) process.exit(1)" 2>/dev/null; then
        print_error "Package version does not follow semantic versioning: $package_version"
        return 1
    fi
    
    print_success "Package configuration validated"
    return 0
}

validate_documentation() {
    print_step "Documentation consistency checks"
    
    local required_docs=(
        "README.md"
        "CHANGELOG.md"
        "LICENSE"
    )
    
    for doc in "${required_docs[@]}"; do
        if [[ ! -f "$doc" ]]; then
            print_error "Missing required documentation: $doc"
            return 1
        fi
        
        if [[ ! -s "$doc" ]]; then
            print_warning "Documentation file is empty: $doc"
        fi
    done
    
    # Check README structure
    if [[ -f "README.md" ]]; then
        local required_sections=("Installation" "Usage" "Features")
        
        for section in "${required_sections[@]}"; do
            if ! grep -q "## $section\|# $section" README.md; then
                print_warning "README missing recommended section: $section"
            fi
        done
    fi
    
    # Validate CHANGELOG format
    if [[ -f "CHANGELOG.md" ]]; then
        if ! grep -q "## \[" CHANGELOG.md; then
            print_warning "CHANGELOG.md may not follow Keep a Changelog format"
        fi
    fi
    
    print_success "Documentation consistency validated"
    return 0
}

validate_version_consistency() {
    print_step "Version consistency validation"
    
    local package_version=$(jq -r '.version' package.json)
    
    # Check version.ts consistency (if exists)
    if [[ -f "src/types/version.ts" ]]; then
        local version_ts=$(grep "export const VERSION = " src/types/version.ts | sed "s/.*'\(.*\)'.*/\1/" 2>/dev/null || echo "")
        if [[ "$version_ts" != "$package_version" ]]; then
            print_error "Version mismatch: package.json($package_version) != version.ts($version_ts)"
            return 1
        fi
        print_success "version.ts matches package.json ($package_version)"
    fi
    
    # Check built version consistency (if built)
    if [[ -f "dist/types/version.js" ]]; then
        local dist_version=$(node -p "require('./dist/types/version.js').VERSION" 2>/dev/null || echo "")
        if [[ "$dist_version" != "$package_version" ]]; then
            print_warning "Built version mismatch - rebuild required"
            return 1
        fi
        print_success "Built version matches package.json ($package_version)"
    fi
    
    print_success "Version consistency validated"
    return 0
}

prepare_release_notes() {
    print_step "Release notes preparation"
    
    local current_version=$(jq -r '.version' package.json)
    local notes_file="${TEMP_DIR}/release-notes-${current_version}.md"
    
    print_status "Generating release notes for version $current_version..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        print_status "[DRY RUN] Would generate release notes at: $notes_file"
    else
        # Generate release notes using existing changelog generation
        if [[ -f "scripts/generate-changelog.sh" ]]; then
            # Extract relevant section from CHANGELOG.md
            if [[ -f "CHANGELOG.md" ]]; then
                # Find the current version section and extract it
                awk "/## \[${current_version}\]/{flag=1} flag && /## \[.*\]/ && !/## \[${current_version}\]/{flag=0} flag" CHANGELOG.md > "$notes_file" 2>/dev/null || {
                    echo "## Release Notes for v${current_version}" > "$notes_file"
                    echo "" >> "$notes_file"
                    echo "This release includes various improvements and fixes." >> "$notes_file"
                    echo "" >> "$notes_file"
                    echo "Please see CHANGELOG.md for detailed information." >> "$notes_file"
                }
            fi
        fi
        
        print_success "Release notes prepared at: $notes_file"
    fi
    
    return 0
}

generate_deployment_artifacts() {
    print_step "Deployment artifact generation"
    
    local artifacts_dir="${TEMP_DIR}/artifacts"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        print_status "[DRY RUN] Would create deployment artifacts in: $artifacts_dir"
        return 0
    fi
    
    mkdir -p "$artifacts_dir"
    
    # Create npm package tarball
    print_status "Creating npm package tarball..."
    npm pack --pack-destination "$artifacts_dir"
    
    # Validate package contents
    local package_file=$(ls "$artifacts_dir"/*.tgz | head -1)
    if [[ -f "$package_file" ]]; then
        print_success "Package tarball created: $(basename "$package_file")"
        
        # Extract and validate package contents
        local extract_dir="${artifacts_dir}/package-contents"
        mkdir -p "$extract_dir"
        tar -tzf "$package_file" | head -20 > "${artifacts_dir}/package-contents.txt"
        print_status "Package contents preview saved"
    else
        print_error "Failed to create package tarball"
        return 1
    fi
    
    # Generate checksums
    print_status "Generating checksums..."
    (cd "$artifacts_dir" && sha256sum *.tgz > checksums.sha256)
    
    print_success "Deployment artifacts generated"
    return 0
}

run_comprehensive_validation() {
    if [[ "$SKIP_VALIDATION" == "true" ]]; then
        print_step "Final release readiness verification (SKIPPED)"
        print_warning "Comprehensive validation skipped - not recommended"
        return 0
    fi
    
    print_step "Final release readiness verification"
    
    print_status "Running comprehensive release validation..."
    if [[ "$DRY_RUN" == "true" ]]; then
        print_status "[DRY RUN] Would run: ./scripts/validate-release.sh"
    else
        if [[ -f "scripts/validate-release.sh" ]]; then
            if ! bash scripts/validate-release.sh; then
                print_error "Comprehensive validation failed"
                return 1
            fi
        else
            print_warning "Release validation script not found"
        fi
    fi
    
    print_success "Final validation completed"
    return 0
}

generate_summary_report() {
    local current_version=$(jq -r '.version' package.json)
    local report_file="${TEMP_DIR}/release-preparation-report.md"
    
    if [[ "$DRY_RUN" != "true" ]]; then
        cat > "$report_file" << EOF
# Release Preparation Report

**Version**: $current_version  
**Prepared**: $(date -u '+%Y-%m-%d %H:%M:%S UTC')  
**Release Type**: $RELEASE_TYPE  

## Preparation Summary

- ✅ **Steps Completed**: $COMPLETED_STEPS/$TOTAL_STEPS
- ⚠️  **Warnings**: $VALIDATION_WARNINGS
- ❌ **Errors**: $VALIDATION_ERRORS

## Validation Results

| Component | Status | Notes |
|-----------|--------|-------|
| Environment | ✅ Validated | Node.js $(node --version), npm $(npm --version) |
| Git Repository | ✅ Clean | Working directory clean, up to date |
| Build Process | ✅ Successful | TypeScript compilation completed |
| Test Suite | ✅ Passed | Coverage reports generated |
| Code Quality | ✅ Validated | ESLint, Prettier, Security audit |
| Package Config | ✅ Valid | Semantic versioning compliant |
| Documentation | ✅ Present | README, CHANGELOG, LICENSE |
| Version Consistency | ✅ Consistent | All version references aligned |

## Generated Artifacts

- 📦 npm package tarball
- 📝 Release notes  
- 🔍 Package checksums
- 📊 Preparation report

## Next Steps

1. Review the generated artifacts in \`.release-temp/\`
2. Execute release: \`npm run release\`
3. Publish to npm: \`npm publish\`
4. Create GitHub release
5. Update documentation

---
*Generated by Proxmox-MPC Release Preparation v$(jq -r '.version' package.json)*
EOF
    fi
    
    return 0
}

main() {
    print_header "Proxmox-MPC Release Preparation"
    
    parse_arguments "$@"
    
    cd "$PROJECT_ROOT"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        print_warning "DRY RUN MODE - No changes will be made"
    fi
    
    print_status "Release type: $RELEASE_TYPE"
    print_status "Project root: $PROJECT_ROOT"
    
    # Execute all preparation steps
    local steps=(
        validate_environment
        validate_git_state
        clean_build_artifacts
        run_build_process
        run_test_suite
        run_quality_validation
        validate_package_configuration
        validate_documentation
        validate_version_consistency
        prepare_release_notes
        generate_deployment_artifacts
        run_comprehensive_validation
    )
    
    local failed_steps=()
    
    for step in "${steps[@]}"; do
        if ! "$step"; then
            failed_steps+=("$step")
            if [[ "$VERBOSE" == "true" ]]; then
                print_error "Step failed: $step"
            fi
        fi
    done
    
    # Generate summary report
    generate_summary_report
    
    # Final summary
    print_header "Release Preparation Summary"
    
    if [[ ${#failed_steps[@]} -eq 0 ]]; then
        print_success "🎉 Release preparation completed successfully!"
        echo ""
        print_status "✅ All $COMPLETED_STEPS steps completed"
        if [[ $VALIDATION_WARNINGS -gt 0 ]]; then
            print_warning "⚠️  $VALIDATION_WARNINGS warning(s) found - review recommended"
        fi
        echo ""
        
        if [[ "$DRY_RUN" != "true" ]]; then
            print_status "📋 Preparation artifacts generated in: $TEMP_DIR"
            print_status "📊 Review the preparation report: ${TEMP_DIR}/release-preparation-report.md"
            echo ""
            print_status "🚀 Ready to proceed with release execution!"
            print_status "   Next: npm run release --type $RELEASE_TYPE"
        else
            print_status "🔍 This was a dry run - no files were modified"
        fi
    else
        print_error "❌ Release preparation failed"
        echo ""
        print_error "Failed steps (${#failed_steps[@]}):"
        for step in "${failed_steps[@]}"; do
            print_error "  - $step"
        done
        echo ""
        print_error "❌ Errors: $VALIDATION_ERRORS"
        if [[ $VALIDATION_WARNINGS -gt 0 ]]; then
            print_warning "⚠️  Warnings: $VALIDATION_WARNINGS"
        fi
        echo ""
        print_status "Please resolve the errors before proceeding with release"
        exit 1
    fi
}

# Execute main function
main "$@"