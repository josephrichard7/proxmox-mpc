#!/bin/bash

# Proxmox-MPC Release Notification System
# Automated release notifications for GitHub releases and npm
# Part of Phase 3: Release Automation Workflows (WORKFLOW-006)

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
NOTIFICATIONS_DIR="${PROJECT_ROOT}/.release-notifications"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration flags
VERSION=""
DRY_RUN=false
CHANNELS="all"
SKIP_GITHUB=false
SKIP_NPM=false
SKIP_SOCIAL=false
AUTO_CONFIRM=false
VERBOSE=false

# Notification configuration
GITHUB_TOKEN=""
NPM_TOKEN=""
DISCORD_WEBHOOK=""
SLACK_WEBHOOK=""

# Notification state
GITHUB_RELEASE_CREATED=false
NPM_NOTIFICATION_SENT=false
NOTIFICATIONS_SENT=0
NOTIFICATION_ERRORS=0

print_header() {
    echo ""
    echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"
    echo ""
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
    ((NOTIFICATION_ERRORS++))
}

show_usage() {
    cat << EOF
Usage: $0 [OPTIONS] [VERSION]

Automated release notification system for Proxmox-MPC

OPTIONS:
    -v, --version VERSION      Version to notify about (auto-detects from package.json)
    -c, --channels CHANNELS    Notification channels: all, github, npm, social, email (default: all)
    -d, --dry-run             Preview notifications without sending
    --skip-github             Skip GitHub release creation
    --skip-npm                Skip npm package announcements  
    --skip-social             Skip social media notifications
    --auto-confirm            Automatically confirm notification actions
    --verbose                 Enable verbose output
    -h, --help                Show this help message

NOTIFICATION CHANNELS:
    - github:   Create GitHub release with release notes
    - npm:      Announce on npm community channels
    - social:   Post to Twitter, LinkedIn, Reddit, Discord, Slack
    - email:    Send newsletter to subscribers (if configured)
    - all:      All channels above

ENVIRONMENT VARIABLES:
    GITHUB_TOKEN              GitHub personal access token (for releases)
    NPM_TOKEN                 npm authentication token (for announcements)
    DISCORD_WEBHOOK_URL       Discord webhook URL for announcements
    SLACK_WEBHOOK_URL         Slack webhook URL for announcements
    TWITTER_API_KEY           Twitter API credentials (if configured)
    LINKEDIN_API_KEY          LinkedIn API credentials (if configured)

EXAMPLES:
    $0                        # Notify all channels about current version
    $0 --version 1.0.0       # Notify about specific version
    $0 --channels github     # Only create GitHub release
    $0 --dry-run --verbose   # Preview all notifications
    $0 --skip-social         # Skip social media posts

GITHUB RELEASE:
    - Creates release from git tag
    - Uploads release notes and artifacts
    - Marks release as latest or pre-release
    - Notifies watchers and subscribers

SOCIAL MEDIA:
    - Twitter/X announcement thread
    - LinkedIn professional update
    - Reddit posts to relevant communities
    - Discord server announcements
    - Slack workspace notifications

EOF
}

parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -v|--version)
                VERSION="$2"
                shift 2
                ;;
            -c|--channels)
                CHANNELS="$2"
                shift 2
                ;;
            -d|--dry-run)
                DRY_RUN=true
                shift
                ;;
            --skip-github)
                SKIP_GITHUB=true
                shift
                ;;
            --skip-npm)
                SKIP_NPM=true
                shift
                ;;
            --skip-social)
                SKIP_SOCIAL=true
                shift
                ;;
            --auto-confirm)
                AUTO_CONFIRM=true
                shift
                ;;
            --verbose)
                VERBOSE=true
                shift
                ;;
            -h|--help)
                show_usage
                exit 0
                ;;
            -*)
                print_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
            *)
                # Positional argument - treat as version
                if [[ -z "$VERSION" ]]; then
                    VERSION="$1"
                else
                    print_error "Too many positional arguments"
                    show_usage
                    exit 1
                fi
                shift
                ;;
        esac
    done
}

