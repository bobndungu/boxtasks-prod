# BoxTasks2 Security Audit - Secrets & Credentials

**Date:** 2026-01-14
**Status:** Action Required

## Executive Summary

This audit identifies all secrets, passwords, and credentials in the BoxTasks2 codebase that need to be secured for production deployment.

## Critical Issues Found

### 1. SMTP Password Exposed in Config Sync

**File:** `web/sites/default/files/sync/smtp.settings.yml`
**Issue:** SMTP password is stored in plain text in version-controlled config
**Current Value:** `T\!084147868786aq`
**Risk:** HIGH - Anyone with repository access can see this credential

**Action Required:**
1. Change the Office365 password immediately
2. Update the config to not store the password, or use environment variable override

### 2. Google OAuth Client Secret Exposed

**File:** `web/sites/default/files/sync/social_auth_google.settings.yml`
**Current Value:** `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`
**Risk:** HIGH - OAuth client secret should never be in version control

**Action Required:**
1. Regenerate the client secret in Google Cloud Console
2. Move to environment variable configuration

### 3. Microsoft OAuth Client Secret Exposed

**File:** `web/sites/default/files/sync/social_auth_microsoft.settings.yml`
**Current Value:** `8a55d322-7ba8-442c-b531-4941941f80f9`
**Risk:** HIGH - OAuth client secret should never be in version control

**Action Required:**
1. Regenerate the client secret in Azure Portal
2. Move to environment variable configuration

### 4. Mercure JWT Key in Local Settings

**File:** `web/sites/default/settings.local.php`
**Current Value:** `boxtasks2-mercure-publisher-secret-key-change-in-production`
**Risk:** MEDIUM - Clearly marked for development, but should be verified it's not used in production

**Action Required:**
1. Use environment variable `MERCURE_JWT_SECRET` in production
2. New secure value generated: `JfC6ZbsWw975akthfAAXyfn67D11UIJp`

## Secrets Location Summary

| Secret | Location | Status | New Value Generated |
|--------|----------|--------|---------------------|
| Database Password | Environment Variable | OK | `AiFuIhAyzvIEUIvyskvXjK9W` |
| Drupal Hash Salt | Environment Variable | OK | `3a1a79a65237a60f944efe91c44d0634e483dba7d03f37af12ce0f7e2ed976e9` |
| Mercure JWT Secret | Environment Variable | OK | `JfC6ZbsWw975akthfAAXyfn67D11UIJp` |
| OAuth Client Secret | Environment Variable | OK | `lEhOaDRPdlEkznuGjzDNeH6w6UfcwXWA` |
| Redis Password | Environment Variable | OK | `aT80EbavkBWh1L5jtwtuCUsE` |
| SMTP Password | Config Sync (EXPOSED!) | CHANGE REQUIRED | Regenerate in Office365 |
| Google OAuth Secret | Config Sync (EXPOSED!) | CHANGE REQUIRED | Regenerate in Google Console |
| Microsoft OAuth Secret | Config Sync (EXPOSED!) | CHANGE REQUIRED | Regenerate in Azure Portal |
| OAuth Private Key | `/keys/private.key` | OK (gitignored) | N/A |
| OAuth Public Key | `/keys/public.key` | OK (gitignored) | N/A |

## Files Created

### `.env.production.local`
Contains all production secrets with strong, randomly generated values.

**Location:** `/Users/robertn/Sites/DrupalDev/BoxTasks2/.env.production.local`

**Contents include:**
- Database credentials (24-char password)
- Drupal hash salt (64 hex characters)
- Mercure JWT secret (32 characters)
- OAuth client secret (32 characters)
- Redis password (24 characters)
- All production URLs and configuration

## Recommended Actions

### Immediate (Before Production)

1. **Regenerate SMTP Password**
   - Log into Office365 admin
   - Change password for `hello@boxraft.com`
   - Update in Drupal SMTP settings (not in config file)

2. **Regenerate Google OAuth Secret**
   - Go to Google Cloud Console
   - Navigate to APIs & Services > Credentials
   - Regenerate client secret for `436014983432-hvkmk5v1fub339nl34m2t1q3edbtcfpp`
   - Configure via environment variable or Drupal admin

3. **Regenerate Microsoft OAuth Secret**
   - Go to Azure Portal
   - Navigate to App Registrations
   - Regenerate client secret for `e19079b7-b519-4766-80a3-79f4be13c639`
   - Configure via environment variable or Drupal admin

4. **Deploy Production Environment File**
   - Copy `.env.production.local` to production server
   - Set as environment variables OR source the file
   - Ensure file permissions are restricted (chmod 600)

### Short-term

1. **Remove secrets from config sync**
   - Remove `smtp_password` from `smtp.settings.yml`
   - Remove `client_secret` from `social_auth_google.settings.yml`
   - Remove `client_secret` from `social_auth_microsoft.settings.yml`
   - Use `$config` overrides in `settings.production.php` instead

2. **Add config overrides in settings.production.php**
   ```php
   // SMTP
   $config['smtp.settings']['smtp_password'] = getenv('SMTP_PASSWORD');

   // Google OAuth
   $config['social_auth_google.settings']['client_secret'] = getenv('SOCIAL_AUTH_GOOGLE_CLIENT_SECRET');

   // Microsoft OAuth
   $config['social_auth_microsoft.settings']['client_secret'] = getenv('SOCIAL_AUTH_MICROSOFT_CLIENT_SECRET');
   ```

3. **Regenerate OAuth Keys**
   - The keys in `/keys/` directory should be regenerated for production
   - Use: `openssl genrsa -out private.key 2048`
   - Use: `openssl rsa -in private.key -pubout -out public.key`

### Long-term

1. **Implement secrets management**
   - Consider HashiCorp Vault, AWS Secrets Manager, or similar
   - Rotate secrets periodically

2. **Add pre-commit hooks**
   - Scan for accidental secret commits
   - Use tools like `git-secrets` or `trufflehog`

## Verification Checklist

Before going to production, verify:

- [ ] SMTP password regenerated and not in config sync
- [ ] Google OAuth secret regenerated and not in config sync
- [ ] Microsoft OAuth secret regenerated and not in config sync
- [ ] `.env.production.local` deployed to server
- [ ] Environment variables set correctly
- [ ] File permissions restricted on secrets files
- [ ] OAuth keys regenerated for production
- [ ] Test all authentication flows work with new secrets
