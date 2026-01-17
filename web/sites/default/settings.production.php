<?php

/**
 * @file
 * Production environment settings for BoxTasks.
 *
 * This file should be included in settings.php when running in production.
 * Do NOT commit sensitive values - use environment variables instead.
 */

declare(strict_types=1);

/**
 * Database configuration.
 *
 * Use environment variables for credentials.
 */
$databases['default']['default'] = [
  'database' => getenv('DB_NAME') ?: 'boxtasks',
  'username' => getenv('DB_USER') ?: 'boxtasks',
  'password' => getenv('DB_PASSWORD') ?: '',
  'host' => getenv('DB_HOST') ?: 'localhost',
  'port' => getenv('DB_PORT') ?: '3306',
  'driver' => 'mysql',
  'prefix' => '',
  'collation' => 'utf8mb4_general_ci',
  'init_commands' => [
    'isolation_level' => 'SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED',
  ],
];

/**
 * Salt for one-time login links, cancel links, form tokens, etc.
 *
 * IMPORTANT: Set DRUPAL_HASH_SALT environment variable in production.
 */
$settings['hash_salt'] = getenv('DRUPAL_HASH_SALT') ?: '';

/**
 * Base URL (optional).
 */
if ($base_url = getenv('DRUPAL_BASE_URL')) {
  $base_url = $base_url;
}

/**
 * Trusted host configuration.
 *
 * Set DRUPAL_TRUSTED_HOSTS as comma-separated list of patterns.
 */
$trusted_hosts = getenv('DRUPAL_TRUSTED_HOSTS') ?: '';
if (!empty($trusted_hosts)) {
  $settings['trusted_host_patterns'] = array_map('trim', explode(',', $trusted_hosts));
}

/**
 * Private file path.
 */
$settings['file_private_path'] = getenv('DRUPAL_PRIVATE_FILES') ?: '/var/www/private';

/**
 * Temp directory.
 */
$settings['file_temp_path'] = getenv('DRUPAL_TEMP_PATH') ?: '/tmp';

/**
 * Config sync directory.
 */
$settings['config_sync_directory'] = getenv('DRUPAL_CONFIG_SYNC') ?: '../config/sync';

/**
 * Performance settings for production.
 */

// Aggregate CSS files.
$config['system.performance']['css']['preprocess'] = TRUE;

// Aggregate JavaScript files.
$config['system.performance']['js']['preprocess'] = TRUE;

// Enable page cache.
$config['system.performance']['cache']['page']['max_age'] = 3600;

// Enable compression.
$config['system.performance']['response']['gzip'] = TRUE;

/**
 * Error handling.
 *
 * Hide errors from end users in production.
 */
$config['system.logging']['error_level'] = 'hide';

/**
 * Disable development modules.
 *
 * These should not be enabled in production.
 */
$settings['extension_discovery_scan_tests'] = FALSE;

/**
 * Session configuration.
 */
ini_set('session.gc_probability', '1');
ini_set('session.gc_divisor', '100');
ini_set('session.gc_maxlifetime', '86400');
ini_set('session.cookie_lifetime', '86400');

/**
 * Security settings.
 */

// Force HTTPS.
if (getenv('FORCE_HTTPS') !== 'false') {
  $settings['https'] = TRUE;
}

// Secure cookies.
ini_set('session.cookie_secure', '1');
ini_set('session.cookie_httponly', '1');
ini_set('session.cookie_samesite', 'Lax');

// Disable file URLs with query strings (improves caching).
$settings['file_public_base_url'] = getenv('FILE_PUBLIC_BASE_URL') ?: NULL;

/**
 * Reverse proxy configuration.
 *
 * Enable if behind a load balancer or CDN.
 */
if (getenv('BEHIND_PROXY') === 'true') {
  $settings['reverse_proxy'] = TRUE;
  $settings['reverse_proxy_addresses'] = array_filter(array_map(
    'trim',
    explode(',', getenv('PROXY_ADDRESSES') ?: '')
  ));
  $settings['reverse_proxy_trusted_headers'] =
    \Symfony\Component\HttpFoundation\Request::HEADER_X_FORWARDED_FOR |
    \Symfony\Component\HttpFoundation\Request::HEADER_X_FORWARDED_PROTO |
    \Symfony\Component\HttpFoundation\Request::HEADER_X_FORWARDED_HOST;
}

