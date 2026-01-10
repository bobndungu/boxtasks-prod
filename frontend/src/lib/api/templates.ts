import { getAccessToken } from './client';

const API_URL = import.meta.env.VITE_API_URL || 'https://boxtasks2.ddev.site';

export type CardLabel = 'green' | 'yellow' | 'orange' | 'red' | 'purple' | 'blue';

export interface ChecklistTemplateItem {
  title: string;
}

export interface ChecklistTemplate {
  title: string;
  items: ChecklistTemplateItem[];
}

export interface CardTemplate {
  id: string;
  title: string;
  description?: string;
  labels: CardLabel[];
  checklists: ChecklistTemplate[];
  boardId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTemplateData {
  title: string;
  description?: string;
  labels?: CardLabel[];
  checklists?: ChecklistTemplate[];
  boardId?: string;
}

// Transform JSON:API response to CardTemplate
function transformTemplate(data: Record<string, unknown>): CardTemplate {
  const attrs = data.attributes as Record<string, unknown>;
  const rels = data.relationships as Record<string, { data: { id: string } | null }> | undefined;

  // Parse checklists JSON
  let checklists: ChecklistTemplate[] = [];
  const checklistsValue = (attrs.field_template_checklists as { value?: string })?.value;
  if (checklistsValue) {
    try {
      checklists = JSON.parse(checklistsValue);
    } catch {
      checklists = [];
    }
  }

  return {
    id: data.id as string,
    title: attrs.title as string,
    description: (attrs.field_template_description as { value?: string })?.value || '',
    labels: (attrs.field_template_labels as CardLabel[]) || [],
    checklists,
    boardId: rels?.field_template_board?.data?.id || undefined,
    createdAt: attrs.created as string,
    updatedAt: attrs.changed as string,
  };
}

// Fetch all templates (optionally filtered by board)
export async function fetchTemplates(boardId?: string): Promise<CardTemplate[]> {
  let url = `${API_URL}/jsonapi/node/card_template?sort=-created`;
  if (boardId) {
    url += `&filter[field_template_board.id]=${boardId}`;
  }

  const response = await fetch(url, {
    headers: {
      'Accept': 'application/vnd.api+json',
      'Authorization': `Bearer ${getAccessToken()}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch templates');
  }

  const result = await response.json();
  const data = result.data;
  if (!Array.isArray(data)) return [];

  return data.map(transformTemplate);
}

// Fetch a single template by ID
export async function fetchTemplate(id: string): Promise<CardTemplate> {
  const response = await fetch(`${API_URL}/jsonapi/node/card_template/${id}`, {
    headers: {
      'Accept': 'application/vnd.api+json',
      'Authorization': `Bearer ${getAccessToken()}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch template');
  }

  const result = await response.json();
  return transformTemplate(result.data);
}

// Create a new template
export async function createTemplate(data: CreateTemplateData): Promise<CardTemplate> {
  const attributes: Record<string, unknown> = {
    title: data.title,
    field_template_description: data.description ? { value: data.description } : null,
    field_template_labels: data.labels || [],
    field_template_checklists: data.checklists
      ? { value: JSON.stringify(data.checklists) }
      : null,
  };

  const relationships: Record<string, unknown> = {};
  if (data.boardId) {
    relationships.field_template_board = {
      data: { type: 'node--board', id: data.boardId },
    };
  }

  const response = await fetch(`${API_URL}/jsonapi/node/card_template`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
      'Authorization': `Bearer ${getAccessToken()}`,
    },
    body: JSON.stringify({
      data: {
        type: 'node--card_template',
        attributes,
        ...(Object.keys(relationships).length > 0 && { relationships }),
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.errors?.[0]?.detail || 'Failed to create template');
  }

  const result = await response.json();
  return transformTemplate(result.data);
}

// Update a template
export async function updateTemplate(id: string, data: Partial<CreateTemplateData>): Promise<CardTemplate> {
  const attributes: Record<string, unknown> = {};
  const relationships: Record<string, unknown> = {};

  if (data.title) attributes.title = data.title;
  if (data.description !== undefined) {
    attributes.field_template_description = data.description ? { value: data.description } : null;
  }
  if (data.labels) attributes.field_template_labels = data.labels;
  if (data.checklists !== undefined) {
    attributes.field_template_checklists = data.checklists
      ? { value: JSON.stringify(data.checklists) }
      : null;
  }
  if (data.boardId !== undefined) {
    relationships.field_template_board = data.boardId
      ? { data: { type: 'node--board', id: data.boardId } }
      : { data: null };
  }

  const response = await fetch(`${API_URL}/jsonapi/node/card_template/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
      'Authorization': `Bearer ${getAccessToken()}`,
    },
    body: JSON.stringify({
      data: {
        type: 'node--card_template',
        id,
        attributes,
        ...(Object.keys(relationships).length > 0 && { relationships }),
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.errors?.[0]?.detail || 'Failed to update template');
  }

  const result = await response.json();
  return transformTemplate(result.data);
}

// Delete a template
export async function deleteTemplate(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/jsonapi/node/card_template/${id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${getAccessToken()}`,
    },
  });

  if (!response.ok && response.status !== 204) {
    throw new Error('Failed to delete template');
  }
}
