# BoxTasks Schema Mapping to Drupal Entities

This document maps the original BoxTasks PostgreSQL schema to Drupal 11 entities.

## Overview

| Original Table | Drupal Entity Type | Content Type/Bundle | Module |
|----------------|-------------------|---------------------|--------|
| users | User | - | Core + boxtasks_user |
| oauth_accounts | N/A | - | Simple OAuth module |
| sessions | N/A | - | Core session handling |
| workspaces | Node | workspace | boxtasks_workspace |
| workspace_memberships | Paragraph | workspace_member | boxtasks_workspace |
| board_collections | Taxonomy | board_collection | boxtasks_board |
| boards | Node | board | boxtasks_board |
| board_memberships | Paragraph | board_member | boxtasks_board |
| lists | Node | board_list | boxtasks_list |
| labels | Taxonomy | board_label | boxtasks_board |
| cards | Node | card | boxtasks_card |
| card_members | Entity Reference | - | boxtasks_card |
| card_labels | Entity Reference | - | boxtasks_card |
| custom_fields | Node | custom_field_definition | boxtasks_customfield |
| card_custom_field_values | Paragraph | custom_field_value | boxtasks_customfield |
| checklists | Node | checklist | boxtasks_checklist |
| checklist_items | Paragraph | checklist_item | boxtasks_checklist |
| comments | Comment | card_comment | boxtasks_comment |
| attachments | File + Media | - | boxtasks_attachment |
| activities | Node | activity | boxtasks_activity |
| card_votes | Flagging | card_vote | Flag module |
| automation_rules | Node | automation_rule | boxtasks_automation |
| board_views | Node | board_view | boxtasks_boardview |
| notifications | Node | notification | boxtasks_notification |
| webhooks | Config Entity | webhook | Future module |
| api_keys | N/A | - | Simple OAuth consumers |
| yjs_documents | N/A | - | Not needed (Mercure handles real-time) |

---

## Detailed Field Mappings

### Users (users -> Drupal User)

| Original Field | Drupal Field | Notes |
|----------------|--------------|-------|
| id (UUID) | uid | Drupal uses integer, store UUID in field_uuid |
| email | mail | Core user field |
| email_verified | field_email_verified | Boolean field |
| name | field_display_name | Text field (username is separate) |
| avatar_url | user_picture | Core image field |
| password_hash | pass | Core password field |
| two_factor_enabled | N/A | TFA module |
| two_factor_secret | N/A | TFA module |
| is_premium | field_is_premium | Boolean field |
| created_at | created | Core timestamp |
| updated_at | changed | Core timestamp |

### Workspaces (workspaces -> node:workspace)

| Original Field | Drupal Field | Notes |
|----------------|--------------|-------|
| id (UUID) | uuid | Core UUID field |
| name | title | Core node title |
| description | body | Core body field |
| slug | field_slug | Text field with path alias |
| avatar_url | field_avatar | Image field |
| is_premium | field_is_premium | Boolean |
| settings | field_settings | JSON field |
| created_at | created | Core timestamp |
| updated_at | changed | Core timestamp |

### Workspace Memberships (workspace_memberships -> paragraph:workspace_member)

| Original Field | Drupal Field | Notes |
|----------------|--------------|-------|
| id (UUID) | uuid | Paragraph UUID |
| workspace_id | Parent reference | Via paragraph host |
| user_id | field_user | Entity reference to User |
| role | field_role | List (text) field |
| created_at | created | Paragraph timestamp |

### Boards (boards -> node:board)

| Original Field | Drupal Field | Notes |
|----------------|--------------|-------|
| id (UUID) | uuid | Core UUID |
| workspace_id | field_workspace | Entity reference |
| collection_id | field_collection | Entity reference to taxonomy |
| name | title | Core node title |
| description | body | Core body field |
| visibility | field_visibility | List (text) field |
| background_type | field_background_type | List (text) |
| background_value | field_background_value | Text field |
| is_template | field_is_template | Boolean |
| is_closed | field_is_closed | Boolean |
| position | field_position | Decimal/Text for ordering |
| settings | field_settings | JSON field |
| created_by | uid | Author (core) |
| created_at | created | Core timestamp |
| updated_at | changed | Core timestamp |
| deleted_at | field_deleted_at | Timestamp (soft delete) |

