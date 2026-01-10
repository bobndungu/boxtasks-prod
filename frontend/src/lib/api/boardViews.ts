import { getAccessToken } from './client';

const API_URL = import.meta.env.VITE_API_URL || 'https://boxtasks2.ddev.site';

export type BoardViewType = 'kanban' | 'calendar' | 'timeline' | 'table' | 'dashboard';

export interface BoardView {
  id: string;
  title: string;
  boardId: string;
  type: BoardViewType;
  settings: Record<string, unknown>;
  shared: boolean;
  isDefault: boolean;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBoardViewData {
  title: string;
  boardId: string;
  type: BoardViewType;
  settings?: Record<string, unknown>;
  shared?: boolean;
  isDefault?: boolean;
}

export interface UpdateBoardViewData {
  title?: string;
  type?: BoardViewType;
  settings?: Record<string, unknown>;
  shared?: boolean;
  isDefault?: boolean;
}

// Transform JSON:API response to BoardView
function transformBoardView(data: Record<string, unknown>): BoardView {
  const attrs = data.attributes as Record<string, unknown>;
  const rels = data.relationships as Record<string, { data: { id: string } | null }> | undefined;

  let settings: Record<string, unknown> = {};
  try {
    const settingsValue = (attrs.field_view_settings as { value?: string })?.value;
    if (settingsValue) {
      settings = JSON.parse(settingsValue);
    }
  } catch {
    settings = {};
  }

  return {
    id: data.id as string,
    title: attrs.title as string,
    boardId: rels?.field_view_board?.data?.id || '',
    type: (attrs.field_view_type as BoardViewType) || 'kanban',
    settings,
    shared: (attrs.field_view_shared as boolean) || false,
    isDefault: (attrs.field_view_default as boolean) || false,
    ownerId: rels?.uid?.data?.id || '',
    createdAt: attrs.created as string,
    updatedAt: attrs.changed as string,
  };
}

// Fetch board views for a board
export async function fetchBoardViews(boardId: string): Promise<BoardView[]> {
  const response = await fetch(
    `${API_URL}/jsonapi/node/board_view?filter[field_view_board.id]=${boardId}`,
    {
      headers: {
        'Accept': 'application/vnd.api+json',
        'Authorization': `Bearer ${getAccessToken()}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch board views');
  }

  const result = await response.json();
  const data = result.data;
  if (!Array.isArray(data)) return [];

  return data.map(transformBoardView);
}

// Fetch a single board view
export async function fetchBoardView(id: string): Promise<BoardView> {
  const response = await fetch(
    `${API_URL}/jsonapi/node/board_view/${id}?include=field_view_board`,
    {
      headers: {
        'Accept': 'application/vnd.api+json',
        'Authorization': `Bearer ${getAccessToken()}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch board view');
  }

  const result = await response.json();
  return transformBoardView(result.data);
}

// Create a board view
export async function createBoardView(data: CreateBoardViewData): Promise<BoardView> {
  const response = await fetch(`${API_URL}/jsonapi/node/board_view`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
      'Authorization': `Bearer ${getAccessToken()}`,
    },
    body: JSON.stringify({
      data: {
        type: 'node--board_view',
        attributes: {
          title: data.title,
          field_view_type: data.type,
          field_view_settings: data.settings ? { value: JSON.stringify(data.settings) } : null,
          field_view_shared: data.shared || false,
          field_view_default: data.isDefault || false,
        },
        relationships: {
          field_view_board: {
            data: { type: 'node--board', id: data.boardId },
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.errors?.[0]?.detail || 'Failed to create board view');
  }

  const result = await response.json();
  return transformBoardView(result.data);
}

// Update a board view
export async function updateBoardView(id: string, data: UpdateBoardViewData): Promise<BoardView> {
  const attributes: Record<string, unknown> = {};

  if (data.title !== undefined) attributes.title = data.title;
  if (data.type !== undefined) attributes.field_view_type = data.type;
  if (data.settings !== undefined) attributes.field_view_settings = { value: JSON.stringify(data.settings) };
  if (data.shared !== undefined) attributes.field_view_shared = data.shared;
  if (data.isDefault !== undefined) attributes.field_view_default = data.isDefault;

  const response = await fetch(`${API_URL}/jsonapi/node/board_view/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
      'Authorization': `Bearer ${getAccessToken()}`,
    },
    body: JSON.stringify({
      data: {
        type: 'node--board_view',
        id,
        attributes,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.errors?.[0]?.detail || 'Failed to update board view');
  }

  const result = await response.json();
  return transformBoardView(result.data);
}

// Delete a board view
export async function deleteBoardView(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/jsonapi/node/board_view/${id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${getAccessToken()}`,
    },
  });

  if (!response.ok && response.status !== 204) {
    throw new Error('Failed to delete board view');
  }
}

// Set a view as the default for a board (unsets other defaults)
export async function setDefaultBoardView(boardId: string, viewId: string): Promise<void> {
  // First, unset all existing defaults for this board
  const views = await fetchBoardViews(boardId);

  for (const view of views) {
    if (view.isDefault && view.id !== viewId) {
      await updateBoardView(view.id, { isDefault: false });
    }
  }

  // Set the new default
  await updateBoardView(viewId, { isDefault: true });
}
