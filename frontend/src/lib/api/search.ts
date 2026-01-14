import { getAccessToken } from './client';

const API_URL = import.meta.env.VITE_API_URL || 'https://boxtasks2.ddev.site';

export interface SearchResult {
  id: string;
  title: string;
  type: 'card' | 'board' | 'list' | 'comment' | 'checklist';
  description?: string;
  boardId?: string;
  boardTitle?: string;
  listId?: string;
  listTitle?: string;
  workspaceId?: string;
  workspaceName?: string;
  cardId?: string;
  cardTitle?: string;
  matchedText?: string;
}

export interface GlobalSearchResults {
  cards: SearchResult[];
  boards: SearchResult[];
  comments: SearchResult[];
  checklists: SearchResult[];
  totalResults: number;
}

// Search cards by title or description with full context
export async function searchCards(query: string, workspaceId?: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];

  // Build filter for title OR description search
  let url = `${API_URL}/jsonapi/node/card?filter[or-group][group][conjunction]=OR`;
  url += `&filter[title-filter][condition][path]=title`;
  url += `&filter[title-filter][condition][operator]=CONTAINS`;
  url += `&filter[title-filter][condition][value]=${encodeURIComponent(query)}`;
  url += `&filter[title-filter][condition][memberOf]=or-group`;
  // Production uses 'body' instead of 'field_card_description'
  url += `&filter[desc-filter][condition][path]=body.value`;
  url += `&filter[desc-filter][condition][operator]=CONTAINS`;
  url += `&filter[desc-filter][condition][value]=${encodeURIComponent(query)}`;
  url += `&filter[desc-filter][condition][memberOf]=or-group`;
  url += `&filter[archived][condition][path]=field_card_archived`;
  url += `&filter[archived][condition][value]=0`;
  url += `&include=field_list,field_list.field_board,field_list.field_board.field_board_workspace`;
  url += `&page[limit]=25`;

  const response = await fetch(url, {
    headers: {
      'Accept': 'application/vnd.api+json',
      'Authorization': `Bearer ${getAccessToken()}`,
    },
  });

  if (!response.ok) {
    throw new Error('Search failed');
  }

  const result = await response.json();
  const data = result.data;
  const included = result.included || [];

  if (!Array.isArray(data)) return [];

  // Build lookup maps for included entities
  const includedMap = new Map<string, Record<string, unknown>>();
  for (const inc of included) {
    includedMap.set(`${inc.type}:${inc.id}`, inc);
  }

  return data.map((item: Record<string, unknown>): SearchResult => {
    const attrs = item.attributes as Record<string, unknown>;
    const rels = item.relationships as Record<string, { data: { id: string; type: string } | null }> | undefined;

    // Get list
    const listRef = rels?.field_list?.data;
    const list = listRef ? includedMap.get(`${listRef.type}:${listRef.id}`) : null;
    const listAttrs = list?.attributes as Record<string, unknown> | undefined;
    const listRels = list?.relationships as Record<string, { data: { id: string; type: string } | null }> | undefined;

    // Get board from list
    const boardRef = listRels?.field_board?.data;
    const board = boardRef ? includedMap.get(`${boardRef.type}:${boardRef.id}`) : null;
    const boardAttrs = board?.attributes as Record<string, unknown> | undefined;
    const boardRels = board?.relationships as Record<string, { data: { id: string; type: string } | null }> | undefined;

    // Get workspace from board
    const workspaceRef = boardRels?.field_board_workspace?.data;
    const workspace = workspaceRef ? includedMap.get(`${workspaceRef.type}:${workspaceRef.id}`) : null;
    const workspaceAttrs = workspace?.attributes as Record<string, unknown> | undefined;

    // Filter by workspace if specified
    if (workspaceId && workspaceRef?.id !== workspaceId) {
      return null as unknown as SearchResult;
    }

    return {
      id: item.id as string,
      title: attrs.title as string,
      type: 'card',
      // Production uses 'body' instead of 'field_card_description'
      description: (attrs.body as { value?: string })?.value || (attrs.field_card_description as { value?: string })?.value || undefined,
      listId: listRef?.id || undefined,
      listTitle: (listAttrs?.title as string) || undefined,
      boardId: boardRef?.id || undefined,
      boardTitle: (boardAttrs?.title as string) || undefined,
      workspaceId: workspaceRef?.id || undefined,
      workspaceName: (workspaceAttrs?.title as string) || undefined,
    };
  }).filter(Boolean);
}

