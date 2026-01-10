<?php

namespace Drupal\boxtasks_activity;

use Drupal\Core\Entity\EntityTypeManagerInterface;
use Drupal\Core\Session\AccountProxyInterface;
use Drupal\node\NodeInterface;
use Psr\Log\LoggerInterface;

/**
 * Service to log activities for BoxTasks entities.
 */
class ActivityLogger {

  /**
   * Activity types.
   */
  public const TYPE_CARD_CREATED = 'card_created';
  public const TYPE_CARD_UPDATED = 'card_updated';
  public const TYPE_CARD_MOVED = 'card_moved';
  public const TYPE_CARD_COMPLETED = 'card_completed';
  public const TYPE_CARD_ARCHIVED = 'card_archived';
  public const TYPE_CARD_RESTORED = 'card_restored';
  public const TYPE_CARD_DELETED = 'card_deleted';
  public const TYPE_LIST_CREATED = 'list_created';
  public const TYPE_LIST_UPDATED = 'list_updated';
  public const TYPE_LIST_ARCHIVED = 'list_archived';
  public const TYPE_COMMENT_ADDED = 'comment_added';
  public const TYPE_COMMENT_UPDATED = 'comment_updated';
  public const TYPE_COMMENT_DELETED = 'comment_deleted';
  public const TYPE_MEMBER_ADDED = 'member_added';
  public const TYPE_MEMBER_REMOVED = 'member_removed';
  public const TYPE_LABEL_ADDED = 'label_added';
  public const TYPE_LABEL_REMOVED = 'label_removed';
  public const TYPE_DUE_DATE_SET = 'due_date_set';
  public const TYPE_DUE_DATE_REMOVED = 'due_date_removed';
  public const TYPE_CHECKLIST_ADDED = 'checklist_added';
  public const TYPE_CHECKLIST_ITEM_COMPLETED = 'checklist_item_completed';
  public const TYPE_CHECKLIST_ITEM_UNCOMPLETED = 'checklist_item_uncompleted';
  public const TYPE_ATTACHMENT_ADDED = 'attachment_added';
  public const TYPE_ATTACHMENT_REMOVED = 'attachment_removed';

  /**
   * The entity type manager.
   *
   * @var \Drupal\Core\Entity\EntityTypeManagerInterface
   */
  protected EntityTypeManagerInterface $entityTypeManager;

  /**
   * The current user.
   *
   * @var \Drupal\Core\Session\AccountProxyInterface
   */
  protected AccountProxyInterface $currentUser;

  /**
   * The logger.
   *
   * @var \Psr\Log\LoggerInterface
   */
  protected LoggerInterface $logger;

  /**
   * Constructs an ActivityLogger.
   *
   * @param \Drupal\Core\Entity\EntityTypeManagerInterface $entity_type_manager
   *   The entity type manager.
   * @param \Drupal\Core\Session\AccountProxyInterface $current_user
   *   The current user.
   * @param \Psr\Log\LoggerInterface $logger
   *   The logger.
   */
  public function __construct(
    EntityTypeManagerInterface $entity_type_manager,
    AccountProxyInterface $current_user,
    LoggerInterface $logger
  ) {
    $this->entityTypeManager = $entity_type_manager;
    $this->currentUser = $current_user;
    $this->logger = $logger;
  }

  /**
   * Logs an activity.
   *
   * @param string $type
   *   The activity type.
   * @param string $description
   *   A human-readable description of the activity.
   * @param int|null $board_id
   *   The board ID (optional).
   * @param int|null $card_id
   *   The card ID (optional).
   * @param array $data
   *   Additional data to store with the activity.
   *
   * @return \Drupal\node\NodeInterface|null
   *   The created activity node, or NULL on failure.
   */
  public function log(string $type, string $description, ?int $board_id = NULL, ?int $card_id = NULL, array $data = []): ?NodeInterface {
    try {
      $activity = $this->entityTypeManager->getStorage('node')->create([
        'type' => 'activity',
        'title' => $this->generateTitle($type),
        'uid' => $this->currentUser->id(),
        'field_activity_type' => $type,
        'field_activity_description' => $description,
        'field_activity_board' => $board_id,
        'field_activity_card' => $card_id,
        'field_activity_data' => !empty($data) ? json_encode($data) : NULL,
      ]);

      $activity->save();
      return $activity;
    }
    catch (\Exception $e) {
      $this->logger->error('Failed to log activity: @message', [
        '@message' => $e->getMessage(),
      ]);
      return NULL;
    }
  }

