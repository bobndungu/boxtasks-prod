<?php

namespace Drupal\boxtasks_realtime\Service;

use Drupal\Core\Config\ConfigFactoryInterface;
use Drupal\Core\Entity\EntityTypeManagerInterface;
use Drupal\Core\Logger\LoggerChannelFactoryInterface;
use Drupal\Core\Session\AccountProxyInterface;
use Drupal\Core\Site\Settings;
use Drupal\node\NodeInterface;
use Firebase\JWT\JWT;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\GuzzleException;

/**
 * Service for publishing real-time updates via Mercure.
 */
class MercurePublisher {

  /**
   * The entity type manager.
   */
  protected EntityTypeManagerInterface $entityTypeManager;

  /**
   * The config factory.
   */
  protected ConfigFactoryInterface $configFactory;

  /**
   * The current user.
   */
  protected AccountProxyInterface $currentUser;

  /**
   * The logger channel.
   */
  protected $logger;

  /**
   * Constructs a MercurePublisher object.
   */
  public function __construct(
    EntityTypeManagerInterface $entity_type_manager,
    ConfigFactoryInterface $config_factory,
    AccountProxyInterface $current_user,
    LoggerChannelFactoryInterface $logger_factory
  ) {
    $this->entityTypeManager = $entity_type_manager;
    $this->configFactory = $config_factory;
    $this->currentUser = $current_user;
    $this->logger = $logger_factory->get('boxtasks_realtime');
  }

  /**
   * Publishes a card event to Mercure.
   */
  public function publishCardEvent(NodeInterface $card, string $eventType): void {
    if ($card->bundle() !== 'card') {
      return;
    }

    $boardId = $this->getBoardIdFromCard($card);
    if (!$boardId) {
      return;
    }

    $topic = "/boards/{$boardId}";
    $data = [
      'type' => $eventType,
      'data' => $this->serializeCard($card),
      'timestamp' => date('c'),
      'actorId' => $this->currentUser->id(),
    ];

    $this->publish($topic, $data);
  }

  /**
   * Publishes a card deleted event to Mercure.
   */
  public function publishCardDeleted(string $cardId, string $boardId): void {
    $topic = "/boards/{$boardId}";
    $data = [
      'type' => 'card.deleted',
      'data' => $cardId,
      'timestamp' => date('c'),
      'actorId' => $this->currentUser->id(),
    ];

    $this->publish($topic, $data);
  }

  /**
   * Publishes a card moved event to Mercure.
   */
  public function publishCardMoved(NodeInterface $card, string $fromListId, string $toListId, int $position): void {
    $boardId = $this->getBoardIdFromCard($card);
    if (!$boardId) {
      return;
    }

    $topic = "/boards/{$boardId}";
    $data = [
      'type' => 'card.moved',
      'data' => [
        'cardId' => $card->uuid(),
        'fromListId' => $fromListId,
        'toListId' => $toListId,
        'position' => $position,
      ],
      'timestamp' => date('c'),
      'actorId' => $this->currentUser->id(),
    ];

    $this->publish($topic, $data);
  }

  /**
   * Publishes a list event to Mercure.
   */
  public function publishListEvent(NodeInterface $list, string $eventType): void {
    if ($list->bundle() !== 'board_list') {
      return;
    }

    $boardId = $this->getBoardIdFromList($list);
    if (!$boardId) {
      return;
    }

    $topic = "/boards/{$boardId}";
    $data = [
      'type' => $eventType,
      'data' => $this->serializeList($list),
      'timestamp' => date('c'),
      'actorId' => $this->currentUser->id(),
    ];

    $this->publish($topic, $data);
  }

  /**
   * Publishes a list deleted event to Mercure.
   */
  public function publishListDeleted(string $listId, string $boardId): void {
    $topic = "/boards/{$boardId}";
    $data = [
      'type' => 'list.deleted',
      'data' => $listId,
      'timestamp' => date('c'),
      'actorId' => $this->currentUser->id(),
    ];

    $this->publish($topic, $data);
  }

  /**
   * Publishes a list reordered event to Mercure.
   *
   * @param string $boardId
   *   The board ID.
   * @param array $listPositions
   *   Array of [listId => position] mappings.
   */
  public function publishListReordered(string $boardId, array $listPositions): void {
    $topic = "/boards/{$boardId}";
    $data = [
      'type' => 'list.reordered',
      'data' => $listPositions,
      'timestamp' => date('c'),
      'actorId' => $this->currentUser->id(),
    ];

    $this->publish($topic, $data);
  }

  /**
   * Publishes user presence to Mercure.
   */
  public function publishPresence(string $boardId, array $presenceData): void {
    $topic = "/boards/{$boardId}";
    $data = [
      'type' => 'presence.update',
      'data' => $presenceData,
      'timestamp' => date('c'),
    ];

    // Also update state for active users tracking
    $state = \Drupal::state();
    $presenceKey = 'boxtasks_presence_' . $boardId;
    $activeUsers = $state->get($presenceKey, []);

    $userId = $presenceData['userId'];
    if ($presenceData['action'] === 'join' || $presenceData['action'] === 'heartbeat') {
      $activeUsers[$userId] = [
        'userId' => $userId,
        'username' => $presenceData['username'],
        'displayName' => $presenceData['displayName'],
        'avatar' => $presenceData['avatar'],
        'lastSeen' => time(),
      ];
    }
    elseif ($presenceData['action'] === 'leave') {
      unset($activeUsers[$userId]);
    }

    $state->set($presenceKey, $activeUsers);
    $this->publish($topic, $data);
  }