validate_environment() {
    print_status "Validating notification environment..."
    
    # Check required tools
    local missing_deps=()
    local required_commands=("git" "node" "jq" "curl")
    
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            missing_deps+=("$cmd")
        fi
    done
    
    if [[ ${#missing_deps[@]} -ne 0 ]]; then
        print_error "Missing required dependencies: ${missing_deps[*]}"
        exit 1
    fi
    
    # Check if we're in a git repository
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        print_error "Not in a git repository"
        exit 1
    fi
    
    # Load environment variables
    GITHUB_TOKEN="${GITHUB_TOKEN:-}"
    NPM_TOKEN="${NPM_TOKEN:-}"
    DISCORD_WEBHOOK="${DISCORD_WEBHOOK_URL:-}"
    SLACK_WEBHOOK="${SLACK_WEBHOOK_URL:-}"
    
    print_success "Environment validated"
}

determine_version() {
    if [[ -z "$VERSION" ]]; then
        if [[ -f "package.json" ]]; then
            VERSION=$(jq -r '.version' package.json)
            print_status "Auto-detected version: $VERSION"
        else
            print_error "package.json not found and no version specified"
            exit 1
        fi
    fi
    
    # Validate semantic versioning
    if ! node -e "const semver=require('semver'); if (!semver.valid('$VERSION')) process.exit(1)" 2>/dev/null; then
        print_error "Invalid semantic version: $VERSION"
        exit 1
    fi
    
    # Check if git tag exists
    if ! git tag | grep -q "^v${VERSION}$"; then
        print_warning "Git tag not found: v${VERSION}"
        print_status "Consider running: git tag v${VERSION}"
    fi
    
    print_success "Version validated: $VERSION"
}

check_notification_prerequisites() {
    print_status "Checking notification prerequisites..."
    
    local prerequisites_met=true
    
    # Check GitHub prerequisites
    if [[ "$CHANNELS" == "all" ]] || [[ "$CHANNELS" == *"github"* ]] && [[ "$SKIP_GITHUB" != "true" ]]; then
        if [[ -z "$GITHUB_TOKEN" ]]; then
            print_warning "GITHUB_TOKEN not set - GitHub release creation will be skipped"
            SKIP_GITHUB=true
        else
            # Verify GitHub token
            if curl -s -H "Authorization: token $GITHUB_TOKEN" https://api.github.com/user | jq -e '.login' &>/dev/null; then
                print_success "GitHub token validated"
            else
                print_error "Invalid GitHub token"
                SKIP_GITHUB=true
            fi
        fi
    fi
    
    # Check npm prerequisites  
    if [[ "$CHANNELS" == "all" ]] || [[ "$CHANNELS" == *"npm"* ]] && [[ "$SKIP_NPM" != "true" ]]; then
        if [[ -z "$NPM_TOKEN" ]]; then
            # Check if npm is authenticated
            if ! npm whoami &>/dev/null; then
                print_warning "npm not authenticated - npm notifications will be limited"
            else
                print_success "npm authentication verified"
            fi
        fi
    fi
    
    # Check social media prerequisites
    if [[ "$CHANNELS" == "all" ]] || [[ "$CHANNELS" == *"social"* ]] && [[ "$SKIP_SOCIAL" != "true" ]]; then
        local social_configured=false
        
        if [[ -n "$DISCORD_WEBHOOK" ]]; then
            social_configured=true
            print_success "Discord webhook configured"
        fi
        
        if [[ -n "$SLACK_WEBHOOK" ]]; then
            social_configured=true
            print_success "Slack webhook configured"
        fi
        
        if [[ "$social_configured" != "true" ]]; then
            print_warning "No social media channels configured"
        fi
    fi
    
    print_success "Prerequisites check completed"
}

create_github_release() {
    if [[ "$SKIP_GITHUB" == "true" ]] || [[ -z "$GITHUB_TOKEN" ]]; then
        print_status "GitHub release creation skipped"
        return 0
    fi
    
    print_status "Creating GitHub release..."
    
    # Check if release already exists
    local release_url="https://api.github.com/repos/proxmox-mpc/proxmox-mpc/releases/tags/v${VERSION}"
    if curl -s -H "Authorization: token $GITHUB_TOKEN" "$release_url" | jq -e '.id' &>/dev/null; then
        print_warning "GitHub release already exists for v${VERSION}"
        GITHUB_RELEASE_CREATED=true
        return 0
    fi
    
    # Prepare release notes
    local release_notes=""
    local release_notes_file="${NOTIFICATIONS_DIR}/github-release-notes.md"
    
    if [[ -f "$release_notes_file" ]]; then
        release_notes=$(cat "$release_notes_file")
    else
        # Generate basic release notes
        release_notes="## Proxmox-MPC v${VERSION}

This release includes various improvements and enhancements to the Proxmox-MPC interactive infrastructure console.

### Installation

\`\`\`bash
npm install -g proxmox-mpc
\`\`\`

### Quick Start

\`\`\`bash
# Launch interactive console
proxmox-mpc

# Initialize project
proxmox-mpc> /init

# Sync infrastructure
proxmox-mpc> /sync
\`\`\`

For full changelog, see [CHANGELOG.md](https://github.com/proxmox-mpc/proxmox-mpc/blob/main/CHANGELOG.md).
"
    fi
    
    # Determine if this is a pre-release
    local is_prerelease=false
    if echo "$VERSION" | grep -qE "(alpha|beta|rc|pre)"; then
        is_prerelease=true
    fi
    
    # Create release payload
    local release_payload=$(jq -n \
        --arg tag "v${VERSION}" \
        --arg name "Proxmox-MPC v${VERSION}" \
        --arg body "$release_notes" \
        --argjson prerelease "$is_prerelease" \
        '{
            tag_name: $tag,
            name: $name,
            body: $body,
            draft: false,
            prerelease: $prerelease
        }')
    
    if [[ "$DRY_RUN" == "true" ]]; then
        print_status "[DRY RUN] Would create GitHub release:"
        echo "$release_payload" | jq .
        return 0
    fi
    
    # Create the release
    local response=$(curl -s -X POST \
        -H "Authorization: token $GITHUB_TOKEN" \
        -H "Accept: application/vnd.github.v3+json" \
        -d "$release_payload" \
        "https://api.github.com/repos/proxmox-mpc/proxmox-mpc/releases")
    
    if echo "$response" | jq -e '.id' &>/dev/null; then
        local release_id=$(echo "$response" | jq -r '.id')
        local html_url=$(echo "$response" | jq -r '.html_url')
        
        GITHUB_RELEASE_CREATED=true
        ((NOTIFICATIONS_SENT++))
        print_success "GitHub release created: $html_url"
        
        # Save release information
        echo "$response" > "${NOTIFICATIONS_DIR}/github-release-response.json"
        
    else
        local error_message=$(echo "$response" | jq -r '.message // "Unknown error"')
        print_error "Failed to create GitHub release: $error_message"
        if [[ "$VERBOSE" == "true" ]]; then
            echo "$response" | jq .
        fi
    fi
}

send_discord_notification() {
    if [[ -z "$DISCORD_WEBHOOK" ]]; then
        return 0
    fi
    
    print_status "Sending Discord notification..."
    
    local embed_color=3447003  # Blue color
    if echo "$VERSION" | grep -qE "(alpha|beta|rc|pre)"; then
        embed_color=15844367  # Gold color for pre-releases
    fi
    
    local discord_payload=$(jq -n \
        --arg version "$VERSION" \
        --arg color "$embed_color" \
        '{
            content: "🚀 **New Release Alert!**",
            embeds: [{
                title: "Proxmox-MPC v" + $version,
                description: "Interactive Infrastructure-as-Code Console for Proxmox VE",
                color: ($color | tonumber),
                fields: [
                    {
                        name: "📦 Installation",
                        value: "`npm install -g proxmox-mpc`",
                        inline: false
                    },
                    {
                        name: "🚀 Quick Start", 
                        value: "`proxmox-mpc`\n`/init`\n`/sync`",
                        inline: true
                    },
                    {
                        name: "🔗 Links",
                        value: "[GitHub](https://github.com/proxmox-mpc/proxmox-mpc) • [npm](https://www.npmjs.com/package/proxmox-mpc) • [Docs](https://proxmox-mpc.dev)",
                        inline: true
                    }
                ],
                footer: {
                    text: "Proxmox-MPC Release Bot"
                },
                timestamp: "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"
            }]
        }')
    
    if [[ "$DRY_RUN" == "true" ]]; then
        print_status "[DRY RUN] Would send Discord notification:"
        echo "$discord_payload" | jq .
        return 0
    fi
    
    local response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d "$discord_payload" \
        "$DISCORD_WEBHOOK")
    
    if [[ -z "$response" ]] || [[ "$response" == "ok" ]]; then
        ((NOTIFICATIONS_SENT++))
        print_success "Discord notification sent"
    else
        print_error "Failed to send Discord notification: $response"
    fi
}

send_slack_notification() {
    if [[ -z "$SLACK_WEBHOOK" ]]; then
        return 0
    fi
    
    print_status "Sending Slack notification..."
    
    local slack_payload=$(jq -n \
        --arg version "$VERSION" \
        '{
            text: "🚀 Proxmox-MPC v" + $version + " Released!",
            blocks: [
                {
                    type: "header",
                    text: {
                        type: "plain_text",
                        text: "🚀 Proxmox-MPC v" + $version + " Released!"
                    }
                },
                {
                    type: "section",
                    text: {
                        type: "mrkdwn",
                        text: "*Interactive Infrastructure-as-Code Console for Proxmox VE*\n\nA new version of Proxmox-MPC has been released with improvements and new features!"
                    }
                },
                {
                    type: "section",
                    fields: [
                        {
                            type: "mrkdwn",
                            text: "*📦 Installation:*\n`npm install -g proxmox-mpc`"
                        },
                        {
                            type: "mrkdwn", 
                            text: "*🚀 Quick Start:*\n`proxmox-mpc`\n`/init`\n`/sync`"
                        }
                    ]
                },
                {
                    type: "actions",
                    elements: [
                        {
                            type: "button",
                            text: {
                                type: "plain_text",
                                text: "View on GitHub"
                            },
                            url: "https://github.com/proxmox-mpc/proxmox-mpc"
                        },
                        {
                            type: "button",
                            text: {
                                type: "plain_text", 
                                text: "npm Package"
                            },
                            url: "https://www.npmjs.com/package/proxmox-mpc"
                        },
                        {
                            type: "button",
                            text: {
                                type: "plain_text",
                                text: "Documentation"
                            },
                            url: "https://proxmox-mpc.dev"
                        }
                    ]
                }
            ]
        }')
    
    if [[ "$DRY_RUN" == "true" ]]; then
        print_status "[DRY RUN] Would send Slack notification:"
        echo "$slack_payload" | jq .
        return 0
    fi
    
    local response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d "$slack_payload" \
        "$SLACK_WEBHOOK")
    
    if echo "$response" | grep -q '"ok":true'; then
        ((NOTIFICATIONS_SENT++))
        print_success "Slack notification sent"
    else
        local error=$(echo "$response" | jq -r '.error // "Unknown error"')
        print_error "Failed to send Slack notification: $error"
    fi
}

create_social_media_posts() {
    if [[ "$SKIP_SOCIAL" == "true" ]]; then
        print_status "Social media notifications skipped"
        return 0
    fi
    
    print_status "Creating social media posts..."
    
    mkdir -p "$NOTIFICATIONS_DIR"
    local social_posts_file="${NOTIFICATIONS_DIR}/social-posts-ready-${VERSION}.md"
    
    cat > "$social_posts_file" << EOF
# Social Media Posts for Proxmox-MPC v${VERSION}

**Status**: Ready to post  
**Generated**: $(date -u '+%Y-%m-%d %H:%M:%S UTC')

## Twitter/X Posts

### Main Announcement
🚀 **Proxmox-MPC v${VERSION} is live!**

Interactive Infrastructure-as-Code console for Proxmox VE - like Claude Code but for your infrastructure!

✨ Auto-generates Terraform + Ansible configs  
🔄 Bidirectional server sync  
🧪 Test-driven deployments

\`npm install -g proxmox-mpc\`

#ProxmoxMPC #IaC #DevOps

### Follow-up Tweet
💡 **Getting started is easy:**

1️⃣ \`proxmox-mpc\`
2️⃣ \`/init\` (configure server)  
3️⃣ \`/sync\` (import infrastructure)
4️⃣ Magic! ✨

Your VMs become version-controlled Terraform configs automatically.

Perfect for homelab enthusiasts and enterprise teams! 

#Homelab #Terraform

## LinkedIn Post

🎉 **Exciting Release: Proxmox-MPC v${VERSION}**

I'm thrilled to share the latest version of Proxmox-MPC, an innovative interactive Infrastructure-as-Code console designed for Proxmox Virtual Environment.

**What makes this special:**
✅ Interactive console experience (like modern dev tools)
✅ Automatic Terraform and Ansible configuration generation
✅ Test-driven infrastructure deployment  
✅ Project-based workspace management
✅ Bidirectional state synchronization

**Perfect for:**
- DevOps engineers managing Proxmox clusters
- Homelab enthusiasts wanting professional workflows
- Teams seeking consistent infrastructure deployment

The future of infrastructure management is interactive and automated! 🚀

**Try it:** \`npm install -g proxmox-mpc\`

#DevOps #InfrastructureAsCode #Proxmox #Automation

## Reddit Posts

### r/homelab
**[Release] Proxmox-MPC v${VERSION} - Interactive IaC Console**

Hey r/homelab! 👋

New release of Proxmox-MPC - an interactive console for managing Proxmox infrastructure with Infrastructure-as-Code principles.

**TL;DR**: Think Claude Code for your Proxmox cluster.

**Cool features:**
- Interactive console with slash commands (\`/init\`, \`/sync\`, \`/apply\`)
- Auto-generates Terraform configs from existing VMs/containers  
- Project-based workspaces for different environments
- Test-driven deployments (tests generated before applying)
- Perfect for homelab documentation and reproducibility

**Quick start:**
\`\`\`bash
npm install -g proxmox-mpc
proxmox-mpc
/init  # configure connection
/sync  # import existing → generates terraform/
\`\`\`

Great for making your homelab infrastructure reproducible and version-controlled!

GitHub: https://github.com/proxmox-mpc/proxmox-mpc

### r/selfhosted  
**Proxmox-MPC v${VERSION}: Infrastructure Management for Self-Hosters**

For those running Proxmox in self-hosted setups, this might be useful!

Proxmox-MPC brings modern Infrastructure-as-Code practices to Proxmox management with an interactive console approach.

**Benefits for self-hosters:**
- 📋 **Documentation**: Infrastructure becomes self-documenting
- 🔄 **Reproducibility**: Recreate setups anywhere
- 🧪 **Safety**: Test changes before applying
- 📁 **Organization**: Project-based management
- 🚀 **Efficiency**: Less UI clicking, more automation

Installation: \`npm install -g proxmox-mpc\`

Currently in active development - feedback welcome!

## Instructions

1. **Copy and paste** the appropriate posts to each platform
2. **Customize timing** - spread posts over 24-48 hours  
3. **Engage with responses** - reply to comments and questions
4. **Monitor reach** - track engagement and adjust messaging

## Platform-Specific Notes

- **Twitter**: Use hashtags sparingly, focus on engagement
- **LinkedIn**: Professional tone, emphasize business value
- **Reddit**: Community-focused, provide value to each subreddit
- **Discord/Slack**: Already automated via webhooks

---
*Generated by Proxmox-MPC Release Notification System*
EOF
    
    if [[ "$DRY_RUN" != "true" ]]; then
        print_success "Social media posts ready: $(basename "$social_posts_file")"
    else
        print_status "[DRY RUN] Would create: $(basename "$social_posts_file")"
    fi
}

send_npm_announcement() {
    if [[ "$SKIP_NPM" == "true" ]]; then
        print_status "npm announcements skipped"
        return 0
    fi
    
    print_status "Preparing npm announcements..."
    
    # Create npm announcement content
    mkdir -p "$NOTIFICATIONS_DIR"
    local npm_announcement_file="${NOTIFICATIONS_DIR}/npm-announcement-${VERSION}.md"
    
    cat > "$npm_announcement_file" << EOF
# npm Package Announcement: Proxmox-MPC v${VERSION}

**Package**: proxmox-mpc  
**Version**: ${VERSION}  
**Published**: $(date '+%Y-%m-%d')

## Installation

\`\`\`bash
npm install -g proxmox-mpc
\`\`\`

## What's New

This release brings enhanced functionality to the interactive Infrastructure-as-Code console for Proxmox VE.

## Quick Start

\`\`\`bash
# Launch interactive console
proxmox-mpc

# Initialize project workspace
proxmox-mpc> /init

# Sync existing infrastructure
proxmox-mpc> /sync

# Create new resources
proxmox-mpc> create vm --name web-server
\`\`\`

## Resources

- **Homepage**: https://proxmox-mpc.dev
- **GitHub**: https://github.com/proxmox-mpc/proxmox-mpc
- **Documentation**: https://proxmox-mpc.dev/docs
- **Issues**: https://github.com/proxmox-mpc/proxmox-mpc/issues

## Community

Join our growing community of infrastructure enthusiasts and DevOps professionals using Proxmox-MPC for modern infrastructure management.

---

**Ready to get started?** \`npm install -g proxmox-mpc\`
EOF
    
    if [[ "$DRY_RUN" != "true" ]]; then
        print_success "npm announcement prepared: $(basename "$npm_announcement_file")"
        NPM_NOTIFICATION_SENT=true
        ((NOTIFICATIONS_SENT++))
    else
        print_status "[DRY RUN] Would create: $(basename "$npm_announcement_file")"
    fi
}

generate_notification_report() {
    local report_file="${NOTIFICATIONS_DIR}/notification-report-${VERSION}.md"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        print_status "[DRY RUN] Would generate notification report"
        return 0
    fi
    
    mkdir -p "$NOTIFICATIONS_DIR"
    
    cat > "$report_file" << EOF
# Release Notification Report

**Version**: $VERSION  
**Notification Date**: $(date -u '+%Y-%m-%d %H:%M:%S UTC')  
**Channels**: $CHANNELS  

## Notification Summary

- **Total Sent**: $NOTIFICATIONS_SENT
- **Errors**: $NOTIFICATION_ERRORS
- **Channels Configured**: $(echo "$CHANNELS" | tr ',' '\n' | wc -l)

## Channel Status

### GitHub Release
- **Status**: $(if [[ "$GITHUB_RELEASE_CREATED" == "true" ]]; then echo "✅ Created"; elif [[ "$SKIP_GITHUB" == "true" ]]; then echo "⏭️ Skipped"; else echo "❌ Failed"; fi)
- **URL**: $(if [[ "$GITHUB_RELEASE_CREATED" == "true" ]]; then echo "https://github.com/proxmox-mpc/proxmox-mpc/releases/tag/v${VERSION}"; else echo "N/A"; fi)

### npm Announcements  
- **Status**: $(if [[ "$NPM_NOTIFICATION_SENT" == "true" ]]; then echo "✅ Prepared"; elif [[ "$SKIP_NPM" == "true" ]]; then echo "⏭️ Skipped"; else echo "❌ Failed"; fi)
- **Package URL**: https://www.npmjs.com/package/proxmox-mpc

### Social Media
- **Discord**: $(if [[ -n "$DISCORD_WEBHOOK" ]] && [[ "$SKIP_SOCIAL" != "true" ]]; then echo "✅ Sent"; else echo "⏭️ Not configured"; fi)
- **Slack**: $(if [[ -n "$SLACK_WEBHOOK" ]] && [[ "$SKIP_SOCIAL" != "true" ]]; then echo "✅ Sent"; else echo "⏭️ Not configured"; fi)
- **Posts Ready**: $(if [[ "$SKIP_SOCIAL" != "true" ]]; then echo "✅ Generated"; else echo "⏭️ Skipped"; fi)

## Generated Files

EOF
    
    # List generated files
    if [[ -d "$NOTIFICATIONS_DIR" ]]; then
        find "$NOTIFICATIONS_DIR" -name "*${VERSION}*" -type f | while read -r file; do
            echo "- $(basename "$file")" >> "$report_file"
        done
    fi
    
    cat >> "$report_file" << EOF

## Next Steps

1. **Manual Actions Required**:
EOF
    
    if [[ "$GITHUB_RELEASE_CREATED" != "true" ]] && [[ "$SKIP_GITHUB" != "true" ]]; then
        echo "   - Create GitHub release manually" >> "$report_file"
    fi
    
    if [[ "$SKIP_SOCIAL" != "true" ]]; then
        echo "   - Post social media content from generated files" >> "$report_file"
    fi
    
    cat >> "$report_file" << EOF

2. **Monitor and Engage**:
   - Watch for GitHub release notifications
   - Respond to social media engagement
   - Monitor npm download statistics
   - Address any user feedback or issues

3. **Follow-up Actions**:
   - Update project documentation if needed
   - Plan next release based on feedback
   - Analyze notification reach and effectiveness

---

*Generated by Proxmox-MPC Release Notification System*
EOF
    
    print_success "Notification report generated: $(basename "$report_file")"
}

main() {
    print_header "Proxmox-MPC Release Notification System"
    
    parse_arguments "$@"
    
    cd "$PROJECT_ROOT"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        print_warning "DRY RUN MODE - No notifications will be sent"
    fi
    
    print_status "Notification configuration:"
    print_status "  Version: $VERSION (auto-detect if empty)"
    print_status "  Channels: $CHANNELS"
    print_status "  GitHub: $(if [[ "$SKIP_GITHUB" == "true" ]]; then echo "Disabled"; else echo "Enabled"; fi)"
    print_status "  npm: $(if [[ "$SKIP_NPM" == "true" ]]; then echo "Disabled"; else echo "Enabled"; fi)"
    print_status "  Social: $(if [[ "$SKIP_SOCIAL" == "true" ]]; then echo "Disabled"; else echo "Enabled"; fi)"
    
    # Create notifications directory
    mkdir -p "$NOTIFICATIONS_DIR"
    
    # Execute notification workflow
    validate_environment
    determine_version
    check_notification_prerequisites
    
    # Send notifications based on channels
    local channels_to_notify=()
    
    if [[ "$CHANNELS" == "all" ]]; then
        channels_to_notify=("github" "npm" "social")
    else
        IFS=',' read -ra channels_to_notify <<< "$CHANNELS"
    fi
    
    for channel in "${channels_to_notify[@]}"; do
        case "$channel" in
            "github")
                if [[ "$SKIP_GITHUB" != "true" ]]; then
                    create_github_release
                fi
                ;;
            "npm")
                if [[ "$SKIP_NPM" != "true" ]]; then
                    send_npm_announcement
                fi
                ;;
            "social")
                if [[ "$SKIP_SOCIAL" != "true" ]]; then
                    send_discord_notification
                    send_slack_notification
                    create_social_media_posts
                fi
                ;;
            *)
                print_warning "Unknown notification channel: $channel"
                ;;
        esac
    done
    
    generate_notification_report
    
    # Final summary
    print_header "Notification Summary"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        print_success "🔍 Notification preview completed!"
        print_status "Run without --dry-run to send actual notifications"
    else
        if [[ $NOTIFICATION_ERRORS -eq 0 ]]; then
            print_success "📢 Release notifications completed successfully!"
            echo ""
            print_status "✅ Version: $VERSION"
            print_status "📤 Notifications sent: $NOTIFICATIONS_SENT"
            print_status "📁 Output directory: $NOTIFICATIONS_DIR"
            echo ""
            
            if [[ "$GITHUB_RELEASE_CREATED" == "true" ]]; then
                print_status "🎯 GitHub release: https://github.com/proxmox-mpc/proxmox-mpc/releases/tag/v${VERSION}"
            fi
            
            if [[ "$SKIP_SOCIAL" != "true" ]]; then
                print_status "📱 Social media posts ready for manual posting"
            fi
            
            echo ""
            print_status "🚀 Next steps:"
            print_status "   1. Monitor GitHub release activity"
            print_status "   2. Post social media content (if not automated)"
            print_status "   3. Engage with community responses"
            print_status "   4. Track download and adoption metrics"
        else
            print_warning "📢 Notifications completed with some errors"
            echo ""
            print_status "✅ Successful: $NOTIFICATIONS_SENT"
            print_status "❌ Errors: $NOTIFICATION_ERRORS"
            echo ""
            print_status "Check logs above for error details"
        fi
    fi
    
    echo ""
}

# Execute main function
main "$@"