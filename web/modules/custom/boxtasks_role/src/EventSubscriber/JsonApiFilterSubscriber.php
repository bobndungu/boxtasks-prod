<?php

namespace Drupal\boxtasks_role\EventSubscriber;

use Drupal\boxtasks_role\Service\PermissionChecker;
use Drupal\Core\Entity\EntityTypeManagerInterface;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use Symfony\Component\HttpKernel\Event\ResponseEvent;
use Symfony\Component\HttpKernel\KernelEvents;

/**
 * Filters JSON:API responses based on workspace role permissions.
 */
class JsonApiFilterSubscriber implements EventSubscriberInterface {

  /**
   * The permission checker service.
   *
   * @var \Drupal\boxtasks_role\Service\PermissionChecker
   */
  protected $permissionChecker;

  /**
   * The entity type manager.
   *
   * @var \Drupal\Core\Entity\EntityTypeManagerInterface
   */
  protected $entityTypeManager;

  /**
   * Constructs a JsonApiFilterSubscriber object.
   *
   * @param \Drupal\boxtasks_role\Service\PermissionChecker $permission_checker
   *   The permission checker service.
   * @param \Drupal\Core\Entity\EntityTypeManagerInterface $entity_type_manager
   *   The entity type manager.
   */
  public function __construct(PermissionChecker $permission_checker, EntityTypeManagerInterface $entity_type_manager) {
    $this->permissionChecker = $permission_checker;
    $this->entityTypeManager = $entity_type_manager;
  }

  /**
   * {@inheritdoc}
   */
  public static function getSubscribedEvents() {
    // Run after JSON:API has built the response.
    $events[KernelEvents::RESPONSE][] = ['onResponse', -100];
    return $events;
  }

  /**
   * Filters JSON:API responses for boards, workspaces, notifications, and activities.
   *
   * @param \Symfony\Component\HttpKernel\Event\ResponseEvent $event
   *   The response event.
   */
  public function onResponse(ResponseEvent $event) {
    $request = $event->getRequest();
    $response = $event->getResponse();

    // Only process JSON:API responses.
    $path = $request->getPathInfo();
    if (strpos($path, '/jsonapi/') !== 0) {
      return;
    }

    // Only process successful responses.
    if ($response->getStatusCode() !== 200) {
      return;
    }

    $content_type = $response->headers->get('Content-Type');
    if (strpos($content_type, 'application/vnd.api+json') === FALSE) {
      return;
    }

    // Check which type of resource this is.
    $is_board_collection = strpos($path, '/jsonapi/node/board') !== FALSE;
    $is_workspace_collection = strpos($path, '/jsonapi/node/workspace') !== FALSE;
    $is_notification_collection = strpos($path, '/jsonapi/node/notification') !== FALSE;
    $is_activity_collection = strpos($path, '/jsonapi/node/activity') !== FALSE;
    $is_card_collection = strpos($path, '/jsonapi/node/card') !== FALSE && strpos($path, '/jsonapi/node/card_') === FALSE;
    $is_list_collection = strpos($path, '/jsonapi/node/list') !== FALSE;
    $is_card_comment_collection = strpos($path, '/jsonapi/node/card_comment') !== FALSE;
    $is_checklist_collection = strpos($path, '/jsonapi/node/checklist') !== FALSE && strpos($path, '/jsonapi/node/checklist_item') === FALSE;
    $is_checklist_item_collection = strpos($path, '/jsonapi/node/checklist_item') !== FALSE;

    $handled_types = $is_board_collection || $is_workspace_collection || $is_notification_collection ||
                     $is_activity_collection || $is_card_collection || $is_list_collection ||
                     $is_card_comment_collection || $is_checklist_collection || $is_checklist_item_collection;

    if (!$handled_types) {
      return;
    }

    $content = $response->getContent();
    $data = json_decode($content, TRUE);

    if (!$data || !isset($data['data'])) {
      return;
    }

    $modified = FALSE;

    // Determine the resource type for filtering.
    $resource_type = 'workspace';
    if ($is_board_collection) {
      $resource_type = 'board';
    }
    elseif ($is_notification_collection) {
      $resource_type = 'notification';
    }
    elseif ($is_activity_collection) {
      $resource_type = 'activity';
    }
    elseif ($is_card_collection) {
      $resource_type = 'card';
    }
    elseif ($is_list_collection) {
      $resource_type = 'list';
    }
    elseif ($is_card_comment_collection) {
      $resource_type = 'card_comment';
    }
    elseif ($is_checklist_collection) {
      $resource_type = 'checklist';
    }
    elseif ($is_checklist_item_collection) {
      $resource_type = 'checklist_item';
    }

    // Handle collection (array of items).
    if (isset($data['data'][0])) {
      $filtered_data = [];
      $filtered_included = [];
      $kept_ids = [];

      foreach ($data['data'] as $item) {
        if ($this->canViewItem($item, $resource_type)) {
          $filtered_data[] = $item;
          $kept_ids[] = $item['id'] ?? NULL;
        }
        else {
          $modified = TRUE;
        }
      }
      $data['data'] = $filtered_data;

      // Filter included resources to only keep those related to kept items.
      if ($modified && isset($data['included'])) {
        // For simplicity, keep all included resources that are referenced by kept items.
        // This avoids orphaned included resources.
        $data['included'] = $this->filterIncludedResources($data['included'], $filtered_data);
      }

      // Update meta count if present.
      if (isset($data['meta']['count'])) {
        $data['meta']['count'] = count($filtered_data);
      }
    }
    // Handle single resource.
    elseif (isset($data['data']['type'])) {
      if (!$this->canViewItem($data['data'], $resource_type)) {
        // Return 403 for single resource.
        $response->setStatusCode(403);
        $data = [
          'errors' => [
            [
              'status' => '403',
              'title' => 'Forbidden',
              'detail' => 'You do not have permission to view this resource.',
            ],
          ],
        ];
        $modified = TRUE;
      }
    }

    if ($modified) {
      $response->setContent(json_encode($data));
    }
  }

