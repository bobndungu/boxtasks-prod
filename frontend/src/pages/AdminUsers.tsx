import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Search,
  Edit2,
  Shield,
  UserCheck,
  UserX,
  Loader2,
  ChevronLeft,
  ChevronRight,
  X,
  Save,
  Check,
  Briefcase,
  Plus,
  Trash2,
  RefreshCw,
  Settings,
  Clock,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import MainHeader from '../components/MainHeader';
import { useAuthStore } from '../lib/stores/auth';
import { useWorkspaceStore } from '../lib/stores/workspace';
import { usePermissions } from '../lib/hooks/usePermissions';
import { useConfirmDialog } from '../lib/hooks/useConfirmDialog';
import {
  fetchUsers,
  fetchUser,
  updateUser,
  updateUserRoles,
  fetchDrupalRoles,
  setUserStatus,
  deleteUser,
  type DrupalUser,
} from '../lib/api/users';
import { fetchWorkspaces, type Workspace } from '../lib/api/workspaces';
import {
  fetchGlobalRoles,
  createMemberRole,
  deleteMemberRole,
  updateMemberRole,
  type WorkspaceRole,
  type MemberRoleAssignment,
} from '../lib/api/roles';
import { getAccessToken } from '../lib/api/client';
import {
  getRegistrationSettings,
  updateRegistrationSettings,
  getPendingUsers,
  approveUser,
  rejectUser,
  type RegistrationSettings,
  type PendingUser,
} from '../lib/api/registration-settings';

const API_URL = import.meta.env.VITE_API_URL || 'https://boxtasks2.ddev.site';

