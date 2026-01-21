import { getAccessToken, fetchWithCsrf } from './client';
import type { CustomFieldGroup } from './customFields';

const API_URL = import.meta.env.VITE_API_URL || 'https://boxtasks2.ddev.site';

export interface CreateFieldGroupData {
  title: string;
  boardId?: string;
  workspaceId?: string;
  roleIds?: string[];
  position?: number;
}

export interface UpdateFieldGroupData {
  title?: string;
  roleIds?: string[];
  position?: number;
}

/**
 * Fetch all field groups for a board (includes board-level and workspace-level groups).
 */
export async function fetchFieldGroups(boardId: string): Promise<CustomFieldGroup[]> {
  const response = await fetch(`${API_URL}/api/boards/${boardId}/field-groups`, {
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${getAccessToken()}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch field groups');
  }

  return response.json();
}

/**
 * Create a new field group.
 */
export async function createFieldGroup(data: CreateFieldGroupData): Promise<CustomFieldGroup> {
  const response = await fetchWithCsrf(`${API_URL}/api/field-groups`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create field group');
  }

  return response.json();
}

/**
 * Update an existing field group.
 */
export async function updateFieldGroup(id: string, data: UpdateFieldGroupData): Promise<CustomFieldGroup> {
  const response = await fetchWithCsrf(`${API_URL}/api/field-groups/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update field group');
  }

  return response.json();
}

/**
 * Delete a field group.
 */
export async function deleteFieldGroup(id: string): Promise<void> {
  const response = await fetchWithCsrf(`${API_URL}/api/field-groups/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok && response.status !== 200) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete field group');
  }
}
