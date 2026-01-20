<?php

declare(strict_types=1);

namespace Drupal\boxtasks_notification;

use Drupal\boxtasks_realtime\Service\MercurePublisher;
use Drupal\Core\Entity\EntityTypeManagerInterface;
use Drupal\Core\Session\AccountProxyInterface;
use Drupal\node\NodeInterface;
use Drupal\user\UserInterface;

/**
 * Service for creating and managing user notifications.
 */
class NotificationService {

  /**
   * Notification type constants.
   */
  public const TYPE_MEMBER_ASSIGNED = 'member_assigned';
  public const TYPE_MEMBER_REMOVED = 'member_removed';
  public const TYPE_CARD_DUE = 'card_due';
  public const TYPE_COMMENT_ADDED = 'comment_added';
  public const TYPE_MENTIONED = 'mentioned';
  public const TYPE_CARD_MOVED = 'card_moved';
  public const TYPE_CARD_COMPLETED = 'card_completed';
  public const TYPE_CHECKLIST_ITEM_COMPLETED = 'checklist_completed';
  public const TYPE_DUE_DATE_APPROACHING = 'due_date_approaching';
  public const TYPE_LABEL_ADDED = 'label_added';
  public const TYPE_GOAL_PROGRESS = 'goal_progress';
  public const TYPE_GOAL_COMPLETED = 'goal_completed';
  public const TYPE_GOAL_AT_RISK = 'goal_at_risk';
  public const TYPE_MILESTONE_DUE = 'milestone_due';
  public const TYPE_MILESTONE_COMPLETED = 'milestone_completed';
  public const TYPE_MILESTONE_MISSED = 'milestone_missed';
  public const TYPE_CARD_ARCHIVED = 'card_archived';
  public const TYPE_CARD_RESTORED = 'card_restored';

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
   * The Mercure publisher service.
   *
   * @var \Drupal\boxtasks_realtime\Service\MercurePublisher|null
   */
  protected ?MercurePublisher $mercurePublisher;

  /**
   * Constructs a NotificationService object.
   *
   * @param \Drupal\Core\Entity\EntityTypeManagerInterface $entity_type_manager
   *   The entity type manager.
   * @param \Drupal\Core\Session\AccountProxyInterface $current_user
   *   The current user.
   * @param \Drupal\boxtasks_realtime\Service\MercurePublisher|null $mercure_publisher
   *   The Mercure publisher service.
   */
  public function __construct(
    EntityTypeManagerInterface $entity_type_manager,
    AccountProxyInterface $current_user,
    ?MercurePublisher $mercure_publisher = NULL,
  ) {
    $this->entityTypeManager = $entity_type_manager;
    $this->currentUser = $current_user;
    $this->mercurePublisher = $mercure_publisher;
  }

  /**
   * Creates a notification for a user.
   *
   * @param int $user_id
   *   The user ID to notify.
   * @param string $type
   *   The notification type.
   * @param string $message
   *   The notification message.
   * @param int|null $card_id
   *   The related card ID (optional).
   * @param int|null $actor_id
   *   The actor user ID who triggered the notification (optional).
   *
   * @return \Drupal\node\NodeInterface|null
   *   The created notification entity, or NULL on failure.
   */
  public function notify(int $user_id, string $type, string $message, ?int $card_id = NULL, ?int $actor_id = NULL): ?NodeInterface {
    // Don't notify the user about their own actions.
    if ($actor_id && $user_id === $actor_id) {
      return NULL;
    }

    // Don't notify anonymous users.
    if ($user_id === 0) {
      return NULL;
    }

    // Check user's notification preferences.
    if (!$this->userWantsNotification($user_id, $type, 'inApp')) {
      return NULL;
    }

    try {
      $storage = $this->entityTypeManager->getStorage('node');

      $values = [
        'type' => 'notification',
        'title' => "Notification: {$type}",
        'uid' => $user_id,
        'status' => 1,
        'field_notification_type' => $type,
        'field_notification_message' => $message,
        'field_notification_read' => FALSE,
        'field_notification_user' => $user_id,
      ];

      if ($card_id) {
        $values['field_notification_card'] = $card_id;
      }

      if ($actor_id) {
        $values['field_notification_actor'] = $actor_id;
      }

      $notification = $storage->create($values);
      $notification->save();

      // Publish real-time notification via Mercure.
      if ($this->mercurePublisher) {
        $this->mercurePublisher->publishNotification($user_id, $notification);
      }

      return $notification;
    }
    catch (\Exception $e) {
      \Drupal::logger('boxtasks_notification')->error('Failed to create notification: @message', [
        '@message' => $e->getMessage(),
      ]);
      return NULL;
    }
  }

