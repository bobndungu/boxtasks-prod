<?php

namespace Drupal\boxtasks_automation;

use Drupal\boxtasks_automation\Entity\AutomationLog;
use Drupal\boxtasks_automation\Entity\AutomationRule;
use Drupal\Core\Entity\EntityTypeManagerInterface;
use Psr\Log\LoggerInterface;

/**
 * Service to execute automation rules.
 */
class AutomationExecutor {

  /**
   * The entity type manager.
   *
   * @var \Drupal\Core\Entity\EntityTypeManagerInterface
   */
  protected EntityTypeManagerInterface $entityTypeManager;

  /**
   * The logger.
   *
   * @var \Psr\Log\LoggerInterface
   */
  protected LoggerInterface $logger;

  /**
   * Constructs an AutomationExecutor.
   *
   * @param \Drupal\Core\Entity\EntityTypeManagerInterface $entity_type_manager
   *   The entity type manager.
   * @param \Psr\Log\LoggerInterface $logger
   *   The logger.
   */
  public function __construct(
    EntityTypeManagerInterface $entity_type_manager,
    LoggerInterface $logger
  ) {
    $this->entityTypeManager = $entity_type_manager;
    $this->logger = $logger;
  }

  /**
   * Fires a trigger and executes matching automation rules.
   *
   * @param string $board_id
   *   The board ID.
   * @param string $trigger_type
   *   The trigger type.
   * @param array $trigger_data
   *   The trigger data.
   *
   * @return array
   *   Array of execution results.
   */
  public function fireTrigger(string $board_id, string $trigger_type, array $trigger_data): array {
    $results = [];

    // Find all enabled rules for this board with this trigger type.
    $rules = $this->entityTypeManager
      ->getStorage('automation_rule')
      ->loadByProperties([
        'board_id' => $board_id,
        'trigger_type' => $trigger_type,
        'enabled' => TRUE,
      ]);

    foreach ($rules as $rule) {
      $result = $this->executeRule($rule, $trigger_type, $trigger_data);
      $results[] = $result;
    }

    return $results;
  }

  /**
   * Executes a single automation rule.
   *
   * @param \Drupal\boxtasks_automation\Entity\AutomationRule $rule
   *   The automation rule.
   * @param string $trigger_type
   *   The trigger type.
   * @param array $trigger_data
   *   The trigger data.
   *
   * @return array
   *   The execution result.
   */
  public function executeRule(AutomationRule $rule, string $trigger_type, array $trigger_data): array {
    $start_time = microtime(TRUE);
    $result = [
      'rule_id' => $rule->id(),
      'rule_name' => $rule->get('name')->value,
      'success' => FALSE,
      'actions_executed' => [],
      'error' => NULL,
    ];

    try {
      // Check conditions.
      if (!$this->evaluateConditions($rule, $trigger_data)) {
        $result['skipped'] = TRUE;
        $result['reason'] = 'Conditions not met';
        return $result;
      }

      // Execute actions.
      $actions = $rule->getActions();
      $actions_executed = [];

      foreach ($actions as $action) {
        $action_result = $this->executeAction($action, $trigger_data);
        $actions_executed[] = [
          'type' => $action['type'] ?? 'unknown',
          'success' => $action_result['success'] ?? FALSE,
          'result' => $action_result,
        ];
      }

      $result['actions_executed'] = $actions_executed;
      $result['success'] = TRUE;

      // Record execution on the rule.
      $rule->recordExecution();
      $rule->save();

      // Create success log.
      $execution_time = (int) ((microtime(TRUE) - $start_time) * 1000);
      $log = AutomationLog::createSuccess(
        $rule,
        $trigger_type,
        $trigger_data,
        $actions_executed,
        $execution_time,
        $trigger_data['card_id'] ?? NULL
      );
      $log->save();

    }
    catch (\Exception $e) {
      $result['error'] = $e->getMessage();
      $this->logger->error('Automation rule @rule failed: @message', [
        '@rule' => $rule->get('name')->value,
        '@message' => $e->getMessage(),
      ]);

      // Create failure log.
      $execution_time = (int) ((microtime(TRUE) - $start_time) * 1000);
      $log = AutomationLog::createFailure(
        $rule,
        $trigger_type,
        $trigger_data,
        $e->getMessage(),
        $execution_time,
        $trigger_data['card_id'] ?? NULL
      );
      $log->save();
    }

    return $result;
  }