  /**
   * Filter included resources to only keep those referenced by kept data items.
   *
   * @param array $included
   *   The included resources.
   * @param array $kept_data
   *   The kept data items.
   *
   * @return array
   *   Filtered included resources.
   */
  protected function filterIncludedResources(array $included, array $kept_data): array {
    // Collect all referenced IDs from kept data items.
    $referenced_ids = [];
    foreach ($kept_data as $item) {
      if (isset($item['relationships'])) {
        foreach ($item['relationships'] as $rel) {
          if (isset($rel['data'])) {
            if (isset($rel['data']['id'])) {
              $referenced_ids[$rel['data']['id']] = TRUE;
            }
            elseif (is_array($rel['data'])) {
              foreach ($rel['data'] as $rel_item) {
                if (isset($rel_item['id'])) {
                  $referenced_ids[$rel_item['id']] = TRUE;
                }
              }
            }
          }
        }
      }
    }

    // Filter included to only keep referenced items.
    return array_values(array_filter($included, function ($item) use ($referenced_ids) {
      return isset($item['id']) && isset($referenced_ids[$item['id']]);
    }));
  }

  /**
   * Load a node by type and UUID, bypassing node access checking.
   *
   * This subscriber performs its own access checks via PermissionChecker,
   * so entity loading must not be subject to Drupal's node_access table.
   * During node_access_rebuild(), the table can be temporarily empty,
   * which would cause all loadByProperties() calls with access checking
   * to return empty results.
   *
   * @param string $type
   *   The node bundle type.
   * @param string $uuid
   *   The node UUID.
   *
   * @return \Drupal\node\NodeInterface|null
   *   The loaded node or NULL if not found.
   */
  protected function loadNodeByUuid(string $type, string $uuid) {
    $storage = $this->entityTypeManager->getStorage('node');
    $ids = $storage->getQuery()
      ->accessCheck(FALSE)
      ->condition('type', $type)
      ->condition('uuid', $uuid)
      ->range(0, 1)
      ->execute();

    if (empty($ids)) {
      return NULL;
    }

    return $storage->load(reset($ids));
  }