  /**
   * Notifies card members about an event.
   *
   * @param \Drupal\node\NodeInterface $card
   *   The card entity.
   * @param string $type
   *   The notification type.
   * @param string|null $message
   *   Optional custom message.
   * @param array $exclude_users
   *   User IDs to exclude from notification.
   */
  public function notifyCardMembers(NodeInterface $card, string $type, ?string $message = NULL, array $exclude_users = []): void {
    if ($card->bundle() !== 'card') {
      return;
    }

    // Get card members.
    $member_ids = [];
    if ($card->hasField('field_card_members')) {
      foreach ($card->get('field_card_members') as $item) {
        $member_ids[] = (int) $item->target_id;
      }
    }

    // Also include watchers if the field exists.
    if ($card->hasField('field_card_watchers')) {
      foreach ($card->get('field_card_watchers') as $item) {
        $member_ids[] = (int) $item->target_id;
      }
    }

    $member_ids = array_unique($member_ids);
    $actor_id = (int) $this->currentUser->id();

    // Exclude specified users and the actor.
    $exclude = array_merge($exclude_users, [$actor_id]);
    $member_ids = array_diff($member_ids, $exclude);

    if (empty($member_ids)) {
      return;
    }

    // Generate message if not provided.
    if (!$message) {
      $message = $this->generateCardMessage($card, $type);
    }

    $card_id = (int) $card->id();

    foreach ($member_ids as $member_id) {
      $this->notify($member_id, $type, $message, $card_id, $actor_id);
    }
  }

  /**
   * Notifies a specific user about a card event.
   *
   * @param int $user_id
   *   The user ID to notify.
   * @param \Drupal\node\NodeInterface $card
   *   The card entity.
   * @param string $type
   *   The notification type.
   * @param string|null $message
   *   Optional custom message.
   */
  public function notifyUser(int $user_id, NodeInterface $card, string $type, ?string $message = NULL): void {
    $actor_id = (int) $this->currentUser->id();

    // Don't notify the actor about their own action.
    if ($user_id === $actor_id) {
      return;
    }

    if (!$message) {
      $message = $this->generateCardMessage($card, $type);
    }

    $this->notify($user_id, $type, $message, (int) $card->id(), $actor_id);
  }

  /**
   * Notifies mentioned users in a comment.
   *
   * @param \Drupal\node\NodeInterface $comment
   *   The comment entity.
   * @param \Drupal\node\NodeInterface $card
   *   The card entity.
   * @param array $mentioned_user_ids
   *   Array of user IDs that were mentioned.
   */
  public function notifyMentions(NodeInterface $comment, NodeInterface $card, array $mentioned_user_ids): void {
    $actor_id = (int) $this->currentUser->id();
    $actor = $this->entityTypeManager->getStorage('user')->load($actor_id);
    $actor_name = $actor ? $actor->getDisplayName() : 'Someone';

    foreach ($mentioned_user_ids as $user_id) {
      $message = "{$actor_name} mentioned you in a comment on \"{$card->getTitle()}\"";
      $this->notify((int) $user_id, self::TYPE_MENTIONED, $message, (int) $card->id(), $actor_id);
    }
  }

