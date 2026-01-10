import { useEffect, useState, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  Layout,
  ArrowLeft,
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
  UserPlus,
  Search,
  X,
} from 'lucide-react';
import { useWorkspaceStore } from '../lib/stores/workspace';
import { useAuthStore } from '../lib/stores/auth';
import {
  fetchWorkspace,
  updateWorkspace,
  deleteWorkspace,
  fetchWorkspaceMembers,
  updateWorkspaceMembers,
  searchUsers,
  type CreateWorkspaceData,
  type WorkspaceMember,
} from '../lib/api/workspaces';

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
  const [showAddMember, setShowAddMember] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<WorkspaceMember[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSavingMembers, setIsSavingMembers] = useState(false);

  useEffect(() => {
    if (id) {
      loadWorkspace();
    }
  }, [id]);

  const loadWorkspace = async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const workspace = await fetchWorkspace(id);
      setCurrentWorkspace(workspace);
      setFormData({
        title: workspace.title,
        description: workspace.description || '',
        visibility: workspace.visibility,
        color: workspace.color,
      });
      // Load members
      const membersList = await fetchWorkspaceMembers(id);
      setMembers(membersList);
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to load workspace' });
    } finally {
      setIsLoading(false);
    }
  };

  // Search for users to add
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const results = await searchUsers(query);
      // Filter out existing members
      const memberIds = new Set(members.map((m) => m.id));
      setSearchResults(results.filter((u) => !memberIds.has(u.id)));
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [members]);

  // Add a member to the workspace
  const handleAddMember = async (newMember: WorkspaceMember) => {
    if (!id) return;
    setIsSavingMembers(true);
    try {
      const newMemberIds = [...members.map((m) => m.id), newMember.id];
      const adminIds = members.filter((m) => m.isAdmin).map((m) => m.id);
      await updateWorkspaceMembers(id, newMemberIds, adminIds);
      setMembers([...members, { ...newMember, isAdmin: false }]);
      setShowAddMember(false);
      setSearchQuery('');
      setSearchResults([]);
      setMessage({ type: 'success', text: `${newMember.displayName} added to workspace` });
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to add member' });
    } finally {
      setIsSavingMembers(false);
    }
  };

  // Remove a member from the workspace
  const handleRemoveMember = async (memberId: string) => {
    if (!id) return;
    // Prevent removing the last admin
    const memberToRemove = members.find((m) => m.id === memberId);
    if (memberToRemove?.isAdmin) {
      const adminCount = members.filter((m) => m.isAdmin).length;
      if (adminCount <= 1) {
        setMessage({ type: 'error', text: 'Cannot remove the last admin' });
        return;
      }
    }
    setIsSavingMembers(true);
    try {
      const newMemberIds = members.filter((m) => m.id !== memberId).map((m) => m.id);
      const newAdminIds = members.filter((m) => m.isAdmin && m.id !== memberId).map((m) => m.id);
      await updateWorkspaceMembers(id, newMemberIds, newAdminIds);
      setMembers(members.filter((m) => m.id !== memberId));
      setMessage({ type: 'success', text: 'Member removed' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to remove member' });
    } finally {
      setIsSavingMembers(false);
    }
  };

  // Toggle admin status
  const handleToggleAdmin = async (memberId: string) => {
    if (!id) return;
    const member = members.find((m) => m.id === memberId);
    if (!member) return;

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
      const memberIds = members.map((m) => m.id);
      const newAdminIds = member.isAdmin
        ? members.filter((m) => m.isAdmin && m.id !== memberId).map((m) => m.id)
        : [...members.filter((m) => m.isAdmin).map((m) => m.id), memberId];
      await updateWorkspaceMembers(id, memberIds, newAdminIds);
      setMembers(
        members.map((m) =>
          m.id === memberId ? { ...m, isAdmin: !m.isAdmin } : m
        )
      );
      setMessage({
        type: 'success',
        text: member.isAdmin ? 'Admin privileges removed' : 'Admin privileges granted',
      });
    } catch (err) {
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
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to delete workspace' });
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4">
          <div className="flex items-center h-16">
            <Link to="/workspaces" className="flex items-center space-x-2 mr-8">
              <Layout className="h-7 w-7 text-blue-600" />
              <span className="text-xl font-bold text-gray-900">BoxTasks</span>
            </Link>
            <div className="flex items-center text-gray-500">
              <Link to="/workspaces" className="hover:text-gray-700">
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <span className="mx-4">/</span>
              <span className="font-medium text-gray-900">Workspace Settings</span>
            </div>
          </div>
        </div>
      </header>

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
            <h1 className="text-2xl font-bold text-gray-900">{formData.title || 'Workspace'}</h1>
            <p className="text-gray-500">Manage workspace settings</p>
          </div>
        </div>

        {message && (
          <div
            className={`mb-6 px-4 py-3 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-600'
                : 'bg-red-50 border border-red-200 text-red-600'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* General Settings */}
        <div className="bg-white rounded-xl border border-gray-200 mb-6">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center">
              <Settings className="h-5 w-5 text-gray-500 mr-2" />
              <h2 className="text-lg font-semibold text-gray-900">General</h2>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Workspace Name
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                placeholder="What is this workspace for?"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Color
              </label>
              <div className="flex flex-wrap gap-2">
                {WORKSPACE_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData({ ...formData, color })}
                    className={`w-8 h-8 rounded-lg transition-transform ${
                      formData.color === color ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
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
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:bg-gray-50'
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
                    <option.icon className="h-5 w-5 text-gray-500 mr-3" />
                    <span className="font-medium text-gray-900">{option.label}</span>
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

        {/* Members Section */}
        <div className="bg-white rounded-xl border border-gray-200 mb-6">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Users className="h-5 w-5 text-gray-500 mr-2" />
                <h2 className="text-lg font-semibold text-gray-900">Members</h2>
                <span className="ml-2 text-sm text-gray-500">({members.length})</span>
              </div>
              <button
                onClick={() => setShowAddMember(true)}
                className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center"
              >
                <UserPlus className="h-4 w-4 mr-1" />
                Add Member
              </button>
            </div>
          </div>

          <div className="divide-y divide-gray-100">
            {members.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                No members yet. Add members to collaborate.
              </div>
            ) : (
              members.map((member) => (
                <div
                  key={member.id}
                  className="p-4 flex items-center justify-between hover:bg-gray-50"
                >
                  <div className="flex items-center">
                    <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold mr-3">
                      {member.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center">
                        <span className="font-medium text-gray-900">
                          {member.displayName}
                        </span>
                        {member.isAdmin && (
                          <span className="ml-2 flex items-center text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                            <Crown className="h-3 w-3 mr-1" />
                            Admin
                          </span>
                        )}
                        {member.id === user?.id && (
                          <span className="ml-2 text-xs text-gray-400">(You)</span>
                        )}
                      </div>
                      {member.email && (
                        <p className="text-sm text-gray-500">{member.email}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleToggleAdmin(member.id)}
                      disabled={isSavingMembers}
                      className={`p-2 rounded-lg transition-colors ${
                        member.isAdmin
                          ? 'text-amber-600 hover:bg-amber-50'
                          : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
                      }`}
                      title={member.isAdmin ? 'Remove admin' : 'Make admin'}
                    >
                      <Crown className="h-4 w-4" />
                    </button>
                    {member.id !== user?.id && (
                      <button
                        onClick={() => handleRemoveMember(member.id)}
                        disabled={isSavingMembers}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Remove member"
                      >
                        <UserMinus className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-white rounded-xl border border-red-200">
          <div className="p-6 border-b border-red-200 bg-red-50 rounded-t-xl">
            <div className="flex items-center">
              <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
              <h2 className="text-lg font-semibold text-red-900">Danger Zone</h2>
            </div>
          </div>

          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900">Delete this workspace</h3>
                <p className="text-sm text-gray-500">
                  Once deleted, all boards and data will be permanently removed.
                </p>
              </div>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="text-red-600 hover:text-red-700 border border-red-200 px-4 py-2 rounded-lg font-medium hover:bg-red-50 flex items-center"
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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center mr-3">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Delete Workspace</h2>
              </div>
            </div>

            <div className="p-6">
              <p className="text-gray-600 mb-4">
                This action cannot be undone. This will permanently delete the
                <strong> {currentWorkspace?.title}</strong> workspace and all of its boards, cards, and data.
              </p>

              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type <strong>{currentWorkspace?.title}</strong> to confirm
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                placeholder="Enter workspace name"
              />
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmText('');
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium"
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

      {/* Add Member Modal */}
      {showAddMember && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Add Member</h2>
                <button
                  onClick={() => {
                    setShowAddMember(false);
                    setSearchQuery('');
                    setSearchResults([]);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="Search by username..."
                  autoFocus
                />
              </div>

              {isSearching && (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                </div>
              )}

              {!isSearching && searchQuery.length >= 2 && searchResults.length === 0 && (
                <div className="py-8 text-center text-gray-500">
                  No users found matching "{searchQuery}"
                </div>
              )}

              {searchResults.length > 0 && (
                <div className="mt-4 border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-64 overflow-y-auto">
                  {searchResults.map((result) => (
                    <button
                      key={result.id}
                      onClick={() => handleAddMember(result)}
                      disabled={isSavingMembers}
                      className="w-full p-3 flex items-center justify-between hover:bg-gray-50 text-left disabled:opacity-50"
                    >
                      <div className="flex items-center">
                        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold mr-3">
                          {result.displayName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {result.displayName}
                          </p>
                          {result.email && (
                            <p className="text-sm text-gray-500">{result.email}</p>
                          )}
                        </div>
                      </div>
                      <UserPlus className="h-4 w-4 text-blue-600" />
                    </button>
                  ))}
                </div>
              )}

              {searchQuery.length < 2 && searchQuery.length > 0 && (
                <div className="py-4 text-center text-gray-500 text-sm">
                  Type at least 2 characters to search
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
