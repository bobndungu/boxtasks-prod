<?php

namespace Drupal\boxtasks_automation;

use Drupal\Core\Access\AccessResult;
use Drupal\Core\Entity\EntityAccessControlHandler;
use Drupal\Core\Entity\EntityInterface;
use Drupal\Core\Session\AccountInterface;

/**
 * Access controller for the Automation Rule entity.
 */
class AutomationRuleAccessControlHandler extends EntityAccessControlHandler {

  /**
   * {@inheritdoc}
   */
  protected function checkAccess(EntityInterface $entity, $operation, AccountInterface $account) {
    /** @var \Drupal\boxtasks_automation\Entity\AutomationRule $entity */

    // Admin can do anything.
    if ($account->hasPermission('administer automation rules')) {
      return AccessResult::allowed()->cachePerPermissions();
    }

    // Check if user is the author.
    $is_author = $entity->get('author_id')->target_id == $account->id();

    switch ($operation) {
      case 'view':
        // Authors can view their own rules.
        // Also need to check board membership, but simplified for now.
        if ($is_author) {
          return AccessResult::allowed()->cachePerUser()->addCacheableDependency($entity);
        }
        return AccessResult::allowedIfHasPermission($account, 'view automation rules');

      case 'update':
        // Authors can update their own rules.
        if ($is_author) {
          return AccessResult::allowed()->cachePerUser()->addCacheableDependency($entity);
        }
        return AccessResult::allowedIfHasPermission($account, 'edit automation rules');

      case 'delete':
        // Authors can delete their own rules.
        if ($is_author) {
          return AccessResult::allowed()->cachePerUser()->addCacheableDependency($entity);
        }
        return AccessResult::allowedIfHasPermission($account, 'delete automation rules');

      default:
        return AccessResult::neutral();
    }
  }

  /**
   * {@inheritdoc}
   */
  protected function checkCreateAccess(AccountInterface $account, array $context, $entity_bundle = NULL) {
    return AccessResult::allowedIfHasPermissions($account, [
      'administer automation rules',
      'create automation rules',
    ], 'OR');
  }

}
