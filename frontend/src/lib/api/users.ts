import { getAccessToken, fetchWithCsrf } from './client';

const API_URL = import.meta.env.VITE_API_URL || 'https://boxtasks2.ddev.site';

export interface DrupalUser {
  id: string;
  uid: number;
  username: string;
  email: string;
  displayName: string;
  status: boolean;
  created: string;
  roles: string[];
  bio?: string;
  jobTitle?: string;
  timezone?: string;
  mentionHandle?: string;
}

export interface UserListResponse {
  users: DrupalUser[];
  total: number;
  page: number;
  pageSize: number;
}

// Transform JSON:API user response
function transformUser(data: Record<string, unknown>): DrupalUser {
  const attrs = data.attributes as Record<string, unknown>;
  const drupalId = attrs.drupal_internal__uid as number;

  // Get roles from relationships
  const rels = data.relationships as Record<string, { data: Array<{ id: string; meta?: { drupal_internal__target_id?: string } }> | null }> | undefined;
  const rolesData = rels?.roles?.data || [];
  const roles = rolesData.map((r) => r.meta?.drupal_internal__target_id || '').filter(Boolean);

  return {
    id: data.id as string,
    uid: drupalId,
    username: attrs.name as string,
    email: (attrs.mail as string) || '',
    displayName: (attrs.field_display_name as string) || (attrs.display_name as string) || (attrs.name as string),
    status: attrs.status as boolean,
    created: attrs.created as string,
    roles,
    bio: attrs.field_bio as string | undefined,
    jobTitle: attrs.field_job_title as string | undefined,
    timezone: attrs.timezone as string | undefined,
    mentionHandle: attrs.field_mention_handle as string | undefined,
  };
}

/**
 * Fetch all users.
 */
export async function fetchUsers(page: number = 0, pageSize: number = 50): Promise<UserListResponse> {
  const offset = page * pageSize;
  const response = await fetch(
    `${API_URL}/jsonapi/user/user?page[limit]=${pageSize}&page[offset]=${offset}&include=roles&sort=-created`,
    {
      headers: {
        'Accept': 'application/vnd.api+json',
        'Authorization': `Bearer ${getAccessToken()}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch users');
  }

  const result = await response.json();
  const data = result.data || [];

  // Filter out anonymous user (uid 0)
  const users = data
    .map((item: Record<string, unknown>) => transformUser(item))
    .filter((user: DrupalUser) => user.uid !== 0);

  return {
    users,
    total: result.meta?.count || users.length,
    page,
    pageSize,
  };
}

/**
 * Fetch a single user by ID.
 */
export async function fetchUser(userId: string): Promise<DrupalUser | null> {
  const response = await fetch(
    `${API_URL}/jsonapi/user/user/${userId}?include=roles`,
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
  return transformUser(result.data);
}

/**
 * Search users by name or email.
 */
export async function searchUsers(query: string): Promise<DrupalUser[]> {
  const encodedQuery = encodeURIComponent(query);
  const response = await fetch(
    `${API_URL}/jsonapi/user/user?filter[or-group][group][conjunction]=OR&filter[name-filter][condition][path]=name&filter[name-filter][condition][operator]=CONTAINS&filter[name-filter][condition][value]=${encodedQuery}&filter[name-filter][condition][memberOf]=or-group&filter[mail-filter][condition][path]=mail&filter[mail-filter][condition][operator]=CONTAINS&filter[mail-filter][condition][value]=${encodedQuery}&filter[mail-filter][condition][memberOf]=or-group&include=roles&page[limit]=20`,
    {
      headers: {
        'Accept': 'application/vnd.api+json',
        'Authorization': `Bearer ${getAccessToken()}`,
      },
    }
  );

  if (!response.ok) {
    return [];
  }

  const result = await response.json();
  const data = result.data || [];

  return data
    .map((item: Record<string, unknown>) => transformUser(item))
    .filter((user: DrupalUser) => user.uid !== 0);
}

/**
 * Update user profile.
 */
export async function updateUser(
  userId: string,
  updates: Partial<{
    displayName: string;
    email: string;
    bio: string;
    jobTitle: string;
    timezone: string;
    mentionHandle: string;
    status: boolean;
  }>
): Promise<DrupalUser> {
  const attributes: Record<string, unknown> = {};

  if (updates.displayName !== undefined) {
    attributes.field_display_name = updates.displayName;
  }
  if (updates.email !== undefined) {
    attributes.mail = updates.email;
  }
  if (updates.bio !== undefined) {
    attributes.field_bio = updates.bio;
  }
  if (updates.jobTitle !== undefined) {
    attributes.field_job_title = updates.jobTitle;
  }
  if (updates.timezone !== undefined) {
    attributes.timezone = updates.timezone;
  }
  if (updates.mentionHandle !== undefined) {
    attributes.field_mention_handle = updates.mentionHandle;
  }
  if (updates.status !== undefined) {
    attributes.status = updates.status;
  }

  const response = await fetchWithCsrf(`${API_URL}/jsonapi/user/user/${userId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: {
        type: 'user--user',
        id: userId,
        attributes,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.errors?.[0]?.detail || 'Failed to update user');
  }

  const result = await response.json();
  return transformUser(result.data);
}

/**
 * Update user roles.
 */
export async function updateUserRoles(userId: string, roles: string[]): Promise<DrupalUser> {
  // Drupal roles are referenced by machine name
  // We need to build the relationships properly
  const roleRelationships = roles.map((roleId) => ({
    type: 'user_role--user_role',
    id: roleId,
    meta: {
      drupal_internal__target_id: roleId,
    },
  }));

  const response = await fetchWithCsrf(`${API_URL}/jsonapi/user/user/${userId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: {
        type: 'user--user',
        id: userId,
        relationships: {
          roles: {
            data: roleRelationships,
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.errors?.[0]?.detail || 'Failed to update user roles');
  }

  // Refetch with includes
  const user = await fetchUser(userId);
  if (!user) {
    throw new Error('Failed to fetch updated user');
  }
  return user;
}

/**
 * Fetch available Drupal roles.
 */
export async function fetchDrupalRoles(): Promise<Array<{ id: string; label: string }>> {
  const response = await fetch(
    `${API_URL}/jsonapi/user_role/user_role`,
    {
      headers: {
        'Accept': 'application/vnd.api+json',
        'Authorization': `Bearer ${getAccessToken()}`,
      },
    }
  );

  if (!response.ok) {
    return [];
  }

  const result = await response.json();
  const data = result.data || [];

  return data
    .map((item: Record<string, unknown>) => {
      const attrs = item.attributes as Record<string, unknown>;
      return {
        id: attrs.drupal_internal__id as string,
        label: attrs.label as string,
      };
    })
    .filter((role: { id: string }) => role.id !== 'anonymous' && role.id !== 'authenticated');
}

/**
 * Block/unblock a user.
 */
export async function setUserStatus(userId: string, active: boolean): Promise<DrupalUser> {
  return updateUser(userId, { status: active });
}
