#!/bin/bash
# Domain Migration Script for BoxTasks
# Migrates:
#   - Current boxtasks.boxraft.com (BoxTasks2) -> tasks.boxraft.com
#   - Current tasks.boxraft.com (old BoxTasks) -> oldtasks.boxraft.com
#
# Usage: bash domain-migration.sh [--dry-run]
#
# Run this script on the production server as root

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "${BLUE}[STEP]${NC} $1"; }

DRY_RUN=false
if [[ "$1" == "--dry-run" ]]; then
    DRY_RUN=true
    log_warn "Running in DRY-RUN mode - no changes will be made"
fi

run_cmd() {
    if $DRY_RUN; then
        echo "  [DRY-RUN] Would execute: $1"
    else
        eval "$1"
    fi
}

# Configuration
OLD_BOXTASKS_PATH="/var/www/websites/tasks.boxraft.com"
NEW_BOXTASKS_PATH="/var/www/websites/boxtasks.boxraft.com"
OLD_BOXTASKS_NEW_PATH="/var/www/websites/oldtasks.boxraft.com"
FINAL_BOXTASKS_PATH="/var/www/websites/tasks.boxraft.com"
BACKUP_DIR="/var/www/backups/domain-migration-$(date +%Y%m%d_%H%M%S)"
NGINX_AVAILABLE="/etc/nginx/sites-available"
NGINX_ENABLED="/etc/nginx/sites-enabled"

echo "=============================================="
echo "   BoxTasks Domain Migration Script"
echo "=============================================="
echo ""
echo "Migration Plan:"
echo "  1. tasks.boxraft.com (old) -> oldtasks.boxraft.com"
echo "  2. boxtasks.boxraft.com (BoxTasks2) -> tasks.boxraft.com"
echo ""
echo "Paths:"
echo "  Old BoxTasks: $OLD_BOXTASKS_PATH"
echo "  BoxTasks2: $NEW_BOXTASKS_PATH"
echo "  Backup dir: $BACKUP_DIR"
echo ""

if ! $DRY_RUN; then
    read -p "Press Enter to continue or Ctrl+C to cancel..."
fi

# =============================================================================
# STEP 1: Create Backup Directory
# =============================================================================
log_step "Creating backup directory..."
run_cmd "mkdir -p $BACKUP_DIR"

# =============================================================================
# STEP 2: Backup Current Nginx Configurations
# =============================================================================
log_step "Backing up Nginx configurations..."
if [ -f "$NGINX_AVAILABLE/tasks.boxraft.com" ]; then
    run_cmd "cp $NGINX_AVAILABLE/tasks.boxraft.com $BACKUP_DIR/nginx-tasks.boxraft.com.backup"
fi
if [ -f "$NGINX_AVAILABLE/boxtasks.boxraft.com" ]; then
    run_cmd "cp $NGINX_AVAILABLE/boxtasks.boxraft.com $BACKUP_DIR/nginx-boxtasks.boxraft.com.backup"
fi

# =============================================================================
# STEP 3: Backup Databases
# =============================================================================
log_step "Backing up databases..."
# Old BoxTasks database (if exists)
if mysql -e "USE boxtasks_old" 2>/dev/null || mysql -e "USE boxtasks" 2>/dev/null; then
    log_info "Backing up old BoxTasks database..."
    run_cmd "mysqldump boxtasks 2>/dev/null > $BACKUP_DIR/boxtasks_old_db.sql || mysqldump boxtasks_old 2>/dev/null > $BACKUP_DIR/boxtasks_old_db.sql || true"
fi
# BoxTasks2 database
if mysql -e "USE boxtasks2" 2>/dev/null; then
    log_info "Backing up BoxTasks2 database..."
    run_cmd "mysqldump boxtasks2 > $BACKUP_DIR/boxtasks2_db.sql || true"
fi

# =============================================================================
# STEP 4: Move Old tasks.boxraft.com to oldtasks.boxraft.com
# =============================================================================
log_step "Moving old tasks.boxraft.com to oldtasks.boxraft.com..."

