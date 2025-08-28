#!/bin/bash

# Pre-Release Validation Checklist - Automated Checks
# Implements comprehensive validation for Phase 6: QA-001
# Version: 1.0.0
# Usage: ./pre-release-validation.sh [--version=<version>] [--environment=<env>] [--verbose]

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." &> /dev/null && pwd)"
LOG_FILE="${PROJECT_ROOT}/logs/pre-release-validation-$(date +%Y%m%d_%H%M%S).log"
VALIDATION_REPORT="${PROJECT_ROOT}/validation-report.json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
TARGET_VERSION=""
ENVIRONMENT="staging"
VERBOSE=false
DRY_RUN=false

# Validation thresholds
MIN_TEST_COVERAGE=95
MIN_TEST_SUCCESS_RATE=95
MAX_SECURITY_VULNERABILITIES=0
MAX_CRITICAL_VULNERABILITIES=0

# Create logs directory
mkdir -p "$(dirname "$LOG_FILE")"

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

# Validation result tracking
VALIDATION_RESULTS=()
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNING_CHECKS=0

# Function to record validation result
record_result() {
    local check_name="$1"
    local status="$2"
    local message="$3"
    local details="${4:-}"
    
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    
    case "$status" in
        "PASS")
            PASSED_CHECKS=$((PASSED_CHECKS + 1))
            log_success "✅ $check_name: $message"
            ;;
        "FAIL")
            FAILED_CHECKS=$((FAILED_CHECKS + 1))
            log_error "❌ $check_name: $message"
            ;;
        "WARNING")
            WARNING_CHECKS=$((WARNING_CHECKS + 1))
            log_warning "⚠️  $check_name: $message"
            ;;
    esac
    
    VALIDATION_RESULTS+=("{\"check\":\"$check_name\",\"status\":\"$status\",\"message\":\"$message\",\"details\":\"$details\",\"timestamp\":\"$(date -Iseconds)\"}")
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --version=*)
                TARGET_VERSION="${1#*=}"
                shift
                ;;
            --environment=*)
                ENVIRONMENT="${1#*=}"
                shift
                ;;
            --verbose)
                VERBOSE=true
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
Pre-Release Validation Checklist

Usage: $0 [OPTIONS]

OPTIONS:
    --version=VERSION     Target version for validation (e.g., 1.0.0-rc.1)
    --environment=ENV     Target environment (staging, production) [default: staging]
    --verbose             Enable verbose output
    --dry-run            Perform validation without making changes
    -h, --help           Show this help message

EXAMPLES:
    $0 --version=1.0.0-rc.1 --verbose
    $0 --environment=production --dry-run
EOF
}

# Validation Check 1: Code Quality and Standards
validate_code_quality() {
    log_info "🔍 Validating code quality and standards..."
    
    # TypeScript compilation
    if npm run typecheck > /dev/null 2>&1; then
        record_result "TypeScript Compilation" "PASS" "Code compiles without type errors"
    else
        record_result "TypeScript Compilation" "FAIL" "TypeScript compilation failed"
        return 1
    fi
    
    # ESLint validation
    if npm run lint > /dev/null 2>&1; then
        record_result "ESLint Validation" "PASS" "Code passes linting rules"
    else
        record_result "ESLint Validation" "FAIL" "ESLint validation failed"
        return 1
    fi
    
    # Prettier formatting check
    if npm run format:check > /dev/null 2>&1; then
        record_result "Code Formatting" "PASS" "Code formatting is consistent"
    else
        record_result "Code Formatting" "WARNING" "Code formatting inconsistencies found"
    fi
    
    # Import order validation
    local import_violations
    import_violations=$(find src -name "*.ts" -exec grep -l "import.*from.*\.\." {} \; | wc -l)
    if [[ $import_violations -eq 0 ]]; then
        record_result "Import Order" "PASS" "Import statements follow style guide"
    else
        record_result "Import Order" "WARNING" "$import_violations files have import order issues"
    fi
}