  /**
   * Evaluates conditions for a rule.
   *
   * @param \Drupal\boxtasks_automation\Entity\AutomationRule $rule
   *   The automation rule.
   * @param array $trigger_data
   *   The trigger data.
   *
   * @return bool
   *   TRUE if all conditions are met, FALSE otherwise.
   */
  protected function evaluateConditions(AutomationRule $rule, array $trigger_data): bool {
    $conditions = $rule->getConditions();

    // No conditions means always execute.
    if (empty($conditions)) {
      return TRUE;
    }

    foreach ($conditions as $condition) {
      if (!$this->evaluateCondition($condition, $trigger_data)) {
        return FALSE;
      }
    }

    return TRUE;
  }

  /**
   * Evaluates a single condition.
   *
   * @param array $condition
   *   The condition configuration.
   * @param array $trigger_data
   *   The trigger data.
   *
   * @return bool
   *   TRUE if the condition is met, FALSE otherwise.
   */
  protected function evaluateCondition(array $condition, array $trigger_data): bool {
    $type = $condition['type'] ?? '';
    $config = $condition['config'] ?? [];

    switch ($type) {
      case 'card_has_label':
        $card_labels = $trigger_data['card']['labels'] ?? [];
        $required_label = $config['label'] ?? '';
        return in_array($required_label, $card_labels);

      case 'card_in_list':
        $card_list_id = $trigger_data['card']['list_id'] ?? '';
        $required_list_id = $config['list_id'] ?? '';
        // Convert UUID to numeric ID if needed for comparison.
        if (preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $required_list_id)) {
          $lists = $this->entityTypeManager->getStorage('node')->loadByProperties([
            'uuid' => $required_list_id,
            'type' => 'board_list',
          ]);
          if (!empty($lists)) {
            $list = reset($lists);
            $required_list_id = $list->id();
          }
        }
        return (string) $card_list_id === (string) $required_list_id;

      case 'card_has_due_date':
        $due_date = $trigger_data['card']['due_date'] ?? '';
        $operator = $config['operator'] ?? 'is_set';

        // Handle simple is_set / is_not_set operators
        if ($operator === 'is_set') {
          return !empty($due_date);
        }
        if ($operator === 'is_not_set') {
          return empty($due_date);
        }

        // For comparison operators, we need a due date
        if (empty($due_date)) {
          return FALSE;
        }

        // Calculate the comparison date based on relative value and unit
        $relative_value = (int) ($config['relative_value'] ?? 0);
        $relative_unit = $config['relative_unit'] ?? 'days';

        // Build the relative date string
        $unit_map = [
          'days' => 'days',
          'weeks' => 'weeks',
          'months' => 'months',
        ];
        $unit = $unit_map[$relative_unit] ?? 'days';

        // Calculate comparison timestamp (from now)
        if ($relative_value >= 0) {
          $comparison_date = strtotime("+{$relative_value} {$unit}");
        } else {
          $abs_value = abs($relative_value);
          $comparison_date = strtotime("-{$abs_value} {$unit}");
        }

        // Normalize to start of day for date-only comparisons
        $due_timestamp = strtotime(date('Y-m-d', strtotime($due_date)));
        $comparison_timestamp = strtotime(date('Y-m-d', $comparison_date));

        switch ($operator) {
          case 'is_before':
            return $due_timestamp < $comparison_timestamp;
          case 'is_after':
            return $due_timestamp > $comparison_timestamp;
          case 'is_on_or_before':
            return $due_timestamp <= $comparison_timestamp;
          case 'is_on_or_after':
            return $due_timestamp >= $comparison_timestamp;
          case 'equals':
            return $due_timestamp === $comparison_timestamp;
          default:
            return !empty($due_date);
        }

      case 'card_is_overdue':
        $due_date = $trigger_data['card']['due_date'] ?? '';
        if (empty($due_date)) {
          return FALSE;
        }
        return strtotime($due_date) < time();

      case 'card_title_contains':
        $card_title = $trigger_data['card']['title'] ?? '';
        $search_text = $config['text'] ?? '';
        return stripos($card_title, $search_text) !== FALSE;

      case 'card_has_department':
        $card_department = $trigger_data['card']['department_id'] ?? NULL;
        $required_department = $config['department_id'] ?? '';
        if (empty($required_department)) {
          return !empty($card_department);
        }
        return (string) $card_department === (string) $required_department;

      case 'card_has_client':
        $card_client = $trigger_data['card']['client_id'] ?? NULL;
        $required_client = $config['client_id'] ?? '';
        if (empty($required_client)) {
          return !empty($card_client);
        }
        return (string) $card_client === (string) $required_client;

      case 'custom_field_equals':
        $field_id = $config['field_id'] ?? '';
        $expected_value = $config['value'] ?? '';
        $card_id = $trigger_data['card_id'] ?? $trigger_data['card']['id'] ?? NULL;
        if (!$card_id || !$field_id) {
          return FALSE;
        }
        $custom_field_values = $trigger_data['card']['custom_field_values'] ?? [];
        foreach ($custom_field_values as $cfv) {
          if (($cfv['definition_id'] ?? '') === $field_id) {
            return ($cfv['value'] ?? '') === $expected_value;
          }
        }
        return FALSE;

      case 'custom_field_not_empty':
        $field_id = $config['field_id'] ?? '';
        $card_id = $trigger_data['card_id'] ?? $trigger_data['card']['id'] ?? NULL;
        if (!$card_id || !$field_id) {
          return FALSE;
        }
        $custom_field_values = $trigger_data['card']['custom_field_values'] ?? [];
        foreach ($custom_field_values as $cfv) {
          if (($cfv['definition_id'] ?? '') === $field_id) {
            return !empty($cfv['value']);
          }
        }
        return FALSE;

      case 'card_has_watcher':
        $card_watchers = $trigger_data['card']['watchers'] ?? [];
        $required_watcher = $config['user_id'] ?? '';
        if (empty($required_watcher)) {
          return !empty($card_watchers);
        }
        return in_array($required_watcher, $card_watchers);

      case 'card_has_comments':
        $comment_count = $trigger_data['card']['comment_count'] ?? 0;
        return $comment_count > 0;

      case 'card_has_member':
        $card_members = $trigger_data['card']['members'] ?? [];
        $required_member = $config['user_id'] ?? '';
        if (empty($required_member)) {
          return !empty($card_members);
        }
        $member_ids = array_column($card_members, 'id');
        return in_array($required_member, $member_ids);

      case 'card_is_approved':
        $approved_by = $trigger_data['card']['approved_by'] ?? NULL;
        $rejected_by = $trigger_data['card']['rejected_by'] ?? NULL;
        return !empty($approved_by) && empty($rejected_by);

      case 'card_is_rejected':
        $approved_by = $trigger_data['card']['approved_by'] ?? NULL;
        $rejected_by = $trigger_data['card']['rejected_by'] ?? NULL;
        return !empty($rejected_by) && empty($approved_by);

      case 'card_has_no_approval':
        $approved_by = $trigger_data['card']['approved_by'] ?? NULL;
        $rejected_by = $trigger_data['card']['rejected_by'] ?? NULL;
        return empty($approved_by) && empty($rejected_by);

      case 'card_approved_by':
        $approved_by = $trigger_data['card']['approved_by'] ?? NULL;
        $required_user = $config['user_id'] ?? '';
        if (empty($required_user)) {
          return !empty($approved_by);
        }
        // Convert UUID to numeric ID if needed for comparison.
        if (preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $required_user)) {
          $users = $this->entityTypeManager->getStorage('user')->loadByProperties([
            'uuid' => $required_user,
          ]);
          if (!empty($users)) {
            $user = reset($users);
            $required_user = $user->id();
          }
        }
        return (string) $approved_by === (string) $required_user;

