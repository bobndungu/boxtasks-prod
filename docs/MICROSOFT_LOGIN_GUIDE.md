# Microsoft Login Implementation Guide

## Drupal Backend + React Frontend (Decoupled Architecture)

This guide explains how to implement Microsoft Entra ID (formerly Azure AD) login for a decoupled application with Drupal as the backend API and React as the frontend.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Azure Portal Configuration](#azure-portal-configuration)
4. [Drupal Backend Setup](#drupal-backend-setup)
5. [Custom Token Generation](#custom-token-generation)
6. [React Frontend Setup](#react-frontend-setup)
7. [Complete Authentication Flow](#complete-authentication-flow)
8. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

### The Challenge

In a decoupled architecture, social login presents a unique challenge:

1. **Social Auth modules** (like `social_auth_entra_id`) create **Drupal sessions** (cookie-based)
2. **Decoupled frontends** need **OAuth tokens** (JWT-based) for API access
3. The frontend runs on a different origin, so session cookies don't work

### The Solution

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   React     │     │    Microsoft     │     │     Drupal      │
│  Frontend   │     │    Entra ID      │     │    Backend      │
└──────┬──────┘     └────────┬─────────┘     └────────┬────────┘
       │                     │                        │
       │  1. Click Login     │                        │
       ├────────────────────────────────────────────►│
       │                     │                        │
       │  2. Redirect to Microsoft                    │
       │◄─────────────────────────────────────────────┤
       │                     │                        │
       ├────────────────────►│                        │
       │  3. User authenticates                       │
       │◄────────────────────┤                        │
       │                     │                        │
       │  4. Auth code callback                       │
       ├────────────────────────────────────────────►│
       │                     │  5. Exchange code      │
       │                     │◄───────────────────────┤
       │                     │  6. Return tokens      │
       │                     ├───────────────────────►│
       │                     │                        │
       │  7. Generate JWT tokens (Simple OAuth)       │
       │◄─────────────────────────────────────────────┤
       │                     │                        │
       │  8. Store tokens, fetch user                 │
       ├────────────────────────────────────────────►│
       │                     │                        │
       │  9. User data returned                       │
       │◄─────────────────────────────────────────────┤
       │                     │                        │
```

---

## Prerequisites

### Drupal Modules

```bash
composer require drupal/social_auth drupal/social_auth_entra_id drupal/simple_oauth drupal/consumers
drush en social_auth social_auth_entra_id simple_oauth consumers -y
```

### PHP Libraries

The `social_auth_entra_id` module requires:
```bash
composer require thenetworg/oauth2-azure
```

### Simple OAuth Keys

Generate RSA keys for JWT signing:
```bash
# Create keys directory (outside web root)
mkdir -p /path/to/keys

# Generate private key
openssl genrsa -out /path/to/keys/private.key 2048

# Generate public key
openssl rsa -in /path/to/keys/private.key -pubout -out /path/to/keys/public.key

# Set permissions
chmod 600 /path/to/keys/private.key
chmod 644 /path/to/keys/public.key
```

Configure keys in Drupal:
- Go to `/admin/config/people/simple_oauth`
- Set private key path: `/path/to/keys/private.key`
- Set public key path: `/path/to/keys/public.key`

---

## Azure Portal Configuration

### 1. Create App Registration

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** → **App registrations**
3. Click **New registration**
4. Configure:
   - **Name**: Your App Name (e.g., "BoxTasks")
   - **Supported account types**: Choose based on your needs
     - `organization` - Single tenant (your org only)
     - `common` - Multi-tenant + personal accounts
     - `consumers` - Personal Microsoft accounts only
   - **Redirect URI**: `https://your-drupal-site.com/user/login/entra-id/callback`

### 2. Configure Authentication

1. Go to **Authentication** tab
2. Add platform: **Web**
3. Redirect URI: `https://your-drupal-site.com/user/login/entra-id/callback`
4. Enable: **ID tokens** (implicit grant)

### 3. Create Client Secret

1. Go to **Certificates & secrets**
2. Click **New client secret**
3. Set description and expiry
4. **Copy the Value immediately** (shown only once)

### 4. Note Required Values

From **Overview** tab:
- **Application (client) ID**: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
- **Directory (tenant) ID**: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

From **Certificates & secrets**:
- **Client Secret Value**: `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### 5. Configure API Permissions

1. Go to **API permissions**
2. Add permissions:
   - Microsoft Graph → Delegated → `openid`
   - Microsoft Graph → Delegated → `profile`
   - Microsoft Graph → Delegated → `email`
   - Microsoft Graph → Delegated → `User.Read`
3. Grant admin consent if required

---

## Drupal Backend Setup

### 1. Configure Social Auth Entra ID

Go to `/admin/config/services/entra-id/settings`:

```
Client ID: [Your Application (client) ID]
Client Secret: [Your Client Secret Value]
Tenant ID: [Your Directory (tenant) ID]
Account Type: organization (or common/consumers)
Login Behavior: Register and Login
Allowed Domains: (optional) yourdomain.com
```

### 2. Configure Social Auth Base Settings

Go to `/admin/config/social-api/social-auth`:

```
Post Login Path: /api/social-auth/token
User Allowed: Register
Redirect to User Form: No
Disable Admin Login: Yes (recommended)
```

**Important**: The `post_login` path should point to your custom token generation endpoint.

### 3. Create OAuth Consumer

Go to `/admin/config/services/consumer`:

1. Click **Add consumer**
2. Configure:
   - **Label**: Frontend App (e.g., "BoxTasks Frontend")
   - **Client ID**: `your-frontend-client-id`
   - **New Secret**: Generate a secret
   - **Is Confidential**: No (for SPA frontends)
   - **Is Third Party**: No
   - **Grant Types**: Authorization Code, Refresh Token
   - **Access Token Expiration**: 300 (5 minutes) or 3600 (1 hour)
   - **Scopes**: authenticated

---

## Custom Token Generation

### The Problem

The `social_auth_entra_id` module has its own controller that:
1. Handles Microsoft OAuth callback
2. Creates a Drupal session
3. Redirects to the **front page** (not configurable)

This bypasses Social Auth's `post_login` setting, which we need for token generation.

### The Solution

Override the route without modifying the contrib module using Drupal's service system.

### 1. Create Route Subscriber

**File**: `web/modules/custom/your_module/src/Routing/RouteSubscriber.php`

```php
<?php

namespace Drupal\your_module\Routing;

use Drupal\Core\Routing\RouteSubscriberBase;
use Symfony\Component\Routing\RouteCollection;

/**
 * Listens to route events and overrides routes.
 */
class RouteSubscriber extends RouteSubscriberBase {

  /**
   * {@inheritdoc}
   */
  protected function alterRoutes(RouteCollection $collection) {
    // Override the Entra ID callback route to use our custom controller.
    if ($route = $collection->get('social_auth_entra_id.callback')) {
      $route->setDefault('_controller', '\Drupal\your_module\Controller\CustomEntraIdController::handleMicrosoftCallback');
    }
  }

}
```

### 2. Create Custom Controller

**File**: `web/modules/custom/your_module/src/Controller/CustomEntraIdController.php`

```php
<?php

namespace Drupal\your_module\Controller;

use Drupal\Core\Url;
use Drupal\social_auth_entra_id\Controller\SocialAuthEntraIdController;
use Symfony\Component\HttpFoundation\RedirectResponse;
use Symfony\Component\HttpFoundation\Request;

/**
 * Custom controller that extends Entra ID controller.
 *
 * Overrides the callback to redirect to Social Auth's post_login path
 * instead of the front page, enabling token generation for decoupled frontends.
 */
class CustomEntraIdController extends SocialAuthEntraIdController {

  /**
   * {@inheritdoc}
   *
   * Overrides the parent callback to use Social Auth's post_login redirect.
   */
  public function handleMicrosoftCallback(Request $request) {
    // Call the parent method to handle authentication.
    $response = parent::handleMicrosoftCallback($request);

    // If the user is now authenticated and the response is a redirect to front,
    // redirect to the Social Auth post_login path instead.
    if (\Drupal::currentUser()->isAuthenticated() && $response instanceof RedirectResponse) {
      $target_url = $response->getTargetUrl();
      $front_url = Url::fromRoute('<front>')->toString();

      // Check if redirecting to front page (default Entra ID behavior).
      $target_path = parse_url($target_url, PHP_URL_PATH);
      $front_path = parse_url($front_url, PHP_URL_PATH);

      if ($target_path === $front_path || $target_path === '/') {
        // Get the post_login path from Social Auth settings.
        $post_login_path = $this->configFactory->get('social_auth.settings')->get('post_login');

        if ($post_login_path && $post_login_path !== '/') {
          $response = new RedirectResponse($post_login_path);
          $response->setMaxAge(0);
          $response->headers->addCacheControlDirective('no-cache', TRUE);
          $response->headers->addCacheControlDirective('no-store', TRUE);
        }
      }
    }

    return $response;
  }

}
```

### 3. Create Token Generation Controller

**File**: `web/modules/custom/your_module/src/Controller/SocialAuthTokenController.php`

```php
<?php

namespace Drupal\your_module\Controller;

use Drupal\Core\Config\ConfigFactoryInterface;
use Drupal\Core\Controller\ControllerBase;
use Drupal\Core\File\FileSystemInterface;
use Drupal\Core\Site\Settings;
use Defuse\Crypto\Core;
use League\OAuth2\Server\CryptKey;
use League\OAuth2\Server\Repositories\AccessTokenRepositoryInterface;
use League\OAuth2\Server\Repositories\RefreshTokenRepositoryInterface;
use League\OAuth2\Server\Repositories\ScopeRepositoryInterface;
use Symfony\Component\DependencyInjection\ContainerInterface;
use Symfony\Component\HttpFoundation\RedirectResponse;
use Symfony\Component\HttpFoundation\Request;

/**
 * Controller for handling social auth token generation.
 *
 * After social login completes, this controller generates proper OAuth JWT
 * tokens using Simple OAuth's infrastructure and redirects to the frontend.
 */
class SocialAuthTokenController extends ControllerBase {

  protected AccessTokenRepositoryInterface $accessTokenRepository;
  protected RefreshTokenRepositoryInterface $refreshTokenRepository;
  protected ScopeRepositoryInterface $scopeRepository;
  protected FileSystemInterface $fileSystem;

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
   */
  public function generateToken(Request $request): RedirectResponse {
    $frontend_url = getenv('FRONTEND_URL') ?: 'https://your-frontend.com';

    // Check if user is authenticated.
    if ($this->currentUser()->isAnonymous()) {
      return new RedirectResponse($frontend_url . '/login?error=not_authenticated');
    }

    try {
      // Load the user entity.
      $user = $this->entityTypeManager()->getStorage('user')->load($this->currentUser()->id());
      if (!$user) {
        return new RedirectResponse($frontend_url . '/login?error=user_not_found');
      }

      // Find the OAuth consumer (client).
      $consumer_storage = $this->entityTypeManager()->getStorage('consumer');
      $consumers = $consumer_storage->loadByProperties(['label' => 'Your Frontend App']);

      if (empty($consumers)) {
        $consumers = $consumer_storage->loadByProperties([]);
      }

      if (empty($consumers)) {
        $this->getLogger('your_module')->error('No OAuth consumer found.');
        return new RedirectResponse($frontend_url . '/login?error=no_consumer');
      }

      $consumer = reset($consumers);
      $expiration_seconds = $consumer->get('access_token_expiration')->value ?? 3600;

      // Get client entity for OAuth library.
      $client_repository = \Drupal::service('simple_oauth.repositories.client');
      $client_entity = $client_repository->getClientEntity($consumer->get('client_id')->value);

      if (!$client_entity) {
        return new RedirectResponse($frontend_url . '/login?error=no_client');
      }

      // Get scopes.
      $scopes = [];
      foreach (['authenticated'] as $scope_id) {
        $scope = $this->scopeRepository->getScopeEntityByIdentifier($scope_id);
        if ($scope) {
          $scopes[] = $scope;
        }
      }

      // Create access token entity.
      $access_token = $this->accessTokenRepository->getNewToken(
        $client_entity,
        $scopes,
        (string) $user->id()
      );
      $access_token->setIdentifier(bin2hex(random_bytes(40)));
      $access_token->setExpiryDateTime(
        new \DateTimeImmutable('+' . $expiration_seconds . ' seconds')
      );

      // Set private key and generate JWT.
      $access_token->setPrivateKey($this->getPrivateKey());
      $jwt_token = $access_token->convertToJWT();
      $access_token_string = $jwt_token->toString();

      // Persist access token.
      $this->accessTokenRepository->persistNewAccessToken($access_token);

      // Create and persist refresh token.
      $refresh_token = $this->refreshTokenRepository->getNewRefreshToken();
      $refresh_token->setIdentifier(bin2hex(random_bytes(40)));
      $refresh_token->setExpiryDateTime(new \DateTimeImmutable('+30 days'));
      $refresh_token->setAccessToken($access_token);
      $this->refreshTokenRepository->persistNewRefreshToken($refresh_token);

      // Encode refresh token.
      $refresh_token_string = base64_encode(json_encode([
        'refresh_token_id' => $refresh_token->getIdentifier(),
        'expire_time' => (new \DateTimeImmutable('+30 days'))->getTimestamp(),
      ]));

      // Redirect to frontend with tokens.
      $redirect_url = $frontend_url . '/oauth-callback?' . http_build_query([
        'access_token' => $access_token_string,
        'refresh_token' => $refresh_token_string,
        'expires_in' => $expiration_seconds,
        'token_type' => 'Bearer',
      ]);

      return new RedirectResponse($redirect_url);
    }
    catch (\Exception $e) {
      $this->getLogger('your_module')->error('Token generation error: @message', [
        '@message' => $e->getMessage(),
      ]);
      return new RedirectResponse($frontend_url . '/login?error=token_generation_failed');
    }
  }

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

}
```

### 4. Register Services

**File**: `web/modules/custom/your_module/your_module.services.yml`

```yaml
services:
  your_module.route_subscriber:
    class: Drupal\your_module\Routing\RouteSubscriber
    tags:
      - { name: event_subscriber }
```

### 5. Define Routes

**File**: `web/modules/custom/your_module/your_module.routing.yml`

```yaml
your_module.social_auth_token:
  path: '/api/social-auth/token'
  defaults:
    _controller: '\Drupal\your_module\Controller\SocialAuthTokenController::generateToken'
    _title: 'Social Auth Token'
  requirements:
    _user_is_logged_in: 'TRUE'
```

---

## React Frontend Setup

### 1. Create OAuth Callback Page

**File**: `src/pages/OAuthCallback.tsx`

```tsx
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../lib/stores/auth';

export default function OAuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setTokens, fetchUser } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const processCallback = async () => {
      // Check for error parameter
      const errorParam = searchParams.get('error');
      if (errorParam) {
        setError(getErrorMessage(errorParam));
        return;
      }

      // Get tokens from URL
      const accessToken = searchParams.get('access_token');
      const refreshToken = searchParams.get('refresh_token');
      const expiresIn = searchParams.get('expires_in');

      if (!accessToken) {
        setError('No access token received. Please try logging in again.');
        return;
      }

      try {
        // Store tokens
        setTokens(
          accessToken,
          refreshToken || undefined,
          expiresIn ? parseInt(expiresIn) : 3600
        );

        // Fetch user data
        await fetchUser();

        // Redirect to dashboard
        navigate('/dashboard', { replace: true });
      } catch (err) {
        console.error('OAuth callback error:', err);
        setError('Failed to complete login. Please try again.');
      }
    };

    processCallback();
  }, [searchParams, setTokens, fetchUser, navigate]);

  const getErrorMessage = (errorCode: string): string => {
    const messages: Record<string, string> = {
      'not_authenticated': 'Authentication failed. Please try again.',
      'user_not_found': 'User account not found.',
      'no_consumer': 'OAuth configuration error. Contact support.',
      'token_generation_failed': 'Failed to generate token. Try again.',
    };
    return messages[errorCode] || 'An unexpected error occurred.';
  };

  if (error) {
    return (
      <div className="error-container">
        <h1>Login Failed</h1>
        <p>{error}</p>
        <a href="/login">Try Again</a>
      </div>
    );
  }

  return (
    <div className="loading-container">
      <div className="spinner" />
      <h1>Completing Login</h1>
      <p>Please wait...</p>
    </div>
  );
}
```

### 2. Add Auth Store Methods

**File**: `src/lib/stores/auth.ts` (add these methods)

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setTokens: (accessToken: string, refreshToken?: string, expiresIn?: number) => void;
  fetchUser: () => Promise<boolean>;
  // ... other methods
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // ... existing state

      setTokens: (accessToken: string, refreshToken?: string, expiresIn: number = 3600) => {
        // Store access token with expiry
        localStorage.setItem('access_token', accessToken);
        localStorage.setItem('token_expiry', String(Date.now() + expiresIn * 1000));

        if (refreshToken) {
          localStorage.setItem('refresh_token', refreshToken);
        }
      },

      fetchUser: async () => {
        try {
          const token = localStorage.getItem('access_token');
          if (!token) return false;

          // Fetch user info from JSON:API
          const response = await fetch(`${API_URL}/jsonapi`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/vnd.api+json',
            },
          });

          if (!response.ok) throw new Error('Failed to fetch user data');

          // Get user link from meta
          const apiInfo = await response.json();
          const userLink = apiInfo.meta?.links?.me?.href;

          if (!userLink) throw new Error('User link not found');

          // Fetch actual user data
          const userResponse = await fetch(userLink, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/vnd.api+json',
            },
          });

          if (!userResponse.ok) throw new Error('Failed to fetch user details');

          const userData = await userResponse.json();
          const attrs = userData.data?.attributes;

          if (attrs) {
            const user: User = {
              id: userData.data.id,
              username: attrs.name,
              email: attrs.mail || '',
              displayName: attrs.display_name || attrs.name,
            };
            set({ user, isAuthenticated: true, isLoading: false });
            return true;
          }

          return false;
        } catch (error) {
          console.error('Error fetching user:', error);
          return false;
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);
```

### 3. Add Route

**File**: `src/App.tsx`

```tsx
import { lazy } from 'react';

const OAuthCallback = lazy(() => import('./pages/OAuthCallback'));

// In your router configuration:
{ path: 'oauth-callback', element: <OAuthCallback /> }
```

### 4. Add Login Button

**File**: `src/pages/Login.tsx`

```tsx
<a
  href={`${API_URL}/user/login/entra-id`}
  className="microsoft-login-button"
>
  <MicrosoftIcon />
  Sign in with Microsoft
</a>
```

---

## Complete Authentication Flow

### Step-by-Step Flow

1. **User clicks "Sign in with Microsoft"**
   - Frontend redirects to: `https://drupal-site.com/user/login/entra-id`

2. **Drupal redirects to Microsoft**
   - URL: `https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize`
   - Includes: client_id, redirect_uri, scope, state, nonce

3. **User authenticates with Microsoft**
   - Enters credentials or uses existing session
   - Grants permissions to the app

4. **Microsoft redirects back to Drupal**
   - URL: `https://drupal-site.com/user/login/entra-id/callback?code=xxx&state=xxx`

5. **Custom controller handles callback**
   - `CustomEntraIdController::handleMicrosoftCallback()`
   - Exchanges code for Microsoft tokens
   - Validates ID token (audience, issuer, expiry, nonce)
   - Creates or loads Drupal user
   - Calls `user_login_finalize()` (creates Drupal session)
   - Redirects to `/api/social-auth/token` (from post_login setting)

6. **Token controller generates JWT**
   - `SocialAuthTokenController::generateToken()`
   - User is authenticated (has Drupal session)
   - Loads OAuth consumer configuration
   - Creates access token entity with user ID
   - Signs JWT with private key
   - Creates refresh token
   - Redirects to: `https://frontend.com/oauth-callback?access_token=eyJ...`

7. **Frontend processes callback**
   - `OAuthCallback.tsx` component
   - Extracts tokens from URL parameters
   - Stores tokens in localStorage
   - Calls `fetchUser()` to get user data
   - Redirects to dashboard

8. **Subsequent API requests**
   - Frontend includes: `Authorization: Bearer eyJ...`
   - Simple OAuth validates JWT signature
   - Request is authenticated as the user

---

## Troubleshooting

### Common Issues

#### 1. "Invalid state parameter" / CSRF Error

**Cause**: State mismatch between redirect and callback
**Solutions**:
- Ensure session cookies are being set
- Check for session timeout
- Verify redirect URI matches exactly

#### 2. "Redirect URI mismatch" (AADSTS50011)

**Cause**: Azure callback URL doesn't match configuration
**Solution**:
- In Azure Portal → App registrations → Authentication
- Add exact URL: `https://your-site.com/user/login/entra-id/callback`

#### 3. "Invalid client" / 401 Unauthorized

**Cause**: Client secret is invalid or expired
**Solution**:
- Create new client secret in Azure Portal
- Update Drupal configuration at `/admin/config/services/entra-id/settings`

#### 4. Token returns 401 on API requests

**Cause**: Token not being accepted by Simple OAuth
**Possible issues**:
- Token is not a valid JWT (old random string format)
- Private key path is incorrect
- Token has expired
- Consumer is misconfigured

**Solutions**:
- Verify Simple OAuth private key is configured
- Check token is JWT format (starts with `eyJ`)
- Verify consumer exists with matching client_id

#### 5. Redirects to front page instead of token endpoint

**Cause**: Custom controller override not working
**Solutions**:
- Clear Drupal cache: `drush cr`
- Verify services.yml is registered
- Check RouteSubscriber is correctly overriding the route
- Verify post_login is set to `/api/social-auth/token`

#### 6. "No OAuth consumer found"

**Cause**: Consumer entity doesn't exist or has wrong label
**Solution**:
- Create consumer at `/admin/config/services/consumer`
- Match label in code or use `loadByProperties([])` fallback

### Debugging Tips

1. **Enable logging**:
   ```php
   $this->getLogger('your_module')->debug('Debug message: @var', ['@var' => $value]);
   ```

2. **Check Drupal logs**:
   ```bash
   drush ws --severity=error
   ```

3. **Verify JWT structure**:
   - Decode at [jwt.io](https://jwt.io)
   - Check `sub` claim matches user ID
   - Check `aud` claim matches client_id
   - Check `exp` claim is in the future

4. **Test token validation**:
   ```bash
   curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
        -H "Accept: application/vnd.api+json" \
        https://your-site.com/jsonapi
   ```

---

## Security Considerations

1. **Use HTTPS everywhere** - Tokens in URLs are logged

2. **Short token expiry** - 5-15 minutes for access tokens

3. **Validate ID token claims** - Check audience, issuer, expiry, nonce

4. **Block admin accounts** - Disable social login for user 1

5. **Domain allowlist** - Restrict to known email domains

6. **PKCE for public clients** - Add code challenge for SPAs

7. **Secure key storage** - Keep private keys outside web root

---

## Files Summary

### Drupal Backend

| File | Purpose |
|------|---------|
| `your_module.routing.yml` | Defines `/api/social-auth/token` route |
| `your_module.services.yml` | Registers route subscriber |
| `src/Routing/RouteSubscriber.php` | Overrides Entra ID callback route |
| `src/Controller/CustomEntraIdController.php` | Redirects to token endpoint after login |
| `src/Controller/SocialAuthTokenController.php` | Generates JWT tokens for authenticated users |

### React Frontend

| File | Purpose |
|------|---------|
| `src/pages/OAuthCallback.tsx` | Handles token callback, stores tokens |
| `src/lib/stores/auth.ts` | Token storage and user fetching |
| `src/App.tsx` | Route registration |
| `src/pages/Login.tsx` | Microsoft login button |

---

## References

- [Social Auth Drupal Module](https://www.drupal.org/project/social_auth)
- [Social Auth Entra ID](https://www.drupal.org/project/social_auth_entra_id)
- [Simple OAuth Module](https://www.drupal.org/project/simple_oauth)
- [Microsoft Entra ID Documentation](https://learn.microsoft.com/en-us/entra/identity-platform/)
- [League OAuth2 Server](https://oauth2.thephpleague.com/)