  /**
   * Publishes a member assigned event to Mercure.
   *
   * @param \Drupal\node\NodeInterface $card
   *   The card entity.
   * @param int $userId
   *   The user ID that was assigned.
   */
  public function publishMemberAssigned(NodeInterface $card, int $userId): void {
    $boardId = $this->getBoardIdFromCard($card);
    if (!$boardId) {
      return;
    }

    $topic = "/boards/{$boardId}";
    $data = [
      'type' => 'member.assigned',
      'data' => $this->serializeMemberAssignment($card, $userId),
      'timestamp' => date('c'),
      'actorId' => $this->currentUser->id(),
    ];

    $this->publish($topic, $data);
  }

  /**
   * Publishes a member unassigned event to Mercure.
   *
   * @param \Drupal\node\NodeInterface $card
   *   The card entity.
   * @param int $userId
   *   The user ID that was unassigned.
   */
  public function publishMemberUnassigned(NodeInterface $card, int $userId): void {
    $boardId = $this->getBoardIdFromCard($card);
    if (!$boardId) {
      return;
    }

    $topic = "/boards/{$boardId}";
    $data = [
      'type' => 'member.unassigned',
      'data' => $this->serializeMemberAssignment($card, $userId),
      'timestamp' => date('c'),
      'actorId' => $this->currentUser->id(),
    ];

    $this->publish($topic, $data);
  }

  /**
   * Serializes member assignment data for publishing.
   */
  protected function serializeMemberAssignment(NodeInterface $card, int $changedUserId): array {
    $userStorage = $this->entityTypeManager->getStorage('user');
    $changedUser = $userStorage->load($changedUserId);

    // Get all current members using explicit entity loading (not lazy loading)
    $memberIds = [];
    $members = [];
    if ($card->hasField('field_card_members')) {
      foreach ($card->get('field_card_members') as $memberRef) {
        if ($memberRef->target_id) {
          $user = $userStorage->load($memberRef->target_id);
          if ($user) {
            $memberIds[] = $user->uuid();
            $displayName = $user->hasField('field_display_name') && !$user->get('field_display_name')->isEmpty()
              ? $user->get('field_display_name')->value
              : $user->getDisplayName();
            $members[] = [
              'id' => $user->uuid(),
              'name' => $displayName,
              'email' => $user->getEmail(),
            ];
          }
        }
      }
    }

    // Get changed user display name safely
    $changedUserDisplayName = 'Unknown';
    if ($changedUser) {
      $changedUserDisplayName = $changedUser->hasField('field_display_name') && !$changedUser->get('field_display_name')->isEmpty()
        ? $changedUser->get('field_display_name')->value
        : $changedUser->getDisplayName();
    }

    return [
      'cardId' => $card->uuid(),
      'userId' => $changedUser ? $changedUser->uuid() : (string) $changedUserId,
      'userName' => $changedUser ? $changedUser->getAccountName() : 'Unknown',
      'userDisplayName' => $changedUserDisplayName,
      'memberIds' => $memberIds,
      'members' => $members,
    ];
  }

  /**
   * Publishes a comment deleted event to Mercure.
   *
   * @param string $commentId
   *   The comment UUID.
   * @param string|null $cardId
   *   The card UUID (optional).
   * @param string $boardId
   *   The board UUID.
   */
  public function publishCommentDeleted(string $commentId, ?string $cardId, string $boardId): void {
    $topic = "/boards/{$boardId}";
    $data = [
      'type' => 'comment.deleted',
      'data' => [
        'id' => $commentId,
        'cardId' => $cardId,
      ],
      'timestamp' => date('c'),
      'actorId' => $this->currentUser->id(),
    ];

    $this->publish($topic, $data);
  }

  /**
   * Publishes a comment event to Mercure.
   */
  public function publishCommentEvent(NodeInterface $comment, string $eventType): void {
    if ($comment->bundle() !== 'card_comment') {
      return;
    }

    $boardId = $this->getBoardIdFromComment($comment);
    if (!$boardId) {
      return;
    }

    $cardTitle = $this->getCardTitleFromComment($comment);

    // Get card ID
    $cardId = NULL;
    if ($comment->hasField('field_comment_card') && !$comment->get('field_comment_card')->isEmpty()) {
      $card = $comment->get('field_comment_card')->entity;
      if ($card) {
        $cardId = $card->uuid();
      }
    }

    // Get comment text
    $text = '';
    if ($comment->hasField('field_comment_text') && !$comment->get('field_comment_text')->isEmpty()) {
      $text = $comment->get('field_comment_text')->value;
    }

    // Get author info
    $authorId = NULL;
    $authorName = 'Unknown';
    $author = $comment->getOwner();
    if ($author) {
      $authorId = $author->uuid();
      $authorName = $author->getDisplayName();
    }

    $topic = "/boards/{$boardId}";
    $data = [
      'type' => $eventType,
      'data' => [
        'id' => $comment->uuid(),
        'text' => $text,
        'cardId' => $cardId,
        'cardTitle' => $cardTitle,
        'authorId' => $authorId,
        'authorName' => $authorName,
        'createdAt' => $comment->getCreatedTime() ? date('c', $comment->getCreatedTime()) : date('c'),
        'updatedAt' => $comment->getChangedTime() ? date('c', $comment->getChangedTime()) : date('c'),
        'reactions' => [],
      ],
      'timestamp' => date('c'),
      'actorId' => $this->currentUser->id(),
    ];

    $this->publish($topic, $data);
  }

