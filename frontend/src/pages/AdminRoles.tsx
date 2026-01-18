import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Shield,
  Plus,
  Edit2,
  Trash2,
  Loader2,
  X,
  Save,
  Users,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import MainHeader from '../components/MainHeader';
import { useAuthStore } from '../lib/stores/auth';
import {
  fetchGlobalRoles,
  createWorkspaceRole,
  updateWorkspaceRole,
  deleteWorkspaceRole,
  type WorkspaceRole,
  type PermissionLevel,
} from '../lib/api/roles';

// Permission categories for display
const PERMISSION_CATEGORIES = {
  cards: {
    label: 'Cards',
    permissions: [
      { key: 'cardView', label: 'View cards' },
      { key: 'cardCreate', label: 'Create cards' },
      { key: 'cardEdit', label: 'Edit cards' },
      { key: 'cardDelete', label: 'Delete cards' },
      { key: 'cardArchive', label: 'Archive cards' },
      { key: 'cardMove', label: 'Move cards' },
    ],
  },
  lists: {
    label: 'Lists',
    permissions: [
      { key: 'listView', label: 'View lists' },
      { key: 'listCreate', label: 'Create lists' },
      { key: 'listEdit', label: 'Edit lists' },
      { key: 'listDelete', label: 'Delete lists' },
    ],
  },
  boards: {
    label: 'Boards',
    permissions: [
      { key: 'boardView', label: 'View boards' },
      { key: 'boardCreate', label: 'Create boards' },
      { key: 'boardEdit', label: 'Edit boards' },
      { key: 'boardDelete', label: 'Delete boards' },
    ],
  },
  workspaces: {
    label: 'Workspaces',
    permissions: [
      { key: 'workspaceView', label: 'View workspaces' },
      { key: 'workspaceEdit', label: 'Edit workspaces' },
      { key: 'workspaceDelete', label: 'Delete workspaces' },
    ],
  },
  members: {
    label: 'Members',
    permissions: [
      { key: 'memberManage', label: 'Manage members' },
    ],
  },
  comments: {
    label: 'Comments',
    permissions: [
      { key: 'commentEdit', label: 'Edit comments' },
      { key: 'commentDelete', label: 'Delete comments' },
    ],
  },
  reports: {
    label: 'Reports',
    permissions: [
      { key: 'reportPerformance', label: 'View performance reports' },
      { key: 'reportTasks', label: 'View task reports' },
      { key: 'reportActivity', label: 'View activity reports' },
      { key: 'reportWorkload', label: 'View workload reports' },
      { key: 'reportExport', label: 'Export reports' },
    ],
  },
};

