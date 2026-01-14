<?php

namespace Drupal\boxtasks_migrate\Commands;

use Drupal\Core\Entity\EntityTypeManagerInterface;
use Drupal\Core\File\FileSystemInterface;
use Drupal\user\Entity\User;
use Drush\Attributes as CLI;
use Drush\Commands\DrushCommands;
use Symfony\Component\DependencyInjection\ContainerInterface;

/**
 * Drush commands for importing users from production BoxTasks.
 */
class UserImportCommands extends DrushCommands {

  /**
   * The entity type manager.
   *
   * @var \Drupal\Core\Entity\EntityTypeManagerInterface
   */
  protected $entityTypeManager;

  /**
   * The file system service.
   *
   * @var \Drupal\Core\File\FileSystemInterface
   */
  protected $fileSystem;

  /**
   * Constructs a UserImportCommands object.
   *
   * @param \Drupal\Core\Entity\EntityTypeManagerInterface $entity_type_manager
   *   The entity type manager.
   * @param \Drupal\Core\File\FileSystemInterface $file_system
   *   The file system service.
   */
  public function __construct(EntityTypeManagerInterface $entity_type_manager, FileSystemInterface $file_system) {
    parent::__construct();
    $this->entityTypeManager = $entity_type_manager;
    $this->fileSystem = $file_system;
  }

  /**
   * {@inheritdoc}
   */
  public static function create(ContainerInterface $container) {
    return new static(
      $container->get('entity_type.manager'),
      $container->get('file_system')
    );
  }

  /**
   * Import users from production BoxTasks (tasks.boxraft.com).
   *
   * Uses a JSON export file created by running the export command from the host.
   *
   * @param array $options
   *   Command options.
   *
   * @option dry-run Show what would be imported without making changes.
   * @option file Path to JSON file with user data (default: private://import_users.json).
   *
   * @command boxtasks:import-users
   * @aliases btiu
   * @usage drush boxtasks:import-users
   *   Import all users from the JSON export file.
   * @usage drush boxtasks:import-users --dry-run
   *   Preview what would be imported.
   * @usage drush boxtasks:import-users --file=/path/to/users.json
   *   Import from a custom JSON file.
   */
  #[CLI\Command(name: 'boxtasks:import-users', aliases: ['btiu'])]
  #[CLI\Option(name: 'dry-run', description: 'Show what would be imported without making changes.')]
  #[CLI\Option(name: 'file', description: 'Path to JSON file with user data.')]
  public function importUsers(array $options = ['dry-run' => FALSE, 'file' => '']) {
    $dry_run = $options['dry-run'];
    $file_path = $options['file'] ?: 'private://import_users.json';

    $this->logger()->notice('Loading users from JSON file...');

    // Read JSON file.
    $users = $this->loadUsersFromJson($file_path);

    if (empty($users)) {
      $this->logger()->warning('No users found to import. Make sure the JSON file exists.');
      $this->logger()->notice('To create the JSON file, run this from the host:');
      $this->logger()->notice('ssh root@23.92.21.181 "mysql -u bxtasksusr -pXXX bxtasksdb -N -e \'...\'" | jq > import_users.json');
      return;
    }

    $this->logger()->notice(sprintf('Found %d users to import.', count($users)));

    if ($dry_run) {
      $this->logger()->notice('DRY RUN - No changes will be made.');
      $this->outputUserTable($users);
      return;
    }

    // Import users.
    $created = 0;
    $updated = 0;
    $skipped = 0;

    foreach ($users as $remote_user) {
      $result = $this->importUser($remote_user);
      switch ($result) {
        case 'created':
          $created++;
          $this->logger()->success(sprintf('Created user: %s (%s)', $remote_user['name'], $remote_user['mail']));
          break;
        case 'updated':
          $updated++;
          $this->logger()->notice(sprintf('Updated user: %s (%s)', $remote_user['name'], $remote_user['mail']));
          break;
        case 'skipped':
          $skipped++;
          $this->logger()->warning(sprintf('Skipped user: %s (%s)', $remote_user['name'], $remote_user['mail']));
          break;
      }
    }

    $this->logger()->success(sprintf(
      'Import complete: %d created, %d updated, %d skipped.',
      $created,
      $updated,
      $skipped
    ));
  }