  /**
   * Logs a card-related activity.
   *
   * @param string $type
   *   The activity type.
   * @param \Drupal\node\NodeInterface $card
   *   The card node.
   * @param string|null $description
   *   Optional description override.
   * @param array $data
   *   Additional data.
   *
   * @return \Drupal\node\NodeInterface|null
   *   The created activity node.
   */
  public function logCardActivity(string $type, NodeInterface $card, ?string $description = NULL, array $data = []): ?NodeInterface {
    // Get the board ID from the card's list.
    $list_id = $card->get('field_card_list')->target_id;
    $board_id = NULL;

    if ($list_id) {
      $list = $this->entityTypeManager->getStorage('node')->load($list_id);
      if ($list && $list->hasField('field_list_board')) {
        $board_id = $list->get('field_list_board')->target_id;
      }
    }

    if (!$description) {
      $description = $this->generateCardDescription($type, $card, $data);
    }

    return $this->log($type, $description, $board_id, (int) $card->id(), $data);
  }

  /**
   * Gets activities for a card.
   *
   * @param int $card_id
   *   The card ID.
   * @param int $limit
   *   Maximum number of activities to return.
   *
   * @return \Drupal\node\NodeInterface[]
   *   Array of activity nodes.
   */
  public function getCardActivities(int $card_id, int $limit = 50): array {
    $query = $this->entityTypeManager->getStorage('node')->getQuery()
      ->condition('type', 'activity')
      ->condition('field_activity_card', $card_id)
      ->sort('created', 'DESC')
      ->range(0, $limit)
      ->accessCheck(FALSE);

    $ids = $query->execute();
    return $ids ? $this->entityTypeManager->getStorage('node')->loadMultiple($ids) : [];
  }

  /**
   * Gets activities for a board.
   *
   * @param int $board_id
   *   The board ID.
   * @param int $limit
   *   Maximum number of activities to return.
   *
   * @return \Drupal\node\NodeInterface[]
   *   Array of activity nodes.
   */
  public function getBoardActivities(int $board_id, int $limit = 100): array {
    $query = $this->entityTypeManager->getStorage('node')->getQuery()
      ->condition('type', 'activity')
      ->condition('field_activity_board', $board_id)
      ->sort('created', 'DESC')
      ->range(0, $limit)
      ->accessCheck(FALSE);

    $ids = $query->execute();
    return $ids ? $this->entityTypeManager->getStorage('node')->loadMultiple($ids) : [];
  }

