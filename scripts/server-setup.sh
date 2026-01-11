#!/bin/bash
# BoxTasks Server Setup Script
# Run this on the remote server to set up the environment
# Usage: bash server-setup.sh

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Configuration
STAGING_DOMAIN="staging.boxtasks.boxraft.com"
PRODUCTION_DOMAIN="boxtasks.boxraft.com"
STAGING_PATH="/var/www/websites/staging.boxtasks.boxraft.com"
PRODUCTION_PATH="/var/www/websites/boxtasks.boxraft.com"
WEB_USER="www-data"

# 1. Create directory structure
log_info "Creating directory structure..."

for PATH_DIR in "$STAGING_PATH" "$PRODUCTION_PATH"; do
    mkdir -p "$PATH_DIR"/{web,frontend/dist,config/sync,private,tmp}
    chmod -R 755 "$PATH_DIR"
done

# 2. Set ownership
log_info "Setting ownership..."
chown -R $WEB_USER:$WEB_USER "$STAGING_PATH"
chown -R $WEB_USER:$WEB_USER "$PRODUCTION_PATH"

# 3. Create Nginx configurations
log_info "Creating Nginx configurations..."

# Staging Nginx config
cat > /etc/nginx/sites-available/$STAGING_DOMAIN << 'NGINX_STAGING'
server {
    listen 80;
    server_name staging.boxtasks.boxraft.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name staging.boxtasks.boxraft.com;

    # SSL certificates (managed by Certbot)
    ssl_certificate /etc/letsencrypt/live/staging.boxtasks.boxraft.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/staging.boxtasks.boxraft.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Root for Drupal backend
    root /var/www/websites/staging.boxtasks.boxraft.com/web;
    index index.php index.html;

    # Logs
    access_log /var/log/nginx/staging.boxtasks.boxraft.com.access.log;
    error_log /var/log/nginx/staging.boxtasks.boxraft.com.error.log;

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
        root /var/www/websites/staging.boxtasks.boxraft.com/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Drupal JSON:API endpoint
    location /jsonapi {
        root /var/www/websites/staging.boxtasks.boxraft.com/web;
        try_files $uri /index.php?$query_string;
    }

    # Drupal OAuth endpoints
    location /oauth {
        root /var/www/websites/staging.boxtasks.boxraft.com/web;
        try_files $uri /index.php?$query_string;
    }

    # Drupal user endpoints
    location /user {
        root /var/www/websites/staging.boxtasks.boxraft.com/web;
        try_files $uri /index.php?$query_string;
    }

    # Drupal admin
    location /admin {
        root /var/www/websites/staging.boxtasks.boxraft.com/web;
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
        root /var/www/websites/staging.boxtasks.boxraft.com/web;
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
        root /var/www/websites/staging.boxtasks.boxraft.com/web;
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
NGINX_STAGING

# Production Nginx config
cat > /etc/nginx/sites-available/$PRODUCTION_DOMAIN << 'NGINX_PRODUCTION'
server {
    listen 80;
    server_name boxtasks.boxraft.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name boxtasks.boxraft.com;

    # SSL certificates (managed by Certbot)
    ssl_certificate /etc/letsencrypt/live/boxtasks.boxraft.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/boxtasks.boxraft.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Root for Drupal backend
    root /var/www/websites/boxtasks.boxraft.com/web;
    index index.php index.html;

    # Logs
    access_log /var/log/nginx/boxtasks.boxraft.com.access.log;
    error_log /var/log/nginx/boxtasks.boxraft.com.error.log;

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
        root /var/www/websites/boxtasks.boxraft.com/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Drupal JSON:API endpoint
    location /jsonapi {
        root /var/www/websites/boxtasks.boxraft.com/web;
        try_files $uri /index.php?$query_string;
    }

    # Drupal OAuth endpoints
    location /oauth {
        root /var/www/websites/boxtasks.boxraft.com/web;
        try_files $uri /index.php?$query_string;
    }

    # Drupal user endpoints
    location /user {
        root /var/www/websites/boxtasks.boxraft.com/web;
        try_files $uri /index.php?$query_string;
    }

    # Drupal admin
    location /admin {
        root /var/www/websites/boxtasks.boxraft.com/web;
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
        root /var/www/websites/boxtasks.boxraft.com/web;
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
        root /var/www/websites/boxtasks.boxraft.com/web;
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
NGINX_PRODUCTION

# 4. Enable sites
log_info "Enabling Nginx sites..."
ln -sf /etc/nginx/sites-available/$STAGING_DOMAIN /etc/nginx/sites-enabled/
ln -sf /etc/nginx/sites-available/$PRODUCTION_DOMAIN /etc/nginx/sites-enabled/

# 5. Test and reload Nginx
log_info "Testing Nginx configuration..."
nginx -t

log_info "Reloading Nginx..."
systemctl reload nginx

# 6. Create environment files templates
log_info "Creating environment file templates..."

cat > "$STAGING_PATH/.env.staging" << 'ENV_STAGING'
# Staging Environment Configuration
APP_ENV=staging
APP_DEBUG=true

# Database
DB_CONNECTION=mysql
DB_HOST=localhost
DB_PORT=3306
DB_DATABASE=boxtasks_staging
DB_USERNAME=boxtasks_staging
DB_PASSWORD=CHANGE_ME

# Drupal
DRUPAL_HASH_SALT=CHANGE_ME_RANDOM_STRING

# Mercure
MERCURE_URL=https://staging.boxtasks.boxraft.com/.well-known/mercure
MERCURE_PUBLIC_URL=https://staging.boxtasks.boxraft.com/.well-known/mercure
MERCURE_JWT_SECRET=CHANGE_ME_RANDOM_STRING

# Frontend
VITE_API_URL=https://staging.boxtasks.boxraft.com

# OAuth
OAUTH_PRIVATE_KEY=/var/www/websites/staging.boxtasks.boxraft.com/private/oauth-private.key
OAUTH_PUBLIC_KEY=/var/www/websites/staging.boxtasks.boxraft.com/private/oauth-public.key
ENV_STAGING

cat > "$PRODUCTION_PATH/.env.production" << 'ENV_PRODUCTION'
# Production Environment Configuration
APP_ENV=production
APP_DEBUG=false

# Database
DB_CONNECTION=mysql
DB_HOST=localhost
DB_PORT=3306
DB_DATABASE=boxtasks_production
DB_USERNAME=boxtasks_production
DB_PASSWORD=CHANGE_ME

# Drupal
DRUPAL_HASH_SALT=CHANGE_ME_RANDOM_STRING

# Mercure
MERCURE_URL=https://boxtasks.boxraft.com/.well-known/mercure
MERCURE_PUBLIC_URL=https://boxtasks.boxraft.com/.well-known/mercure
MERCURE_JWT_SECRET=CHANGE_ME_RANDOM_STRING

# Frontend
VITE_API_URL=https://boxtasks.boxraft.com

# OAuth
OAUTH_PRIVATE_KEY=/var/www/websites/boxtasks.boxraft.com/private/oauth-private.key
OAUTH_PUBLIC_KEY=/var/www/websites/boxtasks.boxraft.com/private/oauth-public.key
ENV_PRODUCTION

# 7. Generate SSL certificates with Certbot (if not exists)
log_info "Checking SSL certificates..."
if [ ! -f "/etc/letsencrypt/live/$STAGING_DOMAIN/fullchain.pem" ]; then
    log_warn "Staging SSL certificate not found. Please run:"
    echo "  certbot certonly --nginx -d $STAGING_DOMAIN"
fi

if [ ! -f "/etc/letsencrypt/live/$PRODUCTION_DOMAIN/fullchain.pem" ]; then
    log_warn "Production SSL certificate not found. Please run:"
    echo "  certbot certonly --nginx -d $PRODUCTION_DOMAIN"
fi

log_info "Server setup completed!"
echo ""
echo "=================================================="
echo "  Next steps:"
echo "  1. Create databases for staging and production"
echo "  2. Update .env files with correct credentials"
echo "  3. Generate OAuth keys in private/ directories"
echo "  4. Obtain SSL certificates with Certbot"
echo "  5. Configure Mercure hub"
echo "=================================================="