  /**
   * Notifies about upcoming due dates (for cron processing).
   *
   * @param \Drupal\node\NodeInterface $card
   *   The card entity.
   * @param string $timeframe
   *   Description of the timeframe (e.g., "tomorrow", "in 1 hour").
   */
  public function notifyDueDateApproaching(NodeInterface $card, string $timeframe): void {
    $member_ids = [];

    if ($card->hasField('field_card_members')) {
      foreach ($card->get('field_card_members') as $item) {
        $member_ids[] = (int) $item->target_id;
      }
    }

    if (empty($member_ids)) {
      return;
    }

    // Handle overdue case differently to avoid "is due overdue"
    if ($timeframe === 'overdue') {
      $message = "Card \"{$card->getTitle()}\" is overdue";
    }
    else {
      $message = "Card \"{$card->getTitle()}\" is due {$timeframe}";
    }
    $card_id = (int) $card->id();

    foreach ($member_ids as $member_id) {
      $this->notify($member_id, self::TYPE_DUE_DATE_APPROACHING, $message, $card_id, NULL);
    }
  }

  /**
   * Generates a notification message for a card event.
   *
   * @param \Drupal\node\NodeInterface $card
   *   The card entity.
   * @param string $type
   *   The notification type.
   *
   * @return string
   *   The generated message.
   */
  protected function generateCardMessage(NodeInterface $card, string $type): string {
    $actor_id = (int) $this->currentUser->id();
    $actor = $this->entityTypeManager->getStorage('user')->load($actor_id);
    $actor_name = $actor ? $actor->getDisplayName() : 'Someone';
    $card_title = $card->getTitle();

    switch ($type) {
      case self::TYPE_MEMBER_ASSIGNED:
        return "{$actor_name} assigned you to \"{$card_title}\"";

      case self::TYPE_MEMBER_REMOVED:
        return "{$actor_name} removed you from \"{$card_title}\"";

      case self::TYPE_CARD_DUE:
        return "Card \"{$card_title}\" is now due";

      case self::TYPE_COMMENT_ADDED:
        return "{$actor_name} commented on \"{$card_title}\"";

      case self::TYPE_CARD_MOVED:
        return "{$actor_name} moved card \"{$card_title}\"";

      case self::TYPE_CARD_COMPLETED:
        return "{$actor_name} completed card \"{$card_title}\"";

      case self::TYPE_CHECKLIST_ITEM_COMPLETED:
        return "{$actor_name} completed a checklist item on \"{$card_title}\"";

      case self::TYPE_LABEL_ADDED:
        return "{$actor_name} added a label to \"{$card_title}\"";

      case self::TYPE_CARD_ARCHIVED:
        return "{$actor_name} archived card \"{$card_title}\"";

      case self::TYPE_CARD_RESTORED:
        return "{$actor_name} restored card \"{$card_title}\" from archive";

      default:
        return "{$actor_name} updated card \"{$card_title}\"";
    }
  }

  /**
   * Marks a notification as read.
   *
   * @param int $notification_id
   *   The notification node ID.
   *
   * @return bool
   *   TRUE if successful, FALSE otherwise.
   */
  public function markAsRead(int $notification_id): bool {
    try {
      $storage = $this->entityTypeManager->getStorage('node');
      $notification = $storage->load($notification_id);

      if (!$notification || $notification->bundle() !== 'notification') {
        return FALSE;
      }

      $notification->set('field_notification_read', TRUE);
      $notification->save();

      return TRUE;
    }
    catch (\Exception $e) {
      return FALSE;
    }
  }

  /**
   * Gets unread notification count for a user.
   *
   * @param int $user_id
   *   The user ID.
   *
   * @return int
   *   The count of unread notifications.
   */
  public function getUnreadCount(int $user_id): int {
    $query = $this->entityTypeManager->getStorage('node')->getQuery()
      ->condition('type', 'notification')
      ->condition('field_notification_user', $user_id)
      ->condition('field_notification_read', FALSE)
      ->accessCheck(FALSE);

    return (int) $query->count()->execute();
  }