  /**
   * Publishes an activity event to Mercure.
   *
   * @param \Drupal\node\NodeInterface $activity
   *   The activity entity.
   */
  public function publishActivityEvent(NodeInterface $activity): void {
    if ($activity->bundle() !== 'activity') {
      return;
    }

    // Get board ID from activity
    $boardId = NULL;
    if ($activity->hasField('field_activity_board') && !$activity->get('field_activity_board')->isEmpty()) {
      $nodeStorage = $this->entityTypeManager->getStorage('node');
      $boardTargetId = $activity->get('field_activity_board')->target_id;
      $board = $nodeStorage->load($boardTargetId);
      if ($board) {
        $boardId = $board->uuid();
      }
    }

    // If no board, try to get from card
    if (!$boardId && $activity->hasField('field_activity_card') && !$activity->get('field_activity_card')->isEmpty()) {
      $nodeStorage = $this->entityTypeManager->getStorage('node');
      $cardTargetId = $activity->get('field_activity_card')->target_id;
      $card = $nodeStorage->load($cardTargetId);
      if ($card) {
        $boardId = $this->getBoardIdFromCard($card);
      }
    }

    if (!$boardId) {
      return;
    }

    // Get author info
    $authorId = NULL;
    $authorName = 'Unknown';
    $author = $activity->getOwner();
    if ($author) {
      $authorId = $author->uuid();
      $authorName = $author->hasField('field_display_name') && !$author->get('field_display_name')->isEmpty()
        ? $author->get('field_display_name')->value
        : $author->getDisplayName();
    }

    // Get card ID if present
    $cardId = NULL;
    if ($activity->hasField('field_activity_card') && !$activity->get('field_activity_card')->isEmpty()) {
      $nodeStorage = $this->entityTypeManager->getStorage('node');
      $cardTargetId = $activity->get('field_activity_card')->target_id;
      $card = $nodeStorage->load($cardTargetId);
      if ($card) {
        $cardId = $card->uuid();
      }
    }

    // Get description
    $description = '';
    if ($activity->hasField('field_activity_description') && !$activity->get('field_activity_description')->isEmpty()) {
      $description = $activity->get('field_activity_description')->value;
    }

    // Get activity type
    $activityType = 'card_updated';
    if ($activity->hasField('field_activity_type') && !$activity->get('field_activity_type')->isEmpty()) {
      $activityType = $activity->get('field_activity_type')->value;
    }

    // Get activity data
    $activityData = NULL;
    if ($activity->hasField('field_activity_data') && !$activity->get('field_activity_data')->isEmpty()) {
      $rawData = $activity->get('field_activity_data')->value;
      if ($rawData) {
        $activityData = json_decode($rawData, TRUE);
      }
    }

    $topic = "/boards/{$boardId}";
    $data = [
      'type' => 'activity.created',
      'data' => [
        'id' => $activity->uuid(),
        'type' => $activityType,
        'description' => $description,
        'cardId' => $cardId,
        'boardId' => $boardId,
        'authorId' => $authorId,
        'authorName' => $authorName,
        'createdAt' => gmdate('Y-m-d\TH:i:s\Z', $activity->getCreatedTime()),
        'data' => $activityData,
      ],
      'timestamp' => gmdate('Y-m-d\TH:i:s\Z'),
      'actorId' => $this->currentUser->id(),
    ];

    $this->publish($topic, $data);
  }

  /**
   * Publishes a notification to a user's notification topic.
   *
   * @param int $userId
   *   The user ID to notify.
   * @param \Drupal\node\NodeInterface $notification
   *   The notification entity.
   */
  public function publishNotification(int $userId, NodeInterface $notification): void {
    if ($notification->bundle() !== 'notification') {
      return;
    }

    // Get user UUID
    $userStorage = $this->entityTypeManager->getStorage('user');
    $user = $userStorage->load($userId);
    if (!$user) {
      return;
    }

    $topic = "/users/{$user->uuid()}/notifications";

    // Get card reference if exists
    $cardId = NULL;
    if ($notification->hasField('field_notification_card') && !$notification->get('field_notification_card')->isEmpty()) {
      $card = $notification->get('field_notification_card')->entity;
      if ($card) {
        $cardId = $card->uuid();
      }
    }

    // Get actor reference if exists
    $actorId = NULL;
    $actorName = NULL;
    if ($notification->hasField('field_notification_actor') && !$notification->get('field_notification_actor')->isEmpty()) {
      $actor = $notification->get('field_notification_actor')->entity;
      if ($actor) {
        $actorId = $actor->uuid();
        $actorName = $actor->get('field_display_name')->value ?? $actor->getDisplayName();
      }
    }

    $data = [
      'type' => 'notification.created',
      'data' => [
        'id' => $notification->uuid(),
        'type' => $notification->get('field_notification_type')->value,
        'message' => $notification->get('field_notification_message')->value,
        'cardId' => $cardId,
        'actorId' => $actorId,
        'actorName' => $actorName,
        'read' => (bool) $notification->get('field_notification_read')->value,
        'createdAt' => date('c', $notification->getCreatedTime()),
      ],
      'timestamp' => date('c'),
    ];

    $this->publish($topic, $data);
  }

  /**
   * Publishes data to a Mercure topic.
   */
  protected function publish(string $topic, array $data): void {
    // Try to get Mercure settings from $settings first (set in settings.php),
    // then fall back to config, then to DDEV defaults.
    $mercureSettings = Settings::get('mercure', []);
    $config = $this->configFactory->get('mercure.settings');

    // For publishing, we need the internal URL (where Mercure hub listens).
    // The public URL (in MERCURE_URL) is for clients to subscribe.
    // On production, Mercure listens on localhost:3080.
    $hubUrl = $mercureSettings['hub_url_internal']
      ?? $mercureSettings['hub_url']
      ?? $config->get('hub_url')
      ?? getenv('MERCURE_INTERNAL_URL')
      ?? 'http://ddev-boxtasks2-mercure/.well-known/mercure';

    $jwtKey = $mercureSettings['jwt_secret']
      ?? $config->get('jwt_key')
      ?? getenv('MERCURE_JWT_SECRET')
      ?? 'boxtasks2-mercure-publisher-secret-key-change-in-production';

    // Create JWT token for publishing
    $payload = [
      'mercure' => [
        'publish' => ['*'],
      ],
      'exp' => time() + 3600,
    ];
    $jwt = JWT::encode($payload, $jwtKey, 'HS256');

    try {
      $client = new Client();
      $response = $client->post($hubUrl, [
        'headers' => [
          'Authorization' => "Bearer {$jwt}",
          'Content-Type' => 'application/x-www-form-urlencoded',
        ],
        'form_params' => [
          'topic' => $topic,
          'data' => json_encode($data),
        ],
        'timeout' => 5,
      ]);

      $this->logger->debug('Mercure publish successful: @topic', [
        '@topic' => $topic,
      ]);
    }
    catch (GuzzleException $e) {
      $this->logger->error('Mercure publish failed: @message', [
        '@message' => $e->getMessage(),
      ]);
    }
  }

