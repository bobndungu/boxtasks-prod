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

    $listEntity = $card->get('field_card_list')->entity;
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

    $boardEntity = $list->get('field_list_board')->entity;
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

    $cardEntity = $comment->get('field_comment_card')->entity;
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

    $cardEntity = $comment->get('field_comment_card')->entity;
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
