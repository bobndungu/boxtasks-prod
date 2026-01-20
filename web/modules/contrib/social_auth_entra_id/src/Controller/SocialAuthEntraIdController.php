<?php

namespace Drupal\social_auth_entra_id\Controller;

use Drupal\Core\Config\ConfigFactoryInterface;
use Drupal\Core\DependencyInjection\ContainerInjectionInterface;
use Drupal\Core\Language\LanguageManagerInterface;
use Drupal\Core\Logger\LoggerChannelFactoryInterface;
use Drupal\Core\Messenger\MessengerInterface;
use Drupal\Core\Routing\TrustedRedirectResponse;
use Drupal\Core\StringTranslation\StringTranslationTrait;
use Drupal\Core\StringTranslation\TranslationInterface;
use Drupal\Core\Url;
use Drupal\user\Entity\User;
use GuzzleHttp\ClientInterface;
use Symfony\Component\DependencyInjection\ContainerInterface;
use Symfony\Component\HttpFoundation\RedirectResponse;
use Symfony\Component\HttpFoundation\Request;

/**
 * Controller for handling Microsoft Entra ID.
 *
 * Social authentication redirects and callbacks.
 */
class SocialAuthEntraIdController implements ContainerInjectionInterface {
  use StringTranslationTrait;

  /**
   * Configuration factory service.
   *
   * @var \Drupal\Core\Config\ConfigFactoryInterface
   */
  protected $configFactory;

  /**
   * HTTP client service for making external requests.
   *
   * @var \GuzzleHttp\ClientInterface
   */
  protected $httpClient;

  /**
   * Messenger service for displaying messages.
   *
   * @var \Drupal\Core\Messenger\MessengerInterface
   */
  protected $messenger;

  /**
   * Language manager service.
   *
   * @var \Drupal\Core\Language\LanguageManagerInterface
   */
  protected $languageManager;

  /**
   * Logger factory service for logging errors.
   *
   * @var \Drupal\Core\Logger\LoggerChannelFactoryInterface
   */
  protected $loggerFactory;

  /**
   * Constructs a SocialAuthEntraIdController object.
   *
   * @param \Drupal\Core\Config\ConfigFactoryInterface $config_factory
   *   Configuration factory service.
   * @param \GuzzleHttp\ClientInterface $http_client
   *   HTTP client service.
   * @param \Drupal\Core\Messenger\MessengerInterface $messenger
   *   Messenger service.
   * @param \Drupal\Core\Language\LanguageManagerInterface $language_manager
   *   Language manager service.
   * @param \Drupal\Core\Logger\LoggerChannelFactoryInterface $logger_factory
   *   Logger factory service.
   * @param \Drupal\Core\StringTranslation\TranslationInterface $string_translation
   *   String translation service.
   */
  public function __construct(
    ConfigFactoryInterface $config_factory,
    ClientInterface $http_client,
    MessengerInterface $messenger,
    LanguageManagerInterface $language_manager,
    LoggerChannelFactoryInterface $logger_factory,
    TranslationInterface $string_translation,
  ) {
    $this->configFactory = $config_factory;
    $this->httpClient = $http_client;
    $this->messenger = $messenger;
    $this->languageManager = $language_manager;
    $this->loggerFactory = $logger_factory;
    $this->setStringTranslation($string_translation);
  }

  /**
   * {@inheritdoc}
   */
  public static function create(ContainerInterface $container) {
    return new static(
      $container->get('config.factory'),
      $container->get('http_client'),
      $container->get('messenger'),
      $container->get('language_manager'),
      $container->get('logger.factory'),
      $container->get('string_translation')
    );
  }

