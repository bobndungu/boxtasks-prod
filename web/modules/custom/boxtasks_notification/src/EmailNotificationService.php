<?php

declare(strict_types=1);

namespace Drupal\boxtasks_notification;

use Drupal\Core\Entity\EntityTypeManagerInterface;
use Drupal\Core\Mail\MailManagerInterface;
use Drupal\Core\Session\AccountProxyInterface;
use Drupal\Core\StringTranslation\StringTranslationTrait;
use Drupal\node\NodeInterface;
use Drupal\user\UserInterface;

/**
 * Service for sending email notifications.
 */
class EmailNotificationService {

  use StringTranslationTrait;

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
   * The mail manager.
   *
   * @var \Drupal\Core\Mail\MailManagerInterface
   */
  protected MailManagerInterface $mailManager;

  /**
   * The notification service.
   *
   * @var \Drupal\boxtasks_notification\NotificationService
   */
  protected NotificationService $notificationService;

  /**
   * The email template service.
   *
   * @var \Drupal\boxtasks_notification\EmailTemplateService
   */
  protected EmailTemplateService $templateService;

  /**
   * Constructs an EmailNotificationService object.
   *
   * @param \Drupal\Core\Entity\EntityTypeManagerInterface $entity_type_manager
   *   The entity type manager.
   * @param \Drupal\Core\Session\AccountProxyInterface $current_user
   *   The current user.
   * @param \Drupal\Core\Mail\MailManagerInterface $mail_manager
   *   The mail manager.
   * @param \Drupal\boxtasks_notification\NotificationService $notification_service
   *   The notification service.
   * @param \Drupal\boxtasks_notification\EmailTemplateService $template_service
   *   The email template service.
   */
  public function __construct(
    EntityTypeManagerInterface $entity_type_manager,
    AccountProxyInterface $current_user,
    MailManagerInterface $mail_manager,
    NotificationService $notification_service,
    EmailTemplateService $template_service,
  ) {
    $this->entityTypeManager = $entity_type_manager;
    $this->currentUser = $current_user;
    $this->mailManager = $mail_manager;
    $this->notificationService = $notification_service;
    $this->templateService = $template_service;
  }

  /**
   * Sends an email notification to a user.
   *
   * @param int $user_id
   *   The user ID to notify.
   * @param string $type
   *   The notification type.
   * @param string $subject
   *   The email subject.
   * @param string $message
   *   The email message body (HTML).
   * @param \Drupal\node\NodeInterface|null $card
   *   The related card entity (optional).
   * @param bool $skip_preference_check
   *   Skip the user preference check (for forced emails like welcome).
   *
   * @return bool
   *   TRUE if email was sent successfully, FALSE otherwise.
   */
  public function sendEmailNotification(int $user_id, string $type, string $subject, string $message, ?NodeInterface $card = NULL, bool $skip_preference_check = FALSE): bool {
    // Check if user wants email for this type (unless forced).
    if (!$skip_preference_check && !$this->notificationService->userWantsNotification($user_id, $type, 'email')) {
      return FALSE;
    }

    // Load user.
    $user = $this->entityTypeManager->getStorage('user')->load($user_id);
    if (!$user || !$user->getEmail()) {
      return FALSE;
    }

    // Don't send email to the actor (unless forced).
    if (!$skip_preference_check && $user_id === (int) $this->currentUser->id()) {
      return FALSE;
    }

    $params = [
      'subject' => $subject,
      'message' => $message,
      'card' => $card,
      'type' => $type,
      'user' => $user,
    ];

    $result = $this->mailManager->mail(
      'boxtasks_notification',
      $type,
      $user->getEmail(),
      $user->getPreferredLangcode(),
      $params,
      NULL,
      TRUE
    );

    return (bool) ($result['result'] ?? FALSE);
  }

