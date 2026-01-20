<?php

declare(strict_types=1);

namespace Drupal\boxtasks_api\Controller;

use Drupal\Core\Controller\ControllerBase;
use Drupal\Core\Entity\EntityTypeManagerInterface;
use Symfony\Component\DependencyInjection\ContainerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;

/**
 * Controller for workspace roles API endpoints.
 */
class WorkspaceRolesController extends ControllerBase {

  /**
   * The entity type manager.
   *
   * @var \Drupal\Core\Entity\EntityTypeManagerInterface
   */
  protected $entityTypeManager;

  /**
   * Constructs a WorkspaceRolesController object.
   *
   * @param \Drupal\Core\Entity\EntityTypeManagerInterface $entity_type_manager
   *   The entity type manager.
   */
  public function __construct(EntityTypeManagerInterface $entity_type_manager) {
    $this->entityTypeManager = $entity_type_manager;
  }

  /**
   * {@inheritdoc}
   */
  public static function create(ContainerInterface $container) {
    return new static(
      $container->get('entity_type.manager')
    );
  }

  /**
   * Returns workspace roles (global + workspace-specific).
   *
   * @param string $workspace_id
   *   The workspace UUID.
   *
   * @return \Symfony\Component\HttpFoundation\JsonResponse
   *   JSON response with role data.
   */
  public function getRoles(string $workspace_id): JsonResponse {
    $node_storage = $this->entityTypeManager->getStorage('node');

    // Load all workspace_role nodes without access check (we've verified user is authenticated via route)
    $query = $node_storage->getQuery()
      ->condition('type', 'workspace_role')
      ->condition('status', 1)
      ->accessCheck(FALSE)
      ->sort('title');

    $nids = $query->execute();
    $roles = $node_storage->loadMultiple($nids);

    $data = [];
    foreach ($roles as $role) {
      // Get workspace reference
      $role_workspace_id = NULL;
      if ($role->hasField('field_role_workspace') && !$role->get('field_role_workspace')->isEmpty()) {
        $workspace_ref = $role->get('field_role_workspace')->entity;
        if ($workspace_ref) {
          $role_workspace_id = $workspace_ref->uuid();
        }
      }

      // Only include global roles (no workspace) or roles for this specific workspace
      if ($role_workspace_id !== NULL && $role_workspace_id !== $workspace_id) {
        continue;
      }

      // Build role data matching the frontend WorkspaceRole interface
      $data[] = [
        'id' => $role->uuid(),
        'title' => $role->label(),
        'workspaceId' => $role_workspace_id,
        'isDefault' => (bool) ($role->hasField('field_role_is_default') ? $role->get('field_role_is_default')->value : FALSE),
        'permissions' => [
          // Card permissions
          'cardView' => $this->getFieldValue($role, 'field_perm_card_view', 'none'),
          'cardCreate' => $this->getFieldValue($role, 'field_perm_card_create', 'none'),
          'cardEdit' => $this->getFieldValue($role, 'field_perm_card_edit', 'none'),
          'cardDelete' => $this->getFieldValue($role, 'field_perm_card_delete', 'none'),
          'cardArchive' => $this->getFieldValue($role, 'field_perm_card_archive', 'own'),
          'cardMove' => $this->getFieldValue($role, 'field_perm_card_move', 'none'),
          // List permissions
          'listView' => $this->getFieldValue($role, 'field_perm_list_view', 'none'),
          'listCreate' => $this->getFieldValue($role, 'field_perm_list_create', 'none'),
          'listEdit' => $this->getFieldValue($role, 'field_perm_list_edit', 'none'),
          'listDelete' => $this->getFieldValue($role, 'field_perm_list_delete', 'none'),
          'listArchive' => $this->getFieldValue($role, 'field_perm_list_archive', 'own'),
          // Board permissions
          'boardView' => $this->getFieldValue($role, 'field_perm_board_view', 'none'),
          'boardCreate' => $this->getFieldValue($role, 'field_perm_board_create', 'none'),
          'boardEdit' => $this->getFieldValue($role, 'field_perm_board_edit', 'none'),
          'boardDelete' => $this->getFieldValue($role, 'field_perm_board_delete', 'none'),
          'boardArchive' => $this->getFieldValue($role, 'field_perm_board_archive', 'own'),
          // Workspace permissions
          'workspaceView' => $this->getFieldValue($role, 'field_perm_workspace_view', 'none'),
          'workspaceEdit' => $this->getFieldValue($role, 'field_perm_workspace_edit', 'none'),
          'workspaceDelete' => $this->getFieldValue($role, 'field_perm_workspace_delete', 'none'),
          'workspaceArchive' => $this->getFieldValue($role, 'field_perm_workspace_archive', 'none'),
          // Workspace member permissions
          'memberView' => $this->getFieldValue($role, 'field_perm_member_view', 'none'),
          'memberAdd' => $this->getFieldValue($role, 'field_perm_member_add', 'none'),
          'memberRemove' => $this->getFieldValue($role, 'field_perm_member_remove', 'none'),
          // Board member permissions
          'boardMemberView' => $this->getFieldValue($role, 'field_perm_board_member_view', 'none'),
          'boardMemberAdd' => $this->getFieldValue($role, 'field_perm_board_member_add', 'none'),
          'boardMemberRemove' => $this->getFieldValue($role, 'field_perm_board_member_remove', 'none'),
          'boardRoleView' => $this->getFieldValue($role, 'field_perm_board_role_view', 'none'),
          // Member management (deprecated)
          'memberManage' => $this->getFieldValue($role, 'field_perm_member_manage', 'none'),
          // Comment permissions
          'commentEdit' => $this->getFieldValue($role, 'field_perm_comment_edit', 'none'),
          'commentDelete' => $this->getFieldValue($role, 'field_perm_comment_delete', 'none'),
          'commentArchive' => $this->getFieldValue($role, 'field_perm_comment_archive', 'own'),
          // Report permissions
          'reportPerformance' => $this->getFieldValue($role, 'field_perm_report_performance', 'none'),
          'reportTasks' => $this->getFieldValue($role, 'field_perm_report_tasks', 'none'),
          'reportActivity' => $this->getFieldValue($role, 'field_perm_report_activity', 'none'),
          'reportWorkload' => $this->getFieldValue($role, 'field_perm_report_workload', 'none'),
          'reportExport' => $this->getFieldValue($role, 'field_perm_report_export', 'none'),
          // Admin page permissions
          'emailTemplatesManage' => $this->getFieldValue($role, 'field_perm_email_templates', 'none'),
          'userManagement' => $this->getFieldValue($role, 'field_perm_user_management', 'none'),
          'roleManagement' => $this->getFieldValue($role, 'field_perm_role_management', 'none'),
          'roleView' => $this->getFieldValue($role, 'field_perm_role_view', 'none'),
        ],
      ];
    }

    return new JsonResponse($data);
  }

  /**
   * Get field value with default.
   *
   * @param \Drupal\node\NodeInterface $node
   *   The node.
   * @param string $field_name
   *   The field name.
   * @param string $default
   *   Default value.
   *
   * @return string
   *   The field value or default.
   */
  protected function getFieldValue($node, string $field_name, string $default): string {
    if ($node->hasField($field_name) && !$node->get($field_name)->isEmpty()) {
      return $node->get($field_name)->value ?? $default;
    }
    return $default;
  }

}
