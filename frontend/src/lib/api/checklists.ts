import { getAccessToken, fetchWithCsrf } from './client';

const API_URL = import.meta.env.VITE_API_URL || 'https://boxtasks2.ddev.site';

export interface ChecklistItemAssignee {
  id: string;
  name: string;
}

export interface ChecklistItemCompletedBy {
  id: string;
  name: string;
}

export interface ChecklistItem {
  id: string;
  title: string;
  checklistId: string;
  completed: boolean;
  position: number;
  dueDate?: string;
  parentId?: string;
  children?: ChecklistItem[];
  assigneeId?: string;
  assignee?: ChecklistItemAssignee;
  completedById?: string;
  completedBy?: ChecklistItemCompletedBy;
  completedAt?: string;
}

export interface Checklist {
  id: string;
  title: string;
  cardId: string;
  items: ChecklistItem[];
  createdAt: string;
}

// Transform JSON:API response to ChecklistItem
function transformChecklistItem(data: Record<string, unknown>, included?: Record<string, unknown>[]): ChecklistItem {
  const attrs = data.attributes as Record<string, unknown>;
  const rels = data.relationships as Record<string, { data: { id: string } | null }> | undefined;

  // Get assignee ID and details
  const assigneeId = rels?.field_item_assignee?.data?.id;
  let assignee: ChecklistItemAssignee | undefined;
  if (included && assigneeId) {
    const user = included.find((item) => item.id === assigneeId && item.type === 'user--user');
    if (user) {
      const userAttrs = user.attributes as Record<string, unknown>;
      assignee = {
        id: assigneeId,
        name: (userAttrs.field_display_name as string) || (userAttrs.name as string) || 'Unknown',
      };
    }
  }

  // Get completed by user and timestamp
  const completedById = rels?.field_item_completed_by?.data?.id;
  let completedBy: ChecklistItemCompletedBy | undefined;
  if (included && completedById) {
    const user = included.find((item) => item.id === completedById && item.type === 'user--user');
    if (user) {
      const userAttrs = user.attributes as Record<string, unknown>;
      completedBy = {
        id: completedById,
        name: (userAttrs.field_display_name as string) || (userAttrs.name as string) || 'Unknown',
      };
    }
  }
  const completedAt = attrs.field_item_completed_at as string | undefined;

  return {
    id: data.id as string,
    title: attrs.title as string,
    checklistId: rels?.field_item_checklist?.data?.id || '',
    completed: (attrs.field_item_completed as boolean) || false,
    position: (attrs.field_item_position as number) || 0,
    dueDate: attrs.field_item_due_date as string | undefined,
    parentId: rels?.field_item_parent?.data?.id,
    children: [],
    assigneeId,
    assignee,
    completedById,
    completedBy,
    completedAt,
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
    `${API_URL}/jsonapi/node/checklist_item?${filterParams}&sort=field_item_position&include=field_item_assignee,field_item_completed_by`,
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
    const includedData = itemsResult.included as Record<string, unknown>[] | undefined;
    if (Array.isArray(itemsData)) {
      const allItems = itemsData.map((item: Record<string, unknown>) => transformChecklistItem(item, includedData));

      // Build nested structure
      const itemMap = new Map<string, ChecklistItem>();
      allItems.forEach(item => itemMap.set(item.id, item));

      // Group items by checklist and build hierarchy
      for (const checklist of checklists) {
        const checklistItems = allItems.filter((item) => item.checklistId === checklist.id);

        // Build parent-child relationships
        const rootItems: ChecklistItem[] = [];
        checklistItems.forEach(item => {
          if (item.parentId && itemMap.has(item.parentId)) {
            const parent = itemMap.get(item.parentId)!;
            if (!parent.children) parent.children = [];
            parent.children.push(item);
          } else {
            rootItems.push(item);
          }
        });

        // Sort children by position
        const sortChildren = (items: ChecklistItem[]) => {
          items.sort((a, b) => a.position - b.position);
          items.forEach(item => {
            if (item.children?.length) sortChildren(item.children);
          });
        };
        sortChildren(rootItems);

        checklist.items = rootItems;
      }
    }
  }

  return checklists;
}

