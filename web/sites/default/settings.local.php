<?php

/**
 * @file
 * Local development overrides for BoxTasks2.
 */

// Mercure configuration
$config['mercure.settings'] = [
  'hub_url' => 'http://ddev-boxtasks2-mercure/.well-known/mercure',
  'hub_public_url' => 'http://localhost:3000/.well-known/mercure',
  'jwt_key' => 'boxtasks2-mercure-publisher-secret-key-change-in-production',
  'jwt_algorithm' => 'HS256',
];

// Disable CSS/JS aggregation for development
$config['system.performance']['css']['preprocess'] = FALSE;
$config['system.performance']['js']['preprocess'] = FALSE;

// Enable verbose error logging
$config['system.logging']['error_level'] = 'verbose';
