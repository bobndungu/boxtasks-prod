<?php

declare(strict_types=1);

namespace Drupal\boxtasks_security\Service;

use Drupal\Component\Datetime\TimeInterface;
use Drupal\Core\Database\Connection;
use Drupal\Core\Session\AccountProxyInterface;
use Symfony\Component\HttpFoundation\RequestStack;

/**
 * Service for logging security audit events.
 */
class AuditLogger {

  /**
   * Event severity levels.
   */
  public const SEVERITY_DEBUG = 'debug';
  public const SEVERITY_INFO = 'info';
  public const SEVERITY_NOTICE = 'notice';
  public const SEVERITY_WARNING = 'warning';
  public const SEVERITY_ERROR = 'error';
  public const SEVERITY_CRITICAL = 'critical';

  /**
   * Event types.
   */
  public const EVENT_AUTH_SUCCESS = 'auth_success';
  public const EVENT_AUTH_FAILURE = 'auth_failure';
  public const EVENT_AUTH_LOGOUT = 'auth_logout';
  public const EVENT_RATE_LIMIT = 'rate_limit';
  public const EVENT_XSS_ATTEMPT = 'xss_attempt';
  public const EVENT_SQL_INJECTION = 'sql_injection';
  public const EVENT_CSRF_FAILURE = 'csrf_failure';
  public const EVENT_ACCESS_DENIED = 'access_denied';
  public const EVENT_INPUT_VALIDATION = 'input_validation';
  public const EVENT_TOKEN_REFRESH = 'token_refresh';
  public const EVENT_PASSWORD_CHANGE = 'password_change';
  public const EVENT_PERMISSION_CHANGE = 'permission_change';
  public const EVENT_DATA_EXPORT = 'data_export';
  public const EVENT_ADMIN_ACTION = 'admin_action';

  /**
   * The database connection.
   */
  protected Connection $database;

  /**
   * The current user.
   */
  protected AccountProxyInterface $currentUser;

  /**
   * The time service.
   */
  protected TimeInterface $time;

  /**
   * The request stack.
   */
  protected ?RequestStack $requestStack = NULL;

  /**
   * Constructs an AuditLogger object.
   */
  public function __construct(
    Connection $database,
    AccountProxyInterface $currentUser,
    TimeInterface $time
  ) {
    $this->database = $database;
    $this->currentUser = $currentUser;
    $this->time = $time;
  }

  /**
   * Sets the request stack.
   *
   * @param \Symfony\Component\HttpFoundation\RequestStack $requestStack
   *   The request stack.
   */
  public function setRequestStack(RequestStack $requestStack): void {
    $this->requestStack = $requestStack;
  }

  /**
   * Log a security event.
   *
   * @param string $eventType
   *   The type of event.
   * @param string $message
   *   The event message.
   * @param array $context
   *   Additional context data.
   * @param string $severity
   *   The severity level.
   * @param int|null $uid
   *   Optional user ID (defaults to current user).
   */
  public function log(
    string $eventType,
    string $message,
    array $context = [],
    string $severity = self::SEVERITY_INFO,
    ?int $uid = NULL
  ): void {
    $request = $this->requestStack?->getCurrentRequest();

    $fields = [
      'event_type' => $eventType,
      'severity' => $severity,
      'message' => $message,
      'context' => !empty($context) ? json_encode($context) : NULL,
      'ip_address' => $request?->getClientIp(),
      'user_agent' => $request ? substr($request->headers->get('User-Agent', ''), 0, 512) : NULL,
      'request_uri' => $request ? substr($request->getRequestUri(), 0, 2048) : NULL,
      'request_method' => $request?->getMethod(),
      'uid' => $uid ?? ($this->currentUser->isAuthenticated() ? (int) $this->currentUser->id() : NULL),
      'created' => $this->time->getRequestTime(),
    ];

    try {
      $this->database->insert('boxtasks_audit_log')
        ->fields($fields)
        ->execute();
    }
    catch (\Exception $e) {
      // If database insert fails, log to watchdog as fallback.
      \Drupal::logger('boxtasks_security')->error('Failed to write audit log: @error', [
        '@error' => $e->getMessage(),
      ]);
    }
  }

