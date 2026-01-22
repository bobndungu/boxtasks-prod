<?php

namespace Drupal\boxtasks_automation\Entity;

use Drupal\Core\Entity\ContentEntityBase;
use Drupal\Core\Entity\EntityTypeInterface;
use Drupal\Core\Field\BaseFieldDefinition;
use Drupal\Core\Entity\EntityChangedTrait;

/**
 * Defines the Automation Rule entity.
 *
 * @ContentEntityType(
 *   id = "automation_rule",
 *   label = @Translation("Automation Rule"),
 *   label_collection = @Translation("Automation Rules"),
 *   label_singular = @Translation("automation rule"),
 *   label_plural = @Translation("automation rules"),
 *   handlers = {
 *     "view_builder" = "Drupal\Core\Entity\EntityViewBuilder",
 *     "list_builder" = "Drupal\Core\Entity\EntityListBuilder",
 *     "access" = "Drupal\boxtasks_automation\AutomationRuleAccessControlHandler",
 *     "form" = {
 *       "default" = "Drupal\Core\Entity\ContentEntityForm",
 *       "delete" = "Drupal\Core\Entity\ContentEntityDeleteForm",
 *     },
 *   },
 *   base_table = "automation_rule",
 *   admin_permission = "administer automation rules",
 *   entity_keys = {
 *     "id" = "id",
 *     "uuid" = "uuid",
 *     "label" = "name",
 *   },
 *   links = {
 *     "canonical" = "/admin/structure/automation-rule/{automation_rule}",
 *     "add-form" = "/admin/structure/automation-rule/add",
 *     "edit-form" = "/admin/structure/automation-rule/{automation_rule}/edit",
 *     "delete-form" = "/admin/structure/automation-rule/{automation_rule}/delete",
 *     "collection" = "/admin/structure/automation-rule",
 *   },
 * )
 */
class AutomationRule extends ContentEntityBase {

  use EntityChangedTrait;

