#!/bin/bash

# Package Distribution Validation
# Validates package distribution across npm and GitHub registries
# Version: 1.0.0
# Usage: ./validate-package-distribution.sh [--version=<version>] [--registry=<registry>] [--comprehensive]

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." &> /dev/null && pwd)"
LOG_FILE="${PROJECT_ROOT}/logs/package-distribution-validation-$(date +%Y%m%d_%H%M%S).log"
VALIDATION_DATA="${PROJECT_ROOT}/distribution-validation-data"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Default values
TARGET_VERSION=""
REGISTRY_TYPE="all"
COMPREHENSIVE_CHECK=false
DOWNLOAD_TEST=false
INSTALL_TEST=false

# Registry configurations
declare -A REGISTRIES=(
    ["npm"]="https://registry.npmjs.org"
    ["github"]="https://npm.pkg.github.com"
    ["yarn"]="https://registry.yarnpkg.com"
)

# Validation results
VALIDATION_RESULTS=()
TOTAL_VALIDATIONS=0
PASSED_VALIDATIONS=0
FAILED_VALIDATIONS=0
WARNING_VALIDATIONS=0

# Create directories
mkdir -p "$(dirname "$LOG_FILE")" "$VALIDATION_DATA"

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

# Record validation result
record_validation() {
    local test_name="$1"
    local status="$2"
    local message="$3"
    local details="${4:-}"
    
    TOTAL_VALIDATIONS=$((TOTAL_VALIDATIONS + 1))
    
    case "$status" in
        "PASS")
            PASSED_VALIDATIONS=$((PASSED_VALIDATIONS + 1))
            log_success "✅ $test_name: $message"
            ;;
        "FAIL")
            FAILED_VALIDATIONS=$((FAILED_VALIDATIONS + 1))
            log_error "❌ $test_name: $message"
            ;;
        "WARNING")
            WARNING_VALIDATIONS=$((WARNING_VALIDATIONS + 1))
            log_warning "⚠️  $test_name: $message"
            ;;
    esac
    
    VALIDATION_RESULTS+=("{\"test\":\"$test_name\",\"status\":\"$status\",\"message\":\"$message\",\"details\":\"$details\",\"timestamp\":\"$(date -Iseconds)\"}")
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --version=*)
                TARGET_VERSION="${1#*=}"
                shift
                ;;
            --registry=*)
                REGISTRY_TYPE="${1#*=}"
                shift
                ;;
            --comprehensive)
                COMPREHENSIVE_CHECK=true
                DOWNLOAD_TEST=true
                INSTALL_TEST=true
                shift
                ;;
            --download-test)
                DOWNLOAD_TEST=true
                shift
                ;;
            --install-test)
                INSTALL_TEST=true
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
Package Distribution Validation

Usage: $0 [OPTIONS]

OPTIONS:
    --version=VERSION    Target version to validate (e.g., 1.0.0)
    --registry=REGISTRY  Registry to validate (npm, github, yarn, all) [default: all]
    --comprehensive     Enable comprehensive validation including downloads and installs
    --download-test     Enable package download testing
    --install-test      Enable package installation testing
    -h, --help          Show this help message

REGISTRIES:
    npm                 NPM Registry (registry.npmjs.org)
    github              GitHub Packages (npm.pkg.github.com)
    yarn                Yarn Registry (registry.yarnpkg.com)
    all                 All supported registries

EXAMPLES:
    $0 --version=1.0.0 --registry=npm --comprehensive
    $0 --version=1.0.0-rc.1 --registry=all --install-test
EOF
}

# Get package version for validation
get_package_version() {
    if [[ -n "$TARGET_VERSION" ]]; then
        echo "$TARGET_VERSION"
    elif [[ -f "package.json" ]]; then
        jq -r '.version' package.json
    else
        log_error "Cannot determine package version"
        return 1
    fi
}

