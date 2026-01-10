import { getAccessToken } from './client';

const API_URL = import.meta.env.VITE_API_URL || 'https://boxtasks2.ddev.site';

export interface SearchResult {
  id: string;
  title: string;
  type: 'card' | 'board' | 'list';
  description?: string;
  boardId?: string;
  boardTitle?: string;
  listId?: string;
  listTitle?: string;
}

// Search cards by title or description
export async function searchCards(query: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];

  // Search in card titles using JSON:API filter
  const response = await fetch(
    `${API_URL}/jsonapi/node/card?filter[title][operator]=CONTAINS&filter[title][value]=${encodeURIComponent(query)}&filter[field_card_archived][value]=0&page[limit]=20`,
    {
      headers: {
        'Accept': 'application/vnd.api+json',
        'Authorization': `Bearer ${getAccessToken()}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Search failed');
  }

  const result = await response.json();
  const data = result.data;
  if (!Array.isArray(data)) return [];

  return data.map((item: Record<string, unknown>): SearchResult => {
    const attrs = item.attributes as Record<string, unknown>;
    const rels = item.relationships as Record<string, { data: { id: string } | null }> | undefined;

    return {
      id: item.id as string,
      title: attrs.title as string,
      type: 'card',
      description: (attrs.field_card_description as { value?: string })?.value || undefined,
      listId: rels?.field_card_list?.data?.id || undefined,
    };
  });
}

// Search boards by title
export async function searchBoards(query: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];

  const response = await fetch(
    `${API_URL}/jsonapi/node/board?filter[title][operator]=CONTAINS&filter[title][value]=${encodeURIComponent(query)}&filter[field_board_archived][value]=0&page[limit]=10`,
    {
      headers: {
        'Accept': 'application/vnd.api+json',
        'Authorization': `Bearer ${getAccessToken()}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Search failed');
  }

  const result = await response.json();
  const data = result.data;
  if (!Array.isArray(data)) return [];

  return data.map((item: Record<string, unknown>): SearchResult => {
    const attrs = item.attributes as Record<string, unknown>;

    return {
      id: item.id as string,
      title: attrs.title as string,
      type: 'board',
      description: (attrs.field_board_description as string) || undefined,
    };
  });
}

// Combined search
export async function search(query: string): Promise<{ cards: SearchResult[]; boards: SearchResult[] }> {
  if (!query.trim()) return { cards: [], boards: [] };

  const [cards, boards] = await Promise.all([
    searchCards(query),
    searchBoards(query),
  ]);

  return { cards, boards };
}
