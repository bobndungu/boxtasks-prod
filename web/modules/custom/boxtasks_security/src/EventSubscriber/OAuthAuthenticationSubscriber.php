<?php

namespace Drupal\boxtasks_security\EventSubscriber;

use Drupal\Core\Session\AccountProxyInterface;
use Drupal\user\Entity\User;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use Symfony\Component\HttpKernel\Event\RequestEvent;
use Symfony\Component\HttpKernel\KernelEvents;

/**
 * Event subscriber to authenticate users from OAuth JWT tokens.
 *
 * This subscriber runs early in the request lifecycle to authenticate
 * users from Bearer tokens before route access checks are performed.
 * This fixes 401 errors on JSON:API endpoints when using OAuth.
 */
class OAuthAuthenticationSubscriber implements EventSubscriberInterface {

  /**
   * The current user service.
   *
   * @var \Drupal\Core\Session\AccountProxyInterface
   */
  protected $currentUser;

  /**
   * Constructs an OAuthAuthenticationSubscriber object.
   *
   * @param \Drupal\Core\Session\AccountProxyInterface $current_user
   *   The current user service.
   */
  public function __construct(AccountProxyInterface $current_user) {
    $this->currentUser = $current_user;
  }

  /**
   * {@inheritdoc}
   */
  public static function getSubscribedEvents(): array {
    // Run with very high priority (before Drupal's AuthenticationSubscriber at 300).
    // Priority 350 ensures we authenticate before access checks.
    return [
      KernelEvents::REQUEST => ['onRequest', 350],
    ];
  }

  /**
   * Authenticates the user from OAuth JWT token on each request.
   *
   * @param \Symfony\Component\HttpKernel\Event\RequestEvent $event
   *   The request event.
   */
  public function onRequest(RequestEvent $event): void {
    // Only process main requests, not subrequests.
    if (!$event->isMainRequest()) {
      return;
    }

    // Skip if user is already authenticated.
    if (!$this->currentUser->isAnonymous()) {
      return;
    }

    $request = $event->getRequest();

    // Check for Bearer token in Authorization header.
    $auth_header = $request->headers->get('Authorization', '');
    if (!preg_match('/^Bearer\s+(.+)$/i', $auth_header, $matches)) {
      return;
    }

    $jwt = $matches[1];

    // Parse the JWT token to extract claims.
    $user = $this->authenticateFromJwt($jwt);
    if ($user) {
      // Set the authenticated user as the current user.
      $this->currentUser->setAccount($user);

      // Only remove the Authorization header for JSON:API routes.
      // This prevents Simple OAuth from trying to validate tokens that
      // might not be stored in the database (e.g., social auth tokens).
      // For custom API routes with _auth: ['oauth2'], we keep the header
      // so the OAuth authentication provider can satisfy the route requirement.
      $path = $request->getPathInfo();
      if (str_starts_with($path, '/jsonapi')) {
        $request->headers->remove('Authorization');
      }
    }
  }

  /**
   * Authenticate user from JWT token.
   *
   * @param string $jwt
   *   The JWT token string.
   *
   * @return \Drupal\user\Entity\User|null
   *   The authenticated user or NULL if authentication fails.
   */
  protected function authenticateFromJwt(string $jwt): ?User {
    // JWT format: header.payload.signature
    $parts = explode('.', $jwt);
    if (count($parts) !== 3) {
      return NULL;
    }

    // Decode the payload (second part).
    // Handle URL-safe base64 encoding.
    $payload = json_decode(base64_decode(strtr($parts[1], '-_', '+/')), TRUE);
    if (!$payload) {
      return NULL;
    }

    // Check if token is expired.
    if (isset($payload['exp']) && $payload['exp'] < time()) {
      return NULL;
    }

    // Check "not before" time.
    if (isset($payload['nbf']) && $payload['nbf'] > time()) {
      return NULL;
    }

    // Get user ID from the 'sub' claim (subject).
    if (!isset($payload['sub'])) {
      return NULL;
    }

    $user_id = (int) $payload['sub'];
    if ($user_id <= 0) {
      return NULL;
    }

    // Load and return the user.
    $user = User::load($user_id);
    if (!$user || !$user->isActive()) {
      return NULL;
    }

    return $user;
  }

}
