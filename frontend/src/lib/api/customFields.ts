import { getAccessToken, fetchWithCsrf } from './client';

const API_URL = import.meta.env.VITE_API_URL || 'https://boxtasks2.ddev.site';

export type CustomFieldType = 'text' | 'longtext' | 'number' | 'date' | 'dropdown' | 'checkbox' | 'url' | 'email' | 'currency' | 'rating' | 'phone';

export type CustomFieldDisplayLocation = 'main' | 'sidebar';

export type CustomFieldScope = 'workspace' | 'board' | 'card';

export interface CustomFieldDefinition {
  id: string;
  title: string;
  boardId: string;
  workspaceId?: string; // For workspace-scoped fields
  type: CustomFieldType;
  options: string[]; // For dropdown type
  required: boolean;
  position: number;
  displayLocation: CustomFieldDisplayLocation; // Where the field appears in card modal
  scope: CustomFieldScope; // workspace, board, or card scope
}

export interface CustomFieldValue {
  id: string;
  cardId: string;
  definitionId: string;
  value: string;
}

export interface CreateCustomFieldData {
  title: string;
  boardId: string;
  workspaceId?: string; // Required for workspace-scoped fields
  type: CustomFieldType;
  options?: string[];
  required?: boolean;
  position?: number;
  displayLocation?: CustomFieldDisplayLocation;
  scope?: CustomFieldScope;
}

export interface UpdateCustomFieldData {
  title?: string;
  type?: CustomFieldType;
  options?: string[];
  required?: boolean;
  position?: number;
  displayLocation?: CustomFieldDisplayLocation;
  scope?: CustomFieldScope;
}

// Transform JSON:API response to CustomFieldDefinition
function transformFieldDefinition(data: Record<string, unknown>): CustomFieldDefinition {
  const attrs = data.attributes as Record<string, unknown>;
  const rels = data.relationships as Record<string, { data: { id: string } | null }> | undefined;

  let options: string[] = [];
  try {
    const optionsValue = (attrs.field_customfield_options as { value?: string })?.value;
    if (optionsValue) {
      options = JSON.parse(optionsValue);
    }
  } catch {
    options = [];
  }

  return {
    id: data.id as string,
    title: attrs.title as string,
    boardId: rels?.field_customfield_board?.data?.id || '',
    workspaceId: rels?.field_customfield_workspace?.data?.id,
    type: (attrs.field_customfield_type as CustomFieldType) || 'text',
    options,
    required: (attrs.field_customfield_required as boolean) || false,
    position: (attrs.field_customfield_position as number) || 0,
    displayLocation: (attrs.field_cf_display_loc as CustomFieldDisplayLocation) || 'main',
    scope: (attrs.field_cf_scope as CustomFieldScope) || 'board',
  };
}

// Transform JSON:API response to CustomFieldValue
function transformFieldValue(data: Record<string, unknown>): CustomFieldValue {
  const attrs = data.attributes as Record<string, unknown>;
  const rels = data.relationships as Record<string, { data: { id: string } | null }> | undefined;

  return {
    id: data.id as string,
    cardId: rels?.field_cfv_card?.data?.id || '',
    definitionId: rels?.field_cfv_definition?.data?.id || '',
    value: (attrs.field_cfv_value as { value?: string })?.value || '',
  };
}

