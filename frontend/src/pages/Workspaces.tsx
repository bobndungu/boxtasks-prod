import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus,
  Settings,
  Users,
  Lock,
  Globe,
  ChevronRight,
  Loader2,
  Search,
} from 'lucide-react';
import { useAuthStore } from '../lib/stores/auth';
import { useWorkspaceStore } from '../lib/stores/workspace';
import { fetchWorkspaces, createWorkspace, type Workspace, type CreateWorkspaceData } from '../lib/api/workspaces';
import MainHeader from '../components/MainHeader';

const WORKSPACE_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
];

export default function Workspaces() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { workspaces, setWorkspaces, addWorkspace, setCurrentWorkspace, isLoading, setLoading, error, setError } = useWorkspaceStore();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const loadWorkspaces = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWorkspaces();
      setWorkspaces(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workspaces');
    }
  }, [setLoading, setError, setWorkspaces]);

  useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);

  const handleWorkspaceClick = (workspace: Workspace) => {
    setCurrentWorkspace(workspace);
    navigate(`/workspace/${workspace.id}`);
  };

  const filteredWorkspaces = workspaces.filter((w) =>
    w.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getVisibilityIcon = (visibility: string) => {
    switch (visibility) {
      case 'public':
        return <Globe className="h-4 w-4" />;
      case 'team':
        return <Users className="h-4 w-4" />;
      default:
        return <Lock className="h-4 w-4" />;
    }
  };

  return (
    <div className="min-h-screen min-w-full bg-gray-50 dark:bg-[color:hsl(var(--background))]">
      <MainHeader />

      {/* Subheader with search */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 md:top-16 z-40">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Workspaces</h1>
            <div className="flex items-center space-x-4">
              <div className="hidden md:flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2 w-64">
                <Search className="h-4 w-4 text-gray-400 dark:text-gray-500 mr-2" />
                <input
                  type="text"
                  placeholder="Search workspaces..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent border-none outline-none text-sm w-full text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                />
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 flex items-center text-sm"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Workspace
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="mb-6">
          <p className="text-gray-500 dark:text-gray-400">Manage your workspaces and teams</p>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
          </div>
        ) : filteredWorkspaces.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
            <Users className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {searchQuery ? 'No workspaces found' : 'No workspaces yet'}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              {searchQuery
                ? 'Try adjusting your search'
                : 'Create your first workspace to get started'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700"
              >
                Create Workspace
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredWorkspaces.map((workspace) => (
              <div
                key={workspace.id}
                onClick={() => handleWorkspaceClick(workspace)}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md dark:hover:shadow-lg dark:hover:shadow-black/20 transition-shadow cursor-pointer group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4">
                    <div
                      className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-lg"
                      style={{ backgroundColor: workspace.color }}
                    >
                      {workspace.title.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                        {workspace.title}
                      </h3>
                      {workspace.description && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">
                          {workspace.description}
                        </p>
                      )}
                      <div className="flex items-center space-x-4 mt-2 text-xs text-gray-400 dark:text-gray-500">
                        <span className="flex items-center">
                          {getVisibilityIcon(workspace.visibility)}
                          <span className="ml-1 capitalize">{workspace.visibility}</span>
                        </span>
                        <span className="flex items-center">
                          <Users className="h-3 w-3 mr-1" />
                          {workspace.memberIds.length} members
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Link
                      to={`/workspace/${workspace.id}/settings`}
                      onClick={(e) => e.stopPropagation()}
                      className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Settings className="h-4 w-4" />
                    </Link>
                    <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create Workspace Modal */}
      {showCreateModal && (
        <CreateWorkspaceModal
          onClose={() => setShowCreateModal(false)}
          onCreate={(workspace) => {
            addWorkspace(workspace);
            setShowCreateModal(false);
          }}
          userId={user?.id || ''}
        />
      )}
    </div>
  );
}

function CreateWorkspaceModal({
  onClose,
  onCreate,
  userId,
}: {
  onClose: () => void;
  onCreate: (workspace: Workspace) => void;
  userId: string;
}) {
  const [formData, setFormData] = useState<CreateWorkspaceData>({
    title: '',
    description: '',
    visibility: 'private',
    color: WORKSPACE_COLORS[0],
  });
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setError('Workspace name is required');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const workspace = await createWorkspace(formData, userId);
      onCreate(workspace);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create workspace');
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Create Workspace</h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Workspace Name
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              placeholder="e.g., Marketing Team"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description (optional)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              rows={3}
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
                { value: 'private', label: 'Private', desc: 'Only you can see', icon: Lock },
                { value: 'team', label: 'Team', desc: 'Visible to workspace members', icon: Users },
                { value: 'public', label: 'Public', desc: 'Anyone can see', icon: Globe },
              ].map((option) => (
                <label
                  key={option.value}
                  className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                    formData.visibility === option.value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
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
                  <div>
                    <span className="font-medium text-gray-900 dark:text-white">{option.label}</span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{option.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center"
            >
              {isCreating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Create Workspace
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
