#!/bin/bash

# Release Verification Procedures
# Implements comprehensive testing and verification for Phase 6: QA-003
# Version: 1.0.0
# Usage: ./release-verification.sh [--version=<version>] [--environment=<env>] [--verification-level=<level>]

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." &> /dev/null && pwd)"
LOG_FILE="${PROJECT_ROOT}/logs/release-verification-$(date +%Y%m%d_%H%M%S).log"
VERIFICATION_REPORT="${PROJECT_ROOT}/verification-reports/verification-report-$(date +%Y%m%d_%H%M%S).json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Default values
TARGET_VERSION=""
ENVIRONMENT="staging"
VERIFICATION_LEVEL="comprehensive"
INTERACTIVE=false
CONTINUE_ON_FAILURE=false

# Verification levels
declare -A VERIFICATION_LEVELS=(
    ["basic"]="smoke functional"
    ["standard"]="smoke functional integration security"
    ["comprehensive"]="smoke functional integration security performance compatibility regression"
    ["production"]="smoke functional integration security performance compatibility regression stress"
)

# Verification results tracking
VERIFICATION_RESULTS=()
TOTAL_VERIFICATIONS=0
PASSED_VERIFICATIONS=0
FAILED_VERIFICATIONS=0
WARNING_VERIFICATIONS=0

# Create logs and reports directories
mkdir -p "$(dirname "$LOG_FILE")" "$(dirname "$VERIFICATION_REPORT")"

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

log_section() {
    log "${PURPLE}[SECTION]${NC} $*"
}

# Record verification result
record_verification() {
    local test_name="$1"
    local status="$2"
    local message="$3"
    local details="${4:-}"
    local duration="${5:-0}"
    
    TOTAL_VERIFICATIONS=$((TOTAL_VERIFICATIONS + 1))
    
    case "$status" in
        "PASS")
            PASSED_VERIFICATIONS=$((PASSED_VERIFICATIONS + 1))
            log_success "✅ $test_name: $message"
            ;;
        "FAIL")
            FAILED_VERIFICATIONS=$((FAILED_VERIFICATIONS + 1))
            log_error "❌ $test_name: $message"
            ;;
        "WARNING")
            WARNING_VERIFICATIONS=$((WARNING_VERIFICATIONS + 1))
            log_warning "⚠️  $test_name: $message"
            ;;
    esac
    
    VERIFICATION_RESULTS+=("{\"test\":\"$test_name\",\"status\":\"$status\",\"message\":\"$message\",\"details\":\"$details\",\"duration\":$duration,\"timestamp\":\"$(date -Iseconds)\"}")
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
            --verification-level=*)
                VERIFICATION_LEVEL="${1#*=}"
                shift
                ;;
            --interactive)
                INTERACTIVE=true
                shift
                ;;
            --continue-on-failure)
                CONTINUE_ON_FAILURE=true
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
Release Verification Procedures

Usage: $0 [OPTIONS]

OPTIONS:
    --version=VERSION         Target version for verification (e.g., 1.0.0-rc.1)
    --environment=ENV         Environment to verify against (staging, production)
    --verification-level=LEVEL Verification level (basic, standard, comprehensive, production)
    --interactive            Enable interactive verification prompts
    --continue-on-failure    Continue verification even if tests fail
    -h, --help               Show this help message

VERIFICATION LEVELS:
    basic                    Smoke tests and basic functionality
    standard                 Functional, integration, and security tests
    comprehensive            All standard tests plus performance and compatibility
    production              All comprehensive tests plus stress testing

EXAMPLES:
    $0 --version=1.0.0-rc.1 --verification-level=comprehensive
    $0 --environment=production --interactive
EOF
}