  /**
   * {@inheritdoc}
   */
  public static function baseFieldDefinitions(EntityTypeInterface $entity_type) {
    $fields = parent::baseFieldDefinitions($entity_type);

    // Name of the automation rule.
    $fields['name'] = BaseFieldDefinition::create('string')
      ->setLabel(t('Name'))
      ->setDescription(t('The name of the automation rule.'))
      ->setRequired(TRUE)
      ->setSettings([
        'max_length' => 255,
        'text_processing' => 0,
      ])
      ->setDisplayOptions('view', [
        'label' => 'hidden',
        'type' => 'string',
        'weight' => -5,
      ])
      ->setDisplayOptions('form', [
        'type' => 'string_textfield',
        'weight' => -5,
      ])
      ->setDisplayConfigurable('form', TRUE)
      ->setDisplayConfigurable('view', TRUE);

    // Board reference - the board this rule belongs to (stored as node).
    $fields['board_id'] = BaseFieldDefinition::create('entity_reference')
      ->setLabel(t('Board'))
      ->setDescription(t('The board this automation rule belongs to.'))
      ->setSetting('target_type', 'node')
      ->setSetting('handler_settings', ['target_bundles' => ['board' => 'board']])
      ->setRequired(TRUE)
      ->setDisplayOptions('view', [
        'label' => 'above',
        'type' => 'entity_reference_label',
        'weight' => 0,
      ])
      ->setDisplayOptions('form', [
        'type' => 'entity_reference_autocomplete',
        'weight' => 0,
      ])
      ->setDisplayConfigurable('form', TRUE)
      ->setDisplayConfigurable('view', TRUE);

    // Trigger type - what event triggers this rule.
    $fields['trigger_type'] = BaseFieldDefinition::create('string')
      ->setLabel(t('Trigger Type'))
      ->setDescription(t('The type of event that triggers this rule.'))
      ->setRequired(TRUE)
      ->setSettings([
        'max_length' => 64,
      ])
      ->setDisplayOptions('view', [
        'label' => 'above',
        'type' => 'string',
        'weight' => 1,
      ])
      ->setDisplayOptions('form', [
        'type' => 'string_textfield',
        'weight' => 1,
      ])
      ->setDisplayConfigurable('form', TRUE)
      ->setDisplayConfigurable('view', TRUE);

    // Trigger configuration - JSON config for the trigger.
    $fields['trigger_config'] = BaseFieldDefinition::create('string_long')
      ->setLabel(t('Trigger Configuration'))
      ->setDescription(t('JSON configuration for the trigger.'))
      ->setDefaultValue('{}')
      ->setDisplayOptions('view', [
        'label' => 'above',
        'type' => 'string',
        'weight' => 2,
      ])
      ->setDisplayOptions('form', [
        'type' => 'string_textarea',
        'weight' => 2,
      ])
      ->setDisplayConfigurable('form', TRUE)
      ->setDisplayConfigurable('view', TRUE);

    // Conditions - JSON array of conditions that must be met.
    $fields['conditions'] = BaseFieldDefinition::create('string_long')
      ->setLabel(t('Conditions'))
      ->setDescription(t('JSON array of conditions that must be met.'))
      ->setDefaultValue('[]')
      ->setDisplayOptions('view', [
        'label' => 'above',
        'type' => 'string',
        'weight' => 3,
      ])
      ->setDisplayOptions('form', [
        'type' => 'string_textarea',
        'weight' => 3,
      ])
      ->setDisplayConfigurable('form', TRUE)
      ->setDisplayConfigurable('view', TRUE);

    // Actions - JSON array of actions to perform.
    $fields['actions'] = BaseFieldDefinition::create('string_long')
      ->setLabel(t('Actions'))
      ->setDescription(t('JSON array of actions to perform.'))
      ->setDefaultValue('[]')
      ->setRequired(TRUE)
      ->setDisplayOptions('view', [
        'label' => 'above',
        'type' => 'string',
        'weight' => 4,
      ])
      ->setDisplayOptions('form', [
        'type' => 'string_textarea',
        'weight' => 4,
      ])
      ->setDisplayConfigurable('form', TRUE)
      ->setDisplayConfigurable('view', TRUE);

    // Whether the rule is enabled.
    $fields['enabled'] = BaseFieldDefinition::create('boolean')
      ->setLabel(t('Enabled'))
      ->setDescription(t('Whether this automation rule is enabled.'))
      ->setDefaultValue(TRUE)
      ->setDisplayOptions('view', [
        'label' => 'above',
        'type' => 'boolean',
        'weight' => 5,
      ])
      ->setDisplayOptions('form', [
        'type' => 'boolean_checkbox',
        'weight' => 5,
      ])
      ->setDisplayConfigurable('form', TRUE)
      ->setDisplayConfigurable('view', TRUE);

    // Whether the rule should apply retroactively to existing cards.
    $fields['apply_retroactively'] = BaseFieldDefinition::create('boolean')
      ->setLabel(t('Apply Retroactively'))
      ->setDescription(t('Whether this rule should apply to existing cards when created or enabled.'))
      ->setDefaultValue(TRUE)
      ->setDisplayOptions('view', [
        'label' => 'above',
        'type' => 'boolean',
        'weight' => 5,
      ])
      ->setDisplayOptions('form', [
        'type' => 'boolean_checkbox',
        'weight' => 5,
      ])
      ->setDisplayConfigurable('form', TRUE)
      ->setDisplayConfigurable('view', TRUE);

    // Whether retroactive execution has been completed.
    $fields['retroactive_executed'] = BaseFieldDefinition::create('boolean')
      ->setLabel(t('Retroactive Executed'))
      ->setDescription(t('Whether the retroactive execution has been completed.'))
      ->setDefaultValue(FALSE)
      ->setDisplayConfigurable('view', TRUE);

    // User who created the rule.
    $fields['author_id'] = BaseFieldDefinition::create('entity_reference')
      ->setLabel(t('Author'))
      ->setDescription(t('The user who created this automation rule.'))
      ->setSetting('target_type', 'user')
      ->setDefaultValueCallback(static::class . '::getDefaultAuthorId')
      ->setDisplayOptions('view', [
        'label' => 'above',
        'type' => 'entity_reference_label',
        'weight' => 6,
      ])
      ->setDisplayOptions('form', [
        'type' => 'entity_reference_autocomplete',
        'weight' => 6,
      ])
      ->setDisplayConfigurable('form', TRUE)
      ->setDisplayConfigurable('view', TRUE);

    // Execution count.
    $fields['execution_count'] = BaseFieldDefinition::create('integer')
      ->setLabel(t('Execution Count'))
      ->setDescription(t('Number of times this rule has been executed.'))
      ->setDefaultValue(0)
      ->setDisplayOptions('view', [
        'label' => 'above',
        'type' => 'number_integer',
        'weight' => 7,
      ])
      ->setDisplayConfigurable('view', TRUE);

    // Last executed timestamp.
    $fields['last_executed'] = BaseFieldDefinition::create('timestamp')
      ->setLabel(t('Last Executed'))
      ->setDescription(t('When this rule was last executed.'))
      ->setDisplayOptions('view', [
        'label' => 'above',
        'type' => 'timestamp',
        'weight' => 8,
      ])
      ->setDisplayConfigurable('view', TRUE);

    // Next scheduled run timestamp (for scheduled triggers).
    $fields['next_scheduled_run'] = BaseFieldDefinition::create('timestamp')
      ->setLabel(t('Next Scheduled Run'))
      ->setDescription(t('When this rule should next run (for scheduled triggers).'))
      ->setDisplayOptions('view', [
        'label' => 'above',
        'type' => 'timestamp',
        'weight' => 9,
      ])
      ->setDisplayConfigurable('view', TRUE);

    // Created timestamp.
    $fields['created'] = BaseFieldDefinition::create('created')
      ->setLabel(t('Created'))
      ->setDescription(t('The time when the automation rule was created.'));

    // Changed timestamp.
    $fields['changed'] = BaseFieldDefinition::create('changed')
      ->setLabel(t('Changed'))
      ->setDescription(t('The time when the automation rule was last updated.'));

    return $fields;
  }

