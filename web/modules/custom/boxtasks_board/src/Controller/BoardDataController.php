<?php

namespace Drupal\boxtasks_board\Controller;

use Drupal\boxtasks_role\Service\PermissionChecker;
use Drupal\Core\Controller\ControllerBase;
use Drupal\Core\Entity\EntityTypeManagerInterface;
use Drupal\Core\Session\AccountInterface;
use Drupal\user\Entity\User;
use Symfony\Component\DependencyInjection\ContainerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * Controller for fetching complete board data in a single API call.
 */
class BoardDataController extends ControllerBase {

  /**
   * The entity type manager.
   *
   * @var \Drupal\Core\Entity\EntityTypeManagerInterface
   */
  protected $entityTypeManager;

  /**
   * The current user.
   *
   * @var \Drupal\Core\Session\AccountInterface
   */
  protected $currentUser;

  /**
   * The authenticated user from OAuth token.
   *
   * @var \Drupal\user\Entity\User|null
   */
  protected $authenticatedUser;

  /**
   * The permission checker service.
   *
   * @var \Drupal\boxtasks_role\Service\PermissionChecker
   */
  protected $permissionChecker;

  /**
   * Constructs a BoardDataController object.
   */
  public function __construct(EntityTypeManagerInterface $entity_type_manager, AccountInterface $current_user, PermissionChecker $permission_checker) {
    $this->entityTypeManager = $entity_type_manager;
    $this->currentUser = $current_user;
    $this->permissionChecker = $permission_checker;
  }

  /**
   * {@inheritdoc}
   */
  public static function create(ContainerInterface $container) {
    return new static(
      $container->get('entity_type.manager'),
      $container->get('current_user'),
      $container->get('boxtasks_role.permission_checker')
    );
  }

  /**
   * Authenticate user from OAuth Bearer token (JWT).
   *
   * @param \Symfony\Component\HttpFoundation\Request $request
   *   The request object.
   *
   * @return \Drupal\user\Entity\User|null
   *   The authenticated user or NULL.
   */
  protected function authenticateFromOAuthToken(Request $request): ?User {
    $auth_header = $request->headers->get('Authorization', '');
    if (!preg_match('/^Bearer\s+(.+)$/i', $auth_header, $matches)) {
      return NULL;
    }

    $jwt = $matches[1];

    // Parse the JWT token to extract claims.
    // JWT format: header.payload.signature
    $parts = explode('.', $jwt);
    if (count($parts) !== 3) {
      return NULL;
    }

    // Decode the payload (second part).
    $payload = json_decode(base64_decode(strtr($parts[1], '-_', '+/')), TRUE);
    if (!$payload) {
      return NULL;
    }

    // Check if token is expired.
    if (isset($payload['exp']) && $payload['exp'] < time()) {
      return NULL;
    }

    // Get user ID from the 'sub' claim (subject).
    if (!isset($payload['sub'])) {
      return NULL;
    }

    $user_id = (int) $payload['sub'];
    if ($user_id <= 0) {
      return NULL;
    }

    return User::load($user_id);
  }

