#!/bin/bash

# Proxmox-MPC Release Announcement Generation Script
# Automated release announcement generation with formatted release notes
# Part of Phase 3: Release Automation Workflows (WORKFLOW-004)

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
OUTPUT_DIR="${PROJECT_ROOT}/.release-announcements"

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
FORMAT="all"
TEMPLATE="default"
VERBOSE=false
INCLUDE_STATS=true
INCLUDE_SCREENSHOTS=false

# Release data
RELEASE_DATE=""
COMMIT_COUNT=0
CONTRIBUTORS_COUNT=0
CHANGES_SUMMARY=""

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
}

show_usage() {
    cat << EOF
Usage: $0 [OPTIONS] [VERSION]

Automated release announcement generation for Proxmox-MPC

OPTIONS:
    -v, --version VERSION   Version to generate announcement for (auto-detects from package.json)
    -f, --format FORMAT     Output format: all, github, npm, email, social, blog (default: all)
    -t, --template TEMPLATE Template style: default, technical, marketing, brief (default: default)
    -d, --dry-run          Preview announcements without saving files
    --include-stats        Include project statistics (default: true)
    --include-screenshots  Include screenshots and visuals
    --verbose              Enable verbose output
    -h, --help             Show this help message

OUTPUT FORMATS:
    - github:    GitHub release notes with markdown formatting
    - npm:       npm package announcement with installation instructions
    - email:     Email newsletter format with HTML/text versions
    - social:    Social media posts (Twitter, LinkedIn, etc.)
    - blog:      Blog post format with detailed technical content
    - all:       Generate all formats above

TEMPLATES:
    - default:   Balanced technical and user-focused content
    - technical: In-depth technical details for developers
    - marketing: User-focused benefits and features
    - brief:     Concise summaries for social media

EXAMPLES:
    $0                          # Generate all formats for current version
    $0 --version 1.0.0         # Generate announcements for v1.0.0
    $0 --format github -v      # Generate GitHub release notes with verbose output
    $0 --template marketing    # Use marketing-focused template
    $0 --dry-run --verbose     # Preview all announcements

GENERATED FILES:
    - github-release-notes.md
    - npm-package-announcement.md
    - email-newsletter.html
    - email-newsletter.txt
    - social-media-posts.md
    - blog-post.md

EOF
}

parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -v|--version)
                VERSION="$2"
                shift 2
                ;;
            -f|--format)
                FORMAT="$2"
                shift 2
                ;;
            -t|--template)
                TEMPLATE="$2"
                shift 2
                ;;
            -d|--dry-run)
                DRY_RUN=true
                shift
                ;;
            --include-stats)
                INCLUDE_STATS=true
                shift
                ;;
            --no-stats)
                INCLUDE_STATS=false
                shift
                ;;
            --include-screenshots)
                INCLUDE_SCREENSHOTS=true
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
    print_status "Validating environment..."
    
    # Check required tools
    local missing_deps=()
    local required_commands=("git" "node" "jq")
    
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
    
    # Check if package.json exists
    if [[ ! -f "package.json" ]]; then
        print_error "package.json not found"
        exit 1
    fi
    
    print_success "Environment validated"
}

determine_version() {
    if [[ -z "$VERSION" ]]; then
        VERSION=$(jq -r '.version' package.json)
        print_status "Auto-detected version: $VERSION"
    fi
    
    # Validate semantic versioning
    if ! node -e "const semver=require('semver'); if (!semver.valid('$VERSION')) process.exit(1)" 2>/dev/null; then
        print_error "Invalid semantic version: $VERSION"
        exit 1
    fi
    
    print_success "Version validated: $VERSION"
}

collect_release_data() {
    print_status "Collecting release data..."
    
    RELEASE_DATE=$(date '+%Y-%m-%d')
    
    # Get commit count since last tag
    local last_tag=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
    
    if [[ -n "$last_tag" ]]; then
        COMMIT_COUNT=$(git rev-list --count "${last_tag}..HEAD")
        print_status "Commits since $last_tag: $COMMIT_COUNT"
    else
        COMMIT_COUNT=$(git rev-list --count HEAD)
        print_status "Total commits: $COMMIT_COUNT"
    fi
    
    # Get contributor count
    if [[ -n "$last_tag" ]]; then
        CONTRIBUTORS_COUNT=$(git log "${last_tag}..HEAD" --format='%an' | sort -u | wc -l)
    else
        CONTRIBUTORS_COUNT=$(git log --format='%an' | sort -u | wc -l)
    fi
    
    print_status "Contributors: $CONTRIBUTORS_COUNT"
    
    # Generate changes summary from CHANGELOG.md
    if [[ -f "CHANGELOG.md" ]]; then
        CHANGES_SUMMARY=$(awk "/## \[${VERSION}\]/{flag=1; next} flag && /## \[.*\]/{flag=0} flag" CHANGELOG.md 2>/dev/null | head -20)
        if [[ -n "$CHANGES_SUMMARY" ]]; then
            print_success "Changes summary extracted from CHANGELOG.md"
        else
            print_warning "No changelog entry found for version $VERSION"
        fi
    else
        print_warning "CHANGELOG.md not found"
    fi
    
    print_success "Release data collected"
}