  /**
   * Default value callback for 'author_id' base field definition.
   *
   * @return array
   *   An array of default values.
   */
  public static function getDefaultAuthorId() {
    return [\Drupal::currentUser()->id()];
  }

  /**
   * Gets the trigger configuration as an array.
   *
   * @return array
   *   The trigger configuration.
   */
  public function getTriggerConfig(): array {
    $value = $this->get('trigger_config')->value;
    return $value ? json_decode($value, TRUE) ?? [] : [];
  }

  /**
   * Sets the trigger configuration from an array.
   *
   * @param array $config
   *   The trigger configuration.
   *
   * @return $this
   */
  public function setTriggerConfig(array $config): static {
    $this->set('trigger_config', json_encode($config));
    return $this;
  }

  /**
   * Gets the conditions as an array.
   *
   * @return array
   *   The conditions.
   */
  public function getConditions(): array {
    $value = $this->get('conditions')->value;
    return $value ? json_decode($value, TRUE) ?? [] : [];
  }

  /**
   * Sets the conditions from an array.
   *
   * @param array $conditions
   *   The conditions.
   *
   * @return $this
   */
  public function setConditions(array $conditions): static {
    $this->set('conditions', json_encode($conditions));
    return $this;
  }

  /**
   * Gets the actions as an array.
   *
   * @return array
   *   The actions.
   */
  public function getActions(): array {
    $value = $this->get('actions')->value;
    return $value ? json_decode($value, TRUE) ?? [] : [];
  }

  /**
   * Sets the actions from an array.
   *
   * @param array $actions
   *   The actions.
   *
   * @return $this
   */
  public function setActions(array $actions): static {
    $this->set('actions', json_encode($actions));
    return $this;
  }

  /**
   * Checks if this rule is enabled.
   *
   * @return bool
   *   TRUE if enabled, FALSE otherwise.
   */
  public function isEnabled(): bool {
    return (bool) $this->get('enabled')->value;
  }

  /**
   * Checks if this rule should apply retroactively.
   *
   * @return bool
   *   TRUE if should apply retroactively, FALSE otherwise.
   */
  public function shouldApplyRetroactively(): bool {
    return (bool) $this->get('apply_retroactively')->value;
  }

  /**
   * Checks if retroactive execution has been completed.
   *
   * @return bool
   *   TRUE if retroactive execution completed, FALSE otherwise.
   */
  public function isRetroactiveExecuted(): bool {
    return (bool) $this->get('retroactive_executed')->value;
  }

  /**
   * Marks retroactive execution as completed.
   *
   * @return $this
   */
  public function markRetroactiveExecuted(): static {
    $this->set('retroactive_executed', TRUE);
    return $this;
  }

  /**
   * Resets retroactive execution flag (for when rule is re-enabled).
   *
   * @return $this
   */
  public function resetRetroactiveExecuted(): static {
    $this->set('retroactive_executed', FALSE);
    return $this;
  }

  /**
   * Records an execution of this rule.
   *
   * @return $this
   */
  public function recordExecution(): static {
    $count = (int) $this->get('execution_count')->value;
    $this->set('execution_count', $count + 1);
    $this->set('last_executed', \Drupal::time()->getRequestTime());
    return $this;
  }