  /**
   * Check if the current user can view a JSON:API item.
   *
   * @param array $item
   *   The JSON:API resource item.
   * @param string $type
   *   One of: 'board', 'workspace', 'notification', 'activity', 'card', 'list',
   *   'card_comment', 'checklist', 'checklist_item'.
   *
   * @return bool
   *   TRUE if user can view the item.
   */
  protected function canViewItem(array $item, string $type): bool {
    $uuid = $item['id'] ?? NULL;
    if (!$uuid) {
      return FALSE;
    }

    try {
      if ($type === 'board') {
        $node = $this->loadNodeByUuid('board', $uuid);
        if (!$node) {
          return FALSE;
        }
        return $this->permissionChecker->canViewBoard($node);
      }
      elseif ($type === 'workspace') {
        $node = $this->loadNodeByUuid('workspace', $uuid);
        if (!$node) {
          return FALSE;
        }
        return $this->permissionChecker->canViewWorkspace($node);
      }
      elseif ($type === 'notification') {
        return $this->canViewNotification($item);
      }
      elseif ($type === 'activity') {
        return $this->canViewActivity($item);
      }
      elseif (in_array($type, ['card', 'list', 'card_comment', 'checklist', 'checklist_item'])) {
        return $this->canViewBoardBasedEntity($item, $type);
      }

      return FALSE;
    }
    catch (\Exception $e) {
      // On error, deny access for security.
      return FALSE;
    }
  }

  /**
   * Check if the current user can view a notification.
   *
   * A notification is viewable if the user can view the related card/board.
   *
   * @param array $item
   *   The JSON:API notification item.
   *
   * @return bool
   *   TRUE if user can view the notification.
   */
  protected function canViewNotification(array $item): bool {
    // Check if notification has a card reference.
    $card_rel = $item['relationships']['field_notification_card']['data'] ?? NULL;
    if ($card_rel && isset($card_rel['id'])) {
      $card = $this->loadNodeByUuid('card', $card_rel['id']);
      if ($card) {
        $board = $this->getBoardFromCard($card);
        if ($board) {
          return $this->permissionChecker->canViewBoard($board);
        }
      }
    }

    // Check if notification has a board reference.
    $board_rel = $item['relationships']['field_notification_board']['data'] ?? NULL;
    if ($board_rel && isset($board_rel['id'])) {
      $board = $this->loadNodeByUuid('board', $board_rel['id']);
      if ($board) {
        return $this->permissionChecker->canViewBoard($board);
      }
    }

    // Check if notification has a workspace reference.
    $workspace_rel = $item['relationships']['field_notification_workspace']['data'] ?? NULL;
    if ($workspace_rel && isset($workspace_rel['id'])) {
      $workspace = $this->loadNodeByUuid('workspace', $workspace_rel['id']);
      if ($workspace) {
        return $this->permissionChecker->canViewWorkspace($workspace);
      }
    }

    // If no card, board, or workspace reference, deny for security.
    // All notifications should have at least one reference.
    return FALSE;
  }

