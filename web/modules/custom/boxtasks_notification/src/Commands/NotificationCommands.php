<?php

declare(strict_types=1);

namespace Drupal\boxtasks_notification\Commands;

use Drupal\boxtasks_notification\EmailNotificationService;
use Drush\Attributes as CLI;
use Drush\Commands\DrushCommands;
use Symfony\Component\DependencyInjection\ContainerInterface;

/**
 * Drush commands for BoxTasks notifications.
 */
class NotificationCommands extends DrushCommands {

  /**
   * The email notification service.
   *
   * @var \Drupal\boxtasks_notification\EmailNotificationService
   */
  protected EmailNotificationService $emailService;

  /**
   * Constructs a NotificationCommands object.
   *
   * @param \Drupal\boxtasks_notification\EmailNotificationService $email_service
   *   The email notification service.
   */
  public function __construct(EmailNotificationService $email_service) {
    parent::__construct();
    $this->emailService = $email_service;
  }

  /**
   * {@inheritdoc}
   */
  public static function create(ContainerInterface $container): static {
    return new static(
      $container->get('boxtasks_notification.email')
    );
  }

  /**
   * Send a test email notification.
   *
   * @param string $email
   *   The email address to send to.
   * @param array $options
   *   Command options.
   */
  #[CLI\Command(name: 'boxtasks:test-email', aliases: ['bt:test'])]
  #[CLI\Argument(name: 'email', description: 'The email address to send to.')]
  #[CLI\Option(name: 'type', description: 'Notification type to test (welcome, assignment, mention, due_date, comment, all).')]
  #[CLI\Usage(name: 'drush boxtasks:test-email user@example.com', description: 'Send a welcome test email.')]
  #[CLI\Usage(name: 'drush boxtasks:test-email user@example.com --type=mention', description: 'Send a mention test email.')]
  #[CLI\Usage(name: 'drush boxtasks:test-email user@example.com --type=all', description: 'Send all notification types as test emails.')]
  public function testEmail(string $email, array $options = ['type' => 'welcome']): void {
    $type = $options['type'] ?? 'welcome';

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
      $this->logger()->error("Invalid email address: {$email}");
      return;
    }

    $types_to_send = [];
    if ($type === 'all') {
      $types_to_send = ['welcome', 'assignment', 'mention', 'due_date', 'comment'];
    }
    else {
      $types_to_send = [$type];
    }

    $this->logger()->notice("Sending test notification(s) to {$email}...");

    foreach ($types_to_send as $notification_type) {
      $this->logger()->notice("  Sending '{$notification_type}' notification...");

      $result = $this->emailService->sendTestEmail($email, $notification_type);

      if ($result) {
        $this->logger()->success("  [OK] '{$notification_type}' email sent successfully!");
      }
      else {
        $this->logger()->error("  [FAILED] Failed to send '{$notification_type}' email.");
      }
    }

    $this->logger()->success("Done! Check inbox at {$email}");
  }

  /**
   * Send a welcome email to a specific user.
   *
   * @param int $user_id
   *   The user ID to send welcome email to.
   */
  #[CLI\Command(name: 'boxtasks:send-welcome', aliases: ['bt:welcome'])]
  #[CLI\Argument(name: 'user_id', description: 'The user ID to send welcome email to.')]
  #[CLI\Usage(name: 'drush boxtasks:send-welcome 5', description: 'Send a welcome email to user ID 5.')]
  public function sendWelcome(int $user_id): void {
    $this->logger()->notice("Sending welcome email to user {$user_id}...");

    $result = $this->emailService->sendWelcomeEmail($user_id);

    if ($result) {
      $this->logger()->success("Welcome email sent successfully!");
    }
    else {
      $this->logger()->error("Failed to send welcome email. Check that the user exists and has an email address.");
    }
  }

  /**
   * List available notification types.
   */
  #[CLI\Command(name: 'boxtasks:notification-types', aliases: ['bt:types'])]
  #[CLI\Usage(name: 'drush boxtasks:notification-types', description: 'List all available notification types.')]
  public function listNotificationTypes(): void {
    $types = [
      'welcome' => 'Welcome email for new users',
      'assignment' => 'Card assignment notification',
      'mention' => '@mention notification',
      'due_date' => 'Due date reminder',
      'comment' => 'New comment notification',
      'card_completed' => 'Card completed notification',
      'member_removed' => 'Removed from card notification',
      'card_moved' => 'Card moved notification',
    ];

    $this->output()->writeln("");
    $this->output()->writeln("<info>Available notification types:</info>");
    $this->output()->writeln("");

    foreach ($types as $type => $description) {
      $this->output()->writeln("  <comment>{$type}</comment> - {$description}");
    }

    $this->output()->writeln("");
    $this->output()->writeln("Use <comment>drush boxtasks:test-email email@example.com --type=TYPE</comment> to test");
    $this->output()->writeln("");
  }

}
