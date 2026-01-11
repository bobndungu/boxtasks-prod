#!/bin/bash
# BoxTasks Deployment Script
# Usage: ./deploy.sh [staging|production]

set -e

ENVIRONMENT=${1:-staging}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Set environment-specific variables
if [ "$ENVIRONMENT" == "production" ]; then
    DOMAIN="boxtasks.boxraft.com"
    DEPLOY_PATH="/var/www/websites/boxtasks.boxraft.com"
    ENV_FILE=".env.production"
else
    DOMAIN="staging.boxtasks.boxraft.com"
    DEPLOY_PATH="/var/www/websites/staging.boxtasks.boxraft.com"
    ENV_FILE=".env.staging"
fi

log_info "Deploying to $ENVIRONMENT environment at $DEPLOY_PATH"

cd "$PROJECT_DIR"

# 1. Copy environment file if exists
if [ -f "$ENV_FILE" ]; then
    log_info "Copying environment file..."
    cp "$ENV_FILE" .env
fi

# 2. Install PHP dependencies
log_info "Installing Composer dependencies..."
if command -v composer &> /dev/null; then
    composer install --no-dev --optimize-autoloader --no-interaction
else
    log_error "Composer not found. Please install Composer."
    exit 1
fi

# 3. Create necessary directories
log_info "Creating necessary directories..."
mkdir -p web/sites/default/files
mkdir -p private
mkdir -p tmp
mkdir -p config/sync

# 4. Set permissions
log_info "Setting permissions..."
chmod -R 755 web
chmod -R 775 web/sites/default/files
chmod -R 775 private
chmod -R 775 tmp

# 5. Copy production settings if not exists
if [ ! -f "web/sites/default/settings.php" ]; then
    log_info "Creating settings.php..."
    if [ -f "web/sites/default/default.settings.php" ]; then
        cp web/sites/default/default.settings.php web/sites/default/settings.php
    fi
fi

# 6. Run Drupal deployment tasks
log_info "Running Drupal deployment tasks..."

# Check if Drush is available
DRUSH="./vendor/bin/drush"
if [ ! -f "$DRUSH" ]; then
    log_error "Drush not found at $DRUSH"
    exit 1
fi

# Put site in maintenance mode
log_info "Enabling maintenance mode..."
$DRUSH state:set system.maintenance_mode 1 --input-format=integer -y || true

# Run database updates
log_info "Running database updates..."
$DRUSH updatedb -y || log_warn "No database updates to apply"

# Import configuration
log_info "Importing configuration..."
$DRUSH config:import -y || log_warn "No configuration changes to import"

# Clear and rebuild caches
log_info "Clearing caches..."
$DRUSH cache:rebuild

# Change admin password on first deployment or if requested
ADMIN_PASSWORD_FILE="$DEPLOY_PATH/.admin_password_set"
if [ ! -f "$ADMIN_PASSWORD_FILE" ] || [ "$RESET_ADMIN_PASSWORD" == "true" ]; then
    log_info "Setting secure admin password..."
    # Generate a 24-character secure password
    ADMIN_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)

    # Set the password for user 1 (admin)
    $DRUSH user:password admin "$ADMIN_PASSWORD" || log_warn "Failed to set admin password"

    # Save password info (only save that it was set, not the actual password)
    echo "Admin password set on $(date)" > "$ADMIN_PASSWORD_FILE"
    chmod 600 "$ADMIN_PASSWORD_FILE"

    # Output the password for the deployer to note
    echo ""
    echo "=============================================="
    echo "  IMPORTANT: Admin password has been set!"
    echo "  Username: admin"
    echo "  Password: $ADMIN_PASSWORD"
    echo "  "
    echo "  SAVE THIS PASSWORD SECURELY!"
    echo "  This will only be shown once."
    echo "=============================================="
    echo ""
fi

# Disable maintenance mode
log_info "Disabling maintenance mode..."
$DRUSH state:set system.maintenance_mode 0 --input-format=integer -y

# 7. Set final ownership (nginx user on RHEL/CentOS, www-data on Debian/Ubuntu)
log_info "Setting ownership..."
if id "nginx" &>/dev/null; then
    chown -R nginx:nginx web/sites/default/files
    chown -R nginx:nginx private
    chown -R nginx:nginx tmp
elif id "www-data" &>/dev/null; then
    chown -R www-data:www-data web/sites/default/files
    chown -R www-data:www-data private
    chown -R www-data:www-data tmp
fi

# 8. Restart PHP-FPM if needed
if systemctl is-active --quiet php8.3-fpm; then
    log_info "Restarting PHP-FPM..."
    systemctl restart php8.3-fpm
elif systemctl is-active --quiet php-fpm; then
    log_info "Restarting PHP-FPM..."
    systemctl restart php-fpm
fi

log_info "Deployment to $ENVIRONMENT completed successfully!"
echo ""
echo "=================================================="
echo "  Site URL: https://$DOMAIN"
echo "=================================================="
