<?php

declare(strict_types=1);

namespace Drupal\boxtasks_notification\Controller;

use Drupal\Core\Controller\ControllerBase;
use Drupal\Core\Config\ConfigFactoryInterface;
use Symfony\Component\DependencyInjection\ContainerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;

/**
 * Controller for email template management API.
 */
class EmailTemplateController extends ControllerBase {

  /**
   * The config factory.
   *
   * @var \Drupal\Core\Config\ConfigFactoryInterface
   */
  protected $configFactory;

  /**
   * Default templates with placeholders.
   */
  protected const DEFAULT_TEMPLATES = [
    'welcome' => [
      'subject' => 'Welcome to BoxTasks, {{user_name}}!',
      'body' => "Hi {{user_name}},\n\nWelcome to BoxTasks! We're excited to have you on board.\n\nBoxTasks is a powerful task management platform designed to help you and your team stay organized, collaborate effectively, and get things done.\n\nHere's what you can do with BoxTasks:\n- Create Boards - Organize your projects visually\n- Manage Tasks - Track progress with cards and checklists\n- Collaborate - Work with your team in real-time\n- Stay Notified - Get updates on tasks that matter to you\n\nReady to get started? Click the button below to go to your dashboard and create your first board!\n\nHappy tasking!\nThe BoxTasks Team",
    ],
    'member_assigned' => [
      'subject' => '{{actor_name}} assigned you to: {{card_title}}',
      'body' => "Hi {{user_name}},\n\n{{actor_name}} has assigned you to a card:\n\n{{card_title}}\n{{card_description}}\n\nYou can view and update this card by clicking the button below.",
    ],
    'mentioned' => [
      'subject' => '{{actor_name}} mentioned you in: {{card_title}}',
      'body' => "Hi {{user_name}},\n\n{{actor_name}} mentioned you in a comment on:\n\n{{card_title}}\n\n\"{{comment_text}}\"\n\n- {{actor_name}}",
    ],
    'comment_added' => [
      'subject' => 'New comment on: {{card_title}}',
      'body' => "Hi {{user_name}},\n\n{{actor_name}} commented on a card you follow:\n\n{{card_title}}\n\n\"{{comment_text}}\"\n\n- {{actor_name}}",
    ],
    'card_due' => [
      'subject' => 'Reminder: {{card_title}} is due {{timeframe}}',
      'body' => "Hi {{user_name}},\n\nA card you're assigned to is due {{timeframe}}:\n\n{{card_title}}\n\nDue Date: {{due_date}}\n\nMake sure to complete it on time!",
    ],
    'due_date_approaching' => [
      'subject' => 'Due date approaching: {{card_title}}',
      'body' => "Hi {{user_name}},\n\nThis is a reminder that the following card is due soon:\n\n{{card_title}}\n\nDue Date: {{due_date}}\n\nDon't forget to complete it!",
    ],
    'card_completed' => [
      'subject' => '{{actor_name}} completed: {{card_title}}',
      'body' => "Hi {{user_name}},\n\n{{actor_name}} completed a card:\n\n{{card_title}}\n\nGreat job team!",
    ],
    'member_removed' => [
      'subject' => 'You were removed from: {{card_title}}',
      'body' => "Hi {{user_name}},\n\n{{actor_name}} removed you from the following card:\n\n{{card_title}}\n\nYou will no longer receive notifications for this card unless you are re-assigned.",
    ],
    'card_moved' => [
      'subject' => '{{actor_name}} moved {{card_title}} to {{to_list}}',
      'body' => "Hi {{user_name}},\n\n{{actor_name}} moved a card you follow:\n\n{{card_title}}\n\nFrom: {{from_list}}\nTo: {{to_list}}",
    ],
  ];

  /**
   * Available tokens with descriptions.
   */
  public const AVAILABLE_TOKENS = [
    'user_name' => 'Recipient\'s display name (e.g., "John Doe")',
    'user_first_name' => 'Recipient\'s first name (e.g., "John")',
    'user_email' => 'Recipient\'s email address',
    'actor_name' => 'Name of the person who triggered the notification',
    'card_title' => 'Title of the related card',
    'card_description' => 'Description of the card (truncated)',
    'card_url' => 'URL to view the card',
    'comment_text' => 'The comment text (for comment notifications)',
    'due_date' => 'Formatted due date (e.g., "January 15, 2026")',
    'timeframe' => 'Relative time until due (e.g., "tomorrow", "in 2 days")',
    'from_list' => 'Source list name (for card moved notifications)',
    'to_list' => 'Destination list name (for card moved notifications)',
    'board_name' => 'Name of the board',
    'workspace_name' => 'Name of the workspace',
    'frontend_url' => 'Base URL of the frontend application',
  ];

  /**
   * Constructs an EmailTemplateController object.
   *
   * @param \Drupal\Core\Config\ConfigFactoryInterface $config_factory
   *   The config factory.
   */
  public function __construct(ConfigFactoryInterface $config_factory) {
    $this->configFactory = $config_factory;
  }

