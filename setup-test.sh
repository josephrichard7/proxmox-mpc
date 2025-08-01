#!/bin/bash

# Proxmox-MPC Test Setup Script
# Quick setup for testing with your homelab Proxmox server

echo "🔧 Proxmox-MPC Test Setup"
echo "========================="

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo "✅ .env file created from template"
    echo ""
    echo "⚠️  IMPORTANT: Edit .env file with your Proxmox server details:"
    echo "   - PROXMOX_HOST=your-server-ip"
    echo "   - PROXMOX_TOKEN_ID=your-token-id"
    echo "   - PROXMOX_TOKEN_SECRET=your-token-secret"
    echo ""
    echo "💡 To create API token:"
    echo "   1. Go to Proxmox web UI → Datacenter → Permissions → API Tokens"
    echo "   2. Add token for root@pam user"
    echo "   3. Uncheck 'Privilege Separation' for testing"
    echo ""
else
    echo "✅ .env file already exists"
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
else
    echo "✅ Dependencies already installed"
fi

# Test basic functionality
echo ""
echo "🧪 Testing basic functionality..."

# Test CLI connection
echo "📡 Testing Proxmox API connection..."
if npm run cli test-connection > /dev/null 2>&1; then
    echo "✅ Proxmox connection successful!"
    
    echo "📊 Getting server info..."
    npm run cli list-nodes
    echo ""
    npm run cli list-vms
else
    echo "❌ Proxmox connection failed"
    echo "💡 Make sure to configure .env file with correct server details"
fi

echo ""
echo "🎯 Ready to test! Try these commands:"
echo ""
echo "# Launch interactive console:"
echo "npm run console"
echo ""
echo "# Test CLI commands:"
echo "npm run cli test-connection -v"
echo "npm run cli list-nodes -v"
echo ""
echo "# Create test workspace:"
echo "mkdir ~/test-proxmox-workspace"
echo "cd ~/test-proxmox-workspace"
echo "npm run console"
echo ""
echo "📖 See test-console.md for detailed testing guide"