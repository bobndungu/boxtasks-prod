<?php

declare(strict_types=1);

namespace Drupal\boxtasks_security\EventSubscriber;

use Drupal\boxtasks_security\Service\InputSanitizer;
use Drupal\Core\Logger\LoggerChannelFactoryInterface;
use Psr\Log\LoggerInterface;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpKernel\Event\RequestEvent;
use Symfony\Component\HttpKernel\KernelEvents;

/**
 * Event subscriber for validating and sanitizing input.
 */
class InputValidationSubscriber implements EventSubscriberInterface {

  /**
   * The input sanitizer service.
   */
  protected InputSanitizer $sanitizer;

  /**
   * The logger.
   */
  protected LoggerInterface $logger;

  /**
   * Constructs an InputValidationSubscriber object.
   */
  public function __construct(
    InputSanitizer $sanitizer,
    LoggerChannelFactoryInterface $loggerFactory
  ) {
    $this->sanitizer = $sanitizer;
    $this->logger = $loggerFactory->get('boxtasks_security');
  }

  /**
   * {@inheritdoc}
   */
  public static function getSubscribedEvents(): array {
    // Run after rate limiting but before routing
    return [
      KernelEvents::REQUEST => ['onRequest', 50],
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

    // Only validate JSON:API requests with body content
    if (!str_contains($path, '/jsonapi/')) {
      return;
    }

    $method = $request->getMethod();
    if (!in_array($method, ['POST', 'PATCH', 'PUT'], TRUE)) {
      return;
    }

    $content = $request->getContent();
    if (empty($content)) {
      return;
    }

    // Parse JSON content
    $data = json_decode($content, TRUE);
    if (json_last_error() !== JSON_ERROR_NONE) {
      $event->setResponse($this->createErrorResponse(
        'Invalid JSON',
        'The request body contains invalid JSON.',
        400
      ));
      return;
    }

    // Validate for potential attacks
    $contentString = is_string($content) ? $content : '';
    if ($this->sanitizer->detectSqlInjection($contentString)) {
      $this->logger->warning('Potential SQL injection detected from IP @ip: @content', [
        '@ip' => $request->getClientIp(),
        '@content' => substr($contentString, 0, 500),
      ]);
      $event->setResponse($this->createErrorResponse(
        'Invalid Input',
        'The request contains potentially malicious content.',
        400
      ));
      return;
    }

    if ($this->sanitizer->detectXss($contentString)) {
      $this->logger->warning('Potential XSS detected from IP @ip: @content', [
        '@ip' => $request->getClientIp(),
        '@content' => substr($contentString, 0, 500),
      ]);
      $event->setResponse($this->createErrorResponse(
        'Invalid Input',
        'The request contains potentially malicious content.',
        400
      ));
      return;
    }

    // Sanitize the input data
    if (is_array($data)) {
      // Fields that allow basic HTML formatting
      $allowHtmlFields = ['description', 'body', 'content', 'notes'];
      $sanitizedData = $this->sanitizeJsonApiData($data, $allowHtmlFields);

      // Update the request with sanitized content
      $request->initialize(
        $request->query->all(),
        $request->request->all(),
        $request->attributes->all(),
        $request->cookies->all(),
        $request->files->all(),
        $request->server->all(),
        json_encode($sanitizedData)
      );
    }
  }

  /**
   * Sanitize JSON:API formatted data.
   *
   * @param array $data
   *   The JSON:API data.
   * @param array $allowHtmlFields
   *   Fields that allow HTML.
   *
   * @return array
   *   The sanitized data.
   */
  protected function sanitizeJsonApiData(array $data, array $allowHtmlFields): array {
    // Sanitize attributes if present
    if (isset($data['data']['attributes']) && is_array($data['data']['attributes'])) {
      $data['data']['attributes'] = $this->sanitizer->sanitizeArray(
        $data['data']['attributes'],
        $allowHtmlFields
      );
    }

    // Handle array of items
    if (isset($data['data']) && is_array($data['data']) && isset($data['data'][0])) {
      foreach ($data['data'] as $key => $item) {
        if (isset($item['attributes']) && is_array($item['attributes'])) {
          $data['data'][$key]['attributes'] = $this->sanitizer->sanitizeArray(
            $item['attributes'],
            $allowHtmlFields
          );
        }
      }
    }

    return $data;
  }

  /**
   * Create a JSON:API error response.
   *
   * @param string $title
   *   The error title.
   * @param string $detail
   *   The error detail.
   * @param int $status
   *   The HTTP status code.
   *
   * @return \Symfony\Component\HttpFoundation\JsonResponse
   *   The error response.
   */
  protected function createErrorResponse(string $title, string $detail, int $status): JsonResponse {
    return new JsonResponse([
      'errors' => [
        [
          'status' => (string) $status,
          'title' => $title,
          'detail' => $detail,
          'code' => 'VALIDATION_ERROR',
        ],
      ],
    ], $status);
  }

}
