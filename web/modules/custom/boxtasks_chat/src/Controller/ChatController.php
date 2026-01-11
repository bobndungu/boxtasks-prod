<?php

namespace Drupal\boxtasks_chat\Controller;

use Drupal\Core\Controller\ControllerBase;
use Drupal\node\Entity\Node;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Drupal\Core\Entity\EntityTypeManagerInterface;
use Symfony\Component\DependencyInjection\ContainerInterface;

/**
 * Controller for chat API endpoints.
 */
class ChatController extends ControllerBase {

  /**
   * The entity type manager.
   *
   * @var \Drupal\Core\Entity\EntityTypeManagerInterface
   */
  protected $entityTypeManager;

  /**
   * Constructs a ChatController object.
   *
   * @param \Drupal\Core\Entity\EntityTypeManagerInterface $entity_type_manager
   *   The entity type manager.
   */
  public function __construct(EntityTypeManagerInterface $entity_type_manager) {
    $this->entityTypeManager = $entity_type_manager;
  }

  /**
   * {@inheritdoc}
   */
  public static function create(ContainerInterface $container) {
    return new static(
      $container->get('entity_type.manager')
    );
  }

  /**
   * Send a chat message.
   */
  public function sendMessage(Request $request): JsonResponse {
    $data = json_decode($request->getContent(), TRUE);

    if (empty($data['channelId']) || empty($data['message'])) {
      return new JsonResponse(['error' => 'Missing required fields'], 400);
    }

    $currentUser = $this->currentUser();
    if ($currentUser->isAnonymous()) {
      return new JsonResponse(['error' => 'Authentication required'], 401);
    }

    // Load the channel
    $channel = $this->loadChannelByUuid($data['channelId']);
    if (!$channel) {
      return new JsonResponse(['error' => 'Channel not found'], 404);
    }

    // Create the message
    $message = Node::create([
      'type' => 'chat_message',
      'title' => 'Chat message',
      'uid' => $currentUser->id(),
      'field_message_text' => [
        'value' => $data['message'],
        'format' => 'plain_text',
      ],
      'field_message_channel' => [
        'target_id' => $channel->id(),
      ],
      'field_message_sender' => [
        'target_id' => $currentUser->id(),
      ],
      'field_message_type' => $data['type'] ?? 'text',
    ]);

    $message->save();

    // Get sender info
    $sender = $this->entityTypeManager->getStorage('user')->load($currentUser->id());
    $senderData = $this->formatUser($sender);

    $messageData = [
      'id' => $message->uuid(),
      'channelId' => $data['channelId'],
      'text' => $data['message'],
      'type' => $data['type'] ?? 'text',
      'sender' => $senderData,
      'createdAt' => $message->getCreatedTime() * 1000,
    ];

    // Publish to Mercure
    $this->publishToMercure($data['channelId'], 'message.created', $messageData);

    return new JsonResponse($messageData);
  }

  /**
   * Get messages for a channel.
   */
  public function getMessages(string $channel_id, Request $request): JsonResponse {
    $currentUser = $this->currentUser();
    if ($currentUser->isAnonymous()) {
      return new JsonResponse(['error' => 'Authentication required'], 401);
    }

    $channel = $this->loadChannelByUuid($channel_id);
    if (!$channel) {
      return new JsonResponse(['error' => 'Channel not found'], 404);
    }

    $limit = $request->query->get('limit', 50);
    $before = $request->query->get('before');

    $query = $this->entityTypeManager->getStorage('node')->getQuery()
      ->condition('type', 'chat_message')
      ->condition('field_message_channel', $channel->id())
      ->sort('created', 'DESC')
      ->range(0, $limit)
      ->accessCheck(TRUE);

    if ($before) {
      $beforeMessage = $this->loadMessageByUuid($before);
      if ($beforeMessage) {
        $query->condition('created', $beforeMessage->getCreatedTime(), '<');
      }
    }

    $nids = $query->execute();
    $messages = [];

    if (!empty($nids)) {
      $nodes = $this->entityTypeManager->getStorage('node')->loadMultiple($nids);
      foreach ($nodes as $node) {
        $messages[] = $this->formatMessage($node);
      }
    }

    // Reverse to get chronological order
    $messages = array_reverse($messages);

    return new JsonResponse([
      'messages' => $messages,
      'hasMore' => count($messages) >= $limit,
    ]);
  }