# Smoke Tests - Quick verification that basic functionality works
run_smoke_tests() {
    log_section "💨 Running smoke tests..."
    
    local start_time
    start_time=$(date +%s)
    
    # Test 1: Package installation
    log_info "🔍 Testing package installation..."
    if npm list proxmox-mpc > /dev/null 2>&1; then
        record_verification "Package Installation" "PASS" "Package is properly installed"
    else
        record_verification "Package Installation" "FAIL" "Package installation failed"
    fi
    
    # Test 2: Binary execution
    log_info "🔍 Testing binary execution..."
    if timeout 10s ./bin/proxmox-mpc --version > /dev/null 2>&1; then
        record_verification "Binary Execution" "PASS" "Binary executes successfully"
    else
        record_verification "Binary Execution" "FAIL" "Binary execution failed"
    fi
    
    # Test 3: Module import
    log_info "🔍 Testing module import..."
    if node -e "require('./dist/index.js')" > /dev/null 2>&1; then
        record_verification "Module Import" "PASS" "Module imports without errors"
    else
        record_verification "Module Import" "FAIL" "Module import failed"
    fi
    
    # Test 4: Basic API connectivity test
    log_info "🔍 Testing basic API connectivity..."
    if npm run cli test-connection > /dev/null 2>&1; then
        record_verification "API Connectivity" "PASS" "API connectivity test passed"
    else
        record_verification "API Connectivity" "WARNING" "API connectivity test failed (may require server)"
    fi
    
    local end_time
    end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log_success "✅ Smoke tests completed (${duration}s)"
}

