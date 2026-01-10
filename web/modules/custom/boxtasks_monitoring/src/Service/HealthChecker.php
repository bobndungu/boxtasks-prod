<?php

declare(strict_types=1);

namespace Drupal\boxtasks_monitoring\Service;

use Drupal\Component\Datetime\TimeInterface;
use Drupal\Core\Cache\CacheBackendInterface;
use Drupal\Core\Database\Connection;
use Drupal\Core\State\StateInterface;

/**
 * Service for checking system health.
 */
class HealthChecker {

  /**
   * Health status constants.
   */
  public const STATUS_HEALTHY = 'healthy';
  public const STATUS_DEGRADED = 'degraded';
  public const STATUS_UNHEALTHY = 'unhealthy';

  /**
   * The database connection.
   */
  protected Connection $database;

  /**
   * The state service.
   */
  protected StateInterface $state;

  /**
   * The cache backend.
   */
  protected CacheBackendInterface $cache;

  /**
   * The time service.
   */
  protected TimeInterface $time;

  /**
   * Constructs a HealthChecker object.
   */
  public function __construct(
    Connection $database,
    StateInterface $state,
    CacheBackendInterface $cache,
    TimeInterface $time
  ) {
    $this->database = $database;
    $this->state = $state;
    $this->cache = $cache;
    $this->time = $time;
  }

  /**
   * Perform a basic health check.
   *
   * @return array
   *   Health check result.
   */
  public function check(): array {
    $checks = [
      'database' => $this->checkDatabase(),
      'cache' => $this->checkCache(),
    ];

    $status = self::STATUS_HEALTHY;
    foreach ($checks as $check) {
      if ($check['status'] === self::STATUS_UNHEALTHY) {
        $status = self::STATUS_UNHEALTHY;
        break;
      }
      if ($check['status'] === self::STATUS_DEGRADED) {
        $status = self::STATUS_DEGRADED;
      }
    }

    return [
      'status' => $status,
      'timestamp' => date('c', $this->time->getRequestTime()),
      'checks' => $checks,
    ];
  }

  /**
   * Perform a detailed health check with metrics.
   *
   * @return array
   *   Detailed health check result.
   */
  public function detailed(): array {
    $checks = [
      'database' => $this->checkDatabase(TRUE),
      'cache' => $this->checkCache(TRUE),
      'filesystem' => $this->checkFilesystem(),
      'memory' => $this->checkMemory(),
      'cron' => $this->checkCron(),
    ];

    $status = self::STATUS_HEALTHY;
    $unhealthyCount = 0;
    $degradedCount = 0;

    foreach ($checks as $check) {
      if ($check['status'] === self::STATUS_UNHEALTHY) {
        $unhealthyCount++;
      }
      if ($check['status'] === self::STATUS_DEGRADED) {
        $degradedCount++;
      }
    }

    if ($unhealthyCount > 0) {
      $status = self::STATUS_UNHEALTHY;
    }
    elseif ($degradedCount > 0) {
      $status = self::STATUS_DEGRADED;
    }

    return [
      'status' => $status,
      'timestamp' => date('c', $this->time->getRequestTime()),
      'version' => \Drupal::VERSION,
      'environment' => getenv('DRUPAL_ENV') ?: 'development',
      'uptime' => $this->getUptime(),
      'checks' => $checks,
    ];
  }

  /**
   * Check database connectivity and performance.
   *
   * @param bool $detailed
   *   Whether to include detailed metrics.
   *
   * @return array
   *   Check result.
   */
  protected function checkDatabase(bool $detailed = FALSE): array {
    $start = microtime(TRUE);

    try {
      // Simple query to verify connection.
      $result = $this->database->query('SELECT 1')->fetchField();

      $responseTime = (microtime(TRUE) - $start) * 1000;

      if ($result != 1) {
        return [
          'status' => self::STATUS_UNHEALTHY,
          'message' => 'Database query returned unexpected result',
        ];
      }

      $status = $responseTime < 100 ? self::STATUS_HEALTHY :
                ($responseTime < 500 ? self::STATUS_DEGRADED : self::STATUS_UNHEALTHY);

      $response = [
        'status' => $status,
        'message' => 'Database connection successful',
        'response_time_ms' => round($responseTime, 2),
      ];

      if ($detailed) {
        // Get connection info.
        $connectionInfo = $this->database->getConnectionOptions();
        $response['driver'] = $connectionInfo['driver'] ?? 'unknown';
        $response['host'] = $connectionInfo['host'] ?? 'unknown';
      }

      return $response;
    }
    catch (\Exception $e) {
      return [
        'status' => self::STATUS_UNHEALTHY,
        'message' => 'Database connection failed: ' . $e->getMessage(),
      ];
    }
  }

  /**
   * Check cache system.
   *
   * @param bool $detailed
   *   Whether to include detailed metrics.
   *
   * @return array
   *   Check result.
   */
  protected function checkCache(bool $detailed = FALSE): array {
    $testKey = 'health_check_' . $this->time->getRequestTime();
    $testValue = 'test_value_' . mt_rand();
    $start = microtime(TRUE);

    try {
      // Test cache write.
      $this->cache->set($testKey, $testValue, $this->time->getRequestTime() + 60);

      // Test cache read.
      $cached = $this->cache->get($testKey);

      // Test cache delete.
      $this->cache->delete($testKey);

      $responseTime = (microtime(TRUE) - $start) * 1000;

      if (!$cached || $cached->data !== $testValue) {
        return [
          'status' => self::STATUS_DEGRADED,
          'message' => 'Cache read/write test failed',
        ];
      }

      $status = $responseTime < 50 ? self::STATUS_HEALTHY :
                ($responseTime < 200 ? self::STATUS_DEGRADED : self::STATUS_UNHEALTHY);

      $response = [
        'status' => $status,
        'message' => 'Cache working correctly',
        'response_time_ms' => round($responseTime, 2),
      ];

      if ($detailed) {
        $response['backend'] = get_class($this->cache);
      }

      return $response;
    }
    catch (\Exception $e) {
      return [
        'status' => self::STATUS_DEGRADED,
        'message' => 'Cache test failed: ' . $e->getMessage(),
      ];
    }
  }