  /**
   * Log authentication success.
   */
  public function logAuthSuccess(int $uid, string $method = 'password'): void {
    $this->log(
      self::EVENT_AUTH_SUCCESS,
      'User authenticated successfully',
      ['method' => $method],
      self::SEVERITY_INFO,
      $uid
    );
  }

  /**
   * Log authentication failure.
   */
  public function logAuthFailure(string $username, string $reason = 'invalid_credentials'): void {
    $this->log(
      self::EVENT_AUTH_FAILURE,
      'Authentication failed for user: @username',
      [
        'username' => $username,
        'reason' => $reason,
      ],
      self::SEVERITY_WARNING
    );
  }

  /**
   * Log logout.
   */
  public function logLogout(int $uid): void {
    $this->log(
      self::EVENT_AUTH_LOGOUT,
      'User logged out',
      [],
      self::SEVERITY_INFO,
      $uid
    );
  }

  /**
   * Log rate limit exceeded.
   */
  public function logRateLimitExceeded(string $limitType, ?string $identifier = NULL): void {
    $this->log(
      self::EVENT_RATE_LIMIT,
      'Rate limit exceeded for @type',
      [
        'limit_type' => $limitType,
        'identifier' => $identifier,
      ],
      self::SEVERITY_WARNING
    );
  }

  /**
   * Log XSS attempt detected.
   */
  public function logXssAttempt(string $input, ?string $field = NULL): void {
    $this->log(
      self::EVENT_XSS_ATTEMPT,
      'Potential XSS attack detected',
      [
        'field' => $field,
        'input_sample' => substr($input, 0, 200),
      ],
      self::SEVERITY_ERROR
    );
  }

  /**
   * Log SQL injection attempt detected.
   */
  public function logSqlInjectionAttempt(string $input, ?string $field = NULL): void {
    $this->log(
      self::EVENT_SQL_INJECTION,
      'Potential SQL injection attempt detected',
      [
        'field' => $field,
        'input_sample' => substr($input, 0, 200),
      ],
      self::SEVERITY_CRITICAL
    );
  }

  /**
   * Log CSRF validation failure.
   */
  public function logCsrfFailure(): void {
    $this->log(
      self::EVENT_CSRF_FAILURE,
      'CSRF token validation failed',
      [],
      self::SEVERITY_WARNING
    );
  }

  /**
   * Log access denied.
   */
  public function logAccessDenied(string $resource, ?string $action = NULL): void {
    $this->log(
      self::EVENT_ACCESS_DENIED,
      'Access denied to @resource',
      [
        'resource' => $resource,
        'action' => $action,
      ],
      self::SEVERITY_WARNING
    );
  }

  /**
   * Log input validation failure.
   */
  public function logInputValidationFailure(string $field, string $reason): void {
    $this->log(
      self::EVENT_INPUT_VALIDATION,
      'Input validation failed for @field',
      [
        'field' => $field,
        'reason' => $reason,
      ],
      self::SEVERITY_NOTICE
    );
  }

  /**
   * Log admin action.
   */
  public function logAdminAction(string $action, array $details = []): void {
    $this->log(
      self::EVENT_ADMIN_ACTION,
      'Admin action: @action',
      $details,
      self::SEVERITY_NOTICE
    );
  }

