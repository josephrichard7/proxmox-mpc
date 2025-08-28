#!/bin/bash

# Post-Release Monitoring and Rollback System
# Implements monitoring and automated rollback for Phase 6: QA-004
# Version: 1.0.0
# Usage: ./post-release-monitoring.sh [--version=<version>] [--monitor-duration=<minutes>] [--auto-rollback]

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." &> /dev/null && pwd)"
LOG_FILE="${PROJECT_ROOT}/logs/post-release-monitoring-$(date +%Y%m%d_%H%M%S).log"
MONITORING_DATA="${PROJECT_ROOT}/monitoring-data"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Default values
TARGET_VERSION=""
MONITOR_DURATION=60  # minutes
AUTO_ROLLBACK=false
ROLLBACK_THRESHOLD_ERRORS=10
ROLLBACK_THRESHOLD_DOWNLOADS=5
ROLLBACK_THRESHOLD_INSTALL_FAILURES=3
CHECK_INTERVAL=30  # seconds

# Monitoring metrics
TOTAL_DOWNLOADS=0
INSTALL_FAILURES=0
ERROR_COUNT=0
WARNING_COUNT=0
LAST_CHECK_TIME=""

# Create directories
mkdir -p "$(dirname "$LOG_FILE")" "$MONITORING_DATA"

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

log_critical() {
    log "${RED}[CRITICAL]${NC} $*"
}

log_section() {
    log "${PURPLE}[SECTION]${NC} $*"
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --version=*)
                TARGET_VERSION="${1#*=}"
                shift
                ;;
            --monitor-duration=*)
                MONITOR_DURATION="${1#*=}"
                shift
                ;;
            --auto-rollback)
                AUTO_ROLLBACK=true
                shift
                ;;
            --check-interval=*)
                CHECK_INTERVAL="${1#*=}"
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
Post-Release Monitoring and Rollback System

Usage: $0 [OPTIONS]

OPTIONS:
    --version=VERSION         Version to monitor (e.g., 1.0.0)
    --monitor-duration=MIN    How long to monitor in minutes [default: 60]
    --auto-rollback          Enable automatic rollback on threshold breach
    --check-interval=SEC     Check interval in seconds [default: 30]
    -h, --help               Show this help message

EXAMPLES:
    $0 --version=1.0.0 --monitor-duration=120 --auto-rollback
    $0 --version=1.0.0-rc.1 --check-interval=60
EOF
}

# Check NPM package health
check_npm_package_health() {
    log_info "📦 Checking NPM package health..."
    
    local package_name="proxmox-mpc"
    local npm_data_file="${MONITORING_DATA}/npm-stats.json"
    
    # Get package information from NPM
    if ! npm view "$package_name" --json > "$npm_data_file" 2>/dev/null; then
        log_error "Failed to fetch NPM package information"
        ERROR_COUNT=$((ERROR_COUNT + 1))
        return 1
    fi
    
    # Parse package data
    local published_version
    published_version=$(jq -r '.version' "$npm_data_file" 2>/dev/null || echo "unknown")
    
    local download_data_file="${MONITORING_DATA}/download-stats.json"
    
    # Get download statistics (if available through NPM API)
    if curl -s "https://api.npmjs.org/downloads/point/last-day/$package_name" > "$download_data_file" 2>/dev/null; then
        local daily_downloads
        daily_downloads=$(jq -r '.downloads // 0' "$download_data_file" 2>/dev/null || echo "0")
        TOTAL_DOWNLOADS=$daily_downloads
        
        log_success "✅ NPM package health: version=$published_version, downloads=$daily_downloads"
    else
        log_warning "⚠️  Unable to fetch download statistics"
        WARNING_COUNT=$((WARNING_COUNT + 1))
    fi
    
    # Check if target version is published
    if [[ -n "$TARGET_VERSION" && "$published_version" != "$TARGET_VERSION" ]]; then
        log_error "❌ Target version $TARGET_VERSION not found on NPM (found: $published_version)"
        ERROR_COUNT=$((ERROR_COUNT + 1))
        return 1
    fi
    
    return 0
}

