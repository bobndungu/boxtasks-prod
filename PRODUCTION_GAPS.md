# BoxTasks2 Production vs Development Gaps

This document summarizes the differences between the development and production Drupal environments for BoxTasks2.

**Important:** This project (BoxTasks2) is completely separate from tasks.boxraft.com. Do not cross-port features between these sites.

## Environments

| Environment | Frontend | Drupal Backend |
|-------------|----------|----------------|
| Development | localhost:5173 | boxtasks2.ddev.site |
| Production | boxtasks.boxraft.com | boxtasks.boxraft.com |

## Last Updated
2026-01-14

## Summary

The production site (boxtasks.boxraft.com) has a different Drupal configuration than the development environment (boxtasks2.ddev.site). The frontend has been updated to handle both environments with fallbacks.

---

## Field Name Differences (Card Content Type)

The production environment uses different field names than development:

| Feature | Production Field | Development Field | Status |
|---------|------------------|-------------------|--------|
| Description | `body` | `field_card_description` | Fixed with fallback |
| Start Date | `field_start_date` | `field_card_start_date` | Fixed with fallback |
| Due Date | `field_due_date` | `field_card_due_date` | Fixed with fallback |
| Pinned | `field_pinned` | `field_card_pinned` | Fixed with fallback |
| Labels | `field_labels` (entity_reference) | `field_card_labels` (list_string) | Fixed with fallback |
| Archived | `field_card_archived` or `field_archived` | `field_card_archived` | Fixed with fallback |
| Department | `field_department` | `field_card_department` | Fixed |
| Client | `field_client` | `field_card_client` | Fixed |
| Watchers | `field_watchers` | `field_card_watchers` | Fixed |

### Fields Missing on Production

These fields exist in development but NOT on production:

| Field | Purpose | Impact |
|-------|---------|--------|
| `field_card_completed` | Track card completion | Defaults to false |
| `field_card_cover` | Card cover image | Cover images not available |
| `field_card_approved_by` | Approval workflow | Approval feature limited |
| `field_card_rejected_by` | Rejection workflow | Rejection feature limited |
| `field_card_estimate` | Time estimates | Estimates not saved |
| `field_card_estimate_type` | Estimate type | Estimates not saved |
| `field_card_complexity` | Complexity rating | Complexity not saved |
| `field_card_google_docs` | Google Docs links | Google Docs feature limited |

---

## Content Types Missing on Production

These content types exist in development but are NOT deployed to production:

| Content Type | Purpose | Impact on Frontend |
|--------------|---------|-------------------|
| `card_comment` | Card comments | 404 error when loading comments |
| `time_entry` | Time tracking entries | 404 error when loading time entries |
| `card_activity` | Activity log entries | 404 error when loading activities |
| `card_attachment` | File attachments | 404 error when loading attachments |
| `checklist` | Card checklists | 404 error when loading checklists |
| `member_role` | Custom member roles | Member roles not available |
| `custom_field_definition` | Custom fields | 404 error when loading custom fields |

---

## Taxonomy Terms Missing on Production

| Vocabulary | Purpose | Impact |
|------------|---------|--------|
| `client` | Client taxonomy | 404 error when loading client terms |

---

## List Content Type Differences

| Feature | Production Field | Development Field | Status |
|---------|------------------|-------------------|--------|
| Board Reference | `field_board` | `field_list_board` | Frontend handles both |

---

## Frontend Fixes Applied

The following files were updated to handle production field names:

1. **`src/lib/api/cards.ts`**
   - `transformCard()`: Added fallbacks for all field name differences
   - `createCard()`: Uses `body` and `field_start_date`
   - `updateCard()`: Uses `body`, `field_start_date`, `field_pinned`
   - `fetchCard()`: Updated include parameters to only use production fields

2. **`src/lib/api/search.ts`**
   - Updated filter path to use `body.value` with fallback
   - Updated description extraction with fallback

3. **`src/lib/api/dashboard.ts`**
   - Added fallbacks for `field_card_completed`

4. **`src/lib/api/mindmaps.ts`**
   - Uses `body` field when creating cards from mind map nodes

5. **`src/lib/api/goals.ts`**
   - Added fallback for `field_card_completed`

---

## Tested Features (Working on Production)

- [x] User authentication (OAuth password grant)
- [x] Dashboard loading
- [x] Board view with lists and cards
- [x] Card modal (opens correctly)
- [x] Member assignment
- [x] Description editing and saving
- [x] Board search (filtering cards)
- [x] Global search (finding cards across workspaces)
- [x] Due dates displayed correctly
- [x] Navigation between pages

---

## Features with 404 Errors (Expected)

These features show 404 errors because the content types don't exist on production:

- Comments (card_comment content type missing)
- Time entries (time_entry content type missing)
- Activities (card_activity content type missing)
- Attachments (card_attachment content type missing)
- Checklists (checklist content type missing)
- Custom fields (custom_field_definition content type missing)
- Client taxonomy (taxonomy_term/client vocabulary missing)

---

## Recommended Next Steps

### Priority 1: Deploy Missing Content Types to BoxTasks2 Production

Export content types from BoxTasks2 dev (boxtasks2.ddev.site) and import to BoxTasks2 production (boxtasks.boxraft.com):

```bash
# On BoxTasks2 development (boxtasks2.ddev.site)
ddev drush cex -y

# Copy config files for:
# - node.type.card_comment.yml
# - node.type.time_entry.yml
# - node.type.card_activity.yml
# - node.type.card_attachment.yml
# - node.type.checklist.yml
# - node.type.custom_field_definition.yml
# - taxonomy.vocabulary.client.yml

# On BoxTasks2 production (boxtasks.boxraft.com)
drush cim -y
```

**Note:** Do NOT import configurations from tasks.boxraft.com - that is a completely separate project.

### Priority 2: Add Missing Card Fields

Add these fields to the Card content type on production:
- `field_card_completed` (boolean)
- `field_card_cover` (image/media reference)
- `field_card_estimate` (integer)
- `field_card_estimate_type` (list_string)
- `field_card_complexity` (list_string)
- `field_card_google_docs` (text_long)

### Priority 3: Standardize Field Names

Consider standardizing field names between dev and production to avoid confusion. Either:
1. Update production to use dev field names, OR
2. Update dev to use production field names

---

## OAuth Configuration Notes

Production OAuth consumer (`boxtasks-frontend`):
- Uses password grant type
- Client ID: `boxtasks-frontend`
- Secret must be set in database (was missing, now fixed)

If login fails with 400 error, check:
1. Consumer secret is set in `consumer_field_data` table
2. User password is correct (use `drush user:password <username> '<password>'`)
3. Flood table is clear (`DELETE FROM flood`)
