import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../stores/auth';
import { fetchMemberRole, fetchDefaultRole, canPerformAction } from '../api/roles';
import type { WorkspaceRole, PermissionLevel } from '../api/roles';

interface UsePermissionsReturn {
  permissions: WorkspaceRole['permissions'] | null;
  loading: boolean;
  error: string | null;
  canCreate: (type: 'card' | 'list') => boolean;
  canEdit: (type: 'card' | 'list' | 'comment', isOwner: boolean) => boolean;
  canDelete: (type: 'card' | 'list' | 'comment', isOwner: boolean) => boolean;
  canMove: (type: 'card', isOwner: boolean) => boolean;
  canManageMembers: () => boolean;
  refetch: () => Promise<void>;
}

export function usePermissions(workspaceId: string | undefined): UsePermissionsReturn {
  const { user } = useAuthStore();
  const [permissions, setPermissions] = useState<WorkspaceRole['permissions'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPermissions = useCallback(async () => {
    if (!workspaceId || !user?.id) {
      setPermissions(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // First try to get user's assigned role in the workspace
      const memberRole = await fetchMemberRole(workspaceId, user.id);

      if (memberRole?.role) {
        setPermissions(memberRole.role.permissions);
      } else {
        // If no role assigned, use default role
        const defaultRole = await fetchDefaultRole();
        if (defaultRole) {
          setPermissions(defaultRole.permissions);
        } else {
          // Fallback to editor-like permissions if no roles exist
          setPermissions({
            cardCreate: 'any',
            cardEdit: 'any',
            cardDelete: 'own',
            cardMove: 'any',
            listCreate: 'any',
            listEdit: 'any',
            listDelete: 'own',
            memberManage: 'none',
            commentEdit: 'own',
            commentDelete: 'own',
          });
        }
      }
    } catch (err) {
      console.error('Failed to fetch permissions:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch permissions');
      // Set permissive defaults on error to not block users
      setPermissions({
        cardCreate: 'any',
        cardEdit: 'any',
        cardDelete: 'own',
        cardMove: 'any',
        listCreate: 'any',
        listEdit: 'any',
        listDelete: 'own',
        memberManage: 'none',
        commentEdit: 'own',
        commentDelete: 'own',
      });
    } finally {
      setLoading(false);
    }
  }, [workspaceId, user?.id]);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  const canCreate = useCallback((type: 'card' | 'list'): boolean => {
    if (!permissions) return true; // Allow by default while loading

    const permission = type === 'card' ? permissions.cardCreate : permissions.listCreate;
    return permission === 'any';
  }, [permissions]);

  const canEdit = useCallback((type: 'card' | 'list' | 'comment', isOwner: boolean): boolean => {
    if (!permissions) return true; // Allow by default while loading

    let permission: PermissionLevel;
    switch (type) {
      case 'card':
        permission = permissions.cardEdit;
        break;
      case 'list':
        permission = permissions.listEdit;
        break;
      case 'comment':
        permission = permissions.commentEdit;
        break;
    }

    return canPerformAction(permission, isOwner);
  }, [permissions]);

  const canDelete = useCallback((type: 'card' | 'list' | 'comment', isOwner: boolean): boolean => {
    if (!permissions) return true; // Allow by default while loading

    let permission: PermissionLevel;
    switch (type) {
      case 'card':
        permission = permissions.cardDelete;
        break;
      case 'list':
        permission = permissions.listDelete;
        break;
      case 'comment':
        permission = permissions.commentDelete;
        break;
    }

    return canPerformAction(permission, isOwner);
  }, [permissions]);

  const canMove = useCallback((type: 'card', isOwner: boolean): boolean => {
    if (!permissions) return true; // Allow by default while loading

    if (type === 'card') {
      return canPerformAction(permissions.cardMove, isOwner);
    }

    return true;
  }, [permissions]);

  const canManageMembers = useCallback((): boolean => {
    if (!permissions) return false;

    return permissions.memberManage === 'any';
  }, [permissions]);

  return {
    permissions,
    loading,
    error,
    canCreate,
    canEdit,
    canDelete,
    canMove,
    canManageMembers,
    refetch: fetchPermissions,
  };
}

// Simple permission check without hook (for one-off checks)
export async function checkPermission(
  workspaceId: string,
  userId: string,
  action: keyof WorkspaceRole['permissions'],
  isOwner: boolean = false
): Promise<boolean> {
  try {
    const memberRole = await fetchMemberRole(workspaceId, userId);
    let permissions: WorkspaceRole['permissions'] | undefined;

    if (memberRole?.role) {
      permissions = memberRole.role.permissions;
    } else {
      const defaultRole = await fetchDefaultRole();
      permissions = defaultRole?.permissions;
    }

    if (!permissions) return true; // Allow by default

    const permission = permissions[action];
    return canPerformAction(permission, isOwner);
  } catch {
    return true; // Allow by default on error
  }
}