# Check GitHub release health
check_github_release_health() {
    log_info "🐙 Checking GitHub release health..."
    
    local github_api="https://api.github.com/repos/proxmox-mpc/proxmox-mpc"
    local releases_data_file="${MONITORING_DATA}/github-releases.json"
    
    # Get release information
    if ! curl -s "${github_api}/releases" > "$releases_data_file" 2>/dev/null; then
        log_error "Failed to fetch GitHub release information"
        ERROR_COUNT=$((ERROR_COUNT + 1))
        return 1
    fi
    
    # Parse release data
    local latest_release
    latest_release=$(jq -r '.[0].tag_name // "unknown"' "$releases_data_file" 2>/dev/null || echo "unknown")
    
    local release_assets
    release_assets=$(jq -r '.[0].assets | length // 0' "$releases_data_file" 2>/dev/null || echo "0")
    
    log_success "✅ GitHub release health: latest=$latest_release, assets=$release_assets"
    
    # Check if target version is released
    if [[ -n "$TARGET_VERSION" ]]; then
        local target_found
        target_found=$(jq -r --arg version "v$TARGET_VERSION" '.[] | select(.tag_name == $version) | .tag_name' "$releases_data_file" 2>/dev/null || echo "")
        
        if [[ -z "$target_found" ]]; then
            log_error "❌ Target version v$TARGET_VERSION not found on GitHub"
            ERROR_COUNT=$((ERROR_COUNT + 1))
            return 1
        fi
    fi
    
    return 0
}

# Monitor installation success rate
monitor_installation_success() {
    log_info "🔧 Monitoring installation success rate..."
    
    # Simulate installation tests
    local test_installations=5
    local successful_installations=0
    
    for i in $(seq 1 $test_installations); do
        log_info "Testing installation $i/$test_installations..."
        
        # Create temporary directory for test
        local temp_dir
        temp_dir=$(mktemp -d)
        
        # Test NPM installation
        if (
            cd "$temp_dir"
            timeout 120s npm install proxmox-mpc > /dev/null 2>&1
        ); then
            successful_installations=$((successful_installations + 1))
            log_success "✅ Installation test $i succeeded"
        else
            log_error "❌ Installation test $i failed"
            INSTALL_FAILURES=$((INSTALL_FAILURES + 1))
        fi
        
        # Cleanup
        rm -rf "$temp_dir"
        
        # Brief pause between tests
        sleep 2
    done
    
    local success_rate
    success_rate=$(echo "scale=1; $successful_installations * 100 / $test_installations" | bc)
    
    log_info "Installation success rate: $success_rate% ($successful_installations/$test_installations)"
    
    # Check if success rate is below threshold
    if [[ $successful_installations -lt $((test_installations * 80 / 100)) ]]; then
        log_critical "🚨 Installation success rate below 80%!"
        ERROR_COUNT=$((ERROR_COUNT + 1))
        return 1
    fi
    
    return 0
}

# Check for reported issues
monitor_issue_reports() {
    log_info "🐛 Monitoring issue reports..."
    
    local github_api="https://api.github.com/repos/proxmox-mpc/proxmox-mpc"
    local issues_data_file="${MONITORING_DATA}/github-issues.json"
    
    # Get recent issues
    if ! curl -s "${github_api}/issues?state=open&sort=created&direction=desc&per_page=10" > "$issues_data_file" 2>/dev/null; then
        log_warning "⚠️  Unable to fetch GitHub issues"
        WARNING_COUNT=$((WARNING_COUNT + 1))
        return 0
    fi
    
    # Count issues created in the last 24 hours
    local recent_issues
    recent_issues=$(jq --arg date "$(date -d '24 hours ago' -Iseconds)" '[.[] | select(.created_at > $date)] | length' "$issues_data_file" 2>/dev/null || echo "0")
    
    local critical_keywords=("crash" "error" "bug" "broken" "fail" "problem")
    local critical_issues=0
    
    for keyword in "${critical_keywords[@]}"; do
        local keyword_count
        keyword_count=$(jq --arg keyword "$keyword" '[.[] | select(.title | ascii_downcase | contains($keyword))] | length' "$issues_data_file" 2>/dev/null || echo "0")
        critical_issues=$((critical_issues + keyword_count))
    done
    
    log_info "Recent issues: $recent_issues total, $critical_issues critical"
    
    # Check thresholds
    if [[ $recent_issues -gt 5 ]]; then
        log_warning "⚠️  High number of recent issues: $recent_issues"
        WARNING_COUNT=$((WARNING_COUNT + 1))
    fi
    
    if [[ $critical_issues -gt 2 ]]; then
        log_critical "🚨 Critical issues detected: $critical_issues"
        ERROR_COUNT=$((ERROR_COUNT + 1))
        return 1
    fi
    
    return 0
}

