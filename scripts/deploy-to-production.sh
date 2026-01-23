#!/bin/bash
# deploy-to-production.sh
# Deploys changes to production server and ensures dev stays in sync
# This is the SINGLE source of truth for production deployments

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Production server configuration
PROD_HOST="23.92.21.181"
PROD_USER="root"
PROD_PATH="/var/www/websites/tasks.boxraft.com"
PROD_URL="https://tasks.boxraft.com"

echo "========================================"
echo "BoxTasks2 - Deploy to Production"
echo "========================================"
echo ""

# Change to project directory
cd "$PROJECT_DIR"

# Step 1: Check for uncommitted changes
echo "Step 1: Checking for uncommitted changes..."
if [[ -n $(git status --porcelain) ]]; then
    echo "ERROR: You have uncommitted local changes!"
    echo "Please commit all changes before deploying."
    git status --short
    exit 1
fi

# Step 2: Ensure we're on main branch
CURRENT_BRANCH=$(git branch --show-current)
if [[ "$CURRENT_BRANCH" != "main" ]]; then
    echo "WARNING: You are on branch '$CURRENT_BRANCH', not 'main'."
    read -p "Do you want to continue? (y/N): " confirm
    if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
        echo "Deployment cancelled."
        exit 1
    fi
fi

# Step 3: Push to remote
echo "Step 2: Pushing to remote repository..."
git push origin "$CURRENT_BRANCH"

# Step 4: Deploy to production server
echo "Step 3: Deploying to production server..."
echo "  Host: $PROD_HOST"
echo "  Path: $PROD_PATH"
echo ""

ssh "$PROD_USER@$PROD_HOST" << 'ENDSSH'
    set -e
    cd /var/www/websites/tasks.boxraft.com

    echo "  -> Pulling latest changes..."
    git pull origin main

    echo "  -> Installing composer dependencies..."
    composer install --no-dev --optimize-autoloader

    echo "  -> Clearing Drupal cache..."
    ./vendor/drush/drush/drush cr

    echo "  -> Running database updates..."
    ./vendor/drush/drush/drush updb -y

    echo "  -> Importing configuration..."
    ./vendor/drush/drush/drush cim -y || true

    echo "  -> Building frontend..."
    cd frontend
    npm ci --production=false
    npm run build
    cd ..

    echo "  -> Restarting services..."
    systemctl restart php-fpm
    systemctl restart nginx

    echo "  -> Final cache clear (ensure no stale access caches)..."
    ./vendor/drush/drush/drush cr

    echo "  -> Deployment complete!"
ENDSSH

# Step 5: Verify production site
echo ""
echo "Step 4: Verifying production site..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$PROD_URL")
if [[ "$HTTP_STATUS" == "200" ]]; then
    echo "  Production site is up (HTTP $HTTP_STATUS)"
else
    echo "  WARNING: Production site returned HTTP $HTTP_STATUS"
fi

# Step 6: Sync dev site
echo ""
echo "Step 5: Syncing dev site with production..."
"$SCRIPT_DIR/sync-from-production.sh"

echo ""
echo "========================================"
echo "Deployment Complete!"
echo "========================================"
echo ""
echo "Production URL: $PROD_URL"
echo "Dev URL: https://boxtasks2.ddev.site"
echo ""
echo "Both production and dev sites are now in sync."
echo ""
