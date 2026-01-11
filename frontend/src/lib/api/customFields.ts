import { getAccessToken, fetchWithCsrf } from './client';

const API_URL = import.meta.env.VITE_API_URL || 'https://boxtasks2.ddev.site';

export type CustomFieldType = 'text' | 'longtext' | 'number' | 'date' | 'dropdown' | 'checkbox' | 'url' | 'email' | 'currency' | 'rating' | 'phone';

export type CustomFieldDisplayLocation = 'main' | 'sidebar';

export interface CustomFieldDefinition {
  id: string;
  title: string;
  boardId: string;
  type: CustomFieldType;
  options: string[]; // For dropdown type
  required: boolean;
  position: number;
  displayLocation: CustomFieldDisplayLocation; // Where the field appears in card modal
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
  type: CustomFieldType;
  options?: string[];
  required?: boolean;
  position?: number;
  displayLocation?: CustomFieldDisplayLocation;
}

export interface UpdateCustomFieldData {
  title?: string;
  type?: CustomFieldType;
  options?: string[];
  required?: boolean;
  position?: number;
  displayLocation?: CustomFieldDisplayLocation;
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
    type: (attrs.field_customfield_type as CustomFieldType) || 'text',
    options,
    required: (attrs.field_customfield_required as boolean) || false,
    position: (attrs.field_customfield_position as number) || 0,
    displayLocation: (attrs.field_cf_display_loc as CustomFieldDisplayLocation) || 'main',
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

// Fetch custom field definitions for a board
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

// Create a custom field definition
export async function createCustomField(data: CreateCustomFieldData): Promise<CustomFieldDefinition> {
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
        },
        relationships: {
          field_customfield_board: {
            data: { type: 'node--board', id: data.boardId },
          },
        },
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