# Check system health metrics
check_system_health() {
    log_info "🏥 Checking system health metrics..."
    
    # Check if package can be imported
    if ! timeout 30s node -e "require('proxmox-mpc')" > /dev/null 2>&1; then
        log_error "❌ Package import failed"
        ERROR_COUNT=$((ERROR_COUNT + 1))
    else
        log_success "✅ Package import successful"
    fi
    
    # Check if CLI binary works
    if ! timeout 30s npx proxmox-mpc --version > /dev/null 2>&1; then
        log_error "❌ CLI binary execution failed"
        ERROR_COUNT=$((ERROR_COUNT + 1))
    else
        log_success "✅ CLI binary execution successful"
    fi
    
    # Memory usage check (for local testing)
    local memory_usage
    memory_usage=$(free -m | grep "Mem:" | awk '{print $3}')
    log_info "System memory usage: ${memory_usage}MB"
    
    return 0
}

# Save monitoring snapshot
save_monitoring_snapshot() {
    local snapshot_file="${MONITORING_DATA}/monitoring-snapshot-$(date +%Y%m%d_%H%M%S).json"
    
    cat > "$snapshot_file" << EOF
{
  "timestamp": "$(date -Iseconds)",
  "version": "$TARGET_VERSION",
  "metrics": {
    "total_downloads": $TOTAL_DOWNLOADS,
    "install_failures": $INSTALL_FAILURES,
    "error_count": $ERROR_COUNT,
    "warning_count": $WARNING_COUNT,
    "check_interval": $CHECK_INTERVAL
  },
  "thresholds": {
    "rollback_threshold_errors": $ROLLBACK_THRESHOLD_ERRORS,
    "rollback_threshold_downloads": $ROLLBACK_THRESHOLD_DOWNLOADS,
    "rollback_threshold_install_failures": $ROLLBACK_THRESHOLD_INSTALL_FAILURES
  },
  "environment": {
    "auto_rollback_enabled": $AUTO_ROLLBACK,
    "monitor_duration": $MONITOR_DURATION
  }
}
EOF
    
    log_info "Monitoring snapshot saved: $snapshot_file"
}