  /**
   * Get complete board data in a single response.
   *
   * @param string $board_id
   *   The board UUID.
   * @param \Symfony\Component\HttpFoundation\Request $request
   *   The request object.
   *
   * @return \Symfony\Component\HttpFoundation\JsonResponse
   *   JSON response with all board data.
   */
  public function getBoardData(string $board_id, Request $request): JsonResponse {
    // Check authentication - first try current_user, then OAuth token.
    $this->authenticatedUser = NULL;
    if (!$this->currentUser->isAnonymous()) {
      $this->authenticatedUser = User::load($this->currentUser->id());
    }
    else {
      // Try to authenticate via OAuth token.
      $this->authenticatedUser = $this->authenticateFromOAuthToken($request);
    }

    if (!$this->authenticatedUser) {
      throw new AccessDeniedHttpException('Authentication required.');
    }

    $node_storage = $this->entityTypeManager->getStorage('node');
    $user_storage = $this->entityTypeManager->getStorage('user');
    $term_storage = $this->entityTypeManager->getStorage('taxonomy_term');

    // Load the board.
    // Use accessCheck(FALSE) because this controller performs its own access
    // checks via PermissionChecker. Node access table may be temporarily
    // unavailable during node_access_rebuild() in deployments.
    $board_ids = $node_storage->getQuery()
      ->accessCheck(FALSE)
      ->condition('type', 'board')
      ->condition('uuid', $board_id)
      ->range(0, 1)
      ->execute();

    if (empty($board_ids)) {
      throw new NotFoundHttpException('Board not found.');
    }

    $board = $node_storage->load(reset($board_ids));

    // Check if user has permission to view this board.
    // This verifies workspace membership and board visibility settings.
    if (!$this->permissionChecker->canViewBoard($board, (int) $this->authenticatedUser->id())) {
      throw new AccessDeniedHttpException('Access denied to this board.');
    }

    // Build board data.
    $board_data = $this->formatBoard($board);

    // Get workspace ID for member lookup.
    $workspace_id = NULL;
    if ($board->hasField('field_board_workspace') && !$board->get('field_board_workspace')->isEmpty()) {
      $workspace_ref = $board->get('field_board_workspace')->first();
      if ($workspace_ref && $workspace_ref->entity) {
        $workspace_id = $workspace_ref->entity->uuid();
      }
    }

    // Fetch lists - access already verified via canViewBoard() above.
    $list_ids_query = $node_storage->getQuery()
      ->accessCheck(FALSE)
      ->condition('type', 'board_list')
      ->condition('field_list_board', $board->id())
      ->condition('field_list_archived', 0)
      ->execute();
    $lists = !empty($list_ids_query) ? $node_storage->loadMultiple($list_ids_query) : [];

    // Sort lists by position.
    uasort($lists, function ($a, $b) {
      $pos_a = $a->hasField('field_list_position') ? (int) $a->get('field_list_position')->value : 0;
      $pos_b = $b->hasField('field_list_position') ? (int) $b->get('field_list_position')->value : 0;
      return $pos_a <=> $pos_b;
    });

    $lists_data = [];
    $list_ids = [];
    foreach ($lists as $list) {
      $lists_data[] = $this->formatList($list);
      $list_ids[] = $list->id();
    }

    // Fetch all cards for these lists.
    $cards_data = [];
    if (!empty($list_ids)) {
      $cards = $node_storage->getQuery()
        ->accessCheck(FALSE)
        ->condition('type', 'card')
        ->condition('field_card_list', $list_ids, 'IN')
        ->condition('field_card_archived', 0)
        ->sort('field_card_position', 'ASC')
        ->execute();

      if (!empty($cards)) {
        $card_entities = $node_storage->loadMultiple($cards);
        foreach ($card_entities as $card) {
          $cards_data[] = $this->formatCard($card);
        }
      }
    }

    // Fetch custom field definitions for this board.
    $cf_ids = $node_storage->getQuery()
      ->accessCheck(FALSE)
      ->condition('type', 'custom_field_definition')
      ->condition('field_customfield_board', $board->id())
      ->execute();
    $custom_fields = !empty($cf_ids) ? $node_storage->loadMultiple($cf_ids) : [];

    $custom_field_defs = [];
    $custom_field_ids = [];
    foreach ($custom_fields as $cf) {
      $custom_field_defs[] = $this->formatCustomFieldDefinition($cf);
      $custom_field_ids[] = $cf->id();
    }

    // Fetch custom field values for all cards.
    $custom_field_values = [];
    if (!empty($custom_field_ids) && !empty($cards_data)) {
      $card_nids = array_column($cards_data, 'drupal_id');
      if (!empty($card_nids)) {
        $cfv_query = $node_storage->getQuery()
          ->accessCheck(FALSE)
          ->condition('type', 'card_custom_field_value')
          ->condition('field_cfv_card', $card_nids, 'IN')
          ->execute();

        if (!empty($cfv_query)) {
          $cfv_entities = $node_storage->loadMultiple($cfv_query);
          foreach ($cfv_entities as $cfv) {
            $custom_field_values[] = $this->formatCustomFieldValue($cfv);
          }
        }
      }
    }

    // Fetch board members based on member setup preference.
    $members = [];
    $member_setup = 'inherit';
    if ($board->hasField('field_board_member_setup') && !$board->get('field_board_member_setup')->isEmpty()) {
      $member_setup = $board->get('field_board_member_setup')->value;
    }

    // Get board admin IDs for role determination.
    $board_admin_ids = [];
    if ($board->hasField('field_board_admins')) {
      foreach ($board->get('field_board_admins') as $admin_ref) {
        if ($admin_ref->entity) {
          $board_admin_ids[] = $admin_ref->entity->uuid();
        }
      }
    }

    // Get board owner ID - owner is always considered admin.
    $board_owner_id = NULL;
    $board_owner = $board->getOwner();
    if ($board_owner) {
      $board_owner_id = $board_owner->uuid();
    }

    if ($member_setup === 'just_me') {
      // Only the board owner (skip if super admin).
      if ($board_owner && !$this->isSuperAdmin($board_owner)) {
        $members[] = $this->formatUserWithRole($board_owner, TRUE);
      }
    }
    elseif ($member_setup === 'custom' && $board->hasField('field_board_members')) {
      // Use custom board members.
      foreach ($board->get('field_board_members') as $member_ref) {
        if ($member_ref->entity) {
          $user = $member_ref->entity;
          // Skip super admins from member list.
          if ($this->isSuperAdmin($user)) {
            continue;
          }
          $is_admin = in_array($user->uuid(), $board_admin_ids) || $user->uuid() === $board_owner_id;
          $members[] = $this->formatUserWithRole($user, $is_admin);
        }
      }
    }
    else {
      // Default: inherit from workspace.
      // Get members from member_role nodes instead of field_workspace_members.
      if ($workspace_id) {
        $ws_ids = $node_storage->getQuery()
          ->accessCheck(FALSE)
          ->condition('type', 'workspace')
          ->condition('uuid', $workspace_id)
          ->range(0, 1)
          ->execute();

        if (!empty($ws_ids)) {
          $workspace = $node_storage->load(reset($ws_ids));
          $workspace_nid = $workspace->id();

          // Query member_role nodes for this workspace.
          $mr_ids = $node_storage->getQuery()
            ->accessCheck(FALSE)
            ->condition('type', 'member_role')
            ->condition('field_member_role_workspace', $workspace_nid)
            ->execute();
          $member_roles = !empty($mr_ids) ? $node_storage->loadMultiple($mr_ids) : [];

          // Track which users we've added to avoid duplicates.
          $added_user_ids = [];

          foreach ($member_roles as $member_role) {
            if (!$member_role->hasField('field_member_role_user') || $member_role->get('field_member_role_user')->isEmpty()) {
              continue;
            }
            $user = $member_role->get('field_member_role_user')->entity;
            if (!$user) {
              continue;
            }

            // Skip super admins from member list.
            if ($this->isSuperAdmin($user)) {
              continue;
            }

            // Skip if already added.
            if (in_array($user->id(), $added_user_ids)) {
              continue;
            }
            $added_user_ids[] = $user->id();

            // Check if user has admin role by checking their role's permissions.
            $is_admin = FALSE;
            if ($member_role->hasField('field_member_role_role') && !$member_role->get('field_member_role_role')->isEmpty()) {
              $role = $member_role->get('field_member_role_role')->entity;
              if ($role && $role->hasField('field_perm_member_manage')) {
                $perm_value = $role->get('field_perm_member_manage')->value;
                $is_admin = ($perm_value === 'any');
              }
            }

            $members[] = $this->formatUserWithRole($user, $is_admin);
          }

          // Also add workspace owner as admin (skip if super admin).
          if ($workspace->hasField('field_workspace_owner') && !$workspace->get('field_workspace_owner')->isEmpty()) {
            $owner = $workspace->get('field_workspace_owner')->entity;
            if ($owner && !$this->isSuperAdmin($owner) && !in_array($owner->id(), $added_user_ids)) {
              $owner_data = $this->formatUserWithRole($owner, TRUE);
              array_unshift($members, $owner_data);
            }
          }
        }
      }
    }

    // Fetch taxonomy terms (departments and clients).
    $departments = [];
    $department_terms = $term_storage->loadByProperties(['vid' => 'department']);
    foreach ($department_terms as $term) {
      $departments[] = [
        'id' => $term->uuid(),
        'name' => $term->label(),
        'drupal_id' => (int) $term->id(),
      ];
    }

    $clients = [];
    $client_terms = $term_storage->loadByProperties(['vid' => 'client']);
    foreach ($client_terms as $term) {
      $clients[] = [
        'id' => $term->uuid(),
        'name' => $term->label(),
        'drupal_id' => (int) $term->id(),
      ];
    }

    // Build complete response.
    $response_data = [
      'board' => $board_data,
      'lists' => $lists_data,
      'cards' => $cards_data,
      'customFieldDefinitions' => $custom_field_defs,
      'customFieldValues' => $custom_field_values,
      'members' => $members,
      'departments' => $departments,
      'clients' => $clients,
    ];

    $response = new JsonResponse($response_data);
    $response->headers->set('Cache-Control', 'private, max-age=0');

    return $response;
  }