  /**
   * Mark messages as read in a channel.
   */
  public function markRead(string $channel_id): JsonResponse {
    // For now, we'll implement this as a simple acknowledgment
    // In a full implementation, you'd track read receipts per user
    return new JsonResponse(['success' => TRUE]);
  }

  /**
   * Send typing indicator.
   */
  public function typing(string $channel_id): JsonResponse {
    $currentUser = $this->currentUser();
    if ($currentUser->isAnonymous()) {
      return new JsonResponse(['error' => 'Authentication required'], 401);
    }

    $sender = $this->entityTypeManager->getStorage('user')->load($currentUser->id());
    $senderData = $this->formatUser($sender);

    $typingData = [
      'channelId' => $channel_id,
      'user' => $senderData,
      'timestamp' => time() * 1000,
    ];

    // Publish typing indicator to Mercure
    $this->publishToMercure($channel_id, 'user.typing', $typingData);

    return new JsonResponse(['success' => TRUE]);
  }

  /**
   * Get chat channels for the current user.
   */
  public function getChannels(Request $request): JsonResponse {
    $currentUser = $this->currentUser();
    if ($currentUser->isAnonymous()) {
      return new JsonResponse(['error' => 'Authentication required'], 401);
    }

    $type = $request->query->get('type');
    $entityId = $request->query->get('entityId');

    $query = $this->entityTypeManager->getStorage('node')->getQuery()
      ->condition('type', 'chat_channel')
      ->sort('changed', 'DESC')
      ->accessCheck(TRUE);

    if ($type) {
      $query->condition('field_channel_type', $type);
    }

    if ($entityId) {
      $query->condition('field_channel_entity', $entityId);
    }

    $nids = $query->execute();
    $channels = [];

    if (!empty($nids)) {
      $nodes = $this->entityTypeManager->getStorage('node')->loadMultiple($nids);
      foreach ($nodes as $node) {
        $channels[] = $this->formatChannel($node);
      }
    }

    return new JsonResponse(['channels' => $channels]);
  }

  /**
   * Create a new chat channel.
   */
  public function createChannel(Request $request): JsonResponse {
    $data = json_decode($request->getContent(), TRUE);

    $currentUser = $this->currentUser();
    if ($currentUser->isAnonymous()) {
      return new JsonResponse(['error' => 'Authentication required'], 401);
    }

    if (empty($data['type'])) {
      return new JsonResponse(['error' => 'Channel type is required'], 400);
    }

    // Check if channel already exists for entity
    if (!empty($data['entityId'])) {
      $existing = $this->findChannelByEntity($data['type'], $data['entityId']);
      if ($existing) {
        return new JsonResponse($this->formatChannel($existing));
      }
    }

    // Create the channel
    $channel = Node::create([
      'type' => 'chat_channel',
      'title' => $data['name'] ?? 'Chat Channel',
      'uid' => $currentUser->id(),
      'field_channel_type' => $data['type'],
      'field_channel_entity' => $data['entityId'] ?? NULL,
    ]);

    // Add participants for direct messages
    if ($data['type'] === 'direct' && !empty($data['participants'])) {
      $participantIds = [];
      foreach ($data['participants'] as $uuid) {
        $user = $this->loadUserByUuid($uuid);
        if ($user) {
          $participantIds[] = ['target_id' => $user->id()];
        }
      }
      $channel->set('field_channel_participants', $participantIds);
    }

    $channel->save();

    return new JsonResponse($this->formatChannel($channel));
  }

  /**
   * Format a message node for API response.
   */
  protected function formatMessage(Node $message): array {
    $senderId = $message->get('field_message_sender')->target_id;
    $sender = $senderId ? $this->entityTypeManager->getStorage('user')->load($senderId) : NULL;

    return [
      'id' => $message->uuid(),
      'text' => $message->get('field_message_text')->value ?? '',
      'type' => $message->get('field_message_type')->value ?? 'text',
      'sender' => $sender ? $this->formatUser($sender) : NULL,
      'createdAt' => $message->getCreatedTime() * 1000,
    ];
  }

