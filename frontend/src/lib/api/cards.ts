import { getAccessToken, fetchWithCsrf } from './client';

const API_URL = import.meta.env.VITE_API_URL || 'https://boxtasks2.ddev.site';

export type CardLabel = 'green' | 'yellow' | 'orange' | 'red' | 'purple' | 'blue';

export interface CardMember {
  id: string;
  name: string;
  email?: string;
}

export interface Card {
  id: string;
  title: string;
  description?: string;
  listId: string;
  position: number;
  startDate?: string;
  dueDate?: string;
  labels: CardLabel[];
  archived: boolean;
  completed: boolean;
  pinned: boolean;
  coverImageUrl?: string;
  coverImageId?: string;
  watcherIds: string[];
  memberIds: string[];
  members: CardMember[];
  createdAt: string;
  updatedAt: string;
  // Activity counts for expanded view
  commentCount: number;
  attachmentCount: number;
  checklistCompleted: number;
  checklistTotal: number;
}

export interface CreateCardData {
  title: string;
  listId: string;
  description?: string;
  position?: number;
  startDate?: string;
  dueDate?: string;
  labels?: CardLabel[];
  creatorId?: string; // Auto-assign creator as member
}

// Transform JSON:API response to Card
function transformCard(data: Record<string, unknown>, included?: Record<string, unknown>[]): Card {
  const attrs = data.attributes as Record<string, unknown>;
  const rels = data.relationships as Record<string, { data: { id: string; type?: string } | { id: string; type?: string }[] | null }> | undefined;

  // Get cover image URL from included if available
  let coverImageUrl: string | undefined;
  let coverImageId: string | undefined;
  const coverData = rels?.field_card_cover?.data;
  const coverFileId = coverData && !Array.isArray(coverData) ? coverData.id : undefined;
  if (included && coverFileId) {
    coverImageId = coverFileId;
    const file = included.find((item) => item.id === coverFileId && item.type === 'file--file');
    if (file) {
      const fileAttrs = file.attributes as Record<string, unknown>;
      const uri = (fileAttrs.uri as { url?: string })?.url || '';
      if (uri) {
        coverImageUrl = uri.startsWith('http') ? uri : `${API_URL}${uri}`;
      }
    }
  }

  // Get watcher IDs
  const watchersData = rels?.field_card_watchers?.data;
  const watcherIds: string[] = Array.isArray(watchersData)
    ? watchersData.map((w) => w.id)
    : [];

  // Get member IDs and member data
  const membersData = rels?.field_card_members?.data;
  const memberIds: string[] = Array.isArray(membersData)
    ? membersData.map((m) => m.id)
    : [];

  // Get member details from included
  const members: CardMember[] = [];
  if (included && memberIds.length > 0) {
    for (const memberId of memberIds) {
      const user = included.find((item) => item.id === memberId && item.type === 'user--user');
      if (user) {
        const userAttrs = user.attributes as Record<string, unknown>;
        members.push({
          id: memberId,
          name: (userAttrs.field_display_name as string) || (userAttrs.name as string) || 'Unknown User',
          email: userAttrs.mail as string | undefined,
        });
      } else {
        members.push({ id: memberId, name: 'Unknown User' });
      }
    }
  }

  // Get list ID (single reference)
  const listData = rels?.field_card_list?.data;
  const listId = listData && !Array.isArray(listData) ? listData.id : '';

  return {
    id: data.id as string,
    title: attrs.title as string,
    description: (attrs.field_card_description as { value?: string })?.value || '',
    listId,
    position: (attrs.field_card_position as number) || 0,
    startDate: (attrs.field_card_start_date as string) || undefined,
    dueDate: (attrs.field_card_due_date as string) || undefined,
    labels: (attrs.field_card_labels as CardLabel[]) || [],
    archived: (attrs.field_card_archived as boolean) || false,
    completed: (attrs.field_card_completed as boolean) || false,
    pinned: (attrs.field_card_pinned as boolean) || false,
    coverImageUrl,
    coverImageId,
    watcherIds,
    memberIds,
    members,
    createdAt: attrs.created as string,
    updatedAt: attrs.changed as string,
    // Initialize counts to 0 - will be populated when loading board if needed
    commentCount: 0,
    attachmentCount: 0,
    checklistCompleted: 0,
    checklistTotal: 0,
  };
}

