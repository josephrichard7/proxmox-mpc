#!/bin/bash

# Proxmox-MPC GPG Setup and Verification Script
# GPG key management and signing setup for secure releases
# Part of Phase 3: Release Automation Workflows (WORKFLOW-002)

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration flags
INTERACTIVE=true
LIST_KEYS=false
VERIFY_SETUP=false
CONFIGURE_GIT=false

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
Usage: $0 [OPTIONS]

GPG setup and verification for secure Proxmox-MPC releases

OPTIONS:
    --list-keys          List available GPG keys
    --verify-setup       Verify current GPG configuration
    --configure-git      Configure Git to use GPG signing
    --non-interactive    Run without interactive prompts
    -h, --help           Show this help message

EXAMPLES:
    $0                   # Interactive GPG setup wizard
    $0 --list-keys       # List all available GPG keys
    $0 --verify-setup    # Check current GPG configuration
    $0 --configure-git   # Configure Git for GPG signing

This script helps with:
- GPG key generation and management
- Git configuration for signed commits and tags
- Verification of GPG setup for releases
- Export of public keys for verification

EOF
}

parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --list-keys)
                LIST_KEYS=true
                INTERACTIVE=false
                shift
                ;;
            --verify-setup)
                VERIFY_SETUP=true
                INTERACTIVE=false
                shift
                ;;
            --configure-git)
                CONFIGURE_GIT=true
                INTERACTIVE=false
                shift
                ;;
            --non-interactive)
                INTERACTIVE=false
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

check_gpg_availability() {
    print_status "Checking GPG availability..."
    
    if ! command -v gpg &> /dev/null; then
        print_error "GPG is not installed"
        print_status "Please install GPG:"
        print_status "  - Ubuntu/Debian: sudo apt install gnupg"
        print_status "  - macOS: brew install gnupg"
        print_status "  - CentOS/RHEL: sudo yum install gnupg2"
        exit 1
    fi
    
    local gpg_version=$(gpg --version | head -1 | awk '{print $3}')
    print_success "GPG available: version $gpg_version"
}

list_gpg_keys() {
    print_header "Available GPG Keys"
    
    print_status "Public keys:"
    if gpg --list-keys --keyid-format LONG | grep -q "pub"; then
        gpg --list-keys --keyid-format LONG
    else
        print_warning "No public keys found"
    fi
    
    echo ""
    print_status "Secret keys (for signing):"
    if gpg --list-secret-keys --keyid-format LONG | grep -q "sec"; then
        gpg --list-secret-keys --keyid-format LONG
    else
        print_warning "No secret keys found"
    fi
    
    echo ""
}

verify_gpg_setup() {
    print_header "GPG Setup Verification"
    
    # Check for secret keys
    local has_secret_keys=false
    if gpg --list-secret-keys &> /dev/null; then
        has_secret_keys=true
        print_success "GPG secret keys available"
    else
        print_error "No GPG secret keys found"
    fi
    
    # Check Git configuration
    print_status "Checking Git GPG configuration..."
    
    local git_gpg_key=$(git config --global user.signingkey 2>/dev/null || echo "")
    local git_gpg_sign=$(git config --global commit.gpgsign 2>/dev/null || echo "false")
    local git_tag_sign=$(git config --global tag.gpgSign 2>/dev/null || echo "false")
    
    if [[ -n "$git_gpg_key" ]]; then
        print_success "Git signing key configured: $git_gpg_key"
        
        # Verify the key exists
        if gpg --list-secret-keys "$git_gpg_key" &> /dev/null; then
            print_success "Configured GPG key is available"
        else
            print_error "Configured GPG key not found in keyring"
        fi
    else
        print_warning "Git signing key not configured"
    fi
    
    if [[ "$git_gpg_sign" == "true" ]]; then
        print_success "Git commit signing enabled"
    else
        print_warning "Git commit signing disabled"
    fi
    
    if [[ "$git_tag_sign" == "true" ]]; then
        print_success "Git tag signing enabled"
    else
        print_warning "Git tag signing disabled"
    fi
    
    # Test GPG signing
    if [[ "$has_secret_keys" == "true" ]]; then
        print_status "Testing GPG signing..."
        local test_file=$(mktemp)
        echo "Test signing" > "$test_file"
        
        if gpg --clearsign --quiet "$test_file" 2>/dev/null; then
            print_success "GPG signing test passed"
            rm -f "$test_file" "${test_file}.asc"
        else
            print_error "GPG signing test failed"
            rm -f "$test_file"
        fi
    fi
    
    echo ""
    print_status "Overall GPG setup status:"
    if [[ "$has_secret_keys" == "true" ]] && [[ -n "$git_gpg_key" ]]; then
        print_success "✅ GPG setup is ready for signed releases"
    else
        print_warning "⚠️  GPG setup needs configuration"
        print_status "Run this script interactively to configure GPG"
    fi
}

