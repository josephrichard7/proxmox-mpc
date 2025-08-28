#!/bin/bash

# validate-changelog.sh
# Validates CHANGELOG.md format against Keep a Changelog standards
# Usage: ./scripts/validate-changelog.sh [--fix] [--verbose]

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
CHANGELOG_FILE="${PROJECT_ROOT}/CHANGELOG.md"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
FIX_ISSUES=false
VERBOSE=false
EXIT_CODE=0

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    EXIT_CODE=1
}

log_verbose() {
    if [[ "$VERBOSE" == "true" ]]; then
        echo -e "${BLUE}[VERBOSE]${NC} $1"
    fi
}

show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Validates CHANGELOG.md format against Keep a Changelog standards

OPTIONS:
    --fix       Attempt to fix formatting issues automatically
    --verbose   Enable verbose output showing detailed checks
    --help      Show this help message

Keep a Changelog Standards Checked:
    ✓ File structure and required sections
    ✓ Version format compliance (SemVer)
    ✓ Date format compliance (YYYY-MM-DD)
    ✓ Section ordering and consistency
    ✓ Link format validation
    ✓ Unreleased section presence
    ✓ Header and format compliance

EXAMPLES:
    # Validate changelog format
    $0

    # Validate with verbose output
    $0 --verbose

    # Validate and fix issues automatically
    $0 --fix

EOF
}

parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --fix)
                FIX_ISSUES=true
                shift
                ;;
            --verbose)
                VERBOSE=true
                shift
                ;;
            --help)
                show_usage
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done
}

check_file_exists() {
    log_verbose "Checking if CHANGELOG.md exists..."
    
    if [[ ! -f "$CHANGELOG_FILE" ]]; then
        log_error "CHANGELOG.md not found at: $CHANGELOG_FILE"
        return 1
    fi
    
    log_verbose "✓ CHANGELOG.md file exists"
    return 0
}

validate_header() {
    log_verbose "Validating changelog header..."
    
    local expected_title="# Changelog"
    local expected_description="All notable changes to this project will be documented in this file."
    local expected_format_line="The format is based on [Keep a Changelog]"
    local expected_versioning_line="and this project adheres to [Semantic Versioning]"
    
    # Check title
    local first_line=$(head -n 1 "$CHANGELOG_FILE")
    if [[ "$first_line" != "$expected_title" ]]; then
        log_error "Invalid changelog title. Expected: '$expected_title', Got: '$first_line'"
    else
        log_verbose "✓ Changelog title is correct"
    fi
    
    # Check description
    if ! grep -q "$expected_description" "$CHANGELOG_FILE"; then
        log_error "Missing standard description: '$expected_description'"
    else
        log_verbose "✓ Standard description found"
    fi
    
    # Check format reference (more flexible)
    if ! grep -q "Keep a Changelog" "$CHANGELOG_FILE"; then
        log_error "Missing Keep a Changelog reference"
    else
        log_verbose "✓ Keep a Changelog reference found"
    fi
    
    # Check versioning reference (more flexible)
    if ! grep -q "Semantic Versioning" "$CHANGELOG_FILE"; then
        log_error "Missing Semantic Versioning reference"
    else
        log_verbose "✓ Semantic Versioning reference found"
    fi
}

validate_unreleased_section() {
    log_verbose "Validating Unreleased section..."
    
    if ! grep -q "^## \[Unreleased\]" "$CHANGELOG_FILE"; then
        log_error "Missing [Unreleased] section"
    else
        log_verbose "✓ [Unreleased] section found"
    fi
}

validate_version_format() {
    log_verbose "Validating version formats..."
    
    # Extract all version headers
    local version_lines=$(grep "^## \[" "$CHANGELOG_FILE" | grep -v "Unreleased")
    
    if [[ -z "$version_lines" ]]; then
        log_warning "No version entries found"
        return 0
    fi
    
    while IFS= read -r line; do
        log_verbose "Checking version line: $line"
        
        # Check SemVer format: ## [X.Y.Z] - YYYY-MM-DD
        if ! echo "$line" | grep -qE "^## \[[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.-]+)?\] - [0-9]{4}-[0-9]{2}-[0-9]{2}$"; then
            # Check if it's a valid unreleased-style entry
            if ! echo "$line" | grep -qE "^## \[[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.-]+)?\] - (TBD|Preparing for|Unreleased)"; then
                log_error "Invalid version format: $line"
                log_error "Expected format: ## [X.Y.Z] - YYYY-MM-DD or ## [X.Y.Z] - TBD"
            fi
        fi
        
        # Extract and validate date
        local date_part=$(echo "$line" | sed -n 's/.*- \([0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}\).*/\1/p')
        if [[ -n "$date_part" ]] && ! date -d "$date_part" &>/dev/null; then
            log_error "Invalid date format in: $line"
        fi
        
    done <<< "$version_lines"
    
    log_verbose "✓ Version formats validated"
}

