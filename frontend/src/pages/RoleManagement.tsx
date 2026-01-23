import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Shield,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Save,
  X,
  Check,
  AlertCircle,
  ShieldAlert,
} from 'lucide-react';
import {
  fetchWorkspaceRoles,
  createWorkspaceRole,
  updateWorkspaceRole,
  deleteWorkspaceRole,
  type WorkspaceRole,
  type PermissionLevel,
} from '../lib/api/roles';
import MainHeader from '../components/MainHeader';
import { usePermissions } from '../lib/hooks/usePermissions';

type PermissionKey = keyof WorkspaceRole['permissions'];

interface PermissionConfig {
  key: PermissionKey;
  label: string;
  description: string;
  category: 'card' | 'list' | 'board' | 'workspace' | 'member' | 'board_member' | 'report' | 'admin' | 'custom_field' | 'automation' | 'card_fields_visibility' | 'saved_views' | 'mind_map' | 'template' | 'profile' | 'other';
  allowOwn: boolean;
}

const PERMISSION_CONFIG: PermissionConfig[] = [
  // Card permissions
  { key: 'cardView', label: 'View Cards', description: 'Can view cards', category: 'card', allowOwn: true },
  { key: 'cardCreate', label: 'Create Cards', description: 'Can create new cards', category: 'card', allowOwn: false },
  { key: 'cardEdit', label: 'Edit Cards', description: 'Can edit cards', category: 'card', allowOwn: true },
  { key: 'cardDelete', label: 'Delete Cards', description: 'Can delete cards', category: 'card', allowOwn: true },
  { key: 'cardArchive', label: 'Archive Cards', description: 'Can archive cards', category: 'card', allowOwn: true },
  { key: 'cardMove', label: 'Move Cards', description: 'Can move cards between lists', category: 'card', allowOwn: true },
  // List permissions
  { key: 'listView', label: 'View Lists', description: 'Can view lists', category: 'list', allowOwn: true },
  { key: 'listCreate', label: 'Create Lists', description: 'Can create new lists', category: 'list', allowOwn: false },
  { key: 'listEdit', label: 'Edit Lists', description: 'Can edit lists', category: 'list', allowOwn: true },
  { key: 'listDelete', label: 'Delete Lists', description: 'Can delete lists', category: 'list', allowOwn: true },
  { key: 'listArchive', label: 'Archive Lists', description: 'Can archive lists', category: 'list', allowOwn: true },
  // Board permissions
  { key: 'boardView', label: 'View Boards', description: 'Can view boards', category: 'board', allowOwn: true },
  { key: 'boardCreate', label: 'Create Boards', description: 'Can create new boards', category: 'board', allowOwn: false },
  { key: 'boardEdit', label: 'Edit Boards', description: 'Can edit boards', category: 'board', allowOwn: true },
  { key: 'boardDelete', label: 'Delete Boards', description: 'Can delete boards', category: 'board', allowOwn: true },
  { key: 'boardArchive', label: 'Archive Boards', description: 'Can archive boards', category: 'board', allowOwn: true },
  // Workspace permissions
  { key: 'workspaceView', label: 'View Workspace', description: 'Can view workspace', category: 'workspace', allowOwn: false },
  { key: 'workspaceEdit', label: 'Edit Workspace', description: 'Can edit workspace settings', category: 'workspace', allowOwn: false },
  { key: 'workspaceDelete', label: 'Delete Workspace', description: 'Can delete the workspace', category: 'workspace', allowOwn: false },
  { key: 'workspaceArchive', label: 'Archive Workspace', description: 'Can archive the workspace', category: 'workspace', allowOwn: false },
  // Workspace member permissions
  { key: 'memberView', label: 'View Members', description: 'Can view workspace members list', category: 'member', allowOwn: false },
  { key: 'memberAdd', label: 'Add Members', description: 'Can add members to workspace', category: 'member', allowOwn: false },
  { key: 'memberRemove', label: 'Remove Members', description: 'Can remove members from workspace', category: 'member', allowOwn: false },
  // Board member permissions
  { key: 'boardMemberView', label: 'View Board Members', description: 'Can view board members list', category: 'board_member', allowOwn: false },
  { key: 'boardMemberAdd', label: 'Add Board Members', description: 'Can add members to boards', category: 'board_member', allowOwn: false },
  { key: 'boardMemberRemove', label: 'Remove Board Members', description: 'Can remove members from boards', category: 'board_member', allowOwn: false },
  { key: 'boardRoleView', label: 'View Board Member Roles', description: 'Can view the roles assigned to board members', category: 'board_member', allowOwn: false },
  // Report permissions
  { key: 'reportPerformance', label: 'Performance Reports', description: 'Can view user performance reports', category: 'report', allowOwn: true },
  { key: 'reportTasks', label: 'Task Reports', description: 'Can view task duration and completion reports', category: 'report', allowOwn: true },
  { key: 'reportActivity', label: 'Activity Reports', description: 'Can view activity reports', category: 'report', allowOwn: true },
  { key: 'reportWorkload', label: 'Workload Reports', description: 'Can view workload distribution reports', category: 'report', allowOwn: true },
  { key: 'reportExport', label: 'Export Reports', description: 'Can export reports to CSV/PDF', category: 'report', allowOwn: false },
  // Admin permissions
  { key: 'roleView', label: 'View Roles', description: 'Can view workspace roles configuration', category: 'admin', allowOwn: false },
  { key: 'roleManagement', label: 'Manage Roles', description: 'Can create/edit/delete roles', category: 'admin', allowOwn: false },
  { key: 'emailTemplatesManage', label: 'Manage Email Templates', description: 'Can manage email templates', category: 'admin', allowOwn: false },
  { key: 'userManagement', label: 'Manage Users', description: 'Can manage users', category: 'admin', allowOwn: false },
  // Custom Field permissions
  { key: 'customFieldView', label: 'View Custom Fields', description: 'Can view custom field values on cards', category: 'custom_field', allowOwn: true },
  { key: 'customFieldCreate', label: 'Create Custom Fields', description: 'Can create new custom field definitions', category: 'custom_field', allowOwn: false },
  { key: 'customFieldEdit', label: 'Edit Custom Fields', description: 'Can edit custom field definitions and values', category: 'custom_field', allowOwn: true },
  { key: 'customFieldDelete', label: 'Delete Custom Fields', description: 'Can delete custom field definitions', category: 'custom_field', allowOwn: true },
  // Automation permissions
  { key: 'automationView', label: 'View Automations', description: 'Can view automation rules', category: 'automation', allowOwn: true },
  { key: 'automationCreate', label: 'Create Automations', description: 'Can create new automation rules', category: 'automation', allowOwn: false },
  { key: 'automationEdit', label: 'Edit Automations', description: 'Can edit automation rules', category: 'automation', allowOwn: true },
  { key: 'automationDelete', label: 'Delete Automations', description: 'Can delete automation rules', category: 'automation', allowOwn: true },
  // Card fields visibility permission
  { key: 'cardFieldsVisibility', label: 'Manage Card Fields Visibility', description: 'Can manage which card fields are visible', category: 'card_fields_visibility', allowOwn: false },
  // Saved views permission
  { key: 'savedViews', label: 'Manage Saved Views', description: 'Can create, edit, and delete saved board views', category: 'saved_views', allowOwn: true },
  // Mind map permissions
  { key: 'mindMapView', label: 'View Mind Maps', description: 'Can view mind maps', category: 'mind_map', allowOwn: true },
  { key: 'mindMapCreate', label: 'Create Mind Maps', description: 'Can create new mind maps', category: 'mind_map', allowOwn: false },
  { key: 'mindMapEdit', label: 'Edit Mind Maps', description: 'Can edit mind maps', category: 'mind_map', allowOwn: true },
  { key: 'mindMapDelete', label: 'Delete Mind Maps', description: 'Can delete mind maps', category: 'mind_map', allowOwn: true },
  // Template permissions
  { key: 'templateView', label: 'View Templates', description: 'Can view card templates', category: 'template', allowOwn: true },
  { key: 'templateCreate', label: 'Create Templates', description: 'Can create new card templates', category: 'template', allowOwn: false },
  { key: 'templateEdit', label: 'Edit Templates', description: 'Can edit card templates', category: 'template', allowOwn: true },
  { key: 'templateDelete', label: 'Delete Templates', description: 'Can delete card templates', category: 'template', allowOwn: true },
  // Profile permissions
  { key: 'profileView', label: 'View Profiles', description: 'Can view user profiles', category: 'profile', allowOwn: true },
  { key: 'profileEdit', label: 'Edit Profiles', description: 'Can edit user profiles', category: 'profile', allowOwn: true },
  { key: 'profileDelete', label: 'Delete Profiles', description: 'Can delete user accounts', category: 'profile', allowOwn: true },
  // Other permissions
  { key: 'memberManage', label: 'Manage Members (Legacy)', description: 'Legacy permission - use granular member permissions above', category: 'other', allowOwn: false },
  { key: 'commentEdit', label: 'Edit Comments', description: 'Can edit comments', category: 'other', allowOwn: true },
  { key: 'commentDelete', label: 'Delete Comments', description: 'Can delete comments', category: 'other', allowOwn: true },
  { key: 'commentArchive', label: 'Archive Comments', description: 'Can archive comments', category: 'other', allowOwn: true },
];