### Lists (lists -> node:board_list)

| Original Field | Drupal Field | Notes |
|----------------|--------------|-------|
| id (UUID) | uuid | Core UUID |
| board_id | field_board | Entity reference |
| name | title | Core node title |
| position | field_position | Decimal for ordering |
| color | field_color | Text field (hex color) |
| wip_limit | field_wip_limit | Integer field |
| is_collapsed | field_is_collapsed | Boolean |
| created_at | created | Core timestamp |
| updated_at | changed | Core timestamp |

### Cards (cards -> node:card)

| Original Field | Drupal Field | Notes |
|----------------|--------------|-------|
| id (UUID) | uuid | Core UUID |
| list_id | field_list | Entity reference |
| board_id | field_board | Entity reference (denormalized) |
| title | title | Core node title |
| description | body | Core body field |
| position | field_position | Decimal for ordering |
| cover_type | field_cover_type | List (text) |
| cover_value | field_cover_value | Text/Image field |
| start_date | field_start_date | Date field |
| due_date | field_due_date | Date field |
| is_completed | field_is_completed | Boolean |
| completed_at | field_completed_at | Timestamp |
| created_by | uid | Author (core) |
| created_at | created | Core timestamp |
| updated_at | changed | Core timestamp |

### Card Members (card_members -> field on card)

| Original Field | Drupal Field | Notes |
|----------------|--------------|-------|
| card_id | Host entity | Card node |
| user_id | field_members | Entity reference (multiple) |
| created_at | N/A | Not tracked separately |

### Labels (labels -> taxonomy:board_label)

| Original Field | Drupal Field | Notes |
|----------------|--------------|-------|
| id (UUID) | uuid | Taxonomy term UUID |
| board_id | field_board | Entity reference |
| name | name | Taxonomy term name |
| color | field_color | Text field (hex color) |
| created_at | created | Not in taxonomy by default |

### Custom Fields (custom_fields -> node:custom_field_definition)

| Original Field | Drupal Field | Notes |
|----------------|--------------|-------|
| id (UUID) | uuid | Core UUID |
| board_id | field_board | Entity reference |
| name | title | Core node title |
| type | field_field_type | List (text): text, number, date, checkbox, dropdown |
| options | field_options | JSON field (for dropdown) |
| position | field_position | Decimal for ordering |
| show_on_front | field_show_on_front | Boolean |
| created_at | created | Core timestamp |
| updated_at | changed | Core timestamp |

### Custom Field Values (card_custom_field_values -> paragraph:custom_field_value)

| Original Field | Drupal Field | Notes |
|----------------|--------------|-------|
| id (UUID) | uuid | Paragraph UUID |
| card_id | Host entity | Via paragraph on card |
| custom_field_id | field_custom_field | Entity reference |
| value | field_value | JSON field |
| created_at | created | Paragraph timestamp |
| updated_at | N/A | Track via parent |

### Checklists (checklists -> node:checklist)

| Original Field | Drupal Field | Notes |
|----------------|--------------|-------|
| id (UUID) | uuid | Core UUID |
| card_id | field_card | Entity reference |
| name | title | Core node title |
| position | field_position | Decimal |
| created_at | created | Core timestamp |
| updated_at | changed | Core timestamp |

### Checklist Items (checklist_items -> paragraph:checklist_item)

| Original Field | Drupal Field | Notes |
|----------------|--------------|-------|
| id (UUID) | uuid | Paragraph UUID |
| checklist_id | Host entity | Parent checklist |
| name | field_name | Text field |
| position | field_position | Decimal |
| is_checked | field_is_checked | Boolean |
| assigned_to | field_assigned_to | Entity reference to User |
| due_date | field_due_date | Date field |
| created_at | created | Paragraph timestamp |
| updated_at | N/A | Track via parent |

### Comments (comments -> comment:card_comment)

| Original Field | Drupal Field | Notes |
|----------------|--------------|-------|
| id (UUID) | uuid | Comment UUID |
| card_id | entity_id | Comment host entity |
| user_id | uid | Comment author |
| content | comment_body | Comment body field |
| mentions | field_mentions | JSON field |
| created_at | created | Core timestamp |
| updated_at | changed | Core timestamp |