// Fetch custom field definitions for a board (includes board-scoped and card-scoped fields)
export async function fetchCustomFieldsByBoard(boardId: string): Promise<CustomFieldDefinition[]> {
  const response = await fetch(
    `${API_URL}/jsonapi/node/custom_field_definition?filter[field_customfield_board.id]=${boardId}&sort=field_customfield_position`,
    {
      headers: {
        'Accept': 'application/vnd.api+json',
        'Authorization': `Bearer ${getAccessToken()}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch custom fields');
  }

  const result = await response.json();
  const data = result.data;
  if (!Array.isArray(data)) return [];

  return data.map(transformFieldDefinition);
}

// Fetch workspace-scoped custom field definitions
export async function fetchCustomFieldsByWorkspace(workspaceId: string): Promise<CustomFieldDefinition[]> {
  const response = await fetch(
    `${API_URL}/jsonapi/node/custom_field_definition?filter[field_customfield_workspace.id]=${workspaceId}&filter[field_cf_scope]=workspace&sort=field_customfield_position`,
    {
      headers: {
        'Accept': 'application/vnd.api+json',
        'Authorization': `Bearer ${getAccessToken()}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch workspace custom fields');
  }

  const result = await response.json();
  const data = result.data;
  if (!Array.isArray(data)) return [];

  return data.map(transformFieldDefinition);
}

// Fetch all custom fields available for a board (board-scoped + workspace-scoped)
export async function fetchAllCustomFieldsForBoard(boardId: string, workspaceId: string): Promise<CustomFieldDefinition[]> {
  // Fetch both board-scoped and workspace-scoped fields in parallel
  const [boardFields, workspaceFields] = await Promise.all([
    fetchCustomFieldsByBoard(boardId),
    fetchCustomFieldsByWorkspace(workspaceId).catch(() => [] as CustomFieldDefinition[]), // Gracefully handle if workspace fields don't exist
  ]);

  // Combine and sort by position, with board fields taking precedence
  const allFields = [...boardFields, ...workspaceFields];
  allFields.sort((a, b) => a.position - b.position);

  return allFields;
}

// Create a custom field definition
export async function createCustomField(data: CreateCustomFieldData): Promise<CustomFieldDefinition> {
  // Build relationships based on scope
  const relationships: Record<string, unknown> = {
    field_customfield_board: {
      data: { type: 'node--board', id: data.boardId },
    },
  };

  // Add workspace relationship for workspace-scoped fields
  if (data.scope === 'workspace' && data.workspaceId) {
    relationships.field_customfield_workspace = {
      data: { type: 'node--workspace', id: data.workspaceId },
    };
  }

  const response = await fetchWithCsrf(`${API_URL}/jsonapi/node/custom_field_definition`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: {
        type: 'node--custom_field_definition',
        attributes: {
          title: data.title,
          field_customfield_type: data.type,
          field_customfield_options: data.options ? { value: JSON.stringify(data.options) } : null,
          field_customfield_required: data.required || false,
          field_customfield_position: data.position || 0,
          field_cf_display_loc: data.displayLocation || 'main',
          field_cf_scope: data.scope || 'board',
        },
        relationships,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.errors?.[0]?.detail || 'Failed to create custom field');
  }

  const result = await response.json();
  return transformFieldDefinition(result.data);
}

// Update a custom field definition
export async function updateCustomField(id: string, data: UpdateCustomFieldData): Promise<CustomFieldDefinition> {
  const attributes: Record<string, unknown> = {};

  if (data.title !== undefined) attributes.title = data.title;
  if (data.type !== undefined) attributes.field_customfield_type = data.type;
  if (data.options !== undefined) attributes.field_customfield_options = { value: JSON.stringify(data.options) };
  if (data.required !== undefined) attributes.field_customfield_required = data.required;
  if (data.position !== undefined) attributes.field_customfield_position = data.position;
  if (data.displayLocation !== undefined) attributes.field_cf_display_loc = data.displayLocation;
  if (data.scope !== undefined) attributes.field_cf_scope = data.scope;

  const response = await fetchWithCsrf(`${API_URL}/jsonapi/node/custom_field_definition/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: {
        type: 'node--custom_field_definition',
        id,
        attributes,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.errors?.[0]?.detail || 'Failed to update custom field');
  }

  const result = await response.json();
  return transformFieldDefinition(result.data);
}

// Delete a custom field definition
export async function deleteCustomField(id: string): Promise<void> {
  const response = await fetchWithCsrf(`${API_URL}/jsonapi/node/custom_field_definition/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok && response.status !== 204) {
    throw new Error('Failed to delete custom field');
  }
}

// Fetch custom field values for a card
export async function fetchCardCustomFieldValues(cardId: string): Promise<CustomFieldValue[]> {
  const response = await fetch(
    `${API_URL}/jsonapi/node/card_custom_field_value?filter[field_cfv_card.id]=${cardId}&include=field_cfv_definition`,
    {
      headers: {
        'Accept': 'application/vnd.api+json',
        'Authorization': `Bearer ${getAccessToken()}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch custom field values');
  }

  const result = await response.json();
  const data = result.data;
  if (!Array.isArray(data)) return [];

  return data.map(transformFieldValue);
}

// Fetch custom field values for multiple cards in a single request (optimized batch fetch)
export async function fetchCustomFieldValuesForCards(cardIds: string[]): Promise<Map<string, CustomFieldValue[]>> {
  if (cardIds.length === 0) return new Map();

  // Use OR group filter for fetching values from multiple cards in a single request
  let filterParams = 'filter[or-group][group][conjunction]=OR';
  cardIds.forEach((id, index) => {
    filterParams += `&filter[card-${index}][condition][path]=field_cfv_card.id`;
    filterParams += `&filter[card-${index}][condition][value]=${id}`;
    filterParams += `&filter[card-${index}][condition][memberOf]=or-group`;
  });

  const response = await fetch(
    `${API_URL}/jsonapi/node/card_custom_field_value?${filterParams}&include=field_cfv_definition&page[limit]=500`,
    {
      headers: {
        'Accept': 'application/vnd.api+json',
        'Authorization': `Bearer ${getAccessToken()}`,
      },
    }
  );

  if (!response.ok) {
    // Fall back to parallel individual fetches if batch fails
    const valuesMap = new Map<string, CustomFieldValue[]>();
    const promises = cardIds.map(cardId =>
      fetchCardCustomFieldValues(cardId).then(values => ({ cardId, values }))
    );
    const results = await Promise.all(promises);
    results.forEach(({ cardId, values }) => {
      if (values.length > 0) {
        valuesMap.set(cardId, values);
      }
    });
    return valuesMap;
  }

  const result = await response.json();
  const data = result.data;

  const valuesMap = new Map<string, CustomFieldValue[]>();
  if (Array.isArray(data)) {
    data.forEach((item) => {
      const value = transformFieldValue(item);
      const existing = valuesMap.get(value.cardId) || [];
      valuesMap.set(value.cardId, [...existing, value]);
    });
  }

  return valuesMap;
}

// Create or update a custom field value for a card
export async function setCardCustomFieldValue(
  cardId: string,
  definitionId: string,
  value: string
): Promise<CustomFieldValue> {
  // First check if a value already exists
  const existingValues = await fetchCardCustomFieldValues(cardId);
  const existingValue = existingValues.find((v) => v.definitionId === definitionId);

  if (existingValue) {
    // Update existing value
    const response = await fetchWithCsrf(`${API_URL}/jsonapi/node/card_custom_field_value/${existingValue.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/vnd.api+json',
        'Accept': 'application/vnd.api+json',
      },
      body: JSON.stringify({
        data: {
          type: 'node--card_custom_field_value',
          id: existingValue.id,
          attributes: {
            field_cfv_value: { value },
          },
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.errors?.[0]?.detail || 'Failed to update custom field value');
    }

    const result = await response.json();
    return transformFieldValue(result.data);
  } else {
    // Create new value
    const response = await fetchWithCsrf(`${API_URL}/jsonapi/node/card_custom_field_value`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/vnd.api+json',
        'Accept': 'application/vnd.api+json',
      },
      body: JSON.stringify({
        data: {
          type: 'node--card_custom_field_value',
          attributes: {
            title: 'Custom Field Value',
            field_cfv_value: { value },
          },
          relationships: {
            field_cfv_card: {
              data: { type: 'node--card', id: cardId },
            },
            field_cfv_definition: {
              data: { type: 'node--custom_field_definition', id: definitionId },
            },
          },
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.errors?.[0]?.detail || 'Failed to create custom field value');
    }

    const result = await response.json();
    return transformFieldValue(result.data);
  }
}

// Delete a custom field value
export async function deleteCardCustomFieldValue(id: string): Promise<void> {
  const response = await fetchWithCsrf(`${API_URL}/jsonapi/node/card_custom_field_value/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok && response.status !== 204) {
    throw new Error('Failed to delete custom field value');
  }
}

// Enable a card-scoped custom field for a card (creates empty value to indicate field is active)
export async function enableCardScopedField(cardId: string, definitionId: string): Promise<CustomFieldValue> {
  return setCardCustomFieldValue(cardId, definitionId, '');
}

// Disable a card-scoped custom field for a card (removes the value record)
export async function disableCardScopedField(cardId: string, definitionId: string): Promise<void> {
  const existingValues = await fetchCardCustomFieldValues(cardId);
  const existingValue = existingValues.find((v) => v.definitionId === definitionId);

  if (existingValue) {
    await deleteCardCustomFieldValue(existingValue.id);
  }
}

// Get list of card-scoped field definitions that are enabled for a card
export function getEnabledCardScopedFields(
  cardValues: CustomFieldValue[],
  allDefs: CustomFieldDefinition[]
): CustomFieldDefinition[] {
  const cardScopedDefs = allDefs.filter(d => d.scope === 'card');
  const enabledDefIds = new Set(cardValues.map(v => v.definitionId));
  return cardScopedDefs.filter(d => enabledDefIds.has(d.id));
}

// Get list of card-scoped field definitions that are NOT enabled for a card
export function getAvailableCardScopedFields(
  cardValues: CustomFieldValue[],
  allDefs: CustomFieldDefinition[]
): CustomFieldDefinition[] {
  const cardScopedDefs = allDefs.filter(d => d.scope === 'card');
  const enabledDefIds = new Set(cardValues.map(v => v.definitionId));
  return cardScopedDefs.filter(d => !enabledDefIds.has(d.id));
}

// Get all fields that should be displayed for a card (workspace + board + enabled card-scoped)
export function getDisplayableFieldsForCard(
  cardValues: CustomFieldValue[],
  allDefs: CustomFieldDefinition[]
): CustomFieldDefinition[] {
  const enabledDefIds = new Set(cardValues.map(v => v.definitionId));

  return allDefs.filter(def => {
    // Workspace and board scope fields are always displayed
    if (def.scope === 'workspace' || def.scope === 'board' || !def.scope) {
      return true;
    }
    // Card scope fields are only displayed if enabled (have a value record)
    return enabledDefIds.has(def.id);
  });
}