const CATEGORIES = [
  { key: 'card', label: 'Cards', color: 'blue' },
  { key: 'list', label: 'Lists', color: 'green' },
  { key: 'board', label: 'Boards', color: 'purple' },
  { key: 'workspace', label: 'Workspace', color: 'amber' },
  { key: 'member', label: 'Workspace Members', color: 'teal' },
  { key: 'board_member', label: 'Board Members', color: 'indigo' },
  { key: 'report', label: 'Reports', color: 'cyan' },
  { key: 'admin', label: 'Administration', color: 'rose' },
  { key: 'custom_field', label: 'Custom Fields', color: 'violet' },
  { key: 'automation', label: 'Automation', color: 'orange' },
  { key: 'card_fields_visibility', label: 'Card Fields Visibility', color: 'emerald' },
  { key: 'saved_views', label: 'Saved Views', color: 'sky' },
  { key: 'mind_map', label: 'Mind Maps', color: 'fuchsia' },
  { key: 'template', label: 'Templates', color: 'lime' },
  { key: 'profile', label: 'Profiles', color: 'rose' },
  { key: 'other', label: 'Other', color: 'gray' },
] as const;

const getDefaultPermissions = (): WorkspaceRole['permissions'] => ({
  cardView: 'any',
  cardCreate: 'any',
  cardEdit: 'own',
  cardDelete: 'own',
  cardArchive: 'any',
  cardMove: 'own',
  listView: 'any',
  listCreate: 'any',
  listEdit: 'own',
  listDelete: 'own',
  listArchive: 'own',
  boardView: 'any',
  boardCreate: 'none',
  boardEdit: 'none',
  boardDelete: 'none',
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
  // Legacy member management
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
  // Custom field permissions
  customFieldView: 'any',
  customFieldCreate: 'none',
  customFieldEdit: 'none',
  customFieldDelete: 'none',
  // Automation permissions
  automationView: 'any',
  automationCreate: 'none',
  automationEdit: 'none',
  automationDelete: 'none',
  // Card fields visibility permission
  cardFieldsVisibility: 'none',
  // Saved views permission
  savedViews: 'any',
  // Mind map permissions
  mindMapView: 'any',
  mindMapCreate: 'none',
  mindMapEdit: 'none',
  mindMapDelete: 'none',
  // Template permissions
  templateView: 'any',
  templateCreate: 'any',
  templateEdit: 'own',
  templateDelete: 'own',
  // Profile permissions
  profileView: 'own',
  profileEdit: 'own',
  profileDelete: 'none',
});

