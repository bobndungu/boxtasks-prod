<?php

declare(strict_types=1);

namespace Drupal\boxtasks_api\PageCache;

use Drupal\Core\PageCache\RequestPolicyInterface;
use Symfony\Component\HttpFoundation\Request;

/**
 * Cache policy that disallows caching of authentication-related requests.
 *
 * This policy ensures that OAuth, social auth, and user-specific API endpoints
 * are never cached by Drupal's page cache, preventing identity mismatch issues.
 */
class DisallowAuthRequests implements RequestPolicyInterface {

  /**
   * Paths that should never be cached.
   *
   * @var array
   */
  protected const UNCACHEABLE_PATHS = [
    '/oauth',
    '/api/social-auth',
    '/api/me',
    '/user/login',
    '/user/logout',
    '/session',
  ];

  /**
   * Path prefixes that should never be cached.
   *
   * @var array
   */
  protected const UNCACHEABLE_PREFIXES = [
    '/oauth/',
    '/api/social-auth/',
    '/user/login/',
    '/jsonapi/',
    '/api/',
  ];

  /**
   * {@inheritdoc}
   */
  public function check(Request $request): ?string {
    $path = $request->getPathInfo();

    // Check exact path matches.
    foreach (self::UNCACHEABLE_PATHS as $uncacheable) {
      if ($path === $uncacheable) {
        return static::DENY;
      }
    }

    // Check path prefixes.
    foreach (self::UNCACHEABLE_PREFIXES as $prefix) {
      if (str_starts_with($path, $prefix)) {
        return static::DENY;
      }
    }

    // Check for Authorization header (OAuth bearer token).
    if ($request->headers->has('Authorization')) {
      return static::DENY;
    }

    // Allow other requests to be evaluated by other policies.
    return NULL;
  }

}
