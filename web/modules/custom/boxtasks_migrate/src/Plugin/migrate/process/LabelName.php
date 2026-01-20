<?php

namespace Drupal\boxtasks_migrate\Plugin\migrate\process;

use Drupal\migrate\MigrateExecutableInterface;
use Drupal\migrate\ProcessPluginBase;
use Drupal\migrate\Row;

/**
 * Generates a label name from name and color.
 *
 * @MigrateProcessPlugin(
 *   id = "label_name"
 * )
 */
class LabelName extends ProcessPluginBase {

  /**
   * {@inheritdoc}
   */
  public function transform($value, MigrateExecutableInterface $migrate_executable, Row $row, $destination_property) {
    if (is_array($value)) {
      return self::generateName($value[0] ?? '', $value[1] ?? '');
    }
    return $value ?: 'Unnamed Label';
  }

  /**
   * Static transform method for use with callback plugin.
   *
   * @param string $name
   *   The label name (may be empty).
   * @param string $color
   *   The label color.
   *
   * @return string
   *   A label name.
   */
  public static function generateName(string $name, string $color): string {
    if (!empty($name)) {
      return $name;
    }

    // Use color as the name if name is empty
    if (!empty($color)) {
      return ucfirst($color) . ' Label';
    }

    return 'Unnamed Label';
  }

}
