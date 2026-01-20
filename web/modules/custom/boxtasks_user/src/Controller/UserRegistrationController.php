<?php

namespace Drupal\boxtasks_user\Controller;

use Drupal\Core\Controller\ControllerBase;
use Drupal\user\Entity\User;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;

/**
 * Controller for custom user registration.
 */
class UserRegistrationController extends ControllerBase {

  /**
   * Handle user registration with auto-generated username.
   *
   * @param \Symfony\Component\HttpFoundation\Request $request
   *   The request object.
   *
   * @return \Symfony\Component\HttpFoundation\JsonResponse
   *   The JSON response.
   */
  public function register(Request $request): JsonResponse {
    $content = $request->getContent();
    $data = json_decode($content, TRUE);

    // Validate required fields.
    if (empty($data['firstName'])) {
      return new JsonResponse(['message' => 'First name is required'], 400);
    }
    if (empty($data['lastName'])) {
      return new JsonResponse(['message' => 'Last name is required'], 400);
    }
    if (empty($data['email'])) {
      return new JsonResponse(['message' => 'Email is required'], 400);
    }
    if (empty($data['password'])) {
      return new JsonResponse(['message' => 'Password is required'], 400);
    }

    $firstName = trim($data['firstName']);
    $lastName = trim($data['lastName']);
    $email = trim($data['email']);
    $password = $data['password'];

    // Validate email format.
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
      return new JsonResponse(['message' => 'Invalid email format'], 400);
    }

    // Check if email already exists.
    $existing = \Drupal::entityTypeManager()
      ->getStorage('user')
      ->loadByProperties(['mail' => $email]);
    if (!empty($existing)) {
      return new JsonResponse(['message' => 'An account with this email already exists'], 400);
    }

    // Generate username: FirstL format.
    $username = $this->generateUsername($firstName, $lastName);

    // Check registration settings.
    $config = \Drupal::config('user.settings');
    $register = $config->get('register');

    // If registration is admin_only, reject the registration.
    if ($register === 'admin_only') {
      return new JsonResponse([
        'message' => 'Registration is currently disabled. Please contact an administrator.',
      ], 403);
    }

    // Check if approval is required.
    $requireApproval = ($register === 'visitors_admin_approval');

    try {
      // Create the user.
      $user = User::create([
        'name' => $username,
        'mail' => $email,
        'pass' => $password,
        'status' => $requireApproval ? 0 : 1, // Inactive if approval required.
        'field_first_name' => $firstName,
        'field_last_name' => $lastName,
        'field_pending_approval' => $requireApproval ? 1 : 0,
      ]);
      $user->save();

      // Return different response based on approval requirement.
      if ($requireApproval) {
        return new JsonResponse([
          'message' => 'Registration submitted successfully. An administrator will review your request.',
          'pending' => TRUE,
        ], 201);
      }

      return new JsonResponse([
        'message' => 'Account created successfully',
        'username' => $username,
        'uid' => $user->id(),
      ], 201);
    }
    catch (\Exception $e) {
      \Drupal::logger('boxtasks_user')->error('Registration failed: @message', ['@message' => $e->getMessage()]);
      return new JsonResponse(['message' => 'Registration failed. Please try again.'], 500);
    }
  }

  /**
   * Generate a unique username in "FirstL" format.
   *
   * @param string $firstName
   *   The first name.
   * @param string $lastName
   *   The last name.
   *
   * @return string
   *   The generated unique username.
   */
  private function generateUsername(string $firstName, string $lastName): string {
    // Clean and format the names.
    $firstName = preg_replace('/[^a-zA-Z]/', '', $firstName);
    $lastName = preg_replace('/[^a-zA-Z]/', '', $lastName);

    // Capitalize first letter, lowercase rest.
    $firstName = ucfirst(strtolower($firstName));
    $lastInitial = strtoupper(substr($lastName, 0, 1));

    // Base username: FirstL.
    $baseUsername = $firstName . $lastInitial;

    // Check if username exists.
    $username = $baseUsername;
    $counter = 1;

    while ($this->usernameExists($username)) {
      $counter++;
      $username = $baseUsername . $counter;
    }

    return $username;
  }

  /**
   * Check if a username already exists.
   *
   * @param string $username
   *   The username to check.
   *
   * @return bool
   *   TRUE if the username exists, FALSE otherwise.
   */
  private function usernameExists(string $username): bool {
    $users = \Drupal::entityTypeManager()
      ->getStorage('user')
      ->loadByProperties(['name' => $username]);
    return !empty($users);
  }

}