// Fetch all cards for a list
export async function fetchCardsByList(listId: string): Promise<Card[]> {
  const response = await fetch(
    `${API_URL}/jsonapi/node/card?filter[field_card_list.id]=${listId}&filter[field_card_archived][value]=0&sort=field_card_position&include=field_card_cover,field_card_members`,
    {
      headers: {
        'Accept': 'application/vnd.api+json',
        'Authorization': `Bearer ${getAccessToken()}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch cards');
  }

  const result = await response.json();
  const data = result.data;
  const included = result.included as Record<string, unknown>[] | undefined;
  if (!Array.isArray(data)) return [];

  return data.map((item) => transformCard(item, included));
}

// Fetch all cards for multiple lists (for board view)
export async function fetchCardsByBoard(_boardId: string, listIds: string[]): Promise<Map<string, Card[]>> {
  if (listIds.length === 0) return new Map();

  const filterParams = listIds.map((id, index) =>
    `filter[list-filter-${index}][condition][path]=field_card_list.id&filter[list-filter-${index}][condition][value]=${id}`
  ).join('&');

  const response = await fetch(
    `${API_URL}/jsonapi/node/card?${filterParams}&filter[field_card_archived][value]=0&sort=field_card_position&include=field_card_cover,field_card_members`,
    {
      headers: {
        'Accept': 'application/vnd.api+json',
        'Authorization': `Bearer ${getAccessToken()}`,
      },
    }
  );

  if (!response.ok) {
    // Fall back to individual queries if complex filter fails
    const cardMap = new Map<string, Card[]>();
    for (const listId of listIds) {
      const cards = await fetchCardsByList(listId);
      cardMap.set(listId, cards);
    }
    return cardMap;
  }

  const result = await response.json();
  const data = result.data;
  const included = result.included as Record<string, unknown>[] | undefined;

  const cardMap = new Map<string, Card[]>();
  listIds.forEach((id) => cardMap.set(id, []));

  if (Array.isArray(data)) {
    data.forEach((item) => {
      const card = transformCard(item, included);
      const existing = cardMap.get(card.listId) || [];
      cardMap.set(card.listId, [...existing, card]);
    });
  }

  return cardMap;
}

// Fetch a single card
export async function fetchCard(id: string): Promise<Card> {
  const response = await fetch(`${API_URL}/jsonapi/node/card/${id}?include=field_card_cover,field_card_members`, {
    headers: {
      'Accept': 'application/vnd.api+json',
      'Authorization': `Bearer ${getAccessToken()}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch card');
  }

  const result = await response.json();
  const included = result.included as Record<string, unknown>[] | undefined;
  return transformCard(result.data, included);
}

// Create a new card
export async function createCard(data: CreateCardData): Promise<Card> {
  // Build relationships object
  const relationships: Record<string, unknown> = {
    field_card_list: {
      data: { type: 'node--board_list', id: data.listId },
    },
  };

  // Auto-assign creator as member if creatorId is provided
  if (data.creatorId) {
    relationships.field_card_members = {
      data: [{ type: 'user--user', id: data.creatorId }],
    };
  }

  const response = await fetchWithCsrf(`${API_URL}/jsonapi/node/card`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: {
        type: 'node--card',
        attributes: {
          title: data.title,
          field_card_description: data.description ? { value: data.description } : null,
          field_card_position: data.position || 0,
          field_card_start_date: data.startDate ? `${data.startDate}T12:00:00+00:00` : null,
          field_card_due_date: data.dueDate ? `${data.dueDate}T12:00:00+00:00` : null,
          field_card_labels: data.labels || [],
          field_card_archived: false,
        },
        relationships,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.errors?.[0]?.detail || 'Failed to create card');
  }

  const result = await response.json();
  return transformCard(result.data);
}

// Update a card
export async function updateCard(id: string, data: Partial<CreateCardData> & { archived?: boolean; completed?: boolean; pinned?: boolean }): Promise<Card> {
  const attributes: Record<string, unknown> = {};
  const relationships: Record<string, unknown> = {};

  if (data.title) attributes.title = data.title;
  if (data.description !== undefined) {
    attributes.field_card_description = data.description ? { value: data.description } : null;
  }
  if (data.position !== undefined) attributes.field_card_position = data.position;
  if (data.startDate !== undefined) {
    // Convert date to RFC 3339 format for Drupal datetime field (requires timezone)
    attributes.field_card_start_date = data.startDate ? `${data.startDate}T12:00:00+00:00` : null;
  }
  if (data.dueDate !== undefined) {
    // Convert date to RFC 3339 format for Drupal datetime field (requires timezone)
    attributes.field_card_due_date = data.dueDate ? `${data.dueDate}T12:00:00+00:00` : null;
  }
  if (data.labels) attributes.field_card_labels = data.labels;
  if (data.archived !== undefined) attributes.field_card_archived = data.archived;
  if (data.completed !== undefined) attributes.field_card_completed = data.completed;
  if (data.pinned !== undefined) attributes.field_card_pinned = data.pinned;

  if (data.listId) {
    relationships.field_card_list = {
      data: { type: 'node--board_list', id: data.listId },
    };
  }

  const response = await fetchWithCsrf(`${API_URL}/jsonapi/node/card/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: {
        type: 'node--card',
        id,
        attributes,
        ...(Object.keys(relationships).length > 0 && { relationships }),
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.errors?.[0]?.detail || 'Failed to update card');
  }

  const result = await response.json();
  return transformCard(result.data);
}

// Delete a card
export async function deleteCard(id: string): Promise<void> {
  const response = await fetchWithCsrf(`${API_URL}/jsonapi/node/card/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok && response.status !== 204) {
    throw new Error('Failed to delete card');
  }
}

// Move a card to a different list
export async function moveCard(cardId: string, targetListId: string, position: number): Promise<Card> {
  return updateCard(cardId, { listId: targetListId, position });
}

// Archive a card
export async function archiveCard(id: string): Promise<Card> {
  return updateCard(id, { archived: true });
}

// Upload a cover image for a card
export async function uploadCardCover(cardId: string, file: File): Promise<Card> {
  // Step 1: Upload the file
  const uploadResponse = await fetchWithCsrf(
    `${API_URL}/jsonapi/node/card/${cardId}/field_card_cover`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Accept': 'application/vnd.api+json',
        'Content-Disposition': `file; filename="${encodeURIComponent(file.name)}"`,
      },
      body: file,
    }
  );

  if (!uploadResponse.ok) {
    const error = await uploadResponse.json();
    throw new Error(error.errors?.[0]?.detail || 'Failed to upload cover image');
  }

  // Fetch the updated card to get the cover image URL
  return fetchCard(cardId);
}