const PERMISSION_LEVELS: { value: PermissionLevel; label: string; color: string }[] = [
  { value: 'none', label: 'None', color: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400' },
  { value: 'own', label: 'Own', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' },
  { value: 'any', label: 'Any', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
];

const DEFAULT_PERMISSIONS: WorkspaceRole['permissions'] = {
  cardView: 'any',
  cardCreate: 'any',
  cardEdit: 'own',
  cardDelete: 'own',
  cardArchive: 'own',
  cardMove: 'any',
  listView: 'any',
  listCreate: 'none',
  listEdit: 'none',
  listDelete: 'none',
  boardView: 'any',
  boardCreate: 'none',
  boardEdit: 'none',
  boardDelete: 'none',
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
};

export default function AdminRoles() {
  const { user: currentUser } = useAuthStore();
  const [roles, setRoles] = useState<WorkspaceRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRole, setExpandedRole] = useState<string | null>(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState<WorkspaceRole | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formPermissions, setFormPermissions] = useState<WorkspaceRole['permissions']>(DEFAULT_PERMISSIONS);
  const [formIsDefault, setFormIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isAdmin = currentUser?.roles?.includes('administrator') || currentUser?.roles?.includes('admin');

  useEffect(() => {
    loadRoles();
  }, []);

  const loadRoles = async () => {
    setLoading(true);
    try {
      const data = await fetchGlobalRoles();
      setRoles(data);
    } catch (error) {
      console.error('Failed to load roles:', error);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingRole(null);
    setFormTitle('');
    setFormPermissions(DEFAULT_PERMISSIONS);
    setFormIsDefault(false);
    setMessage(null);
    setShowModal(true);
  };

  const openEditModal = (role: WorkspaceRole) => {
    setEditingRole(role);
    setFormTitle(role.title);
    setFormPermissions({ ...role.permissions });
    setFormIsDefault(role.isDefault);
    setMessage(null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingRole(null);
    setMessage(null);
  };

  const handleSave = async () => {
    if (!formTitle.trim()) {
      setMessage({ type: 'error', text: 'Role name is required' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      if (editingRole) {
        const updated = await updateWorkspaceRole(editingRole.id, {
          title: formTitle,
          permissions: formPermissions,
          isDefault: formIsDefault,
        });
        setRoles((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
        setMessage({ type: 'success', text: 'Role updated successfully' });
      } else {
        const created = await createWorkspaceRole(formTitle, null, formPermissions, formIsDefault);
        setRoles((prev) => [...prev, created]);
        setMessage({ type: 'success', text: 'Role created successfully' });
      }
      setTimeout(() => closeModal(), 1500);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to save role',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (role: WorkspaceRole) => {
    if (!confirm(`Are you sure you want to delete the "${role.title}" role? This cannot be undone.`)) {
      return;
    }

    try {
      await deleteWorkspaceRole(role.id);
      setRoles((prev) => prev.filter((r) => r.id !== role.id));
    } catch (error) {
      console.error('Failed to delete role:', error);
      alert('Failed to delete role. It may be in use by workspace members.');
    }
  };

  const updatePermission = (key: string, value: PermissionLevel) => {
    setFormPermissions((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const getPermissionSummary = (permissions: WorkspaceRole['permissions']) => {
    const counts = { any: 0, own: 0, none: 0 };
    Object.values(permissions).forEach((level) => {
      counts[level]++;
    });
    return counts;
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <MainHeader />
        <main className="container mx-auto px-4 py-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
            <Shield className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Access Denied</h2>
            <p className="text-gray-500 dark:text-gray-400">
              You need administrator privileges to access role management.
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
              <Shield className="h-7 w-7" />
              Role Management
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Create and manage workspace roles with custom permissions
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              to="/manage/users"
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
            >
              <Users className="h-4 w-4" />
              Manage Users
            </Link>
            <button
              onClick={openCreateModal}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Create Role
            </button>
          </div>
        </div>

        {/* Roles List */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          {loading ? (
            <div className="p-12 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">Loading roles...</p>
            </div>
          ) : roles.length === 0 ? (
            <div className="p-12 text-center">
              <Shield className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400 mb-4">No roles found</p>
              <button
                onClick={openCreateModal}
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                Create your first role
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {roles.map((role) => {
                const summary = getPermissionSummary(role.permissions);
                const isExpanded = expandedRole === role.id;

                return (
                  <div key={role.id}>
                    <div
                      className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer"
                      onClick={() => setExpandedRole(isExpanded ? null : role.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                            <Shield className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium text-gray-900 dark:text-white">{role.title}</h3>
                              {role.isDefault && (
                                <span className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">
                                  Default
                                </span>
                              )}
                            </div>
                            <div className="flex gap-3 mt-1 text-xs">
                              <span className="text-green-600 dark:text-green-400">{summary.any} any</span>
                              <span className="text-yellow-600 dark:text-yellow-400">{summary.own} own</span>
                              <span className="text-gray-400">{summary.none} none</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditModal(role);
                            }}
                            className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(role);
                            }}
                            className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          {isExpanded ? (
                            <ChevronUp className="h-5 w-5 text-gray-400" />
                          ) : (
                            <ChevronDown className="h-5 w-5 text-gray-400" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expanded Permissions View */}
                    {isExpanded && (
                      <div className="px-4 pb-4 bg-gray-50 dark:bg-gray-700/20">
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
                          {Object.entries(PERMISSION_CATEGORIES).map(([catKey, category]) => (
                            <div key={catKey} className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                              <h4 className="font-medium text-gray-900 dark:text-white text-sm mb-2">
                                {category.label}
                              </h4>
                              <div className="space-y-1.5">
                                {category.permissions.map((perm) => {
                                  const level = role.permissions[perm.key as keyof WorkspaceRole['permissions']];
                                  const levelInfo = PERMISSION_LEVELS.find((l) => l.value === level);
                                  return (
                                    <div key={perm.key} className="flex items-center justify-between text-xs">
                                      <span className="text-gray-600 dark:text-gray-400">{perm.label}</span>
                                      <span className={`px-2 py-0.5 rounded ${levelInfo?.color}`}>
                                        {levelInfo?.label}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Create/Edit Role Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingRole ? 'Edit Role' : 'Create Role'}
              </h2>
              <button
                onClick={closeModal}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {/* Role Name */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Role Name
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g., Project Manager"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Default Role Toggle */}
              <div className="mb-6">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsDefault}
                    onChange={(e) => setFormIsDefault(e.target.checked)}
                    className="h-4 w-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    Set as default role for new workspace members
                  </span>
                </label>
              </div>

              {/* Permissions */}
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white mb-4">Permissions</h3>
                <div className="grid md:grid-cols-2 gap-6">
                  {Object.entries(PERMISSION_CATEGORIES).map(([catKey, category]) => (
                    <div key={catKey} className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 dark:text-white text-sm mb-3">
                        {category.label}
                      </h4>
                      <div className="space-y-3">
                        {category.permissions.map((perm) => {
                          const currentLevel = formPermissions[perm.key as keyof WorkspaceRole['permissions']];
                          return (
                            <div key={perm.key} className="flex items-center justify-between">
                              <span className="text-sm text-gray-600 dark:text-gray-400">{perm.label}</span>
                              <div className="flex gap-1">
                                {PERMISSION_LEVELS.map((level) => (
                                  <button
                                    key={level.value}
                                    onClick={() => updatePermission(perm.key, level.value)}
                                    className={`px-2 py-1 text-xs rounded transition-colors ${
                                      currentLevel === level.value
                                        ? level.color + ' ring-2 ring-offset-1 ring-blue-500'
                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                                    }`}
                                  >
                                    {level.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {message && (
                <div
                  className={`mt-6 p-3 rounded-lg text-sm ${
                    message.type === 'success'
                      ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                      : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                  }`}
                >
                  {message.type === 'success' && <Check className="h-4 w-4 inline mr-2" />}
                  {message.text}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3 flex-shrink-0">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {editingRole ? 'Save Changes' : 'Create Role'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