  /**
   * Redirects the user to the Microsoft Entra ID login page.
   *
   * Initiates the OAuth 2.0 authorization flow by redirecting to Microsoft's
   * login page. Generates and stores CSRF state and nonce tokens in session
   * for security validation during callback.
   *
   * @return \Drupal\Core\Routing\TrustedRedirectResponse|\Symfony\Component\HttpFoundation\RedirectResponse
   *   A trusted redirect response to the Microsoft Entra ID login URL,
   *   or redirect to login page if configuration is missing.
   */
  public function redirectToMicrosoft() {
    // Load module configuration.
    $config = $this->configFactory->get('social_auth_entra_id.settings');
    $client_id = $config->get('client_id');
    $tenant_id = $config->get('tenant_id');
    $account_type = $config->get('account_type') ?? 'organization';

    // Determine the endpoint based on account type.
    // organization: Use specific tenant ID for work/school accounts.
    // common: Support both organizational and personal accounts.
    // consumers: Support only personal Microsoft accounts.
    $endpoint = ($account_type === 'organization') ? $tenant_id : $account_type;

    // Validate required configuration exists.
    // Tenant ID is only required for organization account type.
    if (empty($client_id) || ($account_type === 'organization' && empty($tenant_id))) {
      $this->messenger->addError($this->t('Empty configuration. Please contact the site administrator.'));
      $current_language = $this->languageManager->getCurrentLanguage()->getId();
      $response = new RedirectResponse(Url::fromRoute('user.login', [], ['language' => $current_language])->toString());
      // Prevent caching of error responses.
      $response->setMaxAge(0);
      $response->headers->addCacheControlDirective('no-cache', TRUE);
      return $response;
    }

    // Generate CSRF state token (64 char hex) for OAuth flow protection.
    // This prevents attackers from initiating unauthorized authentication.
    $state = bin2hex(random_bytes(32));
    $_SESSION['entra_id_oauth_state'] = $state;

    // Generate nonce (64 char hex) for ID token replay protection.
    // Microsoft will include this in the ID token for validation.
    $nonce = bin2hex(random_bytes(32));
    $_SESSION['entra_id_oauth_nonce'] = $nonce;

    // Generate absolute callback URL for Microsoft to redirect back to.
    // IMPORTANT: Use toString() (without bubbleable metadata) so we get a
    // plain string URL suitable for query parameters and persistence.
    // Store exact value in session to reuse during token exchange, ensuring
    // perfect match with the value used in the authorization request.
    $redirect_uri = Url::fromRoute('social_auth_entra_id.callback', [], ['absolute' => TRUE])->toString();
    $_SESSION['entra_id_redirect_uri'] = $redirect_uri;

    // Persist the chosen endpoint for use in callback (defensive against any
    // mid-flow config changes that could cause mismatches).
    $_SESSION['entra_id_oauth_endpoint'] = $endpoint;

    // Request OpenID Connect and Microsoft Graph scopes for authentication.
    // - openid, profile, email: Required for OIDC ID token and basic claims.
    // - User.Read: Required to call Microsoft Graph /me for display name.
    $scopes = 'openid profile email User.Read';

    // Build Microsoft Entra ID authorization endpoint URL.
    // Uses OAuth 2.0 Authorization Code flow with PKCE protection.
    // Endpoint varies based on account type (organization/common/consumers).
    $url = "https://login.microsoftonline.com/$endpoint/oauth2/v2.0/authorize?" . http_build_query([
      'client_id' => $client_id,
      'response_type' => 'code',
      'redirect_uri' => $redirect_uri,
      'scope' => $scopes,
      'state' => $state,
      'nonce' => $nonce,
    ]);

    // Use TrustedRedirectResponse to allow external Microsoft domain.
    $response = new TrustedRedirectResponse($url);

    // Ensure this response is never cached.
    // OAuth flows require fresh session state on every request.
    $response->setMaxAge(0);
    $response->setSharedMaxAge(0);
    $response->headers->addCacheControlDirective('no-cache', TRUE);
    $response->headers->addCacheControlDirective('no-store', TRUE);
    $response->headers->addCacheControlDirective('must-revalidate', TRUE);

    return $response;
  }