// Remove cover image from a card
export async function removeCardCover(cardId: string): Promise<Card> {
  const response = await fetchWithCsrf(`${API_URL}/jsonapi/node/card/${cardId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: {
        type: 'node--card',
        id: cardId,
        relationships: {
          field_card_cover: {
            data: null,
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.errors?.[0]?.detail || 'Failed to remove cover image');
  }

  const result = await response.json();
  const included = result.included as Record<string, unknown>[] | undefined;
  return transformCard(result.data, included);
}

// Watch a card (add current user to watchers)
export async function watchCard(cardId: string, userId: string): Promise<Card> {
  // First fetch current watchers
  const card = await fetchCard(cardId);
  const currentWatchers = card.watcherIds || [];

  // Add user if not already watching
  if (currentWatchers.includes(userId)) {
    return card;
  }

  const newWatchers = [...currentWatchers, userId];

  const response = await fetchWithCsrf(`${API_URL}/jsonapi/node/card/${cardId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: {
        type: 'node--card',
        id: cardId,
        relationships: {
          field_card_watchers: {
            data: newWatchers.map(id => ({ type: 'user--user', id })),
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.errors?.[0]?.detail || 'Failed to watch card');
  }

  const result = await response.json();
  const included = result.included as Record<string, unknown>[] | undefined;
  return transformCard(result.data, included);
}

// Unwatch a card (remove current user from watchers)
export async function unwatchCard(cardId: string, userId: string): Promise<Card> {
  // First fetch current watchers
  const card = await fetchCard(cardId);
  const currentWatchers = card.watcherIds || [];

  // Remove user if watching
  if (!currentWatchers.includes(userId)) {
    return card;
  }

  const newWatchers = currentWatchers.filter(id => id !== userId);

  const response = await fetchWithCsrf(`${API_URL}/jsonapi/node/card/${cardId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: {
        type: 'node--card',
        id: cardId,
        relationships: {
          field_card_watchers: {
            data: newWatchers.length > 0
              ? newWatchers.map(id => ({ type: 'user--user', id }))
              : [],
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.errors?.[0]?.detail || 'Failed to unwatch card');
  }

  const result = await response.json();
  const included = result.included as Record<string, unknown>[] | undefined;
  return transformCard(result.data, included);
}

// Assign a member to a card
export async function assignMember(cardId: string, userId: string): Promise<Card> {
  // First fetch current members
  const card = await fetchCard(cardId);
  const currentMembers = card.memberIds || [];

  // Add user if not already assigned
  if (currentMembers.includes(userId)) {
    return card;
  }

  const newMembers = [...currentMembers, userId];

  const response = await fetchWithCsrf(`${API_URL}/jsonapi/node/card/${cardId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: {
        type: 'node--card',
        id: cardId,
        relationships: {
          field_card_members: {
            data: newMembers.map(id => ({ type: 'user--user', id })),
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.errors?.[0]?.detail || 'Failed to assign member');
  }

  // Fetch the updated card to get member details
  return fetchCard(cardId);
}

// Unassign a member from a card
export async function unassignMember(cardId: string, userId: string): Promise<Card> {
  // First fetch current members
  const card = await fetchCard(cardId);
  const currentMembers = card.memberIds || [];

  // Remove user if assigned
  if (!currentMembers.includes(userId)) {
    return card;
  }

  const newMembers = currentMembers.filter(id => id !== userId);

  const response = await fetchWithCsrf(`${API_URL}/jsonapi/node/card/${cardId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: {
        type: 'node--card',
        id: cardId,
        relationships: {
          field_card_members: {
            data: newMembers.length > 0
              ? newMembers.map(id => ({ type: 'user--user', id }))
              : [],
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.errors?.[0]?.detail || 'Failed to unassign member');
  }

  // Fetch the updated card to get member details
  return fetchCard(cardId);
}