  /**
   * Sends a welcome email to a newly registered user.
   *
   * @param int $user_id
   *   The new user ID.
   *
   * @return bool
   *   TRUE if email was sent, FALSE otherwise.
   */
  public function sendWelcomeEmail(int $user_id): bool {
    $user = $this->entityTypeManager->getStorage('user')->load($user_id);
    if (!$user instanceof UserInterface || !$user->getEmail()) {
      return FALSE;
    }

    $display_name = $this->getUserDisplayName($user);
    $subject = "Welcome to BoxTasks, {$display_name}!";
    $message = $this->templateService->welcomeEmail($user);

    return $this->sendEmailNotification($user_id, 'welcome', $subject, $message, NULL, TRUE);
  }

  /**
   * Sends card assignment notification email.
   *
   * @param int $user_id
   *   The assigned user ID.
   * @param \Drupal\node\NodeInterface $card
   *   The card entity.
   */
  public function sendAssignmentEmail(int $user_id, NodeInterface $card): void {
    $user = $this->entityTypeManager->getStorage('user')->load($user_id);
    if (!$user instanceof UserInterface) {
      return;
    }

    $actor = $this->entityTypeManager->getStorage('user')->load($this->currentUser->id());
    $actor_name = $actor ? $this->getUserDisplayName($actor) : 'Someone';

    $subject = "You've been assigned to: " . $card->getTitle();
    $message = $this->templateService->assignmentEmail(
      $user,
      $card,
      $actor_name,
      $this->getCardUrl($card)
    );

    $this->sendEmailNotification($user_id, NotificationService::TYPE_MEMBER_ASSIGNED, $subject, $message, $card);
  }

  /**
   * Sends mention notification email.
   *
   * @param int $user_id
   *   The mentioned user ID.
   * @param \Drupal\node\NodeInterface $card
   *   The card entity.
   * @param string $comment_preview
   *   Preview of the comment text.
   */
  public function sendMentionEmail(int $user_id, NodeInterface $card, string $comment_preview = ''): void {
    $user = $this->entityTypeManager->getStorage('user')->load($user_id);
    if (!$user instanceof UserInterface) {
      return;
    }

    $actor = $this->entityTypeManager->getStorage('user')->load($this->currentUser->id());
    $actor_name = $actor ? $this->getUserDisplayName($actor) : 'Someone';

    $subject = "{$actor_name} mentioned you on: " . $card->getTitle();
    $message = $this->templateService->mentionEmail(
      $user,
      $card,
      $actor_name,
      $comment_preview,
      $this->getCardUrl($card)
    );

    $this->sendEmailNotification($user_id, NotificationService::TYPE_MENTIONED, $subject, $message, $card);
  }

  /**
   * Sends due date reminder email.
   *
   * @param int $user_id
   *   The user ID.
   * @param \Drupal\node\NodeInterface $card
   *   The card entity.
   * @param string $timeframe
   *   When the card is due (e.g., "tomorrow", "in 1 hour").
   */
  public function sendDueDateEmail(int $user_id, NodeInterface $card, string $timeframe): void {
    $user = $this->entityTypeManager->getStorage('user')->load($user_id);
    if (!$user instanceof UserInterface) {
      return;
    }

    // Get the formatted due date.
    $due_date = 'soon';
    if ($card->hasField('field_card_due_date') && !$card->get('field_card_due_date')->isEmpty()) {
      $due_timestamp = strtotime($card->get('field_card_due_date')->value);
      $due_date = date('l, F j, Y \a\t g:i A', $due_timestamp);
    }

    $subject = "Card due {$timeframe}: " . $card->getTitle();
    $message = $this->templateService->dueDateEmail(
      $user,
      $card,
      $timeframe,
      $due_date,
      $this->getCardUrl($card)
    );

    $this->sendEmailNotification($user_id, NotificationService::TYPE_DUE_DATE_APPROACHING, $subject, $message, $card);
  }

