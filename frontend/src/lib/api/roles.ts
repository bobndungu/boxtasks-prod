import { getAccessToken, fetchWithCsrf } from './client';

const API_URL = import.meta.env.VITE_API_URL || 'https://boxtasks2.ddev.site';

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
    // Board permissions
    boardView: PermissionLevel;
    boardCreate: PermissionLevel; // Only 'any' or 'none'
    boardEdit: PermissionLevel;
    boardDelete: PermissionLevel;
    // Workspace permissions
    workspaceView: PermissionLevel; // Only 'any' or 'none'
    workspaceEdit: PermissionLevel; // Only 'any' or 'none'
    workspaceDelete: PermissionLevel; // Only 'any' or 'none'
    // Member management
    memberManage: PermissionLevel;
    // Comment permissions
    commentEdit: PermissionLevel;
    commentDelete: PermissionLevel;
    // Report permissions
    reportPerformance: PermissionLevel;
    reportTasks: PermissionLevel;
    reportActivity: PermissionLevel;
    reportWorkload: PermissionLevel;
    reportExport: PermissionLevel;
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
      // Board permissions
      boardView: (attrs.field_perm_board_view as PermissionLevel) || 'none',
      boardCreate: (attrs.field_perm_board_create as PermissionLevel) || 'none',
      boardEdit: (attrs.field_perm_board_edit as PermissionLevel) || 'none',
      boardDelete: (attrs.field_perm_board_delete as PermissionLevel) || 'none',
      // Workspace permissions
      workspaceView: (attrs.field_perm_workspace_view as PermissionLevel) || 'none',
      workspaceEdit: (attrs.field_perm_workspace_edit as PermissionLevel) || 'none',
      workspaceDelete: (attrs.field_perm_workspace_delete as PermissionLevel) || 'none',
      // Member management
      memberManage: (attrs.field_perm_member_manage as PermissionLevel) || 'none',
      // Comment permissions
      commentEdit: (attrs.field_perm_comment_edit as PermissionLevel) || 'none',
      commentDelete: (attrs.field_perm_comment_delete as PermissionLevel) || 'none',
      // Report permissions
      reportPerformance: (attrs.field_perm_report_performance as PermissionLevel) || 'none',
      reportTasks: (attrs.field_perm_report_tasks as PermissionLevel) || 'none',
      reportActivity: (attrs.field_perm_report_activity as PermissionLevel) || 'none',
      reportWorkload: (attrs.field_perm_report_workload as PermissionLevel) || 'none',
      reportExport: (attrs.field_perm_report_export as PermissionLevel) || 'none',
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
  // Fetch all roles and filter for global + workspace-specific
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
    return [];
  }

  const result = await response.json();
  if (!Array.isArray(result.data)) return [];

  const allRoles = result.data.map((item: Record<string, unknown>) => transformRole(item));

  // Return global roles (no workspace) + workspace-specific roles
  return allRoles.filter((role: WorkspaceRole) => role.workspaceId === null || role.workspaceId === workspaceId);
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
  if (!Array.isArray(result.data) || result.data.length === 0) {
    return null;
  }

  return transformRole(result.data[0]);
}

