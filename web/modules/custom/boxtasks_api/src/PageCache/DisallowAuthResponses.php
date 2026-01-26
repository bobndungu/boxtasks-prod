<?php

declare(strict_types=1);

namespace Drupal\boxtasks_api\PageCache;

use Drupal\Core\PageCache\ResponsePolicyInterface;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Cache policy that disallows caching of authentication-related responses.
 *
 * This policy ensures that responses from OAuth, social auth, and user-specific
 * API endpoints are never cached by Drupal's dynamic page cache.
 */
class DisallowAuthResponses implements ResponsePolicyInterface {

  /**
   * Paths that should never have their responses cached.
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
   * Path prefixes that should never have their responses cached.
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
  public function check(Response $response, Request $request): ?string {
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

    // Check if response has private cache-control.
    $cacheControl = $response->headers->get('Cache-Control', '');
    if (str_contains($cacheControl, 'private') || str_contains($cacheControl, 'no-store')) {
      return static::DENY;
    }

    // Allow other responses to be evaluated by other policies.
    return NULL;
  }

}
