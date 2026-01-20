<?php

declare(strict_types=1);

namespace Drupal\boxtasks_security\EventSubscriber;

use Drupal\boxtasks_security\Service\AuditLogger;
use Drupal\boxtasks_security\Service\RateLimiter;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpKernel\Event\RequestEvent;
use Symfony\Component\HttpKernel\KernelEvents;

/**
 * Event subscriber for rate limiting requests.
 */
class RateLimitSubscriber implements EventSubscriberInterface {

  /**
   * The rate limiter service.
   */
  protected RateLimiter $rateLimiter;

  /**
   * The audit logger service.
   */
  protected AuditLogger $auditLogger;

  /**
   * Constructs a RateLimitSubscriber object.
   */
  public function __construct(RateLimiter $rateLimiter, AuditLogger $auditLogger) {
    $this->rateLimiter = $rateLimiter;
    $this->auditLogger = $auditLogger;
  }

  /**
   * {@inheritdoc}
   */
  public static function getSubscribedEvents(): array {
    // High priority to run before other subscribers
    return [
      KernelEvents::REQUEST => ['onRequest', 100],
    ];
  }

  /**
   * Handle the request event.
   *
   * @param \Symfony\Component\HttpKernel\Event\RequestEvent $event
   *   The request event.
   */
  public function onRequest(RequestEvent $event): void {
    $request = $event->getRequest();
    $path = $request->getPathInfo();
    $method = $request->getMethod();

    // Skip rate limiting for certain paths
    if ($this->shouldSkip($path)) {
      return;
    }

    // Determine rate limit type based on path and method
    $type = $this->rateLimiter->determineType($path, $method);

    // Check if request is allowed
    if (!$this->rateLimiter->checkAndRegister($type)) {
      // Log rate limit exceeded
      $this->auditLogger->logRateLimitExceeded($type, $request->getClientIp());

      // Rate limit exceeded - return 429 response
      $response = new JsonResponse([
        'errors' => [
          [
            'status' => '429',
            'title' => 'Too Many Requests',
            'detail' => 'Rate limit exceeded. Please wait before making more requests.',
            'code' => 'RATE_LIMITED',
          ],
        ],
      ], 429);

      // Add rate limit headers
      $info = $this->rateLimiter->getRemainingRequests($type);
      $response->headers->set('X-RateLimit-Limit', (string) $info['limit']);
      $response->headers->set('X-RateLimit-Reset', (string) $info['reset']);
      $response->headers->set('Retry-After', (string) $info['window']);

      $event->setResponse($response);
    }
  }

  /**
   * Check if rate limiting should be skipped for this path.
   *
   * @param string $path
   *   The request path.
   *
   * @return bool
   *   TRUE if rate limiting should be skipped.
   */
  protected function shouldSkip(string $path): bool {
    // Skip for admin paths
    if (str_starts_with($path, '/admin')) {
      return TRUE;
    }

    // Skip for system paths
    if (str_starts_with($path, '/core') ||
        str_starts_with($path, '/sites')) {
      return TRUE;
    }

    // Skip for static assets
    $extensions = ['.css', '.js', '.png', '.jpg', '.gif', '.svg', '.woff', '.woff2'];
    foreach ($extensions as $ext) {
      if (str_ends_with($path, $ext)) {
        return TRUE;
      }
    }

    return FALSE;
  }

}
