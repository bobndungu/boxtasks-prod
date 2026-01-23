import { getAccessToken, fetchWithCsrf } from './client';

const API_URL = import.meta.env.VITE_API_URL || 'https://boxtasks2.ddev.site';

// Permission cache version - increment this to bust cache
let permissionCacheVersion = Date.now();

// Get a cache-busting parameter (only for custom API, not JSON:API)
function getCacheBuster(): string {
  return `_v=${permissionCacheVersion}`;
}

// Call this to invalidate permission cache (e.g., after role changes)
export function invalidatePermissionCache(): void {
  permissionCacheVersion = Date.now();
  // Dispatch a custom event so components can react
  window.dispatchEvent(new CustomEvent('permissions-invalidated'));
}

// Get headers for JSON:API requests with cache control
function getJsonApiHeaders(): HeadersInit {
  return {
    'Accept': 'application/vnd.api+json',
    'Authorization': `Bearer ${getAccessToken()}`,
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
  };
}

export type PermissionLevel = 'any' | 'own' | 'none';

export interface WorkspaceRole {
  id: string;
  title: string;
  workspaceId: string | null; // null = global role
  isDefault: boolean;
  permissions: {
    // Card permissions
    cardView: PermissionLevel;
    cardCreate: PermissionLevel;
    cardEdit: PermissionLevel;
    cardDelete: PermissionLevel;
    cardArchive: PermissionLevel;
    cardMove: PermissionLevel;
    // List permissions
    listView: PermissionLevel;
    listCreate: PermissionLevel;
    listEdit: PermissionLevel;
    listDelete: PermissionLevel;
    listArchive: PermissionLevel;
    // Board permissions
    boardView: PermissionLevel;
    boardCreate: PermissionLevel; // Only 'any' or 'none'
    boardEdit: PermissionLevel;
    boardDelete: PermissionLevel;
    boardArchive: PermissionLevel;
    // Workspace permissions
    workspaceView: PermissionLevel; // Only 'any' or 'none'
    workspaceEdit: PermissionLevel; // Only 'any' or 'none'
    workspaceDelete: PermissionLevel; // Only 'any' or 'none'
    workspaceArchive: PermissionLevel; // Only 'any' or 'none'
    // Workspace member permissions (granular)
    memberView: PermissionLevel;
    memberAdd: PermissionLevel;
    memberRemove: PermissionLevel;
    // Board member permissions
    boardMemberView: PermissionLevel;
    boardMemberAdd: PermissionLevel;
    boardMemberRemove: PermissionLevel;
    boardRoleView: PermissionLevel;
    // Member management (deprecated, kept for backward compatibility)
    memberManage: PermissionLevel;
    // Comment permissions
    commentEdit: PermissionLevel;
    commentDelete: PermissionLevel;
    commentArchive: PermissionLevel;
    // Report permissions
    reportPerformance: PermissionLevel;
    reportTasks: PermissionLevel;
    reportActivity: PermissionLevel;
    reportWorkload: PermissionLevel;
    reportExport: PermissionLevel;
    // Admin page permissions
    emailTemplatesManage: PermissionLevel;
    userManagement: PermissionLevel;
    roleManagement: PermissionLevel;
    roleView: PermissionLevel;
    // Custom field permissions
    customFieldView: PermissionLevel;
    customFieldCreate: PermissionLevel;
    customFieldEdit: PermissionLevel;
    customFieldDelete: PermissionLevel;
    // Automation permissions
    automationView: PermissionLevel;
    automationCreate: PermissionLevel;
    automationEdit: PermissionLevel;
    automationDelete: PermissionLevel;
    // Card fields visibility permission
    cardFieldsVisibility: PermissionLevel;
    // Saved views permission
    savedViews: PermissionLevel;
    // Mind map permissions
    mindMapView: PermissionLevel;
    mindMapCreate: PermissionLevel;
    mindMapEdit: PermissionLevel;
    mindMapDelete: PermissionLevel;
    // Template permissions
    templateView: PermissionLevel;
    templateCreate: PermissionLevel;
    templateEdit: PermissionLevel;
    templateDelete: PermissionLevel;
    // Profile permissions
    profileView: PermissionLevel;
    profileEdit: PermissionLevel;
    profileDelete: PermissionLevel;
  };
}