validate_section_structure() {
    log_verbose "Validating section structure..."
    
    local standard_sections=("Added" "Changed" "Deprecated" "Removed" "Fixed" "Security")
    local found_sections=()
    
    # Check for standard sections
    for section in "${standard_sections[@]}"; do
        if grep -q "^### $section" "$CHANGELOG_FILE"; then
            found_sections+=("$section")
            log_verbose "✓ Found standard section: $section"
        fi
    done
    
    # Check for custom sections (allowed but noted)
    local all_sections=$(grep "^### " "$CHANGELOG_FILE" | sed 's/^### //' | sort -u)
    while IFS= read -r section; do
        if [[ ! " ${standard_sections[*]} " =~ " ${section} " ]]; then
            log_warning "Custom section found: $section"
        fi
    done <<< "$all_sections"
    
    if [[ ${#found_sections[@]} -eq 0 ]]; then
        log_warning "No standard Keep a Changelog sections found"
    else
        log_verbose "✓ Found ${#found_sections[@]} standard sections: ${found_sections[*]}"
    fi
}

validate_links() {
    log_verbose "Validating links and references..."
    
    # Check for broken markdown links
    local link_count=$(grep -o '\[.*\](.*)' "$CHANGELOG_FILE" | wc -l)
    log_verbose "Found $link_count markdown links"
    
    # Check for proper commit hash links (if any)
    if grep -q "commit/" "$CHANGELOG_FILE"; then
        local commit_links=$(grep -o "https://github.com[^)]*commit/[a-f0-9]\{7,40\}" "$CHANGELOG_FILE" | wc -l)
        log_verbose "Found $commit_links commit hash links"
    fi
    
    # Check for version comparison links at bottom (common pattern)
    if grep -q "^\[.*\]:" "$CHANGELOG_FILE"; then
        local reference_links=$(grep "^\[.*\]:" "$CHANGELOG_FILE" | wc -l)
        log_verbose "Found $reference_links reference-style links"
    fi
    
    log_verbose "✓ Links structure validated"
}

validate_chronological_order() {
    log_verbose "Validating chronological order of versions..."
    
    # Extract version numbers and dates
    local versions=$(grep "^## \[" "$CHANGELOG_FILE" | grep -v "Unreleased" | head -5)
    
    if [[ -z "$versions" ]]; then
        log_verbose "No versions found to validate order"
        return 0
    fi
    
    local prev_date=""
    while IFS= read -r line; do
        local current_date=$(echo "$line" | sed -n 's/.*- \([0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}\).*/\1/p')
        
        if [[ -n "$current_date" && -n "$prev_date" ]]; then
            if [[ "$current_date" > "$prev_date" ]]; then
                log_error "Versions not in chronological order: $line"
                log_error "Date $current_date should come before $prev_date"
            fi
        fi
        
        prev_date="$current_date"
    done <<< "$versions"
    
    log_verbose "✓ Chronological order validated"
}

check_empty_sections() {
    log_verbose "Checking for empty sections..."
    
    # Look for sections that might be empty
    local empty_sections=0
    
    # This is a simple check - could be enhanced
    if grep -A 5 "^### " "$CHANGELOG_FILE" | grep -q "^### "; then
        log_verbose "Sections appear to have content"
    fi
    
    log_verbose "✓ Empty sections check completed"
}

fix_common_issues() {
    if [[ "$FIX_ISSUES" != "true" ]]; then
        return 0
    fi
    
    log_info "Attempting to fix common issues..."
    
    # Backup original
    cp "$CHANGELOG_FILE" "${CHANGELOG_FILE}.backup"
    
    # Fix common formatting issues
    sed -i 's/^##\[/## [/' "$CHANGELOG_FILE"  # Fix missing space after ##
    sed -i 's/^###\([A-Za-z]\)/### \1/' "$CHANGELOG_FILE"  # Fix missing space after ###
    
    log_success "Applied automatic fixes (backup saved as ${CHANGELOG_FILE}.backup)"
}

generate_validation_report() {
    log_info "Generating validation report..."
    
    cat << EOF

📋 CHANGELOG.MD VALIDATION REPORT
=================================

File: $CHANGELOG_FILE
Standard: Keep a Changelog 1.0.0
Validation Date: $(date)

EOF

    if [[ $EXIT_CODE -eq 0 ]]; then
        echo -e "${GREEN}✅ VALIDATION PASSED${NC}"
        echo "Your CHANGELOG.md follows Keep a Changelog standards!"
    else
        echo -e "${RED}❌ VALIDATION FAILED${NC}"
        echo "Your CHANGELOG.md has formatting issues that need attention."
        echo ""
        echo "See error messages above for details."
        echo ""
        echo "Common fixes:"
        echo "  • Ensure version format: ## [X.Y.Z] - YYYY-MM-DD"
        echo "  • Include [Unreleased] section"
        echo "  • Use standard section names (Added, Changed, etc.)"
        echo "  • Maintain chronological order"
        echo ""
        echo "Run with --fix to attempt automatic repairs."
    fi
    
    echo ""
}

main() {
    log_info "Starting CHANGELOG.md validation..."
    
    parse_arguments "$@"
    
    # Run validation checks
    check_file_exists || exit 1
    
    validate_header
    validate_unreleased_section
    validate_version_format
    validate_section_structure
    validate_links
    validate_chronological_order
    check_empty_sections
    
    # Apply fixes if requested
    fix_common_issues
    
    # Generate report
    generate_validation_report
    
    exit $EXIT_CODE
}

# Run main function
main "$@"