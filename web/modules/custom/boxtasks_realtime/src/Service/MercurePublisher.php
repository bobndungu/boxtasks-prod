<?php

namespace Drupal\boxtasks_realtime\Service;

use Drupal\Core\Config\ConfigFactoryInterface;
use Drupal\Core\Entity\EntityTypeManagerInterface;
use Drupal\Core\Logger\LoggerChannelFactoryInterface;
use Drupal\Core\Session\AccountProxyInterface;
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

    $topic = "/boards/{$boardId}";
    $data = [
      'type' => $eventType,
      'data' => [
        'id' => $comment->uuid(),
        'cardTitle' => $cardTitle,
      ],
      'timestamp' => date('c'),
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
    $config = $this->configFactory->get('mercure.settings');
    $hubUrl = $config->get('hub_url') ?? 'http://ddev-boxtasks2-mercure/.well-known/mercure';
    $jwtKey = $config->get('jwt_key') ?? 'boxtasks2-mercure-publisher-secret-key-change-in-production';

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
      'watching' => FALSE,
      'createdAt' => $card->getCreatedTime(),
      'updatedAt' => $card->getChangedTime(),
    ];

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
      $data['dueDate'] = $card->get('field_card_due_date')->value;
    }

    if ($card->hasField('field_card_start_date') && !$card->get('field_card_start_date')->isEmpty()) {
      $data['startDate'] = $card->get('field_card_start_date')->value;
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

    return $data;
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