export interface MemberRoleAssignment {
  id: string;
  workspaceId: string;
  userId: string;
  roleId: string;
  role?: WorkspaceRole;
}

// Transform JSON:API response to WorkspaceRole
function transformRole(data: Record<string, unknown>): WorkspaceRole {
  const attrs = data.attributes as Record<string, unknown>;
  const rels = data.relationships as Record<string, { data: { id: string } | null }> | undefined;

  return {
    id: data.id as string,
    title: attrs.title as string,
    workspaceId: rels?.field_role_workspace?.data?.id || null,
    isDefault: (attrs.field_role_is_default as boolean) || false,
    permissions: {
      // Card permissions
      cardView: (attrs.field_perm_card_view as PermissionLevel) || 'none',
      cardCreate: (attrs.field_perm_card_create as PermissionLevel) || 'none',
      cardEdit: (attrs.field_perm_card_edit as PermissionLevel) || 'none',
      cardDelete: (attrs.field_perm_card_delete as PermissionLevel) || 'none',
      cardArchive: (attrs.field_perm_card_archive as PermissionLevel) || 'own',
      cardMove: (attrs.field_perm_card_move as PermissionLevel) || 'none',
      // List permissions
      listView: (attrs.field_perm_list_view as PermissionLevel) || 'none',
      listCreate: (attrs.field_perm_list_create as PermissionLevel) || 'none',
      listEdit: (attrs.field_perm_list_edit as PermissionLevel) || 'none',
      listDelete: (attrs.field_perm_list_delete as PermissionLevel) || 'none',
      listArchive: (attrs.field_perm_list_archive as PermissionLevel) || 'own',
      // Board permissions
      boardView: (attrs.field_perm_board_view as PermissionLevel) || 'none',
      boardCreate: (attrs.field_perm_board_create as PermissionLevel) || 'none',
      boardEdit: (attrs.field_perm_board_edit as PermissionLevel) || 'none',
      boardDelete: (attrs.field_perm_board_delete as PermissionLevel) || 'none',
      boardArchive: (attrs.field_perm_board_archive as PermissionLevel) || 'own',
      // Workspace permissions
      workspaceView: (attrs.field_perm_workspace_view as PermissionLevel) || 'none',
      workspaceEdit: (attrs.field_perm_workspace_edit as PermissionLevel) || 'none',
      workspaceDelete: (attrs.field_perm_workspace_delete as PermissionLevel) || 'none',
      workspaceArchive: (attrs.field_perm_workspace_archive as PermissionLevel) || 'none',
      // Workspace member permissions (granular)
      memberView: (attrs.field_perm_member_view as PermissionLevel) || 'none',
      memberAdd: (attrs.field_perm_member_add as PermissionLevel) || 'none',
      memberRemove: (attrs.field_perm_member_remove as PermissionLevel) || 'none',
      // Board member permissions
      boardMemberView: (attrs.field_perm_board_member_view as PermissionLevel) || 'none',
      boardMemberAdd: (attrs.field_perm_board_member_add as PermissionLevel) || 'none',
      boardMemberRemove: (attrs.field_perm_board_member_remove as PermissionLevel) || 'none',
      boardRoleView: (attrs.field_perm_board_role_view as PermissionLevel) || 'none',
      // Member management (deprecated, kept for backward compatibility)
      memberManage: (attrs.field_perm_member_manage as PermissionLevel) || 'none',
      // Comment permissions
      commentEdit: (attrs.field_perm_comment_edit as PermissionLevel) || 'none',
      commentDelete: (attrs.field_perm_comment_delete as PermissionLevel) || 'none',
      commentArchive: (attrs.field_perm_comment_archive as PermissionLevel) || 'own',
      // Report permissions
      reportPerformance: (attrs.field_perm_report_performance as PermissionLevel) || 'none',
      reportTasks: (attrs.field_perm_report_tasks as PermissionLevel) || 'none',
      reportActivity: (attrs.field_perm_report_activity as PermissionLevel) || 'none',
      reportWorkload: (attrs.field_perm_report_workload as PermissionLevel) || 'none',
      reportExport: (attrs.field_perm_report_export as PermissionLevel) || 'none',
      // Admin page permissions
      emailTemplatesManage: (attrs.field_perm_email_templates as PermissionLevel) || 'none',
      userManagement: (attrs.field_perm_user_management as PermissionLevel) || 'none',
      roleManagement: (attrs.field_perm_role_management as PermissionLevel) || 'none',
      roleView: (attrs.field_perm_role_view as PermissionLevel) || 'none',
      // Custom field permissions
      customFieldView: (attrs.field_perm_custom_field_view as PermissionLevel) || 'any',
      customFieldCreate: (attrs.field_perm_custom_field_create as PermissionLevel) || 'none',
      customFieldEdit: (attrs.field_perm_custom_field_edit as PermissionLevel) || 'none',
      customFieldDelete: (attrs.field_perm_custom_field_delete as PermissionLevel) || 'none',
      // Automation permissions
      automationView: (attrs.field_perm_automation_view as PermissionLevel) || 'any',
      automationCreate: (attrs.field_perm_automation_create as PermissionLevel) || 'none',
      automationEdit: (attrs.field_perm_automation_edit as PermissionLevel) || 'none',
      automationDelete: (attrs.field_perm_automation_delete as PermissionLevel) || 'none',
      // Card fields visibility permission
      cardFieldsVisibility: (attrs.field_perm_card_field_vis as PermissionLevel) || 'none',
      // Saved views permission
      savedViews: (attrs.field_perm_saved_views as PermissionLevel) || 'any',
      // Mind map permissions
      mindMapView: (attrs.field_perm_mind_map_view as PermissionLevel) || 'any',
      mindMapCreate: (attrs.field_perm_mind_map_create as PermissionLevel) || 'none',
      mindMapEdit: (attrs.field_perm_mind_map_edit as PermissionLevel) || 'none',
      mindMapDelete: (attrs.field_perm_mind_map_delete as PermissionLevel) || 'none',
      // Template permissions
      templateView: (attrs.field_perm_template_view as PermissionLevel) || 'any',
      templateCreate: (attrs.field_perm_template_create as PermissionLevel) || 'none',
      templateEdit: (attrs.field_perm_template_edit as PermissionLevel) || 'none',
      templateDelete: (attrs.field_perm_template_delete as PermissionLevel) || 'none',
      // Profile permissions
      profileView: (attrs.field_perm_profile_view as PermissionLevel) || 'own',
      profileEdit: (attrs.field_perm_profile_edit as PermissionLevel) || 'own',
      profileDelete: (attrs.field_perm_profile_delete as PermissionLevel) || 'none',
    },
  };
}

