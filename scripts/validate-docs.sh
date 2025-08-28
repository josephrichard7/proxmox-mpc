#!/bin/bash

# Documentation Validation Script
# Validates documentation content for quality, accuracy, and compliance

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOCS_DIR="docs"
SITE_DIR="site"
VALIDATION_LOG="logs/docs-validation-$(date +%Y%m%d_%H%M%S).log"
ERRORS=0
WARNINGS=0

# Create logs directory if it doesn't exist
mkdir -p logs

# Logging function
log() {
    echo "$1" | tee -a "$VALIDATION_LOG"
}

# Error logging
error() {
    echo -e "${RED}ERROR: $1${NC}" | tee -a "$VALIDATION_LOG"
    ((ERRORS++))
}

# Warning logging
warn() {
    echo -e "${YELLOW}WARNING: $1${NC}" | tee -a "$VALIDATION_LOG"
    ((WARNINGS++))
}

# Info logging
info() {
    echo -e "${BLUE}INFO: $1${NC}" | tee -a "$VALIDATION_LOG"
}

# Success logging
success() {
    echo -e "${GREEN}SUCCESS: $1${NC}" | tee -a "$VALIDATION_LOG"
}

# Header
echo "================================================" | tee "$VALIDATION_LOG"
echo "Documentation Validation Report" | tee -a "$VALIDATION_LOG"
echo "Generated: $(date)" | tee -a "$VALIDATION_LOG"
echo "================================================" | tee -a "$VALIDATION_LOG"

# Check if docs directory exists
if [[ ! -d "$DOCS_DIR" ]]; then
    error "Documentation directory '$DOCS_DIR' not found"
    exit 1
fi

info "Starting documentation validation..."

# 1. Check for required documentation files
info "Checking required documentation files..."

required_files=(
    "index.md"
    "DOCUMENTATION_STANDARDS.md"
    "CONTENT_LIFECYCLE.md"
    "getting-started/quick-start.md"
    "reference/cli-reference.md"
    "troubleshooting/common-issues.md"
)

for file in "${required_files[@]}"; do
    if [[ -f "$DOCS_DIR/$file" ]]; then
        success "Required file found: $file"
    else
        error "Required file missing: $file"
    fi
done

# 2. Validate markdown syntax
info "Validating Markdown syntax..."

# Check if markdownlint is available
if command -v markdownlint &> /dev/null; then
    if markdownlint "$DOCS_DIR" --config .markdownlint.json 2>/dev/null; then
        success "Markdown syntax validation passed"
    else
        warn "Markdown syntax issues found (non-critical)"
    fi
else
    warn "markdownlint not available, skipping syntax validation"
fi

# 3. Check for broken internal links
info "Checking internal links..."

find "$DOCS_DIR" -name "*.md" -exec grep -l "\[.*\](.*\.md)" {} \; | while read -r file; do
    grep -o "\[.*\](.*\.md)" "$file" | while read -r link; do
        # Extract the path from the link
        path=$(echo "$link" | sed -n 's/.*(\(.*\.md\)).*/\1/p')
        
        # Convert relative path to absolute
        if [[ "$path" =~ ^\.\. ]]; then
            # Handle relative paths like ../other/file.md
            full_path=$(dirname "$file")/"$path"
            full_path=$(realpath "$full_path" 2>/dev/null || echo "$full_path")
        elif [[ "$path" =~ ^\. ]]; then
            # Handle relative paths like ./file.md
            full_path=$(dirname "$file")/"${path#./}"
        else
            # Handle absolute paths from docs root
            full_path="$DOCS_DIR/$path"
        fi
        
        if [[ -f "$full_path" ]]; then
            success "Internal link valid: $path in $file"
        else
            error "Broken internal link: $path in $file"
        fi
    done
done

# 4. Check for missing metadata
info "Checking document metadata..."

find "$DOCS_DIR" -name "*.md" -not -path "*/templates/*" | while read -r file; do
    if grep -q "**Document Metadata**\|**Created**\|**Last Updated**" "$file"; then
        success "Metadata found: $(basename "$file")"
    else
        warn "Missing metadata: $file"
    fi
done

# 5. Validate template compliance
info "Validating template compliance..."

template_files=(
    "templates/feature-template.md"
    "templates/api-reference-template.md"
    "templates/tutorial-template.md"
    "templates/troubleshooting-template.md"
    "templates/adr-template.md"
    "templates/release-notes-template.md"
)