# Validate NPM registry
validate_npm_registry() {
    log_section "📦 Validating NPM Registry Distribution..."
    
    local package_name="proxmox-mpc"
    local version
    version=$(get_package_version)
    
    # Test 1: Package existence
    log_info "🔍 Testing package existence on NPM..."
    local npm_data_file="${VALIDATION_DATA}/npm-package-info.json"
    
    if npm view "$package_name" --json > "$npm_data_file" 2>/dev/null; then
        record_validation "NPM Package Existence" "PASS" "Package exists on NPM registry"
        
        # Parse package data
        local published_version
        published_version=$(jq -r '.version' "$npm_data_file" 2>/dev/null || echo "unknown")
        
        # Test 2: Version availability
        if [[ "$published_version" == "$version" ]]; then
            record_validation "NPM Version Match" "PASS" "Published version matches target ($version)"
        else
            record_validation "NPM Version Match" "FAIL" "Published version ($published_version) doesn't match target ($version)"
        fi
        
        # Test 3: Package metadata validation
        local package_name_check
        package_name_check=$(jq -r '.name' "$npm_data_file" 2>/dev/null || echo "")
        
        if [[ "$package_name_check" == "$package_name" ]]; then
            record_validation "NPM Package Name" "PASS" "Package name is correct"
        else
            record_validation "NPM Package Name" "FAIL" "Package name mismatch"
        fi
        
        # Test 4: Essential metadata presence
        local description keywords license
        description=$(jq -r '.description // ""' "$npm_data_file")
        keywords=$(jq -r '.keywords // [] | length' "$npm_data_file")
        license=$(jq -r '.license // ""' "$npm_data_file")
        
        if [[ -n "$description" && "$keywords" -gt 0 && -n "$license" ]]; then
            record_validation "NPM Metadata Quality" "PASS" "Package has good metadata"
        else
            record_validation "NPM Metadata Quality" "WARNING" "Package metadata could be improved"
        fi
        
        # Test 5: Dependencies validation
        local dependencies_count
        dependencies_count=$(jq -r '.dependencies // {} | keys | length' "$npm_data_file")
        
        if [[ "$dependencies_count" -lt 20 ]]; then
            record_validation "NPM Dependencies" "PASS" "Reasonable dependency count ($dependencies_count)"
        else
            record_validation "NPM Dependencies" "WARNING" "High dependency count ($dependencies_count)"
        fi
        
        # Test 6: Dist-tags validation
        log_info "🏷️  Checking NPM dist-tags..."
        local dist_tags_file="${VALIDATION_DATA}/npm-dist-tags.json"
        
        if npm view "$package_name" dist-tags --json > "$dist_tags_file" 2>/dev/null; then
            local latest_tag
            latest_tag=$(jq -r '.latest // ""' "$dist_tags_file")
            
            if [[ "$latest_tag" == "$version" ]]; then
                record_validation "NPM Latest Tag" "PASS" "Latest tag points to target version"
            else
                record_validation "NPM Latest Tag" "WARNING" "Latest tag ($latest_tag) doesn't point to target version ($version)"
            fi
        else
            record_validation "NPM Dist-tags" "WARNING" "Cannot retrieve dist-tags information"
        fi
        
    else
        record_validation "NPM Package Existence" "FAIL" "Package not found on NPM registry"
        return 1
    fi
    
    # Test 7: Package download test
    if [[ "$DOWNLOAD_TEST" == "true" ]]; then
        log_info "⬇️  Testing package download..."
        local temp_dir
        temp_dir=$(mktemp -d)
        
        if (
            cd "$temp_dir"
            timeout 60s npm pack "$package_name@$version" > /dev/null 2>&1
        ); then
            local tarball_size
            tarball_size=$(ls -la "$package_name"*.tgz 2>/dev/null | awk '{print $5}' | head -1)
            
            record_validation "NPM Package Download" "PASS" "Package downloads successfully (${tarball_size:-unknown} bytes)"
        else
            record_validation "NPM Package Download" "FAIL" "Package download failed"
        fi
        
        rm -rf "$temp_dir"
    fi
    
    # Test 8: Package installation test
    if [[ "$INSTALL_TEST" == "true" ]]; then
        log_info "📥 Testing package installation..."
        local temp_dir
        temp_dir=$(mktemp -d)
        
        if (
            cd "$temp_dir"
            npm init -y > /dev/null 2>&1
            timeout 120s npm install "$package_name@$version" > /dev/null 2>&1
        ); then
            # Test if package can be required
            if node -e "require('$package_name')" > /dev/null 2>&1; then
                record_validation "NPM Package Install" "PASS" "Package installs and loads successfully"
            else
                record_validation "NPM Package Install" "WARNING" "Package installs but may have loading issues"
            fi
        else
            record_validation "NPM Package Install" "FAIL" "Package installation failed"
        fi
        
        rm -rf "$temp_dir"
    fi
    
    return 0
}