// Search boards by title with workspace context
export async function searchBoards(query: string, workspaceId?: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];

  let url = `${API_URL}/jsonapi/node/board?filter[title][operator]=CONTAINS&filter[title][value]=${encodeURIComponent(query)}`;
  url += `&filter[field_board_archived][value]=0`;
  url += `&include=field_board_workspace`;
  url += `&page[limit]=15`;

  if (workspaceId) {
    url += `&filter[workspace][condition][path]=field_board_workspace.id`;
    url += `&filter[workspace][condition][value]=${workspaceId}`;
  }

  const response = await fetch(url, {
    headers: {
      'Accept': 'application/vnd.api+json',
      'Authorization': `Bearer ${getAccessToken()}`,
    },
  });

  if (!response.ok) {
    throw new Error('Search failed');
  }

  const result = await response.json();
  const data = result.data;
  const included = result.included || [];

  if (!Array.isArray(data)) return [];

  // Build lookup map for workspaces
  const workspaceMap = new Map<string, Record<string, unknown>>();
  for (const inc of included) {
    if (inc.type === 'node--workspace') {
      workspaceMap.set(inc.id, inc);
    }
  }

  return data.map((item: Record<string, unknown>): SearchResult => {
    const attrs = item.attributes as Record<string, unknown>;
    const rels = item.relationships as Record<string, { data: { id: string } | null }> | undefined;

    const workspaceRef = rels?.field_board_workspace?.data;
    const workspace = workspaceRef ? workspaceMap.get(workspaceRef.id) : null;
    const workspaceAttrs = workspace?.attributes as Record<string, unknown> | undefined;

    return {
      id: item.id as string,
      title: attrs.title as string,
      type: 'board',
      description: (attrs.field_board_description as string) || undefined,
      workspaceId: workspaceRef?.id || undefined,
      workspaceName: (workspaceAttrs?.title as string) || undefined,
    };
  });
}

// Search comments by body text
export async function searchComments(query: string, _workspaceId?: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];

  let url = `${API_URL}/jsonapi/node/card_comment?filter[body][operator]=CONTAINS&filter[body][value]=${encodeURIComponent(query)}`;
  url += `&include=field_comment_card,field_comment_card.field_list,field_comment_card.field_list.field_board`;
  url += `&page[limit]=15`;

  const response = await fetch(url, {
    headers: {
      'Accept': 'application/vnd.api+json',
      'Authorization': `Bearer ${getAccessToken()}`,
    },
  });

  if (!response.ok) {
    return []; // Silently fail for comments search
  }

  const result = await response.json();
  const data = result.data;
  const included = result.included || [];

  if (!Array.isArray(data)) return [];

  // Build lookup map for included entities
  const includedMap = new Map<string, Record<string, unknown>>();
  for (const inc of included) {
    includedMap.set(`${inc.type}:${inc.id}`, inc);
  }

  return data.map((item: Record<string, unknown>): SearchResult => {
    const attrs = item.attributes as Record<string, unknown>;
    const rels = item.relationships as Record<string, { data: { id: string; type: string } | null }> | undefined;

    // Get card
    const cardRef = rels?.field_comment_card?.data;
    const card = cardRef ? includedMap.get(`${cardRef.type}:${cardRef.id}`) : null;
    const cardAttrs = card?.attributes as Record<string, unknown> | undefined;
    const cardRels = card?.relationships as Record<string, { data: { id: string; type: string } | null }> | undefined;

    // Get list from card
    const listRef = cardRels?.field_list?.data;
    const list = listRef ? includedMap.get(`${listRef.type}:${listRef.id}`) : null;
    const listRels = list?.relationships as Record<string, { data: { id: string; type: string } | null }> | undefined;

    // Get board from list
    const boardRef = listRels?.field_board?.data;
    const board = boardRef ? includedMap.get(`${boardRef.type}:${boardRef.id}`) : null;
    const boardAttrs = board?.attributes as Record<string, unknown> | undefined;

    const body = (attrs.body as { value?: string })?.value || (attrs.field_comment_body as { value?: string })?.value || '';
    const preview = body.substring(0, 100) + (body.length > 100 ? '...' : '');

    return {
      id: item.id as string,
      title: `Comment on "${(cardAttrs?.title as string) || 'card'}"`,
      type: 'comment',
      description: preview,
      matchedText: preview,
      cardId: cardRef?.id || undefined,
      cardTitle: (cardAttrs?.title as string) || undefined,
      boardId: boardRef?.id || undefined,
      boardTitle: (boardAttrs?.title as string) || undefined,
    };
  }).filter((r) => r.cardId); // Only show comments with valid cards
}