  /**
   * Format board entity to array.
   */
  protected function formatBoard($board): array {
    $workspace_id = NULL;
    if ($board->hasField('field_board_workspace') && !$board->get('field_board_workspace')->isEmpty()) {
      $workspace_ref = $board->get('field_board_workspace')->first();
      if ($workspace_ref && $workspace_ref->entity) {
        $workspace_id = $workspace_ref->entity->uuid();
      }
    }

    // Get member setup preference.
    $member_setup = 'inherit';
    if ($board->hasField('field_board_member_setup') && !$board->get('field_board_member_setup')->isEmpty()) {
      $member_setup = $board->get('field_board_member_setup')->value;
    }

    return [
      'id' => $board->uuid(),
      'title' => $board->label(),
      'description' => $board->hasField('field_board_description') ? $board->get('field_board_description')->value : '',
      'workspaceId' => $workspace_id,
      'color' => $board->hasField('field_board_color') ? $board->get('field_board_color')->value : NULL,
      'isStarred' => $board->hasField('field_board_starred') ? (bool) $board->get('field_board_starred')->value : FALSE,
      'memberSetup' => $member_setup,
      'drupal_id' => (int) $board->id(),
    ];
  }

  /**
   * Format list entity to array.
   */
  protected function formatList($list): array {
    $board_id = NULL;
    if ($list->hasField('field_list_board') && !$list->get('field_list_board')->isEmpty()) {
      $board_ref = $list->get('field_list_board')->first();
      if ($board_ref && $board_ref->entity) {
        $board_id = $board_ref->entity->uuid();
      }
    }

    return [
      'id' => $list->uuid(),
      'title' => $list->label(),
      'boardId' => $board_id,
      'position' => $list->hasField('field_list_position') ? (int) $list->get('field_list_position')->value : 0,
      'archived' => $list->hasField('field_list_archived') ? (bool) $list->get('field_list_archived')->value : FALSE,
      'drupal_id' => (int) $list->id(),
    ];
  }