      default:
        // Unknown condition type, skip (return TRUE to not block).
        return TRUE;
    }
  }

  /**
   * Executes a single action.
   *
   * @param array $action
   *   The action configuration.
   * @param array $trigger_data
   *   The trigger data.
   *
   * @return array
   *   The action result.
   */
  protected function executeAction(array $action, array $trigger_data): array {
    $type = $action['type'] ?? '';
    $config = $action['config'] ?? [];
    $result = ['success' => FALSE, 'type' => $type];

    try {
      switch ($type) {
        case 'add_label':
          $result = $this->executeAddLabel($config, $trigger_data);
          break;

        case 'remove_label':
          $result = $this->executeRemoveLabel($config, $trigger_data);
          break;

        case 'move_card':
          $result = $this->executeMoveCard($config, $trigger_data);
          break;

        case 'mark_complete':
          $result = $this->executeMarkComplete($config, $trigger_data);
          break;

        case 'set_due_date':
          $result = $this->executeSetDueDate($config, $trigger_data);
          break;

        case 'add_member':
          $result = $this->executeAddMember($config, $trigger_data);
          break;

        case 'send_email':
          $result = $this->executeSendEmail($config, $trigger_data);
          break;

        case 'add_comment':
          $result = $this->executeAddComment($config, $trigger_data);
          break;

        case 'set_custom_field':
          $result = $this->executeSetCustomField($config, $trigger_data);
          break;

        case 'set_department':
          $result = $this->executeSetDepartment($config, $trigger_data);
          break;

        case 'set_client':
          $result = $this->executeSetClient($config, $trigger_data);
          break;

        case 'add_watcher':
          $result = $this->executeAddWatcher($config, $trigger_data);
          break;

        case 'remove_watcher':
          $result = $this->executeRemoveWatcher($config, $trigger_data);
          break;

        case 'approve_card':
          $result = $this->executeApproveCard($config, $trigger_data);
          break;

        case 'reject_card':
          $result = $this->executeRejectCard($config, $trigger_data);
          break;

        case 'clear_approval':
          $result = $this->executeClearApproval($config, $trigger_data);
          break;

        default:
          $result['error'] = "Unknown action type: $type";
      }
    }
    catch (\Exception $e) {
      $result['error'] = $e->getMessage();
    }

    return $result;
  }

  /**
   * Executes add label action.
   */
  protected function executeAddLabel(array $config, array $trigger_data): array {
    $card_id = $trigger_data['card_id'] ?? $trigger_data['card']['id'] ?? NULL;
    if (!$card_id) {
      return ['success' => FALSE, 'error' => 'No card ID'];
    }

    $label = $config['label'] ?? '';
    if (!$label) {
      return ['success' => FALSE, 'error' => 'No label specified'];
    }

    $card = $this->entityTypeManager->getStorage('node')->load($card_id);
    if (!$card) {
      return ['success' => FALSE, 'error' => 'Card not found'];
    }

    $labels = $card->get('field_card_labels')->getValue();
    $label_values = array_column($labels, 'value');

    if (!in_array($label, $label_values)) {
      $labels[] = ['value' => $label];
      $card->set('field_card_labels', $labels);
      $card->save();
    }

    return ['success' => TRUE, 'label' => $label];
  }

  /**
   * Executes remove label action.
   */
  protected function executeRemoveLabel(array $config, array $trigger_data): array {
    $card_id = $trigger_data['card_id'] ?? $trigger_data['card']['id'] ?? NULL;
    if (!$card_id) {
      return ['success' => FALSE, 'error' => 'No card ID'];
    }

    $label = $config['label'] ?? '';
    if (!$label) {
      return ['success' => FALSE, 'error' => 'No label specified'];
    }

    $card = $this->entityTypeManager->getStorage('node')->load($card_id);
    if (!$card) {
      return ['success' => FALSE, 'error' => 'Card not found'];
    }

    $labels = $card->get('field_card_labels')->getValue();
    $labels = array_filter($labels, fn($l) => $l['value'] !== $label);
    $card->set('field_card_labels', array_values($labels));
    $card->save();

    return ['success' => TRUE, 'label' => $label];
  }

  /**
   * Executes move card action.
   */
  protected function executeMoveCard(array $config, array $trigger_data): array {
    $card_id = $trigger_data['card_id'] ?? $trigger_data['card']['id'] ?? NULL;
    if (!$card_id) {
      return ['success' => FALSE, 'error' => 'No card ID'];
    }

    $target_list_id = $config['list_id'] ?? '';
    if (!$target_list_id) {
      return ['success' => FALSE, 'error' => 'No target list specified'];
    }

    $card = $this->entityTypeManager->getStorage('node')->load($card_id);
    if (!$card) {
      return ['success' => FALSE, 'error' => 'Card not found'];
    }

    // The config stores UUID, but the field needs numeric ID.
    // Check if it's a UUID and convert to numeric ID.
    if (preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $target_list_id)) {
      $lists = $this->entityTypeManager->getStorage('node')->loadByProperties([
        'uuid' => $target_list_id,
        'type' => 'board_list',
      ]);
      if (empty($lists)) {
        return ['success' => FALSE, 'error' => 'Target list not found'];
      }
      $target_list = reset($lists);
      $target_list_id = $target_list->id();
    }

    $card->set('field_card_list', $target_list_id);
    $card->save();

    return ['success' => TRUE, 'list_id' => $target_list_id];
  }

  /**
   * Executes mark complete action.
   */
  protected function executeMarkComplete(array $config, array $trigger_data): array {
    $card_id = $trigger_data['card_id'] ?? $trigger_data['card']['id'] ?? NULL;
    if (!$card_id) {
      return ['success' => FALSE, 'error' => 'No card ID'];
    }

    $card = $this->entityTypeManager->getStorage('node')->load($card_id);
    if (!$card) {
      return ['success' => FALSE, 'error' => 'Card not found'];
    }

    $completed = $config['completed'] ?? TRUE;
    $card->set('field_card_completed', $completed);
    $card->save();

    return ['success' => TRUE, 'completed' => $completed];
  }

  /**
   * Executes set due date action.
   */
  protected function executeSetDueDate(array $config, array $trigger_data): array {
    $card_id = $trigger_data['card_id'] ?? $trigger_data['card']['id'] ?? NULL;
    if (!$card_id) {
      return ['success' => FALSE, 'error' => 'No card ID'];
    }

    $card = $this->entityTypeManager->getStorage('node')->load($card_id);
    if (!$card) {
      return ['success' => FALSE, 'error' => 'Card not found'];
    }

    // Support relative dates like "+3 days", "+1 week", etc.
    $date_value = $config['date'] ?? '';
    if (str_starts_with($date_value, '+') || str_starts_with($date_value, '-')) {
      $timestamp = strtotime($date_value);
      $date_value = date('Y-m-d\TH:i:s', $timestamp);
    }

    $card->set('field_card_due_date', $date_value);
    $card->save();

    return ['success' => TRUE, 'due_date' => $date_value];
  }

  /**
   * Executes add member action.
   */
  protected function executeAddMember(array $config, array $trigger_data): array {
    $card_id = $trigger_data['card_id'] ?? $trigger_data['card']['id'] ?? NULL;
    if (!$card_id) {
      return ['success' => FALSE, 'error' => 'No card ID'];
    }

    $user_id = $config['user_id'] ?? '';
    if (!$user_id) {
      return ['success' => FALSE, 'error' => 'No user specified'];
    }

    $card = $this->entityTypeManager->getStorage('node')->load($card_id);
    if (!$card) {
      return ['success' => FALSE, 'error' => 'Card not found'];
    }

    // The config stores UUID, but the field needs numeric ID.
    // Check if it's a UUID and convert to numeric ID.
    if (preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $user_id)) {
      $users = $this->entityTypeManager->getStorage('user')->loadByProperties([
        'uuid' => $user_id,
      ]);
      if (empty($users)) {
        return ['success' => FALSE, 'error' => 'User not found'];
      }
      $user = reset($users);
      $user_id = $user->id();
    }

    $members = $card->get('field_card_members')->getValue();
    $member_ids = array_column($members, 'target_id');

    if (!in_array($user_id, $member_ids)) {
      $members[] = ['target_id' => $user_id];
      $card->set('field_card_members', $members);
      $card->save();
    }

    return ['success' => TRUE, 'user_id' => $user_id];
  }

  /**
   * Executes send email action.
   */
  protected function executeSendEmail(array $config, array $trigger_data): array {
    $card_id = $trigger_data['card_id'] ?? $trigger_data['card']['id'] ?? NULL;
    $card_title = $trigger_data['card']['title'] ?? 'Card';
    $board_name = $trigger_data['board']['name'] ?? 'Board';

    $recipient_type = $config['recipient_type'] ?? 'members';
    $subject = $config['subject'] ?? "BoxTasks: Action required on \"$card_title\"";
    $message = $config['message'] ?? "An automation was triggered on the card \"$card_title\" in \"$board_name\".";

    // Replace placeholders in subject and message.
    $replacements = [
      '{card_title}' => $card_title,
      '{board_name}' => $board_name,
      '{card_id}' => $card_id,
    ];
    $subject = str_replace(array_keys($replacements), array_values($replacements), $subject);
    $message = str_replace(array_keys($replacements), array_values($replacements), $message);

    $recipients = [];

    switch ($recipient_type) {
      case 'members':
        // Get card members.
        if ($card_id) {
          $card = $this->entityTypeManager->getStorage('node')->load($card_id);
          if ($card && $card->hasField('field_card_members')) {
            $members = $card->get('field_card_members')->referencedEntities();
            foreach ($members as $member) {
              $recipients[] = $member->getEmail();
            }
          }
        }
        break;

      case 'watchers':
        // Get card watchers.
        if ($card_id) {
          $card = $this->entityTypeManager->getStorage('node')->load($card_id);
          if ($card && $card->hasField('field_card_watchers')) {
            $watchers = $card->get('field_card_watchers')->referencedEntities();
            foreach ($watchers as $watcher) {
              $recipients[] = $watcher->getEmail();
            }
          }
        }
        break;

      case 'specific':
        $emails = $config['emails'] ?? '';
        $recipients = array_map('trim', explode(',', $emails));
        break;

      case 'creator':
        if ($card_id) {
          $card = $this->entityTypeManager->getStorage('node')->load($card_id);
          if ($card) {
            $creator = $card->getOwner();
            if ($creator) {
              $recipients[] = $creator->getEmail();
            }
          }
        }
        break;
    }

    // Filter out empty emails.
    $recipients = array_filter($recipients, fn($email) => !empty($email) && filter_var($email, FILTER_VALIDATE_EMAIL));
    $recipients = array_unique($recipients);

    if (empty($recipients)) {
      return ['success' => FALSE, 'error' => 'No valid recipients found'];
    }

    // Send emails using Drupal's mail system.
    $mail_manager = \Drupal::service('plugin.manager.mail');
    $module = 'boxtasks_automation';
    $key = 'automation_notification';
    $langcode = \Drupal::currentUser()->getPreferredLangcode();
    $send = TRUE;

    $sent_count = 0;
    foreach ($recipients as $to) {
      $params = [
        'subject' => $subject,
        'message' => $message,
        'card_id' => $card_id,
      ];

      $result = $mail_manager->mail($module, $key, $to, $langcode, $params, NULL, $send);
      if ($result['result']) {
        $sent_count++;
      }
    }

    return [
      'success' => $sent_count > 0,
      'recipients' => $recipients,
      'sent_count' => $sent_count,
    ];
  }

  /**
   * Executes add comment action.
   */
  protected function executeAddComment(array $config, array $trigger_data): array {
    $card_id = $trigger_data['card_id'] ?? $trigger_data['card']['id'] ?? NULL;
    if (!$card_id) {
      return ['success' => FALSE, 'error' => 'No card ID'];
    }

    $comment_text = $config['text'] ?? '';
    if (empty($comment_text)) {
      return ['success' => FALSE, 'error' => 'No comment text specified'];
    }

    // Replace placeholders.
    $card_title = $trigger_data['card']['title'] ?? 'Card';
    $board_name = $trigger_data['board']['name'] ?? 'Board';
    $replacements = [
      '{card_title}' => $card_title,
      '{board_name}' => $board_name,
      '{trigger_type}' => $trigger_data['trigger_type'] ?? 'automation',
    ];
    $comment_text = str_replace(array_keys($replacements), array_values($replacements), $comment_text);

    // Create comment node.
    $comment = $this->entityTypeManager->getStorage('node')->create([
      'type' => 'card_comment',
      'title' => substr($comment_text, 0, 50) . '...',
      'field_comment_text' => [
        'value' => $comment_text,
        'format' => 'basic_html',
      ],
      'field_comment_card' => $card_id,
      'uid' => 1, // System user for automated comments.
    ]);
    $comment->save();

    return ['success' => TRUE, 'comment_id' => $comment->id()];
  }

  /**
   * Executes set custom field action.
   */
  protected function executeSetCustomField(array $config, array $trigger_data): array {
    $card_id = $trigger_data['card_id'] ?? $trigger_data['card']['id'] ?? NULL;
    if (!$card_id) {
      return ['success' => FALSE, 'error' => 'No card ID'];
    }

    $field_id = $config['field_id'] ?? '';
    if (empty($field_id)) {
      return ['success' => FALSE, 'error' => 'No field ID specified'];
    }

    $value = $config['value'] ?? '';

    // Load or create custom field value entity.
    $storage = $this->entityTypeManager->getStorage('custom_field_value');
    $existing = $storage->loadByProperties([
      'card_id' => $card_id,
      'definition_id' => $field_id,
    ]);

    if (!empty($existing)) {
      $cfv = reset($existing);
      $cfv->set('value', $value);
    }
    else {
      $cfv = $storage->create([
        'card_id' => $card_id,
        'definition_id' => $field_id,
        'value' => $value,
      ]);
    }
    $cfv->save();

    return ['success' => TRUE, 'field_id' => $field_id, 'value' => $value];
  }

  /**
   * Executes set department action.
   */
  protected function executeSetDepartment(array $config, array $trigger_data): array {
    $card_id = $trigger_data['card_id'] ?? $trigger_data['card']['id'] ?? NULL;
    if (!$card_id) {
      return ['success' => FALSE, 'error' => 'No card ID'];
    }

    $department_id = $config['department_id'] ?? '';
    if (empty($department_id)) {
      return ['success' => FALSE, 'error' => 'No department specified'];
    }

    $card = $this->entityTypeManager->getStorage('node')->load($card_id);
    if (!$card) {
      return ['success' => FALSE, 'error' => 'Card not found'];
    }

    // Convert UUID to TID if necessary.
    if (preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $department_id)) {
      $terms = $this->entityTypeManager->getStorage('taxonomy_term')->loadByProperties([
        'uuid' => $department_id,
        'vid' => 'department',
      ]);
      if (!empty($terms)) {
        $term = reset($terms);
        $department_id = $term->id();
      }
    }

    if ($card->hasField('field_card_department')) {
      $card->set('field_card_department', $department_id);
      $card->save();
    }

    return ['success' => TRUE, 'department_id' => $department_id];
  }

  /**
   * Executes set client action.
   */
  protected function executeSetClient(array $config, array $trigger_data): array {
    $card_id = $trigger_data['card_id'] ?? $trigger_data['card']['id'] ?? NULL;
    if (!$card_id) {
      return ['success' => FALSE, 'error' => 'No card ID'];
    }

    $client_id = $config['client_id'] ?? '';
    if (empty($client_id)) {
      return ['success' => FALSE, 'error' => 'No client specified'];
    }

    $card = $this->entityTypeManager->getStorage('node')->load($card_id);
    if (!$card) {
      return ['success' => FALSE, 'error' => 'Card not found'];
    }

    // Convert UUID to TID if necessary.
    if (preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $client_id)) {
      $terms = $this->entityTypeManager->getStorage('taxonomy_term')->loadByProperties([
        'uuid' => $client_id,
        'vid' => 'client',
      ]);
      if (!empty($terms)) {
        $term = reset($terms);
        $client_id = $term->id();
      }
    }

    if ($card->hasField('field_card_client')) {
      $card->set('field_card_client', $client_id);
      $card->save();
    }

    return ['success' => TRUE, 'client_id' => $client_id];
  }

  /**
   * Executes add watcher action.
   */
  protected function executeAddWatcher(array $config, array $trigger_data): array {
    $card_id = $trigger_data['card_id'] ?? $trigger_data['card']['id'] ?? NULL;
    if (!$card_id) {
      return ['success' => FALSE, 'error' => 'No card ID'];
    }

    $user_id = $config['user_id'] ?? '';
    if (empty($user_id)) {
      return ['success' => FALSE, 'error' => 'No user specified'];
    }

    $card = $this->entityTypeManager->getStorage('node')->load($card_id);
    if (!$card) {
      return ['success' => FALSE, 'error' => 'Card not found'];
    }

    // Convert UUID to numeric ID if necessary.
    if (preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $user_id)) {
      $users = $this->entityTypeManager->getStorage('user')->loadByProperties([
        'uuid' => $user_id,
      ]);
      if (empty($users)) {
        return ['success' => FALSE, 'error' => 'User not found'];
      }
      $user = reset($users);
      $user_id = $user->id();
    }

    if ($card->hasField('field_card_watchers')) {
      $watchers = $card->get('field_card_watchers')->getValue();
      $watcher_ids = array_column($watchers, 'target_id');

      if (!in_array($user_id, $watcher_ids)) {
        $watchers[] = ['target_id' => $user_id];
        $card->set('field_card_watchers', $watchers);
        $card->save();
      }
    }

    return ['success' => TRUE, 'user_id' => $user_id];
  }

  /**
   * Executes remove watcher action.
   */
  protected function executeRemoveWatcher(array $config, array $trigger_data): array {
    $card_id = $trigger_data['card_id'] ?? $trigger_data['card']['id'] ?? NULL;
    if (!$card_id) {
      return ['success' => FALSE, 'error' => 'No card ID'];
    }

    $user_id = $config['user_id'] ?? '';
    if (empty($user_id)) {
      return ['success' => FALSE, 'error' => 'No user specified'];
    }

    $card = $this->entityTypeManager->getStorage('node')->load($card_id);
    if (!$card) {
      return ['success' => FALSE, 'error' => 'Card not found'];
    }

    // Convert UUID to numeric ID if necessary.
    if (preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $user_id)) {
      $users = $this->entityTypeManager->getStorage('user')->loadByProperties([
        'uuid' => $user_id,
      ]);
      if (empty($users)) {
        return ['success' => FALSE, 'error' => 'User not found'];
      }
      $user = reset($users);
      $user_id = $user->id();
    }

    if ($card->hasField('field_card_watchers')) {
      $watchers = $card->get('field_card_watchers')->getValue();
      $watchers = array_filter($watchers, fn($w) => (string) $w['target_id'] !== (string) $user_id);
      $card->set('field_card_watchers', array_values($watchers));
      $card->save();
    }

    return ['success' => TRUE, 'user_id' => $user_id];
  }

  /**
   * Executes approve card action.
   */
  protected function executeApproveCard(array $config, array $trigger_data): array {
    $card_id = $trigger_data['card_id'] ?? $trigger_data['card']['id'] ?? NULL;
    if (!$card_id) {
      return ['success' => FALSE, 'error' => 'No card ID'];
    }

    $card = $this->entityTypeManager->getStorage('node')->load($card_id);
    if (!$card) {
      return ['success' => FALSE, 'error' => 'Card not found'];
    }

    // Get the user who should be marked as the approver.
    // Can be specified in config, otherwise use system user (1).
    $approver_id = $config['user_id'] ?? 1;

    // Convert UUID to numeric ID if necessary.
    if (preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $approver_id)) {
      $users = $this->entityTypeManager->getStorage('user')->loadByProperties([
        'uuid' => $approver_id,
      ]);
      if (!empty($users)) {
        $user = reset($users);
        $approver_id = $user->id();
      }
    }

    // Set approved_by and clear rejected_by.
    if ($card->hasField('field_card_approved_by')) {
      $card->set('field_card_approved_by', $approver_id);
    }
    if ($card->hasField('field_card_rejected_by')) {
      $card->set('field_card_rejected_by', NULL);
    }
    $card->save();

    return ['success' => TRUE, 'approved_by' => $approver_id];
  }

  /**
   * Executes reject card action.
   */
  protected function executeRejectCard(array $config, array $trigger_data): array {
    $card_id = $trigger_data['card_id'] ?? $trigger_data['card']['id'] ?? NULL;
    if (!$card_id) {
      return ['success' => FALSE, 'error' => 'No card ID'];
    }

    $card = $this->entityTypeManager->getStorage('node')->load($card_id);
    if (!$card) {
      return ['success' => FALSE, 'error' => 'Card not found'];
    }

    // Get the user who should be marked as the rejector.
    // Can be specified in config, otherwise use system user (1).
    $rejector_id = $config['user_id'] ?? 1;

    // Convert UUID to numeric ID if necessary.
    if (preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $rejector_id)) {
      $users = $this->entityTypeManager->getStorage('user')->loadByProperties([
        'uuid' => $rejector_id,
      ]);
      if (!empty($users)) {
        $user = reset($users);
        $rejector_id = $user->id();
      }
    }

    // Set rejected_by and clear approved_by.
    if ($card->hasField('field_card_rejected_by')) {
      $card->set('field_card_rejected_by', $rejector_id);
    }
    if ($card->hasField('field_card_approved_by')) {
      $card->set('field_card_approved_by', NULL);
    }
    $card->save();

    return ['success' => TRUE, 'rejected_by' => $rejector_id];
  }

  /**
   * Executes clear approval action.
   */
  protected function executeClearApproval(array $config, array $trigger_data): array {
    $card_id = $trigger_data['card_id'] ?? $trigger_data['card']['id'] ?? NULL;
    if (!$card_id) {
      return ['success' => FALSE, 'error' => 'No card ID'];
    }

    $card = $this->entityTypeManager->getStorage('node')->load($card_id);
    if (!$card) {
      return ['success' => FALSE, 'error' => 'Card not found'];
    }

    // Clear both approval fields.
    if ($card->hasField('field_card_approved_by')) {
      $card->set('field_card_approved_by', NULL);
    }
    if ($card->hasField('field_card_rejected_by')) {
      $card->set('field_card_rejected_by', NULL);
    }
    $card->save();

    return ['success' => TRUE, 'cleared' => TRUE];
  }

}
