<?php

namespace Drupal\boxtasks_user\Controller;

use Drupal\Core\Controller\ControllerBase;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;

/**
 * Controller for registration settings.
 */
class RegistrationSettingsController extends ControllerBase {

  /**
   * Get current registration settings.
   *
   * @return \Symfony\Component\HttpFoundation\JsonResponse
   *   The JSON response with registration settings.
   */
  public function getSettings(): JsonResponse {
    $config = \Drupal::config('user.settings');
    $register = $config->get('register');

    return new JsonResponse([
      'requireApproval' => ($register === 'visitors_admin_approval'),
      'registrationEnabled' => ($register !== 'admin_only'),
    ]);
  }

  /**
   * Update registration settings.
   *
   * @param \Symfony\Component\HttpFoundation\Request $request
   *   The request object.
   *
   * @return \Symfony\Component\HttpFoundation\JsonResponse
   *   The JSON response.
   */
  public function updateSettings(Request $request): JsonResponse {
    $content = $request->getContent();
    $data = json_decode($content, TRUE);

    $requireApproval = !empty($data['requireApproval']);

    try {
      $config = \Drupal::configFactory()->getEditable('user.settings');
      $config->set('register', $requireApproval ? 'visitors_admin_approval' : 'visitors');
      $config->save();

      return new JsonResponse([
        'success' => TRUE,
        'requireApproval' => $requireApproval,
      ]);
    }
    catch (\Exception $e) {
      \Drupal::logger('boxtasks_user')->error('Failed to update registration settings: @message', ['@message' => $e->getMessage()]);
      return new JsonResponse(['error' => 'Failed to update settings'], 500);
    }
  }

}