  /**
   * Checks if user wants to receive a specific notification type.
   *
   * @param int $user_id
   *   The user ID.
   * @param string $type
   *   The notification type.
   * @param string $channel
   *   The channel ('inApp' or 'email').
   *
   * @return bool
   *   TRUE if user wants this notification, FALSE otherwise.
   */
  public function userWantsNotification(int $user_id, string $type, string $channel = 'inApp'): bool {
    try {
      $user = $this->entityTypeManager->getStorage('user')->load($user_id);
      if (!$user || !$user->hasField('field_notif_prefs')) {
        // Default to true if no preferences set.
        return TRUE;
      }

      $prefs_json = $user->get('field_notif_prefs')->value;
      if (!$prefs_json) {
        return TRUE;
      }

      $prefs = json_decode($prefs_json, TRUE);
      if (!$prefs || !isset($prefs[$channel])) {
        return TRUE;
      }

      // Map notification types to preference keys.
      $key_map = [
        self::TYPE_MEMBER_ASSIGNED => 'member_assigned',
        self::TYPE_MEMBER_REMOVED => 'member_removed',
        self::TYPE_CARD_DUE => 'card_due',
        self::TYPE_COMMENT_ADDED => 'comment_added',
        self::TYPE_MENTIONED => 'mentioned',
        self::TYPE_CARD_MOVED => 'card_moved',
        self::TYPE_CARD_COMPLETED => 'card_completed',
        self::TYPE_CHECKLIST_ITEM_COMPLETED => 'checklist_completed',
        self::TYPE_DUE_DATE_APPROACHING => 'due_date_approaching',
        self::TYPE_LABEL_ADDED => 'label_added',
        self::TYPE_GOAL_PROGRESS => 'goal_progress',
        self::TYPE_GOAL_COMPLETED => 'goal_completed',
        self::TYPE_GOAL_AT_RISK => 'goal_at_risk',
        self::TYPE_MILESTONE_DUE => 'milestone_due',
        self::TYPE_MILESTONE_COMPLETED => 'milestone_completed',
        self::TYPE_MILESTONE_MISSED => 'milestone_missed',
        self::TYPE_CARD_ARCHIVED => 'card_archived',
        self::TYPE_CARD_RESTORED => 'card_restored',
      ];

      $pref_key = $key_map[$type] ?? $type;

      // Return the preference value, defaulting to true.
      return $prefs[$channel][$pref_key] ?? TRUE;
    }
    catch (\Exception $e) {
      // On error, default to sending the notification.
      return TRUE;
    }
  }

  /**
   * Notifies workspace members about a goal event.
   *
   * @param \Drupal\node\NodeInterface $goal
   *   The goal entity.
   * @param string $type
   *   The notification type.
   * @param string|null $message
   *   Optional custom message.
   */
  public function notifyGoalUpdate(NodeInterface $goal, string $type, ?string $message = NULL): void {
    if ($goal->bundle() !== 'goal') {
      return;
    }

    // Get workspace members.
    $workspace_id = $goal->get('field_goal_workspace')->target_id;
    if (!$workspace_id) {
      return;
    }

    $workspace = $this->entityTypeManager->getStorage('node')->load($workspace_id);
    if (!$workspace) {
      return;
    }

    $member_ids = [];
    if ($workspace->hasField('field_workspace_members')) {
      foreach ($workspace->get('field_workspace_members') as $item) {
        $member_ids[] = (int) $item->target_id;
      }
    }

    $actor_id = (int) $this->currentUser->id();
    $member_ids = array_diff(array_unique($member_ids), [$actor_id]);

    if (empty($member_ids)) {
      return;
    }

    if (!$message) {
      $actor = $this->entityTypeManager->getStorage('user')->load($actor_id);
      $actor_name = $actor ? $actor->getDisplayName() : 'Someone';
      $goal_title = $goal->getTitle();

      switch ($type) {
        case self::TYPE_GOAL_PROGRESS:
          $progress = $goal->get('field_goal_progress')->value ?? 0;
          $message = "Goal \"{$goal_title}\" is now {$progress}% complete";
          break;

        case self::TYPE_GOAL_COMPLETED:
          $message = "{$actor_name} marked goal \"{$goal_title}\" as completed";
          break;

        case self::TYPE_GOAL_AT_RISK:
          $message = "Goal \"{$goal_title}\" has been marked as at risk";
          break;

        default:
          $message = "{$actor_name} updated goal \"{$goal_title}\"";
      }
    }

    foreach ($member_ids as $member_id) {
      $this->notify($member_id, $type, $message, NULL, $actor_id);
    }
  }