export default function AdminUsers() {
  const { user: currentUser } = useAuthStore();
  const { currentWorkspace } = useWorkspaceStore();
  const { canProfile } = usePermissions(currentWorkspace?.id);
  const canEditOtherProfiles = canProfile('edit', false);
  const canDeleteOtherProfiles = canProfile('delete', false);
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const [users, setUsers] = useState<DrupalUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const pageSize = 20;

  // Edit modal state
  const [editingUser, setEditingUser] = useState<DrupalUser | null>(null);
  const [editForm, setEditForm] = useState({
    username: '',
    displayName: '',
    email: '',
    bio: '',
    jobTitle: '',
  });
  const [editSaving, setEditSaving] = useState(false);
  const [editMessage, setEditMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Role modal state
  const [roleUser, setRoleUser] = useState<DrupalUser | null>(null);
  const [drupalRoles, setDrupalRoles] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [roleSaving, setRoleSaving] = useState(false);
  const [roleMessage, setRoleMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [roleTab, setRoleTab] = useState<'drupal' | 'workspace'>('drupal');

  // Workspace role assignment state
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [globalRoles, setGlobalRoles] = useState<WorkspaceRole[]>([]);
  const [userWorkspaceRoles, setUserWorkspaceRoles] = useState<MemberRoleAssignment[]>([]);
  const [wsRolesLoading, setWsRolesLoading] = useState(false);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>('');
  const [selectedWorkspaceRole, setSelectedWorkspaceRole] = useState<string>('');

  // Registration settings state
  const [registrationSettings, setRegistrationSettings] = useState<RegistrationSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [pendingCollapsed, setPendingCollapsed] = useState(false);
  const [processingUserId, setProcessingUserId] = useState<string | null>(null);

  // Check if current user is admin
  const isAdmin = currentUser?.roles?.includes('administrator') || currentUser?.roles?.includes('admin');

  useEffect(() => {
    loadUsers();
  }, [page]);

  // Auto-refresh user list every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (!loading && !editingUser && !roleUser) {
        loadUsers(true); // silent refresh
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [loading, editingUser, roleUser]);

  useEffect(() => {
    // Load Drupal roles for the role assignment modal
    fetchDrupalRoles().then(setDrupalRoles);
    // Load workspaces and global roles for workspace role assignment
    fetchWorkspaces().then(setWorkspaces);
    fetchGlobalRoles().then(setGlobalRoles);
  }, []);

  // Load registration settings and pending users
  useEffect(() => {
    loadRegistrationSettings();
    loadPendingUsers();
  }, []);

  const loadRegistrationSettings = async () => {
    setSettingsLoading(true);
    try {
      const settings = await getRegistrationSettings();
      setRegistrationSettings(settings);
    } catch (error) {
      console.error('Failed to load registration settings:', error);
    } finally {
      setSettingsLoading(false);
    }
  };

  const loadPendingUsers = async () => {
    setPendingLoading(true);
    try {
      const response = await getPendingUsers();
      setPendingUsers(response.users);
    } catch (error) {
      console.error('Failed to load pending users:', error);
    } finally {
      setPendingLoading(false);
    }
  };

  const handleToggleApprovalSetting = async () => {
    if (!registrationSettings) return;
    setSettingsSaving(true);
    try {
      const newValue = !registrationSettings.requireApproval;
      await updateRegistrationSettings({ requireApproval: newValue });
      setRegistrationSettings({ ...registrationSettings, requireApproval: newValue });
    } catch (error) {
      console.error('Failed to update registration settings:', error);
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleApproveUser = async (userId: string) => {
    setProcessingUserId(userId);
    try {
      await approveUser(userId);
      // Remove from pending list and reload users
      setPendingUsers((prev) => prev.filter((u) => u.id !== userId));
      loadUsers(true); // Refresh user list to show newly approved user
    } catch (error) {
      console.error('Failed to approve user:', error);
    } finally {
      setProcessingUserId(null);
    }
  };

  const handleRejectUser = async (userId: string, username: string) => {
    const confirmed = await confirm({
      title: 'Reject Registration',
      message: `Are you sure you want to reject and delete the registration for "${username}"? This action cannot be undone.`,
      confirmLabel: 'Reject',
      cancelLabel: 'Cancel',
      variant: 'danger',
    });
    if (!confirmed) {
      return;
    }
    setProcessingUserId(userId);
    try {
      await rejectUser(userId);
      setPendingUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch (error) {
      console.error('Failed to reject user:', error);
    } finally {
      setProcessingUserId(null);
    }
  };

  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp * 1000) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const loadUsers = async (silent = false) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const result = await fetchUsers(page, pageSize);
      setUsers(result.users);
      setTotal(result.total);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleManualRefresh = () => {
    loadUsers(true);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadUsers();
      return;
    }
    setLoading(true);
    try {
      const { searchUsers } = await import('../lib/api/users');
      const results = await searchUsers(searchQuery);
      setUsers(results);
      setTotal(results.length);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = async (user: DrupalUser) => {
    // Fetch fresh user data
    const freshUser = await fetchUser(user.id);
    if (freshUser) {
      setEditingUser(freshUser);
      setEditForm({
        username: freshUser.username || '',
        displayName: freshUser.displayName || '',
        email: freshUser.email || '',
        bio: freshUser.bio || '',
        jobTitle: freshUser.jobTitle || '',
      });
      setEditMessage(null);
    }
  };

  const closeEditModal = () => {
    setEditingUser(null);
    setEditForm({ username: '', displayName: '', email: '', bio: '', jobTitle: '' });
    setEditMessage(null);
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;
    setEditSaving(true);
    setEditMessage(null);
    try {
      const updated = await updateUser(editingUser.id, editForm);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setEditMessage({ type: 'success', text: 'User updated successfully' });
      setTimeout(() => closeEditModal(), 1500);
    } catch (error) {
      setEditMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to update user',
      });
    } finally {
      setEditSaving(false);
    }
  };

  // Fetch user's workspace role assignments
  const fetchUserWorkspaceRoles = async (userId: string) => {
    setWsRolesLoading(true);
    try {
      // Fetch all member_role nodes for this user
      const response = await fetch(
        `${API_URL}/jsonapi/node/member_role?filter[field_member_role_user.id]=${userId}&include=field_member_role_role,field_member_role_workspace`,
        {
          headers: {
            'Accept': 'application/vnd.api+json',
            'Authorization': `Bearer ${getAccessToken()}`,
          },
        }
      );

      if (!response.ok) {
        setUserWorkspaceRoles([]);
        return;
      }

      const result = await response.json();
      if (!Array.isArray(result.data)) {
        setUserWorkspaceRoles([]);
        return;
      }

      // Transform the data
      const assignments: MemberRoleAssignment[] = result.data.map((item: Record<string, unknown>) => {
        const rels = item.relationships as Record<string, { data: { id: string } | null }> | undefined;
        const roleId = rels?.field_member_role_role?.data?.id || '';
        const workspaceId = rels?.field_member_role_workspace?.data?.id || '';

        // Find the role and workspace from included
        let roleName = '';
        let workspaceName = '';
        if (result.included) {
          const roleData = result.included.find((inc: Record<string, unknown>) => inc.id === roleId);
          if (roleData) {
            const roleAttrs = roleData.attributes as Record<string, unknown>;
            roleName = roleAttrs.title as string || '';
          }
          const workspaceData = result.included.find((inc: Record<string, unknown>) => inc.id === workspaceId);
          if (workspaceData) {
            const wsAttrs = workspaceData.attributes as Record<string, unknown>;
            workspaceName = wsAttrs.title as string || '';
          }
        }

        return {
          id: item.id as string,
          workspaceId,
          userId,
          roleId,
          role: { id: roleId, title: roleName } as WorkspaceRole,
          workspaceName,
        };
      });

      setUserWorkspaceRoles(assignments);
    } catch (error) {
      console.error('Failed to fetch user workspace roles:', error);
      setUserWorkspaceRoles([]);
    } finally {
      setWsRolesLoading(false);
    }
  };

  const openRoleModal = (user: DrupalUser) => {
    setRoleUser(user);
    setSelectedRoles(user.roles || []);
    setRoleMessage(null);
    setRoleTab('drupal');
    setSelectedWorkspace('');
    setSelectedWorkspaceRole('');
    // Fetch user's workspace roles
    fetchUserWorkspaceRoles(user.id);
  };

  const closeRoleModal = () => {
    setRoleUser(null);
    setSelectedRoles([]);
    setRoleMessage(null);
    setUserWorkspaceRoles([]);
    setRoleTab('drupal');
  };

  const handleAddWorkspaceRole = async () => {
    if (!roleUser || !selectedWorkspace || !selectedWorkspaceRole) return;

    // Check if already assigned to this workspace
    if (userWorkspaceRoles.some(r => r.workspaceId === selectedWorkspace)) {
      setRoleMessage({ type: 'error', text: 'User already has a role in this workspace' });
      return;
    }

    setRoleSaving(true);
    setRoleMessage(null);
    try {
      await createMemberRole(selectedWorkspace, roleUser.id, selectedWorkspaceRole);
      setRoleMessage({ type: 'success', text: 'Workspace role assigned successfully' });
      // Refresh the list
      await fetchUserWorkspaceRoles(roleUser.id);
      setSelectedWorkspace('');
      setSelectedWorkspaceRole('');
    } catch (error) {
      setRoleMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to assign workspace role',
      });
    } finally {
      setRoleSaving(false);
    }
  };

  const handleRemoveWorkspaceRole = async (assignmentId: string) => {
    if (!roleUser) return;
    const confirmed = await confirm({
      title: 'Remove Workspace Role',
      message: 'Are you sure you want to remove this workspace role? The user will lose access associated with this role.',
      confirmLabel: 'Remove',
      cancelLabel: 'Cancel',
      variant: 'warning',
    });
    if (!confirmed) return;

    setRoleSaving(true);
    setRoleMessage(null);
    try {
      await deleteMemberRole(assignmentId);
      setRoleMessage({ type: 'success', text: 'Workspace role removed successfully' });
      await fetchUserWorkspaceRoles(roleUser.id);
    } catch (error) {
      setRoleMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to remove workspace role',
      });
    } finally {
      setRoleSaving(false);
    }
  };

  const handleUpdateWorkspaceRole = async (assignmentId: string, newRoleId: string) => {
    if (!roleUser) return;

    setRoleSaving(true);
    setRoleMessage(null);
    try {
      await updateMemberRole(assignmentId, newRoleId);
      setRoleMessage({ type: 'success', text: 'Workspace role updated successfully' });
      await fetchUserWorkspaceRoles(roleUser.id);
    } catch (error) {
      setRoleMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to update workspace role',
      });
    } finally {
      setRoleSaving(false);
    }
  };

  const toggleRole = (roleId: string) => {
    setSelectedRoles((prev) =>
      prev.includes(roleId) ? prev.filter((r) => r !== roleId) : [...prev, roleId]
    );
  };

  const handleSaveRoles = async () => {
    if (!roleUser) return;
    setRoleSaving(true);
    setRoleMessage(null);
    try {
      const updated = await updateUserRoles(roleUser.id, selectedRoles);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setRoleMessage({ type: 'success', text: 'Roles updated successfully' });
      setTimeout(() => closeRoleModal(), 1500);
    } catch (error) {
      setRoleMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to update roles',
      });
    } finally {
      setRoleSaving(false);
    }
  };

  const handleToggleStatus = async (user: DrupalUser) => {
    const action = user.status ? 'block' : 'unblock';
    const confirmed = await confirm({
      title: `${user.status ? 'Block' : 'Unblock'} User`,
      message: `Are you sure you want to ${action} ${user.displayName}?${user.status ? ' They will not be able to log in.' : ''}`,
      confirmLabel: user.status ? 'Block' : 'Unblock',
      cancelLabel: 'Cancel',
      variant: user.status ? 'danger' : 'info',
    });
    if (!confirmed) {
      return;
    }
    try {
      const updated = await setUserStatus(user.id, !user.status);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    } catch (error) {
      console.error('Failed to toggle user status:', error);
    }
  };

  const handleDeleteUser = async (user: DrupalUser) => {
    // Prevent deletion of current user
    if (user.id === currentUser?.id) {
      return;
    }
    const confirmed = await confirm({
      title: 'Delete User',
      message: `Are you sure you want to permanently delete "${user.displayName || user.username}"? This action cannot be undone and will remove all their data.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      variant: 'danger',
    });
    if (!confirmed) {
      return;
    }
    try {
      await deleteUser(user.uid.toString());
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
    } catch (error) {
      console.error('Failed to delete user:', error);
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <MainHeader />
        <main className="container mx-auto px-4 py-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
            <Shield className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Access Denied</h2>
            <p className="text-gray-500 dark:text-gray-400">
              You need administrator privileges to access user management.
            </p>
            <Link
              to="/dashboard"
              className="mt-4 inline-block text-blue-600 dark:text-blue-400 hover:underline"
            >
              Return to Dashboard
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <MainHeader />

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Users className="h-7 w-7" />
              User Management
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Manage users, edit profiles, and assign roles
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleManualRefresh}
              disabled={refreshing || loading}
              className="px-3 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg flex items-center gap-2 disabled:opacity-50"
              title="Refresh user list"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {lastRefresh.toLocaleTimeString()}
              </span>
            </button>
            <Link
              to="/manage/roles"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Shield className="h-4 w-4" />
              Manage Roles
            </Link>
          </div>
        </div>

        {/* Search */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search by name or email..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              Search
            </button>
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  loadUsers();
                }}
                className="px-4 py-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Registration Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-6">
          <div className="flex items-center gap-3">
            <Settings className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">Registration Settings</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Control how new users can register
              </p>
            </div>
            {settingsLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            ) : (
              <label className="flex items-center gap-3 cursor-pointer">
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  Require admin approval
                </span>
                <button
                  onClick={handleToggleApprovalSetting}
                  disabled={settingsSaving}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    registrationSettings?.requireApproval
                      ? 'bg-blue-600'
                      : 'bg-gray-300 dark:bg-gray-600'
                  } ${settingsSaving ? 'opacity-50' : ''}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      registrationSettings?.requireApproval ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </label>
            )}
          </div>
        </div>

        {/* Pending Approvals */}
        {registrationSettings?.requireApproval && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 mb-6 overflow-hidden">
            <button
              onClick={() => setPendingCollapsed(!pendingCollapsed)}
              className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/30"
            >
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-amber-500" />
                <div className="text-left">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                    Pending Approvals
                    {pendingUsers.length > 0 && (
                      <span className="ml-2 px-2 py-0.5 text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full">
                        {pendingUsers.length}
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Users waiting for account approval
                  </p>
                </div>
              </div>
              {pendingCollapsed ? (
                <ChevronDown className="h-5 w-5 text-gray-400" />
              ) : (
                <ChevronUp className="h-5 w-5 text-gray-400" />
              )}
            </button>

            {!pendingCollapsed && (
              <div className="border-t border-gray-200 dark:border-gray-700">
                {pendingLoading ? (
                  <div className="p-8 text-center">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-600 mx-auto" />
                  </div>
                ) : pendingUsers.length === 0 ? (
                  <div className="p-8 text-center">
                    <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      No pending registrations
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    {pendingUsers.map((user) => (
                      <div
                        key={user.id}
                        className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/30"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center text-white font-semibold">
                            {user.firstName?.charAt(0).toUpperCase() || user.username?.charAt(0).toUpperCase() || '?'}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {user.firstName} {user.lastName}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {user.email} &bull; {formatTimeAgo(user.created)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleApproveUser(user.id)}
                            disabled={processingUserId === user.id}
                            className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-1.5"
                          >
                            {processingUserId === user.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <CheckCircle className="h-4 w-4" />
                            )}
                            Approve
                          </button>
                          <button
                            onClick={() => handleRejectUser(user.id, `${user.firstName} ${user.lastName}`)}
                            disabled={processingUserId === user.id}
                            className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-1.5"
                          >
                            <XCircle className="h-4 w-4" />
                            Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Users Table */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">Loading users...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">No users found</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        User
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Roles
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0">
                              {user.displayName?.charAt(0).toUpperCase() || user.username?.charAt(0).toUpperCase() || 'U'}
                            </div>
                            <div className="ml-3">
                              <p className="text-sm font-medium text-gray-900 dark:text-white">
                                {user.displayName || user.username}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">@{user.username}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-gray-600 dark:text-gray-300">{user.email}</p>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                            {user.roles?.length ? (
                              user.roles.map((role) => (
                                <span
                                  key={role}
                                  className={`inline-flex px-2 py-0.5 text-xs rounded-full ${
                                    role === 'administrator'
                                      ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                                  }`}
                                >
                                  {role}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-gray-400 dark:text-gray-500">No roles</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex px-2 py-1 text-xs rounded-full ${
                              user.status
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                            }`}
                          >
                            {user.status ? 'Active' : 'Blocked'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            {(canEditOtherProfiles || user.id === currentUser?.id) && (
                              <button
                                onClick={() => openEditModal(user)}
                                className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                                title="Edit user"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              onClick={() => openRoleModal(user)}
                              className="p-2 text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                              title="Manage roles"
                            >
                              <Shield className="h-4 w-4" />
                            </button>
                            {canEditOtherProfiles && (
                              <button
                                onClick={() => handleToggleStatus(user)}
                                className={`p-2 rounded-lg ${
                                  user.status
                                    ? 'text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                                    : 'text-gray-400 hover:text-green-600 dark:hover:text-green-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                                }`}
                                title={user.status ? 'Block user' : 'Unblock user'}
                              >
                                {user.status ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                              </button>
                            )}
                            {canDeleteOtherProfiles && user.uid > 1 && user.id !== currentUser?.id && (
                              <button
                                onClick={() => handleDeleteUser(user)}
                                className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                                title="Delete user"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Showing {page * pageSize + 1} to {Math.min((page + 1) * pageSize, total)} of {total} users
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={page === 0}
                      className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                      Page {page + 1} of {totalPages}
                    </span>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                      disabled={page >= totalPages - 1}
                      className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Edit User</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">@{editingUser.username}</p>
              </div>
              <button
                onClick={closeEditModal}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  value={editForm.username}
                  onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  placeholder="username"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Used for login and @mentions
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  value={editForm.displayName}
                  onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Job Title
                </label>
                <input
                  type="text"
                  value={editForm.jobTitle}
                  onChange={(e) => setEditForm({ ...editForm, jobTitle: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Bio
                </label>
                <textarea
                  value={editForm.bio}
                  onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {editMessage && (
                <div
                  className={`p-3 rounded-lg text-sm ${
                    editMessage.type === 'success'
                      ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                      : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                  }`}
                >
                  {editMessage.text}
                </div>
              )}
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={closeEditModal}
                className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={editSaving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {editSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Role Management Modal */}
      {roleUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Manage Roles</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">{roleUser.displayName}</p>
              </div>
              <button
                onClick={closeRoleModal}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 dark:border-gray-700 px-6">
              <div className="flex gap-4">
                <button
                  onClick={() => setRoleTab('drupal')}
                  className={`py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
                    roleTab === 'drupal'
                      ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Drupal Roles
                  </div>
                </button>
                <button
                  onClick={() => setRoleTab('workspace')}
                  className={`py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
                    roleTab === 'workspace'
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4" />
                    Workspace Roles
                  </div>
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {roleTab === 'drupal' ? (
                <>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Select the Drupal roles for this user. These roles control site-wide permissions.
                  </p>
                  <div className="space-y-2">
                    {drupalRoles.map((role) => (
                      <label
                        key={role.id}
                        className="flex items-center p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                      >
                        <input
                          type="checkbox"
                          checked={selectedRoles.includes(role.id)}
                          onChange={() => toggleRole(role.id)}
                          className="h-4 w-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
                        />
                        <div className="ml-3">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{role.label}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{role.id}</p>
                        </div>
                        {selectedRoles.includes(role.id) && (
                          <Check className="h-4 w-4 text-blue-600 ml-auto" />
                        )}
                      </label>
                    ))}
                    {drupalRoles.length === 0 && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                        No roles available
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Assign workspace-level roles to control permissions within specific workspaces.
                  </p>

                  {/* Current workspace role assignments */}
                  <div className="mb-6">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Current Assignments</h3>
                    {wsRolesLoading ? (
                      <div className="text-center py-4">
                        <Loader2 className="h-5 w-5 animate-spin text-blue-600 mx-auto" />
                      </div>
                    ) : userWorkspaceRoles.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        No workspace roles assigned
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {userWorkspaceRoles.map((assignment) => {
                          const workspace = workspaces.find(w => w.id === assignment.workspaceId);
                          return (
                            <div
                              key={assignment.id}
                              className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg"
                            >
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                  {(assignment as MemberRoleAssignment & { workspaceName?: string }).workspaceName || workspace?.title || 'Unknown Workspace'}
                                </p>
                                <select
                                  value={assignment.roleId}
                                  onChange={(e) => handleUpdateWorkspaceRole(assignment.id, e.target.value)}
                                  disabled={roleSaving}
                                  className="mt-1 text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200"
                                >
                                  {globalRoles.map(role => (
                                    <option key={role.id} value={role.id}>{role.title}</option>
                                  ))}
                                </select>
                              </div>
                              <button
                                onClick={() => handleRemoveWorkspaceRole(assignment.id)}
                                disabled={roleSaving}
                                className="ml-2 p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg disabled:opacity-50"
                                title="Remove assignment"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Add new workspace role */}
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Add New Assignment</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Workspace</label>
                        <select
                          value={selectedWorkspace}
                          onChange={(e) => setSelectedWorkspace(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                        >
                          <option value="">Select a workspace...</option>
                          {workspaces
                            .filter(w => !userWorkspaceRoles.some(r => r.workspaceId === w.id))
                            .map(workspace => (
                              <option key={workspace.id} value={workspace.id}>{workspace.title}</option>
                            ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Role</label>
                        <select
                          value={selectedWorkspaceRole}
                          onChange={(e) => setSelectedWorkspaceRole(e.target.value)}
                          disabled={!selectedWorkspace}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm disabled:opacity-50"
                        >
                          <option value="">Select a role...</option>
                          {globalRoles.map(role => (
                            <option key={role.id} value={role.id}>{role.title}</option>
                          ))}
                        </select>
                      </div>
                      <button
                        onClick={handleAddWorkspaceRole}
                        disabled={roleSaving || !selectedWorkspace || !selectedWorkspaceRole}
                        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {roleSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        Add Workspace Role
                      </button>
                    </div>
                  </div>
                </>
              )}

              {roleMessage && (
                <div
                  className={`mt-4 p-3 rounded-lg text-sm ${
                    roleMessage.type === 'success'
                      ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                      : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                  }`}
                >
                  {roleMessage.text}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={closeRoleModal}
                className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                {roleTab === 'drupal' ? 'Cancel' : 'Close'}
              </button>
              {roleTab === 'drupal' && (
                <button
                  onClick={handleSaveRoles}
                  disabled={roleSaving}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {roleSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                  Save Drupal Roles
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Styled Confirmation Dialog */}
      <ConfirmDialog />
    </div>
  );
}
