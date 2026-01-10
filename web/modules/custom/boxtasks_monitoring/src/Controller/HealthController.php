<?php

declare(strict_types=1);

namespace Drupal\boxtasks_monitoring\Controller;

use Drupal\boxtasks_monitoring\Service\HealthChecker;
use Drupal\Core\Controller\ControllerBase;
use Symfony\Component\DependencyInjection\ContainerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;

/**
 * Controller for health check endpoints.
 */
class HealthController extends ControllerBase {

  /**
   * The health checker service.
   */
  protected HealthChecker $healthChecker;

  /**
   * Constructs a HealthController object.
   */
  public function __construct(HealthChecker $healthChecker) {
    $this->healthChecker = $healthChecker;
  }

  /**
   * {@inheritdoc}
   */
  public static function create(ContainerInterface $container): static {
    return new static(
      $container->get('boxtasks_monitoring.health_checker')
    );
  }

  /**
   * Basic health check endpoint.
   *
   * @return \Symfony\Component\HttpFoundation\JsonResponse
   *   Health status response.
   */
  public function check(): JsonResponse {
    $result = $this->healthChecker->check();

    $statusCode = match ($result['status']) {
      HealthChecker::STATUS_HEALTHY => 200,
      HealthChecker::STATUS_DEGRADED => 200,
      HealthChecker::STATUS_UNHEALTHY => 503,
    };

    $response = new JsonResponse($result, $statusCode);
    $response->headers->set('Cache-Control', 'no-cache, no-store, must-revalidate');
    $response->headers->set('X-Health-Status', $result['status']);

    return $response;
  }

  /**
   * Detailed health check endpoint.
   *
   * @return \Symfony\Component\HttpFoundation\JsonResponse
   *   Detailed health status response.
   */
  public function detailed(): JsonResponse {
    $result = $this->healthChecker->detailed();

    $statusCode = match ($result['status']) {
      HealthChecker::STATUS_HEALTHY => 200,
      HealthChecker::STATUS_DEGRADED => 200,
      HealthChecker::STATUS_UNHEALTHY => 503,
    };

    $response = new JsonResponse($result, $statusCode);
    $response->headers->set('Cache-Control', 'no-cache, no-store, must-revalidate');
    $response->headers->set('X-Health-Status', $result['status']);

    return $response;
  }

}