# Validate GitHub Packages registry
validate_github_registry() {
    log_section "🐙 Validating GitHub Packages Registry..."
    
    local package_name="@proxmox-mpc/proxmox-mpc"
    local version
    version=$(get_package_version)
    
    # Test 1: GitHub Packages availability
    log_info "🔍 Testing GitHub Packages availability..."
    
    # Note: GitHub Packages requires authentication, so this is a basic check
    if gh auth status > /dev/null 2>&1; then
        log_info "GitHub CLI authenticated - attempting GitHub Packages validation"
        
        # Check if package is published to GitHub Packages
        # This would typically require organization setup
        record_validation "GitHub Packages Auth" "PASS" "GitHub CLI is authenticated"
        record_validation "GitHub Packages Validation" "WARNING" "GitHub Packages validation requires organization setup"
        
    else
        record_validation "GitHub Packages Auth" "WARNING" "GitHub CLI not authenticated - cannot validate GitHub Packages"
    fi
    
    return 0
}

# Validate Yarn registry
validate_yarn_registry() {
    log_section "🧶 Validating Yarn Registry..."
    
    local package_name="proxmox-mpc"
    local version
    version=$(get_package_version)
    
    # Yarn registry is typically a mirror of NPM, so basic validation
    if command -v yarn > /dev/null 2>&1; then
        log_info "🔍 Testing Yarn registry access..."
        
        local yarn_info_file="${VALIDATION_DATA}/yarn-package-info.json"
        
        if timeout 30s yarn info "$package_name" --json > "$yarn_info_file" 2>/dev/null; then
            local yarn_version
            yarn_version=$(jq -r '.data.version // ""' "$yarn_info_file" 2>/dev/null || echo "")
            
            if [[ "$yarn_version" == "$version" ]]; then
                record_validation "Yarn Registry Sync" "PASS" "Package available via Yarn registry"
            else
                record_validation "Yarn Registry Sync" "WARNING" "Yarn registry may not be synced (found: $yarn_version)"
            fi
        else
            record_validation "Yarn Registry Access" "WARNING" "Cannot access package via Yarn registry"
        fi
        
        # Test Yarn installation if enabled
        if [[ "$INSTALL_TEST" == "true" ]]; then
            log_info "📥 Testing Yarn package installation..."
            local temp_dir
            temp_dir=$(mktemp -d)
            
            if (
                cd "$temp_dir"
                yarn init -y > /dev/null 2>&1
                timeout 120s yarn add "$package_name@$version" > /dev/null 2>&1
            ); then
                record_validation "Yarn Package Install" "PASS" "Package installs successfully via Yarn"
            else
                record_validation "Yarn Package Install" "FAIL" "Yarn package installation failed"
            fi
            
            rm -rf "$temp_dir"
        fi
        
    else
        record_validation "Yarn Availability" "WARNING" "Yarn not installed - cannot validate Yarn registry"
    fi
    
    return 0
}