  /**
   * Load users from a JSON file.
   *
   * @param string $file_path
   *   The path to the JSON file.
   *
   * @return array
   *   Array of user data.
   */
  protected function loadUsersFromJson(string $file_path): array {
    // Resolve stream wrapper path.
    $real_path = $this->fileSystem->realpath($file_path);
    if (!$real_path) {
      // Try as a direct path.
      $real_path = $file_path;
    }

    if (!file_exists($real_path)) {
      $this->logger()->error(sprintf('File not found: %s', $file_path));
      return [];
    }

    $content = file_get_contents($real_path);
    if (!$content) {
      $this->logger()->error('Failed to read file contents.');
      return [];
    }

    $users = json_decode($content, TRUE);
    if (json_last_error() !== JSON_ERROR_NONE) {
      $this->logger()->error(sprintf('Invalid JSON: %s', json_last_error_msg()));
      return [];
    }

    return $users;
  }

  /**
   * Import a single user.
   *
   * @param array $remote_user
   *   The remote user data.
   *
   * @return string
   *   Result: 'created', 'updated', or 'skipped'.
   */
  protected function importUser(array $remote_user): string {
    $storage = $this->entityTypeManager->getStorage('user');

    // Check if user exists by email.
    $existing = $storage->loadByProperties(['mail' => $remote_user['mail']]);
    if (!empty($existing)) {
      $user = reset($existing);
      // Update existing user.
      return $this->updateUser($user, $remote_user);
    }

    // Check if username is taken.
    $existing = $storage->loadByProperties(['name' => $remote_user['name']]);
    if (!empty($existing)) {
      // Username taken, skip or modify.
      $this->logger()->warning(sprintf(
        'Username %s is already taken by another user.',
        $remote_user['name']
      ));
      return 'skipped';
    }

    // Create new user.
    try {
      $user = User::create([
        'name' => $remote_user['name'],
        'mail' => $remote_user['mail'],
        'pass' => ['pre_hashed' => TRUE, 'value' => $remote_user['pass']],
        'status' => $remote_user['status'],
        'created' => $remote_user['created'],
        'changed' => $remote_user['changed'],
        'timezone' => $remote_user['timezone'] ?: 'Africa/Nairobi',
      ]);

      // Set display name if we have field_display_name field.
      if ($user->hasField('field_display_name') && !empty($remote_user['full_name'])) {
        $user->set('field_display_name', $remote_user['full_name']);
      }

      // Store original UID for reference.
      if ($user->hasField('field_original_uid')) {
        $user->set('field_original_uid', $remote_user['uid']);
      }

      $user->save();
      return 'created';
    }
    catch (\Exception $e) {
      $this->logger()->error(sprintf('Failed to create user %s: %s', $remote_user['name'], $e->getMessage()));
      return 'skipped';
    }
  }

  /**
   * Update an existing user.
   *
   * @param \Drupal\user\Entity\User $user
   *   The existing user entity.
   * @param array $remote_user
   *   The remote user data.
   *
   * @return string
   *   Result: 'updated' or 'skipped'.
   */
  protected function updateUser(User $user, array $remote_user): string {
    try {
      // Update display name.
      if ($user->hasField('field_display_name') && !empty($remote_user['full_name'])) {
        $user->set('field_display_name', $remote_user['full_name']);
      }

      // Update timezone.
      if (!empty($remote_user['timezone'])) {
        $user->set('timezone', $remote_user['timezone']);
      }

      // Update status.
      $user->set('status', $remote_user['status']);

      $user->save();
      return 'updated';
    }
    catch (\Exception $e) {
      $this->logger()->error(sprintf('Failed to update user %s: %s', $remote_user['name'], $e->getMessage()));
      return 'skipped';
    }
  }

  /**
   * Output users in a table format.
   *
   * @param array $users
   *   Array of user data.
   */
  protected function outputUserTable(array $users): void {
    $this->io()->title('Users to be imported:');

    $rows = [];
    foreach ($users as $user) {
      $rows[] = [
        $user['uid'],
        $user['name'],
        $user['mail'],
        $user['status'] ? 'Active' : 'Inactive',
        $user['full_name'] ?: '-',
        date('Y-m-d', $user['created']),
      ];
    }

    $this->io()->table(
      ['UID', 'Username', 'Email', 'Status', 'Full Name', 'Created'],
      $rows
    );
  }

}
