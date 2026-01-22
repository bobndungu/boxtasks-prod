#!/bin/bash
# sync-from-production.sh
# Syncs changes from production to the local dev environment
# Run this after any production deployment to keep dev in sync

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "========================================"
echo "BoxTasks2 - Sync from Production"
echo "========================================"
echo ""

# Change to project directory
cd "$PROJECT_DIR"

# Step 1: Fetch latest changes from remote
echo "Step 1: Fetching latest changes from remote..."
git fetch origin

# Step 2: Check for local changes
if [[ -n $(git status --porcelain) ]]; then
    echo "WARNING: You have uncommitted local changes!"
    echo "Please commit or stash them before syncing."
    git status --short
    exit 1
fi

# Step 3: Pull latest changes
echo "Step 2: Pulling latest changes from origin/main..."
git pull origin main

# Step 4: Clear Drupal cache and rebuild node access
echo "Step 3: Clearing Drupal cache..."
if command -v ddev &> /dev/null; then
    ddev drush cr
    echo "Step 3b: Importing config changes..."
    ddev drush cim -y || true
    echo "Step 3c: Rebuilding node access permissions..."
    ddev drush php-eval "node_access_rebuild();"
else
    echo "DDEV not found. Skipping Drupal operations."
fi

# Step 5: Rebuild frontend
echo "Step 4: Rebuilding frontend..."
cd "$PROJECT_DIR/frontend"
npm run build

echo ""
echo "========================================"
echo "Sync Complete!"
echo "========================================"
echo ""
echo "Dev site is now in sync with production."
echo "Dev URL: https://boxtasks2.ddev.site"
echo ""
