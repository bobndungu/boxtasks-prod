import { getAccessToken, fetchWithCsrf } from './client';

const API_URL = import.meta.env.VITE_API_URL || 'https://boxtasks2.ddev.site';

export interface Board {
  id: string;
  title: string;
  description?: string;
  workspaceId: string;
  visibility: 'private' | 'workspace' | 'public';
  background: string;
  starred: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBoardData {
  title: string;
  description?: string;
  workspaceId: string;
  visibility?: 'private' | 'workspace' | 'public';
  background?: string;
}

// Transform JSON:API response to Board
function transformBoard(data: Record<string, unknown>): Board {
  const attrs = data.attributes as Record<string, unknown>;
  const rels = data.relationships as Record<string, { data: { id: string } | null }> | undefined;

  return {
    id: data.id as string,
    title: attrs.title as string,
    description: (attrs.field_board_description as { value?: string })?.value || '',
    workspaceId: rels?.field_board_workspace?.data?.id || '',
    visibility: (attrs.field_board_visibility as 'private' | 'workspace' | 'public') || 'workspace',
    background: (attrs.field_board_background as string) || '#0079BF',
    starred: (attrs.field_board_starred as boolean) || false,
    archived: (attrs.field_board_archived as boolean) || false,
    createdAt: attrs.created as string,
    updatedAt: attrs.changed as string,
  };
}

// Fetch all boards the user has access to
export async function fetchAllBoards(): Promise<Board[]> {
  const response = await fetch(
    `${API_URL}/jsonapi/node/board?filter[field_board_archived][value]=0&sort=title`,
    {
      headers: {
        'Accept': 'application/vnd.api+json',
        'Authorization': `Bearer ${getAccessToken()}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch boards');
  }

  const result = await response.json();
  const data = result.data;
  if (!Array.isArray(data)) return [];

  return data.map(transformBoard);
}

// Fetch all boards for a workspace
export async function fetchBoardsByWorkspace(workspaceId: string): Promise<Board[]> {
  const response = await fetch(
    `${API_URL}/jsonapi/node/board?filter[field_board_workspace.id]=${workspaceId}&filter[field_board_archived][value]=0&sort=-created`,
    {
      headers: {
        'Accept': 'application/vnd.api+json',
        'Authorization': `Bearer ${getAccessToken()}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch boards');
  }

  const result = await response.json();
  const data = result.data;
  if (!Array.isArray(data)) return [];

  return data.map(transformBoard);
}

// Fetch starred boards for the current user
export async function fetchStarredBoards(): Promise<Board[]> {
  const response = await fetch(
    `${API_URL}/jsonapi/node/board?filter[field_board_starred][value]=1&filter[field_board_archived][value]=0&sort=-changed`,
    {
      headers: {
        'Accept': 'application/vnd.api+json',
        'Authorization': `Bearer ${getAccessToken()}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch starred boards');
  }

  const result = await response.json();
  const data = result.data;
  if (!Array.isArray(data)) return [];

  return data.map(transformBoard);
}

// Fetch recent boards
export async function fetchRecentBoards(limit: number = 5): Promise<Board[]> {
  const response = await fetch(
    `${API_URL}/jsonapi/node/board?filter[field_board_archived][value]=0&sort=-changed&page[limit]=${limit}`,
    {
      headers: {
        'Accept': 'application/vnd.api+json',
        'Authorization': `Bearer ${getAccessToken()}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch recent boards');
  }

  const result = await response.json();
  const data = result.data;
  if (!Array.isArray(data)) return [];

  return data.map(transformBoard);
}

// Fetch a single board by ID
export async function fetchBoard(id: string): Promise<Board> {
  const response = await fetch(
    `${API_URL}/jsonapi/node/board/${id}?include=field_board_workspace`,
    {
      headers: {
        'Accept': 'application/vnd.api+json',
        'Authorization': `Bearer ${getAccessToken()}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch board');
  }

  const result = await response.json();
  return transformBoard(result.data);
}

// Create a new board
export async function createBoard(data: CreateBoardData): Promise<Board> {
  const response = await fetchWithCsrf(`${API_URL}/jsonapi/node/board`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: {
        type: 'node--board',
        attributes: {
          title: data.title,
          field_board_description: data.description ? { value: data.description } : null,
          field_board_visibility: data.visibility || 'workspace',
          field_board_background: data.background || '#0079BF',
          field_board_starred: false,
          field_board_archived: false,
        },
        relationships: {
          field_board_workspace: {
            data: { type: 'node--workspace', id: data.workspaceId },
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.errors?.[0]?.detail || 'Failed to create board');
  }

  const result = await response.json();
  return transformBoard(result.data);
}

// Update a board
export async function updateBoard(id: string, data: Partial<CreateBoardData> & { starred?: boolean; archived?: boolean }): Promise<Board> {
  const attributes: Record<string, unknown> = {};

  if (data.title) attributes.title = data.title;
  if (data.description !== undefined) {
    attributes.field_board_description = data.description ? { value: data.description } : null;
  }
  if (data.visibility) attributes.field_board_visibility = data.visibility;
  if (data.background) attributes.field_board_background = data.background;
  if (data.starred !== undefined) attributes.field_board_starred = data.starred;
  if (data.archived !== undefined) attributes.field_board_archived = data.archived;

  const response = await fetchWithCsrf(`${API_URL}/jsonapi/node/board/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: {
        type: 'node--board',
        id,
        attributes,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.errors?.[0]?.detail || 'Failed to update board');
  }

  const result = await response.json();
  return transformBoard(result.data);
}

// Delete a board
export async function deleteBoard(id: string): Promise<void> {
  const response = await fetchWithCsrf(`${API_URL}/jsonapi/node/board/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok && response.status !== 204) {
    throw new Error('Failed to delete board');
  }
}

// Toggle board starred status
export async function toggleBoardStar(id: string, starred: boolean): Promise<Board> {
  return updateBoard(id, { starred });
}

// Archive a board
export async function archiveBoard(id: string): Promise<Board> {
  return updateBoard(id, { archived: true });
}

// Restore a board from archive
export async function restoreBoard(id: string): Promise<Board> {
  return updateBoard(id, { archived: false });
}
