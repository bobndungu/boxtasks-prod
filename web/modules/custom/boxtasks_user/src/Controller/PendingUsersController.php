<?php

namespace Drupal\boxtasks_user\Controller;

use Drupal\Core\Controller\ControllerBase;
use Drupal\user\Entity\User;
use Symfony\Component\HttpFoundation\JsonResponse;

/**
 * Controller for managing pending user approvals.
 */
class PendingUsersController extends ControllerBase {

  /**
   * Get list of users pending approval.
   *
   * @return \Symfony\Component\HttpFoundation\JsonResponse
   *   The JSON response with pending users.
   */
  public function getPendingUsers(): JsonResponse {
    $query = \Drupal::entityQuery('user')
      ->condition('status', 0)
      ->condition('field_pending_approval', 1)
      ->sort('created', 'DESC')
      ->accessCheck(TRUE);

    $uids = $query->execute();
    $users = User::loadMultiple($uids);

    $result = [];
    foreach ($users as $user) {
      $result[] = [
        'id' => $user->id(),
        'username' => $user->getAccountName(),
        'email' => $user->getEmail(),
        'firstName' => $user->get('field_first_name')->value ?? '',
        'lastName' => $user->get('field_last_name')->value ?? '',
        'created' => $user->getCreatedTime(),
      ];
    }

    return new JsonResponse(['users' => $result, 'count' => count($result)]);
  }

  /**
   * Approve a pending user.
   *
   * @param int $uid
   *   The user ID to approve.
   *
   * @return \Symfony\Component\HttpFoundation\JsonResponse
   *   The JSON response.
   */
  public function approveUser(int $uid): JsonResponse {
    $user = User::load($uid);

    if (!$user) {
      return new JsonResponse(['error' => 'User not found'], 404);
    }

    // Check if user is actually pending approval.
    if (!$user->get('field_pending_approval')->value) {
      return new JsonResponse(['error' => 'User is not pending approval'], 400);
    }

    try {
      // Activate the user and remove pending flag.
      $user->set('status', 1);
      $user->set('field_pending_approval', 0);
      $user->save();

      // TODO: Send approval email notification.

      return new JsonResponse([
        'success' => TRUE,
        'message' => 'User approved successfully',
        'user' => [
          'id' => $user->id(),
          'username' => $user->getAccountName(),
          'email' => $user->getEmail(),
        ],
      ]);
    }
    catch (\Exception $e) {
      \Drupal::logger('boxtasks_user')->error('Failed to approve user @uid: @message', [
        '@uid' => $uid,
        '@message' => $e->getMessage(),
      ]);
      return new JsonResponse(['error' => 'Failed to approve user'], 500);
    }
  }

  /**
   * Reject and delete a pending user.
   *
   * @param int $uid
   *   The user ID to reject.
   *
   * @return \Symfony\Component\HttpFoundation\JsonResponse
   *   The JSON response.
   */
  public function rejectUser(int $uid): JsonResponse {
    $user = User::load($uid);

    if (!$user) {
      return new JsonResponse(['error' => 'User not found'], 404);
    }

    // Check if user is actually pending approval.
    if (!$user->get('field_pending_approval')->value) {
      return new JsonResponse(['error' => 'User is not pending approval'], 400);
    }

    try {
      $username = $user->getAccountName();
      $email = $user->getEmail();

      // Delete the user.
      $user->delete();

      // TODO: Send rejection email notification.

      return new JsonResponse([
        'success' => TRUE,
        'message' => 'User registration rejected and deleted',
        'user' => [
          'username' => $username,
          'email' => $email,
        ],
      ]);
    }
    catch (\Exception $e) {
      \Drupal::logger('boxtasks_user')->error('Failed to reject user @uid: @message', [
        '@uid' => $uid,
        '@message' => $e->getMessage(),
      ]);
      return new JsonResponse(['error' => 'Failed to reject user'], 500);
    }
  }

  /**
   * Delete a user account.
   *
   * @param int $uid
   *   The user ID to delete.
   *
   * @return \Symfony\Component\HttpFoundation\JsonResponse
   *   The JSON response.
   */
  public function deleteUser(int $uid): JsonResponse {
    $user = User::load($uid);

    if (!$user) {
      return new JsonResponse(['message' => 'User not found'], 404);
    }

    // Prevent deletion of user 1 (super admin) and current user.
    $currentUser = \Drupal::currentUser();
    if ($uid == 1) {
      return new JsonResponse(['message' => 'Cannot delete the super admin account'], 403);
    }

    if ($uid == $currentUser->id()) {
      return new JsonResponse(['message' => 'Cannot delete your own account'], 403);
    }

    try {
      $username = $user->getAccountName();
      $email = $user->getEmail();

      // Delete the user and their content.
      $user->delete();

      \Drupal::logger('boxtasks_user')->notice('User @username (@email) deleted by @admin', [
        '@username' => $username,
        '@email' => $email,
        '@admin' => $currentUser->getAccountName(),
      ]);

      return new JsonResponse([
        'success' => TRUE,
        'message' => 'User deleted successfully',
        'user' => [
          'username' => $username,
          'email' => $email,
        ],
      ]);
    }
    catch (\Exception $e) {
      \Drupal::logger('boxtasks_user')->error('Failed to delete user @uid: @message', [
        '@uid' => $uid,
        '@message' => $e->getMessage(),
      ]);
      return new JsonResponse(['message' => 'Failed to delete user'], 500);
    }
  }

}
