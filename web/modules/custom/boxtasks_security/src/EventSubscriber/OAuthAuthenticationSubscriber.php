<?php

namespace Drupal\boxtasks_security\EventSubscriber;

use Drupal\Core\Entity\EntityTypeManagerInterface;
use Drupal\Core\Session\AccountProxyInterface;
use Drupal\simple_oauth\Server\ResourceServerFactoryInterface;
use Drupal\user\Entity\User;
use League\OAuth2\Server\Exception\OAuthServerException;
use Symfony\Bridge\PsrHttpMessage\HttpFoundationFactoryInterface;
use Symfony\Bridge\PsrHttpMessage\HttpMessageFactoryInterface;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use Symfony\Component\HttpKernel\Event\RequestEvent;
use Symfony\Component\HttpKernel\KernelEvents;

/**
 * Event subscriber to authenticate users from OAuth JWT tokens.
 *
 * This subscriber runs early in the request lifecycle to authenticate
 * users from Bearer tokens before route access checks are performed.
 * This fixes 401 errors on JSON:API endpoints when using OAuth.
 *
 * SECURITY: JWT signatures are properly verified using the OAuth public key.
 */
class OAuthAuthenticationSubscriber implements EventSubscriberInterface {

  /**
   * The current user service.
   *
   * @var \Drupal\Core\Session\AccountProxyInterface
   */
  protected $currentUser;

  /**
   * The resource server factory.
   *
   * @var \Drupal\simple_oauth\Server\ResourceServerFactoryInterface
   */
  protected $resourceServerFactory;

  /**
   * The entity type manager.
   *
   * @var \Drupal\Core\Entity\EntityTypeManagerInterface
   */
  protected $entityTypeManager;

  /**
   * The HTTP message factory.
   *
   * @var \Symfony\Bridge\PsrHttpMessage\HttpMessageFactoryInterface
   */
  protected $httpMessageFactory;

  /**
   * The HTTP foundation factory.
   *
   * @var \Symfony\Bridge\PsrHttpMessage\HttpFoundationFactoryInterface
   */
  protected $httpFoundationFactory;

  /**
   * Constructs an OAuthAuthenticationSubscriber object.
   *
   * @param \Drupal\Core\Session\AccountProxyInterface $current_user
   *   The current user service.
   * @param \Drupal\simple_oauth\Server\ResourceServerFactoryInterface $resource_server_factory
   *   The resource server factory for JWT validation.
   * @param \Drupal\Core\Entity\EntityTypeManagerInterface $entity_type_manager
   *   The entity type manager.
   * @param \Symfony\Bridge\PsrHttpMessage\HttpMessageFactoryInterface $http_message_factory
   *   The HTTP message factory.
   * @param \Symfony\Bridge\PsrHttpMessage\HttpFoundationFactoryInterface $http_foundation_factory
   *   The HTTP foundation factory.
   */
  public function __construct(
    AccountProxyInterface $current_user,
    ResourceServerFactoryInterface $resource_server_factory,
    EntityTypeManagerInterface $entity_type_manager,
    HttpMessageFactoryInterface $http_message_factory,
    HttpFoundationFactoryInterface $http_foundation_factory
  ) {
    $this->currentUser = $current_user;
    $this->resourceServerFactory = $resource_server_factory;
    $this->entityTypeManager = $entity_type_manager;
    $this->httpMessageFactory = $http_message_factory;
    $this->httpFoundationFactory = $http_foundation_factory;
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

    // Validate the JWT token using Simple OAuth's resource server
    // which properly verifies the cryptographic signature.
    $user = $this->authenticateFromJwt($request);
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
   * Authenticate user from JWT token with proper signature verification.
   *
   * @param \Symfony\Component\HttpFoundation\Request $request
   *   The HTTP request containing the JWT token.
   *
   * @return \Drupal\user\Entity\User|null
   *   The authenticated user or NULL if authentication fails.
   */
  protected function authenticateFromJwt($request): ?User {
    try {
      // Create a PSR-7 message from the request.
      $psr7_request = $this->httpMessageFactory->createRequest($request);

      // Get the resource server and validate the request.
      // This performs CRYPTOGRAPHIC SIGNATURE VERIFICATION of the JWT.
      $resource_server = $this->resourceServerFactory->get();
      $validated_request = $resource_server->validateAuthenticatedRequest($psr7_request);

      // Convert back to Symfony request to get the OAuth attributes.
      $auth_request = $this->httpFoundationFactory->createRequest($validated_request);

      // Get the access token ID from the validated request.
      $access_token_id = $auth_request->get('oauth_access_token_id');
      if (!$access_token_id) {
        return NULL;
      }

      // Load the token entity from the database.
      $tokens = $this->entityTypeManager
        ->getStorage('oauth2_token')
        ->loadByProperties(['value' => $access_token_id]);

      $token = reset($tokens);
      if (!$token) {
        // Token not found in database - might be a social auth token.
        // Fall back to extracting user from JWT claims.
        $oauth_user_id = $auth_request->get('oauth_user_id');
        if ($oauth_user_id) {
          $user = User::load($oauth_user_id);
          if ($user && $user->isActive()) {
            return $user;
          }
        }
        return NULL;
      }

      // Check if token is revoked.
      if ($token->isRevoked()) {
        return NULL;
      }

      // Get the user from the token.
      $user_id = $token->get('auth_user_id')->target_id;
      if (!$user_id) {
        return NULL;
      }

      $user = User::load($user_id);
      if (!$user || !$user->isActive()) {
        return NULL;
      }

      return $user;
    }
    catch (OAuthServerException $e) {
      // JWT signature verification failed or token is invalid.
      // Log this as a potential security event.
      \Drupal::logger('boxtasks_security')->warning(
        'JWT authentication failed: @message',
        ['@message' => $e->getMessage()]
      );
      return NULL;
    }
    catch (\Exception $e) {
      // Catch any other exceptions to prevent error disclosure.
      \Drupal::logger('boxtasks_security')->error(
        'Unexpected error during JWT authentication: @message',
        ['@message' => $e->getMessage()]
      );
      return NULL;
    }
  }

}