  /**
   * Get audit logs with filtering.
   *
   * @param array $filters
   *   Filter criteria.
   * @param int $limit
   *   Maximum number of results.
   * @param int $offset
   *   Result offset.
   *
   * @return array
   *   Array of log entries.
   */
  public function getLogs(array $filters = [], int $limit = 100, int $offset = 0): array {
    $query = $this->database->select('boxtasks_audit_log', 'al')
      ->fields('al')
      ->orderBy('created', 'DESC')
      ->range($offset, $limit);

    if (!empty($filters['event_type'])) {
      $query->condition('event_type', $filters['event_type']);
    }

    if (!empty($filters['severity'])) {
      $query->condition('severity', $filters['severity']);
    }

    if (!empty($filters['ip_address'])) {
      $query->condition('ip_address', $filters['ip_address']);
    }

    if (!empty($filters['uid'])) {
      $query->condition('uid', $filters['uid']);
    }

    if (!empty($filters['from_date'])) {
      $query->condition('created', $filters['from_date'], '>=');
    }

    if (!empty($filters['to_date'])) {
      $query->condition('created', $filters['to_date'], '<=');
    }

    $results = $query->execute()->fetchAll();

    return array_map(function ($row) {
      $row->context = $row->context ? json_decode($row->context, TRUE) : [];
      return $row;
    }, $results);
  }

  /**
   * Get log count with filtering.
   *
   * @param array $filters
   *   Filter criteria.
   *
   * @return int
   *   Number of matching logs.
   */
  public function getLogCount(array $filters = []): int {
    $query = $this->database->select('boxtasks_audit_log', 'al');
    $query->addExpression('COUNT(*)', 'count');

    if (!empty($filters['event_type'])) {
      $query->condition('event_type', $filters['event_type']);
    }

    if (!empty($filters['severity'])) {
      $query->condition('severity', $filters['severity']);
    }

    if (!empty($filters['from_date'])) {
      $query->condition('created', $filters['from_date'], '>=');
    }

    if (!empty($filters['to_date'])) {
      $query->condition('created', $filters['to_date'], '<=');
    }

    return (int) $query->execute()->fetchField();
  }

  /**
   * Get security statistics for dashboard.
   *
   * @param int $period
   *   Time period in seconds (default 24 hours).
   *
   * @return array
   *   Security statistics.
   */
  public function getSecurityStats(int $period = 86400): array {
    $since = $this->time->getRequestTime() - $period;

    $stats = [
      'auth_successes' => 0,
      'auth_failures' => 0,
      'rate_limits' => 0,
      'xss_attempts' => 0,
      'sql_injections' => 0,
      'access_denied' => 0,
      'total_events' => 0,
    ];

    $query = $this->database->select('boxtasks_audit_log', 'al')
      ->fields('al', ['event_type'])
      ->condition('created', $since, '>=');
    $query->addExpression('COUNT(*)', 'count');
    $query->groupBy('event_type');

    $results = $query->execute()->fetchAllKeyed();

    foreach ($results as $eventType => $count) {
      $stats['total_events'] += $count;

      switch ($eventType) {
        case self::EVENT_AUTH_SUCCESS:
          $stats['auth_successes'] = (int) $count;
          break;

        case self::EVENT_AUTH_FAILURE:
          $stats['auth_failures'] = (int) $count;
          break;

        case self::EVENT_RATE_LIMIT:
          $stats['rate_limits'] = (int) $count;
          break;

        case self::EVENT_XSS_ATTEMPT:
          $stats['xss_attempts'] = (int) $count;
          break;

        case self::EVENT_SQL_INJECTION:
          $stats['sql_injections'] = (int) $count;
          break;

        case self::EVENT_ACCESS_DENIED:
          $stats['access_denied'] = (int) $count;
          break;
      }
    }

    return $stats;
  }

  /**
   * Cleanup old audit logs.
   *
   * @param int $retentionDays
   *   Number of days to retain logs.
   *
   * @return int
   *   Number of deleted records.
   */
  public function cleanup(int $retentionDays = 90): int {
    $cutoff = $this->time->getRequestTime() - ($retentionDays * 86400);

    return $this->database->delete('boxtasks_audit_log')
      ->condition('created', $cutoff, '<')
      ->execute();
  }

}