  /**
   * Gets the board ID from a card.
   */
  protected function getBoardIdFromCard(NodeInterface $card): ?string {
    if (!$card->hasField('field_card_list') || $card->get('field_card_list')->isEmpty()) {
      return NULL;
    }

    // Use explicit entity loading instead of lazy loading (->entity)
    // which may not work reliably during hook_entity_update
    $nodeStorage = $this->entityTypeManager->getStorage('node');
    $listTargetId = $card->get('field_card_list')->target_id;
    $listEntity = $nodeStorage->load($listTargetId);
    if (!$listEntity) {
      return NULL;
    }

    return $this->getBoardIdFromList($listEntity);
  }

  /**
   * Gets the board ID from a list.
   */
  protected function getBoardIdFromList(NodeInterface $list): ?string {
    if (!$list->hasField('field_list_board') || $list->get('field_list_board')->isEmpty()) {
      return NULL;
    }

    // Use explicit entity loading instead of lazy loading (->entity)
    // which may not work reliably during hook_entity_update
    $nodeStorage = $this->entityTypeManager->getStorage('node');
    $boardTargetId = $list->get('field_list_board')->target_id;
    $boardEntity = $nodeStorage->load($boardTargetId);
    if (!$boardEntity) {
      return NULL;
    }

    return $boardEntity->uuid();
  }

  /**
   * Gets the board ID from a comment.
   */
  protected function getBoardIdFromComment(NodeInterface $comment): ?string {
    if (!$comment->hasField('field_comment_card') || $comment->get('field_comment_card')->isEmpty()) {
      return NULL;
    }

    // Use explicit entity loading instead of lazy loading (->entity)
    $nodeStorage = $this->entityTypeManager->getStorage('node');
    $cardTargetId = $comment->get('field_comment_card')->target_id;
    $cardEntity = $nodeStorage->load($cardTargetId);
    if (!$cardEntity) {
      return NULL;
    }

    return $this->getBoardIdFromCard($cardEntity);
  }

  /**
   * Gets the card title from a comment.
   */
  protected function getCardTitleFromComment(NodeInterface $comment): ?string {
    if (!$comment->hasField('field_comment_card') || $comment->get('field_comment_card')->isEmpty()) {
      return NULL;
    }

    // Use explicit entity loading instead of lazy loading (->entity)
    $nodeStorage = $this->entityTypeManager->getStorage('node');
    $cardTargetId = $comment->get('field_comment_card')->target_id;
    $cardEntity = $nodeStorage->load($cardTargetId);
    return $cardEntity?->label();
  }