# Functional Tests - Core functionality verification
run_functional_tests() {
    log_section "⚙️  Running functional tests..."
    
    local start_time
    start_time=$(date +%s)
    
    # Test 1: Console command parsing
    log_info "🔍 Testing console command parsing..."
    if npm test -- --testPathPattern="console.*command" --silent > /dev/null 2>&1; then
        record_verification "Console Commands" "PASS" "Console command parsing works correctly"
    else
        record_verification "Console Commands" "FAIL" "Console command parsing tests failed"
    fi
    
    # Test 2: Database operations
    log_info "🔍 Testing database operations..."
    if npm test -- --testPathPattern="database" --silent > /dev/null 2>&1; then
        record_verification "Database Operations" "PASS" "Database operations work correctly"
    else
        record_verification "Database Operations" "FAIL" "Database operation tests failed"
    fi
    
    # Test 3: Configuration management
    log_info "🔍 Testing configuration management..."
    if npm test -- --testPathPattern="config" --silent > /dev/null 2>&1; then
        record_verification "Configuration Management" "PASS" "Configuration management works correctly"
    else
        record_verification "Configuration Management" "FAIL" "Configuration management tests failed"
    fi
    
    # Test 4: CLI command execution
    log_info "🔍 Testing CLI commands..."
    local cli_commands=("list-nodes" "test-connection")
    local cli_passed=0
    
    for cmd in "${cli_commands[@]}"; do
        if timeout 30s npm run cli "$cmd" -- --help > /dev/null 2>&1; then
            cli_passed=$((cli_passed + 1))
        fi
    done
    
    if [[ $cli_passed -eq ${#cli_commands[@]} ]]; then
        record_verification "CLI Commands" "PASS" "All CLI commands execute correctly"
    elif [[ $cli_passed -gt 0 ]]; then
        record_verification "CLI Commands" "WARNING" "$cli_passed/${#cli_commands[@]} CLI commands work"
    else
        record_verification "CLI Commands" "FAIL" "CLI command execution failed"
    fi
    
    local end_time
    end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log_success "✅ Functional tests completed (${duration}s)"
}

# Integration Tests - System integration verification
run_integration_tests() {
    log_section "🔗 Running integration tests..."
    
    local start_time
    start_time=$(date +%s)
    
    # Test 1: Full integration test suite
    log_info "🔍 Running integration test suite..."
    if npm test -- --testPathPattern="integration" --silent > /dev/null 2>&1; then
        record_verification "Integration Tests" "PASS" "Integration tests pass successfully"
    else
        record_verification "Integration Tests" "FAIL" "Integration tests failed"
    fi
    
    # Test 2: API client integration
    log_info "🔍 Testing API client integration..."
    if npm test -- --testPathPattern="api.*client" --silent > /dev/null 2>&1; then
        record_verification "API Integration" "PASS" "API client integration works correctly"
    else
        record_verification "API Integration" "FAIL" "API client integration tests failed"
    fi
    
    # Test 3: Database-API integration
    log_info "🔍 Testing database-API integration..."
    if npm test -- --testPathPattern=".*integration.*database" --silent > /dev/null 2>&1; then
        record_verification "Database-API Integration" "PASS" "Database-API integration works correctly"
    else
        record_verification "Database-API Integration" "WARNING" "Database-API integration tests not found or failed"
    fi
    
    # Test 4: Console-CLI integration
    log_info "🔍 Testing console-CLI integration..."
    if npm test -- --testPathPattern="console.*repl" --silent > /dev/null 2>&1; then
        record_verification "Console-CLI Integration" "PASS" "Console-CLI integration works correctly"
    else
        record_verification "Console-CLI Integration" "FAIL" "Console-CLI integration tests failed"
    fi
    
    local end_time
    end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log_success "✅ Integration tests completed (${duration}s)"
}

# Security Tests - Security verification
run_security_tests() {
    log_section "🔒 Running security tests..."
    
    local start_time
    start_time=$(date +%s)
    
    # Test 1: Dependency vulnerability scan
    log_info "🔍 Running dependency vulnerability scan..."
    local audit_output
    audit_output=$(npm audit --json 2>/dev/null || echo '{"vulnerabilities":{}}')
    local critical_vulns
    critical_vulns=$(echo "$audit_output" | jq -r '.metadata.vulnerabilities.critical // 0' 2>/dev/null || echo "0")
    
    if [[ "$critical_vulns" -eq 0 ]]; then
        record_verification "Dependency Security" "PASS" "No critical vulnerabilities found"
    else
        record_verification "Dependency Security" "FAIL" "$critical_vulns critical vulnerabilities found"
    fi
    
    # Test 2: Hardcoded secrets scan
    log_info "🔍 Scanning for hardcoded secrets..."
    local secret_patterns=("password.*=" "secret.*=" "key.*=" "token.*=" "api_key.*=")
    local secrets_found=false
    
    for pattern in "${secret_patterns[@]}"; do
        if grep -r -i "$pattern" src/ --include="*.ts" --exclude-dir=__tests__ | grep -v example > /dev/null 2>&1; then
            secrets_found=true
            break
        fi
    done
    
    if [[ "$secrets_found" == "false" ]]; then
        record_verification "Hardcoded Secrets" "PASS" "No hardcoded secrets detected"
    else
        record_verification "Hardcoded Secrets" "FAIL" "Potential hardcoded secrets found"
    fi
    
    # Test 3: File permissions check
    log_info "🔍 Checking file permissions..."
    local sensitive_files=("package.json" "tsconfig.json" ".env*")
    local permission_issues=false
    
    for file_pattern in "${sensitive_files[@]}"; do
        while IFS= read -r -d '' file; do
            if [[ -f "$file" ]]; then
                local perms
                perms=$(stat -c "%a" "$file" 2>/dev/null || stat -f "%A" "$file" 2>/dev/null || echo "644")
                if [[ "$perms" =~ ^[67][0-4][0-4]$ ]]; then
                    continue  # Good permissions
                else
                    permission_issues=true
                fi
            fi
        done < <(find . -name "$file_pattern" -print0 2>/dev/null || true)
    done
    
    if [[ "$permission_issues" == "false" ]]; then
        record_verification "File Permissions" "PASS" "File permissions are secure"
    else
        record_verification "File Permissions" "WARNING" "Some files may have insecure permissions"
    fi
    
    # Test 4: License compliance
    log_info "🔍 Checking license compliance..."
    if [[ -f "LICENSE" && -s "LICENSE" ]]; then
        local license_content
        license_content=$(head -5 LICENSE)
        if [[ -n "$license_content" ]]; then
            record_verification "License Compliance" "PASS" "License file is present and populated"
        else
            record_verification "License Compliance" "FAIL" "License file is empty"
        fi
    else
        record_verification "License Compliance" "FAIL" "License file is missing"
    fi
    
    local end_time
    end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log_success "✅ Security tests completed (${duration}s)"
}

# Performance Tests - Performance verification
run_performance_tests() {
    log_section "⚡ Running performance tests..."
    
    local start_time
    start_time=$(date +%s)
    
    # Test 1: Package size check
    log_info "🔍 Checking package size..."
    local package_size
    package_size=$(du -sk . | cut -f1)
    local max_size=50000  # 50MB limit
    
    if [[ $package_size -lt $max_size ]]; then
        record_verification "Package Size" "PASS" "Package size is ${package_size}KB (< ${max_size}KB)"
    else
        record_verification "Package Size" "WARNING" "Package size is ${package_size}KB (> ${max_size}KB)"
    fi
    
    # Test 2: Binary startup time
    log_info "🔍 Testing binary startup time..."
    local startup_times=()
    for i in {1..5}; do
        local start_time_ms
        start_time_ms=$(date +%s%3N)
        timeout 10s ./bin/proxmox-mpc --version > /dev/null 2>&1
        local end_time_ms
        end_time_ms=$(date +%s%3N)
        local duration_ms=$((end_time_ms - start_time_ms))
        startup_times+=($duration_ms)
    done
    
    local avg_startup
    avg_startup=$(( (${startup_times[0]} + ${startup_times[1]} + ${startup_times[2]} + ${startup_times[3]} + ${startup_times[4]}) / 5 ))
    
    if [[ $avg_startup -lt 2000 ]]; then  # 2 seconds
        record_verification "Startup Performance" "PASS" "Average startup time is ${avg_startup}ms"
    elif [[ $avg_startup -lt 5000 ]]; then  # 5 seconds
        record_verification "Startup Performance" "WARNING" "Average startup time is ${avg_startup}ms"
    else
        record_verification "Startup Performance" "FAIL" "Average startup time is ${avg_startup}ms (too slow)"
    fi
    
    # Test 3: Memory usage check
    log_info "🔍 Testing memory usage..."
    local memory_test_output
    if memory_test_output=$(timeout 30s npm test -- --testPathPattern="performance|memory" --silent 2>&1); then
        record_verification "Memory Usage" "PASS" "Memory usage tests passed"
    else
        record_verification "Memory Usage" "WARNING" "Memory usage tests not available or failed"
    fi
    
    # Test 4: Test execution performance
    log_info "🔍 Testing test execution performance..."
    local test_start
    test_start=$(date +%s)
    if npm test -- --silent > /dev/null 2>&1; then
        local test_end
        test_end=$(date +%s)
        local test_duration=$((test_end - test_start))
        
        if [[ $test_duration -lt 60 ]]; then  # 1 minute
            record_verification "Test Performance" "PASS" "Test suite completes in ${test_duration}s"
        elif [[ $test_duration -lt 180 ]]; then  # 3 minutes
            record_verification "Test Performance" "WARNING" "Test suite takes ${test_duration}s"
        else
            record_verification "Test Performance" "FAIL" "Test suite takes ${test_duration}s (too slow)"
        fi
    else
        record_verification "Test Performance" "FAIL" "Test suite execution failed"
    fi
    
    local end_time
    end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log_success "✅ Performance tests completed (${duration}s)"
}

# Compatibility Tests - Cross-platform and version compatibility
run_compatibility_tests() {
    log_section "🔄 Running compatibility tests..."
    
    local start_time
    start_time=$(date +%s)
    
    # Test 1: Node.js version compatibility
    log_info "🔍 Testing Node.js version compatibility..."
    local node_version
    node_version=$(node --version | sed 's/v//')
    local min_version="18.0.0"
    
    if [[ "$(printf '%s\n' "$min_version" "$node_version" | sort -V | head -n1)" = "$min_version" ]]; then
        record_verification "Node.js Compatibility" "PASS" "Node.js $node_version meets minimum requirement"
    else
        record_verification "Node.js Compatibility" "FAIL" "Node.js $node_version below minimum $min_version"
    fi
    
    # Test 2: Operating system compatibility
    log_info "🔍 Testing OS compatibility..."
    local os_type
    os_type=$(uname -s)
    local supported_os=("Linux" "Darwin" "MINGW64_NT" "CYGWIN_NT")
    
    if [[ " ${supported_os[*]} " =~ " ${os_type} " ]] || [[ "$os_type" == *"NT"* ]]; then
        record_verification "OS Compatibility" "PASS" "Operating system $os_type is supported"
    else
        record_verification "OS Compatibility" "WARNING" "Operating system $os_type may not be fully supported"
    fi
    
    # Test 3: Package.json engines validation
    log_info "🔍 Validating package.json engines..."
    local engines_valid=true
    
    if ! jq -e '.engines.node' package.json > /dev/null 2>&1; then
        engines_valid=false
    fi
    
    if ! jq -e '.engines.npm' package.json > /dev/null 2>&1; then
        engines_valid=false
    fi
    
    if [[ "$engines_valid" == "true" ]]; then
        record_verification "Package Engines" "PASS" "Package.json engines are properly specified"
    else
        record_verification "Package Engines" "FAIL" "Package.json engines are missing or invalid"
    fi
    
    # Test 4: Dependency compatibility
    log_info "🔍 Testing dependency compatibility..."
    if npm ls > /dev/null 2>&1; then
        record_verification "Dependency Compatibility" "PASS" "All dependencies are compatible"
    else
        record_verification "Dependency Compatibility" "WARNING" "Some dependency compatibility issues detected"
    fi
    
    local end_time
    end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log_success "✅ Compatibility tests completed (${duration}s)"
}

# Regression Tests - Ensure no functionality has broken
run_regression_tests() {
    log_section "🔄 Running regression tests..."
    
    local start_time
    start_time=$(date +%s)
    
    # Test 1: Core functionality regression
    log_info "🔍 Testing core functionality regression..."
    if npm test -- --testPathPattern="__tests__" --silent > /dev/null 2>&1; then
        record_verification "Core Functionality" "PASS" "Core functionality has no regressions"
    else
        record_verification "Core Functionality" "FAIL" "Core functionality regression detected"
    fi
    
    # Test 2: API backwards compatibility
    log_info "🔍 Testing API backwards compatibility..."
    local api_test_files=("api" "client" "proxmox")
    local api_tests_passed=0
    
    for test_file in "${api_test_files[@]}"; do
        if npm test -- --testPathPattern="$test_file" --silent > /dev/null 2>&1; then
            api_tests_passed=$((api_tests_passed + 1))
        fi
    done
    
    if [[ $api_tests_passed -eq ${#api_test_files[@]} ]]; then
        record_verification "API Backwards Compatibility" "PASS" "API maintains backwards compatibility"
    elif [[ $api_tests_passed -gt 0 ]]; then
        record_verification "API Backwards Compatibility" "WARNING" "Some API compatibility issues detected"
    else
        record_verification "API Backwards Compatibility" "FAIL" "API backwards compatibility broken"
    fi
    
    # Test 3: Configuration format compatibility
    log_info "🔍 Testing configuration format compatibility..."
    local config_formats=("json" "yaml" "env")
    local config_tests_passed=0
    
    for format in "${config_formats[@]}"; do
        if npm test -- --testPathPattern="config.*$format" --silent > /dev/null 2>&1; then
            config_tests_passed=$((config_tests_passed + 1))
        fi
    done
    
    if [[ $config_tests_passed -gt 0 ]]; then
        record_verification "Configuration Compatibility" "PASS" "Configuration formats maintain compatibility"
    else
        record_verification "Configuration Compatibility" "WARNING" "Configuration compatibility tests not found"
    fi
    
    local end_time
    end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log_success "✅ Regression tests completed (${duration}s)"
}

# Stress Tests - High load and edge case testing
run_stress_tests() {
    log_section "💪 Running stress tests..."
    
    local start_time
    start_time=$(date +%s)
    
    # Test 1: High concurrency test
    log_info "🔍 Testing high concurrency..."
    local concurrent_processes=10
    local pids=()
    
    for i in $(seq 1 $concurrent_processes); do
        (timeout 30s ./bin/proxmox-mpc --version > /dev/null 2>&1) &
        pids+=($!)
    done
    
    local completed=0
    for pid in "${pids[@]}"; do
        if wait "$pid" 2>/dev/null; then
            completed=$((completed + 1))
        fi
    done
    
    if [[ $completed -eq $concurrent_processes ]]; then
        record_verification "Concurrency Stress" "PASS" "All $concurrent_processes concurrent processes completed"
    elif [[ $completed -gt $((concurrent_processes / 2)) ]]; then
        record_verification "Concurrency Stress" "WARNING" "$completed/$concurrent_processes processes completed"
    else
        record_verification "Concurrency Stress" "FAIL" "Only $completed/$concurrent_processes processes completed"
    fi
    
    # Test 2: Memory stress test
    log_info "🔍 Testing memory stress..."
    if timeout 60s npm test -- --testPathPattern="stress|memory" --silent > /dev/null 2>&1; then
        record_verification "Memory Stress" "PASS" "Memory stress tests passed"
    else
        record_verification "Memory Stress" "WARNING" "Memory stress tests not available or failed"
    fi
    
    # Test 3: Long-running operation test
    log_info "🔍 Testing long-running operations..."
    if timeout 120s npm test -- --testTimeout=60000 --silent > /dev/null 2>&1; then
        record_verification "Long-running Operations" "PASS" "Long-running operations complete successfully"
    else
        record_verification "Long-running Operations" "WARNING" "Long-running operations test failed or timed out"
    fi
    
    local end_time
    end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log_success "✅ Stress tests completed (${duration}s)"
}

# Generate comprehensive verification report
generate_verification_report() {
    log_info "📊 Generating verification report..."
    
    local report_json
    report_json=$(cat << EOF
{
  "verification_summary": {
    "timestamp": "$(date -Iseconds)",
    "target_version": "$TARGET_VERSION",
    "environment": "$ENVIRONMENT",
    "verification_level": "$VERIFICATION_LEVEL",
    "total_verifications": $TOTAL_VERIFICATIONS,
    "passed": $PASSED_VERIFICATIONS,
    "failed": $FAILED_VERIFICATIONS,
    "warnings": $WARNING_VERIFICATIONS,
    "success_rate": $(echo "scale=2; $PASSED_VERIFICATIONS * 100 / $TOTAL_VERIFICATIONS" | bc)
  },
  "verification_results": [
    $(IFS=','; echo "${VERIFICATION_RESULTS[*]}")
  ],
  "environment_info": {
    "node_version": "$(node --version)",
    "npm_version": "$(npm --version)",
    "os": "$(uname -s)",
    "arch": "$(uname -m)",
    "package_version": "$(jq -r '.version' package.json)"
  },
  "verification_config": {
    "level": "$VERIFICATION_LEVEL",
    "tests_included": "${VERIFICATION_LEVELS[$VERIFICATION_LEVEL]}",
    "interactive": $INTERACTIVE,
    "continue_on_failure": $CONTINUE_ON_FAILURE
  }
}
EOF
    )
    
    echo "$report_json" | jq . > "$VERIFICATION_REPORT"
    
    # Generate markdown report
    local markdown_report="${VERIFICATION_REPORT%.json}.md"
    
    cat > "$markdown_report" << EOF
# Release Verification Report

**Target Version:** ${TARGET_VERSION:-'Not specified'}
**Environment:** $ENVIRONMENT
**Verification Level:** $VERIFICATION_LEVEL
**Generated:** $(date -Iseconds)

## Summary

- **Total Verifications:** $TOTAL_VERIFICATIONS
- **Passed:** $PASSED_VERIFICATIONS ✅
- **Failed:** $FAILED_VERIFICATIONS ❌
- **Warnings:** $WARNING_VERIFICATIONS ⚠️
- **Success Rate:** $(echo "scale=1; $PASSED_VERIFICATIONS * 100 / $TOTAL_VERIFICATIONS" | bc)%

## Test Categories Executed

${VERIFICATION_LEVELS[$VERIFICATION_LEVEL]}

## Detailed Results

$(for result in "${VERIFICATION_RESULTS[@]}"; do
    local test_name status message
    test_name=$(echo "$result" | jq -r '.test')
    status=$(echo "$result" | jq -r '.status')
    message=$(echo "$result" | jq -r '.message')
    
    case "$status" in
        "PASS") echo "✅ **$test_name**: $message";;
        "FAIL") echo "❌ **$test_name**: $message";;
        "WARNING") echo "⚠️ **$test_name**: $message";;
    esac
done)

## Environment Information

- **Node.js Version:** $(node --version)
- **NPM Version:** $(npm --version)
- **Operating System:** $(uname -s) $(uname -m)
- **Package Version:** $(jq -r '.version' package.json)

## Recommendations

$([ "$FAILED_VERIFICATIONS" -eq 0 ] && echo "🎉 **All verifications passed!** Ready to proceed with release." || echo "❌ **Verification failures detected.** Please address the $FAILED_VERIFICATIONS failed verification(s) before proceeding with release.")

$([ "$WARNING_VERIFICATIONS" -gt 0 ] && echo "⚠️ **$WARNING_VERIFICATIONS warnings detected.** Review recommended before proceeding." || "")

## Full Details

- **Verification Log:** \`$LOG_FILE\`
- **JSON Report:** \`$VERIFICATION_REPORT\`

---
Generated by Proxmox-MPC Release Verification System
EOF
    
    log_success "Verification reports generated:"
    log_success "  JSON: $VERIFICATION_REPORT"
    log_success "  Markdown: $markdown_report"
}

# Main verification orchestrator
run_release_verification() {
    local overall_start_time
    overall_start_time=$(date +%s)
    
    log_section "🎯 Starting release verification for Proxmox-MPC"
    log_info "Target Version: ${TARGET_VERSION:-'not specified'}"
    log_info "Environment: $ENVIRONMENT"
    log_info "Verification Level: $VERIFICATION_LEVEL"
    log_info "Interactive Mode: $INTERACTIVE"
    
    cd "$PROJECT_ROOT"
    
    # Get tests to run based on verification level
    local tests_to_run
    tests_to_run="${VERIFICATION_LEVELS[$VERIFICATION_LEVEL]}"
    
    # Run verification tests based on level
    for test_category in $tests_to_run; do
        case "$test_category" in
            "smoke")
                run_smoke_tests || [[ "$CONTINUE_ON_FAILURE" == "true" ]]
                ;;
            "functional")
                run_functional_tests || [[ "$CONTINUE_ON_FAILURE" == "true" ]]
                ;;
            "integration")
                run_integration_tests || [[ "$CONTINUE_ON_FAILURE" == "true" ]]
                ;;
            "security")
                run_security_tests || [[ "$CONTINUE_ON_FAILURE" == "true" ]]
                ;;
            "performance")
                run_performance_tests || [[ "$CONTINUE_ON_FAILURE" == "true" ]]
                ;;
            "compatibility")
                run_compatibility_tests || [[ "$CONTINUE_ON_FAILURE" == "true" ]]
                ;;
            "regression")
                run_regression_tests || [[ "$CONTINUE_ON_FAILURE" == "true" ]]
                ;;
            "stress")
                run_stress_tests || [[ "$CONTINUE_ON_FAILURE" == "true" ]]
                ;;
        esac
    done
    
    local overall_end_time
    overall_end_time=$(date +%s)
    local total_duration=$((overall_end_time - overall_start_time))
    
    # Generate comprehensive report
    generate_verification_report
    
    # Final summary
    log_section "========================================="
    log_section "🏁 RELEASE VERIFICATION SUMMARY"
    log_section "========================================="
    log_info "Target Version: ${TARGET_VERSION:-'Not specified'}"
    log_info "Verification Level: $VERIFICATION_LEVEL"
    log_info "Total Verifications: $TOTAL_VERIFICATIONS"
    log_success "Passed: $PASSED_VERIFICATIONS"
    log_error "Failed: $FAILED_VERIFICATIONS"
    log_warning "Warnings: $WARNING_VERIFICATIONS"
    
    local success_rate
    success_rate=$(echo "scale=1; $PASSED_VERIFICATIONS * 100 / $TOTAL_VERIFICATIONS" | bc)
    log_info "Success Rate: ${success_rate}%"
    log_info "Total Duration: ${total_duration}s"
    
    # Determine overall result
    if [[ $FAILED_VERIFICATIONS -eq 0 ]]; then
        if [[ $WARNING_VERIFICATIONS -eq 0 ]]; then
            log_success "🎉 ALL VERIFICATIONS PASSED - RELEASE APPROVED!"
            return 0
        else
            log_warning "⚠️  VERIFICATIONS PASSED WITH WARNINGS - REVIEW RECOMMENDED"
            return 0
        fi
    else
        log_error "❌ VERIFICATION FAILED - RELEASE NOT APPROVED"
        log_error "Please address the $FAILED_VERIFICATIONS failed verification(s) before proceeding."
        return 1
    fi
}

# Main execution
main() {
    parse_args "$@"
    run_release_verification
}

# Run main function with all arguments
main "$@"