# Microsoft Entra ID SSO Login

Provides secure social authentication with Microsoft Entra ID
(formerly Azure Active Directory) for Drupal sites.

## Features

- **Secure OAuth 2.0 Authentication**: Integrates with Microsoft Entra ID
  for single sign-on
- **ID Token Verification**: Uses cryptographically signed ID tokens to
  prevent account impersonation
- **CSRF Protection**: State parameter validation to prevent cross-site
  request forgery
- **Domain Restrictions**: Allowlist email domains for corporate
  environments
- **Flexible Login Behavior**: Choose between "Register & Login" or
  "Login Only" modes
- **Administrator Protection**: Block user 1 and administrator role from
  SSO login
- **Blocked User Check**: Respects Drupal's user blocking system
- **Username Collision Prevention**: Automatic unique username generation
- **Security Logging**: Comprehensive logging of authentication events
  and security violations
- **Configurable Login Block**: Customizable login button with Font
  Awesome support

## Requirements

- Drupal 9, 10, or 11
- PHP 7.4 or higher
- Microsoft Entra ID (Azure AD) application with OAuth 2.0
  credentials
- GuzzleHTTP (included with Drupal core)

## Installation

### Via Composer (Recommended)
```bash
composer require drupal/social_auth_entra_id
drush en social_auth_entra_id -y
```

### Manual Installation
1. Download and extract the module to
   `/modules/contrib/social_auth_entra_id`
2. Enable the module: `drush en social_auth_entra_id -y`

## Configuration

### 1. Azure AD Application Setup

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** > **App registrations** >
   **New registration**
3. Configure:
   - **Name**: Your application name (e.g., "Drupal SSO")
   - **Supported account types**:
     - Choose "Accounts in this organizational directory only" for
       organization-only accounts
     - Choose "Accounts in any organizational directory and personal
       Microsoft accounts" for both account types
     - Choose "Personal Microsoft accounts only" for consumer accounts
       only
   - **Redirect URI**:
     `https://yoursite.com/user/login/entra-id/callback`
4. After creation, note the:
   - **Application (client) ID**
   - **Directory (tenant) ID**
5. Go to **Certificates & secrets** > **New client secret**
   - Copy the secret value immediately (shown only once)
6. Go to **API permissions** > **Add a permission** >
   **Microsoft Graph**
   - Add delegated permissions: `openid`, `profile`, `email`,
     `User.Read`
7. Grant admin consent for your organization

### 2. Drupal Module Configuration

Navigate to: `/admin/config/services/entra-id/settings`

**Required Settings:**
- **Client ID**: Paste the Application (client) ID from Azure
- **Client Secret**: Paste the client secret value
- **Tenant ID**: Paste the Directory (tenant) ID

**Account Type:**
- **Organization accounts only**: Work/school accounts from your Azure
  AD tenant (requires Tenant ID)
- **Both organization and personal**: Any Microsoft account (work,
  school, or personal like Hotmail)
- **Personal accounts only**: Consumer accounts only (Hotmail,
  Outlook.com, Live.com)

Azure Portal mapping (Supported account types):
- Organization accounts only →
  "Accounts in this organizational directory only (Single tenant)"
- Both organization and personal →
  "Accounts in any organizational directory and personal Microsoft accounts"
- Personal accounts only →
  "Personal Microsoft accounts only"

Note: The option "Accounts in any organizational directory (Multitenant)" allows
only organizational accounts across tenants and does not permit personal
Microsoft accounts. If you select this in Azure, personal accounts will not be
able to sign in even if the module is configured for Both.

**Login Behavior:**
- **Register and Login**: Automatically creates accounts for new users
- **Login Only**: Restricts to existing Drupal accounts only

**Allowed Domains** (Optional):
- Comma-separated list of email domains (e.g., `example.com, company.org`)
- Leave empty to allow all domains

**Security Settings:**
- ☑ **Block User 1**: Recommended - Prevents root admin from SSO login
- ☐ **Block Administrator Role**: Optional - Prevents all admins from SSO login

### 3. Add Login Block

