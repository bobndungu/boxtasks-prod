<?php

namespace Drupal\boxtasks_role\Service;

use Drupal\Core\Entity\EntityTypeManagerInterface;
use Drupal\Core\Session\AccountProxyInterface;
use Drupal\node\NodeInterface;

/**
 * Service to check user permissions based on workspace roles.
 */
class PermissionChecker {

  /**
   * The entity type manager.
   *
   * @var \Drupal\Core\Entity\EntityTypeManagerInterface
   */
  protected $entityTypeManager;

  /**
   * The current user.
   *
   * @var \Drupal\Core\Session\AccountProxyInterface
   */
  protected $currentUser;

  /**
   * Cache for user roles by workspace.
   *
   * @var array
   */
  protected $roleCache = [];

  /**
   * Constructs a PermissionChecker object.
   *
   * @param \Drupal\Core\Entity\EntityTypeManagerInterface $entity_type_manager
   *   The entity type manager.
   * @param \Drupal\Core\Session\AccountProxyInterface $current_user
   *   The current user.
   */
  public function __construct(EntityTypeManagerInterface $entity_type_manager, AccountProxyInterface $current_user) {
    $this->entityTypeManager = $entity_type_manager;
    $this->currentUser = $current_user;
  }

  /**
   * Get user's role for a workspace.
   *
   * @param string $workspace_id
   *   The workspace UUID.
   * @param int|null $user_id
   *   The user ID (defaults to current user).
   *
   * @return \Drupal\node\NodeInterface|null
   *   The workspace_role node or NULL if not found.
   */
  public function getUserRoleForWorkspace(string $workspace_id, ?int $user_id = NULL): ?NodeInterface {
    $user_id = $user_id ?? $this->currentUser->id();
    $cache_key = "{$workspace_id}:{$user_id}";

    if (isset($this->roleCache[$cache_key])) {
      return $this->roleCache[$cache_key];
    }

    $storage = $this->entityTypeManager->getStorage('node');

    // Find the workspace node by UUID.
    // Use accessCheck(FALSE) because this service IS the access control
    // mechanism. It must not be subject to its own access checking, which
    // depends on the node_access table that can be temporarily empty during
    // node_access_rebuild().
    $workspace_ids = $storage->getQuery()
      ->accessCheck(FALSE)
      ->condition('type', 'workspace')
      ->condition('uuid', $workspace_id)
      ->range(0, 1)
      ->execute();

    if (empty($workspace_ids)) {
      $this->roleCache[$cache_key] = NULL;
      return NULL;
    }

    $workspace = $storage->load(reset($workspace_ids));
    if (!$workspace) {
      $this->roleCache[$cache_key] = NULL;
      return NULL;
    }

    // Find user's member_role for this workspace.
    // Use accessCheck(FALSE) for the same reason as above.
    $member_role_ids = $storage->getQuery()
      ->accessCheck(FALSE)
      ->condition('type', 'member_role')
      ->condition('field_member_role_workspace', $workspace->id())
      ->condition('field_member_role_user', $user_id)
      ->range(0, 1)
      ->execute();

    $member_role = !empty($member_role_ids) ? $storage->load(reset($member_role_ids)) : NULL;

    if ($member_role && $member_role->hasField('field_member_role_role')) {
      $role_ref = $member_role->get('field_member_role_role')->entity;
      if ($role_ref) {
        $this->roleCache[$cache_key] = $role_ref;
        return $role_ref;
      }
    }

    // All workspaces require explicit membership via member_role.
    // No fallback to default role - users must be explicitly added as members.
    $this->roleCache[$cache_key] = NULL;
    return NULL;
  }

  /**
   * Check if the current user is a super admin.
   *
   * Super admin is:
   * - uid = 1, OR
   * - user has 'administer nodes' permission
   *
   * @param int|null $user_id
   *   Optional user ID to check. Defaults to current user.
   *
   * @return bool
   *   TRUE if the user is a super admin.
   */
  public function isSuperAdmin(?int $user_id = NULL): bool {
    $user_id = $user_id ?? $this->currentUser->id();

    // uid = 1 is always super admin.
    if ((int) $user_id === 1) {
      return TRUE;
    }

    // Check if user has 'administer nodes' permission.
    // If checking current user, use the proxy directly.
    if ($user_id === (int) $this->currentUser->id()) {
      return $this->currentUser->hasPermission('administer nodes');
    }

    // For other users, load the user entity and check.
    $user_storage = $this->entityTypeManager->getStorage('user');
    $user = $user_storage->load($user_id);
    if ($user) {
      return $user->hasPermission('administer nodes');
    }

    return FALSE;
  }

