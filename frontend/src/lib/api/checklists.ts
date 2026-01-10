import { getAccessToken } from './client';

const API_URL = import.meta.env.VITE_API_URL || 'https://boxtasks2.ddev.site';

export interface ChecklistItem {
  id: string;
  title: string;
  checklistId: string;
  completed: boolean;
  position: number;
  dueDate?: string;
}

export interface Checklist {
  id: string;
  title: string;
  cardId: string;
  items: ChecklistItem[];
  createdAt: string;
}

// Transform JSON:API response to ChecklistItem
function transformChecklistItem(data: Record<string, unknown>): ChecklistItem {
  const attrs = data.attributes as Record<string, unknown>;
  const rels = data.relationships as Record<string, { data: { id: string } | null }> | undefined;

  return {
    id: data.id as string,
    title: attrs.title as string,
    checklistId: rels?.field_item_checklist?.data?.id || '',
    completed: (attrs.field_item_completed as boolean) || false,
    position: (attrs.field_item_position as number) || 0,
    dueDate: attrs.field_item_due_date as string | undefined,
  };
}

// Transform JSON:API response to Checklist
function transformChecklist(data: Record<string, unknown>): Checklist {
  const attrs = data.attributes as Record<string, unknown>;
  const rels = data.relationships as Record<string, { data: { id: string } | null }> | undefined;

  return {
    id: data.id as string,
    title: attrs.title as string,
    cardId: rels?.field_checklist_card?.data?.id || '',
    items: [],
    createdAt: attrs.created as string,
  };
}

// Fetch all checklists for a card (with items)
export async function fetchChecklistsByCard(cardId: string): Promise<Checklist[]> {
  // First fetch checklists
  const checklistsResponse = await fetch(
    `${API_URL}/jsonapi/node/checklist?filter[field_checklist_card.id]=${cardId}&sort=created`,
    {
      headers: {
        'Accept': 'application/vnd.api+json',
        'Authorization': `Bearer ${getAccessToken()}`,
      },
    }
  );

  if (!checklistsResponse.ok) {
    throw new Error('Failed to fetch checklists');
  }

  const checklistsResult = await checklistsResponse.json();
  const checklistsData = checklistsResult.data;
  if (!Array.isArray(checklistsData) || checklistsData.length === 0) return [];

  const checklists = checklistsData.map((item: Record<string, unknown>) => transformChecklist(item));

  // Then fetch items for all checklists
  const checklistIds = checklists.map((c) => c.id);
  const filterParams = checklistIds.map((id, index) =>
    `filter[list-filter-${index}][condition][path]=field_item_checklist.id&filter[list-filter-${index}][condition][value]=${id}`
  ).join('&');

  const itemsResponse = await fetch(
    `${API_URL}/jsonapi/node/checklist_item?${filterParams}&sort=field_item_position`,
    {
      headers: {
        'Accept': 'application/vnd.api+json',
        'Authorization': `Bearer ${getAccessToken()}`,
      },
    }
  );

  if (itemsResponse.ok) {
    const itemsResult = await itemsResponse.json();
    const itemsData = itemsResult.data;
    if (Array.isArray(itemsData)) {
      const items = itemsData.map((item: Record<string, unknown>) => transformChecklistItem(item));
      // Group items by checklist
      for (const checklist of checklists) {
        checklist.items = items.filter((item) => item.checklistId === checklist.id);
      }
    }
  }

  return checklists;
}

// Create a new checklist
export async function createChecklist(cardId: string, title: string): Promise<Checklist> {
  const response = await fetch(`${API_URL}/jsonapi/node/checklist`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
      'Authorization': `Bearer ${getAccessToken()}`,
    },
    body: JSON.stringify({
      data: {
        type: 'node--checklist',
        attributes: {
          title,
        },
        relationships: {
          field_checklist_card: {
            data: { type: 'node--card', id: cardId },
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.errors?.[0]?.detail || 'Failed to create checklist');
  }

  const result = await response.json();
  return transformChecklist(result.data);
}

// Delete a checklist
export async function deleteChecklist(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/jsonapi/node/checklist/${id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${getAccessToken()}`,
    },
  });

  if (!response.ok && response.status !== 204) {
    throw new Error('Failed to delete checklist');
  }
}

// Create a new checklist item
export async function createChecklistItem(checklistId: string, title: string, position: number): Promise<ChecklistItem> {
  const response = await fetch(`${API_URL}/jsonapi/node/checklist_item`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
      'Authorization': `Bearer ${getAccessToken()}`,
    },
    body: JSON.stringify({
      data: {
        type: 'node--checklist_item',
        attributes: {
          title,
          field_item_completed: false,
          field_item_position: position,
        },
        relationships: {
          field_item_checklist: {
            data: { type: 'node--checklist', id: checklistId },
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.errors?.[0]?.detail || 'Failed to create checklist item');
  }

  const result = await response.json();
  return transformChecklistItem(result.data);
}

// Update a checklist item
export async function updateChecklistItem(id: string, updates: { title?: string; completed?: boolean; position?: number; dueDate?: string | null }): Promise<ChecklistItem> {
  const attributes: Record<string, unknown> = {};
  if (updates.title !== undefined) attributes.title = updates.title;
  if (updates.completed !== undefined) attributes.field_item_completed = updates.completed;
  if (updates.position !== undefined) attributes.field_item_position = updates.position;
  if (updates.dueDate !== undefined) attributes.field_item_due_date = updates.dueDate;

  const response = await fetch(`${API_URL}/jsonapi/node/checklist_item/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
      'Authorization': `Bearer ${getAccessToken()}`,
    },
    body: JSON.stringify({
      data: {
        type: 'node--checklist_item',
        id,
        attributes,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.errors?.[0]?.detail || 'Failed to update checklist item');
  }

  const result = await response.json();
  return transformChecklistItem(result.data);
}

// Delete a checklist item
export async function deleteChecklistItem(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/jsonapi/node/checklist_item/${id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${getAccessToken()}`,
    },
  });

  if (!response.ok && response.status !== 204) {
    throw new Error('Failed to delete checklist item');
  }
}