  /**
   * Format card entity to array.
   */
  protected function formatCard($card): array {
    $list_id = NULL;
    if ($card->hasField('field_card_list') && !$card->get('field_card_list')->isEmpty()) {
      $list_ref = $card->get('field_card_list')->first();
      if ($list_ref && $list_ref->entity) {
        $list_id = $list_ref->entity->uuid();
      }
    }

    // Get author ID (card creator).
    $author_id = NULL;
    $owner = $card->getOwner();
    if ($owner) {
      $author_id = $owner->uuid();
    }

    // Get assignees (members).
    $assignees = [];
    if ($card->hasField('field_card_members')) {
      foreach ($card->get('field_card_members') as $assignee_ref) {
        if ($assignee_ref->entity) {
          $assignees[] = $this->formatUser($assignee_ref->entity);
        }
      }
    }

    // Get watchers.
    $watchers = [];
    if ($card->hasField('field_card_watchers')) {
      foreach ($card->get('field_card_watchers') as $watcher_ref) {
        if ($watcher_ref->entity) {
          $watchers[] = $this->formatUser($watcher_ref->entity);
        }
      }
    }

    // Get labels.
    $labels = [];
    if ($card->hasField('field_card_labels')) {
      foreach ($card->get('field_card_labels') as $label) {
        $labels[] = $label->value;
      }
    }

    // Get department.
    $department_id = NULL;
    if ($card->hasField('field_card_department') && !$card->get('field_card_department')->isEmpty()) {
      $dept_ref = $card->get('field_card_department')->first();
      if ($dept_ref && $dept_ref->entity) {
        $department_id = $dept_ref->entity->uuid();
      }
    }

    // Get client.
    $client_id = NULL;
    if ($card->hasField('field_card_client') && !$card->get('field_card_client')->isEmpty()) {
      $client_ref = $card->get('field_card_client')->first();
      if ($client_ref && $client_ref->entity) {
        $client_id = $client_ref->entity->uuid();
      }
    }

    // Get start date.
    $start_date = NULL;
    $start_date_field = $card->hasField('field_start_date') ? 'field_start_date' : 'field_card_start_date';
    if ($card->hasField($start_date_field) && !$card->get($start_date_field)->isEmpty()) {
      $start_date = $card->get($start_date_field)->value;
    }

    // Get due date.
    $due_date = NULL;
    $due_date_field = $card->hasField('field_card_due_date') ? 'field_card_due_date' : 'field_due_date';
    if ($card->hasField($due_date_field) && !$card->get($due_date_field)->isEmpty()) {
      $due_date = $card->get($due_date_field)->value;
    }

    // Get approval status.
    $is_approved = FALSE;
    $approved_by = NULL;
    $approved_at = NULL;
    if ($card->hasField('field_card_approved') && !$card->get('field_card_approved')->isEmpty()) {
      $is_approved = (bool) $card->get('field_card_approved')->value;
    }
    if ($card->hasField('field_card_approved_by') && !$card->get('field_card_approved_by')->isEmpty()) {
      $approver = $card->get('field_card_approved_by')->entity;
      if ($approver) {
        $display_name = $approver->getDisplayName();
        if ($approver->hasField('field_display_name') && !$approver->get('field_display_name')->isEmpty()) {
          $display_name = $approver->get('field_display_name')->value;
        }
        $approved_by = [
          'id' => $approver->uuid(),
          'name' => $display_name,
          'email' => $approver->getEmail(),
        ];
      }
    }
    if ($card->hasField('field_card_approved_at') && !$card->get('field_card_approved_at')->isEmpty()) {
      $approved_at = $card->get('field_card_approved_at')->value . 'Z';
    }

    // Get rejection status.
    $is_rejected = FALSE;
    $rejected_by = NULL;
    $rejected_at = NULL;
    if ($card->hasField('field_card_rejected') && !$card->get('field_card_rejected')->isEmpty()) {
      $is_rejected = (bool) $card->get('field_card_rejected')->value;
    }
    if ($card->hasField('field_card_rejected_by') && !$card->get('field_card_rejected_by')->isEmpty()) {
      $rejecter = $card->get('field_card_rejected_by')->entity;
      if ($rejecter) {
        $display_name = $rejecter->getDisplayName();
        if ($rejecter->hasField('field_display_name') && !$rejecter->get('field_display_name')->isEmpty()) {
          $display_name = $rejecter->get('field_display_name')->value;
        }
        $rejected_by = [
          'id' => $rejecter->uuid(),
          'name' => $display_name,
          'email' => $rejecter->getEmail(),
        ];
      }
    }
    if ($card->hasField('field_card_rejected_at') && !$card->get('field_card_rejected_at')->isEmpty()) {
      $rejected_at = $card->get('field_card_rejected_at')->value . 'Z';
    }

    return [
      'id' => $card->uuid(),
      'title' => $card->label(),
      'description' => $card->hasField('field_card_description') ? $card->get('field_card_description')->value : '',
      'listId' => $list_id,
      'position' => $card->hasField('field_card_position') ? (int) $card->get('field_card_position')->value : 0,
      'archived' => $card->hasField('field_card_archived') ? (bool) $card->get('field_card_archived')->value : FALSE,
      'completed' => $card->hasField('field_card_completed') ? (bool) $card->get('field_card_completed')->value : FALSE,
      'startDate' => $start_date,
      'dueDate' => $due_date,
      'priority' => $card->hasField('field_card_priority') ? $card->get('field_card_priority')->value : NULL,
      'labels' => $labels,
      'assignees' => $assignees,
      'watchers' => $watchers,
      'departmentId' => $department_id,
      'clientId' => $client_id,
      'estimatedHours' => $card->hasField('field_card_estimated_hours') ? (float) $card->get('field_card_estimated_hours')->value : NULL,
      'authorId' => $author_id,
      'isApproved' => $is_approved,
      'approvedBy' => $approved_by,
      'approvedAt' => $approved_at,
      'isRejected' => $is_rejected,
      'rejectedBy' => $rejected_by,
      'rejectedAt' => $rejected_at,
      'drupal_id' => (int) $card->id(),
    ];
  }