# Validation Check 2: Test Coverage and Quality
validate_test_coverage() {
    log_info "🧪 Validating test coverage and quality..."
    
    # Run tests with coverage
    local test_output
    test_output=$(npm run test:coverage 2>&1)
    local test_exit_code=$?
    
    if [[ $test_exit_code -eq 0 ]]; then
        # Parse coverage percentage
        local coverage_percent
        coverage_percent=$(echo "$test_output" | grep -o "All files.*[0-9]\+\.[0-9]\+" | grep -o "[0-9]\+\.[0-9]\+" | head -1)
        
        if [[ -n "$coverage_percent" ]] && (( $(echo "$coverage_percent >= $MIN_TEST_COVERAGE" | bc -l) )); then
            record_result "Test Coverage" "PASS" "Coverage is ${coverage_percent}% (≥${MIN_TEST_COVERAGE}%)"
        else
            record_result "Test Coverage" "FAIL" "Coverage is ${coverage_percent}% (<${MIN_TEST_COVERAGE}%)"
        fi
        
        # Parse test success rate
        local total_tests
        local passed_tests
        total_tests=$(echo "$test_output" | grep -o "[0-9]\+ tests\?" | head -1 | grep -o "[0-9]\+")
        passed_tests=$(echo "$test_output" | grep -o "[0-9]\+ passed" | head -1 | grep -o "[0-9]\+")
        
        if [[ -n "$total_tests" && -n "$passed_tests" ]]; then
            local success_rate
            success_rate=$(echo "scale=2; $passed_tests * 100 / $total_tests" | bc)
            
            if (( $(echo "$success_rate >= $MIN_TEST_SUCCESS_RATE" | bc -l) )); then
                record_result "Test Success Rate" "PASS" "Success rate is ${success_rate}% (≥${MIN_TEST_SUCCESS_RATE}%)"
            else
                record_result "Test Success Rate" "FAIL" "Success rate is ${success_rate}% (<${MIN_TEST_SUCCESS_RATE}%)"
            fi
        else
            record_result "Test Success Rate" "WARNING" "Could not parse test success rate"
        fi
    else
        record_result "Test Execution" "FAIL" "Test suite failed to run"
        return 1
    fi
}

# Validation Check 3: Security Audit
validate_security() {
    log_info "🔒 Performing security audit..."
    
    # NPM audit
    local audit_output
    audit_output=$(npm audit --audit-level=moderate --json 2>/dev/null || echo '{"vulnerabilities":{}}')
    
    # Parse vulnerabilities
    local critical_vulns
    local high_vulns
    critical_vulns=$(echo "$audit_output" | jq -r '.metadata.vulnerabilities.critical // 0' 2>/dev/null || echo "0")
    high_vulns=$(echo "$audit_output" | jq -r '.metadata.vulnerabilities.high // 0' 2>/dev/null || echo "0")
    
    if [[ "$critical_vulns" -eq 0 ]]; then
        record_result "Critical Vulnerabilities" "PASS" "No critical vulnerabilities found"
    else
        record_result "Critical Vulnerabilities" "FAIL" "$critical_vulns critical vulnerabilities found"
    fi
    
    if [[ "$high_vulns" -eq 0 ]]; then
        record_result "High Vulnerabilities" "PASS" "No high-severity vulnerabilities found"
    else
        record_result "High Vulnerabilities" "WARNING" "$high_vulns high-severity vulnerabilities found"
    fi
    
    # Check for hardcoded secrets (basic pattern matching)
    local secret_patterns=("password" "secret" "key" "token" "api_key")
    local secrets_found=false
    
    for pattern in "${secret_patterns[@]}"; do
        if grep -r -i "$pattern.*=" src/ --include="*.ts" --include="*.js" | grep -v test | grep -v example > /dev/null 2>&1; then
            secrets_found=true
            break
        fi
    done
    
    if [[ "$secrets_found" == "false" ]]; then
        record_result "Hardcoded Secrets" "PASS" "No obvious hardcoded secrets detected"
    else
        record_result "Hardcoded Secrets" "WARNING" "Potential hardcoded secrets detected"
    fi
}

