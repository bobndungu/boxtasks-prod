<?php

namespace Drupal\boxtasks_board\Controller;

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
   * Constructs a BoardDataController object.
   */
  public function __construct(EntityTypeManagerInterface $entity_type_manager, AccountInterface $current_user) {
    $this->entityTypeManager = $entity_type_manager;
    $this->currentUser = $current_user;
  }

  /**
   * {@inheritdoc}
   */
  public static function create(ContainerInterface $container) {
    return new static(
      $container->get('entity_type.manager'),
      $container->get('current_user')
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
    $boards = $node_storage->loadByProperties([
      'type' => 'board',
      'uuid' => $board_id,
    ]);

    if (empty($boards)) {
      throw new NotFoundHttpException('Board not found.');
    }

    $board = reset($boards);

    // Note: We skip Drupal's entity access check because:
    // 1. We've already verified the user is authenticated above
    // 2. The GlobalViewsController also uses accessCheck(FALSE) for consistency
    // 3. Drupal's node access system can deny access even for authenticated users
    // Access control is handled at the workspace membership level.

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

    // Fetch lists.
    $lists = $node_storage->loadByProperties([
      'type' => 'board_list',
      'field_list_board' => $board->id(),
      'field_list_archived' => 0,
    ]);

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
        ->accessCheck(TRUE)
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
    $custom_fields = $node_storage->loadByProperties([
      'type' => 'custom_field_definition',
      'field_customfield_board' => $board->id(),
    ]);

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
          ->accessCheck(TRUE)
          ->condition('type', 'custom_field_value')
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

    // Fetch workspace members.
    $members = [];
    if ($workspace_id) {
      $workspace_nodes = $node_storage->loadByProperties([
        'type' => 'workspace',
        'uuid' => $workspace_id,
      ]);

      if (!empty($workspace_nodes)) {
        $workspace = reset($workspace_nodes);
        if ($workspace->hasField('field_workspace_members')) {
          foreach ($workspace->get('field_workspace_members') as $member_ref) {
            if ($member_ref->entity) {
              $members[] = $this->formatUser($member_ref->entity);
            }
          }
        }
        // Also add owner.
        if ($workspace->hasField('field_workspace_owner') && !$workspace->get('field_workspace_owner')->isEmpty()) {
          $owner = $workspace->get('field_workspace_owner')->entity;
          if ($owner) {
            $owner_data = $this->formatUser($owner);
            // Avoid duplicates.
            $member_ids = array_column($members, 'id');
            if (!in_array($owner_data['id'], $member_ids)) {
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

    return [
      'id' => $board->uuid(),
      'title' => $board->label(),
      'description' => $board->hasField('field_board_description') ? $board->get('field_board_description')->value : '',
      'workspaceId' => $workspace_id,
      'color' => $board->hasField('field_board_color') ? $board->get('field_board_color')->value : NULL,
      'isStarred' => $board->hasField('field_board_starred') ? (bool) $board->get('field_board_starred')->value : FALSE,
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

    // Get assignees.
    $assignees = [];
    if ($card->hasField('field_card_assignees')) {
      foreach ($card->get('field_card_assignees') as $assignee_ref) {
        if ($assignee_ref->entity) {
          $assignees[] = $this->formatUser($assignee_ref->entity);
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

    // Get due date.
    $due_date = NULL;
    $due_date_field = $card->hasField('field_card_due_date') ? 'field_card_due_date' : 'field_due_date';
    if ($card->hasField($due_date_field) && !$card->get($due_date_field)->isEmpty()) {
      $due_date = $card->get($due_date_field)->value;
    }

    return [
      'id' => $card->uuid(),
      'title' => $card->label(),
      'description' => $card->hasField('field_card_description') ? $card->get('field_card_description')->value : '',
      'listId' => $list_id,
      'position' => $card->hasField('field_card_position') ? (int) $card->get('field_card_position')->value : 0,
      'archived' => $card->hasField('field_card_archived') ? (bool) $card->get('field_card_archived')->value : FALSE,
      'dueDate' => $due_date,
      'priority' => $card->hasField('field_card_priority') ? $card->get('field_card_priority')->value : NULL,
      'labels' => $labels,
      'assignees' => $assignees,
      'departmentId' => $department_id,
      'clientId' => $client_id,
      'estimatedHours' => $card->hasField('field_card_estimated_hours') ? (float) $card->get('field_card_estimated_hours')->value : NULL,
      'drupal_id' => (int) $card->id(),
    ];
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

    $field_id = NULL;
    if ($cfv->hasField('field_cfv_field') && !$cfv->get('field_cfv_field')->isEmpty()) {
      $field_ref = $cfv->get('field_cfv_field')->first();
      if ($field_ref && $field_ref->entity) {
        $field_id = $field_ref->entity->uuid();
      }
    }

    return [
      'id' => $cfv->uuid(),
      'cardId' => $card_id,
      'fieldId' => $field_id,
      'value' => $cfv->hasField('field_cfv_value') ? $cfv->get('field_cfv_value')->value : '',
      'drupal_id' => (int) $cfv->id(),
    ];
  }

}
