import { getAccessToken } from './client';

const API_URL = import.meta.env.VITE_API_URL || 'https://boxtasks2.ddev.site';

export interface BoardList {
  id: string;
  title: string;
  boardId: string;
  position: number;
  archived: boolean;
  wipLimit: number;
  color: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateListData {
  title: string;
  boardId: string;
  position?: number;
  archived?: boolean;
  wipLimit?: number;
  color?: string | null;
}

// Transform JSON:API response to BoardList
function transformList(data: Record<string, unknown>): BoardList {
  const attrs = data.attributes as Record<string, unknown>;
  const rels = data.relationships as Record<string, { data: { id: string } | null }> | undefined;

  return {
    id: data.id as string,
    title: attrs.title as string,
    boardId: rels?.field_list_board?.data?.id || '',
    position: (attrs.field_list_position as number) || 0,
    archived: (attrs.field_list_archived as boolean) || false,
    wipLimit: (attrs.field_list_wip_limit as number) || 0,
    color: (attrs.field_list_color as string) || null,
    createdAt: attrs.created as string,
    updatedAt: attrs.changed as string,
  };
}

// Fetch all lists for a board (excludes archived by default)
export async function fetchListsByBoard(boardId: string, includeArchived = false): Promise<BoardList[]> {
  const archivedFilter = includeArchived ? '' : '&filter[field_list_archived][value]=0';
  const response = await fetch(
    `${API_URL}/jsonapi/node/board_list?filter[field_list_board.id]=${boardId}${archivedFilter}&sort=field_list_position`,
    {
      headers: {
        'Accept': 'application/vnd.api+json',
        'Authorization': `Bearer ${getAccessToken()}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch lists');
  }

  const result = await response.json();
  const data = result.data;
  if (!Array.isArray(data)) return [];

  return data.map(transformList);
}

// Create a new list
export async function createList(data: CreateListData): Promise<BoardList> {
  const response = await fetch(`${API_URL}/jsonapi/node/board_list`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
      'Authorization': `Bearer ${getAccessToken()}`,
    },
    body: JSON.stringify({
      data: {
        type: 'node--board_list',
        attributes: {
          title: data.title,
          field_list_position: data.position || 0,
        },
        relationships: {
          field_list_board: {
            data: { type: 'node--board', id: data.boardId },
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.errors?.[0]?.detail || 'Failed to create list');
  }

  const result = await response.json();
  return transformList(result.data);
}

// Update a list
export async function updateList(id: string, data: Partial<CreateListData>): Promise<BoardList> {
  const attributes: Record<string, unknown> = {};

  if (data.title) attributes.title = data.title;
  if (data.position !== undefined) attributes.field_list_position = data.position;
  if (data.archived !== undefined) attributes.field_list_archived = data.archived;
  if (data.wipLimit !== undefined) attributes.field_list_wip_limit = data.wipLimit;
  if (data.color !== undefined) attributes.field_list_color = data.color;

  const response = await fetch(`${API_URL}/jsonapi/node/board_list/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
      'Authorization': `Bearer ${getAccessToken()}`,
    },
    body: JSON.stringify({
      data: {
        type: 'node--board_list',
        id,
        attributes,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.errors?.[0]?.detail || 'Failed to update list');
  }

  const result = await response.json();
  return transformList(result.data);
}

// Delete a list
export async function deleteList(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/jsonapi/node/board_list/${id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${getAccessToken()}`,
    },
  });

  if (!response.ok && response.status !== 204) {
    throw new Error('Failed to delete list');
  }
}

// Reorder lists (update positions)
export async function reorderLists(lists: { id: string; position: number }[]): Promise<void> {
  await Promise.all(
    lists.map((list) => updateList(list.id, { position: list.position }))
  );
}

// Archive a list
export async function archiveList(id: string): Promise<BoardList> {
  return updateList(id, { archived: true });
}

// Restore an archived list
export async function restoreList(id: string): Promise<BoardList> {
  return updateList(id, { archived: false });
}
