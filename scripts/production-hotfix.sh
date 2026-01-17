#!/bin/bash
# production-hotfix.sh
# For emergency fixes made directly on production
# Commits changes on production and syncs back to dev

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Production server configuration
PROD_HOST="23.92.21.181"
PROD_USER="root"
PROD_PATH="/var/www/websites/tasks.boxraft.com"

echo "========================================"
echo "BoxTasks2 - Production Hotfix Sync"
echo "========================================"
echo ""
echo "This script will:"
echo "1. Commit any uncommitted changes on production"
echo "2. Push to remote repository"
echo "3. Sync dev site with the changes"
echo ""

# Step 1: Commit and push from production
echo "Step 1: Committing changes on production server..."
read -p "Enter commit message: " COMMIT_MSG

if [[ -z "$COMMIT_MSG" ]]; then
    echo "ERROR: Commit message is required."
    exit 1
fi

ssh "$PROD_USER@$PROD_HOST" << ENDSSH
    set -e
    cd /var/www/websites/tasks.boxraft.com

    echo "  -> Checking for changes..."
    if [[ -z \$(git status --porcelain) ]]; then
        echo "  No changes to commit on production."
        exit 0
    fi

    echo "  -> Staging all changes..."
    git add -A

    echo "  -> Committing..."
    git commit -m "hotfix: $COMMIT_MSG"

    echo "  -> Pushing to remote..."
    git push origin main

    echo "  -> Clearing Drupal cache..."
    ./vendor/drush/drush/drush cr

    echo "  -> Production changes committed and pushed!"
ENDSSH

# Step 2: Sync dev site
echo ""
echo "Step 2: Syncing dev site with production..."
"$SCRIPT_DIR/sync-from-production.sh"

echo ""
echo "========================================"
echo "Hotfix Sync Complete!"
echo "========================================"
echo ""
echo "Production changes have been committed and synced to dev."
echo ""
