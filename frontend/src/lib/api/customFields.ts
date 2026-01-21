import { getAccessToken, fetchWithCsrf } from './client';

const API_URL = import.meta.env.VITE_API_URL || 'https://boxtasks2.ddev.site';

export type CustomFieldType = 'text' | 'longtext' | 'number' | 'date' | 'dropdown' | 'checkbox' | 'url' | 'email' | 'currency' | 'rating' | 'phone';

export type CustomFieldDisplayLocation = 'main' | 'sidebar';

export type CustomFieldScope = 'workspace' | 'board' | 'card';

export type VisibilityMode = 'all_cards' | 'template_only' | 'manual';

export interface CustomFieldGroup {
  id: string;
  title: string;
  boardId?: string;
  workspaceId?: string;
  roleIds: string[]; // Roles that can see this group
  position: number;
}

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
  visibilityMode: VisibilityMode; // Controls which cards show this field
  roleIds: string[]; // Roles that can see this field (empty = all)
  groupId?: string; // Optional field group membership
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
  visibilityMode?: VisibilityMode;
  roleIds?: string[];
  groupId?: string;
}

export interface UpdateCustomFieldData {
  title?: string;
  type?: CustomFieldType;
  options?: string[];
  required?: boolean;
  position?: number;
  displayLocation?: CustomFieldDisplayLocation;
  scope?: CustomFieldScope;
  visibilityMode?: VisibilityMode;
  roleIds?: string[];
  groupId?: string;
}

// Decode HTML entities (needed because Drupal's JSON:API returns HTML-encoded values for text fields)
function decodeHtmlEntities(text: string): string {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
}