// Fetch member role assignment for a user in a workspace
export async function fetchMemberRole(workspaceId: string, userId: string): Promise<MemberRoleAssignment | null> {
  const response = await fetch(
    `${API_URL}/jsonapi/node/member_role?filter[field_member_role_workspace.id]=${workspaceId}&filter[field_member_role_user.id]=${userId}&include=field_member_role_role`,
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
  if (!Array.isArray(result.data) || result.data.length === 0) {
    return null;
  }

  return transformMemberRole(result.data[0], result.included);
}

// Fetch all member role assignments for a workspace
export async function fetchWorkspaceMemberRoles(workspaceId: string): Promise<MemberRoleAssignment[]> {
  const response = await fetch(
    `${API_URL}/jsonapi/node/member_role?filter[field_member_role_workspace.id]=${workspaceId}&include=field_member_role_role,field_member_role_user`,
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
}

// Create a new workspace role
export async function createWorkspaceRole(
  title: string,
  workspaceId: string | null,
  permissions: WorkspaceRole['permissions'],
  isDefault: boolean = false
): Promise<WorkspaceRole> {
  const relationships: Record<string, unknown> = {};

  if (workspaceId) {
    relationships.field_role_workspace = {
      data: { type: 'node--workspace', id: workspaceId },
    };
  }

  const response = await fetchWithCsrf(`${API_URL}/jsonapi/node/workspace_role`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: {
        type: 'node--workspace_role',
        attributes: {
          title,
          field_role_is_default: isDefault,
          // Card permissions
          field_perm_card_view: permissions.cardView,
          field_perm_card_create: permissions.cardCreate,
          field_perm_card_edit: permissions.cardEdit,
          field_perm_card_delete: permissions.cardDelete,
          field_perm_card_archive: permissions.cardArchive,
          field_perm_card_move: permissions.cardMove,
          // List permissions
          field_perm_list_view: permissions.listView,
          field_perm_list_create: permissions.listCreate,
          field_perm_list_edit: permissions.listEdit,
          field_perm_list_delete: permissions.listDelete,
          // Board permissions
          field_perm_board_view: permissions.boardView,
          field_perm_board_create: permissions.boardCreate,
          field_perm_board_edit: permissions.boardEdit,
          field_perm_board_delete: permissions.boardDelete,
          // Workspace permissions
          field_perm_workspace_view: permissions.workspaceView,
          field_perm_workspace_edit: permissions.workspaceEdit,
          field_perm_workspace_delete: permissions.workspaceDelete,
          // Member management
          field_perm_member_manage: permissions.memberManage,
          // Comment permissions
          field_perm_comment_edit: permissions.commentEdit,
          field_perm_comment_delete: permissions.commentDelete,
          // Report permissions
          field_perm_report_performance: permissions.reportPerformance,
          field_perm_report_tasks: permissions.reportTasks,
          field_perm_report_activity: permissions.reportActivity,
          field_perm_report_workload: permissions.reportWorkload,
          field_perm_report_export: permissions.reportExport,
        },
        ...(Object.keys(relationships).length > 0 && { relationships }),
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.errors?.[0]?.detail || 'Failed to create role');
  }

  const result = await response.json();
  return transformRole(result.data);
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
  const attributes: Record<string, unknown> = {};

  if (updates.title !== undefined) {
    attributes.title = updates.title;
  }
  if (updates.isDefault !== undefined) {
    attributes.field_role_is_default = updates.isDefault;
  }
  if (updates.permissions) {
    // Card permissions
    if (updates.permissions.cardView !== undefined) {
      attributes.field_perm_card_view = updates.permissions.cardView;
    }
    if (updates.permissions.cardCreate !== undefined) {
      attributes.field_perm_card_create = updates.permissions.cardCreate;
    }
    if (updates.permissions.cardEdit !== undefined) {
      attributes.field_perm_card_edit = updates.permissions.cardEdit;
    }
    if (updates.permissions.cardDelete !== undefined) {
      attributes.field_perm_card_delete = updates.permissions.cardDelete;
    }
    if (updates.permissions.cardArchive !== undefined) {
      attributes.field_perm_card_archive = updates.permissions.cardArchive;
    }
    if (updates.permissions.cardMove !== undefined) {
      attributes.field_perm_card_move = updates.permissions.cardMove;
    }
    // List permissions
    if (updates.permissions.listView !== undefined) {
      attributes.field_perm_list_view = updates.permissions.listView;
    }
    if (updates.permissions.listCreate !== undefined) {
      attributes.field_perm_list_create = updates.permissions.listCreate;
    }
    if (updates.permissions.listEdit !== undefined) {
      attributes.field_perm_list_edit = updates.permissions.listEdit;
    }
    if (updates.permissions.listDelete !== undefined) {
      attributes.field_perm_list_delete = updates.permissions.listDelete;
    }
    // Board permissions
    if (updates.permissions.boardView !== undefined) {
      attributes.field_perm_board_view = updates.permissions.boardView;
    }
    if (updates.permissions.boardCreate !== undefined) {
      attributes.field_perm_board_create = updates.permissions.boardCreate;
    }
    if (updates.permissions.boardEdit !== undefined) {
      attributes.field_perm_board_edit = updates.permissions.boardEdit;
    }
    if (updates.permissions.boardDelete !== undefined) {
      attributes.field_perm_board_delete = updates.permissions.boardDelete;
    }
    // Workspace permissions
    if (updates.permissions.workspaceView !== undefined) {
      attributes.field_perm_workspace_view = updates.permissions.workspaceView;
    }
    if (updates.permissions.workspaceEdit !== undefined) {
      attributes.field_perm_workspace_edit = updates.permissions.workspaceEdit;
    }
    if (updates.permissions.workspaceDelete !== undefined) {
      attributes.field_perm_workspace_delete = updates.permissions.workspaceDelete;
    }
    // Member management
    if (updates.permissions.memberManage !== undefined) {
      attributes.field_perm_member_manage = updates.permissions.memberManage;
    }
    // Comment permissions
    if (updates.permissions.commentEdit !== undefined) {
      attributes.field_perm_comment_edit = updates.permissions.commentEdit;
    }
    if (updates.permissions.commentDelete !== undefined) {
      attributes.field_perm_comment_delete = updates.permissions.commentDelete;
    }
    // Report permissions
    if (updates.permissions.reportPerformance !== undefined) {
      attributes.field_perm_report_performance = updates.permissions.reportPerformance;
    }
    if (updates.permissions.reportTasks !== undefined) {
      attributes.field_perm_report_tasks = updates.permissions.reportTasks;
    }
    if (updates.permissions.reportActivity !== undefined) {
      attributes.field_perm_report_activity = updates.permissions.reportActivity;
    }
    if (updates.permissions.reportWorkload !== undefined) {
      attributes.field_perm_report_workload = updates.permissions.reportWorkload;
    }
    if (updates.permissions.reportExport !== undefined) {
      attributes.field_perm_report_export = updates.permissions.reportExport;
    }
  }

  const response = await fetchWithCsrf(`${API_URL}/jsonapi/node/workspace_role/${roleId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: {
        type: 'node--workspace_role',
        id: roleId,
        attributes,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.errors?.[0]?.detail || 'Failed to update role');
  }

  const result = await response.json();
  return transformRole(result.data);
}

// Delete a workspace role
export async function deleteWorkspaceRole(roleId: string): Promise<void> {
  const response = await fetchWithCsrf(`${API_URL}/jsonapi/node/workspace_role/${roleId}`, {
    method: 'DELETE',
  });

  if (!response.ok && response.status !== 204) {
    throw new Error('Failed to delete role');
  }
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
