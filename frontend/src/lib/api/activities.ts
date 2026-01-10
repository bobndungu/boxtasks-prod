import { getAccessToken } from './client';

const API_URL = import.meta.env.VITE_API_URL || 'https://boxtasks2.ddev.site';

export type ActivityType =
  | 'card_created'
  | 'card_moved'
  | 'card_updated'
  | 'description_updated'
  | 'due_date_updated'
  | 'comment_added'
  | 'attachment_added'
  | 'checklist_added'
  | 'checklist_item_completed';

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
    card_moved: { icon: '↔️', label: 'moved this card' },
    card_updated: { icon: '✏️', label: 'updated this card' },
    description_updated: { icon: '📄', label: 'updated the description' },
    due_date_updated: { icon: '📅', label: 'changed the due date' },
    comment_added: { icon: '💬', label: 'added a comment' },
    attachment_added: { icon: '📎', label: 'added an attachment' },
    checklist_added: { icon: '☑️', label: 'added a checklist' },
    checklist_item_completed: { icon: '✅', label: 'completed a checklist item' },
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

  const response = await fetch(`${API_URL}/jsonapi/node/activity`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
      'Authorization': `Bearer ${getAccessToken()}`,
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