analyze_commit_changes() {
    print_status "Analyzing commit changes..."
    
    local since_ref=""
    local last_tag=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
    
    if [[ -n "$last_tag" ]]; then
        since_ref="$last_tag"
    else
        since_ref="$(git rev-list --max-parents=0 HEAD)"
    fi
    
    # Analyze commit types
    local features=$(git log --grep="^feat" --oneline --since="$since_ref" | wc -l)
    local fixes=$(git log --grep="^fix" --oneline --since="$since_ref" | wc -l)
    local docs=$(git log --grep="^docs" --oneline --since="$since_ref" | wc -l)
    local chores=$(git log --grep="^chore" --oneline --since="$since_ref" | wc -l)
    local refactors=$(git log --grep="^refactor" --oneline --since="$since_ref" | wc -l)
    local tests=$(git log --grep="^test" --oneline --since="$since_ref" | wc -l)
    local breaking=$(git log --grep="BREAKING CHANGE" --oneline --since="$since_ref" | wc -l)
    
    # Store in variables for use in templates
    export FEAT_COUNT=$features
    export FIX_COUNT=$fixes
    export DOCS_COUNT=$docs
    export CHORE_COUNT=$chores
    export REFACTOR_COUNT=$refactors
    export TEST_COUNT=$tests
    export BREAKING_COUNT=$breaking
    
    if [[ "$VERBOSE" == "true" ]]; then
        print_status "Commit analysis:"
        echo "  Features: $features"
        echo "  Bug fixes: $fixes"
        echo "  Documentation: $docs"
        echo "  Maintenance: $chores"
        echo "  Refactoring: $refactors"
        echo "  Tests: $tests"
        echo "  Breaking changes: $breaking"
    fi
}

get_project_stats() {
    if [[ "$INCLUDE_STATS" != "true" ]]; then
        return 0
    fi
    
    print_status "Gathering project statistics..."
    
    # Count lines of code (excluding node_modules and dist)
    local total_lines=$(find src -name "*.ts" -o -name "*.js" | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}' || echo "0")
    
    # Count test files
    local test_files=$(find src -name "*.test.ts" -o -name "*.test.js" | wc -l)
    
    # Get package dependencies count
    local dependencies=$(jq -r '.dependencies // {} | keys | length' package.json)
    local dev_dependencies=$(jq -r '.devDependencies // {} | keys | length' package.json)
    
    # Export for use in templates
    export TOTAL_LINES=$total_lines
    export TEST_FILES=$test_files
    export DEPENDENCIES=$dependencies
    export DEV_DEPENDENCIES=$dev_dependencies
    
    if [[ "$VERBOSE" == "true" ]]; then
        print_status "Project statistics:"
        echo "  Lines of code: $total_lines"
        echo "  Test files: $test_files"
        echo "  Dependencies: $dependencies"
        echo "  Dev dependencies: $dev_dependencies"
    fi
}

