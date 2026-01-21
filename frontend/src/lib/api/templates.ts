import { getAccessToken, fetchWithCsrf } from './client';

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
  workspaceId?: string;
  authorId?: string;
  archived: boolean;
  customFieldIds: string[]; // IDs of custom fields enabled by this template
  createdAt: string;
  updatedAt: string;
}

export interface CreateTemplateData {
  title: string;
  description?: string;
  labels?: CardLabel[];
  checklists?: ChecklistTemplate[];
  boardId?: string;
  workspaceId?: string;
  customFieldIds?: string[];
}

// Transform JSON:API response to CardTemplate
function transformTemplate(data: Record<string, unknown>): CardTemplate {
  const attrs = data.attributes as Record<string, unknown>;
  const rels = data.relationships as Record<string, { data: { id: string } | { id: string }[] | null }> | undefined;

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

  // Extract custom field IDs from relationship
  let customFieldIds: string[] = [];
  const customFieldsData = rels?.field_template_custom_fields?.data;
  if (Array.isArray(customFieldsData)) {
    customFieldIds = customFieldsData.map(f => f.id);
  }

  return {
    id: data.id as string,
    title: attrs.title as string,
    description: (attrs.field_template_description as { value?: string })?.value || '',
    labels: (attrs.field_template_labels as CardLabel[]) || [],
    checklists,
    boardId: (rels?.field_template_board?.data as { id: string } | null)?.id || undefined,
    workspaceId: (rels?.field_template_workspace?.data as { id: string } | null)?.id || undefined,
    authorId: (rels?.uid?.data as { id: string } | null)?.id || undefined,
    archived: (attrs.field_template_archived as boolean) || false,
    customFieldIds,
    createdAt: attrs.created as string,
    updatedAt: attrs.changed as string,
  };
}

// Fetch all templates (optionally filtered by board or workspace)
// By default excludes archived templates unless includeArchived is true
export async function fetchTemplates(options?: {
  boardId?: string;
  workspaceId?: string;
  includeArchived?: boolean;
}): Promise<CardTemplate[]> {
  const { boardId, workspaceId, includeArchived = false } = options || {};

  // Fetch all templates and filter in JavaScript
  // (Complex JSON:API OR filters can be unreliable)
  const url = `${API_URL}/jsonapi/node/card_template?sort=-created&include=uid`;

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

  let templates = data.map(transformTemplate);

  // Filter by archived status (default: exclude archived)
  if (!includeArchived) {
    templates = templates.filter(t => !t.archived);
  }

  // Filter by boardId if provided
  if (boardId) {
    templates = templates.filter(t => t.boardId === boardId);
  }

  // Filter by workspaceId if provided (include workspace-specific OR global templates)
  if (workspaceId) {
    templates = templates.filter(t => t.workspaceId === workspaceId || !t.workspaceId);
  }

  return templates;
}

// Fetch archived templates only
export async function fetchArchivedTemplates(workspaceId?: string): Promise<CardTemplate[]> {
  // Fetch all templates and filter for archived in JavaScript
  const url = `${API_URL}/jsonapi/node/card_template?sort=-created&include=uid`;

  const response = await fetch(url, {
    headers: {
      'Accept': 'application/vnd.api+json',
      'Authorization': `Bearer ${getAccessToken()}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch archived templates');
  }

  const result = await response.json();
  const data = result.data;
  if (!Array.isArray(data)) return [];

  let templates = data.map(transformTemplate);

  // Filter for archived templates only
  templates = templates.filter(t => t.archived === true);

  // Filter by workspaceId if provided (include workspace-specific OR global templates)
  if (workspaceId) {
    templates = templates.filter(t => t.workspaceId === workspaceId || !t.workspaceId);
  }

  return templates;
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
    field_template_archived: false,
  };

  const relationships: Record<string, unknown> = {};
  if (data.boardId) {
    relationships.field_template_board = {
      data: { type: 'node--board', id: data.boardId },
    };
  }
  if (data.workspaceId) {
    relationships.field_template_workspace = {
      data: { type: 'node--workspace', id: data.workspaceId },
    };
  }
  if (data.customFieldIds && data.customFieldIds.length > 0) {
    relationships.field_template_custom_fields = {
      data: data.customFieldIds.map(id => ({ type: 'node--custom_field_definition', id })),
    };
  }

  const response = await fetchWithCsrf(`${API_URL}/jsonapi/node/card_template`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
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
export async function updateTemplate(id: string, data: Partial<CreateTemplateData> & { archived?: boolean }): Promise<CardTemplate> {
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
  if (data.archived !== undefined) {
    attributes.field_template_archived = data.archived;
  }
  if (data.boardId !== undefined) {
    relationships.field_template_board = data.boardId
      ? { data: { type: 'node--board', id: data.boardId } }
      : { data: null };
  }
  if (data.workspaceId !== undefined) {
    relationships.field_template_workspace = data.workspaceId
      ? { data: { type: 'node--workspace', id: data.workspaceId } }
      : { data: null };
  }
  if (data.customFieldIds !== undefined) {
    relationships.field_template_custom_fields = {
      data: data.customFieldIds.map(cfId => ({ type: 'node--custom_field_definition', id: cfId })),
    };
  }

  const response = await fetchWithCsrf(`${API_URL}/jsonapi/node/card_template/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
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
  const response = await fetchWithCsrf(`${API_URL}/jsonapi/node/card_template/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok && response.status !== 204) {
    throw new Error('Failed to delete template');
  }
}

// Archive a template
export async function archiveTemplate(id: string): Promise<CardTemplate> {
  return updateTemplate(id, { archived: true });
}

// Restore a template from archive
export async function restoreTemplate(id: string): Promise<CardTemplate> {
  return updateTemplate(id, { archived: false });
}

// Update template scope (workspaceId null = global, otherwise workspace-specific)
export async function updateTemplateScope(id: string, workspaceId: string | null): Promise<CardTemplate> {
  return updateTemplate(id, { workspaceId: workspaceId || undefined });
}
