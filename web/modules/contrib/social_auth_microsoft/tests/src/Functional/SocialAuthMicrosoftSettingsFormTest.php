<?php

namespace Drupal\Tests\social_auth_microsoft\Functional;

use Drupal\Tests\social_auth\Functional\SocialAuthTestBase;

/**
 * Test Social Auth Microsoft settings form.
 *
 * @group social_auth_microsoft
 */
class SocialAuthMicrosoftSettingsFormTest extends SocialAuthTestBase {

  /**
   * Modules to enable.
   *
   * @var array
   */
  protected static $modules = ['social_auth_microsoft'];

  /**
   * {@inheritdoc}
   */
  protected function setUp(): void {
    $this->module = 'social_auth_microsoft';
    $this->provider = 'microsoft';
    $this->moduleType = 'social-auth';

    parent::setUp();
  }

  /**
   * Test if implementer is shown in the integration list.
   */
  public function testIsAvailableInIntegrationList() {
    $this->fields = ['client_id', 'client_secret'];

    $this->checkIsAvailableInIntegrationList();
  }

  /**
   * Test if permissions are set correctly for settings page.
   */
  public function testPermissionForSettingsPage() {
    $this->checkPermissionForSettingsPage();
  }

  /**
   * Test settings form submission.
   */
  public function testSettingsFormSubmission() {
    $this->edit = [
      'client_id' => $this->randomString(10),
      'client_secret' => $this->randomString(10),
    ];

    $this->checkSettingsFormSubmission();
  }

}