# Perform rollback
perform_rollback() {
    local rollback_reason="$1"
    
    log_critical "🔄 INITIATING ROLLBACK: $rollback_reason"
    
    # Create rollback script
    local rollback_script="${SCRIPT_DIR}/emergency-rollback.sh"
    
    cat > "$rollback_script" << 'EOF'
#!/bin/bash
# Emergency Rollback Script - Generated by Post-Release Monitoring
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." &> /dev/null && pwd)"

log_error() {
    echo -e "\033[0;31m[ERROR]\033[0m $*" >&2
}

log_info() {
    echo -e "\033[0;34m[INFO]\033[0m $*"
}

log_success() {
    echo -e "\033[0;32m[SUCCESS]\033[0m $*"
}

rollback_npm_package() {
    log_info "🔄 Rolling back NPM package..."
    
    # Get previous version
    local current_version
    current_version=$(npm view proxmox-mpc version)
    
    # Find previous version (simplified - in real scenario, maintain version history)
    local previous_version
    previous_version=$(npm view proxmox-mpc versions --json | jq -r '.[-2]' 2>/dev/null || echo "")
    
    if [[ -n "$previous_version" ]]; then
        log_info "Attempting to rollback from $current_version to $previous_version"
        
        # In a real scenario, this would involve:
        # 1. Publishing previous version with latest tag
        # 2. Updating package.json
        # 3. Creating rollback release
        
        log_error "❌ NPM rollback requires manual intervention"
        return 1
    else
        log_error "❌ Cannot determine previous version for rollback"
        return 1
    fi
}

rollback_git_tag() {
    log_info "🏷️  Rolling back Git tag..."
    
    cd "$PROJECT_ROOT"
    
    # Remove problematic tag (if exists)
    if git tag -l | grep -q "v${TARGET_VERSION:-}"; then
        git tag -d "v${TARGET_VERSION:-}" || true
        git push --delete origin "v${TARGET_VERSION:-}" 2>/dev/null || true
        log_success "✅ Removed problematic Git tag"
    fi
}

rollback_github_release() {
    log_info "📝 Rolling back GitHub release..."
    
    # This would require GitHub API calls to:
    # 1. Mark release as draft
    # 2. Delete release assets
    # 3. Update release notes with rollback notice
    
    log_error "❌ GitHub release rollback requires manual intervention"
    return 1
}

main() {
    log_info "🚨 EXECUTING EMERGENCY ROLLBACK"
    
    rollback_git_tag
    
    if ! rollback_npm_package; then
        log_error "❌ NPM rollback failed - requires manual intervention"
    fi
    
    if ! rollback_github_release; then
        log_error "❌ GitHub release rollback failed - requires manual intervention"
    fi
    
    log_info "🔔 ROLLBACK COMPLETED - MANUAL VERIFICATION REQUIRED"
    
    # Create rollback report
    cat > "$PROJECT_ROOT/ROLLBACK-REPORT-$(date +%Y%m%d_%H%M%S).md" << REPORT_EOF
# Emergency Rollback Report

**Timestamp:** $(date -Iseconds)
**Reason:** $rollback_reason
**Target Version:** ${TARGET_VERSION:-'Unknown'}

## Actions Taken

- Git tag rollback: Attempted
- NPM package rollback: Failed (manual intervention required)
- GitHub release rollback: Failed (manual intervention required)

## Manual Steps Required

1. **NPM Package:**
   - Publish previous stable version with 'latest' tag
   - Update package registry metadata
   - Notify users of temporary issues

2. **GitHub Release:**
   - Mark problematic release as pre-release or draft
   - Update release notes with rollback notice
   - Create hotfix release if necessary

3. **Communication:**
   - Notify users via appropriate channels
   - Document issues and resolution steps
   - Plan hotfix release if needed

## Next Steps

1. Investigate root cause of release issues
2. Implement fixes in development branch
3. Test thoroughly before next release attempt
4. Update release procedures to prevent similar issues

---
Generated by Proxmox-MPC Emergency Rollback System
REPORT_EOF
    
    log_success "Rollback report created: ROLLBACK-REPORT-*.md"
}

main "$@"
EOF
    
    chmod +x "$rollback_script"
    
    if [[ "$AUTO_ROLLBACK" == "true" ]]; then
        log_critical "🤖 Executing automatic rollback..."
        if "$rollback_script" "$rollback_reason"; then
            log_success "✅ Automatic rollback completed"
        else
            log_error "❌ Automatic rollback failed - manual intervention required"
        fi
    else
        log_critical "🔧 Rollback script prepared: $rollback_script"
        log_critical "❗ Manual execution required: $rollback_script \"$rollback_reason\""
    fi
    
    return 0
}

# Check rollback triggers
check_rollback_triggers() {
    local should_rollback=false
    local rollback_reasons=()
    
    # Check error count threshold
    if [[ $ERROR_COUNT -ge $ROLLBACK_THRESHOLD_ERRORS ]]; then
        should_rollback=true
        rollback_reasons+=("Error count exceeded threshold: $ERROR_COUNT >= $ROLLBACK_THRESHOLD_ERRORS")
    fi
    
    # Check install failure threshold
    if [[ $INSTALL_FAILURES -ge $ROLLBACK_THRESHOLD_INSTALL_FAILURES ]]; then
        should_rollback=true
        rollback_reasons+=("Install failures exceeded threshold: $INSTALL_FAILURES >= $ROLLBACK_THRESHOLD_INSTALL_FAILURES")
    fi
    
    # Check download threshold (if downloads are suspiciously low)
    if [[ $TOTAL_DOWNLOADS -gt 0 && $TOTAL_DOWNLOADS -lt $ROLLBACK_THRESHOLD_DOWNLOADS ]]; then
        should_rollback=true
        rollback_reasons+=("Downloads below threshold: $TOTAL_DOWNLOADS < $ROLLBACK_THRESHOLD_DOWNLOADS")
    fi
    
    if [[ "$should_rollback" == "true" ]]; then
        local combined_reason
        combined_reason=$(IFS='; '; echo "${rollback_reasons[*]}")
        
        log_critical "🚨 ROLLBACK TRIGGERS ACTIVATED!"
        log_critical "Reasons: $combined_reason"
        
        perform_rollback "$combined_reason"
        return 1
    fi
    
    return 0
}