  /**
   * Serializes a card to an array for JSON.
   */
  protected function serializeCard(NodeInterface $card): array {
    $userStorage = $this->entityTypeManager->getStorage('user');

    $data = [
      'id' => $card->uuid(),
      'title' => $card->label(),
      'listId' => NULL,
      'position' => 0,
      'description' => '',
      'dueDate' => NULL,
      'startDate' => NULL,
      'labels' => [],
      'archived' => FALSE,
      'completed' => FALSE,
      'coverImage' => NULL,
      'members' => [],
      'memberIds' => [],
      'watchers' => [],
      'watcherIds' => [],
      'authorId' => NULL,
      'watching' => FALSE,
      'createdAt' => $card->getCreatedTime(),
      'updatedAt' => $card->getChangedTime(),
    ];

    // Get author info.
    $author = $card->getOwner();
    if ($author) {
      $data['authorId'] = $author->uuid();
    }

    if ($card->hasField('field_card_list') && !$card->get('field_card_list')->isEmpty()) {
      $data['listId'] = $card->get('field_card_list')->entity?->uuid();
    }

    if ($card->hasField('field_card_position') && !$card->get('field_card_position')->isEmpty()) {
      $data['position'] = (int) $card->get('field_card_position')->value;
    }

    if ($card->hasField('field_card_description') && !$card->get('field_card_description')->isEmpty()) {
      $data['description'] = $card->get('field_card_description')->value;
    }

    if ($card->hasField('field_card_due_date') && !$card->get('field_card_due_date')->isEmpty()) {
      // Append 'Z' to indicate UTC - Drupal stores dates in UTC but without timezone suffix
      $data['dueDate'] = $card->get('field_card_due_date')->value . 'Z';
    }

    if ($card->hasField('field_card_start_date') && !$card->get('field_card_start_date')->isEmpty()) {
      // Append 'Z' to indicate UTC - Drupal stores dates in UTC but without timezone suffix
      $data['startDate'] = $card->get('field_card_start_date')->value . 'Z';
    }

    if ($card->hasField('field_card_labels') && !$card->get('field_card_labels')->isEmpty()) {
      $data['labels'] = array_map(function ($item) {
        return $item['value'];
      }, $card->get('field_card_labels')->getValue());
    }

    if ($card->hasField('field_card_archived') && !$card->get('field_card_archived')->isEmpty()) {
      $data['archived'] = (bool) $card->get('field_card_archived')->value;
    }

    if ($card->hasField('field_card_completed') && !$card->get('field_card_completed')->isEmpty()) {
      $data['completed'] = (bool) $card->get('field_card_completed')->value;
    }

    // Get members (assigned users).
    if ($card->hasField('field_card_members')) {
      foreach ($card->get('field_card_members') as $memberRef) {
        if ($memberRef->target_id) {
          $user = $userStorage->load($memberRef->target_id);
          if ($user) {
            $data['memberIds'][] = $user->uuid();
            $displayName = $user->hasField('field_display_name') && !$user->get('field_display_name')->isEmpty()
              ? $user->get('field_display_name')->value
              : $user->getDisplayName();
            $data['members'][] = [
              'id' => $user->uuid(),
              'name' => $displayName,
              'email' => $user->getEmail(),
            ];
          }
        }
      }
    }

    // Get watchers.
    if ($card->hasField('field_card_watchers')) {
      foreach ($card->get('field_card_watchers') as $watcherRef) {
        if ($watcherRef->target_id) {
          $user = $userStorage->load($watcherRef->target_id);
          if ($user) {
            $data['watcherIds'][] = $user->uuid();
            $displayName = $user->hasField('field_display_name') && !$user->get('field_display_name')->isEmpty()
              ? $user->get('field_display_name')->value
              : $user->getDisplayName();
            $data['watchers'][] = [
              'id' => $user->uuid(),
              'name' => $displayName,
              'email' => $user->getEmail(),
            ];
          }
        }
      }
    }

    // Get approval status.
    $data['isApproved'] = FALSE;
    $data['approvedBy'] = NULL;
    $data['approvedAt'] = NULL;
    if ($card->hasField('field_card_approved') && !$card->get('field_card_approved')->isEmpty()) {
      $data['isApproved'] = (bool) $card->get('field_card_approved')->value;
    }
    if ($card->hasField('field_card_approved_by') && !$card->get('field_card_approved_by')->isEmpty()) {
      $approver = $userStorage->load($card->get('field_card_approved_by')->target_id);
      if ($approver) {
        $displayName = $approver->hasField('field_display_name') && !$approver->get('field_display_name')->isEmpty()
          ? $approver->get('field_display_name')->value
          : $approver->getDisplayName();
        $data['approvedBy'] = [
          'id' => $approver->uuid(),
          'name' => $displayName,
          'email' => $approver->getEmail(),
        ];
      }
    }
    if ($card->hasField('field_card_approved_at') && !$card->get('field_card_approved_at')->isEmpty()) {
      $data['approvedAt'] = $card->get('field_card_approved_at')->value . 'Z';
    }

    // Get rejection status.
    $data['isRejected'] = FALSE;
    $data['rejectedBy'] = NULL;
    $data['rejectedAt'] = NULL;
    if ($card->hasField('field_card_rejected') && !$card->get('field_card_rejected')->isEmpty()) {
      $data['isRejected'] = (bool) $card->get('field_card_rejected')->value;
    }
    if ($card->hasField('field_card_rejected_by') && !$card->get('field_card_rejected_by')->isEmpty()) {
      $rejecter = $userStorage->load($card->get('field_card_rejected_by')->target_id);
      if ($rejecter) {
        $displayName = $rejecter->hasField('field_display_name') && !$rejecter->get('field_display_name')->isEmpty()
          ? $rejecter->get('field_display_name')->value
          : $rejecter->getDisplayName();
        $data['rejectedBy'] = [
          'id' => $rejecter->uuid(),
          'name' => $displayName,
          'email' => $rejecter->getEmail(),
        ];
      }
    }
    if ($card->hasField('field_card_rejected_at') && !$card->get('field_card_rejected_at')->isEmpty()) {
      $data['rejectedAt'] = $card->get('field_card_rejected_at')->value . 'Z';
    }

    return $data;
  }

  /**
   * Publishes a workspace member added event.
   *
   * @param string $workspaceId
   *   The workspace UUID.
   * @param int $userId
   *   The user ID that was added.
   * @param string|null $roleId
   *   Optional role UUID assigned.
   * @param string|null $roleName
   *   Optional role name.
   */
  public function publishWorkspaceMemberAdded(string $workspaceId, int $userId, ?string $roleId = NULL, ?string $roleName = NULL): void {
    $userStorage = $this->entityTypeManager->getStorage('user');
    $user = $userStorage->load($userId);
    if (!$user) {
      return;
    }

    $displayName = $user->hasField('field_display_name') && !$user->get('field_display_name')->isEmpty()
      ? $user->get('field_display_name')->value
      : $user->getDisplayName();

    // Publish to workspace topic for all members to see
    $topic = "/workspaces/{$workspaceId}";
    $data = [
      'type' => 'workspace.member_added',
      'data' => [
        'workspaceId' => $workspaceId,
        'userId' => $user->uuid(),
        'displayName' => $displayName,
        'email' => $user->getEmail(),
        'roleId' => $roleId,
        'roleName' => $roleName,
      ],
      'timestamp' => date('c'),
      'actorId' => $this->currentUser->id(),
    ];
    $this->publish($topic, $data);

    // Also publish to user's personal topic so they can refresh their workspace list
    $userTopic = "/users/{$user->uuid()}/workspaces";
    $userData = [
      'type' => 'workspace.assigned',
      'data' => [
        'workspaceId' => $workspaceId,
        'roleId' => $roleId,
        'roleName' => $roleName,
      ],
      'timestamp' => date('c'),
      'actorId' => $this->currentUser->id(),
    ];
    $this->publish($userTopic, $userData);
  }

