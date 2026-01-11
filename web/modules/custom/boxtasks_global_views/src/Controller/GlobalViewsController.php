<?php

namespace Drupal\boxtasks_global_views\Controller;

use Drupal\Core\Controller\ControllerBase;
use Drupal\Core\Entity\EntityTypeManagerInterface;
use Drupal\Core\Session\AccountProxyInterface;
use Symfony\Component\DependencyInjection\ContainerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;

/**
 * Controller for global views API endpoints.
 */
class GlobalViewsController extends ControllerBase {

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
   * Constructs a GlobalViewsController object.
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
   * {@inheritdoc}
   */
  public static function create(ContainerInterface $container) {
    return new static(
      $container->get('entity_type.manager'),
      $container->get('current_user')
    );
  }

  /**
   * Everything View - returns all cards user has access to.
   *
   * @param \Symfony\Component\HttpFoundation\Request $request
   *   The request object.
   *
   * @return \Symfony\Component\HttpFoundation\JsonResponse
   *   JSON response with all accessible cards.
   */
  public function everything(Request $request): JsonResponse {
    if ($this->currentUser->isAnonymous()) {
      return new JsonResponse(['error' => 'Unauthorized'], 401);
    }

    $userId = $this->currentUser->id();

    // Get filter parameters
    $boardId = $request->query->get('board');
    $workspaceId = $request->query->get('workspace');
    $completed = $request->query->get('completed');
    $archived = $request->query->get('archived', '0');
    $dueDate = $request->query->get('due_date');
    $sortBy = $request->query->get('sort', 'updated');
    $sortOrder = $request->query->get('order', 'desc');

    try {
      // First, get all boards the user has access to
      $accessibleBoards = $this->getAccessibleBoards($userId, $workspaceId);

      if (empty($accessibleBoards)) {
        return new JsonResponse([
          'cards' => [],
          'total' => 0,
          'boards' => [],
          'workspaces' => [],
        ]);
      }

      // Get all lists from accessible boards
      $accessibleLists = $this->getListsFromBoards(array_keys($accessibleBoards));

      if (empty($accessibleLists)) {
        return new JsonResponse([
          'cards' => [],
          'total' => 0,
          'boards' => array_values(array_map(function($b) {
            return ['id' => $b['id'], 'name' => $b['name']];
          }, $accessibleBoards)),
          'workspaces' => [],
        ]);
      }

      // Query cards from accessible lists
      $storage = $this->entityTypeManager->getStorage('node');
      $query = $storage->getQuery()
        ->accessCheck(FALSE)
        ->condition('type', 'card')
        ->condition('field_card_list', array_keys($accessibleLists), 'IN');

      // Apply filters
      if ($boardId) {
        // Filter lists by board first
        $boardLists = array_filter($accessibleLists, function($list) use ($boardId) {
          return $list['board_nid'] == $boardId;
        });
        if (!empty($boardLists)) {
          $query->condition('field_card_list', array_keys($boardLists), 'IN');
        }
      }

      if ($archived === '0') {
        $query->condition('field_card_archived', 0);
      } elseif ($archived === '1') {
        $query->condition('field_card_archived', 1);
      }

      if ($completed === '1') {
        $query->condition('field_card_completed', 1);
      } elseif ($completed === '0') {
        $query->condition('field_card_completed', 0);
      }

      if ($dueDate) {
        switch ($dueDate) {
          case 'overdue':
            $query->condition('field_card_due_date', date('Y-m-d\TH:i:s'), '<');
            $query->condition('field_card_completed', 0);
            break;
          case 'today':
            $today = date('Y-m-d');
            $query->condition('field_card_due_date', $today . 'T00:00:00', '>=');
            $query->condition('field_card_due_date', $today . 'T23:59:59', '<=');
            break;
          case 'week':
            $today = date('Y-m-d');
            $weekEnd = date('Y-m-d', strtotime('+7 days'));
            $query->condition('field_card_due_date', $today . 'T00:00:00', '>=');
            $query->condition('field_card_due_date', $weekEnd . 'T23:59:59', '<=');
            break;
        }
      }

      // Apply sorting
      switch ($sortBy) {
        case 'due_date':
          $query->sort('field_card_due_date', strtoupper($sortOrder));
          break;
        case 'created':
          $query->sort('created', strtoupper($sortOrder));
          break;
        case 'title':
          $query->sort('title', strtoupper($sortOrder));
          break;
        case 'updated':
        default:
          $query->sort('changed', strtoupper($sortOrder));
          break;
      }

      $nids = $query->execute();
      $cards = $storage->loadMultiple($nids);

      // Load related entities for enriched data
      $userStorage = $this->entityTypeManager->getStorage('user');

      $data = [];
      $workspaces = [];

      foreach ($cards as $card) {
        $listRef = $card->get('field_card_list')->target_id;
        $listInfo = $accessibleLists[$listRef] ?? null;

        // Get board info from list
        $boardNid = $listInfo['board_nid'] ?? null;
        $boardInfo = $boardNid ? ($accessibleBoards[$boardNid] ?? null) : null;

        if ($boardInfo && !isset($workspaces[$boardInfo['workspace_id']])) {
          $workspaces[$boardInfo['workspace_id']] = $boardInfo['workspace_name'];
        }

        // Get assigned members
        $members = [];
        foreach ($card->get('field_card_members') as $memberRef) {
          $member = $userStorage->load($memberRef->target_id);
          if ($member) {
            $displayName = $member->getDisplayName();
            if ($member->hasField('field_display_name') && !$member->get('field_display_name')->isEmpty()) {
              $displayName = $member->get('field_display_name')->value;
            }
            $members[] = [
              'id' => $member->uuid(),
              'username' => $member->getAccountName(),
              'displayName' => $displayName,
            ];
          }
        }

        // Get labels
        $labels = [];
        foreach ($card->get('field_card_labels') as $labelRef) {
          $label = $labelRef->entity;
          if ($label) {
            $color = '#3b82f6';
            if ($label->hasField('field_label_color') && !$label->get('field_label_color')->isEmpty()) {
              $color = $label->get('field_label_color')->value;
            }
            $labels[] = [
              'id' => $label->uuid(),
              'name' => $label->getName(),
              'color' => $color,
            ];
          }
        }

        $data[] = [
          'id' => $card->uuid(),
          'title' => $card->getTitle(),
          'description' => $card->get('field_card_description')->value,
          'completed' => (bool) $card->get('field_card_completed')->value,
          'archived' => (bool) $card->get('field_card_archived')->value,
          'dueDate' => $card->get('field_card_due_date')->value,
          'startDate' => $card->get('field_card_start_date')->value,
          'position' => (float) $card->get('field_card_position')->value,
          'board' => [
            'id' => $boardInfo['id'] ?? null,
            'name' => $boardInfo['name'] ?? 'Unknown',
          ],
          'workspace' => [
            'id' => $boardInfo['workspace_id'] ?? null,
            'name' => $boardInfo['workspace_name'] ?? 'Unknown',
          ],
          'list' => [
            'id' => $listInfo['id'] ?? null,
            'name' => $listInfo['name'] ?? 'Unknown',
          ],
          'members' => $members,
          'labels' => $labels,
          'createdAt' => date('c', $card->getCreatedTime()),
          'updatedAt' => date('c', $card->getChangedTime()),
        ];
      }

      $response = new JsonResponse([
        'cards' => $data,
        'total' => count($data),
        'boards' => array_values(array_map(function($b) {
          return ['id' => $b['id'], 'name' => $b['name']];
        }, $accessibleBoards)),
        'workspaces' => array_map(function($id, $name) {
          return ['id' => $id, 'name' => $name];
        }, array_keys($workspaces), array_values($workspaces)),
      ]);

      $response->headers->set('Cache-Control', 'no-cache, no-store, must-revalidate');
      return $response;

    } catch (\Exception $e) {
      return new JsonResponse([
        'error' => 'Failed to fetch cards',
        'message' => $e->getMessage(),
      ], 500);
    }
  }

