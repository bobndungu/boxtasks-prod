<?php

declare(strict_types=1);

namespace Drupal\boxtasks_api\Controller;

use Drupal\Core\Controller\ControllerBase;
use Drupal\Core\Entity\EntityTypeManagerInterface;
use Symfony\Component\DependencyInjection\ContainerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;

/**
 * Controller for custom field groups API endpoints.
 */
class FieldGroupsController extends ControllerBase {

  /**
   * The entity type manager.
   *
   * @var \Drupal\Core\Entity\EntityTypeManagerInterface
   */
  protected $entityTypeManager;

  /**
   * Constructs a FieldGroupsController object.
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
   * Returns field groups for a board or workspace.
   *
   * @param string $board_id
   *   The board UUID.
   *
   * @return \Symfony\Component\HttpFoundation\JsonResponse
   *   JSON response with field group data.
   */
  public function getGroups(string $board_id): JsonResponse {
    $node_storage = $this->entityTypeManager->getStorage('node');

    // Load the board to get its workspace
    $boards = $node_storage->loadByProperties(['uuid' => $board_id, 'type' => 'board']);
    $board = reset($boards);

    if (!$board) {
      return new JsonResponse(['error' => 'Board not found'], 404);
    }

    // Get workspace ID from board
    $workspace_id = NULL;
    if ($board->hasField('field_board_workspace') && !$board->get('field_board_workspace')->isEmpty()) {
      $workspace_ref = $board->get('field_board_workspace')->entity;
      if ($workspace_ref) {
        $workspace_id = $workspace_ref->id();
      }
    }

    // Query for field groups
    $query = $node_storage->getQuery()
      ->condition('type', 'custom_field_group')
      ->condition('status', 1)
      ->accessCheck(FALSE)
      ->sort('field_cfg_position');

    // Get groups for this board OR this workspace (with no board)
    $or = $query->orConditionGroup()
      ->condition('field_cfg_board', $board->id());

    if ($workspace_id) {
      $workspace_condition = $query->andConditionGroup()
        ->condition('field_cfg_workspace', $workspace_id)
        ->notExists('field_cfg_board');
      $or->condition($workspace_condition);
    }

    $query->condition($or);

    $nids = $query->execute();
    $groups = $node_storage->loadMultiple($nids);

    $data = [];
    foreach ($groups as $group) {
      $data[] = $this->buildGroupResponse($group);
    }

    return new JsonResponse($data);
  }

  /**
   * Create a new field group.
   *
   * @param \Symfony\Component\HttpFoundation\Request $request
   *   The request object.
   *
   * @return \Symfony\Component\HttpFoundation\JsonResponse
   *   JSON response with created group data.
   */
  public function createGroup(Request $request): JsonResponse {
    $data = json_decode($request->getContent(), TRUE);
    if (!$data || !isset($data['title'])) {
      return new JsonResponse(['error' => 'Title is required'], 400);
    }

    $node_storage = $this->entityTypeManager->getStorage('node');

    // Create the group
    $group = $node_storage->create([
      'type' => 'custom_field_group',
      'title' => $data['title'],
    ]);

    // Set board reference if provided
    if (isset($data['boardId']) && $data['boardId']) {
      $boards = $node_storage->loadByProperties(['uuid' => $data['boardId'], 'type' => 'board']);
      $board = reset($boards);
      if ($board && $group->hasField('field_cfg_board')) {
        $group->set('field_cfg_board', $board->id());
      }
    }

    // Set workspace reference if provided
    if (isset($data['workspaceId']) && $data['workspaceId']) {
      $workspaces = $node_storage->loadByProperties(['uuid' => $data['workspaceId'], 'type' => 'workspace']);
      $workspace = reset($workspaces);
      if ($workspace && $group->hasField('field_cfg_workspace')) {
        $group->set('field_cfg_workspace', $workspace->id());
      }
    }

    // Set roles if provided
    if (isset($data['roleIds']) && is_array($data['roleIds']) && $group->hasField('field_cfg_roles')) {
      $role_ids = [];
      foreach ($data['roleIds'] as $role_uuid) {
        $roles = $node_storage->loadByProperties(['uuid' => $role_uuid, 'type' => 'workspace_role']);
        $role = reset($roles);
        if ($role) {
          $role_ids[] = $role->id();
        }
      }
      $group->set('field_cfg_roles', $role_ids);
    }

    // Set position if provided
    if (isset($data['position']) && $group->hasField('field_cfg_position')) {
      $group->set('field_cfg_position', (int) $data['position']);
    }

    $group->save();

    return new JsonResponse($this->buildGroupResponse($group), 201);
  }