  /**
   * Sends comment notification email.
   *
   * @param int $user_id
   *   The user ID.
   * @param \Drupal\node\NodeInterface $card
   *   The card entity.
   * @param string $comment_preview
   *   Preview of the comment text.
   */
  public function sendCommentEmail(int $user_id, NodeInterface $card, string $comment_preview = ''): void {
    $user = $this->entityTypeManager->getStorage('user')->load($user_id);
    if (!$user instanceof UserInterface) {
      return;
    }

    $actor = $this->entityTypeManager->getStorage('user')->load($this->currentUser->id());
    $actor_name = $actor ? $this->getUserDisplayName($actor) : 'Someone';

    $subject = "New comment on: " . $card->getTitle();
    $message = $this->templateService->commentEmail(
      $user,
      $card,
      $actor_name,
      $comment_preview,
      $this->getCardUrl($card)
    );

    $this->sendEmailNotification($user_id, NotificationService::TYPE_COMMENT_ADDED, $subject, $message, $card);
  }

  /**
   * Sends card completed notification email.
   *
   * @param int $user_id
   *   The user ID.
   * @param \Drupal\node\NodeInterface $card
   *   The card entity.
   */
  public function sendCardCompletedEmail(int $user_id, NodeInterface $card): void {
    $user = $this->entityTypeManager->getStorage('user')->load($user_id);
    if (!$user instanceof UserInterface) {
      return;
    }

    $actor = $this->entityTypeManager->getStorage('user')->load($this->currentUser->id());
    $actor_name = $actor ? $this->getUserDisplayName($actor) : 'Someone';

    $subject = "Card completed: " . $card->getTitle();
    $message = $this->templateService->cardCompletedEmail(
      $user,
      $card,
      $actor_name,
      $this->getCardUrl($card)
    );

    $this->sendEmailNotification($user_id, NotificationService::TYPE_CARD_COMPLETED, $subject, $message, $card);
  }

  /**
   * Sends member removed notification email.
   *
   * @param int $user_id
   *   The user ID.
   * @param \Drupal\node\NodeInterface $card
   *   The card entity.
   */
  public function sendMemberRemovedEmail(int $user_id, NodeInterface $card): void {
    $user = $this->entityTypeManager->getStorage('user')->load($user_id);
    if (!$user instanceof UserInterface) {
      return;
    }

    $actor = $this->entityTypeManager->getStorage('user')->load($this->currentUser->id());
    $actor_name = $actor ? $this->getUserDisplayName($actor) : 'Someone';

    $subject = "You were removed from: " . $card->getTitle();
    $message = $this->templateService->memberRemovedEmail(
      $user,
      $card,
      $actor_name,
      $this->getCardUrl($card)
    );

    $this->sendEmailNotification($user_id, NotificationService::TYPE_MEMBER_REMOVED, $subject, $message, $card);
  }

  /**
   * Sends card moved notification email.
   *
   * @param int $user_id
   *   The user ID.
   * @param \Drupal\node\NodeInterface $card
   *   The card entity.
   * @param string $from_list
   *   The source list name.
   * @param string $to_list
   *   The destination list name.
   */
  public function sendCardMovedEmail(int $user_id, NodeInterface $card, string $from_list, string $to_list): void {
    $user = $this->entityTypeManager->getStorage('user')->load($user_id);
    if (!$user instanceof UserInterface) {
      return;
    }

    $actor = $this->entityTypeManager->getStorage('user')->load($this->currentUser->id());
    $actor_name = $actor ? $this->getUserDisplayName($actor) : 'Someone';

    $subject = "Card moved: " . $card->getTitle();
    $message = $this->templateService->cardMovedEmail(
      $user,
      $card,
      $actor_name,
      $from_list,
      $to_list,
      $this->getCardUrl($card)
    );

    $this->sendEmailNotification($user_id, NotificationService::TYPE_CARD_MOVED, $subject, $message, $card);
  }