  /**
   * Check if a user is a super admin (should be hidden from member lists).
   *
   * Super admin is specifically uid = 1 only.
   * Having administrator role does NOT make someone a super admin.
   *
   * @param mixed $user
   *   The user entity.
   *
   * @return bool
   *   TRUE if the user is a super admin (uid = 1).
   */
  protected function isSuperAdmin($user): bool {
    // Super admin is ONLY uid = 1
    return (int) $user->id() === 1;
  }

  /**
   * Format user entity to array.
   */
  protected function formatUser($user): array {
    $display_name = $user->getDisplayName();
    if ($user->hasField('field_display_name') && !$user->get('field_display_name')->isEmpty()) {
      $display_name = $user->get('field_display_name')->value;
    }

    return [
      'id' => $user->uuid(),
      'displayName' => $display_name,
      'email' => $user->getEmail(),
      'drupal_id' => (int) $user->id(),
    ];
  }

  /**
   * Format user entity to array with role information.
   */
  protected function formatUserWithRole($user, bool $is_admin): array {
    $display_name = $user->getDisplayName();
    if ($user->hasField('field_display_name') && !$user->get('field_display_name')->isEmpty()) {
      $display_name = $user->get('field_display_name')->value;
    }

    return [
      'id' => $user->uuid(),
      'displayName' => $display_name,
      'email' => $user->getEmail(),
      'drupal_id' => (int) $user->id(),
      'isAdmin' => $is_admin,
    ];
  }