  /**
   * Format a channel node for API response.
   */
  protected function formatChannel(Node $channel): array {
    $participants = [];
    foreach ($channel->get('field_channel_participants') as $ref) {
      if ($ref->entity) {
        $participants[] = $this->formatUser($ref->entity);
      }
    }

    // Get last message
    $lastMessage = $this->getLastMessage($channel);

    return [
      'id' => $channel->uuid(),
      'name' => $channel->getTitle(),
      'type' => $channel->get('field_channel_type')->value ?? 'board',
      'entityId' => $channel->get('field_channel_entity')->value,
      'participants' => $participants,
      'lastMessage' => $lastMessage,
      'createdAt' => $channel->getCreatedTime() * 1000,
      'updatedAt' => $channel->getChangedTime() * 1000,
    ];
  }

  /**
   * Format a user entity for API response.
   */
  protected function formatUser($user): array {
    return [
      'id' => $user->uuid(),
      'name' => $user->getAccountName(),
      'displayName' => $user->get('field_display_name')->value ?? $user->getAccountName(),
      'avatar' => NULL, // Could add avatar field support
    ];
  }

  /**
   * Get the last message in a channel.
   */
  protected function getLastMessage(Node $channel): ?array {
    $query = $this->entityTypeManager->getStorage('node')->getQuery()
      ->condition('type', 'chat_message')
      ->condition('field_message_channel', $channel->id())
      ->sort('created', 'DESC')
      ->range(0, 1)
      ->accessCheck(TRUE);

    $nids = $query->execute();
    if (!empty($nids)) {
      $message = $this->entityTypeManager->getStorage('node')->load(reset($nids));
      return $this->formatMessage($message);
    }

    return NULL;
  }

  /**
   * Load a channel by UUID.
   */
  protected function loadChannelByUuid(string $uuid): ?Node {
    $nodes = $this->entityTypeManager->getStorage('node')
      ->loadByProperties(['uuid' => $uuid, 'type' => 'chat_channel']);
    return $nodes ? reset($nodes) : NULL;
  }

  /**
   * Load a message by UUID.
   */
  protected function loadMessageByUuid(string $uuid): ?Node {
    $nodes = $this->entityTypeManager->getStorage('node')
      ->loadByProperties(['uuid' => $uuid, 'type' => 'chat_message']);
    return $nodes ? reset($nodes) : NULL;
  }

  /**
   * Load a user by UUID.
   */
  protected function loadUserByUuid(string $uuid) {
    $users = $this->entityTypeManager->getStorage('user')
      ->loadByProperties(['uuid' => $uuid]);
    return $users ? reset($users) : NULL;
  }

  /**
   * Find a channel by entity type and ID.
   */
  protected function findChannelByEntity(string $type, string $entityId): ?Node {
    $nids = $this->entityTypeManager->getStorage('node')->getQuery()
      ->condition('type', 'chat_channel')
      ->condition('field_channel_type', $type)
      ->condition('field_channel_entity', $entityId)
      ->range(0, 1)
      ->accessCheck(TRUE)
      ->execute();

    if (!empty($nids)) {
      return $this->entityTypeManager->getStorage('node')->load(reset($nids));
    }

    return NULL;
  }

  /**
   * Publish event to Mercure.
   */
  protected function publishToMercure(string $channelId, string $eventType, array $data): void {
    $config = \Drupal::config('mercure.settings');
    $hubUrl = $config->get('hub_url') ?? 'http://ddev-boxtasks2-mercure/.well-known/mercure';
    $jwtKey = $config->get('jwt_key') ?? 'boxtasks2-mercure-publisher-secret-key-change-in-production';

    // Create JWT token for publishing
    $payload = [
      'mercure' => [
        'publish' => ['*'],
      ],
      'exp' => time() + 3600,
    ];

    try {
      $jwt = \Firebase\JWT\JWT::encode($payload, $jwtKey, 'HS256');
      $client = new \GuzzleHttp\Client();

      $topic = "/chat/{$channelId}";
      $messageData = [
        'type' => $eventType,
        'data' => $data,
        'timestamp' => date('c'),
      ];

      $client->post($hubUrl, [
        'headers' => [
          'Authorization' => "Bearer {$jwt}",
          'Content-Type' => 'application/x-www-form-urlencoded',
        ],
        'form_params' => [
          'topic' => $topic,
          'data' => json_encode($messageData),
        ],
        'timeout' => 5,
      ]);
    }
    catch (\Exception $e) {
      \Drupal::logger('boxtasks_chat')->error('Mercure publish failed: @message', [
        '@message' => $e->getMessage(),
      ]);
    }
  }

}
