<?php

declare(strict_types=1);

namespace Drupal\boxtasks_security\Service;

use Drupal\Core\Config\ConfigFactoryInterface;
use Drupal\Core\Flood\FloodInterface;
use Drupal\Core\Session\AccountProxyInterface;

/**
 * Rate limiter service using Drupal's flood control.
 */
class RateLimiter {

  /**
   * Rate limit configurations by endpoint type.
   *
   * These are generous defaults suitable for normal application usage.
   * For production, consider making these configurable via Drupal config.
   */
  protected const RATE_LIMITS = [
    // Authentication endpoints - generous for normal usage
    // 100 auth attempts per 15 minutes should handle any legitimate use case
    'auth' => [
      'limit' => 100,
      'window' => 900, // 15 minutes
    ],
    // API read endpoints - very generous for SPAs with frequent polling
    // 2000 reads per minute handles real-time updates and heavy usage
    'api_read' => [
      'limit' => 2000,
      'window' => 60, // 1 minute
    ],
    // API write endpoints - generous for active users
    // 500 writes per minute handles bulk operations and active editing
    'api_write' => [
      'limit' => 500,
      'window' => 60, // 1 minute
    ],
    // General requests - very generous default
    'default' => [
      'limit' => 1000,
      'window' => 60, // 1 minute
    ],
  ];

  /**
   * The flood service.
   */
  protected FloodInterface $flood;

  /**
   * The current user.
   */
  protected AccountProxyInterface $currentUser;

  /**
   * The config factory.
   */
  protected ConfigFactoryInterface $configFactory;

  /**
   * Constructs a RateLimiter object.
   */
  public function __construct(
    FloodInterface $flood,
    AccountProxyInterface $currentUser,
    ConfigFactoryInterface $configFactory
  ) {
    $this->flood = $flood;
    $this->currentUser = $currentUser;
    $this->configFactory = $configFactory;
  }

  /**
   * Check if a request is allowed.
   *
   * @param string $type
   *   The type of rate limit to check (auth, api_read, api_write, default).
   * @param string|null $identifier
   *   Optional identifier (defaults to user ID or IP).
   *
   * @return bool
   *   TRUE if request is allowed, FALSE if rate limited.
   */
  public function isAllowed(string $type = 'default', ?string $identifier = NULL): bool {
    $config = self::RATE_LIMITS[$type] ?? self::RATE_LIMITS['default'];
    $identifier = $identifier ?? $this->getIdentifier();

    $eventName = 'boxtasks_security.rate_limit.' . $type;

    return $this->flood->isAllowed($eventName, $config['limit'], $config['window'], $identifier);
  }

  /**
   * Register a request for rate limiting.
   *
   * @param string $type
   *   The type of rate limit.
   * @param string|null $identifier
   *   Optional identifier.
   */
  public function register(string $type = 'default', ?string $identifier = NULL): void {
    $config = self::RATE_LIMITS[$type] ?? self::RATE_LIMITS['default'];
    $identifier = $identifier ?? $this->getIdentifier();

    $eventName = 'boxtasks_security.rate_limit.' . $type;

    $this->flood->register($eventName, $config['window'], $identifier);
  }

  /**
   * Check and register a request in one call.
   *
   * @param string $type
   *   The type of rate limit.
   * @param string|null $identifier
   *   Optional identifier.
   *
   * @return bool
   *   TRUE if request is allowed, FALSE if rate limited.
   */
  public function checkAndRegister(string $type = 'default', ?string $identifier = NULL): bool {
    $identifier = $identifier ?? $this->getIdentifier();

    if (!$this->isAllowed($type, $identifier)) {
      return FALSE;
    }

    $this->register($type, $identifier);
    return TRUE;
  }

  /**
   * Clear rate limit records for an identifier.
   *
   * @param string $type
   *   The type of rate limit.
   * @param string|null $identifier
   *   Optional identifier.
   */
  public function clear(string $type = 'default', ?string $identifier = NULL): void {
    $identifier = $identifier ?? $this->getIdentifier();
    $eventName = 'boxtasks_security.rate_limit.' . $type;

    $this->flood->clear($eventName, $identifier);
  }

  /**
   * Get the remaining requests for a rate limit.
   *
   * @param string $type
   *   The type of rate limit.
   * @param string|null $identifier
   *   Optional identifier.
   *
   * @return array
   *   Array with 'remaining' and 'reset' keys.
   */
  public function getRemainingRequests(string $type = 'default', ?string $identifier = NULL): array {
    $config = self::RATE_LIMITS[$type] ?? self::RATE_LIMITS['default'];
    $identifier = $identifier ?? $this->getIdentifier();

    // Get current count from flood table
    // Note: This is a simplified implementation
    // In production, you might want to query the flood table directly
    $limit = $config['limit'];
    $window = $config['window'];

    return [
      'limit' => $limit,
      'window' => $window,
      'reset' => time() + $window,
    ];
  }

  /**
   * Get identifier for rate limiting.
   *
   * Uses user ID for authenticated users, IP address for anonymous.
   *
   * @return string
   *   The identifier.
   */
  protected function getIdentifier(): string {
    if ($this->currentUser->isAuthenticated()) {
      return 'uid:' . $this->currentUser->id();
    }

    // Use IP address for anonymous users
    return \Drupal::request()->getClientIp() ?? 'unknown';
  }

  /**
   * Determine rate limit type from request path.
   *
   * @param string $path
   *   The request path.
   * @param string $method
   *   The HTTP method.
   *
   * @return string
   *   The rate limit type.
   */
  public function determineType(string $path, string $method): string {
    // Authentication endpoints
    if (str_contains($path, '/user/login') ||
        str_contains($path, '/user/logout') ||
        str_contains($path, '/session/token') ||
        str_contains($path, '/oauth/')) {
      return 'auth';
    }

    // JSON:API endpoints
    if (str_contains($path, '/jsonapi/')) {
      if (in_array($method, ['POST', 'PATCH', 'DELETE'], TRUE)) {
        return 'api_write';
      }
      return 'api_read';
    }

    return 'default';
  }

}