  /**
   * {@inheritdoc}
   */
  public static function create(ContainerInterface $container) {
    return new static(
      $container->get('config.factory')
    );
  }

  /**
   * Get all email templates.
   *
   * @return \Symfony\Component\HttpFoundation\JsonResponse
   *   The JSON response.
   */
  public function getTemplates(): JsonResponse {
    $config = $this->configFactory->get('boxtasks_notification.email_templates');
    $templates = [];

    foreach (self::DEFAULT_TEMPLATES as $type => $default) {
      $saved_subject = $config->get("templates.{$type}.subject");
      $saved_body = $config->get("templates.{$type}.body");

      $templates[$type] = [
        'type' => $type,
        'subject' => $saved_subject ?? $default['subject'],
        'body' => $saved_body ?? $default['body'],
        'is_custom' => ($saved_subject !== NULL || $saved_body !== NULL),
      ];
    }

    return new JsonResponse([
      'templates' => $templates,
      'tokens' => self::AVAILABLE_TOKENS,
    ]);
  }

  /**
   * Update a single email template.
   *
   * @param \Symfony\Component\HttpFoundation\Request $request
   *   The request object.
   * @param string $type
   *   The template type.
   *
   * @return \Symfony\Component\HttpFoundation\JsonResponse
   *   The JSON response.
   */
  public function updateTemplate(Request $request, string $type): JsonResponse {
    // Validate template type.
    if (!isset(self::DEFAULT_TEMPLATES[$type])) {
      return new JsonResponse([
        'error' => 'Invalid template type',
      ], 400);
    }

    $data = json_decode($request->getContent(), TRUE);
    if (!$data) {
      return new JsonResponse([
        'error' => 'Invalid JSON data',
      ], 400);
    }

    $config = $this->configFactory->getEditable('boxtasks_notification.email_templates');

    if (isset($data['subject'])) {
      $config->set("templates.{$type}.subject", $data['subject']);
    }

    if (isset($data['body'])) {
      $config->set("templates.{$type}.body", $data['body']);
    }

    $config->save();

    // Return the updated template.
    $saved_subject = $config->get("templates.{$type}.subject");
    $saved_body = $config->get("templates.{$type}.body");
    $default = self::DEFAULT_TEMPLATES[$type];

    return new JsonResponse([
      'template' => [
        'type' => $type,
        'subject' => $saved_subject ?? $default['subject'],
        'body' => $saved_body ?? $default['body'],
        'is_custom' => TRUE,
      ],
    ]);
  }

  /**
   * Reset a template to default.
   *
   * @param string $type
   *   The template type.
   *
   * @return \Symfony\Component\HttpFoundation\JsonResponse
   *   The JSON response.
   */
  public function resetTemplate(string $type): JsonResponse {
    // Validate template type.
    if (!isset(self::DEFAULT_TEMPLATES[$type])) {
      return new JsonResponse([
        'error' => 'Invalid template type',
      ], 400);
    }

    $config = $this->configFactory->getEditable('boxtasks_notification.email_templates');
    $config->clear("templates.{$type}");
    $config->save();

    $default = self::DEFAULT_TEMPLATES[$type];

    return new JsonResponse([
      'template' => [
        'type' => $type,
        'subject' => $default['subject'],
        'body' => $default['body'],
        'is_custom' => FALSE,
      ],
    ]);
  }

  /**
   * Preview a template with sample data.
   *
   * @param \Symfony\Component\HttpFoundation\Request $request
   *   The request object.
   *
   * @return \Symfony\Component\HttpFoundation\JsonResponse
   *   The JSON response.
   */
  public function previewTemplate(Request $request): JsonResponse {
    $data = json_decode($request->getContent(), TRUE);
    if (!$data || !isset($data['subject']) || !isset($data['body'])) {
      return new JsonResponse([
        'error' => 'Subject and body are required',
      ], 400);
    }

    // Sample data for preview.
    $sample_data = [
      'user_name' => 'John Doe',
      'user_first_name' => 'John',
      'user_email' => 'john.doe@example.com',
      'actor_name' => 'Jane Smith',
      'card_title' => 'Complete project documentation',
      'card_description' => 'Write comprehensive documentation for the new feature including API endpoints and usage examples.',
      'card_url' => 'https://tasks.boxraft.com/board/123',
      'comment_text' => 'Great progress! Can you also add the authentication section?',
      'due_date' => 'January 20, 2026',
      'timeframe' => 'tomorrow',
      'from_list' => 'In Progress',
      'to_list' => 'Review',
      'board_name' => 'Product Development',
      'workspace_name' => 'My Workspace',
      'frontend_url' => 'https://tasks.boxraft.com',
    ];

    // Replace tokens.
    $subject = $data['subject'];
    $body = $data['body'];

    foreach ($sample_data as $token => $value) {
      $subject = str_replace('{{' . $token . '}}', $value, $subject);
      $body = str_replace('{{' . $token . '}}', $value, $body);
    }

    return new JsonResponse([
      'preview' => [
        'subject' => $subject,
        'body' => $body,
      ],
    ]);
  }

}
