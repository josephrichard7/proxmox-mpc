#!/bin/bash

# Proxmox-MPC Console Launcher
# Launches the interactive console from any directory

# Get the directory where this script is located (project root)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🔧 Starting Proxmox-MPC Interactive Console..."
echo "📁 Project directory: $SCRIPT_DIR"
echo "📂 Working directory: $(pwd)"
echo ""

# Change to project directory and run console
cd "$SCRIPT_DIR"
npm run console