  /**
   * Check if the current user can view an activity.
   *
   * An activity is viewable if the user can view the related card/board.
   *
   * @param array $item
   *   The JSON:API activity item.
   *
   * @return bool
   *   TRUE if user can view the activity.
   */
  protected function canViewActivity(array $item): bool {
    // Check if activity has a card reference.
    $card_rel = $item['relationships']['field_activity_card']['data'] ?? NULL;
    if ($card_rel && isset($card_rel['id'])) {
      $card = $this->loadNodeByUuid('card', $card_rel['id']);
      if ($card) {
        $board = $this->getBoardFromCard($card);
        if ($board) {
          return $this->permissionChecker->canViewBoard($board);
        }
      }
    }

    // Check if activity has a board reference.
    $board_rel = $item['relationships']['field_activity_board']['data'] ?? NULL;
    if ($board_rel && isset($board_rel['id'])) {
      $board = $this->loadNodeByUuid('board', $board_rel['id']);
      if ($board) {
        return $this->permissionChecker->canViewBoard($board);
      }
    }

    // Check if activity has a workspace reference.
    $workspace_rel = $item['relationships']['field_activity_workspace']['data'] ?? NULL;
    if ($workspace_rel && isset($workspace_rel['id'])) {
      $workspace = $this->loadNodeByUuid('workspace', $workspace_rel['id']);
      if ($workspace) {
        return $this->permissionChecker->canViewWorkspace($workspace);
      }
    }

    // If no references found, deny access to be safe.
    // Activities should always have at least a board reference.
    return FALSE;
  }

  /**
   * Get the board from a card via its list.
   *
   * @param \Drupal\node\NodeInterface $card
   *   The card node.
   *
   * @return \Drupal\node\NodeInterface|null
   *   The board node or NULL.
   */
  protected function getBoardFromCard($card) {
    // Get the list from the card.
    if (!$card->hasField('field_card_list') || $card->get('field_card_list')->isEmpty()) {
      return NULL;
    }

    $list = $card->get('field_card_list')->entity;
    if (!$list) {
      return NULL;
    }

    // Get the board from the list.
    if (!$list->hasField('field_list_board') || $list->get('field_list_board')->isEmpty()) {
      return NULL;
    }

    return $list->get('field_list_board')->entity;
  }

  /**
   * Check if user can view a board-based entity (card, list, etc.).
   *
   * @param array $item
   *   The JSON:API item.
   * @param string $type
   *   The entity type (card, list, card_comment, checklist, checklist_item).
   *
   * @return bool
   *   TRUE if user can view the entity.
   */
  protected function canViewBoardBasedEntity(array $item, string $type): bool {
    $uuid = $item['id'] ?? NULL;
    if (!$uuid) {
      return FALSE;
    }

    // Map JSON:API type to Drupal bundle name.
    $bundle = $type;
    if ($type === 'list') {
      $bundle = 'board_list';
    }

    $node = $this->loadNodeByUuid($bundle, $uuid);
    if (!$node) {
      return FALSE;
    }

    // Get the board for this entity.
    $board = $this->getBoardForEntity($node, $type);
    if (!$board) {
      return FALSE;
    }

    return $this->permissionChecker->canViewBoard($board);
  }

  /**
   * Get the board for a board-based entity.
   *
   * @param \Drupal\node\NodeInterface $node
   *   The node.
   * @param string $type
   *   The entity type.
   *
   * @return \Drupal\node\NodeInterface|null
   *   The board node or NULL.
   */
  protected function getBoardForEntity($node, string $type) {
    switch ($type) {
      case 'list':
        if ($node->hasField('field_list_board') && !$node->get('field_list_board')->isEmpty()) {
          return $node->get('field_list_board')->entity;
        }
        return NULL;

      case 'card':
        return $this->getBoardFromCard($node);

      case 'card_comment':
        if ($node->hasField('field_comment_card') && !$node->get('field_comment_card')->isEmpty()) {
          $card = $node->get('field_comment_card')->entity;
          if ($card) {
            return $this->getBoardFromCard($card);
          }
        }
        return NULL;

      case 'checklist':
        if ($node->hasField('field_checklist_card') && !$node->get('field_checklist_card')->isEmpty()) {
          $card = $node->get('field_checklist_card')->entity;
          if ($card) {
            return $this->getBoardFromCard($card);
          }
        }
        return NULL;

      case 'checklist_item':
        if ($node->hasField('field_checklist_item_checklist') && !$node->get('field_checklist_item_checklist')->isEmpty()) {
          $checklist = $node->get('field_checklist_item_checklist')->entity;
          if ($checklist) {
            return $this->getBoardForEntity($checklist, 'checklist');
          }
        }
        return NULL;
    }

    return NULL;
  }

}
