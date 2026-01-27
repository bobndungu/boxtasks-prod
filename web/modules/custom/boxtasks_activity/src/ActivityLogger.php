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
  public const TYPE_DESCRIPTION_UPDATED = 'description_updated';
  public const TYPE_TITLE_UPDATED = 'title_updated';
  public const TYPE_CUSTOM_FIELD_UPDATED = 'custom_field_updated';
  public const TYPE_DUE_DATE_UPDATED = 'due_date_updated';
  public const TYPE_START_DATE_SET = 'start_date_set';
  public const TYPE_START_DATE_REMOVED = 'start_date_removed';
  public const TYPE_START_DATE_UPDATED = 'start_date_updated';
  public const TYPE_DEPARTMENT_SET = 'department_set';
  public const TYPE_DEPARTMENT_CHANGED = 'department_changed';
  public const TYPE_DEPARTMENT_REMOVED = 'department_removed';
  public const TYPE_CLIENT_SET = 'client_set';
  public const TYPE_CLIENT_CHANGED = 'client_changed';
  public const TYPE_CLIENT_REMOVED = 'client_removed';
  public const TYPE_WATCHER_ADDED = 'watcher_added';
  public const TYPE_WATCHER_REMOVED = 'watcher_removed';

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
   * Gets the full display name for a user.
   *
   * @param int|null $user_id
   *   The user ID. If NULL, uses current user.
   *
   * @return string
   *   The user's full display name from field_display_name, or fallback to account name.
   */
  public function getUserFullName(?int $user_id = NULL): string {
    $uid = $user_id ?? $this->currentUser->id();

    try {
      $user = $this->entityTypeManager->getStorage('user')->load($uid);
      if ($user && $user->hasField('field_display_name') && !$user->get('field_display_name')->isEmpty()) {
        return $user->get('field_display_name')->value;
      }
      // Fallback to display name
      return $user ? $user->getDisplayName() : 'Unknown User';
    }
    catch (\Exception $e) {
      return $this->currentUser->getDisplayName() ?: 'Unknown User';
    }
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

    // Always include card_title in the data for display purposes.
    $data['card_title'] = $card->getTitle();

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
      self::TYPE_DESCRIPTION_UPDATED => 'Description updated',
      self::TYPE_TITLE_UPDATED => 'Title updated',
      self::TYPE_CUSTOM_FIELD_UPDATED => 'Custom field updated',
      self::TYPE_DUE_DATE_UPDATED => 'Due date updated',
      self::TYPE_START_DATE_SET => 'Start date set',
      self::TYPE_START_DATE_REMOVED => 'Start date removed',
      self::TYPE_START_DATE_UPDATED => 'Start date updated',
      self::TYPE_DEPARTMENT_SET => 'Department set',
      self::TYPE_DEPARTMENT_CHANGED => 'Department changed',
      self::TYPE_DEPARTMENT_REMOVED => 'Department removed',
      self::TYPE_CLIENT_SET => 'Client set',
      self::TYPE_CLIENT_CHANGED => 'Client changed',
      self::TYPE_CLIENT_REMOVED => 'Client removed',
      self::TYPE_WATCHER_ADDED => 'Watcher added',
      self::TYPE_WATCHER_REMOVED => 'Watcher removed',
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
    $user_name = $this->getUserFullName();
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

      case self::TYPE_COMMENT_DELETED:
        return "$user_name deleted a comment on \"$card_title\"";

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

      case self::TYPE_DESCRIPTION_UPDATED:
        return "$user_name updated the description on \"$card_title\"";

      case self::TYPE_TITLE_UPDATED:
        return "$user_name renamed the card \"$card_title\"";

      case self::TYPE_CUSTOM_FIELD_UPDATED:
        $field_name = $data['field_name'] ?? 'a field';
        return "$user_name updated $field_name on \"$card_title\"";

      case self::TYPE_DUE_DATE_UPDATED:
        return "$user_name changed the due date on \"$card_title\"";

      case self::TYPE_START_DATE_SET:
        $date = $data['start_date'] ?? $data['new_value'] ?? '';
        return "$user_name set start date to $date on \"$card_title\"";

      case self::TYPE_START_DATE_REMOVED:
        return "$user_name removed the start date from \"$card_title\"";

      case self::TYPE_START_DATE_UPDATED:
        return "$user_name changed the start date on \"$card_title\"";

      case self::TYPE_DEPARTMENT_SET:
        $department = $data['department_name'] ?? 'a department';
        return "$user_name set department to \"$department\" on \"$card_title\"";

      case self::TYPE_DEPARTMENT_CHANGED:
        $old_dept = $data['old_department_name'] ?? '';
        $new_dept = $data['department_name'] ?? 'a department';
        if ($old_dept) {
          return "$user_name changed department from \"$old_dept\" to \"$new_dept\" on \"$card_title\"";
        }
        return "$user_name set department to \"$new_dept\" on \"$card_title\"";

      case self::TYPE_DEPARTMENT_REMOVED:
        $old_dept = $data['old_department_name'] ?? 'the department';
        return "$user_name removed department \"$old_dept\" from \"$card_title\"";

      case self::TYPE_CLIENT_SET:
        $client = $data['client_name'] ?? 'a client';
        return "$user_name set client to \"$client\" on \"$card_title\"";

      case self::TYPE_CLIENT_CHANGED:
        $old_client = $data['old_client_name'] ?? '';
        $new_client = $data['client_name'] ?? 'a client';
        if ($old_client) {
          return "$user_name changed client from \"$old_client\" to \"$new_client\" on \"$card_title\"";
        }
        return "$user_name set client to \"$new_client\" on \"$card_title\"";

      case self::TYPE_CLIENT_REMOVED:
        $old_client = $data['old_client_name'] ?? 'the client';
        return "$user_name removed client \"$old_client\" from \"$card_title\"";

      case self::TYPE_WATCHER_ADDED:
        $watcher = $data['watcher_name'] ?? 'a watcher';
        return "$user_name added $watcher as a watcher on \"$card_title\"";

      case self::TYPE_WATCHER_REMOVED:
        $watcher = $data['watcher_name'] ?? 'a watcher';
        return "$user_name removed $watcher from watchers on \"$card_title\"";

      default:
        return "$user_name updated \"$card_title\"";
    }
  }

  /**
   * Logs a field change activity with old and new values.
   *
   * @param \Drupal\node\NodeInterface $card
   *   The card node.
   * @param string $field_name
   *   The name of the field that changed.
   * @param mixed $old_value
   *   The old value.
   * @param mixed $new_value
   *   The new value.
   *
   * @return \Drupal\node\NodeInterface|null
   *   The created activity node.
   */
  public function logFieldChange(NodeInterface $card, string $field_name, mixed $old_value, mixed $new_value): ?NodeInterface {
    // Determine activity type based on field
    $type = match($field_name) {
      'description', 'field_card_description' => self::TYPE_DESCRIPTION_UPDATED,
      'title' => self::TYPE_TITLE_UPDATED,
      'due_date', 'field_card_due_date' => self::TYPE_DUE_DATE_UPDATED,
      'start_date', 'field_card_start_date' => self::TYPE_START_DATE_UPDATED,
      default => self::TYPE_CUSTOM_FIELD_UPDATED,
    };

    $data = [
      'field_name' => $field_name,
      'old_value' => is_string($old_value) ? $old_value : json_encode($old_value),
      'new_value' => is_string($new_value) ? $new_value : json_encode($new_value),
    ];

    return $this->logCardActivity($type, $card, NULL, $data);
  }

}
