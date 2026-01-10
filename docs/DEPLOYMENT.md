# BoxTasks Deployment Guide

This guide covers deploying BoxTasks to a production environment.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Server Requirements](#server-requirements)
3. [Environment Setup](#environment-setup)
4. [Drupal Backend Deployment](#drupal-backend-deployment)
5. [Frontend Deployment](#frontend-deployment)
6. [Database Setup](#database-setup)
7. [SSL/TLS Configuration](#ssltls-configuration)
8. [Security Checklist](#security-checklist)
9. [Monitoring](#monitoring)
10. [Maintenance](#maintenance)
11. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software

- PHP 8.3+ with extensions:
  - pdo_mysql
  - gd
  - mbstring
  - json
  - curl
  - xml
  - zip
  - opcache
  - redis (optional, for caching)

- MySQL 8.0+ or MariaDB 10.6+
- Node.js 18+ (for building frontend)
- Composer 2.x
- Nginx or Apache web server
- Redis (optional, recommended for production)
- Mercure Hub (for real-time features)

### Domain Requirements

- Primary domain for the application (e.g., boxtasks.example.com)
- API subdomain (optional, e.g., api.boxtasks.example.com)
- Valid SSL certificates

---

## Server Requirements

### Minimum Specifications

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 2 cores | 4+ cores |
| RAM | 4 GB | 8+ GB |
| Storage | 20 GB SSD | 50+ GB SSD |
| Bandwidth | 1 TB/month | Unlimited |

### PHP Configuration

Edit `php.ini`:

```ini
memory_limit = 256M
upload_max_filesize = 50M
post_max_size = 50M
max_execution_time = 300
max_input_time = 300
opcache.enable = 1
opcache.memory_consumption = 128
opcache.max_accelerated_files = 10000
opcache.revalidate_freq = 60
```

---

## Environment Setup

### 1. Create Environment File

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with production values:

```bash
# Required - Generate with: php -r "echo bin2hex(random_bytes(32));"
DRUPAL_HASH_SALT=your_64_character_hex_string

# Database
DB_HOST=localhost
DB_PORT=3306
DB_NAME=boxtasks_prod
DB_USER=boxtasks
DB_PASSWORD=secure_password_here

# Domain
DRUPAL_BASE_URL=https://boxtasks.example.com
DRUPAL_TRUSTED_HOSTS=^boxtasks\.example\.com$

# Security
DRUPAL_ENV=production
FORCE_HTTPS=true

# CORS
CORS_ALLOWED_ORIGINS=https://app.boxtasks.example.com
```

### 2. Secure Environment File

```bash
chmod 600 .env
chown www-data:www-data .env
```

---

## Drupal Backend Deployment

### 1. Clone Repository

```bash
cd /var/www
git clone https://github.com/your-org/boxtasks.git
cd boxtasks
```

### 2. Install Dependencies

```bash
composer install --no-dev --optimize-autoloader
```

### 3. Set File Permissions

```bash
# Create required directories
mkdir -p web/sites/default/files
mkdir -p private
mkdir -p tmp

# Set ownership
chown -R www-data:www-data web/sites/default/files
chown -R www-data:www-data private
chown -R www-data:www-data tmp

# Set permissions
chmod -R 755 web/sites/default/files
chmod -R 750 private
chmod 644 web/sites/default/settings.php
```

### 4. Import Configuration

```bash
# Set config sync directory
export DRUPAL_CONFIG_SYNC=../config/sync

# Import configuration
./vendor/bin/drush config:import -y
```

### 5. Run Updates

```bash
./vendor/bin/drush updatedb -y
./vendor/bin/drush cache:rebuild
```

### 6. Configure Cron

Add to crontab:

```cron
*/5 * * * * cd /var/www/boxtasks && ./vendor/bin/drush cron > /dev/null 2>&1
```

---

## Frontend Deployment

### 1. Build Frontend

```bash
cd frontend

# Install dependencies
npm ci --production=false

# Create production build
npm run build
```

### 2. Configure Web Server

For Nginx with SPA routing:

```nginx
server {
    listen 443 ssl http2;
    server_name app.boxtasks.example.com;
    root /var/www/boxtasks/frontend/dist;
    index index.html;

    # SSL configuration
    ssl_certificate /etc/letsencrypt/live/boxtasks.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/boxtasks.example.com/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://api.boxtasks.example.com wss://mercure.example.com;" always;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### 3. Deploy Static Files

Copy build output to web server:

```bash
rsync -avz frontend/dist/ /var/www/boxtasks/frontend/dist/
```

---

## Database Setup

### 1. Create Database

```sql
CREATE DATABASE boxtasks_prod CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'boxtasks'@'localhost' IDENTIFIED BY 'secure_password';
GRANT ALL PRIVILEGES ON boxtasks_prod.* TO 'boxtasks'@'localhost';
FLUSH PRIVILEGES;
```

### 2. Import Schema

For fresh installation:

```bash
./vendor/bin/drush site:install standard \
  --site-name="BoxTasks" \
  --account-name=admin \
  --account-pass=secure_admin_password \
  --db-url=mysql://boxtasks:password@localhost/boxtasks_prod \
  -y
```

For migration from existing database:

```bash
# Import database dump
mysql -u boxtasks -p boxtasks_prod < backup.sql

# Run updates
./vendor/bin/drush updatedb -y
./vendor/bin/drush cache:rebuild
```

---

## SSL/TLS Configuration

### 1. Install Certbot

```bash
apt install certbot python3-certbot-nginx
```

### 2. Obtain Certificate

```bash
certbot --nginx -d boxtasks.example.com -d api.boxtasks.example.com
```

### 3. Auto-renewal

Certbot adds auto-renewal automatically. Verify with:

```bash
certbot renew --dry-run
```

---

## Security Checklist

### Pre-Deployment

- [ ] All environment variables are set
- [ ] Database credentials are secure (16+ characters)
- [ ] Admin password is strong (16+ characters)
- [ ] OAuth client secret is regenerated
- [ ] DRUPAL_HASH_SALT is set to unique value
- [ ] Trusted hosts pattern is configured
- [ ] CORS origins are correctly set

### Server Configuration

- [ ] HTTPS is enforced
- [ ] Security headers are configured
- [ ] File permissions are correct
- [ ] Private files directory is outside webroot
- [ ] PHP error display is disabled
- [ ] Debug mode is disabled

### Application Security

- [ ] Rate limiting is enabled
- [ ] Input validation is active
- [ ] CSRF protection is enabled
- [ ] Audit logging is enabled
- [ ] Session cookies are secure

### Monitoring

- [ ] Error logging is configured
- [ ] Audit logs are being written
- [ ] Backup strategy is in place
- [ ] Uptime monitoring is set up

---

## Monitoring

### Health Check Endpoint

BoxTasks exposes a health check endpoint:

```
GET /api/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-11T10:30:00Z",
  "database": "connected",
  "cache": "connected"
}
```

### Log Locations

| Log Type | Location |
|----------|----------|
| Drupal logs | `/var/log/drupal/drupal.log` |
| Nginx access | `/var/log/nginx/access.log` |
| Nginx errors | `/var/log/nginx/error.log` |
| PHP errors | `/var/log/php/error.log` |
| Audit logs | Database: `boxtasks_audit_log` table |

### Recommended Monitoring Tools

- **Uptime**: UptimeRobot, Pingdom, or StatusCake
- **APM**: New Relic, Datadog, or Sentry
- **Logs**: ELK Stack or Grafana Loki
- **Metrics**: Prometheus + Grafana

---

## Maintenance

### Regular Tasks

**Daily:**
- Check error logs for issues
- Verify backups completed successfully

**Weekly:**
- Review audit logs for security events
- Check disk space usage
- Review performance metrics

**Monthly:**
- Apply security updates
- Review and rotate passwords if needed
- Clean up old audit logs

### Database Backup

Automated daily backup script:

```bash
#!/bin/bash
# /opt/scripts/backup-boxtasks.sh

BACKUP_DIR="/var/backups/boxtasks"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup
mysqldump -u boxtasks -p boxtasks_prod | gzip > "$BACKUP_DIR/boxtasks_$DATE.sql.gz"

# Keep only last 30 days
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +30 -delete
```

Add to crontab:

```cron
0 2 * * * /opt/scripts/backup-boxtasks.sh
```

### Updating BoxTasks

```bash
cd /var/www/boxtasks

# Enable maintenance mode
./vendor/bin/drush state:set system.maintenance_mode 1

# Pull latest code
git pull origin main

# Update dependencies
composer install --no-dev --optimize-autoloader

# Run database updates
./vendor/bin/drush updatedb -y

# Import configuration
./vendor/bin/drush config:import -y

# Clear caches
./vendor/bin/drush cache:rebuild

# Rebuild frontend
cd frontend
npm ci
npm run build
cd ..

# Disable maintenance mode
./vendor/bin/drush state:set system.maintenance_mode 0
```

### Audit Log Cleanup

Audit logs are retained for 90 days by default. To manually clean up:

```bash
./vendor/bin/drush eval "\Drupal::service('boxtasks_security.audit_logger')->cleanup(90);"
```

---

## Troubleshooting

### Common Issues

**Site shows "Access Denied"**
- Check file permissions
- Verify .htaccess is present
- Check Nginx/Apache configuration

**Database connection errors**
- Verify database credentials in .env
- Check MySQL service is running
- Verify database user permissions

**CORS errors in browser**
- Check CORS_ALLOWED_ORIGINS in .env
- Verify frontend is using correct API URL
- Check browser console for specific error

**Rate limiting issues**
- Clear flood table: `drush sql:query "DELETE FROM flood;"`
- Adjust rate limits in module configuration

**OAuth token errors**
- Verify OAuth keys exist in `keys/` directory
- Check key file permissions
- Regenerate keys if corrupted

### Getting Help

1. Check Drupal logs: `drush watchdog:show`
2. Check PHP error log: `tail -f /var/log/php/error.log`
3. Check Nginx error log: `tail -f /var/log/nginx/error.log`
4. Enable verbose mode temporarily for debugging

### Support Contacts

- **Technical Issues**: [Create issue on GitHub]
- **Security Issues**: security@boxtasks.example.com
