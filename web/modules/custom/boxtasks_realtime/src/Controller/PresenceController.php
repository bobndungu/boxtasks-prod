<?php

namespace Drupal\boxtasks_realtime\Controller;

use Drupal\Core\Controller\ControllerBase;
use Drupal\boxtasks_realtime\Service\MercurePublisher;
use Symfony\Component\DependencyInjection\ContainerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;

/**
 * Controller for user presence functionality.
 */
class PresenceController extends ControllerBase {

  /**
   * The Mercure publisher service.
   */
  protected MercurePublisher $mercurePublisher;

  /**
   * Constructs a PresenceController object.
   */
  public function __construct(MercurePublisher $mercure_publisher) {
    $this->mercurePublisher = $mercure_publisher;
  }

  /**
   * {@inheritdoc}
   */
  public static function create(ContainerInterface $container) {
    return new static(
      $container->get('boxtasks_realtime.mercure_publisher')
    );
  }

  /**
   * Announces user presence on a board.
   */
  public function announce(Request $request): JsonResponse {
    $currentUser = $this->currentUser();
    if ($currentUser->isAnonymous()) {
      return new JsonResponse(['error' => 'Unauthorized'], 401);
    }

    $content = json_decode($request->getContent(), TRUE);
    $boardId = $content['boardId'] ?? NULL;
    $action = $content['action'] ?? 'join';

    if (!$boardId) {
      return new JsonResponse(['error' => 'Board ID required'], 400);
    }

    // Load user entity to get display name
    $user = $this->entityTypeManager()->getStorage('user')->load($currentUser->id());
    $displayName = $user->get('field_display_name')->value ?? $user->getDisplayName();

    // Get avatar initial
    $avatar = strtoupper(substr($displayName, 0, 1));

    $presenceData = [
      'userId' => $user->uuid(),
      'username' => $currentUser->getAccountName(),
      'displayName' => $displayName,
      'avatar' => $avatar,
      'action' => $action,
      'timestamp' => date('c'),
    ];

    $this->mercurePublisher->publishPresence($boardId, $presenceData);

    return new JsonResponse([
      'success' => TRUE,
      'presence' => $presenceData,
    ]);
  }

  /**
   * Gets active users on a board (from cache/state).
   */
  public function getActive(string $boardId): JsonResponse {
    if ($this->currentUser()->isAnonymous()) {
      return new JsonResponse(['error' => 'Unauthorized'], 401);
    }

    // Get active users from state (with 5-minute timeout)
    $state = \Drupal::state();
    $presenceKey = 'boxtasks_presence_' . $boardId;
    $activeUsers = $state->get($presenceKey, []);

    // Filter out stale entries (older than 5 minutes)
    $now = time();
    $activeUsers = array_filter($activeUsers, function ($user) use ($now) {
      return ($now - $user['lastSeen']) < 300;
    });

    // Update state with filtered list
    $state->set($presenceKey, $activeUsers);

    return new JsonResponse([
      'users' => array_values($activeUsers),
    ]);
  }

}
