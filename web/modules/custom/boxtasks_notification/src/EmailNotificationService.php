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
   */
  public function __construct(
    EntityTypeManagerInterface $entity_type_manager,
    AccountProxyInterface $current_user,
    MailManagerInterface $mail_manager,
    NotificationService $notification_service,
  ) {
    $this->entityTypeManager = $entity_type_manager;
    $this->currentUser = $current_user;
    $this->mailManager = $mail_manager;
    $this->notificationService = $notification_service;
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
   *   The email message body.
   * @param \Drupal\node\NodeInterface|null $card
   *   The related card entity (optional).
   *
   * @return bool
   *   TRUE if email was sent successfully, FALSE otherwise.
   */
  public function sendEmailNotification(int $user_id, string $type, string $subject, string $message, ?NodeInterface $card = NULL): bool {
    // Check if user wants email for this type.
    if (!$this->notificationService->userWantsNotification($user_id, $type, 'email')) {
      return FALSE;
    }

    // Load user.
    $user = $this->entityTypeManager->getStorage('user')->load($user_id);
    if (!$user || !$user->getEmail()) {
      return FALSE;
    }

    // Don't send email to the actor.
    if ($user_id === (int) $this->currentUser->id()) {
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
   * Sends card assignment notification email.
   *
   * @param int $user_id
   *   The assigned user ID.
   * @param \Drupal\node\NodeInterface $card
   *   The card entity.
   */
  public function sendAssignmentEmail(int $user_id, NodeInterface $card): void {
    $actor = $this->entityTypeManager->getStorage('user')->load($this->currentUser->id());
    $actor_name = $actor ? $actor->getDisplayName() : 'Someone';

    $subject = "You've been assigned to: " . $card->getTitle();
    $message = $this->buildEmailBody([
      'intro' => "{$actor_name} assigned you to a card.",
      'card_title' => $card->getTitle(),
      'card_url' => $this->getCardUrl($card),
      'action_text' => 'View Card',
    ]);

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
    $actor = $this->entityTypeManager->getStorage('user')->load($this->currentUser->id());
    $actor_name = $actor ? $actor->getDisplayName() : 'Someone';

    $subject = "{$actor_name} mentioned you on: " . $card->getTitle();
    $message = $this->buildEmailBody([
      'intro' => "{$actor_name} mentioned you in a comment.",
      'card_title' => $card->getTitle(),
      'card_url' => $this->getCardUrl($card),
      'quote' => $comment_preview ? $this->truncate($comment_preview, 200) : '',
      'action_text' => 'View Comment',
    ]);

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
    $subject = "Card due {$timeframe}: " . $card->getTitle();
    $message = $this->buildEmailBody([
      'intro' => "A card you're assigned to is due {$timeframe}.",
      'card_title' => $card->getTitle(),
      'card_url' => $this->getCardUrl($card),
      'action_text' => 'View Card',
    ]);

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
    $actor = $this->entityTypeManager->getStorage('user')->load($this->currentUser->id());
    $actor_name = $actor ? $actor->getDisplayName() : 'Someone';

    $subject = "New comment on: " . $card->getTitle();
    $message = $this->buildEmailBody([
      'intro' => "{$actor_name} commented on a card you follow.",
      'card_title' => $card->getTitle(),
      'card_url' => $this->getCardUrl($card),
      'quote' => $comment_preview ? $this->truncate($comment_preview, 200) : '',
      'action_text' => 'View Comment',
    ]);

    $this->sendEmailNotification($user_id, NotificationService::TYPE_COMMENT_ADDED, $subject, $message, $card);
  }

  /**
   * Builds a simple HTML email body.
   *
   * @param array $params
   *   Email parameters (intro, card_title, card_url, quote, action_text).
   *
   * @return string
   *   The HTML email body.
   */
  protected function buildEmailBody(array $params): string {
    $html = '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">';

    // Header
    $html .= '<div style="background: #3B82F6; padding: 20px; text-align: center;">';
    $html .= '<h1 style="color: white; margin: 0; font-size: 24px;">BoxTasks</h1>';
    $html .= '</div>';

    // Body
    $html .= '<div style="padding: 30px; background: #ffffff;">';

    // Intro text
    if (!empty($params['intro'])) {
      $html .= '<p style="font-size: 16px; color: #333; margin-bottom: 20px;">' . htmlspecialchars($params['intro']) . '</p>';
    }

    // Card info box
    if (!empty($params['card_title'])) {
      $html .= '<div style="background: #F3F4F6; border-left: 4px solid #3B82F6; padding: 15px; margin-bottom: 20px;">';
      $html .= '<p style="font-weight: bold; color: #1F2937; margin: 0;">' . htmlspecialchars($params['card_title']) . '</p>';
      $html .= '</div>';
    }

    // Quote (for comments)
    if (!empty($params['quote'])) {
      $html .= '<div style="background: #FAFAFA; border-left: 3px solid #D1D5DB; padding: 10px 15px; margin-bottom: 20px; font-style: italic; color: #6B7280;">';
      $html .= '"' . htmlspecialchars($params['quote']) . '"';
      $html .= '</div>';
    }

    // Action button
    if (!empty($params['card_url']) && !empty($params['action_text'])) {
      $html .= '<div style="text-align: center; margin-top: 30px;">';
      $html .= '<a href="' . htmlspecialchars($params['card_url']) . '" style="display: inline-block; background: #3B82F6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">';
      $html .= htmlspecialchars($params['action_text']);
      $html .= '</a>';
      $html .= '</div>';
    }

    $html .= '</div>';

    // Footer
    $html .= '<div style="padding: 20px; background: #F9FAFB; text-align: center; border-top: 1px solid #E5E7EB;">';
    $html .= '<p style="font-size: 12px; color: #9CA3AF; margin: 0;">You received this email because you are assigned to or following this card.</p>';
    $html .= '<p style="font-size: 12px; color: #9CA3AF; margin: 5px 0 0 0;">Manage your notification preferences in your BoxTasks profile.</p>';
    $html .= '</div>';

    $html .= '</div>';

    return $html;
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
          $base_url = \Drupal::request()->getSchemeAndHttpHost();
          // Assuming frontend is at the same domain or configured URL.
          $frontend_url = \Drupal::config('boxtasks_notification.settings')->get('frontend_url') ?? $base_url;
          return $frontend_url . '/board/' . $board_id . '?card=' . $card->id();
        }
      }
    }

    return \Drupal::request()->getSchemeAndHttpHost() . '/node/' . $card->id();
  }

  /**
   * Truncates a string to a maximum length.
   *
   * @param string $text
   *   The text to truncate.
   * @param int $max_length
   *   Maximum length.
   *
   * @return string
   *   Truncated text.
   */
  protected function truncate(string $text, int $max_length): string {
    $text = strip_tags($text);
    if (strlen($text) <= $max_length) {
      return $text;
    }
    return substr($text, 0, $max_length - 3) . '...';
  }

}