// Transform JSON:API response to MemberRoleAssignment
function transformMemberRole(data: Record<string, unknown>, included?: Record<string, unknown>[]): MemberRoleAssignment {
  const rels = data.relationships as Record<string, { data: { id: string } | null }> | undefined;

  const roleId = rels?.field_member_role_role?.data?.id || '';
  let role: WorkspaceRole | undefined;

  if (included && roleId) {
    const roleData = included.find((item) => item.id === roleId && item.type === 'node--workspace_role');
    if (roleData) {
      role = transformRole(roleData);
    }
  }

  return {
    id: data.id as string,
    workspaceId: rels?.field_member_role_workspace?.data?.id || '',
    userId: rels?.field_member_role_user?.data?.id || '',
    roleId,
    role,
  };
}

// Fetch all global roles (roles not tied to a specific workspace)
export async function fetchGlobalRoles(): Promise<WorkspaceRole[]> {
  // Fetch all roles and filter client-side for global ones (no workspace)
  const response = await fetch(
    `${API_URL}/jsonapi/node/workspace_role?sort=title`,
    {
      headers: {
        'Accept': 'application/vnd.api+json',
        'Authorization': `Bearer ${getAccessToken()}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch roles');
  }

  const result = await response.json();
  const data = result.data;
  if (!Array.isArray(data)) return [];

  const allRoles = data.map((item: Record<string, unknown>) => transformRole(item));
  // Return only global roles (those without a workspace)
  return allRoles.filter((role: WorkspaceRole) => role.workspaceId === null);
}

// Fetch roles available for a workspace (global + workspace-specific)
export async function fetchWorkspaceRoles(workspaceId: string): Promise<WorkspaceRole[]> {
  // Use custom API endpoint that bypasses JSON:API access issues
  const response = await fetch(
    `${API_URL}/api/workspace/${workspaceId}/roles?${getCacheBuster()}`,
    {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${getAccessToken()}`,
        'Cache-Control': 'no-cache',
      },
    }
  );

  if (!response.ok) {
    return [];
  }

  const roles = await response.json();
  if (!Array.isArray(roles)) return [];

  // The custom endpoint already returns data in the WorkspaceRole format
  return roles as WorkspaceRole[];
}