  /**
   * Publishes a workspace member removed event.
   *
   * @param string $workspaceId
   *   The workspace UUID.
   * @param int $userId
   *   The user ID that was removed.
   */
  public function publishWorkspaceMemberRemoved(string $workspaceId, int $userId): void {
    $userStorage = $this->entityTypeManager->getStorage('user');
    $user = $userStorage->load($userId);
    if (!$user) {
      return;
    }

    // Publish to workspace topic
    $topic = "/workspaces/{$workspaceId}";
    $data = [
      'type' => 'workspace.member_removed',
      'data' => [
        'workspaceId' => $workspaceId,
        'userId' => $user->uuid(),
      ],
      'timestamp' => date('c'),
      'actorId' => $this->currentUser->id(),
    ];
    $this->publish($topic, $data);

    // Also publish to user's personal topic
    $userTopic = "/users/{$user->uuid()}/workspaces";
    $userData = [
      'type' => 'workspace.unassigned',
      'data' => [
        'workspaceId' => $workspaceId,
      ],
      'timestamp' => date('c'),
      'actorId' => $this->currentUser->id(),
    ];
    $this->publish($userTopic, $userData);
  }

  /**
   * Publishes a workspace member role changed event.
   *
   * @param string $workspaceId
   *   The workspace UUID.
   * @param int $userId
   *   The user ID whose role changed.
   * @param string $roleId
   *   The new role UUID.
   * @param string $roleName
   *   The new role name.
   */
  public function publishWorkspaceMemberRoleChanged(string $workspaceId, int $userId, string $roleId, string $roleName): void {
    $userStorage = $this->entityTypeManager->getStorage('user');
    $user = $userStorage->load($userId);
    if (!$user) {
      return;
    }

    $displayName = $user->hasField('field_display_name') && !$user->get('field_display_name')->isEmpty()
      ? $user->get('field_display_name')->value
      : $user->getDisplayName();

    // Publish to workspace topic
    $topic = "/workspaces/{$workspaceId}";
    $data = [
      'type' => 'workspace.member_role_changed',
      'data' => [
        'workspaceId' => $workspaceId,
        'userId' => $user->uuid(),
        'displayName' => $displayName,
        'roleId' => $roleId,
        'roleName' => $roleName,
      ],
      'timestamp' => date('c'),
      'actorId' => $this->currentUser->id(),
    ];
    $this->publish($topic, $data);
  }

  /**
   * Publishes a workspace role permissions updated event.
   *
   * This notifies all users who have this role that their permissions have changed.
   *
   * @param \Drupal\node\NodeInterface $workspaceRole
   *   The workspace_role entity that was updated.
   */
  public function publishWorkspaceRolePermissionsUpdated(NodeInterface $workspaceRole): void {
    if ($workspaceRole->bundle() !== 'workspace_role') {
      return;
    }

    $roleId = $workspaceRole->uuid();
    $roleName = $workspaceRole->label();
    $nodeStorage = $this->entityTypeManager->getStorage('node');
    $userStorage = $this->entityTypeManager->getStorage('user');

    // Find all member_role nodes that reference this workspace_role
    $memberRoleIds = $nodeStorage->getQuery()
      ->accessCheck(FALSE)
      ->condition('type', 'member_role')
      ->condition('field_member_role_role', $workspaceRole->id())
      ->execute();

    if (empty($memberRoleIds)) {
      return;
    }

    $memberRoles = $nodeStorage->loadMultiple($memberRoleIds);
    $notifiedWorkspaces = [];
    $notifiedUsers = [];

    foreach ($memberRoles as $memberRole) {
      // Get workspace ID
      $workspaceId = NULL;
      if ($memberRole->hasField('field_member_role_workspace') && !$memberRole->get('field_member_role_workspace')->isEmpty()) {
        $workspace = $memberRole->get('field_member_role_workspace')->entity;
        if ($workspace) {
          $workspaceId = $workspace->uuid();
        }
      }

      // Get user
      $userId = NULL;
      $userUuid = NULL;
      if ($memberRole->hasField('field_member_role_user') && !$memberRole->get('field_member_role_user')->isEmpty()) {
        $userId = $memberRole->get('field_member_role_user')->target_id;
        $user = $userStorage->load($userId);
        if ($user) {
          $userUuid = $user->uuid();
        }
      }

      // Publish to workspace topic (once per workspace)
      if ($workspaceId && !isset($notifiedWorkspaces[$workspaceId])) {
        $topic = "/workspaces/{$workspaceId}";
        $data = [
          'type' => 'workspace.role_permissions_updated',
          'data' => [
            'workspaceId' => $workspaceId,
            'roleId' => $roleId,
            'roleName' => $roleName,
          ],
          'timestamp' => date('c'),
          'actorId' => $this->currentUser->id(),
        ];
        $this->publish($topic, $data);
        $notifiedWorkspaces[$workspaceId] = TRUE;
      }

      // Publish to user's personal topic (once per user)
      if ($userUuid && !isset($notifiedUsers[$userUuid])) {
        $userTopic = "/users/{$userUuid}/permissions";
        $userData = [
          'type' => 'permissions.updated',
          'data' => [
            'roleId' => $roleId,
            'roleName' => $roleName,
          ],
          'timestamp' => date('c'),
          'actorId' => $this->currentUser->id(),
        ];
        $this->publish($userTopic, $userData);
        $notifiedUsers[$userUuid] = TRUE;
      }
    }
  }

  /**
   * Publishes a board member added event.
   *
   * @param string $boardId
   *   The board UUID.
   * @param int $userId
   *   The user ID that was added.
   * @param string|null $roleId
   *   Optional role UUID assigned.
   * @param string|null $roleName
   *   Optional role name.
   * @param bool $isAdmin
   *   Whether the user is a board admin.
   */
  public function publishBoardMemberAdded(string $boardId, int $userId, ?string $roleId = NULL, ?string $roleName = NULL, bool $isAdmin = FALSE): void {
    $userStorage = $this->entityTypeManager->getStorage('user');
    $user = $userStorage->load($userId);
    if (!$user) {
      return;
    }

    $displayName = $user->hasField('field_display_name') && !$user->get('field_display_name')->isEmpty()
      ? $user->get('field_display_name')->value
      : $user->getDisplayName();

    $topic = "/boards/{$boardId}";
    $data = [
      'type' => 'board.member_added',
      'data' => [
        'boardId' => $boardId,
        'userId' => $user->uuid(),
        'displayName' => $displayName,
        'email' => $user->getEmail(),
        'roleId' => $roleId,
        'roleName' => $roleName,
        'isAdmin' => $isAdmin,
      ],
      'timestamp' => date('c'),
      'actorId' => $this->currentUser->id(),
    ];
    $this->publish($topic, $data);
  }