# Validate package integrity
validate_package_integrity() {
    log_section "🔐 Validating Package Integrity..."
    
    local package_name="proxmox-mpc"
    local version
    version=$(get_package_version)
    
    # Test 1: Package tarball integrity
    log_info "📦 Testing package tarball integrity..."
    local temp_dir
    temp_dir=$(mktemp -d)
    
    if (
        cd "$temp_dir"
        timeout 60s npm pack "$package_name@$version" > /dev/null 2>&1
    ); then
        local tarball
        tarball=$(ls "$package_name"*.tgz | head -1)
        
        if [[ -f "$tarball" ]]; then
            # Check if tarball can be extracted
            if tar -tf "$tarball" > /dev/null 2>&1; then
                record_validation "Package Tarball" "PASS" "Package tarball is valid"
                
                # Extract and validate contents
                tar -xf "$tarball" > /dev/null 2>&1
                local extracted_dir="package"
                
                if [[ -d "$extracted_dir" ]]; then
                    # Check essential files
                    local essential_files=("package.json" "README.md" "dist/index.js")
                    local missing_files=()
                    
                    for file in "${essential_files[@]}"; do
                        if [[ ! -f "$extracted_dir/$file" ]]; then
                            missing_files+=("$file")
                        fi
                    done
                    
                    if [[ ${#missing_files[@]} -eq 0 ]]; then
                        record_validation "Package Contents" "PASS" "All essential files present"
                    else
                        record_validation "Package Contents" "FAIL" "Missing files: ${missing_files[*]}"
                    fi
                    
                    # Validate package.json in tarball
                    if [[ -f "$extracted_dir/package.json" ]]; then
                        local tarball_version
                        tarball_version=$(jq -r '.version' "$extracted_dir/package.json" 2>/dev/null || echo "")
                        
                        if [[ "$tarball_version" == "$version" ]]; then
                            record_validation "Tarball Version" "PASS" "Version consistency in tarball"
                        else
                            record_validation "Tarball Version" "FAIL" "Version mismatch in tarball ($tarball_version vs $version)"
                        fi
                    fi
                else
                    record_validation "Package Extraction" "FAIL" "Cannot extract package contents"
                fi
            else
                record_validation "Package Tarball" "FAIL" "Package tarball is corrupted"
            fi
        else
            record_validation "Package Download" "FAIL" "Package tarball not found after download"
        fi
    else
        record_validation "Package Download" "FAIL" "Cannot download package for integrity check"
    fi
    
    rm -rf "$temp_dir"
    
    # Test 2: Package checksums (if available)
    log_info "🔒 Checking package checksums..."
    local npm_data_file="${VALIDATION_DATA}/npm-package-info.json"
    
    if [[ -f "$npm_data_file" ]]; then
        local shasum
        shasum=$(jq -r '.dist.shasum // ""' "$npm_data_file" 2>/dev/null || echo "")
        local integrity
        integrity=$(jq -r '.dist.integrity // ""' "$npm_data_file" 2>/dev/null || echo "")
        
        if [[ -n "$shasum" && -n "$integrity" ]]; then
            record_validation "Package Checksums" "PASS" "Package has checksum verification"
        else
            record_validation "Package Checksums" "WARNING" "Package checksums may not be available"
        fi
    fi
    
    return 0
}

# Validate cross-platform compatibility
validate_cross_platform() {
    log_section "🌍 Validating Cross-Platform Compatibility..."
    
    local package_name="proxmox-mpc"
    local version
    version=$(get_package_version)
    
    # Test 1: Platform specifications
    log_info "💻 Checking platform specifications..."
    local npm_data_file="${VALIDATION_DATA}/npm-package-info.json"
    
    if [[ -f "$npm_data_file" ]]; then
        local os_support
        os_support=$(jq -r '.os // [] | join(", ")' "$npm_data_file" 2>/dev/null || echo "")
        local cpu_support
        cpu_support=$(jq -r '.cpu // [] | join(", ")' "$npm_data_file" 2>/dev/null || echo "")
        local engines_node
        engines_node=$(jq -r '.engines.node // ""' "$npm_data_file" 2>/dev/null || echo "")
        
        if [[ -n "$os_support" ]]; then
            record_validation "OS Compatibility" "PASS" "Supports: $os_support"
        else
            record_validation "OS Compatibility" "WARNING" "OS compatibility not specified"
        fi
        
        if [[ -n "$cpu_support" ]]; then
            record_validation "CPU Compatibility" "PASS" "Supports: $cpu_support"
        else
            record_validation "CPU Compatibility" "WARNING" "CPU compatibility not specified"
        fi
        
        if [[ -n "$engines_node" ]]; then
            record_validation "Node.js Compatibility" "PASS" "Requires Node.js: $engines_node"
        else
            record_validation "Node.js Compatibility" "WARNING" "Node.js version not specified"
        fi
    fi
    
    # Test 2: Binary availability
    if [[ "$COMPREHENSIVE_CHECK" == "true" ]]; then
        log_info "🔧 Testing binary availability..."
        
        local temp_dir
        temp_dir=$(mktemp -d)
        
        if (
            cd "$temp_dir"
            npm init -y > /dev/null 2>&1
            timeout 120s npm install "$package_name@$version" > /dev/null 2>&1
        ); then
            if [[ -f "node_modules/.bin/proxmox-mpc" ]]; then
                record_validation "Binary Installation" "PASS" "Binary installed correctly"
                
                # Test binary execution
                if timeout 10s ./node_modules/.bin/proxmox-mpc --version > /dev/null 2>&1; then
                    record_validation "Binary Execution" "PASS" "Binary executes successfully"
                else
                    record_validation "Binary Execution" "FAIL" "Binary execution failed"
                fi
            else
                record_validation "Binary Installation" "WARNING" "Binary not found after installation"
            fi
        fi
        
        rm -rf "$temp_dir"
    fi
    
    return 0
}

# Generate distribution validation report
generate_validation_report() {
    log_info "📋 Generating distribution validation report..."
    
    local report_json="${VALIDATION_DATA}/distribution-validation-report.json"
    local report_md="${PROJECT_ROOT}/distribution-validation-report.md"
    
    # Generate JSON report
    cat > "$report_json" << EOF
{
  "validation_summary": {
    "timestamp": "$(date -Iseconds)",
    "target_version": "$(get_package_version)",
    "registry_type": "$REGISTRY_TYPE",
    "comprehensive_check": $COMPREHENSIVE_CHECK,
    "download_test": $DOWNLOAD_TEST,
    "install_test": $INSTALL_TEST,
    "total_validations": $TOTAL_VALIDATIONS,
    "passed": $PASSED_VALIDATIONS,
    "failed": $FAILED_VALIDATIONS,
    "warnings": $WARNING_VALIDATIONS,
    "success_rate": $(echo "scale=1; $PASSED_VALIDATIONS * 100 / $TOTAL_VALIDATIONS" | bc)
  },
  "validation_results": [
    $(IFS=','; echo "${VALIDATION_RESULTS[*]}")
  ],
  "environment_info": {
    "node_version": "$(node --version)",
    "npm_version": "$(npm --version)",
    "yarn_available": $(command -v yarn > /dev/null && echo "true" || echo "false"),
    "gh_cli_available": $(command -v gh > /dev/null && echo "true" || echo "false")
  }
}
EOF
    
    # Generate Markdown report
    cat > "$report_md" << EOF
# Package Distribution Validation Report

**Package:** proxmox-mpc
**Version:** $(get_package_version)
**Registry Type:** $REGISTRY_TYPE
**Generated:** $(date -Iseconds)

## Validation Summary

- **Total Validations:** $TOTAL_VALIDATIONS
- **Passed:** $PASSED_VALIDATIONS ✅
- **Failed:** $FAILED_VALIDATIONS ❌
- **Warnings:** $WARNING_VALIDATIONS ⚠️
- **Success Rate:** $(echo "scale=1; $PASSED_VALIDATIONS * 100 / $TOTAL_VALIDATIONS" | bc)%

## Test Configuration

- **Registry Type:** $REGISTRY_TYPE
- **Comprehensive Check:** $([ "$COMPREHENSIVE_CHECK" == "true" ] && echo "Enabled" || echo "Disabled")
- **Download Test:** $([ "$DOWNLOAD_TEST" == "true" ] && echo "Enabled" || echo "Disabled")
- **Install Test:** $([ "$INSTALL_TEST" == "true" ] && echo "Enabled" || echo "Disabled")

## Detailed Results

EOF
    
    # Add detailed results to markdown
    for result in "${VALIDATION_RESULTS[@]}"; do
        local test_name status message
        test_name=$(echo "$result" | jq -r '.test')
        status=$(echo "$result" | jq -r '.status')
        message=$(echo "$result" | jq -r '.message')
        
        case "$status" in
            "PASS") echo "✅ **$test_name**: $message" >> "$report_md";;
            "FAIL") echo "❌ **$test_name**: $message" >> "$report_md";;
            "WARNING") echo "⚠️ **$test_name**: $message" >> "$report_md";;
        esac
    done
    
    cat >> "$report_md" << EOF

## Environment Information

- **Node.js Version:** $(node --version)
- **NPM Version:** $(npm --version)
- **Yarn Available:** $(command -v yarn > /dev/null && echo "Yes" || echo "No")
- **GitHub CLI Available:** $(command -v gh > /dev/null && echo "Yes" || echo "No")

## Recommendations

$([ "$FAILED_VALIDATIONS" -eq 0 ] && echo "🎉 **All validations passed!** Package distribution is healthy across registries." || echo "❌ **Validation failures detected.** Please address the $FAILED_VALIDATIONS failed validation(s).")

$([ "$WARNING_VALIDATIONS" -gt 0 ] && echo "⚠️ **$WARNING_VALIDATIONS warnings detected.** Review recommended to improve package quality." || "")

## Data Files

- **JSON Report:** \`$report_json\`
- **Validation Data:** \`$VALIDATION_DATA/\`
- **Validation Log:** \`$LOG_FILE\`

---
Generated by Proxmox-MPC Package Distribution Validation System
EOF
    
    log_success "Distribution validation reports generated:"
    log_success "  JSON: $report_json"
    log_success "  Markdown: $report_md"
}

# Main validation orchestrator
run_package_distribution_validation() {
    local start_time
    start_time=$(date +%s)
    
    log_section "🎯 Starting package distribution validation for Proxmox-MPC"
    log_info "Target Version: $(get_package_version)"
    log_info "Registry Type: $REGISTRY_TYPE"
    log_info "Comprehensive Check: $COMPREHENSIVE_CHECK"
    log_info "Download Test: $DOWNLOAD_TEST"
    log_info "Install Test: $INSTALL_TEST"
    
    cd "$PROJECT_ROOT"
    
    # Run validations based on registry type
    case "$REGISTRY_TYPE" in
        "npm")
            validate_npm_registry
            ;;
        "github")
            validate_github_registry
            ;;
        "yarn")
            validate_yarn_registry
            ;;
        "all")
            validate_npm_registry
            validate_github_registry
            validate_yarn_registry
            ;;
        *)
            log_error "❌ Invalid registry type: $REGISTRY_TYPE"
            exit 1
            ;;
    esac
    
    # Run additional validations for comprehensive check
    if [[ "$COMPREHENSIVE_CHECK" == "true" || "$REGISTRY_TYPE" == "all" ]]; then
        validate_package_integrity
        validate_cross_platform
    fi
    
    local end_time
    end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    # Generate comprehensive report
    generate_validation_report
    
    # Final summary
    log_section "========================================="
    log_section "🏁 PACKAGE DISTRIBUTION VALIDATION SUMMARY"
    log_section "========================================="
    log_info "Package Version: $(get_package_version)"
    log_info "Registry Type: $REGISTRY_TYPE"
    log_info "Total Validations: $TOTAL_VALIDATIONS"
    log_success "Passed: $PASSED_VALIDATIONS"
    log_error "Failed: $FAILED_VALIDATIONS"
    log_warning "Warnings: $WARNING_VALIDATIONS"
    
    local success_rate
    success_rate=$(echo "scale=1; $PASSED_VALIDATIONS * 100 / $TOTAL_VALIDATIONS" | bc)
    log_info "Success Rate: ${success_rate}%"
    log_info "Duration: ${duration}s"
    
    # Determine overall result
    if [[ $FAILED_VALIDATIONS -eq 0 ]]; then
        if [[ $WARNING_VALIDATIONS -eq 0 ]]; then
            log_success "🎉 ALL DISTRIBUTION VALIDATIONS PASSED!"
            log_success "Package is properly distributed across all tested registries."
            return 0
        else
            log_warning "⚠️  DISTRIBUTION VALIDATION PASSED WITH WARNINGS"
            log_warning "Review $WARNING_VALIDATIONS warning(s) to improve package quality."
            return 0
        fi
    else
        log_error "❌ DISTRIBUTION VALIDATION FAILED"
        log_error "Address $FAILED_VALIDATIONS failed validation(s) before proceeding with release."
        return 1
    fi
}

# Main execution
main() {
    parse_args "$@"
    run_package_distribution_validation
}

# Run main function with all arguments
main "$@"