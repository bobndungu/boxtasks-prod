import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '../stores/auth';
import { fetchMemberRole, fetchDefaultRole, canPerformAction } from '../api/roles';
import type { WorkspaceRole, PermissionLevel } from '../api/roles';

export type ReportType = 'performance' | 'tasks' | 'activity' | 'workload';
export type AdminPageType = 'emailTemplates' | 'userManagement' | 'roleManagement';

interface UsePermissionsReturn {
  permissions: WorkspaceRole['permissions'] | null;
  loading: boolean;
  error: string | null;
  canView: (type: 'card' | 'list' | 'board' | 'workspace', isOwner?: boolean) => boolean;
  canCreate: (type: 'card' | 'list' | 'board') => boolean;
  canEdit: (type: 'card' | 'list' | 'board' | 'workspace' | 'comment', isOwner: boolean) => boolean;
  canDelete: (type: 'card' | 'list' | 'board' | 'workspace' | 'comment', isOwner: boolean) => boolean;
  canArchive: (type: 'card', isOwner: boolean) => boolean;
  canMove: (type: 'card', isOwner: boolean) => boolean;
  canManageMembers: () => boolean;
  canViewReport: (reportType: ReportType, isOwner?: boolean) => boolean;
  canExportReports: () => boolean;
  canViewAnyReport: () => boolean;
  canAccessAdminPage: (pageType: AdminPageType) => boolean;
  refetch: () => Promise<void>;
}

// Default permissive permissions for fallback
const DEFAULT_PERMISSIONS: WorkspaceRole['permissions'] = {
  cardView: 'any',
  cardCreate: 'any',
  cardEdit: 'any',
  cardDelete: 'own',
  cardArchive: 'any',
  cardMove: 'any',
  listView: 'any',
  listCreate: 'any',
  listEdit: 'any',
  listDelete: 'own',
  boardView: 'any',
  boardCreate: 'any',
  boardEdit: 'own',
  boardDelete: 'own',
  workspaceView: 'any',
  workspaceEdit: 'none',
  workspaceDelete: 'none',
  memberManage: 'none',
  commentEdit: 'own',
  commentDelete: 'own',
  reportPerformance: 'none',
  reportTasks: 'none',
  reportActivity: 'none',
  reportWorkload: 'none',
  reportExport: 'none',
  emailTemplatesManage: 'none',
  userManagement: 'none',
  roleManagement: 'none',
};

// Check if error is an abort error (navigation/unmount)
function isAbortError(err: unknown): boolean {
  if (err instanceof Error) {
    return err.name === 'AbortError' ||
           err.message === 'Failed to fetch' ||
           err.message.includes('abort');
  }
  return false;
}