  /**
   * Update a field group.
   *
   * @param string $group_id
   *   The group UUID.
   * @param \Symfony\Component\HttpFoundation\Request $request
   *   The request object.
   *
   * @return \Symfony\Component\HttpFoundation\JsonResponse
   *   JSON response with updated group data.
   */
  public function updateGroup(string $group_id, Request $request): JsonResponse {
    $node_storage = $this->entityTypeManager->getStorage('node');

    // Load by UUID
    $groups = $node_storage->loadByProperties(['uuid' => $group_id, 'type' => 'custom_field_group']);
    $group = reset($groups);

    if (!$group) {
      return new JsonResponse(['error' => 'Field group not found'], 404);
    }

    $data = json_decode($request->getContent(), TRUE);
    if (!$data) {
      return new JsonResponse(['error' => 'Invalid request body'], 400);
    }

    // Update title if provided
    if (isset($data['title'])) {
      $group->setTitle($data['title']);
    }

    // Update roles if provided
    if (isset($data['roleIds']) && is_array($data['roleIds']) && $group->hasField('field_cfg_roles')) {
      $role_ids = [];
      foreach ($data['roleIds'] as $role_uuid) {
        $roles = $node_storage->loadByProperties(['uuid' => $role_uuid, 'type' => 'workspace_role']);
        $role = reset($roles);
        if ($role) {
          $role_ids[] = $role->id();
        }
      }
      $group->set('field_cfg_roles', $role_ids);
    }

    // Update position if provided
    if (isset($data['position']) && $group->hasField('field_cfg_position')) {
      $group->set('field_cfg_position', (int) $data['position']);
    }

    $group->save();

    return new JsonResponse($this->buildGroupResponse($group));
  }

  /**
   * Delete a field group.
   *
   * @param string $group_id
   *   The group UUID.
   *
   * @return \Symfony\Component\HttpFoundation\JsonResponse
   *   JSON response.
   */
  public function deleteGroup(string $group_id): JsonResponse {
    $node_storage = $this->entityTypeManager->getStorage('node');

    // Load by UUID
    $groups = $node_storage->loadByProperties(['uuid' => $group_id, 'type' => 'custom_field_group']);
    $group = reset($groups);

    if (!$group) {
      return new JsonResponse(['error' => 'Field group not found'], 404);
    }

    // Check if group has fields assigned
    $fields_in_group = $node_storage->getQuery()
      ->condition('type', 'custom_field_definition')
      ->condition('field_cf_group', $group->id())
      ->accessCheck(FALSE)
      ->count()
      ->execute();

    if ($fields_in_group > 0) {
      return new JsonResponse(['error' => 'Cannot delete group that has fields assigned. Remove fields from group first.'], 400);
    }

    $group->delete();

    return new JsonResponse(['success' => TRUE], 200);
  }

  /**
   * Build group response array.
   *
   * @param \Drupal\node\NodeInterface $group
   *   The group node.
   *
   * @return array
   *   The group data array.
   */
  protected function buildGroupResponse($group): array {
    $board_id = NULL;
    if ($group->hasField('field_cfg_board') && !$group->get('field_cfg_board')->isEmpty()) {
      $board_ref = $group->get('field_cfg_board')->entity;
      if ($board_ref) {
        $board_id = $board_ref->uuid();
      }
    }

    $workspace_id = NULL;
    if ($group->hasField('field_cfg_workspace') && !$group->get('field_cfg_workspace')->isEmpty()) {
      $workspace_ref = $group->get('field_cfg_workspace')->entity;
      if ($workspace_ref) {
        $workspace_id = $workspace_ref->uuid();
      }
    }

    $role_ids = [];
    if ($group->hasField('field_cfg_roles') && !$group->get('field_cfg_roles')->isEmpty()) {
      foreach ($group->get('field_cfg_roles') as $role_item) {
        if ($role_item->entity) {
          $role_ids[] = $role_item->entity->uuid();
        }
      }
    }

    $position = 0;
    if ($group->hasField('field_cfg_position') && !$group->get('field_cfg_position')->isEmpty()) {
      $position = (int) $group->get('field_cfg_position')->value;
    }

    return [
      'id' => $group->uuid(),
      'title' => $group->label(),
      'boardId' => $board_id,
      'workspaceId' => $workspace_id,
      'roleIds' => $role_ids,
      'position' => $position,
    ];
  }

}
