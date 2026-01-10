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
        return !empty($trigger_data['card']['due_date']);

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

}