### Attachments (attachments -> file + media)

| Original Field | Drupal Field | Notes |
|----------------|--------------|-------|
| id (UUID) | uuid | File/Media UUID |
| card_id | field_card | Entity reference on Media |
| user_id | uid | File owner |
| filename | filename | File name |
| file_size | filesize | File size |
| mime_type | filemime | MIME type |
| storage_key | N/A | Drupal file system handles |
| url | uri | File URI |
| created_at | created | File timestamp |

### Activities (activities -> node:activity)

| Original Field | Drupal Field | Notes |
|----------------|--------------|-------|
| id (UUID) | uuid | Core UUID |
| workspace_id | field_workspace | Entity reference |
| board_id | field_board | Entity reference |
| card_id | field_card | Entity reference |
| user_id | field_actor | Entity reference to User |
| action | field_action | Text field |
| entity_type | field_entity_type | Text field |
| entity_id | field_entity_id | Text field (UUID) |
| metadata | field_metadata | JSON field |
| created_at | created | Core timestamp |

### Automation Rules (automation_rules -> node:automation_rule)

| Original Field | Drupal Field | Notes |
|----------------|--------------|-------|
| id (UUID) | uuid | Core UUID |
| board_id | field_board | Entity reference |
| name | title | Core node title |
| type | field_rule_type | List (text) |
| trigger | field_trigger | JSON field |
| actions | field_actions | JSON field |
| is_enabled | field_is_enabled | Boolean |
| position | field_position | Decimal |
| created_by | uid | Author |
| created_at | created | Core timestamp |
| updated_at | changed | Core timestamp |

### Board Views (board_views -> node:board_view)

| Original Field | Drupal Field | Notes |
|----------------|--------------|-------|
| id (UUID) | uuid | Core UUID |
| board_id | field_board | Entity reference |
| user_id | field_user | Entity reference (optional) |
| name | title | Core node title |
| type | field_view_type | List (text) |
| config | field_config | JSON field |
| is_default | field_is_default | Boolean |
| created_at | created | Core timestamp |
| updated_at | changed | Core timestamp |

### Notifications (notifications -> node:notification)

| Original Field | Drupal Field | Notes |
|----------------|--------------|-------|
| id (UUID) | uuid | Core UUID |
| user_id | field_recipient | Entity reference |
| type | field_notification_type | Text field |
| title | title | Core node title |
| message | body | Core body field |
| entity_type | field_entity_type | Text field |
| entity_id | field_entity_id | Text field |
| is_read | field_is_read | Boolean |
| created_at | created | Core timestamp |

---

## Migration Priority

### Phase 1: Core Entities (Required for basic functionality)
1. Users - Map to Drupal users with extended fields
2. Workspaces - Content type with workspace members
3. Boards - Content type with board settings
4. Lists - Content type for columns
5. Cards - Content type with all card fields

### Phase 2: Card Features
6. Labels - Taxonomy vocabulary per board
7. Checklists - Content type with checklist items
8. Comments - Comment entity type
9. Attachments - Media entities

### Phase 3: Advanced Features
10. Custom Fields - Definition and values
11. Activities - Audit log entries
12. Notifications - User notifications

### Phase 4: Premium Features
13. Automation Rules - Butler automation
14. Board Views - Saved views configuration
15. Webhooks - External integrations

---

## Notes

### UUID Handling
- Drupal 8+ uses UUIDs natively for all content entities
- Original UUIDs can be preserved during migration using `uuid` field

### Soft Deletes
- Original schema uses `deleted_at` for soft deletes
- In Drupal, use `field_deleted_at` timestamp or Archive module

### JSON Fields
- Use Drupal's JSON field module or store as serialized data
- Settings, options, and metadata fields use JSON

### Real-time Updates
- Original used Yjs for collaborative editing
- BoxTasks2 uses Mercure for real-time updates
- No direct migration needed for yjs_documents

### Authentication
- OAuth handled by Simple OAuth module
- Sessions handled by Drupal core
- API keys via Simple OAuth consumers