  /**
   * Format custom field definition to array.
   */
  protected function formatCustomFieldDefinition($cf): array {
    $board_id = NULL;
    if ($cf->hasField('field_customfield_board') && !$cf->get('field_customfield_board')->isEmpty()) {
      $board_ref = $cf->get('field_customfield_board')->first();
      if ($board_ref && $board_ref->entity) {
        $board_id = $board_ref->entity->uuid();
      }
    }

    $options = [];
    if ($cf->hasField('field_customfield_options') && !$cf->get('field_customfield_options')->isEmpty()) {
      $options_value = $cf->get('field_customfield_options')->value;
      if ($options_value) {
        $decoded = json_decode($options_value, TRUE);
        if (is_array($decoded)) {
          $options = $decoded;
        }
      }
    }

    return [
      'id' => $cf->uuid(),
      'name' => $cf->label(),
      'type' => $cf->hasField('field_customfield_type') ? $cf->get('field_customfield_type')->value : 'text',
      'boardId' => $board_id,
      'options' => $options,
      'required' => $cf->hasField('field_customfield_required') ? (bool) $cf->get('field_customfield_required')->value : FALSE,
      'drupal_id' => (int) $cf->id(),
    ];
  }

  /**
   * Format custom field value to array.
   */
  protected function formatCustomFieldValue($cfv): array {
    $card_id = NULL;
    if ($cfv->hasField('field_cfv_card') && !$cfv->get('field_cfv_card')->isEmpty()) {
      $card_ref = $cfv->get('field_cfv_card')->first();
      if ($card_ref && $card_ref->entity) {
        $card_id = $card_ref->entity->uuid();
      }
    }

    $definition_id = NULL;
    if ($cfv->hasField('field_cfv_definition') && !$cfv->get('field_cfv_definition')->isEmpty()) {
      $definition_ref = $cfv->get('field_cfv_definition')->first();
      if ($definition_ref && $definition_ref->entity) {
        $definition_id = $definition_ref->entity->uuid();
      }
    }

    return [
      'id' => $cfv->uuid(),
      'cardId' => $card_id,
      'definitionId' => $definition_id,
      'value' => $cfv->hasField('field_cfv_value') ? $cfv->get('field_cfv_value')->value : '',
      'drupal_id' => (int) $cfv->id(),
    ];
  }

}
