<?php

namespace Drupal\social_auth_entra_id\Form;

use Drupal\Core\Form\ConfigFormBase;
use Drupal\Core\Form\FormStateInterface;
use Drupal\Core\Url;

/**
 * Configures settings for the Entra ID social authentication module.
 *
 * Provides configuration form for Microsoft Entra ID (Azure AD) OAuth 2.0
 * integration including:
 * - Azure AD application credentials (Client ID, Secret, Tenant ID)
 * - Login behavior (auto-registration vs login-only)
 * - Domain allowlisting for email restrictions
 * - Security settings for privileged account protection.
 *
 * Available at: /admin/config/services/entra-id/settings
 */
class SocialAuthEntraIdSettingsForm extends ConfigFormBase {

  /**
   * {@inheritdoc}
   */
  protected function getEditableConfigNames() {
    return ['social_auth_entra_id.settings'];
  }

  /**
   * {@inheritdoc}
   */
  public function getFormId() {
    return 'social_auth_entra_id_settings_form';
  }

  /**
   * Builds the configuration form.
   *
   * Creates form elements for all module settings including Azure AD
   * credentials, behavior options, and security configurations.
   *
   * @param array $form
   *   An associative array containing the structure of the form.
   * @param \Drupal\Core\Form\FormStateInterface $form_state
   *   The current state of the form.
   *
   * @return array
   *   The form structure.
   */
  public function buildForm(array $form, FormStateInterface $form_state) {
    // Load existing configuration.
    $config = $this->config('social_auth_entra_id.settings');

    // Azure AD credentials group.
    $form['azure_credentials'] = [
      '#type' => 'details',
      '#title' => $this->t('Azure AD Application Credentials'),
      '#open' => TRUE,
      '#description' => $this->t('Configure your Microsoft Entra ID (Azure AD) application credentials. <a href="@portal" target="_blank">Open Azure Portal</a> to manage your app registrations.', [
        '@portal' => 'https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade',
      ]),
    ];

    // Azure AD Application (client) ID.
    // Found in Azure Portal > App registrations > Overview.
    $form['azure_credentials']['client_id'] = [
      '#type' => 'textfield',
      '#title' => $this->t('Client ID'),
      '#default_value' => $config->get('client_id'),
      '#description' => $this->t('Enter the Application (client) ID. Find it in') . ' '
      . $this->t('<a href="@link" target="_blank">Azure Portal > App registrations</a>.', [
        '@link' => 'https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade',
      ]),
      '#required' => TRUE,
    ];

    // Display the callback URL for administrator reference.
    // This is the Redirect URI to configure in Azure AD application
    // registration.
    // Disabled so it is not editable; generated automatically.
    $callback_url = Url::fromRoute(
      'social_auth_entra_id.callback',
      [],
      ['absolute' => TRUE]
    )->toString();
    $form['azure_credentials']['callback_url'] = [
      '#type' => 'textfield',
      '#title' => $this->t('Callback URL (Redirect URI)'),
      '#default_value' => $callback_url,
      '#description' => $this->t('Copy this URL into Azure AD Redirect URIs.'),
      '#disabled' => TRUE,
    ];

    // Azure AD Application client secret value.
    // Created in Azure Portal > App registrations > Certificates & secrets.
    // SECURITY: Uses password field to prevent shoulder surfing.
    $form['azure_credentials']['client_secret'] = [
      '#type' => 'password',
      '#title' => $this->t('Client Secret'),
      '#default_value' => $config->get('client_secret'),
      '#description' => $this->t('Create a client secret in Azure Portal > App registrations.') . ' '
      . $this->t('Paste the secret value here. Leave blank to keep existing.') . ' '
      . $this->t('<a href="@link" target="_blank">Open App registrations</a>.', [
        '@link' => 'https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade',
      ]),
      '#required' => FALSE,
      '#attributes' => ['autocomplete' => 'off'],
    ];

    // Azure AD Directory (tenant) ID.
    // Found in Azure Portal > Azure Active Directory > Overview.
    $form['azure_credentials']['tenant_id'] = [
      '#type' => 'textfield',
      '#title' => $this->t('Tenant ID'),
      '#default_value' => $config->get('tenant_id'),
      '#description' => $this->t('Directory (tenant) ID from Azure Active Directory > Overview.') . ' '
      . $this->t('Only required for single-tenant (organization accounts).') . ' '
      . $this->t('<a href="@link" target="_blank">Open Azure AD Overview</a>.', [
        '@link' => 'https://portal.azure.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/~/Overview',
      ]),
      '#required' => FALSE,
      '#states' => [
        'required' => [
          ':input[name="account_type"]' => ['value' => 'organization'],
        ],
        'visible' => [
          ':input[name="account_type"]' => ['value' => 'organization'],
        ],
      ],
    ];

    // Microsoft account type selection.
    // Determines which types of Microsoft accounts can authenticate.
    $form['azure_credentials']['account_type'] = [
      '#type' => 'radios',
      '#title' => $this->t('Account Type'),
      '#options' => [
        'organization' => $this->t('Organization accounts only (requires Tenant ID above)'),
        'common' => $this->t('Both organization and personal Microsoft accounts'),
        'consumers' => $this->t('Personal Microsoft accounts only (Hotmail, Outlook.com, Live.com)'),
      ],
      '#default_value' => $config->get('account_type') ?? 'organization',
      '#description' => $this->t('Choose what types of Microsoft accounts can authenticate.<br /><br /><strong>Mapping to Azure Portal “Supported account types”:</strong><ul><li><strong>Organization accounts only:</strong> Select <em>Accounts in this organizational directory only (Single tenant)</em></li><li><strong>Both organization and personal:</strong> Select <em>Accounts in any organizational directory and personal Microsoft accounts</em></li><li><strong>Personal accounts only:</strong> Select <em>Personal Microsoft accounts only</em></li></ul><em>Note:</em> The “Accounts in any organizational directory (Multitenant)” option alone does not allow personal accounts.'),
    ];

    // Authentication behavior settings group.
    $form['auth_behavior'] = [
      '#type' => 'details',
      '#title' => $this->t('Authentication Behavior'),
      '#open' => TRUE,
    ];

    // Determines behavior when new users authenticate.
    // register_and_login: Automatically creates Drupal accounts.
    // login_only: Restricts to existing accounts only.
    $form['auth_behavior']['login_behavior'] = [
      '#type' => 'radios',
      '#title' => $this->t('Login Behavior'),
      '#options' => [
        'register_and_login' => $this->t('Register and Login'),
        'login_only' => $this->t('Login Only'),
      ],
      '#default_value' => $config->get('login_behavior') ?? 'register_and_login',
      '#description' => $this->t('Choose whether to allow registration and login, or restrict to login only for existing accounts.'),
    ];

    // Email domain restrictions for corporate environments.
    // Comma-separated list, case-insensitive matching.
    // Empty = allow all domains.
    $form['auth_behavior']['allowed_domains'] = [
      '#type' => 'textarea',
      '#title' => $this->t('Allowed Domains'),
      '#default_value' => $config->get('allowed_domains'),
      '#description' => $this->t('Enter the email domains that are allowed to register/login.')
      . ' ' . $this->t('You can enter them comma-separated or one per line.')
      . ' ' . $this->t('Leave empty to allow all domains.')
      . ' ' . $this->t('Examples: <code>example.com, another-domain.com</code> or on separate lines.'),
    ];

    // Security settings group for privileged account protection.
    $form['security'] = [
      '#type' => 'details',
      '#title' => $this->t('Security Settings'),
      '#open' => TRUE,
      '#description' => $this->t('<strong>Important:</strong> Review these security settings carefully before enabling SSO authentication. These settings protect privileged accounts from SSO-based attacks.'),
    ];

    // Prevent root admin (UID 1) from using SSO.
    // SECURITY: Recommended to prevent account takeover attacks.
    // Default: enabled.
    $form['security']['block_user_1'] = [
      '#type' => 'checkbox',
      '#title' => $this->t('Block User 1 (root user) from logging in via Entra ID'),
      '#default_value' => $config->get('block_user_1') ?? TRUE,
      '#description' => $this->t('Recommended: Prevent the root administrator account (user ID 1) from authenticating via Entra ID. This protects against SSO-based attacks on the most privileged account.'),
    ];

    // Prevent all administrator role users from using SSO.
    // SECURITY: Optional, for high-security environments.
    // Default: enabled (as per config/install).
    $form['security']['block_admin_role'] = [
      '#type' => 'checkbox',
      '#title' => $this->t('Block users with Administrator role from logging in via Entra ID'),
      '#default_value' => $config->get('block_admin_role') ?? TRUE,
      '#description' => $this->t('Prevent any user with the Administrator role from authenticating via Entra ID. Admins must use traditional username/password login.'),
    ];

    return parent::buildForm($form, $form_state);
  }

  /**
   * {@inheritdoc}
   *
   * Saves all configuration values to config storage.
   * Special handling for client_secret to preserve existing value when empty.
   */
  public function submitForm(array &$form, FormStateInterface $form_state) {
    $config = $this->config('social_auth_entra_id.settings');

    // Save all form values to configuration.
    $config->set('client_id', $form_state->getValue('client_id'))
      ->set('tenant_id', $form_state->getValue('tenant_id'))
      ->set('account_type', $form_state->getValue('account_type'))
      ->set('login_behavior', $form_state->getValue('login_behavior'))
      ->set('allowed_domains', $form_state->getValue('allowed_domains'))
      ->set('block_user_1', $form_state->getValue('block_user_1'))
      ->set('block_admin_role', $form_state->getValue('block_admin_role'));

    // SECURITY: Only update client_secret if a new value is provided.
    // Password fields return empty on re-submit, so preserve existing value.
    $client_secret = $form_state->getValue('client_secret');
    if (!empty($client_secret)) {
      $config->set('client_secret', $client_secret);
    }

    $config->save();

    parent::submitForm($form, $form_state);
  }

}
