import { getAccessToken, fetchWithCsrf } from './client';

const API_URL = import.meta.env.VITE_API_URL || 'https://boxtasks2.ddev.site';

// Decode HTML entities (needed because Drupal's JSON:API returns HTML-encoded values for text fields)
function decodeHtmlEntities(text: string): string {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
}

export type ActivityType =
  | 'card_created'
  | 'card_updated'
  | 'card_moved'
  | 'card_completed'
  | 'card_archived'
  | 'card_restored'
  | 'card_deleted'
  | 'list_created'
  | 'list_updated'
  | 'list_archived'
  | 'comment_added'
  | 'comment_updated'
  | 'comment_deleted'
  | 'member_added'
  | 'member_removed'
  | 'label_added'
  | 'label_removed'
  | 'due_date_set'
  | 'due_date_removed'
  | 'due_date_updated'
  | 'start_date_set'
  | 'start_date_removed'
  | 'start_date_updated'
  | 'checklist_added'
  | 'checklist_item_completed'
  | 'checklist_item_uncompleted'
  | 'attachment_added'
  | 'attachment_removed'
  | 'description_updated'
  | 'title_updated'
  | 'department_set'
  | 'department_changed'
  | 'department_removed'
  | 'client_set'
  | 'client_changed'
  | 'client_removed'
  | 'watcher_added'
  | 'watcher_removed'
  | 'card_approved'
  | 'card_approval_removed'
  | 'card_rejected'
  | 'card_rejection_removed'
  | 'custom_field_updated';

export interface ActivityData {
  old_value?: string;
  new_value?: string;
  from_list?: string;
  to_list?: string;
  due_date?: string;
  start_date?: string;
  label?: string;
  member_name?: string;
  watcher_name?: string;
  checklist_name?: string;
  field_name?: string;
  comment_text?: string;
  comment_id?: string;
  department_name?: string;
  client_name?: string;
}

export interface Activity {
  id: string;
  type: ActivityType;
  description: string;
  cardId: string | null;
  boardId: string | null;
  authorId: string;
  authorName: string;
  createdAt: string;
  data: ActivityData | null;
}

// Transform JSON:API response to Activity
function transformActivity(data: Record<string, unknown>, included?: Record<string, unknown>[]): Activity {
  const attrs = data.attributes as Record<string, unknown>;
  const rels = data.relationships as Record<string, { data: { id: string; type: string } | null }> | undefined;

  // Get author info from included if available
  let authorName = 'Unknown User';
  const authorId = rels?.uid?.data?.id || '';
  if (included && authorId) {
    const author = included.find((item) => item.id === authorId && item.type === 'user--user');
    if (author) {
      const authorAttrs = author.attributes as Record<string, unknown>;
      authorName = (authorAttrs.field_display_name as string) || (authorAttrs.name as string) || 'Unknown User';
    }
  }

  // Decode HTML entities in description (API returns &quot; instead of ")
  const rawDescription = (attrs.field_activity_description as { value?: string })?.value || '';
  const description = rawDescription ? decodeHtmlEntities(rawDescription) : '';

  // Parse activity data JSON
  let activityData: ActivityData | null = null;
  const rawData = attrs.field_activity_data as string | null;
  if (rawData) {
    try {
      // Decode HTML entities before parsing (Drupal may HTML-encode the JSON)
      const decodedData = decodeHtmlEntities(rawData);
      activityData = JSON.parse(decodedData) as ActivityData;
    } catch {
      // Invalid JSON, ignore
    }
  }

  return {
    id: data.id as string,
    type: (attrs.field_activity_type as ActivityType) || 'card_updated',
    description,
    cardId: rels?.field_activity_card?.data?.id || null,
    boardId: rels?.field_activity_board?.data?.id || null,
    authorId,
    authorName,
    createdAt: attrs.created as string,
    data: activityData,
  };
}