// Search checklists by name or item text
export async function searchChecklists(query: string, _workspaceId?: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];

  let url = `${API_URL}/jsonapi/node/checklist?filter[title][operator]=CONTAINS&filter[title][value]=${encodeURIComponent(query)}`;
  url += `&include=field_checklist_card,field_checklist_card.field_list,field_checklist_card.field_list.field_board`;
  url += `&page[limit]=10`;

  const response = await fetch(url, {
    headers: {
      'Accept': 'application/vnd.api+json',
      'Authorization': `Bearer ${getAccessToken()}`,
    },
  });

  if (!response.ok) {
    return []; // Silently fail for checklist search
  }

  const result = await response.json();
  const data = result.data;
  const included = result.included || [];

  if (!Array.isArray(data)) return [];

  // Build lookup map for included entities
  const includedMap = new Map<string, Record<string, unknown>>();
  for (const inc of included) {
    includedMap.set(`${inc.type}:${inc.id}`, inc);
  }

  return data.map((item: Record<string, unknown>): SearchResult => {
    const attrs = item.attributes as Record<string, unknown>;
    const rels = item.relationships as Record<string, { data: { id: string; type: string } | null }> | undefined;

    // Get card
    const cardRef = rels?.field_checklist_card?.data;
    const card = cardRef ? includedMap.get(`${cardRef.type}:${cardRef.id}`) : null;
    const cardAttrs = card?.attributes as Record<string, unknown> | undefined;
    const cardRels = card?.relationships as Record<string, { data: { id: string; type: string } | null }> | undefined;

    // Get list from card
    const listRef = cardRels?.field_list?.data;
    const list = listRef ? includedMap.get(`${listRef.type}:${listRef.id}`) : null;
    const listRels = list?.relationships as Record<string, { data: { id: string; type: string } | null }> | undefined;

    // Get board from list
    const boardRef = listRels?.field_board?.data;
    const board = boardRef ? includedMap.get(`${boardRef.type}:${boardRef.id}`) : null;
    const boardAttrs = board?.attributes as Record<string, unknown> | undefined;

    return {
      id: item.id as string,
      title: attrs.title as string,
      type: 'checklist',
      cardId: cardRef?.id || undefined,
      cardTitle: (cardAttrs?.title as string) || undefined,
      boardId: boardRef?.id || undefined,
      boardTitle: (boardAttrs?.title as string) || undefined,
    };
  }).filter((r) => r.cardId); // Only show checklists with valid cards
}

// Combined search (legacy)
export async function search(query: string): Promise<{ cards: SearchResult[]; boards: SearchResult[] }> {
  if (!query.trim()) return { cards: [], boards: [] };

  const [cards, boards] = await Promise.all([
    searchCards(query),
    searchBoards(query),
  ]);

  return { cards, boards };
}

// Global search across all workspaces
export async function globalSearch(query: string, workspaceId?: string): Promise<GlobalSearchResults> {
  if (!query.trim()) {
    return { cards: [], boards: [], comments: [], checklists: [], totalResults: 0 };
  }

  const [cards, boards, comments, checklists] = await Promise.all([
    searchCards(query, workspaceId),
    searchBoards(query, workspaceId),
    searchComments(query, workspaceId),
    searchChecklists(query, workspaceId),
  ]);

  return {
    cards,
    boards,
    comments,
    checklists,
    totalResults: cards.length + boards.length + comments.length + checklists.length,
  };
}
