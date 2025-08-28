#!/bin/bash

# Proxmox-MPC Release Orchestrator
# Master script that orchestrates the complete release workflow
# Integrates all Phase 3: Release Automation Workflows

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Configuration flags
RELEASE_TYPE="auto"
DRY_RUN=false
SKIP_PREPARATION=false
SKIP_TAGGING=false
SKIP_PUBLISHING=false
SKIP_ANNOUNCEMENTS=false
SKIP_NOTIFICATIONS=false
AUTO_CONFIRM=false
VERBOSE=false

# Workflow state tracking
PREPARATION_SUCCESS=false
TAGGING_SUCCESS=false
PUBLISHING_SUCCESS=false
ANNOUNCEMENT_SUCCESS=false
NOTIFICATION_SUCCESS=false
TOTAL_STEPS=6
COMPLETED_STEPS=0

print_header() {
    echo ""
    echo -e "${MAGENTA}████████████████████████████████████████████████████████████████${NC}"
    echo -e "${MAGENTA}$1${NC}"
    echo -e "${MAGENTA}████████████████████████████████████████████████████████████████${NC}"
    echo ""
}

print_step() {
    ((COMPLETED_STEPS++))
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}STEP $COMPLETED_STEPS/$TOTAL_STEPS: $1${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[⚠]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Master release orchestrator for Proxmox-MPC - coordinates all release workflows

OPTIONS:
    -t, --type TYPE            Release type: auto, patch, minor, major, prerelease (default: auto)
    -d, --dry-run             Preview all release steps without executing
    --skip-preparation        Skip release preparation and validation
    --skip-tagging            Skip git tagging with GPG signing
    --skip-publishing         Skip npm package publishing
    --skip-announcements      Skip release announcement generation
    --skip-notifications      Skip release notifications
    --auto-confirm            Automatically confirm all prompts
    -v, --verbose             Enable verbose output
    -h, --help                Show this help message

RELEASE WORKFLOW:
    1. 🛠️  Release Preparation (prepare-release.sh)
       - Environment validation and dependency checks
       - Build process and comprehensive testing
       - Security scanning and quality validation
       - Version consistency and documentation checks

    2. 🏷️  Git Tagging (create-release-tag.sh)
       - GPG-signed git tags with release metadata
       - Version validation and tag verification
       - Backup creation and rollback preparation

    3. 📦 Package Publishing (publish-npm-package.sh)
       - npm authentication and registry validation
       - Security scanning and content verification
       - Package publishing with access control
       - Post-publish verification and smoke testing

    4. 📢 Announcement Generation (generate-release-announcement.sh)
       - Multi-format release announcements
       - GitHub release notes, social media posts
       - Email newsletters and blog posts
       - Marketing materials and press releases

    5. 🔔 Notification System (notify-release.sh)
       - GitHub release creation and automation
       - Social media notifications (Discord, Slack)
       - Community announcements and engagement
       - Stakeholder and subscriber notifications

    6. 📊 Completion Summary and Next Steps

EXAMPLES:
    $0                        # Full release workflow with auto-detected version bump
    $0 --type minor          # Minor release with complete workflow
    $0 --dry-run --verbose   # Preview all steps with detailed output
    $0 --skip-notifications  # Run workflow but skip final notifications

SAFETY FEATURES:
    - Comprehensive dry-run mode for safe testing
    - Step-by-step confirmation prompts
    - Automatic backup creation before changes
    - Rollback procedures for failed releases
    - Multi-stage validation and verification

REQUIREMENTS:
    - Git repository with clean working directory
    - npm authentication for package publishing
    - GPG key for signed tags (recommended)
    - Environment variables for notifications (optional)

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
            --skip-preparation)
                SKIP_PREPARATION=true
                shift
                ;;
            --skip-tagging)
                SKIP_TAGGING=true
                shift
                ;;
            --skip-publishing)
                SKIP_PUBLISHING=true
                shift
                ;;
            --skip-announcements)
                SKIP_ANNOUNCEMENTS=true
                shift
                ;;
            --skip-notifications)
                SKIP_NOTIFICATIONS=true
                shift
                ;;
            --auto-confirm)
                AUTO_CONFIRM=true
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

