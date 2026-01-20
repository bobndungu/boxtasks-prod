<?php

namespace Drupal\boxtasks_automation\Entity;

use Drupal\Core\Entity\ContentEntityBase;
use Drupal\Core\Entity\EntityTypeInterface;
use Drupal\Core\Field\BaseFieldDefinition;

/**
 * Defines the Automation Log entity.
 *
 * @ContentEntityType(
 *   id = "automation_log",
 *   label = @Translation("Automation Log"),
 *   label_collection = @Translation("Automation Logs"),
 *   label_singular = @Translation("automation log"),
 *   label_plural = @Translation("automation logs"),
 *   handlers = {
 *     "view_builder" = "Drupal\Core\Entity\EntityViewBuilder",
 *     "list_builder" = "Drupal\Core\Entity\EntityListBuilder",
 *   },
 *   base_table = "automation_log",
 *   admin_permission = "administer automation rules",
 *   entity_keys = {
 *     "id" = "id",
 *     "uuid" = "uuid",
 *   },
 * )
 */
class AutomationLog extends ContentEntityBase {

  /**
   * {@inheritdoc}
   */
  public static function baseFieldDefinitions(EntityTypeInterface $entity_type) {
    $fields = parent::baseFieldDefinitions($entity_type);

    // Reference to the automation rule that was executed.
    $fields['rule_id'] = BaseFieldDefinition::create('entity_reference')
      ->setLabel(t('Automation Rule'))
      ->setDescription(t('The automation rule that was executed.'))
      ->setSetting('target_type', 'automation_rule')
      ->setRequired(TRUE);

    // Reference to the board (stored as node).
    $fields['board_id'] = BaseFieldDefinition::create('entity_reference')
      ->setLabel(t('Board'))
      ->setDescription(t('The board where this rule was executed.'))
      ->setSetting('target_type', 'node')
      ->setSetting('handler_settings', ['target_bundles' => ['board' => 'board']])
      ->setRequired(TRUE);

    // Reference to the card that triggered the rule (if applicable, stored as node).
    $fields['card_id'] = BaseFieldDefinition::create('entity_reference')
      ->setLabel(t('Card'))
      ->setDescription(t('The card that triggered this rule.'))
      ->setSetting('target_type', 'node')
      ->setSetting('handler_settings', ['target_bundles' => ['card' => 'card']]);

    // The trigger type that was fired.
    $fields['trigger_type'] = BaseFieldDefinition::create('string')
      ->setLabel(t('Trigger Type'))
      ->setDescription(t('The trigger type that fired.'))
      ->setRequired(TRUE)
      ->setSettings([
        'max_length' => 64,
      ]);

    // Trigger data - JSON snapshot of what triggered the rule.
    $fields['trigger_data'] = BaseFieldDefinition::create('string_long')
      ->setLabel(t('Trigger Data'))
      ->setDescription(t('JSON snapshot of what triggered the rule.'))
      ->setDefaultValue('{}');

    // Actions executed - JSON array of actions that were performed.
    $fields['actions_executed'] = BaseFieldDefinition::create('string_long')
      ->setLabel(t('Actions Executed'))
      ->setDescription(t('JSON array of actions that were performed.'))
      ->setDefaultValue('[]');

    // Status of the execution.
    $fields['status'] = BaseFieldDefinition::create('string')
      ->setLabel(t('Status'))
      ->setDescription(t('The status of this execution.'))
      ->setDefaultValue('success')
      ->setSettings([
        'max_length' => 32,
      ]);

    // Error message if execution failed.
    $fields['error_message'] = BaseFieldDefinition::create('string_long')
      ->setLabel(t('Error Message'))
      ->setDescription(t('Error message if the execution failed.'));

    // Execution time in milliseconds.
    $fields['execution_time'] = BaseFieldDefinition::create('integer')
      ->setLabel(t('Execution Time'))
      ->setDescription(t('Time taken to execute in milliseconds.'))
      ->setDefaultValue(0);

    // Created timestamp.
    $fields['created'] = BaseFieldDefinition::create('created')
      ->setLabel(t('Created'))
      ->setDescription(t('The time when the log entry was created.'));

    return $fields;
  }

  /**
   * Gets the trigger data as an array.
   *
   * @return array
   *   The trigger data.
   */
  public function getTriggerData(): array {
    $value = $this->get('trigger_data')->value;
    return $value ? json_decode($value, TRUE) ?? [] : [];
  }

  /**
   * Sets the trigger data from an array.
   *
   * @param array $data
   *   The trigger data.
   *
   * @return $this
   */
  public function setTriggerData(array $data): static {
    $this->set('trigger_data', json_encode($data));
    return $this;
  }

  /**
   * Gets the actions executed as an array.
   *
   * @return array
   *   The actions executed.
   */
  public function getActionsExecuted(): array {
    $value = $this->get('actions_executed')->value;
    return $value ? json_decode($value, TRUE) ?? [] : [];
  }

  /**
   * Sets the actions executed from an array.
   *
   * @param array $actions
   *   The actions executed.
   *
   * @return $this
   */
  public function setActionsExecuted(array $actions): static {
    $this->set('actions_executed', json_encode($actions));
    return $this;
  }

  /**
   * Creates a log entry for a successful execution.
   *
   * @param \Drupal\boxtasks_automation\Entity\AutomationRule $rule
   *   The automation rule.
   * @param string $trigger_type
   *   The trigger type.
   * @param array $trigger_data
   *   The trigger data.
   * @param array $actions_executed
   *   The actions that were executed.
   * @param int $execution_time
   *   The execution time in milliseconds.
   * @param string|null $card_id
   *   The card ID if applicable.
   *
   * @return static
   *   The created log entity.
   */
  public static function createSuccess(
    AutomationRule $rule,
    string $trigger_type,
    array $trigger_data,
    array $actions_executed,
    int $execution_time,
    ?string $card_id = NULL
  ): static {
    $log = static::create([
      'rule_id' => $rule->id(),
      'board_id' => $rule->get('board_id')->target_id,
      'card_id' => $card_id,
      'trigger_type' => $trigger_type,
      'status' => 'success',
      'execution_time' => $execution_time,
    ]);
    $log->setTriggerData($trigger_data);
    $log->setActionsExecuted($actions_executed);
    return $log;
  }

  /**
   * Creates a log entry for a failed execution.
   *
   * @param \Drupal\boxtasks_automation\Entity\AutomationRule $rule
   *   The automation rule.
   * @param string $trigger_type
   *   The trigger type.
   * @param array $trigger_data
   *   The trigger data.
   * @param string $error_message
   *   The error message.
   * @param int $execution_time
   *   The execution time in milliseconds.
   * @param string|null $card_id
   *   The card ID if applicable.
   *
   * @return static
   *   The created log entity.
   */
  public static function createFailure(
    AutomationRule $rule,
    string $trigger_type,
    array $trigger_data,
    string $error_message,
    int $execution_time,
    ?string $card_id = NULL
  ): static {
    $log = static::create([
      'rule_id' => $rule->id(),
      'board_id' => $rule->get('board_id')->target_id,
      'card_id' => $card_id,
      'trigger_type' => $trigger_type,
      'status' => 'error',
      'error_message' => $error_message,
      'execution_time' => $execution_time,
    ]);
    $log->setTriggerData($trigger_data);
    return $log;
  }

}
