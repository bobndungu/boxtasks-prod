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
  canArchive: (type: 'card' | 'list' | 'board' | 'workspace' | 'comment', isOwner: boolean) => boolean;
  canMove: (type: 'card', isOwner: boolean) => boolean;
  canManageMembers: () => boolean;
  // Granular member permissions
  canViewMembers: (scope: 'workspace' | 'board') => boolean;
  canAddMembers: (scope: 'workspace' | 'board') => boolean;
  canRemoveMembers: (scope: 'workspace' | 'board') => boolean;
  // Role permissions
  canViewRoles: () => boolean;
  canViewBoardRoles: () => boolean;
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
  listArchive: 'own',
  boardView: 'any',
  boardCreate: 'any',
  boardEdit: 'own',
  boardDelete: 'own',
  boardArchive: 'own',
  workspaceView: 'any',
  workspaceEdit: 'none',
  workspaceDelete: 'none',
  workspaceArchive: 'none',
  // Granular member permissions
  memberView: 'none',
  memberAdd: 'none',
  memberRemove: 'none',
  // Board member permissions
  boardMemberView: 'none',
  boardMemberAdd: 'none',
  boardMemberRemove: 'none',
  boardRoleView: 'none',
  // Legacy member management (deprecated)
  memberManage: 'none',
  commentEdit: 'own',
  commentDelete: 'own',
  commentArchive: 'own',
  reportPerformance: 'none',
  reportTasks: 'none',
  reportActivity: 'none',
  reportWorkload: 'none',
  reportExport: 'none',
  emailTemplatesManage: 'none',
  userManagement: 'none',
  roleManagement: 'none',
  roleView: 'none',
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

