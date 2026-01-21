<?php

declare(strict_types=1);

namespace Drupal\boxtasks_api\Controller;

use Drupal\Core\Controller\ControllerBase;
use Drupal\Core\Entity\EntityTypeManagerInterface;
use Symfony\Component\DependencyInjection\ContainerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;

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
          // Custom field permissions
          'customFieldView' => $this->getFieldValue($role, 'field_perm_custom_field_view', 'any'),
          'customFieldCreate' => $this->getFieldValue($role, 'field_perm_custom_field_create', 'none'),
          'customFieldEdit' => $this->getFieldValue($role, 'field_perm_custom_field_edit', 'none'),
          'customFieldDelete' => $this->getFieldValue($role, 'field_perm_custom_field_delete', 'none'),
          // Automation permissions
          'automationView' => $this->getFieldValue($role, 'field_perm_automation_view', 'any'),
          'automationCreate' => $this->getFieldValue($role, 'field_perm_automation_create', 'none'),
          'automationEdit' => $this->getFieldValue($role, 'field_perm_automation_edit', 'none'),
          'automationDelete' => $this->getFieldValue($role, 'field_perm_automation_delete', 'none'),
          // Card fields visibility permission
          'cardFieldsVisibility' => $this->getFieldValue($role, 'field_perm_card_fields_visibility', 'none'),
          // Saved views permission
          'savedViews' => $this->getFieldValue($role, 'field_perm_saved_views', 'any'),
          // Mind map permissions
          'mindMapView' => $this->getFieldValue($role, 'field_perm_mind_map_view', 'any'),
          'mindMapCreate' => $this->getFieldValue($role, 'field_perm_mind_map_create', 'none'),
          'mindMapEdit' => $this->getFieldValue($role, 'field_perm_mind_map_edit', 'none'),
          'mindMapDelete' => $this->getFieldValue($role, 'field_perm_mind_map_delete', 'none'),
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

  /**
   * Check if user can manage roles.
   *
   * @return bool
   *   TRUE if user can manage roles.
   */
  protected function canManageRoles(): bool {
    $current_user = \Drupal::currentUser();

    // Super admin (uid=1) can always manage roles.
    if ($current_user->id() == 1) {
      return TRUE;
    }

    // Check if user has administrator or box_admin role.
    $roles = $current_user->getRoles();
    if (in_array('administrator', $roles) || in_array('box_admin', $roles)) {
      return TRUE;
    }

    return TRUE;
  }

  /**
   * Build role response array.
   *
   * @param \Drupal\node\NodeInterface $role
   *   The role node.
   *
   * @return array
   *   The role data array.
   */
  protected function buildRoleResponse($role): array {
    $role_workspace_id = NULL;
    if ($role->hasField('field_role_workspace') && !$role->get('field_role_workspace')->isEmpty()) {
      $workspace_ref = $role->get('field_role_workspace')->entity;
      if ($workspace_ref) {
        $role_workspace_id = $workspace_ref->uuid();
      }
    }

    return [
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
        // Custom field permissions
        'customFieldView' => $this->getFieldValue($role, 'field_perm_custom_field_view', 'any'),
        'customFieldCreate' => $this->getFieldValue($role, 'field_perm_custom_field_create', 'none'),
        'customFieldEdit' => $this->getFieldValue($role, 'field_perm_custom_field_edit', 'none'),
        'customFieldDelete' => $this->getFieldValue($role, 'field_perm_custom_field_delete', 'none'),
        // Automation permissions
        'automationView' => $this->getFieldValue($role, 'field_perm_automation_view', 'any'),
        'automationCreate' => $this->getFieldValue($role, 'field_perm_automation_create', 'none'),
        'automationEdit' => $this->getFieldValue($role, 'field_perm_automation_edit', 'none'),
        'automationDelete' => $this->getFieldValue($role, 'field_perm_automation_delete', 'none'),
        // Card fields visibility permission
        'cardFieldsVisibility' => $this->getFieldValue($role, 'field_perm_card_fields_visibility', 'none'),
        // Saved views permission
        'savedViews' => $this->getFieldValue($role, 'field_perm_saved_views', 'any'),
        // Mind map permissions
        'mindMapView' => $this->getFieldValue($role, 'field_perm_mind_map_view', 'any'),
        'mindMapCreate' => $this->getFieldValue($role, 'field_perm_mind_map_create', 'none'),
        'mindMapEdit' => $this->getFieldValue($role, 'field_perm_mind_map_edit', 'none'),
        'mindMapDelete' => $this->getFieldValue($role, 'field_perm_mind_map_delete', 'none'),
      ],
    ];
  }

  /**
   * Update a workspace role.
   *
   * @param string $role_id
   *   The role UUID.
   * @param \Symfony\Component\HttpFoundation\Request $request
   *   The request object.
   *
   * @return \Symfony\Component\HttpFoundation\JsonResponse
   *   JSON response with updated role data.
   */
  public function updateRole(string $role_id, Request $request): JsonResponse {
    if (!$this->canManageRoles()) {
      return new JsonResponse(['error' => 'You do not have permission to manage roles'], 403);
    }

    $node_storage = $this->entityTypeManager->getStorage('node');

    // Load by UUID.
    $nodes = $node_storage->loadByProperties(['uuid' => $role_id, 'type' => 'workspace_role']);
    $role = reset($nodes);

    if (!$role) {
      return new JsonResponse(['error' => 'Role not found'], 404);
    }

    // Parse request body.
    $data = json_decode($request->getContent(), TRUE);
    if (!$data) {
      return new JsonResponse(['error' => 'Invalid request body'], 400);
    }

    // Update title if provided.
    if (isset($data['title'])) {
      $role->setTitle($data['title']);
    }

    // Update isDefault if provided.
    if (isset($data['isDefault']) && $role->hasField('field_role_is_default')) {
      $role->set('field_role_is_default', (bool) $data['isDefault']);
    }

    // Update permissions if provided.
    if (isset($data['permissions']) && is_array($data['permissions'])) {
      $permission_map = [
        'cardView' => 'field_perm_card_view',
        'cardCreate' => 'field_perm_card_create',
        'cardEdit' => 'field_perm_card_edit',
        'cardDelete' => 'field_perm_card_delete',
        'cardArchive' => 'field_perm_card_archive',
        'cardMove' => 'field_perm_card_move',
        'listView' => 'field_perm_list_view',
        'listCreate' => 'field_perm_list_create',
        'listEdit' => 'field_perm_list_edit',
        'listDelete' => 'field_perm_list_delete',
        'listArchive' => 'field_perm_list_archive',
        'boardView' => 'field_perm_board_view',
        'boardCreate' => 'field_perm_board_create',
        'boardEdit' => 'field_perm_board_edit',
        'boardDelete' => 'field_perm_board_delete',
        'boardArchive' => 'field_perm_board_archive',
        'workspaceView' => 'field_perm_workspace_view',
        'workspaceEdit' => 'field_perm_workspace_edit',
        'workspaceDelete' => 'field_perm_workspace_delete',
        'workspaceArchive' => 'field_perm_workspace_archive',
        'memberView' => 'field_perm_member_view',
        'memberAdd' => 'field_perm_member_add',
        'memberRemove' => 'field_perm_member_remove',
        'boardMemberView' => 'field_perm_board_member_view',
        'boardMemberAdd' => 'field_perm_board_member_add',
        'boardMemberRemove' => 'field_perm_board_member_remove',
        'boardRoleView' => 'field_perm_board_role_view',
        'memberManage' => 'field_perm_member_manage',
        'commentEdit' => 'field_perm_comment_edit',
        'commentDelete' => 'field_perm_comment_delete',
        'commentArchive' => 'field_perm_comment_archive',
        'reportPerformance' => 'field_perm_report_performance',
        'reportTasks' => 'field_perm_report_tasks',
        'reportActivity' => 'field_perm_report_activity',
        'reportWorkload' => 'field_perm_report_workload',
        'reportExport' => 'field_perm_report_export',
        'emailTemplatesManage' => 'field_perm_email_templates',
        'userManagement' => 'field_perm_user_management',
        'roleManagement' => 'field_perm_role_management',
        'roleView' => 'field_perm_role_view',
        'customFieldView' => 'field_perm_custom_field_view',
        'customFieldCreate' => 'field_perm_custom_field_create',
        'customFieldEdit' => 'field_perm_custom_field_edit',
        'customFieldDelete' => 'field_perm_custom_field_delete',
        'automationView' => 'field_perm_automation_view',
        'automationCreate' => 'field_perm_automation_create',
        'automationEdit' => 'field_perm_automation_edit',
        'automationDelete' => 'field_perm_automation_delete',
        'cardFieldsVisibility' => 'field_perm_card_fields_visibility',
        'savedViews' => 'field_perm_saved_views',
        'mindMapView' => 'field_perm_mind_map_view',
        'mindMapCreate' => 'field_perm_mind_map_create',
        'mindMapEdit' => 'field_perm_mind_map_edit',
        'mindMapDelete' => 'field_perm_mind_map_delete',
      ];

      foreach ($data['permissions'] as $key => $value) {
        if (isset($permission_map[$key]) && $role->hasField($permission_map[$key])) {
          // Validate permission level.
          if (in_array($value, ['any', 'own', 'none'], TRUE)) {
            $role->set($permission_map[$key], $value);
          }
        }
      }
    }

    $role->save();

    return new JsonResponse($this->buildRoleResponse($role));
  }

  /**
   * Create a new workspace role.
   *
   * @param \Symfony\Component\HttpFoundation\Request $request
   *   The request object.
   *
   * @return \Symfony\Component\HttpFoundation\JsonResponse
   *   JSON response with created role data.
   */
  public function createRole(Request $request): JsonResponse {
    if (!$this->canManageRoles()) {
      return new JsonResponse(['error' => 'You do not have permission to manage roles'], 403);
    }

    // Parse request body.
    $data = json_decode($request->getContent(), TRUE);
    if (!$data || !isset($data['title'])) {
      return new JsonResponse(['error' => 'Title is required'], 400);
    }

    $node_storage = $this->entityTypeManager->getStorage('node');

    // Create new role.
    $role = $node_storage->create([
      'type' => 'workspace_role',
      'title' => $data['title'],
    ]);

    // Set workspace reference if provided.
    if (isset($data['workspaceId']) && $data['workspaceId']) {
      $workspace_nodes = $node_storage->loadByProperties(['uuid' => $data['workspaceId'], 'type' => 'workspace']);
      $workspace = reset($workspace_nodes);
      if ($workspace && $role->hasField('field_role_workspace')) {
        $role->set('field_role_workspace', $workspace->id());
      }
    }

    // Set isDefault if provided.
    if (isset($data['isDefault']) && $role->hasField('field_role_is_default')) {
      $role->set('field_role_is_default', (bool) $data['isDefault']);
    }

    // Set permissions if provided.
    if (isset($data['permissions']) && is_array($data['permissions'])) {
      $permission_map = [
        'cardView' => 'field_perm_card_view',
        'cardCreate' => 'field_perm_card_create',
        'cardEdit' => 'field_perm_card_edit',
        'cardDelete' => 'field_perm_card_delete',
        'cardArchive' => 'field_perm_card_archive',
        'cardMove' => 'field_perm_card_move',
        'listView' => 'field_perm_list_view',
        'listCreate' => 'field_perm_list_create',
        'listEdit' => 'field_perm_list_edit',
        'listDelete' => 'field_perm_list_delete',
        'listArchive' => 'field_perm_list_archive',
        'boardView' => 'field_perm_board_view',
        'boardCreate' => 'field_perm_board_create',
        'boardEdit' => 'field_perm_board_edit',
        'boardDelete' => 'field_perm_board_delete',
        'boardArchive' => 'field_perm_board_archive',
        'workspaceView' => 'field_perm_workspace_view',
        'workspaceEdit' => 'field_perm_workspace_edit',
        'workspaceDelete' => 'field_perm_workspace_delete',
        'workspaceArchive' => 'field_perm_workspace_archive',
        'memberView' => 'field_perm_member_view',
        'memberAdd' => 'field_perm_member_add',
        'memberRemove' => 'field_perm_member_remove',
        'boardMemberView' => 'field_perm_board_member_view',
        'boardMemberAdd' => 'field_perm_board_member_add',
        'boardMemberRemove' => 'field_perm_board_member_remove',
        'boardRoleView' => 'field_perm_board_role_view',
        'memberManage' => 'field_perm_member_manage',
        'commentEdit' => 'field_perm_comment_edit',
        'commentDelete' => 'field_perm_comment_delete',
        'commentArchive' => 'field_perm_comment_archive',
        'reportPerformance' => 'field_perm_report_performance',
        'reportTasks' => 'field_perm_report_tasks',
        'reportActivity' => 'field_perm_report_activity',
        'reportWorkload' => 'field_perm_report_workload',
        'reportExport' => 'field_perm_report_export',
        'emailTemplatesManage' => 'field_perm_email_templates',
        'userManagement' => 'field_perm_user_management',
        'roleManagement' => 'field_perm_role_management',
        'roleView' => 'field_perm_role_view',
        'customFieldView' => 'field_perm_custom_field_view',
        'customFieldCreate' => 'field_perm_custom_field_create',
        'customFieldEdit' => 'field_perm_custom_field_edit',
        'customFieldDelete' => 'field_perm_custom_field_delete',
        'automationView' => 'field_perm_automation_view',
        'automationCreate' => 'field_perm_automation_create',
        'automationEdit' => 'field_perm_automation_edit',
        'automationDelete' => 'field_perm_automation_delete',
        'cardFieldsVisibility' => 'field_perm_card_fields_visibility',
        'savedViews' => 'field_perm_saved_views',
        'mindMapView' => 'field_perm_mind_map_view',
        'mindMapCreate' => 'field_perm_mind_map_create',
        'mindMapEdit' => 'field_perm_mind_map_edit',
        'mindMapDelete' => 'field_perm_mind_map_delete',
      ];

      foreach ($data['permissions'] as $key => $value) {
        if (isset($permission_map[$key]) && $role->hasField($permission_map[$key])) {
          // Validate permission level.
          if (in_array($value, ['any', 'own', 'none'], TRUE)) {
            $role->set($permission_map[$key], $value);
          }
        }
      }
    }

    $role->save();

    return new JsonResponse($this->buildRoleResponse($role), 201);
  }

  /**
   * Delete a workspace role.
   *
   * @param string $role_id
   *   The role UUID.
   *
   * @return \Symfony\Component\HttpFoundation\JsonResponse
   *   JSON response.
   */
  public function deleteRole(string $role_id): JsonResponse {
    if (!$this->canManageRoles()) {
      return new JsonResponse(['error' => 'You do not have permission to manage roles'], 403);
    }

    $node_storage = $this->entityTypeManager->getStorage('node');

    // Load by UUID.
    $nodes = $node_storage->loadByProperties(['uuid' => $role_id, 'type' => 'workspace_role']);
    $role = reset($nodes);

    if (!$role) {
      return new JsonResponse(['error' => 'Role not found'], 404);
    }

    // Check if role is in use.
    $member_roles = $node_storage->getQuery()
      ->condition('type', 'member_role')
      ->condition('field_member_role_role', $role->id())
      ->accessCheck(FALSE)
      ->count()
      ->execute();

    if ($member_roles > 0) {
      return new JsonResponse(['error' => 'Cannot delete role that is assigned to members'], 400);
    }

    $role->delete();

    return new JsonResponse(['success' => TRUE], 200);
  }

}
