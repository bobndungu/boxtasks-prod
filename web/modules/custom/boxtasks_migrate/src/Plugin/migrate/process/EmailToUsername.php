<?php

namespace Drupal\boxtasks_migrate\Plugin\migrate\process;

use Drupal\migrate\MigrateExecutableInterface;
use Drupal\migrate\ProcessPluginBase;
use Drupal\migrate\Row;

/**
 * Converts an email address to a valid Drupal username.
 *
 * @MigrateProcessPlugin(
 *   id = "email_to_username"
 * )
 */
class EmailToUsername extends ProcessPluginBase {

  /**
   * {@inheritdoc}
   */
  public function transform($value, MigrateExecutableInterface $migrate_executable, Row $row, $destination_property) {
    return self::convertEmailToUsername($value);
  }

  /**
   * Static transform method for use with callback plugin.
   *
   * @param string $email
   *   The email address.
   *
   * @return string
   *   A valid username derived from the email.
   */
  public static function convertEmailToUsername(string $email): string {
    // Extract the local part before @
    $username = strstr($email, '@', TRUE);

    // If extraction failed, use the whole email
    if (!$username) {
      $username = $email;
    }

    // Remove or replace invalid characters
    // Drupal usernames allow: letters, numbers, spaces, periods, hyphens, underscores, apostrophes
    $username = preg_replace('/[^a-zA-Z0-9.\-_\' ]/', '_', $username);

    // Ensure it's not too long (max 60 chars for Drupal username)
    $username = substr($username, 0, 60);

    // Ensure uniqueness by appending a hash if needed
    $existing = \Drupal::entityTypeManager()
      ->getStorage('user')
      ->loadByProperties(['name' => $username]);

    if (!empty($existing)) {
      // Append part of the original email hash for uniqueness
      $hash = substr(md5($email), 0, 6);
      $username = substr($username, 0, 53) . '_' . $hash;
    }

    return $username;
  }

}
