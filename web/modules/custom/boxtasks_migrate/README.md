# BoxTasks Migration Module

This module provides migration scripts for importing data from the original BoxTasks PostgreSQL database into Drupal entities.

## Prerequisites

1. **Migrate modules**: Install required modules:
   ```bash
   ddev composer require drupal/migrate_plus drupal/migrate_tools
   ```

2. **Database connection**: Configure the source database in `settings.php`:
   ```php
   // SSH tunnel to production database
   // Run: ssh -L 3307:localhost:5432 user@tasks.boxraft.com

   $databases['migrate']['default'] = [
     'database' => 'boxtasks',
     'username' => 'boxtasks_user',
     'password' => 'your_password',
     'host' => '127.0.0.1',
     'port' => '3307',
     'driver' => 'pgsql',
     'prefix' => '',
   ];
   ```

## Installation

1. Enable the module:
   ```bash
   ddev drush en boxtasks_migrate -y
   ```

2. Import configuration:
   ```bash
   ddev drush cim --partial --source=modules/custom/boxtasks_migrate/config/install -y
   ```

## Running Migrations

### Check migration status
```bash
ddev drush migrate:status --group=boxtasks
```

### Run all migrations
```bash
ddev drush migrate:import --group=boxtasks
```

### Run specific migration
```bash
ddev drush migrate:import boxtasks_users
```

### Rollback migrations
```bash
ddev drush migrate:rollback boxtasks_users
```

## Migration Order

Migrations should be run in this order (dependencies are enforced):

1. `boxtasks_users` - User accounts
2. `boxtasks_workspaces` - Workspaces (future)
3. `boxtasks_workspace_members` - Workspace memberships (future)
4. `boxtasks_boards` - Boards (future)
5. `boxtasks_board_labels` - Board labels (future)
6. `boxtasks_lists` - Board lists (future)
7. `boxtasks_cards` - Cards (future)
8. `boxtasks_checklists` - Checklists (future)
9. `boxtasks_comments` - Card comments (future)
10. `boxtasks_activities` - Activity log (future)

## Notes

### Password Migration
For security, user passwords are NOT migrated. All migrated users will need to use the "Forgot Password" feature to set a new password.

### UUIDs
Original UUIDs are stored in `field_original_uuid` for reference and to enable updates if re-running migrations.

### Incremental Updates
The migrate system tracks what has been imported. Running migrations again will only import new records.