for template in "${template_files[@]}"; do
    if [[ -f "$DOCS_DIR/$template" ]]; then
        success "Template found: $(basename "$template")"
    else
        error "Template missing: $template"
    fi
done

# 6. Check for outdated content (files older than 6 months)
info "Checking for outdated content..."

six_months_ago=$(date -d "6 months ago" +%s)

find "$DOCS_DIR" -name "*.md" -not -path "*/templates/*" | while read -r file; do
    file_date=$(stat -c %Y "$file")
    
    if [[ $file_date -lt $six_months_ago ]]; then
        warn "Potentially outdated file (>6 months): $file"
    fi
done

# 7. Validate MkDocs configuration
info "Validating MkDocs configuration..."

if [[ -f "mkdocs.yml" ]]; then
    # Check if mkdocs command is available
    if command -v mkdocs &> /dev/null; then
        if mkdocs build --strict 2>/dev/null; then
            success "MkDocs configuration valid"
        else
            error "MkDocs build failed - configuration issues"
        fi
    else
        warn "MkDocs not available, skipping configuration validation"
    fi
else
    error "mkdocs.yml configuration file not found"
fi

# 8. Check for duplicate content
info "Checking for duplicate content..."

# Create temporary file list
temp_file="/tmp/doc_titles_$$"

find "$DOCS_DIR" -name "*.md" -exec grep -l "^# " {} \; | while read -r file; do
    title=$(grep "^# " "$file" | head -1 | sed 's/^# //')
    echo "$title:$file"
done > "$temp_file"

# Check for duplicate titles
duplicates=$(cut -d':' -f1 "$temp_file" | sort | uniq -d)

if [[ -n "$duplicates" ]]; then
    warn "Duplicate titles found:"
    echo "$duplicates" | while read -r title; do
        warn "  Title: '$title'"
        grep "^$title:" "$temp_file" | while read -r line; do
            warn "    File: $(echo "$line" | cut -d':' -f2-)"
        done
    done
else
    success "No duplicate titles found"
fi

rm -f "$temp_file"

# 9. Check site generation (if site directory exists)
if [[ -d "$SITE_DIR" ]]; then
    info "Validating generated site..."
    
    # Check if essential pages exist in generated site
    essential_pages=(
        "index.html"
        "getting-started/quick-start/index.html"
        "reference/cli-reference/index.html"
    )
    
    for page in "${essential_pages[@]}"; do
        if [[ -f "$SITE_DIR/$page" ]]; then
            success "Generated page found: $page"
        else
            error "Generated page missing: $page"
        fi
    done
else
    warn "Site directory not found - run 'mkdocs build' to generate site"
fi

# 10. Summary and recommendations
echo "" | tee -a "$VALIDATION_LOG"
echo "================================================" | tee -a "$VALIDATION_LOG"
echo "VALIDATION SUMMARY" | tee -a "$VALIDATION_LOG"
echo "================================================" | tee -a "$VALIDATION_LOG"

if [[ $ERRORS -eq 0 && $WARNINGS -eq 0 ]]; then
    success "All documentation validation checks passed!"
elif [[ $ERRORS -eq 0 ]]; then
    warn "Validation completed with $WARNINGS warnings (no errors)"
else
    error "Validation completed with $ERRORS errors and $WARNINGS warnings"
fi

echo "" | tee -a "$VALIDATION_LOG"
echo "RECOMMENDATIONS:" | tee -a "$VALIDATION_LOG"

if [[ $ERRORS -gt 0 ]]; then
    echo "- Fix all errors before publishing documentation" | tee -a "$VALIDATION_LOG"
fi

if [[ $WARNINGS -gt 0 ]]; then
    echo "- Review and address warnings to improve documentation quality" | tee -a "$VALIDATION_LOG"
fi

echo "- Run 'mkdocs serve' to preview documentation locally" | tee -a "$VALIDATION_LOG"
echo "- Use templates in docs/templates/ for new content" | tee -a "$VALIDATION_LOG"
echo "- Follow DOCUMENTATION_STANDARDS.md for style guidelines" | tee -a "$VALIDATION_LOG"
echo "" | tee -a "$VALIDATION_LOG"

log "Validation log saved to: $VALIDATION_LOG"

# Exit with appropriate code
if [[ $ERRORS -gt 0 ]]; then
    exit 1
else
    exit 0
fi