validate_prerequisites() {
    print_status "Validating orchestrator prerequisites..."
    
    # Check if all required scripts exist
    local required_scripts=(
        "prepare-release.sh"
        "create-release-tag.sh"
        "publish-npm-package.sh"
        "generate-release-announcement.sh"
        "notify-release.sh"
        "rollback-release.sh"
    )
    
    local missing_scripts=()
    
    for script in "${required_scripts[@]}"; do
        if [[ ! -f "$SCRIPT_DIR/$script" ]] || [[ ! -x "$SCRIPT_DIR/$script" ]]; then
            missing_scripts+=("$script")
        fi
    done
    
    if [[ ${#missing_scripts[@]} -ne 0 ]]; then
        print_error "Missing required scripts: ${missing_scripts[*]}"
        print_status "Ensure all Phase 3 workflow scripts are present and executable"
        exit 1
    fi
    
    # Check basic environment
    if ! command -v git &> /dev/null; then
        print_error "Git is required but not installed"
        exit 1
    fi
    
    if [[ ! -f "package.json" ]]; then
        print_error "package.json not found - not a valid npm project"
        exit 1
    fi
    
    print_success "Prerequisites validated"
}

show_release_plan() {
    print_header "Release Plan Overview"
    
    local current_version=$(jq -r '.version' package.json 2>/dev/null || echo "unknown")
    
    print_status "📋 Release Configuration:"
    echo "  Current Version: $current_version"
    echo "  Release Type: $RELEASE_TYPE"
    echo "  Dry Run: $(if [[ "$DRY_RUN" == "true" ]]; then echo "Yes"; else echo "No"; fi)"
    echo ""
    
    print_status "🔄 Workflow Steps:"
    
    local step_num=1
    if [[ "$SKIP_PREPARATION" != "true" ]]; then
        echo "  $step_num. 🛠️  Release Preparation & Validation"
        ((step_num++))
    fi
    
    if [[ "$SKIP_TAGGING" != "true" ]]; then
        echo "  $step_num. 🏷️  Git Tagging with GPG Signing"
        ((step_num++))
    fi
    
    if [[ "$SKIP_PUBLISHING" != "true" ]]; then
        echo "  $step_num. 📦 npm Package Publishing"
        ((step_num++))
    fi
    
    if [[ "$SKIP_ANNOUNCEMENTS" != "true" ]]; then
        echo "  $step_num. 📢 Release Announcement Generation"
        ((step_num++))
    fi
    
    if [[ "$SKIP_NOTIFICATIONS" != "true" ]]; then
        echo "  $step_num. 🔔 Release Notifications"
        ((step_num++))
    fi
    
    echo "  $step_num. 📊 Completion Summary"
    
    # Update total steps based on what's enabled
    TOTAL_STEPS=$step_num
    
    if [[ "$AUTO_CONFIRM" != "true" ]] && [[ "$DRY_RUN" != "true" ]]; then
        echo ""
        print_warning "This will execute a full release workflow!"
        read -p "Continue with release orchestration? [y/N] " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_status "Release orchestration cancelled"
            exit 0
        fi
    fi
}

execute_preparation() {
    if [[ "$SKIP_PREPARATION" == "true" ]]; then
        print_status "Release preparation skipped by user"
        return 0
    fi
    
    print_step "Release Preparation & Validation"
    
    local prep_args=()
    prep_args+=("--type" "$RELEASE_TYPE")
    
    if [[ "$DRY_RUN" == "true" ]]; then
        prep_args+=("--dry-run")
    fi
    
    if [[ "$VERBOSE" == "true" ]]; then
        prep_args+=("--verbose")
    fi
    
    print_status "Executing: $SCRIPT_DIR/prepare-release.sh ${prep_args[*]}"
    
    if "$SCRIPT_DIR/prepare-release.sh" "${prep_args[@]}"; then
        PREPARATION_SUCCESS=true
        print_success "✅ Release preparation completed successfully"
    else
        print_error "❌ Release preparation failed"
        
        # Offer rollback option
        if [[ "$AUTO_CONFIRM" != "true" ]] && [[ "$DRY_RUN" != "true" ]]; then
            echo ""
            read -p "Would you like to rollback any changes? [y/N] " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                print_status "Executing rollback..."
                "$SCRIPT_DIR/rollback-release.sh" --auto-confirm || true
            fi
        fi
        
        exit 1
    fi
}

execute_tagging() {
    if [[ "$SKIP_TAGGING" == "true" ]]; then
        print_status "Git tagging skipped by user"
        return 0
    fi
    
    print_step "Git Tagging with GPG Signing"
    
    local tag_args=()
    
    if [[ "$DRY_RUN" == "true" ]]; then
        tag_args+=("--dry-run")
    fi
    
    if [[ "$VERBOSE" == "true" ]]; then
        tag_args+=("--verbose")
    fi
    
    print_status "Executing: $SCRIPT_DIR/create-release-tag.sh ${tag_args[*]}"
    
    if "$SCRIPT_DIR/create-release-tag.sh" "${tag_args[@]}"; then
        TAGGING_SUCCESS=true
        print_success "✅ Git tagging completed successfully"
    else
        print_error "❌ Git tagging failed"
        exit 1
    fi
}

execute_publishing() {
    if [[ "$SKIP_PUBLISHING" == "true" ]]; then
        print_status "Package publishing skipped by user"
        return 0
    fi
    
    print_step "npm Package Publishing"
    
    local pub_args=()
    
    if [[ "$DRY_RUN" == "true" ]]; then
        pub_args+=("--dry-run")
    fi
    
    if [[ "$VERBOSE" == "true" ]]; then
        pub_args+=("--verbose")
    fi
    
    # Add pre-release tag if applicable
    local version=$(jq -r '.version' package.json 2>/dev/null || echo "")
    if echo "$version" | grep -qE "(alpha|beta|rc|pre)"; then
        pub_args+=("--tag" "next")
    fi
    
    print_status "Executing: $SCRIPT_DIR/publish-npm-package.sh ${pub_args[*]}"
    
    if "$SCRIPT_DIR/publish-npm-package.sh" "${pub_args[@]}"; then
        PUBLISHING_SUCCESS=true
        print_success "✅ Package publishing completed successfully"
    else
        print_error "❌ Package publishing failed"
        
        # Offer rollback option for failed publishing
        if [[ "$AUTO_CONFIRM" != "true" ]] && [[ "$DRY_RUN" != "true" ]]; then
            echo ""
            read -p "Would you like to rollback the release? [y/N] " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                print_status "Executing rollback..."
                "$SCRIPT_DIR/rollback-release.sh" --auto-confirm || true
            fi
        fi
        
        exit 1
    fi
}

execute_announcements() {
    if [[ "$SKIP_ANNOUNCEMENTS" == "true" ]]; then
        print_status "Release announcements skipped by user"
        return 0
    fi
    
    print_step "Release Announcement Generation"
    
    local announce_args=()
    
    if [[ "$DRY_RUN" == "true" ]]; then
        announce_args+=("--dry-run")
    fi
    
    if [[ "$VERBOSE" == "true" ]]; then
        announce_args+=("--verbose")
    fi
    
    print_status "Executing: $SCRIPT_DIR/generate-release-announcement.sh ${announce_args[*]}"
    
    if "$SCRIPT_DIR/generate-release-announcement.sh" "${announce_args[@]}"; then
        ANNOUNCEMENT_SUCCESS=true
        print_success "✅ Release announcements generated successfully"
    else
        print_error "❌ Release announcement generation failed"
        print_warning "Continuing with workflow - announcements can be generated manually"
    fi
}

execute_notifications() {
    if [[ "$SKIP_NOTIFICATIONS" == "true" ]]; then
        print_status "Release notifications skipped by user"
        return 0
    fi
    
    print_step "Release Notifications"
    
    local notify_args=()
    
    if [[ "$DRY_RUN" == "true" ]]; then
        notify_args+=("--dry-run")
    fi
    
    if [[ "$VERBOSE" == "true" ]]; then
        notify_args+=("--verbose")
    fi
    
    if [[ "$AUTO_CONFIRM" == "true" ]]; then
        notify_args+=("--auto-confirm")
    fi
    
    print_status "Executing: $SCRIPT_DIR/notify-release.sh ${notify_args[*]}"
    
    if "$SCRIPT_DIR/notify-release.sh" "${notify_args[@]}"; then
        NOTIFICATION_SUCCESS=true
        print_success "✅ Release notifications completed successfully"
    else
        print_error "❌ Release notifications failed"
        print_warning "Continuing with workflow - notifications can be sent manually"
    fi
}

generate_orchestration_summary() {
    print_step "Release Orchestration Summary"
    
    local final_version=$(jq -r '.version' package.json 2>/dev/null || echo "unknown")
    local success_count=0
    local warning_count=0
    
    print_status "📊 Workflow Results:"
    echo ""
    
    # Count successes and generate status
    if [[ "$SKIP_PREPARATION" == "true" ]]; then
        echo "  🛠️  Preparation: ⏭️ Skipped"
    elif [[ "$PREPARATION_SUCCESS" == "true" ]]; then
        echo "  🛠️  Preparation: ✅ Success"
        ((success_count++))
    else
        echo "  🛠️  Preparation: ❌ Failed"
    fi
    
    if [[ "$SKIP_TAGGING" == "true" ]]; then
        echo "  🏷️  Tagging: ⏭️ Skipped"
    elif [[ "$TAGGING_SUCCESS" == "true" ]]; then
        echo "  🏷️  Tagging: ✅ Success"
        ((success_count++))
    else
        echo "  🏷️  Tagging: ❌ Failed"
    fi
    
    if [[ "$SKIP_PUBLISHING" == "true" ]]; then
        echo "  📦 Publishing: ⏭️ Skipped"
    elif [[ "$PUBLISHING_SUCCESS" == "true" ]]; then
        echo "  📦 Publishing: ✅ Success"
        ((success_count++))
    else
        echo "  📦 Publishing: ❌ Failed"
    fi
    
    if [[ "$SKIP_ANNOUNCEMENTS" == "true" ]]; then
        echo "  📢 Announcements: ⏭️ Skipped"
    elif [[ "$ANNOUNCEMENT_SUCCESS" == "true" ]]; then
        echo "  📢 Announcements: ✅ Success"
        ((success_count++))
    else
        echo "  📢 Announcements: ⚠️ Warning"
        ((warning_count++))
    fi
    
    if [[ "$SKIP_NOTIFICATIONS" == "true" ]]; then
        echo "  🔔 Notifications: ⏭️ Skipped"
    elif [[ "$NOTIFICATION_SUCCESS" == "true" ]]; then
        echo "  🔔 Notifications: ✅ Success"
        ((success_count++))
    else
        echo "  🔔 Notifications: ⚠️ Warning"
        ((warning_count++))
    fi
    
    echo ""
    print_status "📈 Summary Statistics:"
    echo "  Version: $final_version"
    echo "  Successful Steps: $success_count"
    echo "  Warnings: $warning_count"
    echo "  Completed: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
    
    echo ""
    
    if [[ "$DRY_RUN" == "true" ]]; then
        print_success "🔍 Dry run completed successfully!"
        echo ""
        print_status "This was a preview of the complete release workflow."
        print_status "Run without --dry-run to execute the actual release."
    else
        if [[ $success_count -ge 3 ]] && [[ $warning_count -le 2 ]]; then
            print_success "🎉 Release orchestration completed successfully!"
            echo ""
            print_status "✅ Proxmox-MPC v$final_version has been released!"
            echo ""
            print_status "🚀 Post-Release Actions:"
            print_status "   1. Monitor GitHub release activity and engagement"
            print_status "   2. Watch npm download statistics and user feedback"
            print_status "   3. Respond to community questions and issues"
            print_status "   4. Plan next development iteration based on feedback"
            echo ""
            print_status "📊 Release Verification:"
            print_status "   - GitHub: https://github.com/proxmox-mpc/proxmox-mpc/releases/tag/v$final_version"
            print_status "   - npm: https://www.npmjs.com/package/proxmox-mpc"
            print_status "   - Installation: npm install -g proxmox-mpc"
        else
            print_warning "⚠️ Release orchestration completed with issues"
            echo ""
            print_status "Some steps encountered problems or were skipped."
            print_status "Review the output above and consider manual intervention."
            echo ""
            print_status "🛠️ Next Steps:"
            print_status "   1. Review failed or warned steps"
            print_status "   2. Complete any manual steps required"
            print_status "   3. Verify release is working as expected"
            print_status "   4. Consider rollback if critical issues exist"
        fi
    fi
}

main() {
    print_header "Proxmox-MPC Release Orchestrator"
    print_status "Master workflow coordinator for complete release automation"
    
    parse_arguments "$@"
    
    cd "$PROJECT_ROOT"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        print_warning "🔍 DRY RUN MODE - No changes will be made"
    fi
    
    # Execute the complete orchestrated workflow
    validate_prerequisites
    show_release_plan
    
    # Execute each workflow step
    execute_preparation
    execute_tagging  
    execute_publishing
    execute_announcements
    execute_notifications
    generate_orchestration_summary
    
    echo ""
    print_header "Release Orchestration Complete"
}

# Execute main function
main "$@"