  /**
   * Check if user can view a board.
   *
   * Board access requires:
   * 1. Super admins can always view
   * 2. User must be a workspace member (have member_role for the workspace)
   * 3. For private boards, user must also be in board's member list
   *
   * @param \Drupal\node\NodeInterface $board
   *   The board node.
   * @param int|null $user_id
   *   The user ID (defaults to current user).
   *
   * @return bool
   *   TRUE if user can view the board.
   */
  public function canViewBoard(NodeInterface $board, ?int $user_id = NULL): bool {
    $user_id = $user_id ?? $this->currentUser->id();

    // Super admins can always view.
    if ($this->isSuperAdmin($user_id)) {
      return TRUE;
    }

    // Get workspace from board.
    if (!$board->hasField('field_board_workspace')) {
      return FALSE;
    }

    $workspace_ref = $board->get('field_board_workspace')->entity;
    if (!$workspace_ref) {
      return FALSE;
    }

    // User must be a workspace member (have member_role).
    $role = $this->getUserRoleForWorkspace($workspace_ref->uuid(), $user_id);
    if (!$role) {
      return FALSE; // Not a workspace member = no access.
    }

    // Check board visibility setting.
    $board_visibility = 'workspace';
    if ($board->hasField('field_board_visibility') && !$board->get('field_board_visibility')->isEmpty()) {
      $board_visibility = $board->get('field_board_visibility')->value;
    }

    // Private boards: only board members or owner can view.
    if ($board_visibility === 'private') {
      $is_board_member = $this->isUserBoardMember($board, $user_id);
      return $is_board_member || (int) $board->getOwnerId() === (int) $user_id;
    }

    // Workspace-visible boards: all workspace members can view.
    // User already has a role (checked above), so they can view.
    return TRUE;
  }

  /**
   * Check if user is a member of a specific board.
   *
   * @param \Drupal\node\NodeInterface $board
   *   The board node.
   * @param int $user_id
   *   The user ID.
   *
   * @return bool
   *   TRUE if user is in the board's member list.
   */
  protected function isUserBoardMember(NodeInterface $board, int $user_id): bool {
    if (!$board->hasField('field_board_members')) {
      return FALSE;
    }

    foreach ($board->get('field_board_members') as $member_ref) {
      if ($member_ref->target_id && (int) $member_ref->target_id === $user_id) {
        return TRUE;
      }
    }

    return FALSE;
  }

  /**
   * Check if user can view a workspace.
   *
   * @param \Drupal\node\NodeInterface $workspace
   *   The workspace node.
   * @param int|null $user_id
   *   The user ID (defaults to current user).
   *
   * @return bool
   *   TRUE if user can view the workspace.
   */
  public function canViewWorkspace(NodeInterface $workspace, ?int $user_id = NULL): bool {
    $user_id = $user_id ?? $this->currentUser->id();

    // Super admins can always view.
    if ($this->isSuperAdmin($user_id)) {
      return TRUE;
    }

    $role = $this->getUserRoleForWorkspace($workspace->uuid(), $user_id);
    if (!$role) {
      return FALSE; // No role = no access.
    }

    // Check workspace view permission.
    $perm_level = $role->get('field_perm_workspace_view')->value ?? 'none';

    if ($perm_level === 'any') {
      return TRUE;
    }

    if ($perm_level === 'own') {
      // Check if user is the workspace author.
      return (int) $workspace->getOwnerId() === (int) $user_id;
    }

    return FALSE;
  }

  /**
   * Check a specific permission for an entity.
   *
   * @param string $permission
   *   The permission field name (e.g., 'field_perm_board_view').
   * @param string $workspace_id
   *   The workspace UUID.
   * @param int|null $owner_id
   *   The entity owner ID (for 'own' permission checks).
   * @param int|null $user_id
   *   The user ID (defaults to current user).
   *
   * @return bool
   *   TRUE if user has the permission.
   */
  public function checkPermission(string $permission, string $workspace_id, ?int $owner_id = NULL, ?int $user_id = NULL): bool {
    $user_id = $user_id ?? $this->currentUser->id();

    // Super admins can do everything.
    if ($this->isSuperAdmin($user_id)) {
      return TRUE;
    }

    $role = $this->getUserRoleForWorkspace($workspace_id, $user_id);
    if (!$role) {
      return FALSE;
    }

    if (!$role->hasField($permission)) {
      // Permission field doesn't exist - deny for security.
      return FALSE;
    }

    $perm_level = $role->get($permission)->value ?? 'none';

    if ($perm_level === 'any') {
      return TRUE;
    }

    if ($perm_level === 'own' && $owner_id !== NULL) {
      return (int) $owner_id === (int) $user_id;
    }

    return FALSE;
  }

  /**
   * Filter a list of boards to only those the user can view.
   *
   * @param array $boards
   *   Array of board nodes.
   * @param int|null $user_id
   *   The user ID (defaults to current user).
   *
   * @return array
   *   Filtered array of boards.
   */
  public function filterViewableBoards(array $boards, ?int $user_id = NULL): array {
    return array_filter($boards, function ($board) use ($user_id) {
      return $this->canViewBoard($board, $user_id);
    });
  }

  /**
   * Filter a list of workspaces to only those the user can view.
   *
   * @param array $workspaces
   *   Array of workspace nodes.
   * @param int|null $user_id
   *   The user ID (defaults to current user).
   *
   * @return array
   *   Filtered array of workspaces.
   */
  public function filterViewableWorkspaces(array $workspaces, ?int $user_id = NULL): array {
    return array_filter($workspaces, function ($workspace) use ($user_id) {
      return $this->canViewWorkspace($workspace, $user_id);
    });
  }

}