**Option A: Block Placement**
1. Go to `/admin/structure/block`
2. Click "Place block" in desired region
3. Find "Entra ID Login Block"
4. Configure:
   - **Login Text**: Customize button text/HTML (supports Font Awesome icons)
   - **Custom Class**: Add CSS classes (e.g., `btn btn-primary`)
   - **Visibility**: Set to show for anonymous users only

**Option B: Direct Link**
Add a link to `/user/login/entra-id` anywhere in your theme or content.

## Security Features

### Protection Against Known Vulnerabilities

✅ **CVE-2024-XXXXX - Email Impersonation Attack** (Fixed)
- Uses verified ID token claims instead of unverified Graph API profile email
- Validates token audience, issuer, and expiration
- Prevents attackers from setting arbitrary emails in Azure AD profiles

✅ **CSRF Protection**
- State parameter generation and validation
- Session-based state storage
- Automatic cleanup after authentication

✅ **Token Replay Prevention**
- Nonce generation and validation
- One-time use enforcement for ID tokens

✅ **Rate Limiting**
- Built-in delays on authentication errors
- Prevents brute force attacks

✅ **Account Enumeration Prevention**
- Generic error messages
- Security logging without exposing user existence

### Security Best Practices

1. **Always enable "Block User 1"** - Prevents SSO attacks on root admin
2. **Use domain restrictions** for corporate environments
3. **Monitor logs regularly**: Check `/admin/reports/dblog` for
   `social_auth_entra_id` events
4. **Enable "Login Only" mode** if you manage users manually
5. **Keep client secret secure** - Treat as a password, rotate periodically
6. **Review Azure AD permissions** - Grant minimum necessary scopes

## Logging & Monitoring

The module logs all authentication events to Drupal's watchdog system:

**View logs:**
```bash
drush watchdog:show --type=social_auth_entra_id
```

**Monitor security warnings:**
```bash
drush watchdog:show --type=social_auth_entra_id --severity=Warning
```

**Events logged:**
- Successful logins
- Blocked admin login attempts (with IP addresses)
- CSRF attempt detection
- Token validation failures
- Domain restriction violations
- Account creation events

## Troubleshooting

### "Empty configuration" error
- Ensure Client ID and Tenant ID are configured in module settings

### "Authorization code missing" error
- Check Azure AD redirect URI matches exactly: `/user/login/entra-id/callback`
- Verify application is properly configured in Azure Portal

### "Your email domain is not allowed"
- Check "Allowed Domains" configuration
- Ensure user's email domain is in the allowlist
- Domains are case-insensitive

### "Invalid state parameter"
- Possible CSRF attempt detected
- Check browser cookies are enabled
- Verify session storage is working correctly

### "Access token missing" error
- Verify Client Secret is correct and not expired
- Check Azure AD application permissions are granted
- Review Azure AD application status

### Users created with wrong usernames
- Module now generates unique usernames automatically
- Existing users: Consider using `drush user:unblock` or manually update

## Development

### Running Tests
```bash
# PHP CodeSniffer
phpcs --standard=Drupal --extensions=php src/

# PHPUnit (if tests exist)
vendor/bin/phpunit modules/contrib/social_auth_entra_id
```

### Code Standards
This module follows Drupal coding standards. Run before committing:
```bash
phpcs --standard=Drupal src/
phpcbf --standard=Drupal src/
```

## Support

- **Issue Queue**: [Drupal.org Issue Queue](https://www.drupal.org/project/issues/social_auth_entra_id)
- **Documentation**: [Full Documentation](https://www.drupal.org/docs/develop/entra-id-login-block-module-documentation)

## Maintainers

- [Jaseer](https://www.drupal.org/u/jaseerkinangattil)

## License

GPL-2.0-or-later

## Changelog

### 2.0.0 (Security Release)
- **CRITICAL**: Fixed email impersonation vulnerability (use ID token claims)
- Added CSRF protection with state parameter validation
- Added nonce validation for token replay prevention
- Implemented username collision prevention
- Added blocked user account check
- Enhanced security logging with IP addresses
- Improved rate limiting on errors
- Fixed account enumeration vulnerability
- Changed client secret field to password type
- Added email format validation
- Case-insensitive domain matching
- Security settings: Block user 1 and administrator role options

### 1.0.0
- Initial release
- Basic Microsoft Entra ID OAuth 2.0 integration
- Configurable login block
- Domain allowlisting