// Transform JSON:API response to CustomFieldDefinition
function transformFieldDefinition(data: Record<string, unknown>): CustomFieldDefinition {
  const attrs = data.attributes as Record<string, unknown>;
  const rels = data.relationships as Record<string, { data: { id: string } | { id: string }[] | null }> | undefined;

  let options: string[] = [];
  try {
    const optionsValue = (attrs.field_customfield_options as { value?: string })?.value;
    if (optionsValue) {
      // Decode HTML entities before parsing JSON (API returns &quot; instead of ")
      const decodedValue = decodeHtmlEntities(optionsValue);
      options = JSON.parse(decodedValue);
    }
  } catch {
    options = [];
  }

  // Extract role IDs from relationship
  let roleIds: string[] = [];
  const rolesData = rels?.field_cf_roles?.data;
  if (Array.isArray(rolesData)) {
    roleIds = rolesData.map(r => r.id);
  }

  return {
    id: data.id as string,
    title: attrs.title as string,
    boardId: (rels?.field_customfield_board?.data as { id: string } | null)?.id || '',
    workspaceId: (rels?.field_customfield_workspace?.data as { id: string } | null)?.id,
    type: (attrs.field_customfield_type as CustomFieldType) || 'text',
    options,
    required: (attrs.field_customfield_required as boolean) || false,
    position: (attrs.field_customfield_position as number) || 0,
    displayLocation: (attrs.field_cf_display_loc as CustomFieldDisplayLocation) || 'main',
    scope: (attrs.field_cf_scope as CustomFieldScope) || 'board',
    visibilityMode: (attrs.field_cf_visibility_mode as VisibilityMode) || 'all_cards',
    roleIds,
    groupId: (rels?.field_cf_group?.data as { id: string } | null)?.id,
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

  // Add roles relationship if provided
  if (data.roleIds && data.roleIds.length > 0) {
    relationships.field_cf_roles = {
      data: data.roleIds.map(id => ({ type: 'node--workspace_role', id })),
    };
  }

  // Add group relationship if provided
  if (data.groupId) {
    relationships.field_cf_group = {
      data: { type: 'node--custom_field_group', id: data.groupId },
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
          field_cf_visibility_mode: data.visibilityMode || 'all_cards',
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
  const relationships: Record<string, unknown> = {};

  if (data.title !== undefined) attributes.title = data.title;
  if (data.type !== undefined) attributes.field_customfield_type = data.type;
  if (data.options !== undefined) attributes.field_customfield_options = { value: JSON.stringify(data.options) };
  if (data.required !== undefined) attributes.field_customfield_required = data.required;
  if (data.position !== undefined) attributes.field_customfield_position = data.position;
  if (data.displayLocation !== undefined) attributes.field_cf_display_loc = data.displayLocation;
  if (data.scope !== undefined) attributes.field_cf_scope = data.scope;
  if (data.visibilityMode !== undefined) attributes.field_cf_visibility_mode = data.visibilityMode;

  // Handle roles relationship
  if (data.roleIds !== undefined) {
    relationships.field_cf_roles = {
      data: data.roleIds.map(roleId => ({ type: 'node--workspace_role', id: roleId })),
    };
  }

  // Handle group relationship
  if (data.groupId !== undefined) {
    relationships.field_cf_group = {
      data: data.groupId ? { type: 'node--custom_field_group', id: data.groupId } : null,
    };
  }

  const requestBody: Record<string, unknown> = {
    data: {
      type: 'node--custom_field_definition',
      id,
      attributes,
    },
  };

  // Only include relationships if there are any to update
  if (Object.keys(relationships).length > 0) {
    (requestBody.data as Record<string, unknown>).relationships = relationships;
  }

  const response = await fetchWithCsrf(`${API_URL}/jsonapi/node/custom_field_definition/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
    },
    body: JSON.stringify(requestBody),
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

// ============================================
// VISIBILITY & ROLE-BASED ACCESS FUNCTIONS
// ============================================

/**
 * Check if a user's role can see a specific custom field.
 * @param field - The custom field definition
 * @param userRoleId - The user's workspace role ID
 * @param groups - All field groups (to check group-level role restrictions)
 * @returns true if the user can see this field
 */
export function canRoleSeeField(
  field: CustomFieldDefinition,
  userRoleId: string | null,
  groups: CustomFieldGroup[] = []
): boolean {
  // If no role ID (e.g., super admin), allow access
  if (!userRoleId) return true;

  // Check field-level role restrictions
  if (field.roleIds && field.roleIds.length > 0) {
    if (!field.roleIds.includes(userRoleId)) {
      return false;
    }
  }

  // Check group-level role restrictions if field belongs to a group
  if (field.groupId) {
    const group = groups.find(g => g.id === field.groupId);
    if (group && group.roleIds && group.roleIds.length > 0) {
      if (!group.roleIds.includes(userRoleId)) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Check if a field should be visible on a specific card based on visibility mode.
 * @param field - The custom field definition
 * @param enabledFieldIds - IDs of custom fields enabled on the card
 * @returns true if the field should be visible on the card
 */
export function isFieldVisibleOnCard(
  field: CustomFieldDefinition,
  enabledFieldIds: string[]
): boolean {
  switch (field.visibilityMode) {
    case 'all_cards':
      // Always visible on all cards
      return true;
    case 'template_only':
    case 'manual':
      // Only visible if explicitly enabled on the card
      return enabledFieldIds.includes(field.id);
    default:
      // Default to all_cards behavior for backwards compatibility
      return true;
  }
}

/**
 * Get all fields that should be visible to a user on a specific card.
 * Combines visibility mode, role restrictions, and group restrictions.
 * @param allFields - All custom field definitions for the board
 * @param enabledFieldIds - IDs of custom fields enabled on the card
 * @param userRoleId - The user's workspace role ID (null for super admin)
 * @param groups - All field groups
 * @returns Array of visible custom field definitions
 */
export function getVisibleFieldsForCard(
  allFields: CustomFieldDefinition[],
  enabledFieldIds: string[],
  userRoleId: string | null,
  groups: CustomFieldGroup[] = []
): CustomFieldDefinition[] {
  return allFields.filter(field => {
    // Check visibility mode
    if (!isFieldVisibleOnCard(field, enabledFieldIds)) {
      return false;
    }

    // Check role-based access
    if (!canRoleSeeField(field, userRoleId, groups)) {
      return false;
    }

    return true;
  });
}

/**
 * Get fields that can be manually added to a card.
 * Only returns 'manual' mode fields that are not yet enabled and visible to the user's role.
 * @param allFields - All custom field definitions for the board
 * @param enabledFieldIds - IDs of custom fields already enabled on the card
 * @param userRoleId - The user's workspace role ID
 * @param groups - All field groups
 * @returns Array of fields that can be added
 */
export function getAddableFieldsForCard(
  allFields: CustomFieldDefinition[],
  enabledFieldIds: string[],
  userRoleId: string | null,
  groups: CustomFieldGroup[] = []
): CustomFieldDefinition[] {
  return allFields.filter(field => {
    // Only manual mode fields can be added
    if (field.visibilityMode !== 'manual') {
      return false;
    }

    // Don't show fields already enabled
    if (enabledFieldIds.includes(field.id)) {
      return false;
    }

    // Check role-based access
    if (!canRoleSeeField(field, userRoleId, groups)) {
      return false;
    }

    return true;
  });
}

/**
 * Get fields available for templates based on visibility mode.
 * Templates can include 'template_only' and 'manual' mode fields.
 * @param allFields - All custom field definitions for the board
 * @param userRoleId - The user's workspace role ID
 * @param groups - All field groups
 * @returns Array of fields available for template assignment
 */
export function getFieldsAvailableForTemplates(
  allFields: CustomFieldDefinition[],
  userRoleId: string | null,
  groups: CustomFieldGroup[] = []
): CustomFieldDefinition[] {
  return allFields.filter(field => {
    // Only template_only and manual mode fields can be assigned to templates
    // all_cards fields are automatically on all cards anyway
    if (field.visibilityMode === 'all_cards') {
      return false;
    }

    // Check role-based access
    if (!canRoleSeeField(field, userRoleId, groups)) {
      return false;
    }

    return true;
  });
}