  /**
   * Sends a test email to a specific address.
   *
   * @param string $email
   *   The email address.
   * @param string $type
   *   The notification type to test.
   *
   * @return bool
   *   TRUE if email was sent, FALSE otherwise.
   */
  public function sendTestEmail(string $email, string $type = 'welcome'): bool {
    // Create a mock user for the template.
    $user = $this->entityTypeManager->getStorage('user')->load(1);
    if (!$user instanceof UserInterface) {
      return FALSE;
    }

    $subject = '';
    $message = '';

    switch ($type) {
      case 'welcome':
        $display_name = $this->getUserDisplayName($user);
        $subject = "Welcome to BoxTasks, {$display_name}!";
        $message = $this->templateService->welcomeEmail($user);
        break;

      case 'assignment':
        $subject = "[TEST] You've been assigned to: Sample Card";
        $message = $this->templateService->genericEmail(
          $user,
          $subject,
          'This is a test email for the assignment notification. In a real scenario, you would receive this email when someone assigns you to a card.',
          'https://tasks.boxraft.com/dashboard',
          'View Dashboard'
        );
        break;

      case 'mention':
        $subject = "[TEST] Someone mentioned you on: Sample Card";
        $message = $this->templateService->genericEmail(
          $user,
          $subject,
          'This is a test email for the mention notification. In a real scenario, you would receive this email when someone @mentions you in a comment.',
          'https://tasks.boxraft.com/dashboard',
          'View Dashboard'
        );
        break;

      case 'due_date':
        $subject = "[TEST] Card due tomorrow: Sample Card";
        $message = $this->templateService->genericEmail(
          $user,
          $subject,
          'This is a test email for the due date notification. In a real scenario, you would receive this email when a card you\'re assigned to is approaching its due date.',
          'https://tasks.boxraft.com/dashboard',
          'View Dashboard'
        );
        break;

      case 'comment':
        $subject = "[TEST] New comment on: Sample Card";
        $message = $this->templateService->genericEmail(
          $user,
          $subject,
          'This is a test email for the comment notification. In a real scenario, you would receive this email when someone comments on a card you follow.',
          'https://tasks.boxraft.com/dashboard',
          'View Dashboard'
        );
        break;

      default:
        $subject = "[TEST] BoxTasks Notification Test";
        $message = $this->templateService->genericEmail(
          $user,
          $subject,
          "This is a test email from BoxTasks. Your email notifications are working correctly!",
          'https://tasks.boxraft.com/dashboard',
          'Go to Dashboard'
        );
    }

    $params = [
      'subject' => $subject,
      'message' => $message,
      'type' => $type,
      'user' => $user,
    ];

    $result = $this->mailManager->mail(
      'boxtasks_notification',
      'test_' . $type,
      $email,
      'en',
      $params,
      NULL,
      TRUE
    );

    return (bool) ($result['result'] ?? FALSE);
  }

  /**
   * Gets the URL for a card.
   *
   * @param \Drupal\node\NodeInterface $card
   *   The card entity.
   *
   * @return string
   *   The card URL.
   */
  protected function getCardUrl(NodeInterface $card): string {
    // Get the board ID from the card's list.
    $list_id = $card->get('field_card_list')->target_id;
    if ($list_id) {
      $list = $this->entityTypeManager->getStorage('node')->load($list_id);
      if ($list && $list->hasField('field_list_board')) {
        $board_id = $list->get('field_list_board')->target_id;
        if ($board_id) {
          // Return frontend URL with card ID.
          $frontend_url = $this->getFrontendUrl();
          return $frontend_url . '/board/' . $board_id . '?card=' . $card->id();
        }
      }
    }

    return $this->getFrontendUrl() . '/dashboard';
  }

  /**
   * Gets the frontend URL.
   *
   * @return string
   *   The frontend URL.
   */
  protected function getFrontendUrl(): string {
    $frontend_url = \Drupal::config('boxtasks_notification.settings')->get('frontend_url');
    if ($frontend_url) {
      return rtrim($frontend_url, '/');
    }
    return rtrim(\Drupal::request()->getSchemeAndHttpHost(), '/');
  }

  /**
   * Gets the user's display name.
   *
   * @param \Drupal\user\UserInterface $user
   *   The user entity.
   *
   * @return string
   *   The display name.
   */
  protected function getUserDisplayName(UserInterface $user): string {
    if ($user->hasField('field_display_name') && !$user->get('field_display_name')->isEmpty()) {
      return $user->get('field_display_name')->value;
    }
    return $user->getDisplayName();
  }

}