  /**
   * Publishes a board member removed event.
   *
   * @param string $boardId
   *   The board UUID.
   * @param int $userId
   *   The user ID that was removed.
   */
  public function publishBoardMemberRemoved(string $boardId, int $userId): void {
    $userStorage = $this->entityTypeManager->getStorage('user');
    $user = $userStorage->load($userId);
    if (!$user) {
      return;
    }

    $topic = "/boards/{$boardId}";
    $data = [
      'type' => 'board.member_removed',
      'data' => [
        'boardId' => $boardId,
        'userId' => $user->uuid(),
      ],
      'timestamp' => date('c'),
      'actorId' => $this->currentUser->id(),
    ];
    $this->publish($topic, $data);
  }

  /**
   * Publishes a custom field value created event.
   */
  public function publishCustomFieldValueCreated(NodeInterface $fieldValue): void {
    if ($fieldValue->bundle() !== 'card_custom_field_value') {
      return;
    }

    $boardId = $this->getBoardIdFromCustomFieldValue($fieldValue);
    if (!$boardId) {
      return;
    }

    $topic = "/boards/{$boardId}";
    $data = [
      'type' => 'customfield.value_created',
      'data' => $this->serializeCustomFieldValue($fieldValue),
      'timestamp' => date('c'),
      'actorId' => $this->currentUser->id(),
    ];

    $this->publish($topic, $data);
  }

  /**
   * Publishes a custom field value updated event.
   */
  public function publishCustomFieldValueUpdated(NodeInterface $fieldValue): void {
    if ($fieldValue->bundle() !== 'card_custom_field_value') {
      return;
    }

    $boardId = $this->getBoardIdFromCustomFieldValue($fieldValue);
    if (!$boardId) {
      return;
    }

    $topic = "/boards/{$boardId}";
    $data = [
      'type' => 'customfield.value_updated',
      'data' => $this->serializeCustomFieldValue($fieldValue),
      'timestamp' => date('c'),
      'actorId' => $this->currentUser->id(),
    ];

    $this->publish($topic, $data);
  }

  /**
   * Publishes a custom field value deleted event.
   */
  public function publishCustomFieldValueDeleted(string $valueId, string $cardId, string $definitionId, string $boardId): void {
    $topic = "/boards/{$boardId}";
    $data = [
      'type' => 'customfield.value_deleted',
      'data' => [
        'id' => $valueId,
        'cardId' => $cardId,
        'definitionId' => $definitionId,
      ],
      'timestamp' => date('c'),
      'actorId' => $this->currentUser->id(),
    ];

    $this->publish($topic, $data);
  }

  /**
   * Publishes a custom field definition created event.
   */
  public function publishCustomFieldDefinitionCreated(NodeInterface $definition): void {
    if ($definition->bundle() !== 'custom_field_definition') {
      return;
    }

    $boardId = $this->getBoardIdFromCustomFieldDefinition($definition);
    if (!$boardId) {
      return;
    }

    $topic = "/boards/{$boardId}";
    $data = [
      'type' => 'customfield.definition_created',
      'data' => $this->serializeCustomFieldDefinition($definition),
      'timestamp' => date('c'),
      'actorId' => $this->currentUser->id(),
    ];

    $this->publish($topic, $data);
  }

  /**
   * Publishes a custom field definition updated event.
   */
  public function publishCustomFieldDefinitionUpdated(NodeInterface $definition): void {
    if ($definition->bundle() !== 'custom_field_definition') {
      return;
    }

    $boardId = $this->getBoardIdFromCustomFieldDefinition($definition);
    if (!$boardId) {
      return;
    }

    $topic = "/boards/{$boardId}";
    $data = [
      'type' => 'customfield.definition_updated',
      'data' => $this->serializeCustomFieldDefinition($definition),
      'timestamp' => date('c'),
      'actorId' => $this->currentUser->id(),
    ];

    $this->publish($topic, $data);
  }

  /**
   * Publishes a custom field definition deleted event.
   */
  public function publishCustomFieldDefinitionDeleted(string $definitionId, string $boardId): void {
    $topic = "/boards/{$boardId}";
    $data = [
      'type' => 'customfield.definition_deleted',
      'data' => $definitionId,
      'timestamp' => date('c'),
      'actorId' => $this->currentUser->id(),
    ];

    $this->publish($topic, $data);
  }

  /**
   * Gets the board ID from a custom field value.
   */
  protected function getBoardIdFromCustomFieldValue(NodeInterface $fieldValue): ?string {
    if (!$fieldValue->hasField('field_cfv_card') || $fieldValue->get('field_cfv_card')->isEmpty()) {
      return NULL;
    }

    $nodeStorage = $this->entityTypeManager->getStorage('node');
    $cardTargetId = $fieldValue->get('field_cfv_card')->target_id;
    $card = $nodeStorage->load($cardTargetId);
    if (!$card) {
      return NULL;
    }

    return $this->getBoardIdFromCard($card);
  }

  /**
   * Gets the board ID from a custom field definition.
   */
  protected function getBoardIdFromCustomFieldDefinition(NodeInterface $definition): ?string {
    if (!$definition->hasField('field_customfield_board') || $definition->get('field_customfield_board')->isEmpty()) {
      return NULL;
    }

    $nodeStorage = $this->entityTypeManager->getStorage('node');
    $boardTargetId = $definition->get('field_customfield_board')->target_id;
    $board = $nodeStorage->load($boardTargetId);
    if (!$board) {
      return NULL;
    }

    return $board->uuid();
  }