  /**
   * Notifies workspace members about a milestone event.
   *
   * @param \Drupal\node\NodeInterface $milestone
   *   The milestone entity.
   * @param string $type
   *   The notification type.
   * @param string|null $message
   *   Optional custom message.
   */
  public function notifyMilestoneUpdate(NodeInterface $milestone, string $type, ?string $message = NULL): void {
    if ($milestone->bundle() !== 'milestone') {
      return;
    }

    // Get workspace members.
    $workspace_id = $milestone->get('field_milestone_workspace')->target_id;
    if (!$workspace_id) {
      return;
    }

    $workspace = $this->entityTypeManager->getStorage('node')->load($workspace_id);
    if (!$workspace) {
      return;
    }

    $member_ids = [];
    if ($workspace->hasField('field_workspace_members')) {
      foreach ($workspace->get('field_workspace_members') as $item) {
        $member_ids[] = (int) $item->target_id;
      }
    }

    $actor_id = (int) $this->currentUser->id();
    $member_ids = array_diff(array_unique($member_ids), [$actor_id]);

    if (empty($member_ids)) {
      return;
    }

    if (!$message) {
      $actor = $this->entityTypeManager->getStorage('user')->load($actor_id);
      $actor_name = $actor ? $actor->getDisplayName() : 'Someone';
      $milestone_title = $milestone->getTitle();

      switch ($type) {
        case self::TYPE_MILESTONE_DUE:
          $due_date = $milestone->get('field_milestone_due_date')->value ?? 'soon';
          $message = "Milestone \"{$milestone_title}\" is due {$due_date}";
          break;

        case self::TYPE_MILESTONE_COMPLETED:
          $message = "{$actor_name} completed milestone \"{$milestone_title}\"";
          break;

        case self::TYPE_MILESTONE_MISSED:
          $message = "Milestone \"{$milestone_title}\" was missed";
          break;

        default:
          $message = "{$actor_name} updated milestone \"{$milestone_title}\"";
      }
    }

    foreach ($member_ids as $member_id) {
      $this->notify($member_id, $type, $message, NULL, $actor_id);
    }
  }

  /**
   * Deletes old read notifications (for cleanup).
   *
   * @param int $days
   *   Delete notifications older than this many days.
   *
   * @return int
   *   The number of deleted notifications.
   */
  public function cleanupOldNotifications(int $days = 30): int {
    $cutoff = strtotime("-{$days} days");

    $query = $this->entityTypeManager->getStorage('node')->getQuery()
      ->condition('type', 'notification')
      ->condition('field_notification_read', TRUE)
      ->condition('created', $cutoff, '<')
      ->accessCheck(FALSE);

    $ids = $query->execute();

    if (empty($ids)) {
      return 0;
    }

    $storage = $this->entityTypeManager->getStorage('node');
    $notifications = $storage->loadMultiple($ids);
    $storage->delete($notifications);

    return count($ids);
  }

}
