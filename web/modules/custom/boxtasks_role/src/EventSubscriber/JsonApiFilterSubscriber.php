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
   * Filters JSON:API responses for boards and workspaces.
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

    // Check if this is a board or workspace collection/resource.
    $is_board_collection = strpos($path, '/jsonapi/node/board') !== FALSE;
    $is_workspace_collection = strpos($path, '/jsonapi/node/workspace') !== FALSE;

    if (!$is_board_collection && !$is_workspace_collection) {
      return;
    }

    $content = $response->getContent();
    $data = json_decode($content, TRUE);

    if (!$data || !isset($data['data'])) {
      return;
    }

    $modified = FALSE;

    // Handle collection (array of items).
    if (isset($data['data'][0])) {
      $filtered_data = [];
      foreach ($data['data'] as $item) {
        if ($this->canViewItem($item, $is_board_collection ? 'board' : 'workspace')) {
          $filtered_data[] = $item;
        }
        else {
          $modified = TRUE;
        }
      }
      $data['data'] = $filtered_data;

      // Update meta count if present.
      if (isset($data['meta']['count'])) {
        $data['meta']['count'] = count($filtered_data);
      }
    }
    // Handle single resource.
    elseif (isset($data['data']['type'])) {
      if (!$this->canViewItem($data['data'], $is_board_collection ? 'board' : 'workspace')) {
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
   * Check if the current user can view a JSON:API item.
   *
   * @param array $item
   *   The JSON:API resource item.
   * @param string $type
   *   Either 'board' or 'workspace'.
   *
   * @return bool
   *   TRUE if user can view the item.
   */
  protected function canViewItem(array $item, string $type): bool {
    $uuid = $item['id'] ?? NULL;
    if (!$uuid) {
      return TRUE;
    }

    try {
      $storage = $this->entityTypeManager->getStorage('node');
      $nodes = $storage->loadByProperties([
        'type' => $type,
        'uuid' => $uuid,
      ]);
      $node = reset($nodes);

      if (!$node) {
        return TRUE;
      }

      if ($type === 'board') {
        return $this->permissionChecker->canViewBoard($node);
      }
      else {
        return $this->permissionChecker->canViewWorkspace($node);
      }
    }
    catch (\Exception $e) {
      // On error, allow access to prevent blocking.
      return TRUE;
    }
  }

}