// Create a new checklist
export async function createChecklist(cardId: string, title: string): Promise<Checklist> {
  const response = await fetchWithCsrf(`${API_URL}/jsonapi/node/checklist`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
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
  const response = await fetchWithCsrf(`${API_URL}/jsonapi/node/checklist/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok && response.status !== 204) {
    throw new Error('Failed to delete checklist');
  }
}

// Create a new checklist item
export async function createChecklistItem(
  checklistId: string,
  title: string,
  position: number,
  parentId?: string,
  assigneeId?: string
): Promise<ChecklistItem> {
  const relationships: Record<string, unknown> = {
    field_item_checklist: {
      data: { type: 'node--checklist', id: checklistId },
    },
  };

  if (parentId) {
    relationships.field_item_parent = {
      data: { type: 'node--checklist_item', id: parentId },
    };
  }

  if (assigneeId) {
    relationships.field_item_assignee = {
      data: { type: 'user--user', id: assigneeId },
    };
  }

  const response = await fetchWithCsrf(`${API_URL}/jsonapi/node/checklist_item`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: {
        type: 'node--checklist_item',
        attributes: {
          title,
          field_item_completed: false,
          field_item_position: position,
        },
        relationships,
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
export async function updateChecklistItem(
  id: string,
  updates: { title?: string; completed?: boolean; position?: number; dueDate?: string | null },
  completedByUserId?: string
): Promise<ChecklistItem> {
  const attributes: Record<string, unknown> = {};
  const relationships: Record<string, unknown> = {};

  if (updates.title !== undefined) attributes.title = updates.title;
  if (updates.completed !== undefined) {
    attributes.field_item_completed = updates.completed;
    // Set completion metadata when marking as completed
    if (updates.completed && completedByUserId) {
      // Format date as RFC 3339 with timezone offset (Drupal datetime format)
      const now = new Date();
      const completedAt = now.toISOString().replace(/\.\d{3}Z$/, '+00:00');
      attributes.field_item_completed_at = completedAt;
      relationships.field_item_completed_by = {
        data: { type: 'user--user', id: completedByUserId },
      };
    } else if (!updates.completed) {
      // Clear completion metadata when unchecking
      attributes.field_item_completed_at = null;
      relationships.field_item_completed_by = { data: null };
    }
  }
  if (updates.position !== undefined) attributes.field_item_position = updates.position;
  if (updates.dueDate !== undefined) attributes.field_item_due_date = updates.dueDate;

  const response = await fetchWithCsrf(`${API_URL}/jsonapi/node/checklist_item/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: {
        type: 'node--checklist_item',
        id,
        attributes,
        ...(Object.keys(relationships).length > 0 && { relationships }),
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.errors?.[0]?.detail || 'Failed to update checklist item');
  }

  // Refetch to get included user data for completedBy
  const itemResponse = await fetch(
    `${API_URL}/jsonapi/node/checklist_item/${id}?include=field_item_assignee,field_item_completed_by`,
    {
      headers: {
        'Accept': 'application/vnd.api+json',
        'Authorization': `Bearer ${getAccessToken()}`,
      },
    }
  );

  if (!itemResponse.ok) {
    throw new Error('Failed to fetch updated checklist item');
  }

  const itemResult = await itemResponse.json();
  return transformChecklistItem(itemResult.data, itemResult.included);
}

// Delete a checklist item
export async function deleteChecklistItem(id: string): Promise<void> {
  const response = await fetchWithCsrf(`${API_URL}/jsonapi/node/checklist_item/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok && response.status !== 204) {
    throw new Error('Failed to delete checklist item');
  }
}

// Update checklist item assignee
export async function updateChecklistItemAssignee(id: string, assigneeId: string | null): Promise<ChecklistItem> {
  const response = await fetchWithCsrf(`${API_URL}/jsonapi/node/checklist_item/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: {
        type: 'node--checklist_item',
        id,
        relationships: {
          field_item_assignee: {
            data: assigneeId ? { type: 'user--user', id: assigneeId } : null,
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.errors?.[0]?.detail || 'Failed to update checklist item assignee');
  }

  // Refetch to get included user data
  const itemResponse = await fetch(
    `${API_URL}/jsonapi/node/checklist_item/${id}?include=field_item_assignee,field_item_completed_by`,
    {
      headers: {
        'Accept': 'application/vnd.api+json',
        'Authorization': `Bearer ${getAccessToken()}`,
      },
    }
  );

  if (!itemResponse.ok) {
    throw new Error('Failed to fetch updated checklist item');
  }

  const itemResult = await itemResponse.json();
  return transformChecklistItem(itemResult.data, itemResult.included);
}

// Helper: Count all items in a checklist (including nested)
export function countChecklistItems(items: ChecklistItem[]): { total: number; completed: number } {
  let total = 0;
  let completed = 0;

  const countRecursive = (itemList: ChecklistItem[]) => {
    for (const item of itemList) {
      total++;
      if (item.completed) completed++;
      if (item.children?.length) {
        countRecursive(item.children);
      }
    }
  };

  countRecursive(items);
  return { total, completed };
}

// Helper: Flatten nested items into a single array
export function flattenChecklistItems(items: ChecklistItem[]): ChecklistItem[] {
  const result: ChecklistItem[] = [];

  const flatten = (itemList: ChecklistItem[]) => {
    for (const item of itemList) {
      result.push(item);
      if (item.children?.length) {
        flatten(item.children);
      }
    }
  };

  flatten(items);
  return result;
}

// Helper: Find an item by ID in nested structure
export function findChecklistItem(items: ChecklistItem[], id: string): ChecklistItem | undefined {
  for (const item of items) {
    if (item.id === id) return item;
    if (item.children?.length) {
      const found = findChecklistItem(item.children, id);
      if (found) return found;
    }
  }
  return undefined;
}

// Helper: Get max nesting level (for UI display limits)
export function getMaxNestingLevel(items: ChecklistItem[], currentLevel = 0): number {
  let maxLevel = currentLevel;
  for (const item of items) {
    if (item.children?.length) {
      maxLevel = Math.max(maxLevel, getMaxNestingLevel(item.children, currentLevel + 1));
    }
  }
  return maxLevel;
}

// Maximum allowed nesting depth
export const MAX_NESTING_DEPTH = 3;