// Get icon and label for activity type
export function getActivityDisplay(type: ActivityType): { icon: string; label: string } {
  const displays: Record<ActivityType, { icon: string; label: string }> = {
    card_created: { icon: '📝', label: 'created this card' },
    card_updated: { icon: '✏️', label: 'updated this card' },
    card_moved: { icon: '↔️', label: 'moved this card' },
    card_completed: { icon: '✅', label: 'marked this card complete' },
    card_archived: { icon: '📦', label: 'archived this card' },
    card_restored: { icon: '♻️', label: 'restored this card' },
    card_deleted: { icon: '🗑️', label: 'deleted this card' },
    list_created: { icon: '📋', label: 'created this list' },
    list_updated: { icon: '✏️', label: 'updated this list' },
    list_archived: { icon: '📦', label: 'archived this list' },
    comment_added: { icon: '💬', label: 'added a comment' },
    comment_updated: { icon: '💬', label: 'updated a comment' },
    comment_deleted: { icon: '💬', label: 'deleted a comment' },
    member_added: { icon: '👤', label: 'added a member' },
    member_removed: { icon: '👤', label: 'removed a member' },
    label_added: { icon: '🏷️', label: 'added a label' },
    label_removed: { icon: '🏷️', label: 'removed a label' },
    due_date_set: { icon: '📅', label: 'set the due date' },
    due_date_removed: { icon: '📅', label: 'removed the due date' },
    due_date_updated: { icon: '📅', label: 'changed the due date' },
    start_date_set: { icon: '📅', label: 'set the start date' },
    start_date_removed: { icon: '📅', label: 'removed the start date' },
    start_date_updated: { icon: '📅', label: 'changed the start date' },
    description_updated: { icon: '📄', label: 'updated the description' },
    title_updated: { icon: '✏️', label: 'renamed the card' },
    checklist_added: { icon: '☑️', label: 'added a checklist' },
    checklist_item_completed: { icon: '✅', label: 'completed a checklist item' },
    checklist_item_uncompleted: { icon: '⬜', label: 'uncompleted a checklist item' },
    attachment_added: { icon: '📎', label: 'added an attachment' },
    attachment_removed: { icon: '📎', label: 'removed an attachment' },
    department_set: { icon: '🏢', label: 'set the department' },
    department_changed: { icon: '🏢', label: 'changed the department' },
    department_removed: { icon: '🏢', label: 'removed the department' },
    client_set: { icon: '👥', label: 'set the client' },
    client_changed: { icon: '👥', label: 'changed the client' },
    client_removed: { icon: '👥', label: 'removed the client' },
    watcher_added: { icon: '👁️', label: 'added a watcher' },
    watcher_removed: { icon: '👁️', label: 'removed a watcher' },
    card_approved: { icon: '✅', label: 'approved this card' },
    card_approval_removed: { icon: '❌', label: 'removed approval' },
    card_rejected: { icon: '🚫', label: 'rejected this card' },
    card_rejection_removed: { icon: '↩️', label: 'removed rejection' },
    custom_field_updated: { icon: '📝', label: 'updated a custom field' },
  };
  return displays[type] || { icon: '•', label: 'performed an action' };
}

// Fetch activities for a card
export async function fetchActivitiesByCard(cardId: string): Promise<Activity[]> {
  const response = await fetch(
    `${API_URL}/jsonapi/node/activity?filter[field_activity_card.id]=${cardId}&include=uid&sort=-created`,
    {
      headers: {
        'Accept': 'application/vnd.api+json',
        'Authorization': `Bearer ${getAccessToken()}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch activities');
  }

  const result = await response.json();
  const data = result.data;
  const included = result.included;
  if (!Array.isArray(data)) return [];

  return data.map((item: Record<string, unknown>) => transformActivity(item, included));
}

// Fetch activities for a board
export async function fetchActivitiesByBoard(boardId: string): Promise<Activity[]> {
  const response = await fetch(
    `${API_URL}/jsonapi/node/activity?filter[field_activity_board.id]=${boardId}&include=uid&sort=-created`,
    {
      headers: {
        'Accept': 'application/vnd.api+json',
        'Authorization': `Bearer ${getAccessToken()}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch activities');
  }

  const result = await response.json();
  const data = result.data;
  const included = result.included;
  if (!Array.isArray(data)) return [];

  return data.map((item: Record<string, unknown>) => transformActivity(item, included));
}

// Create a new activity
export async function createActivity(params: {
  type: ActivityType;
  description?: string;
  cardId?: string;
  boardId?: string;
  data?: Partial<ActivityData>;
}): Promise<Activity> {
  const relationships: Record<string, unknown> = {};

  if (params.cardId) {
    relationships.field_activity_card = {
      data: { type: 'node--card', id: params.cardId },
    };
  }

  if (params.boardId) {
    relationships.field_activity_board = {
      data: { type: 'node--board', id: params.boardId },
    };
  }

  const response = await fetchWithCsrf(`${API_URL}/jsonapi/node/activity`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: {
        type: 'node--activity',
        attributes: {
          title: `Activity: ${params.type}`,
          field_activity_type: params.type,
          field_activity_description: params.description ? { value: params.description } : null,
          field_activity_data: params.data ? JSON.stringify(params.data) : null,
        },
        ...(Object.keys(relationships).length > 0 && { relationships }),
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.errors?.[0]?.detail || 'Failed to create activity');
  }

  const result = await response.json();
  return transformActivity(result.data, result.included);
}
