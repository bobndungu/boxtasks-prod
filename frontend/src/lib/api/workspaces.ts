import { apiClient, getAccessToken, fetchWithCsrf } from './client';

const API_URL = import.meta.env.VITE_API_URL || 'https://boxtasks2.ddev.site';

export interface Workspace {
  id: string;
  title: string;
  description?: string;
  visibility: 'private' | 'team' | 'public';
  color: string;
  memberIds: string[];
  adminIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateWorkspaceData {
  title: string;
  description?: string;
  visibility?: 'private' | 'team' | 'public';
  color?: string;
}

// Transform JSON:API response to Workspace
function transformWorkspace(data: Record<string, unknown>): Workspace {
  const attrs = data.attributes as Record<string, unknown>;
  const rels = data.relationships as Record<string, { data: Array<{ id: string }> | null }> | undefined;

  return {
    id: data.id as string,
    title: attrs.title as string,
    description: (attrs.field_workspace_description as { value?: string })?.value || '',
    visibility: (attrs.field_workspace_visibility as 'private' | 'team' | 'public') || 'private',
    color: (attrs.field_workspace_color as string) || '#3B82F6',
    memberIds: rels?.field_workspace_members?.data?.map((m) => m.id) || [],
    adminIds: rels?.field_workspace_admins?.data?.map((a) => a.id) || [],
    createdAt: attrs.created as string,
    updatedAt: attrs.changed as string,
  };
}

// Fetch all workspaces for the current user
export async function fetchWorkspaces(): Promise<Workspace[]> {
  const response = await apiClient.get('/node/workspace', {
    params: {
      'include': 'field_workspace_members,field_workspace_admins',
    },
  });

  const data = response.data.data;
  if (!Array.isArray(data)) return [];

  return data.map(transformWorkspace);
}

// Fetch a single workspace by ID
export async function fetchWorkspace(id: string): Promise<Workspace> {
  const response = await apiClient.get(`/node/workspace/${id}`, {
    params: {
      'include': 'field_workspace_members,field_workspace_admins',
    },
  });

  return transformWorkspace(response.data.data);
}

// Create a new workspace
export async function createWorkspace(data: CreateWorkspaceData, userId: string): Promise<Workspace> {
  const response = await fetchWithCsrf(`${API_URL}/jsonapi/node/workspace`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: {
        type: 'node--workspace',
        attributes: {
          title: data.title,
          field_workspace_description: data.description ? { value: data.description } : null,
          field_workspace_visibility: data.visibility || 'private',
          field_workspace_color: data.color || '#3B82F6',
        },
        relationships: {
          field_workspace_members: {
            data: [{ type: 'user--user', id: userId }],
          },
          field_workspace_admins: {
            data: [{ type: 'user--user', id: userId }],
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.errors?.[0]?.detail || 'Failed to create workspace');
  }

  const result = await response.json();
  return transformWorkspace(result.data);
}

// Update a workspace
export async function updateWorkspace(id: string, data: Partial<CreateWorkspaceData>): Promise<Workspace> {
  const attributes: Record<string, unknown> = {};

  if (data.title) attributes.title = data.title;
  if (data.description !== undefined) {
    attributes.field_workspace_description = data.description ? { value: data.description } : null;
  }
  if (data.visibility) attributes.field_workspace_visibility = data.visibility;
  if (data.color) attributes.field_workspace_color = data.color;

  const response = await fetchWithCsrf(`${API_URL}/jsonapi/node/workspace/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: {
        type: 'node--workspace',
        id,
        attributes,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.errors?.[0]?.detail || 'Failed to update workspace');
  }

  const result = await response.json();
  return transformWorkspace(result.data);
}

// Delete a workspace
export async function deleteWorkspace(id: string): Promise<void> {
  const response = await fetchWithCsrf(`${API_URL}/jsonapi/node/workspace/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok && response.status !== 204) {
    throw new Error('Failed to delete workspace');
  }
}

export interface WorkspaceMember {
  id: string;
  displayName: string;
  email: string;
  isAdmin: boolean;
  memberRoleId?: string; // The member_role node ID for updates
  roleName?: string; // The role name (Admin, Editor, etc.)
}

// Fetch workspace members from member_role nodes
export async function fetchWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  // First get the workspace's internal node ID from the UUID
  const workspaceResponse = await fetch(
    `${API_URL}/jsonapi/node/workspace/${workspaceId}`,
    {
      headers: {
        'Accept': 'application/vnd.api+json',
        'Authorization': `Bearer ${getAccessToken()}`,
      },
    }
  );

  if (!workspaceResponse.ok) {
    throw new Error('Failed to fetch workspace');
  }

  const workspaceResult = await workspaceResponse.json();
  const workspaceNodeId = workspaceResult.data.attributes.drupal_internal__nid;

  // Query member_role nodes for this workspace, including user and role
  const response = await fetch(
    `${API_URL}/jsonapi/node/member_role?filter[field_member_role_workspace.meta.drupal_internal__target_id]=${workspaceNodeId}&include=field_member_role_user,field_member_role_role`,
    {
      headers: {
        'Accept': 'application/vnd.api+json',
        'Authorization': `Bearer ${getAccessToken()}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch workspace members');
  }

  const result = await response.json();
  const memberRoles = result.data || [];
  const included = result.included || [];

  const members: WorkspaceMember[] = [];

  for (const memberRole of memberRoles) {
    const userRef = memberRole.relationships?.field_member_role_user?.data;
    const roleRef = memberRole.relationships?.field_member_role_role?.data;

    if (!userRef) continue;

    // Find the user in included
    const user = included.find(
      (item: Record<string, unknown>) => item.type === 'user--user' && item.id === userRef.id
    );

    // Find the role in included
    const role = roleRef
      ? included.find(
          (item: Record<string, unknown>) =>
            item.type === 'node--workspace_role' && item.id === roleRef.id
        )
      : null;

    if (user) {
      const userAttrs = user.attributes as Record<string, unknown>;
      const roleAttrs = role?.attributes as Record<string, unknown> | undefined;
      const roleName = (roleAttrs?.title as string) || 'Member';

      // Check if this role has member management permission (isAdmin)
      const permMemberManage = roleAttrs?.field_perm_member_manage as string;
      const isAdmin = permMemberManage === 'any';

      members.push({
        id: user.id as string,
        displayName:
          (userAttrs.field_display_name as string) ||
          (userAttrs.field_full_name as string) ||
          (userAttrs.display_name as string) ||
          (userAttrs.name as string) ||
          'Unknown User',
        email: (userAttrs.mail as string) || '',
        isAdmin,
        memberRoleId: memberRole.id as string,
        roleName,
      });
    }
  }

  return members;
}

// Re-export member role functions from roles.ts for convenience
export { createMemberRole, updateMemberRole, deleteMemberRole } from './roles';

// Legacy function - kept for backwards compatibility
// Now uses member_role nodes via createMemberRole and deleteMemberRole from roles.ts
export async function updateWorkspaceMembers(
  workspaceId: string,
  _memberIds: string[],
  _adminIds: string[]
): Promise<Workspace> {
  // This function is deprecated - use createMemberRole, deleteMemberRole, updateMemberRole from roles.ts
  console.warn('updateWorkspaceMembers is deprecated. Use createMemberRole, deleteMemberRole, or updateMemberRole from roles.ts instead.');
  return fetchWorkspace(workspaceId);
}

// System/admin user names that should be hidden from user dropdowns
const SYSTEM_USER_NAMES = ['n8n_api', 'n8n api', 'boxraft admin', 'box admin'];

// Super admin is ONLY uid = 1 (not based on roles)
const SUPER_ADMIN_UID = 1;

// Fetch all users (for dropdowns)
export async function fetchAllUsers(): Promise<WorkspaceMember[]> {
  const response = await fetch(
    `${API_URL}/jsonapi/user/user?filter[status]=1&page[limit]=100&sort=field_display_name`,
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
  const users = result.data || [];

  return users
    .map((user: Record<string, unknown>) => {
      const attrs = user.attributes as Record<string, unknown>;
      const uid = attrs.drupal_internal__uid as number;
      // Skip anonymous user (uid 0)
      if (uid === 0) return null;

      // Skip super admin (uid = 1 only)
      if (uid === SUPER_ADMIN_UID) {
        return null;
      }

      const displayName = (attrs.field_display_name as string) || (attrs.field_full_name as string) || (attrs.display_name as string) || (attrs.name as string) || 'Unknown';

      // Skip system users by name
      if (SYSTEM_USER_NAMES.includes(displayName.toLowerCase())) {
        return null;
      }

      return {
        id: user.id as string,
        displayName,
        email: (attrs.mail as string) || '',
        isAdmin: false,
      };
    })
    .filter((user: WorkspaceMember | null): user is WorkspaceMember => user !== null);
}

// Search users by name or email
export async function searchUsers(query: string): Promise<WorkspaceMember[]> {
  if (!query || query.length < 2) return [];

  const response = await fetch(
    `${API_URL}/jsonapi/user/user?filter[name][operator]=CONTAINS&filter[name][value]=${encodeURIComponent(query)}`,
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
  const users = result.data || [];

  return users
    .map((user: Record<string, unknown>) => {
      const attrs = user.attributes as Record<string, unknown>;
      const uid = attrs.drupal_internal__uid as number;
      // Skip anonymous user (uid 0)
      if (uid === 0) return null;

      // Skip super admin (uid = 1 only)
      if (uid === SUPER_ADMIN_UID) {
        return null;
      }

      const displayName = (attrs.field_display_name as string) || (attrs.field_full_name as string) || (attrs.display_name as string) || (attrs.name as string) || 'Unknown';

      // Skip system users by name
      if (SYSTEM_USER_NAMES.includes(displayName.toLowerCase())) {
        return null;
      }

      return {
        id: user.id as string,
        displayName,
        email: (attrs.mail as string) || '',
        isAdmin: false,
      };
    })
    .filter((user: WorkspaceMember | null): user is WorkspaceMember => user !== null);
}
