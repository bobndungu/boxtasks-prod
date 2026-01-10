<?php

namespace Drupal\boxtasks_migrate\Plugin\migrate\process;

use Drupal\Component\Utility\Crypt;
use Drupal\migrate\MigrateExecutableInterface;
use Drupal\migrate\ProcessPluginBase;
use Drupal\migrate\Row;

/**
 * Handles password migration from bcrypt hashes.
 *
 * BoxTasks uses bcrypt password hashes which are compatible with PHP's
 * password_verify(). Drupal also uses bcrypt (via PhpassHashedPassword).
 * However, the hash formats may differ slightly, so we generate new
 * random passwords for migrated users and they'll need to reset.
 *
 * @MigrateProcessPlugin(
 *   id = "password_migrate"
 * )
 */
class PasswordMigrate extends ProcessPluginBase {

  /**
   * {@inheritdoc}
   */
  public function transform($value, MigrateExecutableInterface $migrate_executable, Row $row, $destination_property) {
    return self::migratePassword($value);
  }

  /**
   * Static transform method for use with callback plugin.
   *
   * @param string|null $password_hash
   *   The original bcrypt password hash.
   *
   * @return string
   *   A new random password (users will need to reset).
   */
  public static function migratePassword(?string $password_hash): string {
    // For security, we generate a new random password
    // Users will need to use "Forgot Password" to set a new password
    // This is safer than trying to migrate password hashes directly
    return Crypt::randomBytesBase64(32);
  }

}
