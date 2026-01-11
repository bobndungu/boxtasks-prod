import { getAccessToken } from './client';

const API_URL = import.meta.env.VITE_API_URL || 'https://boxtasks2.ddev.site';

export interface TaxonomyTerm {
  id: string;
  name: string;
  vocabularyId: string;
}

// Transform JSON:API response to TaxonomyTerm
function transformTerm(data: Record<string, unknown>): TaxonomyTerm {
  const attrs = data.attributes as Record<string, unknown>;
  const rels = data.relationships as Record<string, { data: { id: string } | null }> | undefined;

  return {
    id: data.id as string,
    name: attrs.name as string,
    vocabularyId: rels?.vid?.data?.id || '',
  };
}

// Fetch all terms from a vocabulary
export async function fetchTermsByVocabulary(vocabularyId: string): Promise<TaxonomyTerm[]> {
  const response = await fetch(
    `${API_URL}/jsonapi/taxonomy_term/${vocabularyId}?sort=name`,
    {
      headers: {
        'Accept': 'application/vnd.api+json',
        'Authorization': `Bearer ${getAccessToken()}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch ${vocabularyId} terms`);
  }

  const result = await response.json();
  const data = result.data;
  if (!Array.isArray(data)) return [];

  return data.map((item: Record<string, unknown>) => transformTerm(item));
}

// Fetch departments
export async function fetchDepartments(): Promise<TaxonomyTerm[]> {
  return fetchTermsByVocabulary('department');
}

// Fetch clients
export async function fetchClients(): Promise<TaxonomyTerm[]> {
  return fetchTermsByVocabulary('client');
}

// Get a single term by ID
export async function fetchTerm(vocabularyId: string, termId: string): Promise<TaxonomyTerm | null> {
  const response = await fetch(
    `${API_URL}/jsonapi/taxonomy_term/${vocabularyId}/${termId}`,
    {
      headers: {
        'Accept': 'application/vnd.api+json',
        'Authorization': `Bearer ${getAccessToken()}`,
      },
    }
  );

  if (!response.ok) {
    return null;
  }

  const result = await response.json();
  return transformTerm(result.data);
}
