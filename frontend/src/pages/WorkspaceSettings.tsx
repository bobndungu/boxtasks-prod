import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  Settings,
  Users,
  Trash2,
  Lock,
  Globe,
  Save,
  Loader2,
  AlertTriangle,
  Crown,
  UserMinus,
  Shield,
  ChevronDown,
} from 'lucide-react';
import MainHeader from '../components/MainHeader';
import { useWorkspaceStore } from '../lib/stores/workspace';
import { useAuthStore } from '../lib/stores/auth';
import {
  fetchWorkspace,
  updateWorkspace,
  deleteWorkspace,
  fetchWorkspaceMembers,
  fetchAllUsers,
  type CreateWorkspaceData,
  type WorkspaceMember,
} from '../lib/api/workspaces';
import MemberDropdown from '../components/MemberDropdown';
import {
  fetchWorkspaceRoles,
  fetchWorkspaceMemberRoles,
  createMemberRole,
  updateMemberRole,
  deleteMemberRole,
  type WorkspaceRole,
  type MemberRoleAssignment,
} from '../lib/api/roles';

// Role UUIDs for member_role creation
const ROLE_UUIDS = {
  admin: 'e22cd21b-bfe4-4058-974a-ce5f878239e0',
  editor: '5f918311-041c-4ece-ae17-46beb23f5556',
};

const WORKSPACE_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
];

