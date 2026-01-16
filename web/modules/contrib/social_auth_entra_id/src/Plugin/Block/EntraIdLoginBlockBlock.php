<?php

declare(strict_types=1);

namespace Drupal\social_auth_entra_id\Plugin\Block;

use Drupal\Core\Block\BlockBase;
use Drupal\Core\Form\FormStateInterface;
use Drupal\Core\Url;

/**
 * Provides a configurable login block for Microsoft Entra ID authentication.
 *
 * Displays a link/button that redirects users to Microsoft Entra ID login.
 * Supports custom text with HTML (Font Awesome icons) and CSS classes.
 *
 * Block can be placed via:
 * - Block layout UI: /admin/structure/block
 * - Programmatically in theme or module
 *
 * @Block(
 *   id = "entra_id_login_block",
 *   admin_label = @Translation("Entra ID Login Block"),
 *   category = @Translation("Login"),
 * )
 */
final class EntraIdLoginBlockBlock extends BlockBase {

  /**
   * {@inheritdoc}
   *
   * Builds the block output with customizable login link.
   *
   * @return array
   *   A renderable array containing the login link with:
   *   - Custom text/HTML (with allowed tags)
   *   - Custom CSS classes
   *   - Font Awesome library attachment
   *   - User context caching
   */
  public function build(): array {

    // Get configured login text or use default with Microsoft icon.
    $login_text = $this->configuration['login_text'] ?? '<i class="fa-brands fa-microsoft"></i> Log in with Microsoft Entra ID';

    // Get configured CSS classes or use Bootstrap button defaults.
    $custom_class = !empty($this->configuration['custom_class']) ? $this->configuration['custom_class'] : 'btn btn-primary';

    // Build render array for login link.
    return [
      'content' => [
        '#type' => 'link',
        '#title' => [
          '#markup' => $login_text,
          // Allow safe HTML tags for icons and formatting.
          '#allowed_tags' => ['i', 'strong', 'em', 'b', 'u', 'span', 'img'],
        ],
        // Link to OAuth redirect route.
        '#url' => Url::fromRoute('social_auth_entra_id.redirect'),
        // Apply custom CSS classes for styling.
        '#attributes' => ['class' => [$custom_class]],
        // Attach Font Awesome library for icon support.
        '#attached' => [
          'library' => [
            'social_auth_entra_id/font-awesome',
          ],
        ],
        // Cache per user to show/hide based on authentication state.
        '#cache' => [
          'contexts' => ['user'],
        ],
      ],
    ];
  }

  /**
   * {@inheritdoc}
   *
   * Defines the block configuration form.
   *
   * Allows administrators to customize:
   * - Login button text with HTML support
   * - CSS classes for styling
   *
   * @param array $form
   *   The form array.
   * @param \Drupal\Core\Form\FormStateInterface $form_state
   *   The form state.
   *
   * @return array
   *   The configuration form.
   */
  public function blockForm($form, FormStateInterface $form_state) {
    // Load existing block configuration.
    $config = $this->getConfiguration();
    $default_class = 'btn btn-primary';

    // Login text field with HTML support.
    // Supports Font Awesome icons and basic HTML formatting.
    $form['login_text'] = [
      '#type' => 'textfield',
      '#title' => $this->t('Login Text'),
      '#description' => $this->t('Enter the HTML to be displayed for the login link, e.g., <code>&lt;i class="fa-brands fa-microsoft"&gt;&lt;/i&gt; Sign in with Microsoft</code>. Make sure font-awesome is installed for font-awesome icons'),
      '#default_value' => $config['login_text'] ?? '<i class="fa-brands fa-microsoft"></i> Log in with Microsoft Entra ID',
    ];

    // Custom CSS class field for button styling.
    // Supports Bootstrap classes, custom theme classes, etc.
    $form['custom_class'] = [
      '#type' => 'textfield',
      '#title' => $this->t('Custom Class'),
      '#description' => $this->t('Enter a custom CSS class for the login link.'),
      '#default_value' => $config['custom_class'] ?? $default_class,
    ];

    return $form;
  }

  /**
   * {@inheritdoc}
   *
   * Validates block configuration before saving.
   *
   * SECURITY: Validates CSS class input to prevent injection attacks.
   *
   * @param array $form
   *   The form array.
   * @param \Drupal\Core\Form\FormStateInterface $form_state
   *   The form state.
   */
  public function blockValidate($form, FormStateInterface $form_state) {
    $custom_class = $form_state->getValue('custom_class');

    // Validate CSS class contains only safe characters.
    // Allowed: letters, numbers, spaces, hyphens, underscores.
    // Prevents XSS and CSS injection attacks.
    if ($custom_class && !preg_match('/^[a-zA-Z0-9\s_-]+$/', $custom_class)) {
      $form_state->setErrorByName('custom_class', $this->t('Custom class can only contain letters, numbers, spaces, hyphens, and underscores.'));
    }
  }

  /**
   * {@inheritdoc}
   *
   * Saves block configuration.
   *
   * SECURITY: Sanitizes CSS class to remove any invalid characters
   * that passed validation.
   *
   * @param array $form
   *   The form array.
   * @param \Drupal\Core\Form\FormStateInterface $form_state
   *   The form state.
   */
  public function blockSubmit($form, FormStateInterface $form_state) {
    // Save login text as-is (will be filtered on output).
    $this->configuration['login_text'] = $form_state->getValue('login_text');

    // SECURITY: Sanitize CSS class to prevent injection attacks.
    // Removes any characters not matching: a-z, A-Z, 0-9, space, -, _.
    $custom_class = $form_state->getValue('custom_class');
    $this->configuration['custom_class'] = preg_replace('/[^a-zA-Z0-9\s_-]/', '', $custom_class);
  }

}