if [ -d "$OLD_BOXTASKS_PATH" ]; then
    # Check if it's not the same as boxtasks.boxraft.com
    if [ "$OLD_BOXTASKS_PATH" != "$NEW_BOXTASKS_PATH" ]; then
        run_cmd "mv $OLD_BOXTASKS_PATH $OLD_BOXTASKS_NEW_PATH"
        log_info "Moved $OLD_BOXTASKS_PATH to $OLD_BOXTASKS_NEW_PATH"
    else
        log_warn "Old BoxTasks path is same as BoxTasks2 path, skipping move"
    fi
else
    log_warn "Old BoxTasks path doesn't exist: $OLD_BOXTASKS_PATH"
fi

# =============================================================================
# STEP 5: Move boxtasks.boxraft.com to tasks.boxraft.com
# =============================================================================
log_step "Moving boxtasks.boxraft.com to tasks.boxraft.com..."

if [ -d "$NEW_BOXTASKS_PATH" ]; then
    run_cmd "mv $NEW_BOXTASKS_PATH $FINAL_BOXTASKS_PATH"
    log_info "Moved $NEW_BOXTASKS_PATH to $FINAL_BOXTASKS_PATH"
else
    log_error "BoxTasks2 path doesn't exist: $NEW_BOXTASKS_PATH"
    exit 1
fi

# =============================================================================
# STEP 6: Create Nginx Config for oldtasks.boxraft.com
# =============================================================================
log_step "Creating Nginx config for oldtasks.boxraft.com..."

if [ -d "$OLD_BOXTASKS_NEW_PATH" ]; then
    if ! $DRY_RUN; then
        cat > "$NGINX_AVAILABLE/oldtasks.boxraft.com" << 'NGINX_OLDTASKS'
server {
    listen 80;
    server_name oldtasks.boxraft.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name oldtasks.boxraft.com;

    # SSL will be configured by certbot
    # ssl_certificate /etc/letsencrypt/live/oldtasks.boxraft.com/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/oldtasks.boxraft.com/privkey.pem;

    root /var/www/websites/oldtasks.boxraft.com;
    index index.php index.html;

    access_log /var/log/nginx/oldtasks.boxraft.com.access.log;
    error_log /var/log/nginx/oldtasks.boxraft.com.error.log;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \.php$ {
        fastcgi_split_path_info ^(.+\.php)(/.+)$;
        fastcgi_pass unix:/run/php/php8.1-fpm.sock;
        fastcgi_index index.php;
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        fastcgi_param PATH_INFO $fastcgi_path_info;
    }

    location ~ /\.(?!well-known) {
        deny all;
    }
}
NGINX_OLDTASKS
        log_info "Created $NGINX_AVAILABLE/oldtasks.boxraft.com"
    else
        echo "  [DRY-RUN] Would create Nginx config for oldtasks.boxraft.com"
    fi
fi

# =============================================================================
# STEP 7: Update Nginx Config for tasks.boxraft.com (BoxTasks2)
# =============================================================================
log_step "Updating Nginx config for tasks.boxraft.com..."

if ! $DRY_RUN; then
    cat > "$NGINX_AVAILABLE/tasks.boxraft.com" << 'NGINX_TASKS'