  /**
   * Checks if this is a scheduled automation.
   *
   * @return bool
   *   TRUE if this is a scheduled automation.
   */
  public function isScheduled(): bool {
    return $this->get('trigger_type')->value === 'scheduled';
  }

  /**
   * Gets the next scheduled run timestamp.
   *
   * @return int|null
   *   The timestamp or NULL if not set.
   */
  public function getNextScheduledRun(): ?int {
    $value = $this->get('next_scheduled_run')->value;
    return $value ? (int) $value : NULL;
  }

  /**
   * Sets the next scheduled run timestamp.
   *
   * @param int $timestamp
   *   The timestamp.
   *
   * @return $this
   */
  public function setNextScheduledRun(int $timestamp): static {
    $this->set('next_scheduled_run', $timestamp);
    return $this;
  }

  /**
   * Calculates and sets the next scheduled run based on trigger config.
   *
   * @return $this
   */
  public function calculateNextScheduledRun(): static {
    if (!$this->isScheduled()) {
      return $this;
    }

    $config = $this->getTriggerConfig();
    $interval = $config['interval'] ?? 'daily';
    $time = $config['time'] ?? '09:00';
    $now = \Drupal::time()->getRequestTime();

    // Parse the time of day.
    [$hour, $minute] = array_map('intval', explode(':', $time));

    switch ($interval) {
      case 'hourly':
        // Next hour at the configured minute.
        $next = strtotime(date('Y-m-d H:00:00', $now) . " +1 hour +{$minute} minutes");
        break;

      case 'daily':
        // Today or tomorrow at the configured time.
        $today = strtotime(date('Y-m-d', $now) . " {$hour}:{$minute}:00");
        $next = $today > $now ? $today : $today + 86400;
        break;

      case 'weekly':
        // Find the next matching day of week.
        $days = $config['days_of_week'] ?? [1]; // Default to Monday.
        $next = $this->findNextWeeklyRun($now, $hour, $minute, $days);
        break;

      case 'monthly':
        // The configured day of month at the configured time.
        $day = $config['day_of_month'] ?? 1;
        $next = $this->findNextMonthlyRun($now, $hour, $minute, $day);
        break;

      default:
        // Default to daily.
        $today = strtotime(date('Y-m-d', $now) . " {$hour}:{$minute}:00");
        $next = $today > $now ? $today : $today + 86400;
    }

    $this->setNextScheduledRun($next);
    return $this;
  }

  /**
   * Finds the next weekly run timestamp.
   *
   * @param int $now
   *   Current timestamp.
   * @param int $hour
   *   Hour of day.
   * @param int $minute
   *   Minute of hour.
   * @param array $days
   *   Days of week (1=Monday, 7=Sunday).
   *
   * @return int
   *   The next run timestamp.
   */
  protected function findNextWeeklyRun(int $now, int $hour, int $minute, array $days): int {
    $current_day = (int) date('N', $now); // 1=Monday, 7=Sunday.
    $today_time = strtotime(date('Y-m-d', $now) . " {$hour}:{$minute}:00");

    // Sort days and ensure they're valid.
    $days = array_filter($days, fn($d) => $d >= 1 && $d <= 7);
    sort($days);

    // Check today first if it's a scheduled day and time hasn't passed.
    if (in_array($current_day, $days, TRUE) && $today_time > $now) {
      return $today_time;
    }

    // Find next scheduled day.
    foreach ($days as $day) {
      if ($day > $current_day) {
        $diff = $day - $current_day;
        return $today_time + ($diff * 86400);
      }
    }

    // Wrap around to next week's first scheduled day.
    $diff = 7 - $current_day + $days[0];
    return $today_time + ($diff * 86400);
  }

  /**
   * Finds the next monthly run timestamp.
   *
   * @param int $now
   *   Current timestamp.
   * @param int $hour
   *   Hour of day.
   * @param int $minute
   *   Minute of hour.
   * @param int $day
   *   Day of month.
   *
   * @return int
   *   The next run timestamp.
   */
  protected function findNextMonthlyRun(int $now, int $hour, int $minute, int $day): int {
    $current_month = (int) date('n', $now);
    $current_year = (int) date('Y', $now);

    // Try this month.
    $this_month = mktime($hour, $minute, 0, $current_month, $day, $current_year);
    if ($this_month > $now) {
      return $this_month;
    }

    // Try next month.
    $next_month = $current_month + 1;
    $next_year = $current_year;
    if ($next_month > 12) {
      $next_month = 1;
      $next_year++;
    }

    return mktime($hour, $minute, 0, $next_month, $day, $next_year);
  }

}