# Validation Check 4: Build and Distribution
validate_build_distribution() {
    log_info "🏗️ Validating build and distribution..."
    
    # Clean build
    if npm run build > /dev/null 2>&1; then
        record_result "Build Process" "PASS" "Project builds successfully"
    else
        record_result "Build Process" "FAIL" "Build process failed"
        return 1
    fi
    
    # Check dist directory structure
    if [[ -d "dist" && -f "dist/index.js" && -f "dist/index.d.ts" ]]; then
        record_result "Distribution Files" "PASS" "Required distribution files present"
    else
        record_result "Distribution Files" "FAIL" "Missing required distribution files"
    fi
    
    # Package structure validation
    local package_files=("package.json" "README.md" "CHANGELOG.md" "LICENSE")
    local missing_files=()
    
    for file in "${package_files[@]}"; do
        if [[ ! -f "$file" ]]; then
            missing_files+=("$file")
        fi
    done
    
    if [[ ${#missing_files[@]} -eq 0 ]]; then
        record_result "Package Files" "PASS" "All required package files present"
    else
        record_result "Package Files" "FAIL" "Missing files: ${missing_files[*]}"
    fi
    
    # Binary executable check
    if [[ -f "bin/proxmox-mpc" && -x "bin/proxmox-mpc" ]]; then
        record_result "Binary Executable" "PASS" "Binary is executable"
    else
        record_result "Binary Executable" "FAIL" "Binary is missing or not executable"
    fi
}

# Validation Check 5: Dependencies and Compatibility
validate_dependencies() {
    log_info "📦 Validating dependencies and compatibility..."
    
    # Check for outdated dependencies
    local outdated_output
    outdated_output=$(npm outdated --json 2>/dev/null || echo '{}')
    local outdated_count
    outdated_count=$(echo "$outdated_output" | jq -r 'keys | length' 2>/dev/null || echo "0")
    
    if [[ "$outdated_count" -eq 0 ]]; then
        record_result "Outdated Dependencies" "PASS" "All dependencies are up to date"
    elif [[ "$outdated_count" -lt 5 ]]; then
        record_result "Outdated Dependencies" "WARNING" "$outdated_count dependencies are outdated"
    else
        record_result "Outdated Dependencies" "FAIL" "$outdated_count dependencies are outdated"
    fi
    
    # Node.js version compatibility
    local node_version
    node_version=$(node --version | sed 's/v//')
    local min_node_version="18.0.0"
    
    if [[ "$(printf '%s\n' "$min_node_version" "$node_version" | sort -V | head -n1)" = "$min_node_version" ]]; then
        record_result "Node.js Version" "PASS" "Node.js $node_version meets minimum requirement ($min_node_version)"
    else
        record_result "Node.js Version" "FAIL" "Node.js $node_version below minimum requirement ($min_node_version)"
    fi
    
    # Package.json validation
    if jq empty package.json > /dev/null 2>&1; then
        record_result "Package.json Syntax" "PASS" "package.json is valid JSON"
    else
        record_result "Package.json Syntax" "FAIL" "package.json has syntax errors"
    fi
}

# Validation Check 6: Documentation Quality
validate_documentation() {
    log_info "📚 Validating documentation quality..."
    
    # README completeness
    local readme_sections=("# Proxmox-MPC" "## Installation" "## Usage" "## Features" "## Contributing")
    local missing_sections=()
    
    for section in "${readme_sections[@]}"; do
        if ! grep -q "$section" README.md 2>/dev/null; then
            missing_sections+=("$section")
        fi
    done
    
    if [[ ${#missing_sections[@]} -eq 0 ]]; then
        record_result "README Completeness" "PASS" "README contains all required sections"
    else
        record_result "README Completeness" "WARNING" "Missing sections: ${missing_sections[*]}"
    fi
    
    # CHANGELOG validation
    if [[ -f "CHANGELOG.md" && -s "CHANGELOG.md" ]]; then
        if grep -q "## \[Unreleased\]" CHANGELOG.md; then
            record_result "CHANGELOG Format" "PASS" "CHANGELOG follows Keep a Changelog format"
        else
            record_result "CHANGELOG Format" "WARNING" "CHANGELOG may not follow standard format"
        fi
    else
        record_result "CHANGELOG Presence" "FAIL" "CHANGELOG.md is missing or empty"
    fi
    
    # API documentation
    local doc_files_count
    doc_files_count=$(find docs -name "*.md" -type f 2>/dev/null | wc -l)
    
    if [[ "$doc_files_count" -gt 10 ]]; then
        record_result "API Documentation" "PASS" "$doc_files_count documentation files found"
    elif [[ "$doc_files_count" -gt 0 ]]; then
        record_result "API Documentation" "WARNING" "Limited documentation ($doc_files_count files)"
    else
        record_result "API Documentation" "FAIL" "No documentation files found"
    fi
}

# Validation Check 7: Release Readiness
validate_release_readiness() {
    log_info "🚀 Validating release readiness..."
    
    # Git repository status
    if [[ -z "$(git status --porcelain)" ]]; then
        record_result "Git Status" "PASS" "Working directory is clean"
    else
        record_result "Git Status" "FAIL" "Working directory has uncommitted changes"
    fi
    
    # Version consistency
    local package_version
    package_version=$(jq -r '.version' package.json)
    
    if [[ -n "$TARGET_VERSION" ]]; then
        if [[ "$package_version" == "$TARGET_VERSION" ]]; then
            record_result "Version Consistency" "PASS" "Package version matches target ($TARGET_VERSION)"
        else
            record_result "Version Consistency" "FAIL" "Package version ($package_version) doesn't match target ($TARGET_VERSION)"
        fi
    else
        record_result "Version Consistency" "WARNING" "No target version specified for validation"
    fi
    
    # Release notes validation
    if [[ -f "RELEASE-NOTES-v${package_version}.md" ]]; then
        record_result "Release Notes" "PASS" "Release notes exist for version $package_version"
    else
        record_result "Release Notes" "WARNING" "Release notes not found for version $package_version"
    fi
    
    # License validation
    if [[ -f "LICENSE" && -s "LICENSE" ]]; then
        record_result "License File" "PASS" "License file is present and not empty"
    else
        record_result "License File" "FAIL" "License file is missing or empty"
    fi
}

# Generate validation report
generate_report() {
    log_info "📊 Generating validation report..."
    
    local report_json
    report_json=$(cat << EOF
{
  "validation_summary": {
    "timestamp": "$(date -Iseconds)",
    "target_version": "$TARGET_VERSION",
    "environment": "$ENVIRONMENT",
    "total_checks": $TOTAL_CHECKS,
    "passed": $PASSED_CHECKS,
    "failed": $FAILED_CHECKS,
    "warnings": $WARNING_CHECKS,
    "success_rate": $(echo "scale=2; $PASSED_CHECKS * 100 / $TOTAL_CHECKS" | bc)
  },
  "validation_results": [
    $(IFS=','; echo "${VALIDATION_RESULTS[*]}")
  ],
  "thresholds": {
    "min_test_coverage": $MIN_TEST_COVERAGE,
    "min_test_success_rate": $MIN_TEST_SUCCESS_RATE,
    "max_security_vulnerabilities": $MAX_SECURITY_VULNERABILITIES,
    "max_critical_vulnerabilities": $MAX_CRITICAL_VULNERABILITIES
  },
  "environment_info": {
    "node_version": "$(node --version)",
    "npm_version": "$(npm --version)",
    "os": "$(uname -s)",
    "arch": "$(uname -m)"
  }
}
EOF
    )
    
    echo "$report_json" | jq . > "$VALIDATION_REPORT"
    log_success "Validation report saved to $VALIDATION_REPORT"
}

# Main validation orchestrator
run_validation() {
    log_info "🎯 Starting pre-release validation for Proxmox-MPC"
    log_info "Target Version: ${TARGET_VERSION:-'not specified'}"
    log_info "Environment: $ENVIRONMENT"
    log_info "Dry Run: $DRY_RUN"
    
    # Change to project root
    cd "$PROJECT_ROOT"
    
    # Run all validation checks
    validate_code_quality || true
    validate_test_coverage || true
    validate_security || true
    validate_build_distribution || true
    validate_dependencies || true
    validate_documentation || true
    validate_release_readiness || true
    
    # Generate report
    generate_report
    
    # Summary
    log_info "========================================="
    log_info "🏁 VALIDATION SUMMARY"
    log_info "========================================="
    log_info "Total Checks: $TOTAL_CHECKS"
    log_success "Passed: $PASSED_CHECKS"
    log_error "Failed: $FAILED_CHECKS"
    log_warning "Warnings: $WARNING_CHECKS"
    
    local success_rate
    success_rate=$(echo "scale=1; $PASSED_CHECKS * 100 / $TOTAL_CHECKS" | bc)
    log_info "Success Rate: ${success_rate}%"
    
    # Determine overall status
    if [[ $FAILED_CHECKS -eq 0 ]]; then
        if [[ $WARNING_CHECKS -eq 0 ]]; then
            log_success "🎉 ALL VALIDATIONS PASSED - READY FOR RELEASE"
            return 0
        else
            log_warning "⚠️  VALIDATIONS PASSED WITH WARNINGS - REVIEW RECOMMENDED"
            return 0
        fi
    else
        log_error "❌ VALIDATION FAILED - RELEASE NOT RECOMMENDED"
        log_error "Please address the failed checks before proceeding with release"
        return 1
    fi
}

# Main execution
main() {
    parse_args "$@"
    
    if [[ "$VERBOSE" == "true" ]]; then
        set -x
    fi
    
    run_validation
}

# Run main function with all arguments
main "$@"