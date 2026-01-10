<?php

declare(strict_types=1);

namespace Drupal\boxtasks_monitoring\Controller;

use Drupal\Component\Datetime\TimeInterface;
use Drupal\Core\Controller\ControllerBase;
use Drupal\Core\Database\Connection;
use Drupal\Core\State\StateInterface;
use Symfony\Component\DependencyInjection\ContainerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;

/**
 * Controller for application metrics.
 */
class MetricsController extends ControllerBase {

  /**
   * The database connection.
   */
  protected Connection $database;

  /**
   * The state service.
   */
  protected StateInterface $state;

  /**
   * The time service.
   */
  protected TimeInterface $time;

  /**
   * Constructs a MetricsController object.
   */
  public function __construct(
    Connection $database,
    StateInterface $state,
    TimeInterface $time
  ) {
    $this->database = $database;
    $this->state = $state;
    $this->time = $time;
  }

  /**
   * {@inheritdoc}
   */
  public static function create(ContainerInterface $container): static {
    return new static(
      $container->get('database'),
      $container->get('state'),
      $container->get('datetime.time')
    );
  }

  /**
   * Get application metrics.
   *
   * @return \Symfony\Component\HttpFoundation\JsonResponse
   *   Metrics response.
   */
  public function get(): JsonResponse {
    $metrics = [
      'timestamp' => date('c', $this->time->getRequestTime()),
      'system' => $this->getSystemMetrics(),
      'database' => $this->getDatabaseMetrics(),
      'entities' => $this->getEntityCounts(),
    ];

    return new JsonResponse($metrics);
  }

  /**
   * Get system metrics.
   *
   * @return array
   *   System metrics.
   */
  protected function getSystemMetrics(): array {
    return [
      'php_version' => PHP_VERSION,
      'drupal_version' => \Drupal::VERSION,
      'memory_limit' => ini_get('memory_limit'),
      'memory_usage_mb' => round(memory_get_usage(TRUE) / 1024 / 1024, 2),
      'peak_memory_mb' => round(memory_get_peak_usage(TRUE) / 1024 / 1024, 2),
      'max_execution_time' => ini_get('max_execution_time'),
      'environment' => getenv('DRUPAL_ENV') ?: 'development',
      'last_cron' => $this->state->get('system.cron_last')
        ? date('c', $this->state->get('system.cron_last'))
        : NULL,
    ];
  }

  /**
   * Get database metrics.
   *
   * @return array
   *   Database metrics.
   */
  protected function getDatabaseMetrics(): array {
    $connectionInfo = $this->database->getConnectionOptions();

    $metrics = [
      'driver' => $connectionInfo['driver'] ?? 'unknown',
      'host' => $connectionInfo['host'] ?? 'unknown',
      'database' => $connectionInfo['database'] ?? 'unknown',
    ];

    // Get database size.
    try {
      $dbName = $connectionInfo['database'];
      $query = $this->database->query(
        "SELECT SUM(data_length + index_length) / 1024 / 1024 AS size_mb
         FROM information_schema.tables
         WHERE table_schema = :db",
        [':db' => $dbName]
      );
      $result = $query->fetchField();
      $metrics['size_mb'] = round((float) $result, 2);
    }
    catch (\Exception $e) {
      $metrics['size_mb'] = 'unavailable';
    }

    // Get table counts.
    try {
      $dbName = $connectionInfo['database'];
      $query = $this->database->query(
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = :db",
        [':db' => $dbName]
      );
      $metrics['table_count'] = (int) $query->fetchField();
    }
    catch (\Exception $e) {
      $metrics['table_count'] = 'unavailable';
    }

    return $metrics;
  }

  /**
   * Get entity counts.
   *
   * @return array
   *   Entity counts.
   */
  protected function getEntityCounts(): array {
    $counts = [];

    $entityTypes = [
      'user' => 'Users',
      'node' => 'Content',
      'media' => 'Media',
    ];

    foreach ($entityTypes as $type => $label) {
      try {
        $storage = $this->entityTypeManager->getStorage($type);
        $count = $storage->getQuery()
          ->accessCheck(FALSE)
          ->count()
          ->execute();
        $counts[$type] = [
          'label' => $label,
          'count' => (int) $count,
        ];
      }
      catch (\Exception $e) {
        $counts[$type] = [
          'label' => $label,
          'count' => 'unavailable',
        ];
      }
    }

    // Get asset-specific counts.
    try {
      $assetStorage = $this->entityTypeManager->getStorage('node');
      $assetCount = $assetStorage->getQuery()
        ->accessCheck(FALSE)
        ->condition('type', 'asset')
        ->count()
        ->execute();
      $counts['assets'] = [
        'label' => 'Assets',
        'count' => (int) $assetCount,
      ];
    }
    catch (\Exception $e) {
      // Asset content type may not exist.
    }

    return $counts;
  }

}
