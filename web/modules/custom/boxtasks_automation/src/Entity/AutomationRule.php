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

}