// Check if user is super admin (uid = 1)
function isSuperAdmin(user: { uid?: number; isAdmin?: boolean } | null): boolean {
  return user?.uid === 1;
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
    // Super admin (uid=1) bypasses all permission checks
    if (isSuperAdmin(user)) return true;
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
  }, [permissions, user]);

  const canCreate = useCallback((type: 'card' | 'list' | 'board'): boolean => {
    // Super admin (uid=1) bypasses all permission checks
    if (isSuperAdmin(user)) return true;
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
  }, [permissions, user]);

  const canEdit = useCallback((type: 'card' | 'list' | 'board' | 'workspace' | 'comment', isOwner: boolean): boolean => {
    // Super admin (uid=1) bypasses all permission checks
    if (isSuperAdmin(user)) return true;
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
  }, [permissions, user]);

  const canDelete = useCallback((type: 'card' | 'list' | 'board' | 'workspace' | 'comment', isOwner: boolean): boolean => {
    // Super admin (uid=1) bypasses all permission checks
    if (isSuperAdmin(user)) return true;
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
  }, [permissions, user]);

  const canArchive = useCallback((type: 'card' | 'list' | 'board' | 'workspace' | 'comment', isOwner: boolean): boolean => {
    // Super admin (uid=1) bypasses all permission checks
    if (isSuperAdmin(user)) return true;
    if (!permissions) return true; // Allow by default while loading

    let permission: PermissionLevel;
    switch (type) {
      case 'card':
        permission = permissions.cardArchive;
        break;
      case 'list':
        permission = permissions.listArchive;
        break;
      case 'board':
        permission = permissions.boardArchive;
        break;
      case 'workspace':
        permission = permissions.workspaceArchive;
        break;
      case 'comment':
        permission = permissions.commentArchive;
        break;
    }

    return canPerformAction(permission, isOwner);
  }, [permissions, user]);

  const canMove = useCallback((type: 'card', isOwner: boolean): boolean => {
    // Super admin (uid=1) bypasses all permission checks
    if (isSuperAdmin(user)) return true;
    if (!permissions) return true; // Allow by default while loading

    if (type === 'card') {
      return canPerformAction(permissions.cardMove, isOwner);
    }

    return true;
  }, [permissions, user]);

  const canManageMembers = useCallback((): boolean => {
    // Super admin (uid=1) bypasses all permission checks
    if (isSuperAdmin(user)) return true;
    if (!permissions) return false;

    // Check legacy memberManage OR any of the new granular permissions
    return (
      permissions.memberManage === 'any' ||
      permissions.memberView === 'any' ||
      permissions.memberAdd === 'any' ||
      permissions.memberRemove === 'any' ||
      permissions.boardMemberView === 'any' ||
      permissions.boardMemberAdd === 'any' ||
      permissions.boardMemberRemove === 'any'
    );
  }, [permissions, user]);

  // Granular member view permission
  const canViewMembers = useCallback((scope: 'workspace' | 'board'): boolean => {
    // Super admin (uid=1) bypasses all permission checks
    if (isSuperAdmin(user)) return true;
    if (!permissions) return false;

    if (scope === 'workspace') {
      // Check new permission OR legacy memberManage
      return permissions.memberView === 'any' || permissions.memberManage === 'any';
    }
    // For board scope, check board-specific permission OR legacy memberManage
    return permissions.boardMemberView === 'any' || permissions.memberManage === 'any';
  }, [permissions, user]);

  // Granular member add permission
  const canAddMembers = useCallback((scope: 'workspace' | 'board'): boolean => {
    // Super admin (uid=1) bypasses all permission checks
    if (isSuperAdmin(user)) return true;
    if (!permissions) return false;

    if (scope === 'workspace') {
      // Check new permission OR legacy memberManage
      return permissions.memberAdd === 'any' || permissions.memberManage === 'any';
    }
    // For board scope, check board-specific permission OR legacy memberManage
    return permissions.boardMemberAdd === 'any' || permissions.memberManage === 'any';
  }, [permissions, user]);

  // Granular member remove permission
  const canRemoveMembers = useCallback((scope: 'workspace' | 'board'): boolean => {
    // Super admin (uid=1) bypasses all permission checks
    if (isSuperAdmin(user)) return true;
    if (!permissions) return false;

    if (scope === 'workspace') {
      // Check new permission OR legacy memberManage
      return permissions.memberRemove === 'any' || permissions.memberManage === 'any';
    }
    // For board scope, check board-specific permission OR legacy memberManage
    return permissions.boardMemberRemove === 'any' || permissions.memberManage === 'any';
  }, [permissions, user]);

  // Role view permission
  const canViewRoles = useCallback((): boolean => {
    // Super admin (uid=1) bypasses all permission checks
    if (isSuperAdmin(user)) return true;
    // Check if user has Drupal administrator role - they can access everything
    if (user?.roles?.includes('administrator') || user?.roles?.includes('box_admin')) {
      return true;
    }
    if (!permissions) return false;

    // Check roleView OR roleManagement (if they can manage, they can view)
    return permissions.roleView === 'any' || permissions.roleManagement === 'any';
  }, [permissions, user]);

  // Board role view permission (view member roles within a board)
  const canViewBoardRoles = useCallback((): boolean => {
    // Super admin (uid=1) bypasses all permission checks
    if (isSuperAdmin(user)) return true;
    // Check if user has Drupal administrator role - they can access everything
    if (user?.roles?.includes('administrator') || user?.roles?.includes('box_admin')) {
      return true;
    }
    if (!permissions) return false;

    return permissions.boardRoleView === 'any';
  }, [permissions, user]);

  const canViewReport = useCallback((reportType: ReportType, isOwner: boolean = false): boolean => {
    // Super admin (uid=1) bypasses all permission checks
    if (isSuperAdmin(user)) return true;
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
  }, [permissions, user]);

  const canExportReports = useCallback((): boolean => {
    // Super admin (uid=1) bypasses all permission checks
    if (isSuperAdmin(user)) return true;
    if (!permissions) return false;

    return permissions.reportExport === 'any' || permissions.reportExport === 'own';
  }, [permissions, user]);

  const canViewAnyReport = useCallback((): boolean => {
    // Super admin (uid=1) bypasses all permission checks
    if (isSuperAdmin(user)) return true;
    if (!permissions) return false;

    return (
      permissions.reportPerformance !== 'none' ||
      permissions.reportTasks !== 'none' ||
      permissions.reportActivity !== 'none' ||
      permissions.reportWorkload !== 'none'
    );
  }, [permissions, user]);

  const canAccessAdminPage = useCallback((pageType: AdminPageType): boolean => {
    // Super admin (uid=1) bypasses all permission checks
    if (isSuperAdmin(user)) return true;
    // Check if user has Drupal administrator role - they can access everything
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
    // Granular member permissions
    canViewMembers,
    canAddMembers,
    canRemoveMembers,
    // Role permissions
    canViewRoles,
    canViewBoardRoles,
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