export default function RoleManagement() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Permission checks
  const { canViewRoles, canAccessAdminPage, loading: permissionsLoading } = usePermissions(id);
  const canManageRoles = canAccessAdminPage('roleManagement');

  const [roles, setRoles] = useState<WorkspaceRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Edit/Create modal state
  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState<WorkspaceRole | null>(null);
  const [formData, setFormData] = useState<{
    title: string;
    isDefault: boolean;
    permissions: WorkspaceRole['permissions'];
  }>({
    title: '',
    isDefault: false,
    permissions: getDefaultPermissions(),
  });

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (id) {
      loadRoles();
    }
  }, [id]);

  const loadRoles = async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const rolesList = await fetchWorkspaceRoles(id);
      setRoles(rolesList);
    } catch {
      setMessage({ type: 'error', text: 'Failed to load roles' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingRole(null);
    setFormData({
      title: '',
      isDefault: false,
      permissions: getDefaultPermissions(),
    });
    setShowModal(true);
  };

  const handleOpenEdit = (role: WorkspaceRole) => {
    setEditingRole(role);
    setFormData({
      title: role.title,
      isDefault: role.isDefault,
      permissions: { ...role.permissions },
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!id || !formData.title.trim()) {
      setMessage({ type: 'error', text: 'Role name is required' });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      if (editingRole) {
        // Update existing role
        const updated = await updateWorkspaceRole(editingRole.id, {
          title: formData.title,
          isDefault: formData.isDefault,
          permissions: formData.permissions,
        });
        setRoles(roles.map((r) => (r.id === editingRole.id ? updated : r)));
        setMessage({ type: 'success', text: 'Role updated successfully' });
      } else {
        // Create new role (workspace-specific)
        const created = await createWorkspaceRole(
          formData.title,
          id,
          formData.permissions,
          formData.isDefault
        );
        setRoles([...roles, created]);
        setMessage({ type: 'success', text: 'Role created successfully' });
      }
      setShowModal(false);
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save role' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (roleId: string) => {
    setIsDeleting(true);
    try {
      await deleteWorkspaceRole(roleId);
      setRoles(roles.filter((r) => r.id !== roleId));
      setMessage({ type: 'success', text: 'Role deleted successfully' });
      setShowDeleteConfirm(null);
    } catch {
      setMessage({ type: 'error', text: 'Failed to delete role' });
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePermissionChange = (key: PermissionKey, value: PermissionLevel) => {
    setFormData({
      ...formData,
      permissions: {
        ...formData.permissions,
        [key]: value,
      },
    });
  };

  if (isLoading || permissionsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <MainHeader />
        <div className="flex items-center justify-center pt-20">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
        </div>
      </div>
    );
  }

  // Check if user has permission to view roles
  if (!canViewRoles()) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <MainHeader />
        <div className="flex flex-col items-center justify-center pt-20 px-4">
          <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
            <ShieldAlert className="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h1>
          <p className="text-gray-500 dark:text-gray-400 text-center mb-6">
            You don't have permission to view role management for this workspace.
          </p>
          <button
            onClick={() => navigate(`/workspace/${id}/settings`)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 flex items-center"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Settings
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Main Header */}
      <MainHeader />

      {/* Subheader */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 md:top-16 z-40">
        <div className="container mx-auto px-4">
          <div className="flex items-center h-14">
            <div className="flex items-center text-gray-500 dark:text-gray-400">
              <Link to={`/workspace/${id}/settings`} className="hover:text-gray-700 dark:hover:text-gray-300">
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <span className="mx-4">/</span>
              <span className="font-medium text-gray-900 dark:text-white">Role Management</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
              <Shield className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Role Management</h1>
              <p className="text-gray-500 dark:text-gray-400">Configure roles and permissions for this workspace</p>
            </div>
          </div>
          {canManageRoles && (
            <button
              onClick={handleOpenCreate}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 flex items-center"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Role
            </button>
          )}
        </div>

        {message && (
          <div
            className={`mb-6 px-4 py-3 rounded-lg flex items-center ${
              message.type === 'success'
                ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400'
                : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400'
            }`}
          >
            {message.type === 'success' ? (
              <Check className="h-4 w-4 mr-2" />
            ) : (
              <AlertCircle className="h-4 w-4 mr-2" />
            )}
            {message.text}
          </div>
        )}

        {/* Roles List */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Available Roles</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Global roles apply to all workspaces. Workspace-specific roles only apply here.
            </p>
          </div>

          {roles.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              No roles configured. Create a role to get started.
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {roles.map((role) => (
                <div
                  key={role.id}
                  className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mr-3">
                        <Shield className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div>
                        <div className="flex items-center">
                          <span className="font-medium text-gray-900 dark:text-white">{role.title}</span>
                          {role.isDefault && (
                            <span className="ml-2 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
                              Default
                            </span>
                          )}
                          {role.workspaceId === null && (
                            <span className="ml-2 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full">
                              Global
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-2 mt-1">
                          {CATEGORIES.map((cat) => {
                            const perms = PERMISSION_CONFIG.filter((p) => p.category === cat.key);
                            const anyCount = perms.filter((p) => role.permissions[p.key] === 'any').length;
                            const ownCount = perms.filter((p) => role.permissions[p.key] === 'own').length;
                            if (anyCount === 0 && ownCount === 0) return null;
                            return (
                              <span
                                key={cat.key}
                                className={`text-xs px-1.5 py-0.5 rounded bg-${cat.color}-50 dark:bg-${cat.color}-900/30 text-${cat.color}-600 dark:text-${cat.color}-400`}
                              >
                                {cat.label}: {anyCount > 0 && `${anyCount} any`}
                                {anyCount > 0 && ownCount > 0 && ', '}
                                {ownCount > 0 && `${ownCount} own`}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    {canManageRoles && (
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleOpenEdit(role)}
                          className="p-2 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                          title="Edit role"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        {role.workspaceId !== null && (
                          <button
                            onClick={() => setShowDeleteConfirm(role.id)}
                            className="p-2 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                            title="Delete role"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Create/Edit Role Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl my-8">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {editingRole ? 'Edit Role' : 'Create Role'}
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
              {/* Role Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  Role Name
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="e.g., Project Manager"
                />
              </div>

              {/* Default Role Toggle */}
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Default Role</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Automatically assign this role to new members
                  </p>
                </div>
                <button
                  onClick={() => setFormData({ ...formData, isDefault: !formData.isDefault })}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    formData.isDefault ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      formData.isDefault ? 'translate-x-5' : ''
                    }`}
                  />
                </button>
              </div>

              {/* Permissions by Category */}
              {CATEGORIES.map((category) => (
                <div key={category.key} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <div className={`px-4 py-2 bg-${category.color}-50 dark:bg-${category.color}-900/30 border-b border-gray-200 dark:border-gray-700`}>
                    <h3 className={`font-medium text-${category.color}-700 dark:text-${category.color}-400`}>{category.label}</h3>
                  </div>
                  <div className="divide-y divide-gray-100 dark:divide-gray-700">
                    {PERMISSION_CONFIG.filter((p) => p.category === category.key).map((perm) => (
                      <div key={perm.key} className="px-4 py-3 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{perm.label}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{perm.description}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handlePermissionChange(perm.key, 'any')}
                            className={`px-3 py-1 text-sm rounded-md transition-colors ${
                              formData.permissions[perm.key] === 'any'
                                ? 'bg-green-600 text-white'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                            }`}
                          >
                            Any
                          </button>
                          {perm.allowOwn && (
                            <button
                              onClick={() => handlePermissionChange(perm.key, 'own')}
                              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                                formData.permissions[perm.key] === 'own'
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                              }`}
                            >
                              Own
                            </button>
                          )}
                          <button
                            onClick={() => handlePermissionChange(perm.key, 'none')}
                            className={`px-3 py-1 text-sm rounded-md transition-colors ${
                              formData.permissions[perm.key] === 'none'
                                ? 'bg-gray-600 text-white'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                            }`}
                          >
                            None
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    {editingRole ? 'Save Changes' : 'Create Role'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mr-3">
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Delete Role</h2>
              </div>
            </div>

            <div className="p-6">
              <p className="text-gray-600 dark:text-gray-300">
                Are you sure you want to delete this role? Members assigned to this role will need to be reassigned.
              </p>
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                disabled={isDeleting}
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
                    Delete Role
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