export function usePermissions(workspaceId: string | undefined): UsePermissionsReturn {
  const { user } = useAuthStore();
  const [permissions, setPermissions] = useState<WorkspaceRole['permissions'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    const fetchPermissions = async () => {
      if (!workspaceId || !user?.id) {
        if (isMountedRef.current) {
          setPermissions(null);
          setLoading(false);
        }
        return;
      }

      if (isMountedRef.current) {
        setLoading(true);
        setError(null);
      }

      try {
        // First try to get user's assigned role in the workspace
        const memberRole = await fetchMemberRole(workspaceId, user.id);

        if (!isMountedRef.current) return;

        if (memberRole?.role) {
          setPermissions(memberRole.role.permissions);
        } else {
          // If no role assigned, use default role
          const defaultRole = await fetchDefaultRole();

          if (!isMountedRef.current) return;

          if (defaultRole) {
            setPermissions(defaultRole.permissions);
          } else {
            // Fallback to editor-like permissions if no roles exist
            setPermissions(DEFAULT_PERMISSIONS);
          }
        }
      } catch (err) {
        // Silently ignore abort/navigation errors - these are expected during quick navigation
        if (isAbortError(err) || !isMountedRef.current) {
          return;
        }

        console.error('Failed to fetch permissions:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch permissions');
        // Set permissive defaults on error to not block users
        setPermissions(DEFAULT_PERMISSIONS);
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    };

    fetchPermissions();

    return () => {
      isMountedRef.current = false;
    };
  }, [workspaceId, user?.id]);

  const refetch = useCallback(async () => {
    if (!workspaceId || !user?.id) {
      setPermissions(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const memberRole = await fetchMemberRole(workspaceId, user.id);
      if (memberRole?.role) {
        setPermissions(memberRole.role.permissions);
      } else {
        const defaultRole = await fetchDefaultRole();
        setPermissions(defaultRole?.permissions || DEFAULT_PERMISSIONS);
      }
    } catch (err) {
      if (!isAbortError(err)) {
        console.error('Failed to fetch permissions:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch permissions');
        setPermissions(DEFAULT_PERMISSIONS);
      }
    } finally {
      setLoading(false);
    }
  }, [workspaceId, user?.id]);

  const canView = useCallback((type: 'card' | 'list' | 'board' | 'workspace', isOwner: boolean = false): boolean => {
    if (!permissions) return true; // Allow by default while loading

    let permission: PermissionLevel;
    switch (type) {
      case 'card':
        permission = permissions.cardView;
        break;
      case 'list':
        permission = permissions.listView;
        break;
      case 'board':
        permission = permissions.boardView;
        break;
      case 'workspace':
        permission = permissions.workspaceView;
        break;
    }

    return canPerformAction(permission, isOwner);
  }, [permissions]);

  const canCreate = useCallback((type: 'card' | 'list' | 'board'): boolean => {
    if (!permissions) return true; // Allow by default while loading

    let permission: PermissionLevel;
    switch (type) {
      case 'card':
        permission = permissions.cardCreate;
        break;
      case 'list':
        permission = permissions.listCreate;
        break;
      case 'board':
        permission = permissions.boardCreate;
        break;
    }

    return permission === 'any';
  }, [permissions]);

  const canEdit = useCallback((type: 'card' | 'list' | 'board' | 'workspace' | 'comment', isOwner: boolean): boolean => {
    if (!permissions) return true; // Allow by default while loading

    let permission: PermissionLevel;
    switch (type) {
      case 'card':
        permission = permissions.cardEdit;
        break;
      case 'list':
        permission = permissions.listEdit;
        break;
      case 'board':
        permission = permissions.boardEdit;
        break;
      case 'workspace':
        permission = permissions.workspaceEdit;
        break;
      case 'comment':
        permission = permissions.commentEdit;
        break;
    }

    return canPerformAction(permission, isOwner);
  }, [permissions]);

  const canDelete = useCallback((type: 'card' | 'list' | 'board' | 'workspace' | 'comment', isOwner: boolean): boolean => {
    if (!permissions) return true; // Allow by default while loading

    let permission: PermissionLevel;
    switch (type) {
      case 'card':
        permission = permissions.cardDelete;
        break;
      case 'list':
        permission = permissions.listDelete;
        break;
      case 'board':
        permission = permissions.boardDelete;
        break;
      case 'workspace':
        permission = permissions.workspaceDelete;
        break;
      case 'comment':
        permission = permissions.commentDelete;
        break;
    }

    return canPerformAction(permission, isOwner);
  }, [permissions]);

  const canArchive = useCallback((type: 'card', isOwner: boolean): boolean => {
    if (!permissions) return true; // Allow by default while loading

    if (type === 'card') {
      return canPerformAction(permissions.cardArchive, isOwner);
    }

    return true;
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

  const canViewReport = useCallback((reportType: ReportType, isOwner: boolean = false): boolean => {
    if (!permissions) return false; // Default to no access for reports

    let permission: PermissionLevel;
    switch (reportType) {
      case 'performance':
        permission = permissions.reportPerformance;
        break;
      case 'tasks':
        permission = permissions.reportTasks;
        break;
      case 'activity':
        permission = permissions.reportActivity;
        break;
      case 'workload':
        permission = permissions.reportWorkload;
        break;
    }

    return canPerformAction(permission, isOwner);
  }, [permissions]);

  const canExportReports = useCallback((): boolean => {
    if (!permissions) return false;

    return permissions.reportExport === 'any' || permissions.reportExport === 'own';
  }, [permissions]);

  const canViewAnyReport = useCallback((): boolean => {
    if (!permissions) return false;

    return (
      permissions.reportPerformance !== 'none' ||
      permissions.reportTasks !== 'none' ||
      permissions.reportActivity !== 'none' ||
      permissions.reportWorkload !== 'none'
    );
  }, [permissions]);

  const canAccessAdminPage = useCallback((pageType: AdminPageType): boolean => {
    // Check if user has Drupal administrator role first - they can access everything
    if (user?.roles?.includes('administrator') || user?.roles?.includes('box_admin')) {
      return true;
    }

    if (!permissions) return false;

    let permission: PermissionLevel;
    switch (pageType) {
      case 'emailTemplates':
        permission = permissions.emailTemplatesManage;
        break;
      case 'userManagement':
        permission = permissions.userManagement;
        break;
      case 'roleManagement':
        permission = permissions.roleManagement;
        break;
    }

    return permission === 'any';
  }, [permissions, user]);

  return {
    permissions,
    loading,
    error,
    canView,
    canCreate,
    canEdit,
    canDelete,
    canArchive,
    canMove,
    canManageMembers,
    canViewReport,
    canExportReports,
    canViewAnyReport,
    canAccessAdminPage,
    refetch,
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