  /**
   * My Cards - returns cards assigned to current user.
   *
   * @param \Symfony\Component\HttpFoundation\Request $request
   *   The request object.
   *
   * @return \Symfony\Component\HttpFoundation\JsonResponse
   *   JSON response with user's assigned cards.
   */
  public function myCards(Request $request): JsonResponse {
    if ($this->currentUser->isAnonymous()) {
      return new JsonResponse(['error' => 'Unauthorized'], 401);
    }

    $userId = $this->currentUser->id();

    // Get filter parameters
    $completed = $request->query->get('completed');
    $archived = $request->query->get('archived', '0');
    $dueDate = $request->query->get('due_date');
    $sortBy = $request->query->get('sort', 'due_date');
    $sortOrder = $request->query->get('order', 'asc');

    try {
      $storage = $this->entityTypeManager->getStorage('node');
      $query = $storage->getQuery()
        ->accessCheck(FALSE)
        ->condition('type', 'card')
        ->condition('field_card_members', $userId);

      // Apply filters
      if ($archived === '0') {
        $query->condition('field_card_archived', 0);
      } elseif ($archived === '1') {
        $query->condition('field_card_archived', 1);
      }

      if ($completed === '1') {
        $query->condition('field_card_completed', 1);
      } elseif ($completed === '0') {
        $query->condition('field_card_completed', 0);
      }

      if ($dueDate) {
        switch ($dueDate) {
          case 'overdue':
            $query->condition('field_card_due_date', date('Y-m-d\TH:i:s'), '<');
            $query->condition('field_card_completed', 0);
            break;
          case 'today':
            $today = date('Y-m-d');
            $query->condition('field_card_due_date', $today . 'T00:00:00', '>=');
            $query->condition('field_card_due_date', $today . 'T23:59:59', '<=');
            break;
          case 'week':
            $today = date('Y-m-d');
            $weekEnd = date('Y-m-d', strtotime('+7 days'));
            $query->condition('field_card_due_date', $today . 'T00:00:00', '>=');
            $query->condition('field_card_due_date', $weekEnd . 'T23:59:59', '<=');
            break;
          case 'no_date':
            $query->notExists('field_card_due_date');
            break;
        }
      }

      // Apply sorting
      switch ($sortBy) {
        case 'due_date':
          $query->sort('field_card_due_date', strtoupper($sortOrder));
          break;
        case 'created':
          $query->sort('created', strtoupper($sortOrder));
          break;
        case 'title':
          $query->sort('title', strtoupper($sortOrder));
          break;
        case 'updated':
        default:
          $query->sort('changed', strtoupper($sortOrder));
          break;
      }

      $nids = $query->execute();
      $cards = $storage->loadMultiple($nids);

      // Get all boards and lists for enrichment
      $accessibleBoards = $this->getAccessibleBoards($userId);
      $accessibleLists = $this->getListsFromBoards(array_keys($accessibleBoards));

      $data = [];
      $stats = [
        'total' => 0,
        'completed' => 0,
        'overdue' => 0,
        'dueToday' => 0,
        'dueThisWeek' => 0,
        'noDueDate' => 0,
      ];

      $now = new \DateTime();
      $today = $now->format('Y-m-d');
      $weekEnd = (clone $now)->modify('+7 days')->format('Y-m-d');

      foreach ($cards as $card) {
        $listRef = $card->get('field_card_list')->target_id;
        $listInfo = $accessibleLists[$listRef] ?? null;

        // Get board info from list
        $boardNid = $listInfo['board_nid'] ?? null;
        $boardInfo = $boardNid ? ($accessibleBoards[$boardNid] ?? null) : null;

        $cardDueDate = $card->get('field_card_due_date')->value;
        $isCompleted = (bool) $card->get('field_card_completed')->value;

        // Update stats
        $stats['total']++;
        if ($isCompleted) {
          $stats['completed']++;
        } elseif ($cardDueDate) {
          $dueDateObj = new \DateTime($cardDueDate);
          $dueDateStr = $dueDateObj->format('Y-m-d');
          if ($dueDateStr < $today) {
            $stats['overdue']++;
          } elseif ($dueDateStr === $today) {
            $stats['dueToday']++;
          } elseif ($dueDateStr <= $weekEnd) {
            $stats['dueThisWeek']++;
          }
        } else {
          $stats['noDueDate']++;
        }

        $data[] = [
          'id' => $card->uuid(),
          'title' => $card->getTitle(),
          'description' => $card->get('field_card_description')->value,
          'completed' => $isCompleted,
          'archived' => (bool) $card->get('field_card_archived')->value,
          'dueDate' => $cardDueDate,
          'startDate' => $card->get('field_card_start_date')->value,
          'board' => [
            'id' => $boardInfo['id'] ?? null,
            'name' => $boardInfo['name'] ?? 'Unknown',
          ],
          'workspace' => [
            'id' => $boardInfo['workspace_id'] ?? null,
            'name' => $boardInfo['workspace_name'] ?? 'Unknown',
          ],
          'list' => [
            'id' => $listInfo['id'] ?? null,
            'name' => $listInfo['name'] ?? 'Unknown',
          ],
          'createdAt' => date('c', $card->getCreatedTime()),
          'updatedAt' => date('c', $card->getChangedTime()),
        ];
      }

      $response = new JsonResponse([
        'cards' => $data,
        'stats' => $stats,
      ]);

      $response->headers->set('Cache-Control', 'no-cache, no-store, must-revalidate');
      return $response;

    } catch (\Exception $e) {
      return new JsonResponse([
        'error' => 'Failed to fetch cards',
        'message' => $e->getMessage(),
      ], 500);
    }
  }