export default function WorkspaceSettings() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentWorkspace, setCurrentWorkspace, updateWorkspace: updateStore, removeWorkspace } = useWorkspaceStore();
  const { user } = useAuthStore();

  const [formData, setFormData] = useState<CreateWorkspaceData>({
    title: '',
    description: '',
    visibility: 'private',
    color: '#3B82F6',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Member management state
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [allUsers, setAllUsers] = useState<WorkspaceMember[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isSavingMembers, setIsSavingMembers] = useState(false);

  // Role management state
  const [roles, setRoles] = useState<WorkspaceRole[]>([]);
  const [memberRoles, setMemberRoles] = useState<MemberRoleAssignment[]>([]);
  const [editingMemberRole, setEditingMemberRole] = useState<string | null>(null);
  const [isSavingRole, setIsSavingRole] = useState(false);

  useEffect(() => {
    if (id) {
      loadWorkspace();
    }
  }, [id]);

  const loadWorkspace = async () => {
    if (!id) return;
    setIsLoading(true);
    setIsLoadingUsers(true);
    try {
      const workspace = await fetchWorkspace(id);
      setCurrentWorkspace(workspace);
      setFormData({
        title: workspace.title,
        description: workspace.description || '',
        visibility: workspace.visibility,
        color: workspace.color,
      });
      // Load members, all users, roles and member role assignments
      const [membersList, usersList, rolesList, memberRolesList] = await Promise.all([
        fetchWorkspaceMembers(id),
        fetchAllUsers(),
        fetchWorkspaceRoles(id),
        fetchWorkspaceMemberRoles(id),
      ]);
      setMembers(membersList);
      setAllUsers(usersList);
      setRoles(rolesList);
      setMemberRoles(memberRolesList);
    } catch {
      setMessage({ type: 'error', text: 'Failed to load workspace' });
    } finally {
      setIsLoading(false);
      setIsLoadingUsers(false);
    }
  };

  // Add a member to the workspace
  const handleAddMember = async (newMember: WorkspaceMember) => {
    if (!id) return;
    setIsSavingMembers(true);
    try {
      // Create a member_role with default Editor role
      const assignment = await createMemberRole(id, newMember.id, ROLE_UUIDS.editor);
      setMembers([...members, {
        ...newMember,
        isAdmin: false,
        memberRoleId: assignment.id,
        roleName: 'Editor'
      }]);
      setMessage({ type: 'success', text: `${newMember.displayName} added to workspace` });
    } catch {
      setMessage({ type: 'error', text: 'Failed to add member' });
    } finally {
      setIsSavingMembers(false);
    }
  };

  // Remove a member from the workspace
  const handleRemoveMember = async (memberId: string) => {
    if (!id) return;
    // Find the member and their memberRoleId
    const memberToRemove = members.find((m) => m.id === memberId);
    if (!memberToRemove?.memberRoleId) {
      setMessage({ type: 'error', text: 'Cannot find member role to remove' });
      return;
    }
    // Prevent removing the last admin
    if (memberToRemove.isAdmin) {
      const adminCount = members.filter((m) => m.isAdmin).length;
      if (adminCount <= 1) {
        setMessage({ type: 'error', text: 'Cannot remove the last admin' });
        return;
      }
    }
    setIsSavingMembers(true);
    try {
      await deleteMemberRole(memberToRemove.memberRoleId);
      setMembers(members.filter((m) => m.id !== memberId));
      setMessage({ type: 'success', text: 'Member removed' });
    } catch {
      setMessage({ type: 'error', text: 'Failed to remove member' });
    } finally {
      setIsSavingMembers(false);
    }
  };

  // Get member's current role
  const getMemberRole = (memberId: string): WorkspaceRole | undefined => {
    const member = members.find((m) => m.id === memberId);
    // Try to find role assignment by memberRoleId or userId
    const assignment = memberRoles.find((mr) =>
      (member?.memberRoleId && mr.id === member.memberRoleId) || mr.userId === memberId
    );
    if (assignment?.role) return assignment.role;
    // If member has roleName, find matching role
    if (member?.roleName) {
      const matchingRole = roles.find((r) => r.title === member.roleName);
      if (matchingRole) return matchingRole;
    }
    // Return default role if no assignment
    return roles.find((r) => r.isDefault);
  };

  // Handle role change for a member
  const handleRoleChange = async (memberId: string, roleId: string) => {
    if (!id) return;
    const member = members.find((m) => m.id === memberId);
    if (!member?.memberRoleId) {
      setMessage({ type: 'error', text: 'Cannot find member role to update' });
      return;
    }

    setIsSavingRole(true);
    try {
      await updateMemberRole(member.memberRoleId, roleId);
      const newRole = roles.find((r) => r.id === roleId);
      const isAdmin = newRole?.permissions?.memberManage === 'any';

      // Update members state
      setMembers(members.map((m) =>
        m.id === memberId ? {
          ...m,
          roleName: newRole?.title || 'Member',
          isAdmin
        } : m
      ));

      // Update memberRoles state
      setMemberRoles(memberRoles.map((mr) =>
        mr.userId === memberId ? { ...mr, roleId, role: newRole } : mr
      ));

      setMessage({ type: 'success', text: 'Role updated successfully' });
    } catch {
      setMessage({ type: 'error', text: 'Failed to update role' });
    } finally {
      setIsSavingRole(false);
      setEditingMemberRole(null);
    }
  };

  // Toggle admin status
  const handleToggleAdmin = async (memberId: string) => {
    if (!id) return;
    const member = members.find((m) => m.id === memberId);
    if (!member?.memberRoleId) {
      setMessage({ type: 'error', text: 'Cannot find member role to update' });
      return;
    }

    // Prevent removing the last admin
    if (member.isAdmin) {
      const adminCount = members.filter((m) => m.isAdmin).length;
      if (adminCount <= 1) {
        setMessage({ type: 'error', text: 'Cannot remove the last admin' });
        return;
      }
    }

    setIsSavingMembers(true);
    try {
      const newRoleId = member.isAdmin ? ROLE_UUIDS.editor : ROLE_UUIDS.admin;
      await updateMemberRole(member.memberRoleId, newRoleId);
      setMembers(
        members.map((m) =>
          m.id === memberId ? {
            ...m,
            isAdmin: !m.isAdmin,
            roleName: m.isAdmin ? 'Editor' : 'Admin'
          } : m
        )
      );
      setMessage({
        type: 'success',
        text: member.isAdmin ? 'Admin privileges removed' : 'Admin privileges granted',
      });
    } catch {
      setMessage({ type: 'error', text: 'Failed to update member role' });
    } finally {
      setIsSavingMembers(false);
    }
  };

  const handleSave = async () => {
    if (!id || !formData.title.trim()) {
      setMessage({ type: 'error', text: 'Workspace name is required' });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const updated = await updateWorkspace(id, formData);
      updateStore(updated);
      setCurrentWorkspace(updated);
      setMessage({ type: 'success', text: 'Workspace updated successfully' });
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to update' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id || deleteConfirmText !== currentWorkspace?.title) return;

    setIsDeleting(true);
    try {
      await deleteWorkspace(id);
      removeWorkspace(id);
      navigate('/workspaces');
    } catch {
      setMessage({ type: 'error', text: 'Failed to delete workspace' });
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <MainHeader />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Main Header */}
      <MainHeader />

      {/* Page Title */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Workspace Settings</h1>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Workspace Header */}
        <div className="flex items-center space-x-4 mb-8">
          <div
            className="w-16 h-16 rounded-xl flex items-center justify-center text-white font-bold text-2xl"
            style={{ backgroundColor: formData.color }}
          >
            {formData.title.charAt(0).toUpperCase() || 'W'}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{formData.title || 'Workspace'}</h1>
            <p className="text-gray-500 dark:text-gray-400">Manage workspace settings</p>
          </div>
        </div>

        {message && (
          <div
            className={`mb-6 px-4 py-3 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400'
                : 'bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* General Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 mb-6">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <Settings className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-2" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">General</h2>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Workspace Name
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
                placeholder="What is this workspace for?"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Color
              </label>
              <div className="flex flex-wrap gap-2">
                {WORKSPACE_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData({ ...formData, color })}
                    className={`w-8 h-8 rounded-lg transition-transform ${
                      formData.color === color ? 'ring-2 ring-offset-2 ring-gray-400 dark:ring-gray-500 dark:ring-offset-gray-800 scale-110' : ''
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Visibility
              </label>
              <div className="space-y-2">
                {[
                  { value: 'private', label: 'Private', icon: Lock },
                  { value: 'team', label: 'Team', icon: Users },
                  { value: 'public', label: 'Public', icon: Globe },
                ].map((option) => (
                  <label
                    key={option.value}
                    className={`flex items-center p-3 rounded-lg border cursor-pointer ${
                      formData.visibility === option.value
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-600'
                        : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="visibility"
                      value={option.value}
                      checked={formData.visibility === option.value}
                      onChange={(e) =>
                        setFormData({ ...formData, visibility: e.target.value as 'private' | 'team' | 'public' })
                      }
                      className="sr-only"
                    />
                    <option.icon className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-3" />
                    <span className="font-medium text-gray-900 dark:text-white">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Roles Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 mb-6">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Shield className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-2" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Roles & Permissions</h2>
              </div>
              <Link
                to={`/workspace/${id}/roles`}
                className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 flex items-center"
              >
                <Shield className="h-4 w-4 mr-1" />
                Manage Roles
              </Link>
            </div>
          </div>
          <div className="p-6">
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
              Configure what members can do in this workspace by managing roles and permissions.
            </p>
            <div className="flex flex-wrap gap-2">
              {roles.slice(0, 3).map((role) => (
                <span
                  key={role.id}
                  className="inline-flex items-center px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-sm"
                >
                  <Shield className="h-3 w-3 mr-1.5 text-gray-500 dark:text-gray-400" />
                  {role.title}
                  {role.isDefault && (
                    <span className="ml-1 text-xs text-gray-400 dark:text-gray-500">(Default)</span>
                  )}
                </span>
              ))}
              {roles.length > 3 && (
                <span className="inline-flex items-center px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-full text-sm">
                  +{roles.length - 3} more
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Members Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 mb-6">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Users className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-2" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Members</h2>
                <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">({members.length})</span>
              </div>
              <div className="w-64">
                <MemberDropdown
                  members={allUsers}
                  excludeIds={members.map(m => m.id)}
                  onSelect={handleAddMember}
                  placeholder="Add member..."
                  buttonLabel="Add Member"
                  showSelectedInButton={false}
                  loading={isLoadingUsers}
                  disabled={isSavingMembers}
                  emptyMessage="No more users to add"
                />
              </div>
            </div>
          </div>

          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {members.length === 0 ? (
              <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                No members yet. Add members to collaborate.
              </div>
            ) : (
              members.map((member) => {
                const memberRole = getMemberRole(member.id);
                return (
                  <div
                    key={member.id}
                    className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold mr-3">
                        {member.displayName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center">
                          <span className="font-medium text-gray-900 dark:text-white">
                            {member.displayName}
                          </span>
                          {member.isAdmin && (
                            <span className="ml-2 flex items-center text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">
                              <Crown className="h-3 w-3 mr-1" />
                              Admin
                            </span>
                          )}
                          {member.id === user?.id && (
                            <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">(You)</span>
                          )}
                        </div>
                        {member.email && (
                          <p className="text-sm text-gray-500 dark:text-gray-400">{member.email}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {/* Role selector */}
                      <div className="relative">
                        <button
                          onClick={() => setEditingMemberRole(editingMemberRole === member.id ? null : member.id)}
                          disabled={isSavingRole}
                          className="flex items-center px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                        >
                          <Shield className="h-3.5 w-3.5 mr-1.5 text-gray-500 dark:text-gray-400" />
                          <span>{memberRole?.title || 'No Role'}</span>
                          <ChevronDown className="h-3.5 w-3.5 ml-1.5 text-gray-400 dark:text-gray-500" />
                        </button>
                        {editingMemberRole === member.id && (
                          <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10">
                            {roles.map((role) => (
                              <button
                                key={role.id}
                                onClick={() => handleRoleChange(member.id, role.id)}
                                className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-between ${
                                  memberRole?.id === role.id ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'
                                }`}
                              >
                                <span>{role.title}</span>
                                {role.isDefault && (
                                  <span className="text-xs text-gray-400 dark:text-gray-500">(Default)</span>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleToggleAdmin(member.id)}
                        disabled={isSavingMembers}
                        className={`p-2 rounded-lg transition-colors ${
                          member.isAdmin
                            ? 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30'
                            : 'text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300'
                        }`}
                        title={member.isAdmin ? 'Remove admin' : 'Make admin'}
                      >
                        <Crown className="h-4 w-4" />
                      </button>
                      {member.id !== user?.id && (
                        <button
                          onClick={() => handleRemoveMember(member.id)}
                          disabled={isSavingMembers}
                          className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                          title="Remove member"
                        >
                          <UserMinus className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-red-200 dark:border-red-800">
          <div className="p-6 border-b border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 rounded-t-xl">
            <div className="flex items-center">
              <AlertTriangle className="h-5 w-5 text-red-500 dark:text-red-400 mr-2" />
              <h2 className="text-lg font-semibold text-red-900 dark:text-red-300">Danger Zone</h2>
            </div>
          </div>

          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">Delete this workspace</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Once deleted, all boards and data will be permanently removed.
                </p>
              </div>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 border border-red-200 dark:border-red-800 px-4 py-2 rounded-lg font-medium hover:bg-red-50 dark:hover:bg-red-900/30 flex items-center"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Workspace
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mr-3">
                  <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Delete Workspace</h2>
              </div>
            </div>

            <div className="p-6">
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                This action cannot be undone. This will permanently delete the
                <strong className="text-gray-900 dark:text-white"> {currentWorkspace?.title}</strong> workspace and all of its boards, cards, and data.
              </p>

              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Type <strong className="text-gray-900 dark:text-white">{currentWorkspace?.title}</strong> to confirm
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
                placeholder="Enter workspace name"
              />
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmText('');
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteConfirmText !== currentWorkspace?.title || isDeleting}
                className="bg-red-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 flex items-center"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Workspace
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
