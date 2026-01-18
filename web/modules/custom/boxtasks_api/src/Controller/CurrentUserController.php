<?php

declare(strict_types=1);

namespace Drupal\boxtasks_api\Controller;

use Drupal\Core\Controller\ControllerBase;
use Drupal\Core\Session\AccountProxyInterface;
use Drupal\user\Entity\User;
use Symfony\Component\DependencyInjection\ContainerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;

/**
 * Controller for current user API endpoints.
 */
class CurrentUserController extends ControllerBase {

  /**
   * The current user service.
   *
   * @var \Drupal\Core\Session\AccountProxyInterface
   */
  protected $currentUser;

  /**
   * Constructs a CurrentUserController object.
   *
   * @param \Drupal\Core\Session\AccountProxyInterface $current_user
   *   The current user service.
   */
  public function __construct(AccountProxyInterface $current_user) {
    $this->currentUser = $current_user;
  }

  /**
   * {@inheritdoc}
   */
  public static function create(ContainerInterface $container) {
    return new static(
      $container->get('current_user')
    );
  }

  /**
   * Returns the current user's info including roles.
   *
   * @return \Symfony\Component\HttpFoundation\JsonResponse
   *   JSON response with user data.
   */
  public function getCurrentUser(): JsonResponse {
    if ($this->currentUser->isAnonymous()) {
      return new JsonResponse([
        'error' => 'Not authenticated',
      ], 401);
    }

    $user = User::load($this->currentUser->id());
    if (!$user) {
      return new JsonResponse([
        'error' => 'User not found',
      ], 404);
    }

    // Get user roles (excluding 'authenticated' which all logged-in users have)
    $roles = $user->getRoles(TRUE);

    // Build user data
    $data = [
      'id' => $user->uuid(),
      'uid' => (int) $user->id(),
      'name' => $user->getAccountName(),
      'mail' => $user->getEmail(),
      'display_name' => $user->hasField('field_display_name') && !$user->get('field_display_name')->isEmpty()
        ? $user->get('field_display_name')->value
        : $user->getDisplayName(),
      'timezone' => $user->getTimeZone(),
      'roles' => $roles,
      'is_admin' => in_array('administrator', $roles, TRUE),
    ];

    // Add optional fields if they exist
    if ($user->hasField('field_bio') && !$user->get('field_bio')->isEmpty()) {
      $data['bio'] = $user->get('field_bio')->value;
    }

    if ($user->hasField('field_job_title') && !$user->get('field_job_title')->isEmpty()) {
      $data['job_title'] = $user->get('field_job_title')->value;
    }

    if ($user->hasField('field_mention_handle') && !$user->get('field_mention_handle')->isEmpty()) {
      $data['mention_handle'] = $user->get('field_mention_handle')->value;
    }

    return new JsonResponse($data);
  }

}