  /**
   * Serializes a custom field value for Mercure.
   */
  protected function serializeCustomFieldValue(NodeInterface $fieldValue): array {
    $nodeStorage = $this->entityTypeManager->getStorage('node');

    $cardId = NULL;
    if ($fieldValue->hasField('field_cfv_card') && !$fieldValue->get('field_cfv_card')->isEmpty()) {
      $cardTargetId = $fieldValue->get('field_cfv_card')->target_id;
      $card = $nodeStorage->load($cardTargetId);
      if ($card) {
        $cardId = $card->uuid();
      }
    }

    $definitionId = NULL;
    $definitionTitle = NULL;
    $fieldType = NULL;
    if ($fieldValue->hasField('field_cfv_definition') && !$fieldValue->get('field_cfv_definition')->isEmpty()) {
      $defTargetId = $fieldValue->get('field_cfv_definition')->target_id;
      $definition = $nodeStorage->load($defTargetId);
      if ($definition) {
        $definitionId = $definition->uuid();
        $definitionTitle = $definition->label();
        if ($definition->hasField('field_customfield_type') && !$definition->get('field_customfield_type')->isEmpty()) {
          $fieldType = $definition->get('field_customfield_type')->value;
        }
      }
    }

    $value = NULL;
    if ($fieldValue->hasField('field_cfv_value') && !$fieldValue->get('field_cfv_value')->isEmpty()) {
      $value = $fieldValue->get('field_cfv_value')->value;
    }

    return [
      'id' => $fieldValue->uuid(),
      'cardId' => $cardId,
      'definitionId' => $definitionId,
      'definitionTitle' => $definitionTitle,
      'value' => $value,
      'type' => $fieldType,
    ];
  }

  /**
   * Serializes a custom field definition for Mercure.
   */
  protected function serializeCustomFieldDefinition(NodeInterface $definition): array {
    $nodeStorage = $this->entityTypeManager->getStorage('node');

    $boardId = NULL;
    if ($definition->hasField('field_customfield_board') && !$definition->get('field_customfield_board')->isEmpty()) {
      $boardTargetId = $definition->get('field_customfield_board')->target_id;
      $board = $nodeStorage->load($boardTargetId);
      if ($board) {
        $boardId = $board->uuid();
      }
    }

    $workspaceId = NULL;
    if ($definition->hasField('field_customfield_workspace') && !$definition->get('field_customfield_workspace')->isEmpty()) {
      $workspaceTargetId = $definition->get('field_customfield_workspace')->target_id;
      $workspace = $nodeStorage->load($workspaceTargetId);
      if ($workspace) {
        $workspaceId = $workspace->uuid();
      }
    }

    $type = 'text';
    if ($definition->hasField('field_customfield_type') && !$definition->get('field_customfield_type')->isEmpty()) {
      $type = $definition->get('field_customfield_type')->value;
    }

    $options = [];
    if ($definition->hasField('field_customfield_options') && !$definition->get('field_customfield_options')->isEmpty()) {
      $optionsRaw = $definition->get('field_customfield_options')->value;
      if ($optionsRaw) {
        $decoded = json_decode($optionsRaw, TRUE);
        if (is_array($decoded)) {
          $options = $decoded;
        }
      }
    }

    $required = FALSE;
    if ($definition->hasField('field_customfield_required') && !$definition->get('field_customfield_required')->isEmpty()) {
      $required = (bool) $definition->get('field_customfield_required')->value;
    }

    $position = 0;
    if ($definition->hasField('field_customfield_position') && !$definition->get('field_customfield_position')->isEmpty()) {
      $position = (int) $definition->get('field_customfield_position')->value;
    }

    $displayLocation = 'sidebar';
    if ($definition->hasField('field_cf_display_loc') && !$definition->get('field_cf_display_loc')->isEmpty()) {
      $displayLocation = $definition->get('field_cf_display_loc')->value;
    }

    $scope = 'board';
    if ($definition->hasField('field_cf_scope') && !$definition->get('field_cf_scope')->isEmpty()) {
      $scope = $definition->get('field_cf_scope')->value;
    }

    return [
      'id' => $definition->uuid(),
      'title' => $definition->label(),
      'boardId' => $boardId,
      'workspaceId' => $workspaceId,
      'type' => $type,
      'options' => $options,
      'required' => $required,
      'position' => $position,
      'displayLocation' => $displayLocation,
      'scope' => $scope,
    ];
  }

  /**
   * Serializes a list to an array for JSON.
   */
  protected function serializeList(NodeInterface $list): array {
    $data = [
      'id' => $list->uuid(),
      'title' => $list->label(),
      'boardId' => NULL,
      'position' => 0,
      'archived' => FALSE,
      'wipLimit' => NULL,
      'color' => NULL,
    ];

    if ($list->hasField('field_list_board') && !$list->get('field_list_board')->isEmpty()) {
      $data['boardId'] = $list->get('field_list_board')->entity?->uuid();
    }

    if ($list->hasField('field_list_position') && !$list->get('field_list_position')->isEmpty()) {
      $data['position'] = (int) $list->get('field_list_position')->value;
    }

    if ($list->hasField('field_list_archived') && !$list->get('field_list_archived')->isEmpty()) {
      $data['archived'] = (bool) $list->get('field_list_archived')->value;
    }

    if ($list->hasField('field_list_wip_limit') && !$list->get('field_list_wip_limit')->isEmpty()) {
      $data['wipLimit'] = (int) $list->get('field_list_wip_limit')->value;
    }

    if ($list->hasField('field_list_color') && !$list->get('field_list_color')->isEmpty()) {
      $data['color'] = $list->get('field_list_color')->value;
    }

    return $data;
  }

}
