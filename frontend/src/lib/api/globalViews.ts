import { fetchWithCsrf, getAccessToken } from './client';

const API_URL = import.meta.env.VITE_API_URL || 'https://boxtasks2.ddev.site';

export interface CardMember {
  id: string;
  username: string;
  displayName: string;
}

export interface CardLabel {
  id: string;
  name: string;
  color: string;
}

export interface BoardRef {
  id: string;
  name: string;
}

export interface WorkspaceRef {
  id: string;
  name: string;
}

export interface ListRef {
  id: string | null;
  name: string;
}

export interface GlobalCard {
  id: string;
  title: string;
  description: string | null;
  completed: boolean;
  archived: boolean;
  dueDate: string | null;
  startDate: string | null;
  position?: number;
  board: BoardRef;
  workspace: WorkspaceRef;
  list: ListRef;
  members?: CardMember[];
  labels?: CardLabel[];
  createdAt: string;
  updatedAt: string;
}

export interface EverythingViewResponse {
  cards: GlobalCard[];
  total: number;
  boards: BoardRef[];
  workspaces: WorkspaceRef[];
}

export interface MyCardsStats {
  total: number;
  completed: number;
  overdue: number;
  dueToday: number;
  dueThisWeek: number;
  noDueDate: number;
}

export interface MyCardsResponse {
  cards: GlobalCard[];
  stats: MyCardsStats;
}

export interface EverythingViewFilters {
  board?: string;
  workspace?: string;
  completed?: '0' | '1';
  archived?: '0' | '1';
  dueDate?: 'overdue' | 'today' | 'week';
  sort?: 'updated' | 'due_date' | 'created' | 'title';
  order?: 'asc' | 'desc';
}

export interface MyCardsFilters {
  completed?: '0' | '1';
  archived?: '0' | '1';
  dueDate?: 'overdue' | 'today' | 'week' | 'no_date';
  sort?: 'due_date' | 'updated' | 'created' | 'title';
  order?: 'asc' | 'desc';
}

/**
 * Fetch all cards the user has access to across all boards
 */
export async function fetchEverythingView(
  filters: EverythingViewFilters = {}
): Promise<EverythingViewResponse> {
  const token = getAccessToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const params = new URLSearchParams();
  if (filters.board) params.set('board', filters.board);
  if (filters.workspace) params.set('workspace', filters.workspace);
  if (filters.completed) params.set('completed', filters.completed);
  if (filters.archived) params.set('archived', filters.archived);
  if (filters.dueDate) params.set('due_date', filters.dueDate);
  if (filters.sort) params.set('sort', filters.sort);
  if (filters.order) params.set('order', filters.order);

  const queryString = params.toString();
  const url = `${API_URL}/api/views/everything${queryString ? '?' + queryString : ''}`;

  const response = await fetchWithCsrf(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Not authenticated');
    }
    throw new Error('Failed to fetch everything view');
  }

  return response.json();
}

/**
 * Fetch cards assigned to the current user
 */
export async function fetchMyCards(
  filters: MyCardsFilters = {}
): Promise<MyCardsResponse> {
  const token = getAccessToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const params = new URLSearchParams();
  if (filters.completed) params.set('completed', filters.completed);
  if (filters.archived) params.set('archived', filters.archived);
  if (filters.dueDate) params.set('due_date', filters.dueDate);
  if (filters.sort) params.set('sort', filters.sort);
  if (filters.order) params.set('order', filters.order);

  const queryString = params.toString();
  const url = `${API_URL}/api/views/my-cards${queryString ? '?' + queryString : ''}`;

  const response = await fetchWithCsrf(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Not authenticated');
    }
    throw new Error('Failed to fetch my cards');
  }

  return response.json();
}
