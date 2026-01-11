<?php

declare(strict_types=1);

namespace Drupal\boxtasks_security\Service;

use Drupal\Component\Utility\Html;
use Drupal\Component\Utility\Xss;

/**
 * Service for sanitizing user input to prevent XSS and injection attacks.
 */
class InputSanitizer {

  /**
   * Sanitize a string by removing dangerous HTML and scripts.
   *
   * @param string $input
   *   The input string to sanitize.
   * @param bool $allowBasicHtml
   *   Whether to allow basic HTML tags.
   *
   * @return string
   *   The sanitized string.
   */
  public function sanitizeString(string $input, bool $allowBasicHtml = FALSE): string {
    // First, decode any HTML entities
    $input = html_entity_decode($input, ENT_QUOTES | ENT_HTML5, 'UTF-8');

    if ($allowBasicHtml) {
      // Allow basic formatting tags
      return Xss::filter($input, [
        'a', 'b', 'i', 'u', 'strong', 'em', 'br', 'p',
        'ul', 'ol', 'li', 'blockquote', 'code', 'pre',
      ]);
    }

    // Remove all HTML tags
    return Html::escape(strip_tags($input));
  }

  /**
   * Sanitize an array of data recursively.
   *
   * @param array $data
   *   The data array to sanitize.
   * @param array $allowHtmlFields
   *   Fields that should allow basic HTML.
   *
   * @return array
   *   The sanitized data array.
   */
  public function sanitizeArray(array $data, array $allowHtmlFields = []): array {
    $sanitized = [];

    foreach ($data as $key => $value) {
      if (is_array($value)) {
        $sanitized[$key] = $this->sanitizeArray($value, $allowHtmlFields);
      }
      elseif (is_string($value)) {
        $allowHtml = in_array($key, $allowHtmlFields, TRUE);
        $sanitized[$key] = $this->sanitizeString($value, $allowHtml);
      }
      else {
        // For non-string, non-array values, keep as is
        $sanitized[$key] = $value;
      }
    }

    return $sanitized;
  }

  /**
   * Validate and sanitize an email address.
   *
   * @param string $email
   *   The email address to validate.
   *
   * @return string|null
   *   The sanitized email or NULL if invalid.
   */
  public function sanitizeEmail(string $email): ?string {
    $email = trim(strtolower($email));
    $email = filter_var($email, FILTER_SANITIZE_EMAIL);

    if (filter_var($email, FILTER_VALIDATE_EMAIL)) {
      return $email;
    }

    return NULL;
  }

  /**
   * Sanitize a URL.
   *
   * @param string $url
   *   The URL to sanitize.
   * @param array $allowedProtocols
   *   Allowed URL protocols.
   *
   * @return string|null
   *   The sanitized URL or NULL if invalid.
   */
  public function sanitizeUrl(string $url, array $allowedProtocols = ['http', 'https']): ?string {
    $url = trim($url);
    $url = filter_var($url, FILTER_SANITIZE_URL);

    if (!filter_var($url, FILTER_VALIDATE_URL)) {
      return NULL;
    }

    // Check protocol
    $parsed = parse_url($url);
    if (!isset($parsed['scheme']) || !in_array($parsed['scheme'], $allowedProtocols, TRUE)) {
      return NULL;
    }

    return $url;
  }

  /**
   * Sanitize a filename.
   *
   * @param string $filename
   *   The filename to sanitize.
   *
   * @return string
   *   The sanitized filename.
   */
  public function sanitizeFilename(string $filename): string {
    // Remove path components
    $filename = basename($filename);

    // Remove dangerous characters
    $filename = preg_replace('/[^\w\.\-]/', '_', $filename);

    // Prevent double extensions
    $filename = preg_replace('/\.+/', '.', $filename);

    // Ensure it doesn't start with a dot
    $filename = ltrim($filename, '.');

    // Limit length
    if (strlen($filename) > 255) {
      $extension = pathinfo($filename, PATHINFO_EXTENSION);
      $name = pathinfo($filename, PATHINFO_FILENAME);
      $name = substr($name, 0, 250 - strlen($extension));
      $filename = $name . '.' . $extension;
    }

    return $filename ?: 'unnamed';
  }

  /**
   * Validate input length.
   *
   * @param string $input
   *   The input string.
   * @param int $minLength
   *   Minimum length.
   * @param int $maxLength
   *   Maximum length.
   *
   * @return bool
   *   TRUE if length is valid.
   */
  public function validateLength(string $input, int $minLength = 0, int $maxLength = PHP_INT_MAX): bool {
    $length = mb_strlen($input);
    return $length >= $minLength && $length <= $maxLength;
  }

  /**
   * Check if input contains potential SQL injection patterns.
   *
   * @param string $input
   *   The input to check.
   *
   * @return bool
   *   TRUE if potential SQL injection detected.
   */
  public function detectSqlInjection(string $input): bool {
    // Skip SQL injection detection for JSON:API payloads
    // JSON:API uses type names like "node--card", "user--user" which
    // would trigger false positives on comment detection patterns.
    // The JSON:API module has its own security measures.
    if (str_contains($input, '"type":"') || str_contains($input, '"type": "')) {
      return FALSE;
    }

    $patterns = [
      '/(\bunion\b.*\bselect\b)/i',
      '/(\bselect\b.*\bfrom\b)/i',
      '/(\binsert\b.*\binto\b)/i',
      '/(\bdelete\b.*\bfrom\b)/i',
      '/(\bdrop\b.*\btable\b)/i',
      '/(\bupdate\b.*\bset\b)/i',
      // Match SQL comments only when preceded by whitespace or start of line
      // to avoid false positives on JSON:API types like "node--card"
      '/(\s--|^--)/',
      '/(\s#|^#)/',
      '/(\/\*)/i',
      // Match OR/AND injection only when followed by comparison operators
      '/(\bor\b\s+[\'\"\d\w]+\s*=\s*[\'\"\d\w]+)/i',
      '/(\band\b\s+[\'\"\d\w]+\s*=\s*[\'\"\d\w]+)/i',
    ];

    foreach ($patterns as $pattern) {
      if (preg_match($pattern, $input)) {
        return TRUE;
      }
    }

    return FALSE;
  }

  /**
   * Check if input contains potential XSS patterns.
   *
   * @param string $input
   *   The input to check.
   *
   * @return bool
   *   TRUE if potential XSS detected.
   */
  public function detectXss(string $input): bool {
    $patterns = [
      '/<script[^>]*>.*<\/script>/is',
      '/javascript:/i',
      '/on\w+\s*=/i',
      '/<iframe/i',
      '/<object/i',
      '/<embed/i',
      '/<svg.*on\w+/i',
      '/data:\s*text\/html/i',
    ];

    foreach ($patterns as $pattern) {
      if (preg_match($pattern, $input)) {
        return TRUE;
      }
    }

    return FALSE;
  }

}
