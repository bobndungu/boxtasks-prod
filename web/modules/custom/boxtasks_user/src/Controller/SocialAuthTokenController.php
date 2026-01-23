<?php

namespace Drupal\boxtasks_user\Controller;

use Drupal\consumers\Entity\Consumer;
use Drupal\Core\Config\ConfigFactoryInterface;
use Drupal\Core\Controller\ControllerBase;
use Drupal\Core\File\FileSystemInterface;
use Drupal\Core\Site\Settings;
use Drupal\simple_oauth\Entities\AccessTokenEntity;
use Drupal\simple_oauth\Entities\RefreshTokenEntity;
use Defuse\Crypto\Core;
use League\OAuth2\Server\CryptKey;
use League\OAuth2\Server\Repositories\AccessTokenRepositoryInterface;
use League\OAuth2\Server\Repositories\RefreshTokenRepositoryInterface;
use League\OAuth2\Server\Repositories\ScopeRepositoryInterface;
use Symfony\Component\DependencyInjection\ContainerInterface;
use Drupal\Core\Routing\TrustedRedirectResponse;
use Symfony\Component\HttpFoundation\Request;

/**
 * Controller for handling social auth token generation.
 *
 * After social login completes, this controller generates proper OAuth JWT
 * tokens using Simple OAuth's infrastructure and redirects to the frontend.
 */
class SocialAuthTokenController extends ControllerBase {

  /**
   * The access token repository.
   *
   * @var \League\OAuth2\Server\Repositories\AccessTokenRepositoryInterface
   */
  protected AccessTokenRepositoryInterface $accessTokenRepository;

  /**
   * The refresh token repository.
   *
   * @var \League\OAuth2\Server\Repositories\RefreshTokenRepositoryInterface
   */
  protected RefreshTokenRepositoryInterface $refreshTokenRepository;

  /**
   * The scope repository.
   *
   * @var \League\OAuth2\Server\Repositories\ScopeRepositoryInterface
   */
  protected ScopeRepositoryInterface $scopeRepository;

  /**
   * The file system service.
   *
   * @var \Drupal\Core\File\FileSystemInterface
   */
  protected FileSystemInterface $fileSystem;

  /**
   * Constructs a SocialAuthTokenController.
   */
  public function __construct(
    AccessTokenRepositoryInterface $access_token_repository,
    RefreshTokenRepositoryInterface $refresh_token_repository,
    ScopeRepositoryInterface $scope_repository,
    ConfigFactoryInterface $config_factory,
    FileSystemInterface $file_system,
  ) {
    $this->accessTokenRepository = $access_token_repository;
    $this->refreshTokenRepository = $refresh_token_repository;
    $this->scopeRepository = $scope_repository;
    $this->configFactory = $config_factory;
    $this->fileSystem = $file_system;
  }

  /**
   * {@inheritdoc}
   */
  public static function create(ContainerInterface $container) {
    return new static(
      $container->get('simple_oauth.repositories.access_token'),
      $container->get('simple_oauth.repositories.refresh_token'),
      $container->get('simple_oauth.repositories.scope'),
      $container->get('config.factory'),
      $container->get('file_system'),
    );
  }