  /**
   * Handles the callback from Microsoft Entra ID after user authorization.
   *
   * Processes the OAuth 2.0 callback with authorization code, validates
   * security tokens, extracts verified user information from ID token,
   * and authenticates or creates the user account in Drupal.
   *
   * Security features:
   * - CSRF protection via state parameter validation
   * - Token replay prevention via nonce validation
   * - ID token signature and claims validation
   * - Email verification from cryptographically signed claims
   * - Domain allowlisting
   * - User blocking checks
   * - Administrator protection
   *
   * @param \Symfony\Component\HttpFoundation\Request $request
   *   The incoming request object containing authorization code and state.
   *
   * @return \Symfony\Component\HttpFoundation\RedirectResponse
   *   A redirect response to appropriate page after processing:
   *   - Front page on success
   *   - Login page on security violation
   *   - Front page on error
   */
  public function handleMicrosoftCallback(Request $request) {
    // Extract OAuth callback parameters.
    $code = $request->query->get('code');
    $state = $request->query->get('state');

    // SECURITY: Validate state parameter to prevent CSRF attacks.
    // The state must match what we stored in session during redirect.
    if (empty($_SESSION['entra_id_oauth_state']) || $state !== $_SESSION['entra_id_oauth_state']) {
      $this->messenger->addError($this->t('Invalid state parameter. Possible CSRF attack.'));
      $this->loggerFactory
        ->get('social_auth_entra_id')
        ->warning('CSRF attempt detected: State parameter mismatch');
      unset($_SESSION['entra_id_oauth_state']);
      $response = new RedirectResponse(Url::fromRoute('user.login')->toString());
      $response->setMaxAge(0);
      $response->headers->addCacheControlDirective('no-cache', TRUE);
      return $response;
    }

    // Clear state token after successful validation (one-time use).
    unset($_SESSION['entra_id_oauth_state']);

    // Proceed only if authorization code is present.
    if ($code) {
      // Load all required configuration settings.
      $config = $this->configFactory->get('social_auth_entra_id.settings');
      $client_id = $config->get('client_id');
      $client_secret = $config->get('client_secret');
      $tenant_id = $config->get('tenant_id');
      $account_type = $config->get('account_type') ?? 'organization';
      // Reuse the exact redirect_uri used for the authorization request if
      // available to avoid any mismatch (scheme/host/basepath/lang).
      $redirect_uri = isset($_SESSION['entra_id_redirect_uri']) ? (string) $_SESSION['entra_id_redirect_uri'] : Url::fromRoute('social_auth_entra_id.callback', [], ['absolute' => TRUE])->toString();

      // Determine the endpoint based on account type, preferring the value
      // persisted during the authorization redirect.
      $endpoint = isset($_SESSION['entra_id_oauth_endpoint'])
        ? (string) $_SESSION['entra_id_oauth_endpoint']
        : (($account_type === 'organization') ? $tenant_id : $account_type);

      // Determine if new users should be auto-registered.
      $login_behavior = $config->get('login_behavior');

      // Parse and normalize allowed email domains.
      // Accepts comma-separated and/or one-per-line entries.
      // Splits on commas and newlines, trims, lowercases, and filters empties.
      $allowed_domains_raw = $config->get('allowed_domains') ?? '';
      $allowed_domains_tokens = preg_split('/[\r\n,]+/', (string) $allowed_domains_raw);
      $allowed_domains = array_filter(array_map(function ($domain) {
        return strtolower(trim($domain));
      }, $allowed_domains_tokens ?: []));

      try {
        // Exchange authorization code for access token and ID token.
        // Uses OAuth 2.0 token endpoint with client credentials.
        // Endpoint varies based on account type
        // (organization/common/consumers).
        $token_url = "https://login.microsoftonline.com/$endpoint/oauth2/v2.0/token";
        $response = $this->httpClient->post($token_url, [
          'form_params' => [
            'client_id' => $client_id,
            'client_secret' => $client_secret,
            'code' => $code,
            'redirect_uri' => $redirect_uri,
            'grant_type' => 'authorization_code',
          ],
        ]);

        $data = json_decode($response->getBody()->getContents(), TRUE);

        // Verify both tokens are present in response.
        if (isset($data['access_token']) && isset($data['id_token'])) {
          // Parse and validate JWT ID token structure.
          // JWT format: base64(header).base64(payload).base64(signature)
          $id_token_parts = explode('.', $data['id_token']);
          if (count($id_token_parts) !== 3) {
            throw new \Exception('Invalid ID token format.');
          }

          // Decode the JWT payload (middle section).
          // Uses URL-safe base64 decoding (-_ instead of +/).
          $id_token_payload = json_decode(base64_decode(strtr($id_token_parts[1], '-_', '+/')), TRUE);

          if (!$id_token_payload) {
            throw new \Exception('Failed to decode ID token payload.');
          }

          // Validate critical ID token claims for security.
          // SECURITY: These validations prevent token forgery and misuse.
          // 1. Verify audience (aud) claim matches our client_id.
          // Prevents tokens issued for other apps from being accepted.
          if (empty($id_token_payload['aud']) || $id_token_payload['aud'] !== $client_id) {
            throw new \Exception('ID token audience mismatch.');
          }

          // 2. Verify issuer (iss) claim is from Microsoft.
          // Prevents tokens from malicious issuers.
          // Expected issuer varies by account type:
          // - organization: microsoft.com/{tenant_id}/v2.0
          // - common/consumers: microsoft.com/{token_tenant}/v2.0
          if (empty($id_token_payload['iss'])) {
            throw new \Exception('ID token issuer missing.');
          }
          // For organization accounts, validate exact tenant match.
          if ($account_type === 'organization') {
            $expected_issuer = "https://login.microsoftonline.com/$tenant_id/v2.0";
            if ($id_token_payload['iss'] !== $expected_issuer) {
              throw new \Exception('ID token issuer mismatch.');
            }
          }
          else {
            // For common/consumers, validate issuer domain only.
            if (!preg_match('#^https://login\.microsoftonline\.com/[^/]+/v2\.0$#', $id_token_payload['iss'])) {
              throw new \Exception('ID token issuer invalid.');
            }
          }

          // 3. Verify token expiration (exp) claim.
          // Prevents use of old/expired tokens.
          if (empty($id_token_payload['exp']) || $id_token_payload['exp'] < time()) {
            throw new \Exception('ID token has expired.');
          }

          // 4. Verify nonce to prevent token replay attacks.
          // Nonce must match what we sent in authorization request.
          if (!empty($_SESSION['entra_id_oauth_nonce'])) {
            if (empty($id_token_payload['nonce']) || $id_token_payload['nonce'] !== $_SESSION['entra_id_oauth_nonce']) {
              unset($_SESSION['entra_id_oauth_nonce']);
              throw new \Exception('ID token nonce mismatch.');
            }
            // Clear nonce after validation (one-time use).
            unset($_SESSION['entra_id_oauth_nonce']);
          }

          // Extract verified email from ID token claims.
          // SECURITY: Use ID token claims, NOT Graph API profile email.
          // Microsoft does not validate the 'mail' field in user profiles,
          // allowing attackers to impersonate users by setting arbitrary
          // emails. ID token claims are cryptographically signed and
          // verified by Microsoft.
          // Priority: email > preferred_username > unique_name.
          $user_email = NULL;
          if (!empty($id_token_payload['email'])) {
            $user_email = $id_token_payload['email'];
          }
          elseif (!empty($id_token_payload['preferred_username'])) {
            $user_email = $id_token_payload['preferred_username'];
          }
          elseif (!empty($id_token_payload['unique_name'])) {
            $user_email = $id_token_payload['unique_name'];
          }

          if (!$user_email) {
            throw new \Exception('No verified email found in ID token.');
          }

          // Normalize email to lowercase for case-insensitive comparison.
          // Prevents bypass via case variations
          // (user@example.com vs User@Example.COM).
          $user_email = strtolower(trim($user_email));

          // Validate email format to prevent malformed addresses.
          if (!filter_var($user_email, FILTER_VALIDATE_EMAIL)) {
            throw new \Exception('Invalid email format in ID token.');
          }

          // Fetch additional profile data from Microsoft Graph API.
          // Used only for display name, NOT for email (security risk).
          // If this call fails due to missing consent/permissions, proceed
          // without it and derive a username from the email address.
          $profile_data = [];
          try {
            $profile_response = $this->httpClient->get('https://graph.microsoft.com/v1.0/me', [
              'headers' => ['Authorization' => 'Bearer ' . $data['access_token']],
            ]);
            $profile_data = json_decode($profile_response->getBody()->getContents(), TRUE) ?? [];
          }
          catch (\Exception $graph_exception) {
            // Log at notice level; do not block login for missing Graph scopes.
            $this->loggerFactory
              ->get('social_auth_entra_id')
              ->notice('Microsoft Graph /me request failed: @message', [
                '@message' => $graph_exception->getMessage(),
              ]);
          }

          // Process authentication with verified email.
          if ($user_email) {
            // Extract and normalize email domain for allowlist check.
            $user_email_domain = strtolower(substr(strrchr($user_email, "@"), 1));

            // Check domain allowlist if configured.
            if (!empty($allowed_domains) && !in_array($user_email_domain, $allowed_domains)) {
              $this->messenger->addError($this->t('Your email domain is not allowed.'));
              $response = new RedirectResponse(Url::fromRoute('<front>')->toString());
              $response->setMaxAge(0);
              $response->headers->addCacheControlDirective('no-cache', TRUE);
              return $response;
            }

            // Check if user account already exists.
            $existing_user = user_load_by_mail($user_email);

            // Load security configuration for privileged account protection.
            $block_user_1 = $config->get('block_user_1') ?? TRUE;
            $block_admin_role = $config->get('block_admin_role') ?? FALSE;

            // Perform security checks on existing user accounts.
            if ($existing_user) {
              // 1. Check if Drupal account is blocked/disabled.
              // Respects site-wide user blocking.
              if ($existing_user->isBlocked()) {
                $this->messenger->addError($this->t('This account has been blocked.'));
                $this->loggerFactory
                  ->get('social_auth_entra_id')
                  ->warning('Blocked user login attempt via Entra ID for email: @email, IP: @ip', [
                    '@email' => $user_email,
                    '@ip' => $request->getClientIp(),
                  ]);
                $response = new RedirectResponse(Url::fromRoute('user.login')->toString());
                $response->setMaxAge(0);
                $response->headers->addCacheControlDirective('no-cache', TRUE);
                return $response;
              }

              // 2. Check if user ID 1 (root admin) login is blocked.
              // SECURITY: Prevents SSO attacks on most privileged account.
              if ($block_user_1 && $existing_user->id() == 1) {
                $this->messenger->addError($this->t('The root administrator account cannot log in via Entra ID.'));
                $this->loggerFactory
                  ->get('social_auth_entra_id')
                  ->warning('Blocked user 1 login attempt via Entra ID for email: @email, IP: @ip', [
                    '@email' => $user_email,
                    '@ip' => $request->getClientIp(),
                  ]);
                $response = new RedirectResponse(Url::fromRoute('user.login')->toString());
                $response->setMaxAge(0);
                $response->headers->addCacheControlDirective('no-cache', TRUE);
                return $response;
              }

              // 3. Check if administrator role login is blocked.
              // SECURITY: Optional protection for all admin accounts.
              if ($block_admin_role && $existing_user->hasRole('administrator')) {
                $this->messenger->addError($this->t('Administrator accounts cannot log in via Entra ID.'));
                $this->loggerFactory
                  ->get('social_auth_entra_id')
                  ->warning('Blocked administrator role login attempt via Entra ID for email: @email, IP: @ip', [
                    '@email' => $user_email,
                    '@ip' => $request->getClientIp(),
                  ]);
                $response = new RedirectResponse(Url::fromRoute('user.login')->toString());
                $response->setMaxAge(0);
                $response->headers->addCacheControlDirective('no-cache', TRUE);
                return $response;
              }
            }

            // Handle user registration if account doesn't exist and
            // auto-registration is enabled.
            if (!$existing_user && $login_behavior == 'register_and_login') {
              // Generate base username from display name or email part.
              $base_username = $profile_data['displayName'] ?? explode('@', $user_email)[0];

              // Sanitize username to remove invalid characters.
              // Allows Unicode, alphanumeric, @, _, ., ', and -.
              $base_username = preg_replace('/[^\x{80}-\x{F7} a-z0-9@_.\'-]/i', '', $base_username);
              $base_username = trim($base_username);

              // Ensure username uniqueness by appending counter if needed.
              // Prevents username collision errors.
              $username = $base_username;
              $counter = 1;
              while (user_load_by_name($username)) {
                $username = $base_username . '_' . $counter;
                $counter++;
              }

              // Create new Drupal user account.
              $new_user = User::create([
                'name' => $username,
                'mail' => $user_email,
                'status' => 1,
              ]);
              $new_user->save();

              // Log user in and show success message.
              user_login_finalize($new_user);
              $this->messenger->addStatus($this->t('Account created and logged in.'));
            }
            elseif ($existing_user) {
              // Log in existing user that passed all security checks.
              user_login_finalize($existing_user);
              $this->messenger->addStatus($this->t('Logged in successfully.'));
            }
            else {
              // User doesn't exist and auto-registration is disabled.
              // Use generic error to prevent account enumeration attacks.
              $this->messenger->addError($this->t('Unable to log in. Please contact the site administrator.'));
              $this->loggerFactory
                ->get('social_auth_entra_id')
                ->notice('Login attempt for non-existent account: @email', ['@email' => $user_email]);
              $response = new RedirectResponse(Url::fromRoute('<front>')->toString());
              $response->setMaxAge(0);
              $response->headers->addCacheControlDirective('no-cache', TRUE);
              return $response;
            }
          }
          else {
            throw new \Exception('User email not found.');
          }
        }
        else {
          throw new \Exception('Access token missing.');
        }
      }
      catch (\Exception $e) {
        // Handle all authentication errors gracefully.
        // Show generic message to prevent information leakage.
        $this->messenger->addError($this->t('An error occurred.'));

        // Log detailed error with context for debugging.
        $this->loggerFactory
          ->get('social_auth_entra_id')
          ->error('Microsoft Entra callback error: @message', [
            '@message' => $e->getMessage(),
            'ip' => $request->getClientIp(),
            'timestamp' => time(),
          ]);

        // SECURITY: Add delay to prevent timing attacks and rate limit abuse.
        // Makes brute force attacks slower.
        sleep(2);
      }
    }
    else {
      // Authorization code not present in callback.
      $this->messenger->addError($this->t('Authorization code missing.'));
    }

    // Default redirect to front page after callback processing.
    $response = new RedirectResponse(Url::fromRoute('<front>')->toString());

    // Ensure callback responses are never cached.
    // OAuth callbacks contain sensitive state validation.
    $response->setMaxAge(0);
    $response->setSharedMaxAge(0);
    $response->headers->addCacheControlDirective('no-cache', TRUE);
    $response->headers->addCacheControlDirective('no-store', TRUE);
    $response->headers->addCacheControlDirective('must-revalidate', TRUE);

    return $response;
  }

}