# Generate monitoring report
generate_monitoring_report() {
    local start_time="$1"
    local end_time="$2"
    local duration=$((end_time - start_time))
    
    local report_file="${PROJECT_ROOT}/monitoring-reports/post-release-monitoring-report-$(date +%Y%m%d_%H%M%S).md"
    
    mkdir -p "$(dirname "$report_file")"
    
    cat > "$report_file" << EOF
# Post-Release Monitoring Report

**Version:** ${TARGET_VERSION:-'Not specified'}
**Monitoring Duration:** ${duration}s (${MONITOR_DURATION} minutes planned)
**Check Interval:** ${CHECK_INTERVAL}s
**Auto-Rollback:** $([ "$AUTO_ROLLBACK" == "true" ] && echo "Enabled" || echo "Disabled")
**Generated:** $(date -Iseconds)

## Monitoring Summary

- **Total Errors:** $ERROR_COUNT
- **Total Warnings:** $WARNING_COUNT
- **Installation Failures:** $INSTALL_FAILURES
- **Downloads Tracked:** $TOTAL_DOWNLOADS

## Health Check Results

### NPM Package Health
- Package availability and version verification
- Download statistics monitoring
- Installation success rate testing

### GitHub Release Health
- Release availability and assets
- Issue report monitoring
- Critical issue detection

### System Health
- Package import functionality
- CLI binary execution
- Resource usage monitoring

## Rollback Thresholds

- **Error Threshold:** $ROLLBACK_THRESHOLD_ERRORS (Current: $ERROR_COUNT)
- **Install Failure Threshold:** $ROLLBACK_THRESHOLD_INSTALL_FAILURES (Current: $INSTALL_FAILURES)
- **Download Threshold:** $ROLLBACK_THRESHOLD_DOWNLOADS (Current: $TOTAL_DOWNLOADS)

## Status

$([ $ERROR_COUNT -ge $ROLLBACK_THRESHOLD_ERRORS ] && echo "🚨 **ROLLBACK REQUIRED** - Error threshold exceeded" || echo "✅ **MONITORING PASSED** - No rollback triggers activated")

$([ $WARNING_COUNT -gt 0 ] && echo "⚠️ **$WARNING_COUNT warnings detected** - Review recommended" || "")

## Recommendations

$(if [[ $ERROR_COUNT -ge $ROLLBACK_THRESHOLD_ERRORS ]]; then
    echo "1. **Immediate Action Required:** Execute rollback procedure"
    echo "2. **Investigation:** Identify root cause of errors"
    echo "3. **Communication:** Notify users of issues"
    echo "4. **Hotfix:** Prepare and test fixes"
elif [[ $WARNING_COUNT -gt 0 ]]; then
    echo "1. **Monitor Closely:** Continue monitoring for any escalation"
    echo "2. **Investigation:** Review warnings for potential issues"
    echo "3. **Preparation:** Have rollback plan ready if needed"
else
    echo "1. **Continue Monitoring:** Release appears healthy"
    echo "2. **Document Success:** Record successful release metrics"
    echo "3. **Plan Next Steps:** Prepare for future releases"
fi)

## Data Files

- **Monitoring Log:** \`$LOG_FILE\`
- **Monitoring Data:** \`$MONITORING_DATA/\`
- **Snapshots:** \`$MONITORING_DATA/monitoring-snapshot-*.json\`

---
Generated by Proxmox-MPC Post-Release Monitoring System
EOF
    
    log_success "Monitoring report generated: $report_file"
}

# Main monitoring loop
run_post_release_monitoring() {
    local start_time
    start_time=$(date +%s)
    local end_time=$((start_time + MONITOR_DURATION * 60))
    
    log_section "🎯 Starting post-release monitoring for Proxmox-MPC"
    log_info "Target Version: ${TARGET_VERSION:-'not specified'}"
    log_info "Monitor Duration: $MONITOR_DURATION minutes"
    log_info "Check Interval: $CHECK_INTERVAL seconds"
    log_info "Auto Rollback: $AUTO_ROLLBACK"
    log_info "End Time: $(date -d "@$end_time" '+%Y-%m-%d %H:%M:%S')"
    
    cd "$PROJECT_ROOT"
    
    # Initial health check
    log_section "📊 Performing initial health checks..."
    check_npm_package_health || true
    check_github_release_health || true
    monitor_installation_success || true
    monitor_issue_reports || true
    check_system_health || true
    
    # Save initial snapshot
    save_monitoring_snapshot
    
    # Check initial rollback triggers
    if check_rollback_triggers; then
        log_info "✅ Initial health check passed - continuing monitoring"
    else
        log_critical "🚨 Initial rollback triggered - monitoring terminated"
        generate_monitoring_report "$start_time" "$(date +%s)"
        return 1
    fi
    
    # Monitoring loop
    local check_count=1
    local total_checks=$((MONITOR_DURATION * 60 / CHECK_INTERVAL))
    
    log_section "🔄 Starting monitoring loop..."
    log_info "Performing $total_checks checks every $CHECK_INTERVAL seconds"
    
    while [[ $(date +%s) -lt $end_time ]]; do
        local current_time
        current_time=$(date +%s)
        local remaining_time=$((end_time - current_time))
        
        log_section "🔍 Health check $check_count/$total_checks (${remaining_time}s remaining)"
        
        # Reset counters for this check
        ERROR_COUNT=0
        WARNING_COUNT=0
        INSTALL_FAILURES=0
        
        # Perform health checks
        check_npm_package_health || true
        check_github_release_health || true
        monitor_installation_success || true
        monitor_issue_reports || true
        check_system_health || true
        
        # Save monitoring snapshot
        save_monitoring_snapshot
        
        # Check rollback triggers
        if ! check_rollback_triggers; then
            log_critical "🚨 Rollback triggered during monitoring - terminating"
            generate_monitoring_report "$start_time" "$(date +%s)"
            return 1
        fi
        
        log_success "✅ Health check $check_count completed - no issues detected"
        
        # Wait for next check
        if [[ $remaining_time -gt $CHECK_INTERVAL ]]; then
            log_info "⏱️  Waiting $CHECK_INTERVAL seconds until next check..."
            sleep $CHECK_INTERVAL
        else
            log_info "⏱️  Final check - monitoring period ending"
            break
        fi
        
        check_count=$((check_count + 1))
    done
    
    local final_time
    final_time=$(date +%s)
    
    # Generate final report
    generate_monitoring_report "$start_time" "$final_time"
    
    # Final summary
    log_section "========================================="
    log_section "🏁 POST-RELEASE MONITORING SUMMARY"
    log_section "========================================="
    log_info "Target Version: ${TARGET_VERSION:-'Not specified'}"
    log_info "Monitoring Duration: $((final_time - start_time))s"
    log_info "Checks Performed: $check_count"
    log_success "Total Errors: $ERROR_COUNT"
    log_warning "Total Warnings: $WARNING_COUNT"
    log_info "Installation Failures: $INSTALL_FAILURES"
    
    if [[ $ERROR_COUNT -eq 0 && $INSTALL_FAILURES -eq 0 ]]; then
        log_success "🎉 POST-RELEASE MONITORING COMPLETED SUCCESSFULLY!"
        log_success "Release appears stable and healthy."
        return 0
    else
        log_warning "⚠️  POST-RELEASE MONITORING COMPLETED WITH ISSUES"
        log_warning "Review monitoring data and consider manual intervention."
        return 1
    fi
}

# Main execution
main() {
    parse_args "$@"
    run_post_release_monitoring
}

# Run main function with all arguments
main "$@"