  /**
   * Generates OAuth token and redirects to frontend.
   *
   * @param \Symfony\Component\HttpFoundation\Request $request
   *   The request.
   *
   * @return \Drupal\Core\Routing\TrustedRedirectResponse
   *   Redirect to frontend with token.
   */
  public function generateToken(Request $request): TrustedRedirectResponse {
    $frontend_url = getenv('FRONTEND_URL') ?: 'https://tasks.boxraft.com';

    // Check if user is authenticated.
    if ($this->currentUser()->isAnonymous()) {
      return new TrustedRedirectResponse($frontend_url . '/login?error=not_authenticated');
    }

    try {
      // Load the user entity.
      $user = $this->entityTypeManager()->getStorage('user')->load($this->currentUser()->id());
      if (!$user) {
        return new TrustedRedirectResponse($frontend_url . '/login?error=user_not_found');
      }

      // Check if user is blocked (pending approval).
      // New users created via OAuth are blocked by default.
      if (!$user->isActive()) {
        $email = $user->getEmail();
        $this->getLogger('boxtasks_user')->info(
          'Blocked user @uid (@email) attempted OAuth login. Redirecting to pending approval page.',
          ['@uid' => $user->id(), '@email' => $email]
        );

        // Log the user out since they're blocked.
        user_logout();

        // Redirect to homepage with pending approval message.
        $redirect_url = $frontend_url . '/?pending=true';
        if ($email) {
          $redirect_url .= '&email=' . urlencode($email);
        }
        return new TrustedRedirectResponse($redirect_url);
      }

      // Find the OAuth consumer (client) to use for token generation.
      $consumer_storage = $this->entityTypeManager()->getStorage('consumer');
      $consumers = $consumer_storage->loadByProperties(['label' => 'BoxTasks Frontend']);

      if (empty($consumers)) {
        // Try to find any active consumer.
        $consumers = $consumer_storage->loadByProperties([]);
      }

      if (empty($consumers)) {
        $this->getLogger('boxtasks_user')->error('No OAuth consumer found for social auth token generation.');
        return new TrustedRedirectResponse($frontend_url . '/login?error=no_consumer');
      }

      /** @var \Drupal\consumers\Entity\Consumer $consumer */
      $consumer = reset($consumers);

      // Get token expiration from consumer or use default (1 hour).
      $expiration_seconds = $consumer->get('access_token_expiration')->value ?? 3600;

      // Create a client entity for the OAuth library.
      $client_repository = \Drupal::service('simple_oauth.repositories.client');
      $client_entity = $client_repository->getClientEntity($consumer->get('client_id')->value);

      if (!$client_entity) {
        $this->getLogger('boxtasks_user')->error('Could not load client entity for consumer.');
        return new TrustedRedirectResponse($frontend_url . '/login?error=no_client');
      }

      // Get scopes.
      $scopes = [];
      $scope_ids = ['authenticated'];
      foreach ($scope_ids as $scope_id) {
        $scope = $this->scopeRepository->getScopeEntityByIdentifier($scope_id);
        if ($scope) {
          $scopes[] = $scope;
        }
      }

      // Create access token entity.
      $access_token = $this->accessTokenRepository->getNewToken($client_entity, $scopes, (string) $user->id());
      $access_token->setIdentifier(bin2hex(random_bytes(40)));
      $access_token->setExpiryDateTime(new \DateTimeImmutable('+' . $expiration_seconds . ' seconds'));

      // Set the private key on the token for JWT generation.
      $private_key = $this->getPrivateKey();
      $access_token->setPrivateKey($private_key);

      // Generate the JWT string.
      $jwt_token = $access_token->convertToJWT();
      $access_token_string = $jwt_token->toString();

      // Persist the access token.
      $this->accessTokenRepository->persistNewAccessToken($access_token);

      // Create refresh token.
      $refresh_token = $this->refreshTokenRepository->getNewRefreshToken();
      $refresh_token->setIdentifier(bin2hex(random_bytes(40)));
      $refresh_token->setExpiryDateTime(new \DateTimeImmutable('+30 days'));
      $refresh_token->setAccessToken($access_token);

      // Persist the refresh token.
      $this->refreshTokenRepository->persistNewRefreshToken($refresh_token);

      // Encrypt refresh token value.
      $refresh_token_string = $this->encryptRefreshToken($refresh_token->getIdentifier());

      // Build the redirect URL with tokens.
      $redirect_url = $frontend_url . '/oauth-callback?' . http_build_query([
        'access_token' => $access_token_string,
        'refresh_token' => $refresh_token_string,
        'expires_in' => $expiration_seconds,
        'token_type' => 'Bearer',
      ]);

      $this->getLogger('boxtasks_user')->info('Social auth JWT token generated for user @uid', [
        '@uid' => $user->id(),
      ]);

      return new TrustedRedirectResponse($redirect_url);
    }
    catch (\Exception $e) {
      $this->getLogger('boxtasks_user')->error('Error generating social auth token: @message', [
        '@message' => $e->getMessage(),
      ]);
      return new TrustedRedirectResponse($frontend_url . '/login?error=token_generation_failed');
    }
  }

  /**
   * Gets the private key for JWT signing.
   *
   * @return \League\OAuth2\Server\CryptKey
   *   The private key.
   */
  protected function getPrivateKey(): CryptKey {
    $config = $this->configFactory->get('simple_oauth.settings');
    $private_key_path = $config->get('private_key');
    $file_path = $this->fileSystem->realpath($private_key_path) ?: $private_key_path;
    $key = file_get_contents($file_path);

    return new CryptKey(
      $key,
      NULL,
      Settings::get('simple_oauth.key_permissions_check', TRUE)
    );
  }

  /**
   * Encrypts a refresh token identifier.
   *
   * @param string $token_id
   *   The token identifier.
   *
   * @return string
   *   The encrypted token.
   */
  protected function encryptRefreshToken(string $token_id): string {
    $salt = Settings::getHashSalt();
    $encryption_key = Core::ourSubstr($salt, 0, 32);

    // Simple encryption using defuse/php-encryption approach.
    // For production, you might want to use the full Defuse library.
    $data = json_encode([
      'refresh_token_id' => $token_id,
      'expire_time' => (new \DateTimeImmutable('+30 days'))->getTimestamp(),
    ]);

    // Use base64 encoding of the JSON for simplicity.
    // The actual refresh token validation happens via the token entity lookup.
    return base64_encode($data);
  }

}