generate_github_release_notes() {
    local output_file="${OUTPUT_DIR}/github-release-notes.md"
    
    print_status "Generating GitHub release notes..."
    
    cat > "$output_file" << EOF
# 🚀 Proxmox-MPC v${VERSION}

**Release Date**: $RELEASE_DATE  
**Download**: [proxmox-mpc-${VERSION}.tgz](https://registry.npmjs.org/proxmox-mpc/-/proxmox-mpc-${VERSION}.tgz)

## 📋 What's New

EOF
    
    if [[ -n "$CHANGES_SUMMARY" ]]; then
        echo "$CHANGES_SUMMARY" >> "$output_file"
    else
        cat >> "$output_file" << EOF
This release includes various improvements and enhancements to the Proxmox-MPC interactive infrastructure console.

### 🎯 Highlights

- Enhanced interactive console experience
- Improved VM and container management
- Better error handling and diagnostics
- Updated documentation and examples

EOF
    fi
    
    if [[ $FEAT_COUNT -gt 0 ]] || [[ $FIX_COUNT -gt 0 ]] || [[ $BREAKING_COUNT -gt 0 ]]; then
        cat >> "$output_file" << EOF

## 📊 Change Summary

EOF
        
        if [[ $BREAKING_COUNT -gt 0 ]]; then
            echo "- 🚨 **Breaking Changes**: $BREAKING_COUNT" >> "$output_file"
        fi
        if [[ $FEAT_COUNT -gt 0 ]]; then
            echo "- ✨ **New Features**: $FEAT_COUNT" >> "$output_file"
        fi
        if [[ $FIX_COUNT -gt 0 ]]; then
            echo "- 🐛 **Bug Fixes**: $FIX_COUNT" >> "$output_file"
        fi
        if [[ $REFACTOR_COUNT -gt 0 ]]; then
            echo "- ♻️  **Refactoring**: $REFACTOR_COUNT" >> "$output_file"
        fi
        if [[ $DOCS_COUNT -gt 0 ]]; then
            echo "- 📝 **Documentation**: $DOCS_COUNT" >> "$output_file"
        fi
        if [[ $TEST_COUNT -gt 0 ]]; then
            echo "- 🧪 **Tests**: $TEST_COUNT" >> "$output_file"
        fi
        if [[ $CHORE_COUNT -gt 0 ]]; then
            echo "- 🔧 **Maintenance**: $CHORE_COUNT" >> "$output_file"
        fi
    fi
    
    cat >> "$output_file" << EOF

## 🛠️ Installation

### npm Installation
\`\`\`bash
npm install -g proxmox-mpc
\`\`\`

### Direct Download
\`\`\`bash
curl -O https://registry.npmjs.org/proxmox-mpc/-/proxmox-mpc-${VERSION}.tgz
tar -xzf proxmox-mpc-${VERSION}.tgz
\`\`\`

## 🚀 Quick Start

\`\`\`bash
# Launch interactive console
proxmox-mpc

# Initialize new project
proxmox-mpc> /init

# Show help
proxmox-mpc> /help
\`\`\`

## 📖 Documentation

- [Installation Guide](https://proxmox-mpc.dev/getting-started/installation/)
- [User Guide](https://proxmox-mpc.dev/user-guide/)
- [API Reference](https://proxmox-mpc.dev/reference/)
- [Examples](https://proxmox-mpc.dev/tutorials/)

## 🔍 Verification

This release is signed with GPG. Verify the signature:
\`\`\`bash
git verify-tag v${VERSION}
\`\`\`

**SHA256 Checksums**: Available in the release assets

## 🤝 Contributing

We welcome contributions! See our [Contributing Guide](https://github.com/proxmox-mpc/proxmox-mpc/blob/main/CONTRIBUTING.md) for details.

## 📄 Full Changelog

**Full Changelog**: https://github.com/proxmox-mpc/proxmox-mpc/blob/main/CHANGELOG.md#${VERSION}

---

**Questions or Issues?** Open an issue on [GitHub](https://github.com/proxmox-mpc/proxmox-mpc/issues) or join our [Discord](https://discord.gg/proxmox-mpc).
EOF
    
    print_success "GitHub release notes generated: $(basename "$output_file")"
}

generate_npm_announcement() {
    local output_file="${OUTPUT_DIR}/npm-package-announcement.md"
    
    print_status "Generating npm package announcement..."
    
    cat > "$output_file" << EOF
# 📦 Proxmox-MPC v${VERSION} Published

**Interactive Infrastructure-as-Code Console for Proxmox VE**

We're excited to announce the release of **Proxmox-MPC v${VERSION}**! This release brings enhanced functionality and improved user experience to infrastructure management.

## 🎯 What is Proxmox-MPC?

Proxmox-MPC is an interactive console similar to Claude Code that provides:
- 🖥️  **Interactive Console**: Claude Code-like experience for infrastructure management
- 📁 **Project Workspaces**: Organize infrastructure by project
- ⚙️  **Automatic IaC Generation**: Creates Terraform + Ansible configs
- 🧪 **Test-Driven Infrastructure**: Generate and run tests before deployment
- 🔄 **State Synchronization**: Bidirectional sync between server and local database

## 📋 What's New in v${VERSION}

EOF
    
    if [[ -n "$CHANGES_SUMMARY" ]]; then
        echo "$CHANGES_SUMMARY" >> "$output_file"
    else
        echo "This release includes various improvements and enhancements." >> "$output_file"
    fi
    
    cat >> "$output_file" << EOF

## 🚀 Quick Installation

\`\`\`bash
# Install globally
npm install -g proxmox-mpc

# Or install locally
npm install proxmox-mpc
\`\`\`

## 🏃‍♂️ Getting Started

\`\`\`bash
# Launch interactive console
proxmox-mpc

# Initialize new project
proxmox-mpc> /init

# Sync existing infrastructure
proxmox-mpc> /sync

# Create new VM
proxmox-mpc> create vm --name web-server
\`\`\`

## 💡 Example Workflow

\`\`\`bash
# 1. Create project directory
mkdir my-datacenter && cd my-datacenter

# 2. Launch console
proxmox-mpc

# 3. Initialize workspace with server details
proxmox-mpc> /init

# 4. Import existing infrastructure
proxmox-mpc> /sync
# → Generates terraform/ and ansible/ configurations

# 5. Test and deploy changes
proxmox-mpc> /test
proxmox-mpc> /apply
\`\`\`

EOF
    
    if [[ "$INCLUDE_STATS" == "true" ]]; then
        cat >> "$output_file" << EOF
## 📊 Project Stats

- 📝 **Lines of Code**: ${TOTAL_LINES:-"N/A"}
- 🧪 **Test Files**: ${TEST_FILES:-"0"}
- 📦 **Dependencies**: ${DEPENDENCIES:-"0"}
- 👥 **Contributors**: $CONTRIBUTORS_COUNT
- 🔀 **Commits**: $COMMIT_COUNT (since last release)

EOF
    fi
    
    cat >> "$output_file" << EOF
## 🔗 Resources

- **Homepage**: https://proxmox-mpc.dev
- **Documentation**: https://proxmox-mpc.dev/docs
- **GitHub**: https://github.com/proxmox-mpc/proxmox-mpc
- **npm Package**: https://www.npmjs.com/package/proxmox-mpc
- **Issues**: https://github.com/proxmox-mpc/proxmox-mpc/issues

## 🏷️ Package Information

- **Version**: ${VERSION}
- **License**: MIT
- **Node.js**: >=18.0.0
- **npm**: >=8.0.0

## 🤝 Support

If you find this useful, consider:
- ⭐ Starring the [GitHub repository](https://github.com/proxmox-mpc/proxmox-mpc)
- 🐛 Reporting issues or suggesting features
- 🤝 Contributing to the project
- 💬 Joining our community discussions

---

**Happy Infrastructure Management!** 🚀
EOF
    
    print_success "npm announcement generated: $(basename "$output_file")"
}

generate_social_media_posts() {
    local output_file="${OUTPUT_DIR}/social-media-posts.md"
    
    print_status "Generating social media posts..."
    
    cat > "$output_file" << EOF
# Social Media Posts for Proxmox-MPC v${VERSION}

## Twitter/X Posts

### Main Announcement
🚀 **Proxmox-MPC v${VERSION} is live!** 

Interactive Infrastructure-as-Code console for Proxmox VE - like Claude Code but for your infrastructure! 

✨ Auto-generates Terraform + Ansible configs
🔄 Bidirectional server sync  
🧪 Test-driven deployments

\`npm install -g proxmox-mpc\`

#ProxmoxMPC #IaC #DevOps #Infrastructure

### Feature Highlight
💡 **Did you know?** Proxmox-MPC v${VERSION} can automatically discover your existing Proxmox infrastructure and generate Terraform configurations!

Just run:
\`proxmox-mpc\`
\`/sync\`

And watch the magic happen! ✨

#ProxmoxMPC #Terraform #AutomationWins

### Technical Details
🔧 **Technical Update**: Proxmox-MPC v${VERSION} includes:
EOF
    
    if [[ $FEAT_COUNT -gt 0 ]]; then
        echo "- ✨ $FEAT_COUNT new features" >> "$output_file"
    fi
    if [[ $FIX_COUNT -gt 0 ]]; then
        echo "- 🐛 $FIX_COUNT bug fixes" >> "$output_file"
    fi
    if [[ $REFACTOR_COUNT -gt 0 ]]; then
        echo "- ♻️ $REFACTOR_COUNT improvements" >> "$output_file"
    fi
    
    cat >> "$output_file" << EOF

Perfect for homelab enthusiasts and enterprise teams alike!

Get it: \`npm install -g proxmox-mpc\`

## LinkedIn Posts

### Professional Announcement
🎉 **Exciting News: Proxmox-MPC v${VERSION} Released!**

I'm thrilled to announce the latest version of Proxmox-MPC, an interactive Infrastructure-as-Code console designed specifically for Proxmox Virtual Environment.

**What makes this special:**
✅ Interactive console experience similar to modern development tools
✅ Automatic Terraform and Ansible configuration generation  
✅ Test-driven infrastructure deployment
✅ Project-based workspace management
✅ Bidirectional state synchronization

**Perfect for:**
- DevOps engineers managing Proxmox clusters
- Homelab enthusiasts wanting professional IaC workflows  
- Teams seeking consistent infrastructure deployment
- Anyone tired of manual VM/container management

**Getting Started:**
\`npm install -g proxmox-mpc\`

The future of infrastructure management is interactive, automated, and developer-friendly. 

#DevOps #InfrastructureAsCode #Proxmox #Automation #OpenSource

### Technical Deep Dive
**Technical Spotlight: Infrastructure State Synchronization 🔄**

One of the most challenging aspects of Infrastructure-as-Code is maintaining consistency between your declared state (Terraform) and actual infrastructure.

Proxmox-MPC v${VERSION} solves this with bidirectional synchronization:

1️⃣ **Discovery**: Scans existing Proxmox infrastructure
2️⃣ **Generation**: Creates Terraform configurations automatically  
3️⃣ **Validation**: Tests configurations before deployment
4️⃣ **Deployment**: Applies changes safely with rollback capability
5️⃣ **Monitoring**: Continuously tracks drift and changes

This approach bridges the gap between existing infrastructure and modern IaC practices.

**Architecture highlights:**
- SQLite-based local state management
- Prisma ORM for type-safe database operations
- Comprehensive testing with Jest
- TypeScript throughout for reliability

Try it today: \`npm install -g proxmox-mpc\`

#InfrastructureAsCode #DevOps #Terraform #TypeScript #ProxmoxVE

## Reddit Posts

### r/homelab
**[Release] Proxmox-MPC v${VERSION} - Interactive IaC Console for Proxmox**

Hey r/homelab! 👋

Just released v${VERSION} of Proxmox-MPC - an interactive console for managing Proxmox infrastructure with Infrastructure-as-Code principles.

**TL;DR**: It's like having Claude Code for your Proxmox cluster. Type commands, get Terraform configs automatically generated.

**What's cool about it:**
- Interactive console (\`proxmox-mpc\`) with slash commands like \`/init\`, \`/sync\`, \`/apply\`
- Discovers your existing VMs/containers and generates Terraform configs
- Project-based workspaces for different environments  
- Test-driven deployments (generates tests before applying)
- Works great for homelab documentation and reproducibility

**Example workflow:**
\`\`\`bash
mkdir homelab-prod && cd homelab-prod
proxmox-mpc
/init  # Configure Proxmox connection
/sync  # Import existing infrastructure → generates terraform/
create vm --name pihole --memory 2048  # Add new VM
/test  # Validate changes
/apply # Deploy to Proxmox
\`\`\`

Installation: \`npm install -g proxmox-mpc\`

Perfect if you want to:
- Document your homelab infrastructure as code
- Make reproducible deployments  
- Have professional workflows without enterprise complexity
- Bridge the gap between clicking in the UI and full automation

GitHub: https://github.com/proxmox-mpc/proxmox-mpc
Docs: https://proxmox-mpc.dev

Would love feedback from the community! What features would you want to see?

### r/selfhosted
**Proxmox-MPC v${VERSION}: Interactive Infrastructure Management**

For those running Proxmox in their self-hosted setups, you might find this useful!

Proxmox-MPC is an interactive console that brings modern Infrastructure-as-Code practices to Proxmox management. Think of it as a developer-friendly way to manage your VMs and containers.

**Key benefits for self-hosters:**
- 📋 **Documentation**: Your infrastructure becomes self-documenting code
- 🔄 **Reproducibility**: Recreate your setup anywhere  
- 🧪 **Safety**: Test changes before applying them
- 📁 **Organization**: Project-based management for different services
- 🚀 **Efficiency**: Less clicking in UIs, more automation

**Real example - setting up a media server stack:**
\`\`\`bash
proxmox-mpc
/init  # One-time setup
create vm --name plex --memory 4096 --disk 100G
create vm --name jellyfin --memory 2048  
create container --name sonarr --template ubuntu-22.04
/test && /apply  # Deploy everything
\`\`\`

The generated Terraform configs can be version controlled, shared, and reused.

Installation: \`npm install -g proxmox-mpc\`

Currently in active development, would appreciate any feedback or feature requests!

EOF
    
    print_success "Social media posts generated: $(basename "$output_file")"
}

generate_email_newsletter() {
    local html_file="${OUTPUT_DIR}/email-newsletter.html"
    local text_file="${OUTPUT_DIR}/email-newsletter.txt"
    
    print_status "Generating email newsletter..."
    
    # HTML version
    cat > "$html_file" << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Proxmox-MPC Newsletter</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px; margin-bottom: 30px; }
        .version { font-size: 2.5em; font-weight: bold; margin: 0; }
        .tagline { font-size: 1.2em; margin: 10px 0 0 0; opacity: 0.9; }
        .section { margin: 30px 0; padding: 20px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #667eea; }
        .highlight { background: #e3f2fd; padding: 15px; border-radius: 6px; margin: 15px 0; }
        .code { background: #2d3748; color: #e2e8f0; padding: 15px; border-radius: 6px; font-family: 'Monaco', 'Consolas', monospace; overflow-x: auto; }
        .stats { display: flex; justify-content: space-around; text-align: center; margin: 20px 0; }
        .stat { padding: 15px; }
        .stat-number { font-size: 2em; font-weight: bold; color: #667eea; }
        .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 10px 0; }
        .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; }
    </style>
</head>
<body>
    <div class="header">
        <div class="version">v${VERSION}</div>
        <div class="tagline">Interactive Infrastructure-as-Code Console</div>
    </div>
    
    <div class="section">
        <h2>🚀 What's New</h2>
        <p>We're excited to announce Proxmox-MPC v${VERSION}, bringing enhanced functionality and improved user experience to infrastructure management.</p>
EOF
    
    if [[ -n "$CHANGES_SUMMARY" ]]; then
        echo "        <div class=\"highlight\">" >> "$html_file"
        echo "$CHANGES_SUMMARY" | sed 's/^/        /' >> "$html_file"
        echo "        </div>" >> "$html_file"
    fi
    
    cat >> "$html_file" << EOF
    </div>
    
    <div class="section">
        <h2>📊 Release Highlights</h2>
        <div class="stats">
EOF
    
    if [[ $FEAT_COUNT -gt 0 ]]; then
        cat >> "$html_file" << EOF
            <div class="stat">
                <div class="stat-number">$FEAT_COUNT</div>
                <div>New Features</div>
            </div>
EOF
    fi
    
    if [[ $FIX_COUNT -gt 0 ]]; then
        cat >> "$html_file" << EOF
            <div class="stat">
                <div class="stat-number">$FIX_COUNT</div>
                <div>Bug Fixes</div>
            </div>
EOF
    fi
    
    cat >> "$html_file" << EOF
            <div class="stat">
                <div class="stat-number">$CONTRIBUTORS_COUNT</div>
                <div>Contributors</div>
            </div>
        </div>
    </div>
    
    <div class="section">
        <h2>🚀 Quick Start</h2>
        <p>Get started with Proxmox-MPC in under 5 minutes:</p>
        
        <h3>Installation</h3>
        <div class="code">npm install -g proxmox-mpc</div>
        
        <h3>Launch Console</h3>
        <div class="code">proxmox-mpc</div>
        
        <h3>Initialize Project</h3>
        <div class="code">proxmox-mpc> /init<br>proxmox-mpc> /sync</div>
        
        <a href="https://proxmox-mpc.dev/getting-started" class="button">📖 Full Getting Started Guide</a>
    </div>
    
    <div class="section">
        <h2>🔗 Resources</h2>
        <ul>
            <li><a href="https://proxmox-mpc.dev">Official Website</a></li>
            <li><a href="https://github.com/proxmox-mpc/proxmox-mpc">GitHub Repository</a></li>
            <li><a href="https://www.npmjs.com/package/proxmox-mpc">npm Package</a></li>
            <li><a href="https://proxmox-mpc.dev/docs">Documentation</a></li>
            <li><a href="https://github.com/proxmox-mpc/proxmox-mpc/issues">Support & Issues</a></li>
        </ul>
    </div>
    
    <div class="footer">
        <p>Thank you for using Proxmox-MPC! 🙏</p>
        <p><small>This is an automated release announcement. For questions, visit our GitHub repository.</small></p>
    </div>
</body>
</html>
EOF
    
    # Text version
    cat > "$text_file" << EOF
PROXMOX-MPC v${VERSION} RELEASED
================================

Interactive Infrastructure-as-Code Console for Proxmox VE

WHAT'S NEW
----------

We're excited to announce Proxmox-MPC v${VERSION}, bringing enhanced 
functionality and improved user experience to infrastructure management.

EOF
    
    if [[ -n "$CHANGES_SUMMARY" ]]; then
        echo "$CHANGES_SUMMARY" >> "$text_file"
        echo "" >> "$text_file"
    fi
    
    cat >> "$text_file" << EOF
RELEASE HIGHLIGHTS
------------------

EOF
    
    if [[ $FEAT_COUNT -gt 0 ]]; then
        echo "- ✨ $FEAT_COUNT New Features" >> "$text_file"
    fi
    if [[ $FIX_COUNT -gt 0 ]]; then
        echo "- 🐛 $FIX_COUNT Bug Fixes" >> "$text_file"
    fi
    if [[ $REFACTOR_COUNT -gt 0 ]]; then
        echo "- ♻️ $REFACTOR_COUNT Improvements" >> "$text_file"
    fi
    echo "- 👥 $CONTRIBUTORS_COUNT Contributors" >> "$text_file"
    echo "- 🔀 $COMMIT_COUNT Commits since last release" >> "$text_file"
    
    cat >> "$text_file" << EOF

QUICK START
-----------

Installation:
  npm install -g proxmox-mpc

Launch Console:
  proxmox-mpc

Initialize Project:
  proxmox-mpc> /init
  proxmox-mpc> /sync

RESOURCES
---------

- Website: https://proxmox-mpc.dev
- GitHub: https://github.com/proxmox-mpc/proxmox-mpc  
- npm: https://www.npmjs.com/package/proxmox-mpc
- Documentation: https://proxmox-mpc.dev/docs
- Support: https://github.com/proxmox-mpc/proxmox-mpc/issues

Thank you for using Proxmox-MPC!

---
This is an automated release announcement.
For questions, visit our GitHub repository.
EOF
    
    print_success "Email newsletter generated: $(basename "$html_file"), $(basename "$text_file")"
}

generate_blog_post() {
    local output_file="${OUTPUT_DIR}/blog-post.md"
    
    print_status "Generating blog post..."
    
    cat > "$output_file" << EOF
---
title: "Proxmox-MPC v${VERSION}: Enhanced Interactive Infrastructure Management"
date: $RELEASE_DATE
author: "Proxmox-MPC Team"
tags: ["release", "proxmox", "infrastructure", "iac", "devops"]
description: "Announcing Proxmox-MPC v${VERSION} with improved features and enhanced user experience for interactive infrastructure management."
---

# Proxmox-MPC v${VERSION}: Enhanced Interactive Infrastructure Management

We're thrilled to announce the release of **Proxmox-MPC v${VERSION}**, bringing significant improvements to interactive infrastructure management for Proxmox Virtual Environment.

## What is Proxmox-MPC?

Proxmox-MPC is an innovative interactive console that transforms how you manage Proxmox infrastructure. Think of it as Claude Code for your virtual machines and containers - providing a conversational, project-based approach to Infrastructure-as-Code.

### Key Features

- **🖥️ Interactive Console**: Claude Code-like experience with slash commands
- **📁 Project Workspaces**: Organize infrastructure by environment or purpose  
- **⚙️ Automatic IaC Generation**: Creates Terraform and Ansible configurations
- **🧪 Test-Driven Infrastructure**: Generate and run tests before deployment
- **🔄 State Synchronization**: Bidirectional sync between server and local database
- **🚀 Multi-Server Deployment**: Export configurations to replicate infrastructure

## What's New in v${VERSION}

EOF
    
    if [[ -n "$CHANGES_SUMMARY" ]]; then
        echo "$CHANGES_SUMMARY" >> "$output_file"
    else
        cat >> "$output_file" << EOF
This release focuses on enhancing the user experience and expanding functionality:

- Improved interactive console with better command parsing
- Enhanced error handling and user feedback
- Expanded documentation and examples
- Performance optimizations and bug fixes
EOF
    fi
    
    cat >> "$output_file" << EOF

## Release Statistics

This release represents significant development effort:

EOF
    
    if [[ $FEAT_COUNT -gt 0 ]]; then
        echo "- ✨ **${FEAT_COUNT} New Features** - Expanding functionality and capabilities" >> "$output_file"
    fi
    if [[ $FIX_COUNT -gt 0 ]]; then
        echo "- 🐛 **${FIX_COUNT} Bug Fixes** - Improving stability and reliability" >> "$output_file"
    fi
    if [[ $REFACTOR_COUNT -gt 0 ]]; then
        echo "- ♻️ **${REFACTOR_COUNT} Code Improvements** - Better maintainability and performance" >> "$output_file"
    fi
    if [[ $DOCS_COUNT -gt 0 ]]; then
        echo "- 📝 **${DOCS_COUNT} Documentation Updates** - Enhanced guides and examples" >> "$output_file"
    fi
    if [[ $TEST_COUNT -gt 0 ]]; then
        echo "- 🧪 **${TEST_COUNT} Test Improvements** - Better quality assurance" >> "$output_file"
    fi
    
    echo "- 👥 **${CONTRIBUTORS_COUNT} Contributors** - Community collaboration" >> "$output_file"
    echo "- 🔀 **${COMMIT_COUNT} Commits** - Since the last release" >> "$output_file"
    
    if [[ "$INCLUDE_STATS" == "true" ]]; then
        cat >> "$output_file" << EOF

## Technical Overview

Proxmox-MPC v${VERSION} represents a mature TypeScript project with:

- **${TOTAL_LINES:-"N/A"} lines of code** - Comprehensive functionality
- **${TEST_FILES:-"0"} test files** - Ensuring reliability
- **${DEPENDENCIES:-"0"} runtime dependencies** - Lightweight and focused
- **${DEV_DEPENDENCIES:-"0"} development dependencies** - Modern development toolchain

EOF
    fi
    
    cat >> "$output_file" << EOF

## Getting Started

### Installation

Installing Proxmox-MPC is straightforward with npm:

\`\`\`bash
# Global installation (recommended)
npm install -g proxmox-mpc

# Local installation
npm install proxmox-mpc
\`\`\`

### First Steps

Once installed, you can immediately start managing your Proxmox infrastructure:

\`\`\`bash
# Launch the interactive console
proxmox-mpc

# Initialize a new project workspace
proxmox-mpc> /init

# Sync existing infrastructure
proxmox-mpc> /sync

# Create new resources
proxmox-mpc> create vm --name web-server --memory 4096
\`\`\`

### Example Workflow

Here's a typical workflow for managing infrastructure with Proxmox-MPC:

\`\`\`bash
# 1. Create and enter project directory
mkdir production-datacenter
cd production-datacenter

# 2. Launch interactive console
proxmox-mpc

# 3. Configure Proxmox server connection
proxmox-mpc> /init
# Follow prompts to configure server details

# 4. Import existing infrastructure
proxmox-mpc> /sync
# ✅ Discovered 12 VMs, 5 containers
# 📝 Generated terraform/ configurations
# 📝 Generated ansible/ playbooks

# 5. Add new infrastructure
proxmox-mpc> create vm --name api-server --cores 4 --memory 8192
# 📝 Generated terraform/vms/api-server.tf
# 📝 Generated ansible/playbooks/api-server.yml
# 🧪 Generated tests/vms/api-server.test.js

# 6. Test and deploy
proxmox-mpc> /test
# 🧪 All tests passed ✅

proxmox-mpc> /apply
# 🚀 Deploying changes...
# ✅ VM api-server created successfully!
\`\`\`

## Why Choose Proxmox-MPC?

### For Individual Users

- **Learning-Friendly**: Gradual introduction to Infrastructure-as-Code concepts
- **Documentation**: Your infrastructure becomes self-documenting
- **Reproducibility**: Recreate your setup anywhere, anytime
- **Safety**: Test changes before applying them to production

### For Teams

- **Collaboration**: Version-controlled infrastructure configurations
- **Consistency**: Standardized deployment processes
- **Scalability**: Manage multiple environments efficiently  
- **Compliance**: Audit trails and change management

### For Organizations

- **Professional Workflows**: Enterprise-grade infrastructure management
- **Cost Efficiency**: Reduced manual configuration effort
- **Risk Reduction**: Automated testing and validation
- **Knowledge Management**: Infrastructure knowledge encoded in version control

## Architecture Highlights

Proxmox-MPC is built with modern web technologies and best practices:

- **TypeScript**: Type-safe development with excellent IDE support
- **Node.js**: Cross-platform compatibility and npm ecosystem
- **Prisma ORM**: Type-safe database operations with SQLite/PostgreSQL
- **Jest Testing**: Comprehensive test coverage for reliability
- **Interactive REPL**: Rich command-line interface with completion

## Future Roadmap

We're continuously improving Proxmox-MPC based on community feedback:

- **Web UI**: Visual dashboard for infrastructure management
- **MCP Integration**: AI-powered infrastructure assistance  
- **Multi-Provider**: Support for additional virtualization platforms
- **Advanced Workflows**: GitOps integration and CI/CD pipelines
- **Enterprise Features**: RBAC, audit logging, and compliance reporting

## Community and Support

Proxmox-MPC is an open-source project that thrives on community participation:

- **🐛 Issue Reporting**: [GitHub Issues](https://github.com/proxmox-mpc/proxmox-mpc/issues)
- **💡 Feature Requests**: [GitHub Discussions](https://github.com/proxmox-mpc/proxmox-mpc/discussions)
- **🤝 Contributing**: [Contributing Guide](https://github.com/proxmox-mpc/proxmox-mpc/blob/main/CONTRIBUTING.md)
- **📖 Documentation**: [Official Docs](https://proxmox-mpc.dev)

## Conclusion

Proxmox-MPC v${VERSION} represents our commitment to making infrastructure management more accessible, reliable, and enjoyable. Whether you're a homelab enthusiast, a DevOps engineer, or part of an enterprise team, Proxmox-MPC provides the tools you need for modern infrastructure management.

**Ready to get started?**

\`\`\`bash
npm install -g proxmox-mpc
proxmox-mpc
\`\`\`

---

*Have questions or feedback? We'd love to hear from you! Reach out on [GitHub](https://github.com/proxmox-mpc/proxmox-mpc) or check out our [documentation](https://proxmox-mpc.dev).*

**Release Information:**
- **Version**: ${VERSION}
- **Release Date**: $RELEASE_DATE
- **Download**: [npm](https://www.npmjs.com/package/proxmox-mpc)
- **Source**: [GitHub](https://github.com/proxmox-mpc/proxmox-mpc/releases/tag/v${VERSION})
EOF
    
    print_success "Blog post generated: $(basename "$output_file")"
}

create_output_directory() {
    if [[ "$DRY_RUN" != "true" ]]; then
        mkdir -p "$OUTPUT_DIR"
        print_status "Output directory: $OUTPUT_DIR"
    fi
}

save_announcement_metadata() {
    if [[ "$DRY_RUN" == "true" ]]; then
        return 0
    fi
    
    local metadata_file="${OUTPUT_DIR}/announcement-metadata.json"
    
    cat > "$metadata_file" << EOF
{
  "version": "$VERSION",
  "releaseDate": "$RELEASE_DATE",
  "generatedAt": "$(date -u '+%Y-%m-%d %H:%M:%S UTC')",
  "format": "$FORMAT",
  "template": "$TEMPLATE",
  "statistics": {
    "commitCount": $COMMIT_COUNT,
    "contributorsCount": $CONTRIBUTORS_COUNT,
    "features": ${FEAT_COUNT:-0},
    "fixes": ${FIX_COUNT:-0},
    "breaking": ${BREAKING_COUNT:-0},
    "refactoring": ${REFACTOR_COUNT:-0},
    "documentation": ${DOCS_COUNT:-0},
    "tests": ${TEST_COUNT:-0},
    "chores": ${CHORE_COUNT:-0}
  }
}
EOF
    
    print_success "Metadata saved: $(basename "$metadata_file")"
}

main() {
    print_header "Proxmox-MPC Release Announcement Generation"
    
    parse_arguments "$@"
    
    cd "$PROJECT_ROOT"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        print_warning "DRY RUN MODE - No files will be created"
    fi
    
    print_status "Configuration:"
    print_status "  Version: $VERSION (auto-detect if empty)"
    print_status "  Format: $FORMAT"
    print_status "  Template: $TEMPLATE"
    print_status "  Include stats: $INCLUDE_STATS"
    
    # Execute generation workflow
    validate_environment
    determine_version
    collect_release_data
    analyze_commit_changes
    get_project_stats
    create_output_directory
    
    # Generate announcements based on format
    local formats_to_generate=()
    
    if [[ "$FORMAT" == "all" ]]; then
        formats_to_generate=("github" "npm" "social" "email" "blog")
    else
        IFS=',' read -ra formats_to_generate <<< "$FORMAT"
    fi
    
    local generated_files=()
    
    for format in "${formats_to_generate[@]}"; do
        case "$format" in
            "github")
                if [[ "$DRY_RUN" != "true" ]]; then
                    generate_github_release_notes
                    generated_files+=("github-release-notes.md")
                else
                    print_status "[DRY RUN] Would generate: github-release-notes.md"
                fi
                ;;
            "npm")
                if [[ "$DRY_RUN" != "true" ]]; then
                    generate_npm_announcement
                    generated_files+=("npm-package-announcement.md")
                else
                    print_status "[DRY RUN] Would generate: npm-package-announcement.md"
                fi
                ;;
            "social")
                if [[ "$DRY_RUN" != "true" ]]; then
                    generate_social_media_posts
                    generated_files+=("social-media-posts.md")
                else
                    print_status "[DRY RUN] Would generate: social-media-posts.md"
                fi
                ;;
            "email")
                if [[ "$DRY_RUN" != "true" ]]; then
                    generate_email_newsletter
                    generated_files+=("email-newsletter.html" "email-newsletter.txt")
                else
                    print_status "[DRY RUN] Would generate: email-newsletter.html, email-newsletter.txt"
                fi
                ;;
            "blog")
                if [[ "$DRY_RUN" != "true" ]]; then
                    generate_blog_post
                    generated_files+=("blog-post.md")
                else
                    print_status "[DRY RUN] Would generate: blog-post.md"
                fi
                ;;
            *)
                print_warning "Unknown format: $format"
                ;;
        esac
    done
    
    save_announcement_metadata
    
    # Final summary
    print_header "Announcement Generation Summary"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        print_success "🔍 Announcement preview completed!"
        print_status "Run without --dry-run to generate actual files"
    else
        print_success "📢 Release announcements generated successfully!"
        echo ""
        print_status "✅ Version: $VERSION"
        print_status "📅 Release date: $RELEASE_DATE"
        print_status "📁 Output directory: $OUTPUT_DIR"
        echo ""
        print_status "Generated files:"
        for file in "${generated_files[@]}"; do
            print_status "  - $file"
        done
        echo ""
        print_status "🚀 Next steps:"
        print_status "   1. Review generated announcements in: $OUTPUT_DIR"
        print_status "   2. Customize content as needed"
        print_status "   3. Post GitHub release with github-release-notes.md"
        print_status "   4. Share social media posts"
        print_status "   5. Send email newsletter to subscribers"
        print_status "   6. Publish blog post"
    fi
    
    echo ""
}

# Execute main function  
main "$@"