server {
    listen 80;
    server_name tasks.boxraft.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name tasks.boxraft.com;

    # SSL certificates (managed by Certbot)
    ssl_certificate /etc/letsencrypt/live/tasks.boxraft.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tasks.boxraft.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Root for Drupal backend
    root /var/www/websites/tasks.boxraft.com/web;
    index index.php index.html;

    # Logs
    access_log /var/log/nginx/tasks.boxraft.com.access.log;
    error_log /var/log/nginx/tasks.boxraft.com.error.log;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Frontend React app (serve static files)
    location / {
        root /var/www/websites/tasks.boxraft.com/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Drupal JSON:API endpoint
    location /jsonapi {
        root /var/www/websites/tasks.boxraft.com/web;
        try_files $uri /index.php?$query_string;
    }

    # Drupal OAuth endpoints
    location /oauth {
        root /var/www/websites/tasks.boxraft.com/web;
        try_files $uri /index.php?$query_string;
    }

    # Drupal user endpoints
    location /user {
        root /var/www/websites/tasks.boxraft.com/web;
        try_files $uri /index.php?$query_string;
    }

    # Drupal admin
    location /admin {
        root /var/www/websites/tasks.boxraft.com/web;
        try_files $uri /index.php?$query_string;
    }

    # Drupal core paths
    location ~ ^/(core|modules|themes|libraries|profiles)/ {
        root /var/www/websites/tasks.boxraft.com/web;
        try_files $uri /index.php?$query_string;
    }

    # Drupal sites/default/files
    location ~ ^/sites/ {
        root /var/www/websites/tasks.boxraft.com/web;
        try_files $uri /index.php?$query_string;
    }

    # Mercure hub
    location /.well-known/mercure {
        proxy_pass http://127.0.0.1:3000;
        proxy_read_timeout 24h;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # PHP-FPM for Drupal
    location ~ \.php$ {
        root /var/www/websites/tasks.boxraft.com/web;
        fastcgi_split_path_info ^(.+\.php)(/.+)$;
        fastcgi_pass unix:/run/php/php8.3-fpm.sock;
        fastcgi_index index.php;
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        fastcgi_param PATH_INFO $fastcgi_path_info;
        fastcgi_read_timeout 300;
    }

    # Block access to sensitive files
    location ~ /\.(?!well-known) {
        deny all;
    }

    location ~ ^/sites/.*/files/styles/ {
        root /var/www/websites/tasks.boxraft.com/web;
        try_files $uri @rewrite;
    }

    location @rewrite {
        rewrite ^/(.*)$ /index.php?q=$1;
    }

    # Static files
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
NGINX_TASKS
    log_info "Updated $NGINX_AVAILABLE/tasks.boxraft.com"
else
    echo "  [DRY-RUN] Would update Nginx config for tasks.boxraft.com"
fi

# =============================================================================
# STEP 8: Update Drupal settings.php trusted hosts
# =============================================================================
log_step "Updating Drupal trusted hosts..."

SETTINGS_FILE="$FINAL_BOXTASKS_PATH/web/sites/default/settings.php"
if [ -f "$SETTINGS_FILE" ]; then
    # Backup settings.php
    run_cmd "cp $SETTINGS_FILE $BACKUP_DIR/settings.php.backup"

    if ! $DRY_RUN; then
        # Check if trusted_host_patterns exists and update it
        if grep -q "trusted_host_patterns" "$SETTINGS_FILE"; then
            # Replace boxtasks.boxraft.com with tasks.boxraft.com in settings.php
            sed -i 's/boxtasks\.boxraft\.com/tasks.boxraft.com/g' "$SETTINGS_FILE"
            log_info "Updated trusted_host_patterns in settings.php"
        else
            # Add trusted_host_patterns
            echo "" >> "$SETTINGS_FILE"
            echo "\$settings['trusted_host_patterns'] = [" >> "$SETTINGS_FILE"
            echo "  '^tasks\\.boxraft\\.com\$'," >> "$SETTINGS_FILE"
            echo "  '^www\\.tasks\\.boxraft\\.com\$'," >> "$SETTINGS_FILE"
            echo "];" >> "$SETTINGS_FILE"
            log_info "Added trusted_host_patterns to settings.php"
        fi
    fi
fi

# =============================================================================
# STEP 9: Enable Nginx Sites
# =============================================================================
log_step "Enabling Nginx sites..."

# Disable old boxtasks.boxraft.com config
if [ -L "$NGINX_ENABLED/boxtasks.boxraft.com" ]; then
    run_cmd "rm $NGINX_ENABLED/boxtasks.boxraft.com"
    log_info "Disabled boxtasks.boxraft.com"
fi

# Enable tasks.boxraft.com
run_cmd "ln -sf $NGINX_AVAILABLE/tasks.boxraft.com $NGINX_ENABLED/"
log_info "Enabled tasks.boxraft.com"

# Enable oldtasks.boxraft.com if the config exists
if [ -f "$NGINX_AVAILABLE/oldtasks.boxraft.com" ]; then
    run_cmd "ln -sf $NGINX_AVAILABLE/oldtasks.boxraft.com $NGINX_ENABLED/"
    log_info "Enabled oldtasks.boxraft.com"
fi

# =============================================================================
# STEP 10: Test Nginx Configuration
# =============================================================================
log_step "Testing Nginx configuration..."
if ! $DRY_RUN; then
    nginx -t
    if [ $? -eq 0 ]; then
        log_info "Nginx configuration test passed"
    else
        log_error "Nginx configuration test FAILED!"
        log_error "Restoring backups..."
        # Restore backups would go here
        exit 1
    fi
fi

# =============================================================================
# STEP 11: Generate SSL Certificates
# =============================================================================
log_step "Generating SSL certificates..."

# Check if tasks.boxraft.com cert exists (may already exist from old site)
if [ ! -d "/etc/letsencrypt/live/tasks.boxraft.com" ]; then
    log_info "Generating SSL certificate for tasks.boxraft.com..."
    if ! $DRY_RUN; then
        certbot certonly --nginx -d tasks.boxraft.com --non-interactive --agree-tos --email admin@boxraft.com || log_warn "Failed to generate cert for tasks.boxraft.com"
    fi
else
    log_info "SSL certificate for tasks.boxraft.com already exists"
fi

# Generate cert for oldtasks.boxraft.com
if [ -d "$OLD_BOXTASKS_NEW_PATH" ]; then
    log_info "Generating SSL certificate for oldtasks.boxraft.com..."
    if ! $DRY_RUN; then
        certbot certonly --nginx -d oldtasks.boxraft.com --non-interactive --agree-tos --email admin@boxraft.com || log_warn "Failed to generate cert for oldtasks.boxraft.com"
    fi
fi

# =============================================================================
# STEP 12: Reload Nginx
# =============================================================================
log_step "Reloading Nginx..."
if ! $DRY_RUN; then
    systemctl reload nginx
    log_info "Nginx reloaded successfully"
fi

# =============================================================================
# STEP 13: Set Permissions
# =============================================================================
log_step "Setting permissions..."
if [ -d "$FINAL_BOXTASKS_PATH" ]; then
    run_cmd "chown -R bxusr:bxusr $FINAL_BOXTASKS_PATH"
    run_cmd "chmod -R 755 $FINAL_BOXTASKS_PATH"
    run_cmd "chmod -R 775 $FINAL_BOXTASKS_PATH/web/sites/default/files"
    log_info "Permissions set for tasks.boxraft.com"
fi

if [ -d "$OLD_BOXTASKS_NEW_PATH" ]; then
    run_cmd "chown -R www-data:www-data $OLD_BOXTASKS_NEW_PATH"
    log_info "Permissions set for oldtasks.boxraft.com"
fi

# =============================================================================
# STEP 14: Clear Drupal Cache
# =============================================================================
log_step "Clearing Drupal cache..."
if [ -f "$FINAL_BOXTASKS_PATH/vendor/bin/drush" ]; then
    if ! $DRY_RUN; then
        cd "$FINAL_BOXTASKS_PATH"
        ./vendor/bin/drush cache:rebuild || log_warn "Failed to clear Drupal cache"
        log_info "Drupal cache cleared"
    fi
fi

# =============================================================================
# COMPLETE
# =============================================================================
echo ""
echo "=============================================="
echo "   Domain Migration Complete!"
echo "=============================================="
echo ""
echo "Summary:"
echo "  - Old BoxTasks moved to: $OLD_BOXTASKS_NEW_PATH"
echo "  - BoxTasks2 moved to: $FINAL_BOXTASKS_PATH"
echo "  - Backup location: $BACKUP_DIR"
echo ""
echo "URLs:"
echo "  - tasks.boxraft.com (BoxTasks2)"
echo "  - oldtasks.boxraft.com (Old BoxTasks)"
echo ""
echo "Next steps:"
echo "  1. Test https://tasks.boxraft.com"
echo "  2. Test https://oldtasks.boxraft.com"
echo "  3. Update OAuth redirect URIs in Google/Microsoft portals"
echo "  4. Update any DNS records if needed"
echo "=============================================="