configure_git_gpg() {
    print_header "Git GPG Configuration"
    
    # List available keys for selection
    if ! gpg --list-secret-keys --keyid-format LONG | grep -q "sec"; then
        print_error "No GPG secret keys available"
        print_status "Please generate a GPG key first"
        return 1
    fi
    
    print_status "Available GPG keys for signing:"
    local key_ids=()
    
    # Extract key IDs
    while IFS= read -r line; do
        if [[ $line == sec* ]]; then
            local key_id=$(echo "$line" | awk '{print $2}' | cut -d'/' -f2)
            key_ids+=("$key_id")
            
            # Get user info for this key
            local user_info=$(gpg --list-keys "$key_id" | grep "uid" | head -1 | sed 's/uid.*\] //')
            echo "  $key_id - $user_info"
        fi
    done < <(gpg --list-secret-keys --keyid-format LONG)
    
    if [[ ${#key_ids[@]} -eq 0 ]]; then
        print_error "No valid GPG keys found"
        return 1
    fi
    
    local selected_key=""
    
    if [[ "$INTERACTIVE" == "true" ]] && [[ ${#key_ids[@]} -gt 1 ]]; then
        echo ""
        read -p "Enter the GPG key ID to use for signing: " selected_key
    else
        selected_key="${key_ids[0]}"
        print_status "Auto-selecting first available key: $selected_key"
    fi
    
    # Validate selected key
    if ! gpg --list-secret-keys "$selected_key" &> /dev/null; then
        print_error "Invalid GPG key ID: $selected_key"
        return 1
    fi
    
    print_status "Configuring Git to use GPG key: $selected_key"
    
    # Configure Git
    git config --global user.signingkey "$selected_key"
    git config --global commit.gpgsign true
    git config --global tag.gpgSign true
    
    # Configure GPG program if needed
    if command -v gpg2 &> /dev/null; then
        git config --global gpg.program gpg2
    fi
    
    print_success "Git GPG configuration completed"
    
    # Display configuration
    echo ""
    print_status "Current Git GPG configuration:"
    echo "  Signing key: $(git config --global user.signingkey)"
    echo "  Commit signing: $(git config --global commit.gpgsign)"
    echo "  Tag signing: $(git config --global tag.gpgSign)"
    echo "  GPG program: $(git config --global gpg.program || echo "default")"
}

generate_gpg_key() {
    print_header "GPG Key Generation"
    
    if [[ "$INTERACTIVE" != "true" ]]; then
        print_error "GPG key generation requires interactive mode"
        return 1
    fi
    
    print_status "This will generate a new GPG key pair for signing releases."
    print_warning "Make sure to use a strong passphrase and keep your private key secure!"
    echo ""
    
    read -p "Continue with GPG key generation? [y/N] " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_status "GPG key generation cancelled"
        return 0
    fi
    
    # Get user information
    echo ""
    print_status "Please provide the following information for your GPG key:"
    
    read -p "Full name: " full_name
    read -p "Email address: " email_address
    read -p "Comment (optional): " comment
    
    if [[ -z "$full_name" ]] || [[ -z "$email_address" ]]; then
        print_error "Name and email are required"
        return 1
    fi
    
    # Create GPG batch file
    local gpg_batch_file=$(mktemp)
    
    cat > "$gpg_batch_file" << EOF
%echo Generating GPG key for Proxmox-MPC releases
Key-Type: RSA
Key-Length: 4096
Subkey-Type: RSA
Subkey-Length: 4096
Name-Real: $full_name
Name-Email: $email_address
EOF
    
    if [[ -n "$comment" ]]; then
        echo "Name-Comment: $comment" >> "$gpg_batch_file"
    fi
    
    cat >> "$gpg_batch_file" << EOF
Expire-Date: 2y
Passphrase: 
%commit
%echo GPG key generation completed
EOF
    
    print_status "Generating GPG key... (this may take a few minutes)"
    print_status "You may need to provide entropy by moving the mouse or typing"
    
    if gpg --batch --generate-key "$gpg_batch_file"; then
        print_success "GPG key generated successfully"
        
        # Find the new key ID
        local new_key_id=$(gpg --list-secret-keys --keyid-format LONG "$email_address" | grep "sec" | awk '{print $2}' | cut -d'/' -f2 | head -1)
        
        if [[ -n "$new_key_id" ]]; then
            print_status "New GPG key ID: $new_key_id"
            
            # Export public key
            print_status "Exporting public key..."
            gpg --armor --export "$new_key_id" > "gpg-public-key-${new_key_id}.asc"
            print_success "Public key exported to: gpg-public-key-${new_key_id}.asc"
            
            # Configure Git to use this key
            print_status "Configuring Git to use the new GPG key..."
            git config --global user.signingkey "$new_key_id"
            git config --global commit.gpgsign true
            git config --global tag.gpgSign true
        fi
    else
        print_error "GPG key generation failed"
    fi
    
    rm -f "$gpg_batch_file"
}

interactive_setup() {
    print_header "Proxmox-MPC GPG Setup Wizard"
    
    # Check current status
    local has_gpg_keys=false
    if gpg --list-secret-keys &> /dev/null; then
        has_gpg_keys=true
    fi
    
    local git_configured=false
    if [[ -n "$(git config --global user.signingkey 2>/dev/null)" ]]; then
        git_configured=true
    fi
    
    print_status "Current status:"
    if [[ "$has_gpg_keys" == "true" ]]; then
        print_success "✅ GPG keys available"
    else
        print_warning "⚠️  No GPG keys found"
    fi
    
    if [[ "$git_configured" == "true" ]]; then
        print_success "✅ Git GPG signing configured"
    else
        print_warning "⚠️  Git GPG signing not configured"
    fi
    
    echo ""
    print_status "Available actions:"
    echo "  1. List existing GPG keys"
    echo "  2. Generate new GPG key"
    echo "  3. Configure Git GPG signing"
    echo "  4. Verify GPG setup"
    echo "  5. Export public key"
    echo "  6. Exit"
    echo ""
    
    while true; do
        read -p "Choose an action [1-6]: " action
        
        case $action in
            1)
                list_gpg_keys
                ;;
            2)
                generate_gpg_key
                ;;
            3)
                configure_git_gpg
                ;;
            4)
                verify_gpg_setup
                ;;
            5)
                export_public_key
                ;;
            6)
                print_status "Exiting GPG setup"
                break
                ;;
            *)
                print_warning "Invalid choice. Please enter 1-6."
                ;;
        esac
        
        echo ""
        read -p "Press Enter to continue..."
        echo ""
    done
}