  /**
   * Generates a title for an activity.
   *
   * @param string $type
   *   The activity type.
   *
   * @return string
   *   The generated title.
   */
  protected function generateTitle(string $type): string {
    $titles = [
      self::TYPE_CARD_CREATED => 'Card created',
      self::TYPE_CARD_UPDATED => 'Card updated',
      self::TYPE_CARD_MOVED => 'Card moved',
      self::TYPE_CARD_COMPLETED => 'Card completed',
      self::TYPE_CARD_ARCHIVED => 'Card archived',
      self::TYPE_CARD_RESTORED => 'Card restored',
      self::TYPE_CARD_DELETED => 'Card deleted',
      self::TYPE_LIST_CREATED => 'List created',
      self::TYPE_LIST_UPDATED => 'List updated',
      self::TYPE_LIST_ARCHIVED => 'List archived',
      self::TYPE_COMMENT_ADDED => 'Comment added',
      self::TYPE_COMMENT_UPDATED => 'Comment updated',
      self::TYPE_COMMENT_DELETED => 'Comment deleted',
      self::TYPE_MEMBER_ADDED => 'Member added',
      self::TYPE_MEMBER_REMOVED => 'Member removed',
      self::TYPE_LABEL_ADDED => 'Label added',
      self::TYPE_LABEL_REMOVED => 'Label removed',
      self::TYPE_DUE_DATE_SET => 'Due date set',
      self::TYPE_DUE_DATE_REMOVED => 'Due date removed',
      self::TYPE_CHECKLIST_ADDED => 'Checklist added',
      self::TYPE_CHECKLIST_ITEM_COMPLETED => 'Checklist item completed',
      self::TYPE_CHECKLIST_ITEM_UNCOMPLETED => 'Checklist item uncompleted',
      self::TYPE_ATTACHMENT_ADDED => 'Attachment added',
      self::TYPE_ATTACHMENT_REMOVED => 'Attachment removed',
    ];

    return $titles[$type] ?? 'Activity';
  }

  /**
   * Generates a description for a card activity.
   *
   * @param string $type
   *   The activity type.
   * @param \Drupal\node\NodeInterface $card
   *   The card node.
   * @param array $data
   *   Additional data.
   *
   * @return string
   *   The generated description.
   */
  protected function generateCardDescription(string $type, NodeInterface $card, array $data): string {
    $user_name = $this->currentUser->getDisplayName();
    $card_title = $card->getTitle();

    switch ($type) {
      case self::TYPE_CARD_CREATED:
        return "$user_name created card \"$card_title\"";

      case self::TYPE_CARD_MOVED:
        $from = $data['from_list'] ?? 'unknown';
        $to = $data['to_list'] ?? 'unknown';
        return "$user_name moved \"$card_title\" from $from to $to";

      case self::TYPE_CARD_COMPLETED:
        return "$user_name marked \"$card_title\" as complete";

      case self::TYPE_CARD_ARCHIVED:
        return "$user_name archived \"$card_title\"";

      case self::TYPE_CARD_RESTORED:
        return "$user_name restored \"$card_title\"";

      case self::TYPE_COMMENT_ADDED:
        return "$user_name commented on \"$card_title\"";

      case self::TYPE_MEMBER_ADDED:
        $member = $data['member_name'] ?? 'a member';
        return "$user_name added $member to \"$card_title\"";

      case self::TYPE_MEMBER_REMOVED:
        $member = $data['member_name'] ?? 'a member';
        return "$user_name removed $member from \"$card_title\"";

      case self::TYPE_LABEL_ADDED:
        $label = $data['label'] ?? 'a label';
        return "$user_name added label \"$label\" to \"$card_title\"";

      case self::TYPE_LABEL_REMOVED:
        $label = $data['label'] ?? 'a label';
        return "$user_name removed label \"$label\" from \"$card_title\"";

      case self::TYPE_DUE_DATE_SET:
        $date = $data['due_date'] ?? '';
        return "$user_name set due date to $date on \"$card_title\"";

      case self::TYPE_DUE_DATE_REMOVED:
        return "$user_name removed due date from \"$card_title\"";

      case self::TYPE_CHECKLIST_ADDED:
        $checklist = $data['checklist_name'] ?? 'a checklist';
        return "$user_name added checklist \"$checklist\" to \"$card_title\"";

      case self::TYPE_CHECKLIST_ITEM_COMPLETED:
        $item = $data['item_name'] ?? 'an item';
        return "$user_name completed \"$item\" on \"$card_title\"";

      case self::TYPE_ATTACHMENT_ADDED:
        $filename = $data['filename'] ?? 'a file';
        return "$user_name attached $filename to \"$card_title\"";

      default:
        return "$user_name updated \"$card_title\"";
    }
  }

}
