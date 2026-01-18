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
  memberSetup?: 'inherit' | 'just_me' | 'custom';
}

export interface BoardMemberSetup {
  userId: string;
  roleId: string;
}

export interface CreateBoardData {
  title: string;
  description?: string;
  workspaceId: string;
  visibility?: 'private' | 'workspace' | 'public';
  background?: string;
  memberSetup?: 'inherit' | 'just_me' | 'custom';
  members?: BoardMemberSetup[];
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
  // Build member relationships if provided
  const relationships: Record<string, unknown> = {
    field_board_workspace: {
      data: { type: 'node--workspace', id: data.workspaceId },
    },
  };

  // Add board members if custom member setup is used
  if (data.members && data.members.length > 0) {
    relationships.field_board_members = {
      data: data.members.map(m => ({ type: 'user--user', id: m.userId })),
    };
  }

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
          // Store member setup preference
          field_board_member_setup: data.memberSetup || 'inherit',
        },
        relationships,
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

// Update board members (for custom member setup)
export async function updateBoardMembers(boardId: string, memberIds: string[]): Promise<void> {
  const response = await fetchWithCsrf(`${API_URL}/jsonapi/node/board/${boardId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: {
        type: 'node--board',
        id: boardId,
        relationships: {
          field_board_members: {
            data: memberIds.map(id => ({ type: 'user--user', id })),
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.errors?.[0]?.detail || 'Failed to update board members');
  }
}

// Update board admins (for custom member setup)
export async function updateBoardAdmins(boardId: string, adminIds: string[]): Promise<void> {
  const response = await fetchWithCsrf(`${API_URL}/jsonapi/node/board/${boardId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: {
        type: 'node--board',
        id: boardId,
        relationships: {
          field_board_admins: {
            data: adminIds.map(id => ({ type: 'user--user', id })),
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.errors?.[0]?.detail || 'Failed to update board admins');
  }
}

// Prefetch cache to avoid duplicate requests
const prefetchedBoards = new Set<string>();
const prefetchInProgress = new Map<string, Promise<void>>();

// Prefetch board data for faster navigation
// Uses low-priority fetches to warm the cache without blocking
export async function prefetchBoard(id: string): Promise<void> {
  // Skip if already prefetched or in progress
  if (prefetchedBoards.has(id) || prefetchInProgress.has(id)) {
    return;
  }

  const token = getAccessToken();
  if (!token) return;

  // Create abort controller to cancel if navigation happens
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

  const prefetchPromise = (async () => {
    try {
      // Prefetch board, lists, and custom fields in parallel using low-priority fetch
      // These requests will warm the browser cache and Drupal's page cache
      await Promise.all([
        // Board data
        fetch(`${API_URL}/jsonapi/node/board/${id}?include=field_board_workspace`, {
          headers: {
            'Accept': 'application/vnd.api+json',
            'Authorization': `Bearer ${token}`,
          },
          signal: controller.signal,
          priority: 'low' as RequestPriority,
        }),
        // Lists for this board
        fetch(`${API_URL}/jsonapi/node/board_list?filter[field_list_board.id]=${id}&filter[field_list_archived][value]=0&sort=field_list_position`, {
          headers: {
            'Accept': 'application/vnd.api+json',
            'Authorization': `Bearer ${token}`,
          },
          signal: controller.signal,
          priority: 'low' as RequestPriority,
        }),
        // Custom field definitions
        fetch(`${API_URL}/jsonapi/node/custom_field_definition?filter[field_customfield_board.id]=${id}`, {
          headers: {
            'Accept': 'application/vnd.api+json',
            'Authorization': `Bearer ${token}`,
          },
          signal: controller.signal,
          priority: 'low' as RequestPriority,
        }),
      ]);

      // Mark as prefetched
      prefetchedBoards.add(id);
    } catch (err) {
      // Silently ignore prefetch errors - this is just an optimization
      if ((err as Error).name !== 'AbortError') {
        console.debug('Prefetch failed for board:', id, err);
      }
    } finally {
      clearTimeout(timeoutId);
      prefetchInProgress.delete(id);
    }
  })();

  prefetchInProgress.set(id, prefetchPromise);
  return prefetchPromise;
}

// Clear prefetch cache (useful when boards are modified)
export function clearPrefetchCache(boardId?: string): void {
  if (boardId) {
    prefetchedBoards.delete(boardId);
  } else {
    prefetchedBoards.clear();
  }
}

// Types for the consolidated board data endpoint
export interface BoardMember {
  id: string;
  displayName: string;
  email: string;
  drupal_id: number;
  isAdmin?: boolean;
}

export interface BoardListData {
  id: string;
  title: string;
  boardId: string;
  position: number;
  archived: boolean;
  drupal_id: number;
}

export interface BoardCardData {
  id: string;
  title: string;
  description: string;
  listId: string;
  position: number;
  archived: boolean;
  startDate: string | null;
  dueDate: string | null;
  priority: string | null;
  labels: string[];
  assignees: BoardMember[];
  watchers: BoardMember[];
  departmentId: string | null;
  clientId: string | null;
  estimatedHours: number | null;
  authorId: string | null;
  drupal_id: number;
}

export interface CustomFieldDef {
  id: string;
  name: string;
  type: string;
  boardId: string;
  options: string[];
  required: boolean;
  drupal_id: number;
}

export interface CustomFieldValue {
  id: string;
  cardId: string;
  fieldId: string;
  value: string;
  drupal_id: number;
}

export interface TaxonomyTerm {
  id: string;
  name: string;
  drupal_id: number;
}

export interface ConsolidatedBoardData {
  board: {
    id: string;
    title: string;
    description: string;
    workspaceId: string | null;
    color: string | null;
    isStarred: boolean;
    memberSetup: 'inherit' | 'just_me' | 'custom';
    drupal_id: number;
  };
  lists: BoardListData[];
  cards: BoardCardData[];
  customFieldDefinitions: CustomFieldDef[];
  customFieldValues: CustomFieldValue[];
  members: BoardMember[];
  departments: TaxonomyTerm[];
  clients: TaxonomyTerm[];
}

/**
 * Fetch all board data in a single API call.
 * This is the optimized endpoint that reduces 9 API calls to 1.
 * Supports both OAuth tokens and session cookie authentication.
 */
export async function fetchBoardData(boardId: string): Promise<ConsolidatedBoardData> {
  const token = getAccessToken();

  // Build headers - include token if available, but also send cookies
  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };

  // Add Authorization header if we have an OAuth token
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(
    `${API_URL}/api/board/${boardId}/data`,
    {
      headers,
      credentials: 'include', // Include session cookies for cookie-based auth
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to fetch board data: ${response.status} ${text}`);
  }

  return response.json();
}