  /**
   * Get all boards accessible to a user.
   *
   * @param int $userId
   *   The user ID.
   * @param string|null $workspaceId
   *   Optional workspace UUID to filter by.
   *
   * @return array
   *   Array of accessible boards keyed by node ID.
   */
  protected function getAccessibleBoards(int $userId, ?string $workspaceId = null): array {
    $storage = $this->entityTypeManager->getStorage('node');
    $boards = [];

    // Query boards - we'll check workspace membership
    $query = $storage->getQuery()
      ->accessCheck(FALSE)
      ->condition('type', 'board');

    // Check if board has archived field
    try {
      $query->condition('field_board_archived', 0);
    } catch (\Exception $e) {
      // Field doesn't exist, continue without filter
    }

    $boardNids = $query->execute();
    $boardEntities = $storage->loadMultiple($boardNids);

    foreach ($boardEntities as $board) {
      $workspaceRef = $board->get('field_board_workspace')->target_id;
      $workspace = $workspaceRef ? $storage->load($workspaceRef) : null;

      $wsUuid = $workspace ? $workspace->uuid() : null;

      // Filter by workspace if specified
      if ($workspaceId && $wsUuid !== $workspaceId) {
        continue;
      }

      $boards[$board->id()] = [
        'id' => $board->uuid(),
        'nid' => $board->id(),
        'name' => $board->getTitle(),
        'workspace_id' => $wsUuid,
        'workspace_name' => $workspace ? $workspace->getTitle() : 'Unknown',
      ];
    }

    return $boards;
  }

  /**
   * Get all lists from specified boards.
   *
   * @param array $boardNids
   *   Array of board node IDs.
   *
   * @return array
   *   Array of lists keyed by node ID.
   */
  protected function getListsFromBoards(array $boardNids): array {
    if (empty($boardNids)) {
      return [];
    }

    $storage = $this->entityTypeManager->getStorage('node');
    $lists = [];

    $query = $storage->getQuery()
      ->accessCheck(FALSE)
      ->condition('type', 'board_list')
      ->condition('field_list_board', $boardNids, 'IN');

    // Check if list has archived field
    try {
      $query->condition('field_list_archived', 0);
    } catch (\Exception $e) {
      // Field doesn't exist, continue without filter
    }

    $listNids = $query->execute();
    $listEntities = $storage->loadMultiple($listNids);

    foreach ($listEntities as $list) {
      $boardRef = $list->get('field_list_board')->target_id;

      $lists[$list->id()] = [
        'id' => $list->uuid(),
        'nid' => $list->id(),
        'name' => $list->getTitle(),
        'board_nid' => $boardRef,
      ];
    }

    return $lists;
  }

}
