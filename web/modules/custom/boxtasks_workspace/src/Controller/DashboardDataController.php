<?php

namespace Drupal\boxtasks_workspace\Controller;

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
 * Controller for fetching complete dashboard data in a single API call.
 */
class DashboardDataController extends ControllerBase {

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
   * Constructs a DashboardDataController object.
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
   * Check if a user is a super admin (should be hidden from member lists).
   *
   * @param mixed $user
   *   The user entity.
   *
   * @return bool
   *   TRUE if the user is a super admin.
   */
  protected function isSuperAdmin($user): bool {
    // Check user roles.
    $roles = $user->getRoles();

    // Users with 'administrator' or 'box_admin' role are super admins.
    if (in_array('administrator', $roles) || in_array('box_admin', $roles)) {
      return TRUE;
    }

    return FALSE;
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
   * Get complete dashboard data for a workspace in a single response.
   *
   * @param string $workspace_id
   *   The workspace UUID.
   * @param \Symfony\Component\HttpFoundation\Request $request
   *   The request object.
   *
   * @return \Symfony\Component\HttpFoundation\JsonResponse
   *   JSON response with all dashboard data.
   */
  public function getDashboardData(string $workspace_id, Request $request): JsonResponse {
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

    // Load the workspace.
    $workspaces = $node_storage->loadByProperties([
      'type' => 'workspace',
      'uuid' => $workspace_id,
    ]);

    if (empty($workspaces)) {
      throw new NotFoundHttpException('Workspace not found.');
    }

    $workspace = reset($workspaces);

    // Check access using the authenticated user.
    if (!$workspace->access('view', $this->authenticatedUser)) {
      throw new AccessDeniedHttpException('Access denied to this workspace.');
    }

    $now = time();
    $seven_days_from_now = $now + (7 * 24 * 60 * 60);

    // Get all boards for this workspace.
    $boards = $node_storage->loadByProperties([
      'type' => 'board',
      'field_board_workspace' => $workspace->id(),
      'field_board_archived' => FALSE,
    ]);

    $board_ids = array_map(function ($board) {
      return $board->id();
    }, $boards);

    // Get all lists for these boards in one query.
    $lists = [];
    if (!empty($board_ids)) {
      $list_query = $node_storage->getQuery()
        ->condition('type', 'board_list')
        ->condition('field_list_board', $board_ids, 'IN')
        ->condition('field_list_archived', FALSE)
        ->accessCheck(FALSE)
        ->execute();
      $lists = $node_storage->loadMultiple($list_query);
    }

    $list_ids = array_keys($lists);

    // Get all cards for these lists in one query.
    $cards = [];
    if (!empty($list_ids)) {
      $card_query = $node_storage->getQuery()
        ->condition('type', 'card')
        ->condition('field_card_list', $list_ids, 'IN')
        ->condition('field_card_archived', FALSE)
        ->accessCheck(FALSE)
        ->execute();
      $cards = $node_storage->loadMultiple($card_query);
    }

    // Calculate stats.
    $stats = [
      'totalCards' => count($cards),
      'completedCards' => 0,
      'overdueCards' => 0,
      'dueSoonCards' => 0,
      'unassignedCards' => 0,
      'blockedCards' => 0,
    ];

    $cards_by_board = [];
    $cards_by_list = [];

    foreach ($cards as $card) {
      // Get list and board for this card.
      $list_id = NULL;
      $board_id = NULL;

      if ($card->hasField('field_card_list') && !$card->get('field_card_list')->isEmpty()) {
        $list_ref = $card->get('field_card_list')->first();
        if ($list_ref && $list_ref->target_id) {
          $list_id = $list_ref->target_id;
          if (isset($lists[$list_id])) {
            $list = $lists[$list_id];
            if ($list->hasField('field_list_board') && !$list->get('field_list_board')->isEmpty()) {
              $board_ref = $list->get('field_list_board')->first();
              if ($board_ref && $board_ref->target_id) {
                $board_id = $board_ref->target_id;
              }
            }
          }
        }
      }

      if ($list_id) {
        if (!isset($cards_by_list[$list_id])) {
          $cards_by_list[$list_id] = ['total' => 0, 'completed' => 0];
        }
        $cards_by_list[$list_id]['total']++;
      }

      if ($board_id) {
        if (!isset($cards_by_board[$board_id])) {
          $cards_by_board[$board_id] = ['total' => 0, 'completed' => 0];
        }
        $cards_by_board[$board_id]['total']++;
      }

      // Check completion.
      $is_completed = FALSE;
      if ($card->hasField('field_card_completed') && !$card->get('field_card_completed')->isEmpty()) {
        $is_completed = (bool) $card->get('field_card_completed')->value;
      }

      if ($is_completed) {
        $stats['completedCards']++;
        if ($list_id) {
          $cards_by_list[$list_id]['completed']++;
        }
        if ($board_id) {
          $cards_by_board[$board_id]['completed']++;
        }
      }

      // Check due date.
      $due_date = NULL;
      if ($card->hasField('field_card_due_date') && !$card->get('field_card_due_date')->isEmpty()) {
        $due_date = strtotime($card->get('field_card_due_date')->value);
      }

      if ($due_date && !$is_completed) {
        if ($due_date < $now) {
          $stats['overdueCards']++;
        } elseif ($due_date <= $seven_days_from_now) {
          $stats['dueSoonCards']++;
        }
      }

      // Check assigned members.
      $has_members = FALSE;
      if ($card->hasField('field_card_members') && !$card->get('field_card_members')->isEmpty()) {
        $has_members = TRUE;
      }
      if (!$has_members) {
        $stats['unassignedCards']++;
      }
    }

    // Build board data.
    $board_data = [];
    foreach ($boards as $board) {
      $board_id = $board->id();
      $board_counts = $cards_by_board[$board_id] ?? ['total' => 0, 'completed' => 0];

      // Get lists for this board.
      $board_lists = [];
      foreach ($lists as $list) {
        if ($list->hasField('field_list_board') && !$list->get('field_list_board')->isEmpty()) {
          $list_board_ref = $list->get('field_list_board')->first();
          if ($list_board_ref && $list_board_ref->target_id == $board_id) {
            $list_id = $list->id();
            $list_counts = $cards_by_list[$list_id] ?? ['total' => 0, 'completed' => 0];
            $board_lists[] = [
              'id' => $list->uuid(),
              'title' => $list->label(),
              'cardCount' => $list_counts['total'],
              'completedCount' => $list_counts['completed'],
            ];
          }
        }
      }

      $board_data[] = [
        'id' => $board->uuid(),
        'title' => $board->label(),
        'totalCards' => $board_counts['total'],
        'completedCards' => $board_counts['completed'],
        'lists' => $board_lists,
      ];
    }

    // Get workspace members.
    $team_stats = [];
    if ($workspace->hasField('field_workspace_members') && !$workspace->get('field_workspace_members')->isEmpty()) {
      $member_ids = [];
      foreach ($workspace->get('field_workspace_members') as $member_ref) {
        if ($member_ref->target_id) {
          $member_ids[] = $member_ref->target_id;
        }
      }

      if (!empty($member_ids)) {
        $members = $user_storage->loadMultiple($member_ids);

        // Calculate stats for each member.
        $member_card_stats = [];
        foreach ($cards as $card) {
          if ($card->hasField('field_card_members') && !$card->get('field_card_members')->isEmpty()) {
            foreach ($card->get('field_card_members') as $card_member_ref) {
              if ($card_member_ref->target_id) {
                $member_id = $card_member_ref->target_id;
                if (!isset($member_card_stats[$member_id])) {
                  $member_card_stats[$member_id] = [
                    'assigned' => 0,
                    'completed' => 0,
                    'overdue' => 0,
                  ];
                }
                $member_card_stats[$member_id]['assigned']++;

                $is_completed = FALSE;
                if ($card->hasField('field_card_completed') && !$card->get('field_card_completed')->isEmpty()) {
                  $is_completed = (bool) $card->get('field_card_completed')->value;
                }
                if ($is_completed) {
                  $member_card_stats[$member_id]['completed']++;
                }

                $due_date = NULL;
                if ($card->hasField('field_card_due_date') && !$card->get('field_card_due_date')->isEmpty()) {
                  $due_date = strtotime($card->get('field_card_due_date')->value);
                }
                if ($due_date && $due_date < $now && !$is_completed) {
                  $member_card_stats[$member_id]['overdue']++;
                }
              }
            }
          }
        }

        foreach ($members as $member) {
          // Skip super admins from team stats list.
          if ($this->isSuperAdmin($member)) {
            continue;
          }

          $member_id = $member->id();
          $member_stats = $member_card_stats[$member_id] ?? [
            'assigned' => 0,
            'completed' => 0,
            'overdue' => 0,
          ];

          $display_name = $member->getDisplayName();
          if ($member->hasField('field_display_name') && !$member->get('field_display_name')->isEmpty()) {
            $display_name = $member->get('field_display_name')->value;
          }

          $team_stats[] = [
            'id' => $member->uuid(),
            'name' => $display_name,
            'email' => $member->getEmail(),
            'assignedCards' => $member_stats['assigned'],
            'completedCards' => $member_stats['completed'],
            'overdueCards' => $member_stats['overdue'],
          ];
        }
      }
    }

    // Get recent activity (limit 20).
    $activity_query = $node_storage->getQuery()
      ->condition('type', 'activity')
      ->condition('field_activity_workspace', $workspace->id())
      ->sort('created', 'DESC')
      ->range(0, 20)
      ->accessCheck(FALSE)
      ->execute();

    $activities = $node_storage->loadMultiple($activity_query);
    $recent_activity = [];

    foreach ($activities as $activity) {
      $activity_data = [
        'id' => $activity->uuid(),
        'type' => 'card_created',
        'description' => '',
        'timestamp' => date('c', $activity->getCreatedTime()),
      ];

      if ($activity->hasField('field_activity_type') && !$activity->get('field_activity_type')->isEmpty()) {
        $activity_data['type'] = $activity->get('field_activity_type')->value;
      }

      if ($activity->hasField('field_activity_description') && !$activity->get('field_activity_description')->isEmpty()) {
        $activity_data['description'] = $activity->get('field_activity_description')->value;
      }

      // Get user info.
      if ($activity->hasField('field_activity_user') && !$activity->get('field_activity_user')->isEmpty()) {
        $user_ref = $activity->get('field_activity_user')->first();
        if ($user_ref && $user_ref->entity) {
          $user = $user_ref->entity;
          $activity_data['userId'] = $user->uuid();
          $display_name = $user->getDisplayName();
          if ($user->hasField('field_display_name') && !$user->get('field_display_name')->isEmpty()) {
            $display_name = $user->get('field_display_name')->value;
          }
          $activity_data['userName'] = $display_name;
        }
      }

      // Get card info.
      if ($activity->hasField('field_activity_card') && !$activity->get('field_activity_card')->isEmpty()) {
        $card_ref = $activity->get('field_activity_card')->first();
        if ($card_ref && $card_ref->entity) {
          $activity_data['cardId'] = $card_ref->entity->uuid();
          $activity_data['cardTitle'] = $card_ref->entity->label();
        }
      }

      $recent_activity[] = $activity_data;
    }

    // Calculate cards by due date (next 14 days).
    $cards_by_due_date = [];
    for ($i = 0; $i < 14; $i++) {
      $date = date('Y-m-d', $now + ($i * 24 * 60 * 60));
      $count = 0;

      foreach ($cards as $card) {
        if ($card->hasField('field_card_due_date') && !$card->get('field_card_due_date')->isEmpty()) {
          $due_value = $card->get('field_card_due_date')->value;
          $is_completed = FALSE;
          if ($card->hasField('field_card_completed') && !$card->get('field_card_completed')->isEmpty()) {
            $is_completed = (bool) $card->get('field_card_completed')->value;
          }
          if (!$is_completed && strpos($due_value, $date) === 0) {
            $count++;
          }
        }
      }

      $cards_by_due_date[] = [
        'date' => $date,
        'count' => $count,
      ];
    }

    // Completion trend (last 7 days).
    $completion_trend = [];
    for ($i = 6; $i >= 0; $i--) {
      $date = date('Y-m-d', $now - ($i * 24 * 60 * 60));
      $created_count = 0;

      foreach ($cards as $card) {
        $created_date = date('Y-m-d', $card->getCreatedTime());
        if ($created_date === $date) {
          $created_count++;
        }
      }

      $completion_trend[] = [
        'date' => $date,
        'completed' => 0, // Would need completion timestamp tracking.
        'created' => $created_count,
      ];
    }

    return new JsonResponse([
      'stats' => $stats,
      'boards' => $board_data,
      'recentActivity' => $recent_activity,
      'teamStats' => $team_stats,
      'cardsByDueDate' => $cards_by_due_date,
      'completionTrend' => $completion_trend,
    ]);
  }

}