// Fetch a single role by ID
export async function fetchRole(roleId: string): Promise<WorkspaceRole | null> {
  const response = await fetch(
    `${API_URL}/jsonapi/node/workspace_role/${roleId}`,
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
  return transformRole(result.data);
}

// Get the default role
export async function fetchDefaultRole(): Promise<WorkspaceRole | null> {
  const response = await fetch(
    `${API_URL}/jsonapi/node/workspace_role?filter[field_role_is_default]=1&page[limit]=1`,
    {
      headers: getJsonApiHeaders(),
    }
  );

  if (!response.ok) {
    return null;
  }

  const result = await response.json();
  if (!Array.isArray(result.data) || result.data.length === 0) {
    return null;
  }

  return transformRole(result.data[0]);
}

// Fetch member role assignment for a user in a workspace
export async function fetchMemberRole(workspaceId: string, userId: string): Promise<MemberRoleAssignment | null> {
  // First, fetch the member_role assignment (without including the role, as it may be access-restricted)
  const response = await fetch(
    `${API_URL}/jsonapi/node/member_role?filter[field_member_role_workspace.id]=${workspaceId}&filter[field_member_role_user.id]=${userId}`,
    {
      headers: getJsonApiHeaders(),
    }
  );

  if (!response.ok) {
    return null;
  }

  const result = await response.json();
  if (!Array.isArray(result.data) || result.data.length === 0) {
    return null;
  }

  // Transform the member role (without included role data initially)
  const memberRole = transformMemberRole(result.data[0], result.included);

  // If we have a roleId but no role data, fetch roles from custom endpoint
  // (which bypasses JSON:API access control)
  if (memberRole.roleId && !memberRole.role) {
    try {
      const roles = await fetchWorkspaceRoles(workspaceId);
      const matchedRole = roles.find(r => r.id === memberRole.roleId);
      if (matchedRole) {
        memberRole.role = matchedRole;
      }
    } catch {
      // Silently fail - we'll use default permissions if role can't be fetched
    }
  }

  return memberRole;
}

// Fetch all member role assignments for a workspace
export async function fetchWorkspaceMemberRoles(workspaceId: string): Promise<MemberRoleAssignment[]> {
  const response = await fetch(
    `${API_URL}/jsonapi/node/member_role?filter[field_member_role_workspace.id]=${workspaceId}&include=field_member_role_role,field_member_role_user`,
    {
      headers: getJsonApiHeaders(),
    }
  );

  if (!response.ok) {
    return [];
  }

  const result = await response.json();
  if (!Array.isArray(result.data)) {
    return [];
  }

  return result.data.map((item: Record<string, unknown>) => transformMemberRole(item, result.included));
}

// Create a member role assignment
export async function createMemberRole(workspaceId: string, userId: string, roleId: string): Promise<MemberRoleAssignment> {
  const response = await fetchWithCsrf(`${API_URL}/jsonapi/node/member_role`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: {
        type: 'node--member_role',
        attributes: {
          title: `Role Assignment`,
        },
        relationships: {
          field_member_role_workspace: {
            data: { type: 'node--workspace', id: workspaceId },
          },
          field_member_role_user: {
            data: { type: 'user--user', id: userId },
          },
          field_member_role_role: {
            data: { type: 'node--workspace_role', id: roleId },
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.errors?.[0]?.detail || 'Failed to create member role');
  }

  const result = await response.json();
  // Invalidate permission cache so UI updates immediately
  invalidatePermissionCache();
  return transformMemberRole(result.data);
}

// Update a member role assignment
export async function updateMemberRole(assignmentId: string, roleId: string): Promise<MemberRoleAssignment> {
  const response = await fetchWithCsrf(`${API_URL}/jsonapi/node/member_role/${assignmentId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: {
        type: 'node--member_role',
        id: assignmentId,
        relationships: {
          field_member_role_role: {
            data: { type: 'node--workspace_role', id: roleId },
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.errors?.[0]?.detail || 'Failed to update member role');
  }

  // Refetch with included data
  const fetchResponse = await fetch(
    `${API_URL}/jsonapi/node/member_role/${assignmentId}?include=field_member_role_role`,
    {
      headers: {
        'Accept': 'application/vnd.api+json',
        'Authorization': `Bearer ${getAccessToken()}`,
      },
    }
  );

  if (!fetchResponse.ok) {
    throw new Error('Failed to fetch updated member role');
  }

  const result = await fetchResponse.json();
  // Invalidate permission cache so UI updates immediately
  invalidatePermissionCache();
  return transformMemberRole(result.data, result.included);
}

// Delete a member role assignment
export async function deleteMemberRole(assignmentId: string): Promise<void> {
  const response = await fetchWithCsrf(`${API_URL}/jsonapi/node/member_role/${assignmentId}`, {
    method: 'DELETE',
  });

  if (!response.ok && response.status !== 204) {
    throw new Error('Failed to delete member role');
  }
  // Invalidate permission cache so UI updates immediately
  invalidatePermissionCache();
}

// Create a new workspace role
export async function createWorkspaceRole(
  title: string,
  workspaceId: string | null,
  permissions: WorkspaceRole['permissions'],
  isDefault: boolean = false
): Promise<WorkspaceRole> {
  const response = await fetch(`${API_URL}/api/roles`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${getAccessToken()}`,
    },
    body: JSON.stringify({
      title,
      workspaceId,
      isDefault,
      permissions,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create role');
  }

  const result = await response.json();
  // Invalidate permission cache so UI updates immediately
  invalidatePermissionCache();
  return result;
}

// Update a workspace role
export async function updateWorkspaceRole(
  roleId: string,
  updates: Partial<{
    title: string;
    permissions: Partial<WorkspaceRole['permissions']>;
    isDefault: boolean;
  }>
): Promise<WorkspaceRole> {
  const response = await fetch(`${API_URL}/api/roles/${roleId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${getAccessToken()}`,
    },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update role');
  }

  const result = await response.json();
  // Invalidate permission cache so UI updates immediately
  invalidatePermissionCache();
  return result;
}

// Delete a workspace role
export async function deleteWorkspaceRole(roleId: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/roles/${roleId}`, {
    method: 'DELETE',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${getAccessToken()}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete role');
  }
  // Invalidate permission cache so UI updates immediately
  invalidatePermissionCache();
}

// Permission check helpers
export function canPerformAction(
  permission: PermissionLevel,
  isOwner: boolean
): boolean {
  if (permission === 'any') return true;
  if (permission === 'own' && isOwner) return true;
  return false;
}

// Get user's effective permissions for a workspace
export async function getUserPermissions(workspaceId: string, userId: string): Promise<WorkspaceRole['permissions'] | null> {
  const memberRole = await fetchMemberRole(workspaceId, userId);

  if (memberRole?.role) {
    return memberRole.role.permissions;
  }

  // If no role assigned, get default role
  const defaultRole = await fetchDefaultRole();
  return defaultRole?.permissions || null;
}