export_public_key() {
    print_header "Export Public GPG Key"
    
    # List available keys
    if ! gpg --list-keys --keyid-format LONG | grep -q "pub"; then
        print_error "No GPG keys available for export"
        return 1
    fi
    
    print_status "Available keys for export:"
    local key_ids=()
    
    while IFS= read -r line; do
        if [[ $line == pub* ]]; then
            local key_id=$(echo "$line" | awk '{print $2}' | cut -d'/' -f2)
            key_ids+=("$key_id")
            
            local user_info=$(gpg --list-keys "$key_id" | grep "uid" | head -1 | sed 's/uid.*\] //')
            echo "  $key_id - $user_info"
        fi
    done < <(gpg --list-keys --keyid-format LONG)
    
    if [[ ${#key_ids[@]} -eq 0 ]]; then
        print_error "No valid keys found"
        return 1
    fi
    
    local selected_key=""
    
    if [[ "$INTERACTIVE" == "true" ]] && [[ ${#key_ids[@]} -gt 1 ]]; then
        echo ""
        read -p "Enter the GPG key ID to export: " selected_key
    else
        selected_key="${key_ids[0]}"
    fi
    
    # Validate and export
    if gpg --list-keys "$selected_key" &> /dev/null; then
        local output_file="gpg-public-key-${selected_key}.asc"
        gpg --armor --export "$selected_key" > "$output_file"
        print_success "Public key exported to: $output_file"
        
        # Show fingerprint
        local fingerprint=$(gpg --fingerprint "$selected_key" | grep "Key fingerprint" | sed 's/.*= //')
        print_status "Key fingerprint: $fingerprint"
    else
        print_error "Invalid key ID: $selected_key"
    fi
}

main() {
    parse_arguments "$@"
    
    check_gpg_availability
    
    if [[ "$LIST_KEYS" == "true" ]]; then
        list_gpg_keys
    elif [[ "$VERIFY_SETUP" == "true" ]]; then
        verify_gpg_setup
    elif [[ "$CONFIGURE_GIT" == "true" ]]; then
        configure_git_gpg
    elif [[ "$INTERACTIVE" == "true" ]]; then
        interactive_setup
    else
        show_usage
    fi
}

# Execute main function
main "$@"