  /**
   * Check filesystem access.
   *
   * @return array
   *   Check result.
   */
  protected function checkFilesystem(): array {
    $tempDir = \Drupal::service('file_system')->getTempDirectory();
    $testFile = $tempDir . '/health_check_' . $this->time->getRequestTime();

    try {
      // Test write.
      if (!file_put_contents($testFile, 'test')) {
        return [
          'status' => self::STATUS_DEGRADED,
          'message' => 'Cannot write to temp directory',
        ];
      }

      // Test read.
      $content = file_get_contents($testFile);

      // Cleanup.
      unlink($testFile);

      if ($content !== 'test') {
        return [
          'status' => self::STATUS_DEGRADED,
          'message' => 'File read test failed',
        ];
      }

      // Check disk space.
      $freeSpace = disk_free_space($tempDir);
      $totalSpace = disk_total_space($tempDir);
      $usedPercent = 100 - ($freeSpace / $totalSpace * 100);

      $status = $usedPercent < 80 ? self::STATUS_HEALTHY :
                ($usedPercent < 95 ? self::STATUS_DEGRADED : self::STATUS_UNHEALTHY);

      return [
        'status' => $status,
        'message' => 'Filesystem accessible',
        'disk_used_percent' => round($usedPercent, 1),
        'disk_free_gb' => round($freeSpace / 1024 / 1024 / 1024, 2),
      ];
    }
    catch (\Exception $e) {
      return [
        'status' => self::STATUS_DEGRADED,
        'message' => 'Filesystem check failed: ' . $e->getMessage(),
      ];
    }
  }

  /**
   * Check memory usage.
   *
   * @return array
   *   Check result.
   */
  protected function checkMemory(): array {
    $memoryLimit = ini_get('memory_limit');
    $memoryLimitBytes = $this->parseBytes($memoryLimit);
    $memoryUsage = memory_get_usage(TRUE);
    $peakMemory = memory_get_peak_usage(TRUE);

    $usedPercent = ($memoryUsage / $memoryLimitBytes) * 100;
    $peakPercent = ($peakMemory / $memoryLimitBytes) * 100;

    $status = $usedPercent < 70 ? self::STATUS_HEALTHY :
              ($usedPercent < 90 ? self::STATUS_DEGRADED : self::STATUS_UNHEALTHY);

    return [
      'status' => $status,
      'message' => 'Memory usage within limits',
      'memory_limit' => $memoryLimit,
      'current_usage_mb' => round($memoryUsage / 1024 / 1024, 2),
      'peak_usage_mb' => round($peakMemory / 1024 / 1024, 2),
      'used_percent' => round($usedPercent, 1),
    ];
  }

  /**
   * Check cron status.
   *
   * @return array
   *   Check result.
   */
  protected function checkCron(): array {
    $lastCron = $this->state->get('system.cron_last', 0);
    $currentTime = $this->time->getRequestTime();
    $timeSinceCron = $currentTime - $lastCron;

    // Cron should run at least every hour.
    $status = $timeSinceCron < 3600 ? self::STATUS_HEALTHY :
              ($timeSinceCron < 86400 ? self::STATUS_DEGRADED : self::STATUS_UNHEALTHY);

    return [
      'status' => $status,
      'message' => $lastCron ? 'Cron running' : 'Cron has never run',
      'last_run' => $lastCron ? date('c', $lastCron) : NULL,
      'time_since_last_run_seconds' => $timeSinceCron,
    ];
  }

  /**
   * Get system uptime.
   *
   * @return array
   *   Uptime information.
   */
  protected function getUptime(): array {
    $installTime = $this->state->get('system.install_time', $this->time->getRequestTime());
    $uptime = $this->time->getRequestTime() - $installTime;

    return [
      'seconds' => $uptime,
      'human' => $this->formatDuration($uptime),
    ];
  }

  /**
   * Parse memory/filesize string to bytes.
   *
   * @param string $value
   *   The value to parse.
   *
   * @return int
   *   The value in bytes.
   */
  protected function parseBytes(string $value): int {
    $value = trim($value);
    $last = strtolower($value[strlen($value) - 1]);
    $numericValue = (int) $value;

    switch ($last) {
      case 'g':
        $numericValue *= 1024;
        // Fall through.
      case 'm':
        $numericValue *= 1024;
        // Fall through.
      case 'k':
        $numericValue *= 1024;
    }

    return $numericValue;
  }

  /**
   * Format duration in human-readable format.
   *
   * @param int $seconds
   *   Duration in seconds.
   *
   * @return string
   *   Formatted duration.
   */
  protected function formatDuration(int $seconds): string {
    $days = floor($seconds / 86400);
    $hours = floor(($seconds % 86400) / 3600);
    $minutes = floor(($seconds % 3600) / 60);

    $parts = [];
    if ($days > 0) {
      $parts[] = $days . 'd';
    }
    if ($hours > 0) {
      $parts[] = $hours . 'h';
    }
    if ($minutes > 0 || empty($parts)) {
      $parts[] = $minutes . 'm';
    }

    return implode(' ', $parts);
  }

}
