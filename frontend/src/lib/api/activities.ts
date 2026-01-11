import { getAccessToken, fetchWithCsrf } from './client';

const API_URL = import.meta.env.VITE_API_URL || 'https://boxtasks2.ddev.site';

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
  | 'checklist_added'
  | 'checklist_item_completed'
  | 'checklist_item_uncompleted'
  | 'attachment_added'
  | 'attachment_removed'
  | 'description_updated'
  | 'due_date_updated';

export interface Activity {
  id: string;
  type: ActivityType;
  description: string;
  cardId: string | null;
  boardId: string | null;
  authorId: string;
  authorName: string;
  createdAt: string;
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
      authorName = (authorAttrs.display_name as string) || (authorAttrs.name as string) || 'Unknown User';
    }
  }

  return {
    id: data.id as string,
    type: (attrs.field_activity_type as ActivityType) || 'card_updated',
    description: (attrs.field_activity_description as { value?: string })?.value || '',
    cardId: rels?.field_activity_card?.data?.id || null,
    boardId: rels?.field_activity_board?.data?.id || null,
    authorId,
    authorName,
    createdAt: attrs.created as string,
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
    description_updated: { icon: '📄', label: 'updated the description' },
    checklist_added: { icon: '☑️', label: 'added a checklist' },
    checklist_item_completed: { icon: '✅', label: 'completed a checklist item' },
    checklist_item_uncompleted: { icon: '⬜', label: 'uncompleted a checklist item' },
    attachment_added: { icon: '📎', label: 'added an attachment' },
    attachment_removed: { icon: '📎', label: 'removed an attachment' },
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
export async function createActivity(data: {
  type: ActivityType;
  description?: string;
  cardId?: string;
  boardId?: string;
}): Promise<Activity> {
  const relationships: Record<string, unknown> = {};

  if (data.cardId) {
    relationships.field_activity_card = {
      data: { type: 'node--card', id: data.cardId },
    };
  }

  if (data.boardId) {
    relationships.field_activity_board = {
      data: { type: 'node--board', id: data.boardId },
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
          title: `Activity: ${data.type}`,
          field_activity_type: data.type,
          field_activity_description: data.description ? { value: data.description } : null,
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
