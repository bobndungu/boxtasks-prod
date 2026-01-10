<?php

declare(strict_types=1);

namespace Drupal\boxtasks_monitoring\Controller;

use Drupal\boxtasks_security\Service\AuditLogger;
use Drupal\Core\Controller\ControllerBase;
use Symfony\Component\DependencyInjection\ContainerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;

/**
 * Controller for security statistics endpoints.
 */
class SecurityStatsController extends ControllerBase {

  /**
   * The audit logger service.
   */
  protected AuditLogger $auditLogger;

  /**
   * Constructs a SecurityStatsController object.
   */
  public function __construct(AuditLogger $auditLogger) {
    $this->auditLogger = $auditLogger;
  }

  /**
   * {@inheritdoc}
   */
  public static function create(ContainerInterface $container): static {
    return new static(
      $container->get('boxtasks_security.audit_logger')
    );
  }

  /**
   * Get security statistics.
   *
   * @param \Symfony\Component\HttpFoundation\Request $request
   *   The request object.
   *
   * @return \Symfony\Component\HttpFoundation\JsonResponse
   *   Security statistics response.
   */
  public function get(Request $request): JsonResponse {
    $period = (int) $request->query->get('period', 86400);

    // Limit period to max 30 days.
    $period = min($period, 86400 * 30);

    $stats = $this->auditLogger->getSecurityStats($period);

    // Get recent security events.
    $recentEvents = $this->auditLogger->getLogs(
      ['severity' => 'warning'],
      10
    );

    return new JsonResponse([
      'period_seconds' => $period,
      'stats' => $stats,
      'recent_warnings' => array_map(function ($event) {
        return [
          'type' => $event->event_type,
          'message' => $event->message,
          'ip' => $event->ip_address,
          'timestamp' => date('c', $event->created),
        ];
      }, $recentEvents),
    ]);
  }

}