/**
 * Redis cache backend (optional).
 *
 * Enable if Redis is available.
 */
if (getenv('REDIS_HOST') && extension_loaded('redis')) {
  $settings['redis.connection']['interface'] = 'PhpRedis';
  $settings['redis.connection']['host'] = getenv('REDIS_HOST');
  $settings['redis.connection']['port'] = getenv('REDIS_PORT') ?: '6379';
  if ($redis_password = getenv('REDIS_PASSWORD')) {
    $settings['redis.connection']['password'] = $redis_password;
  }

  $settings['cache']['default'] = 'cache.backend.redis';
  $settings['container_yamls'][] = 'modules/contrib/redis/example.services.yml';
}

/**
 * OAuth / Simple OAuth settings.
 */
$settings['simple_oauth.settings'] = [
  'access_token_expiration' => (int) (getenv('OAUTH_ACCESS_TOKEN_EXPIRATION') ?: 3600),
  'refresh_token_expiration' => (int) (getenv('OAUTH_REFRESH_TOKEN_EXPIRATION') ?: 86400 * 14),
];

/**
 * Mercure settings.
 */
if ($mercure_url = getenv('MERCURE_URL')) {
  $settings['mercure']['hub_url'] = $mercure_url;
  $settings['mercure']['jwt_secret'] = getenv('MERCURE_JWT_SECRET');
}

/**
 * SMTP settings override.
 *
 * Override SMTP password from environment variable to avoid storing in config.
 */
if ($smtp_password = getenv('SMTP_PASSWORD')) {
  $config['smtp.settings']['smtp_password'] = $smtp_password;
}

/**
 * Social Auth - Google settings override.
 *
 * Override credentials from environment variables to avoid storing in config.
 */
if ($google_client_id = getenv('SOCIAL_AUTH_GOOGLE_CLIENT_ID')) {
  $config['social_auth_google.settings']['client_id'] = $google_client_id;
}
if ($google_secret = getenv('SOCIAL_AUTH_GOOGLE_CLIENT_SECRET')) {
  $config['social_auth_google.settings']['client_secret'] = $google_secret;
}

/**
 * Social Auth - Microsoft settings override.
 *
 * Override credentials from environment variables to avoid storing in config.
 */
if ($microsoft_client_id = getenv('SOCIAL_AUTH_MICROSOFT_CLIENT_ID')) {
  $config['social_auth_microsoft.settings']['client_id'] = $microsoft_client_id;
}
if ($microsoft_secret = getenv('SOCIAL_AUTH_MICROSOFT_CLIENT_SECRET')) {
  $config['social_auth_microsoft.settings']['client_secret'] = $microsoft_secret;
}

/**
 * Social Auth - Entra ID (Azure AD) settings override.
 *
 * Override credentials from environment variables to avoid storing in config.
 */
if ($entra_client_id = getenv('SOCIAL_AUTH_ENTRA_ID_CLIENT_ID')) {
  $config['social_auth_entra_id.settings']['client_id'] = $entra_client_id;
}
if ($entra_secret = getenv('SOCIAL_AUTH_ENTRA_ID_CLIENT_SECRET')) {
  $config['social_auth_entra_id.settings']['client_secret'] = $entra_secret;
}

/**
 * CORS configuration.
 *
 * Set CORS_ALLOWED_ORIGINS as comma-separated list.
 */
$cors_origins = getenv('CORS_ALLOWED_ORIGINS') ?: '';
if (!empty($cors_origins)) {
  $settings['cors.config'] = [
    'enabled' => TRUE,
    'allowedHeaders' => ['*'],
    'allowedMethods' => ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    'allowedOrigins' => array_map('trim', explode(',', $cors_origins)),
    'exposedHeaders' => TRUE,
    'maxAge' => 600,
    'supportsCredentials' => TRUE,
  ];
}

/**
 * File system settings.
 */
$settings['file_chmod_directory'] = 0755;
$settings['file_chmod_file'] = 0644;

/**
 * Maintenance mode.
 *
 * Set DRUPAL_MAINTENANCE=true to enable.
 */
if (getenv('DRUPAL_MAINTENANCE') === 'true') {
  $settings['maintenance_mode'] = TRUE;
}

/**
 * Deployment identifier.
 *
 * Used to invalidate container cache on deployment.
 */
if ($deployment_id = getenv('DEPLOYMENT_ID')) {
  $settings['deployment_identifier'] = $deployment_id;
}
