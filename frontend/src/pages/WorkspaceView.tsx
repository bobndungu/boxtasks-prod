import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  Layout,
  Plus,
  Settings,
  Users,
  Lock,
  Globe,
  Star,
  Loader2,
  ArrowLeft,
  Target,
  Flag,
  BarChart3,
  AlertTriangle,
} from 'lucide-react';
import { useWorkspaceStore } from '../lib/stores/workspace';
import { useBoardStore } from '../lib/stores/board';
import { BoardGridSkeleton, PageLoading } from '../components/BoardSkeleton';
import { fetchWorkspace } from '../lib/api/workspaces';
import { fetchBoardsByWorkspace, createBoard, toggleBoardStar, type Board, type CreateBoardData } from '../lib/api/boards';
import { usePermissions } from '../lib/hooks/usePermissions';
import MainHeader from '../components/MainHeader';

const BOARD_BACKGROUNDS = [
  '#0079BF', '#D29034', '#519839', '#B04632', '#89609E',
  '#CD5A91', '#4BBF6B', '#00AECC', '#838C91', '#172B4D',
];

export default function WorkspaceView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentWorkspace, setCurrentWorkspace } = useWorkspaceStore();
  const { boards, setBoards, addBoard, updateBoard, setLoading, isLoading } = useBoardStore();

  // Role-based permissions for this workspace
  const { canView, canCreate, loading: permissionsLoading } = usePermissions(id);
  const canViewWorkspace = permissionsLoading ? true : canView('workspace', false);
  const canViewBoards = permissionsLoading ? true : canView('board', false);
  const canCreateBoards = permissionsLoading ? true : canCreate('board');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadWorkspaceData();
    }
  }, [id]);

  const loadWorkspaceData = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);

    try {
      // Load workspace if not already loaded
      if (!currentWorkspace || currentWorkspace.id !== id) {
        const workspace = await fetchWorkspace(id);
        setCurrentWorkspace(workspace);
      }

      // Load boards for this workspace
      const workspaceBoards = await fetchBoardsByWorkspace(id);
      setBoards(workspaceBoards);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workspace');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStar = async (board: Board, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const updated = await toggleBoardStar(board.id, !board.starred);
      updateBoard(updated);
    } catch {
      // Silent fail
    }
  };

  const handleBoardClick = (board: Board) => {
    navigate(`/board/${board.id}`);
  };

  const getVisibilityIcon = (visibility: string) => {
    switch (visibility) {
      case 'public':
        return <Globe className="h-3.5 w-3.5" />;
      case 'workspace':
        return <Users className="h-3.5 w-3.5" />;
      default:
        return <Lock className="h-3.5 w-3.5" />;
    }
  };

  if (isLoading && !currentWorkspace) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <MainHeader />
        <PageLoading message="Loading workspace..." />
      </div>
    );
  }

  // Access denied if user cannot view the workspace
  if (!canViewWorkspace) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <MainHeader />
        <div className="flex items-center justify-center pt-20">
          <div className="text-center max-w-md mx-auto p-8">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              You don&apos;t have permission to view this workspace. Contact the workspace admin to request access.
            </p>
            <Link
              to="/workspaces"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Workspaces
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Main Header */}
      <MainHeader />

      {/* Workspace Subheader */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 md:top-16 z-40">
        <div className="container mx-auto px-4">
          <div className="flex items-center h-14">
            <div className="flex items-center text-gray-500 dark:text-gray-400">
              <Link to="/workspaces" className="hover:text-gray-700 dark:hover:text-gray-300">
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <span className="mx-4">/</span>
              <div className="flex items-center">
                <div
                  className="w-6 h-6 rounded flex items-center justify-center text-white text-xs font-bold mr-2"
                  style={{ backgroundColor: currentWorkspace?.color || '#3B82F6' }}
                >
                  {currentWorkspace?.title?.charAt(0).toUpperCase() || 'W'}
                </div>
                <span className="font-medium text-gray-900 dark:text-white">{currentWorkspace?.title || 'Workspace'}</span>
              </div>
            </div>
            <div className="ml-auto flex items-center space-x-2">
              <Link
                to={`/workspace/${id}/goals`}
                className="flex items-center gap-2 px-3 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <Target className="h-5 w-5" />
                <span className="text-sm font-medium hidden sm:inline">Goals</span>
              </Link>
              <Link
                to={`/workspace/${id}/milestones`}
                className="flex items-center gap-2 px-3 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <Flag className="h-5 w-5" />
                <span className="text-sm font-medium hidden sm:inline">Milestones</span>
              </Link>
              <Link
                to={`/workspace/${id}/reports`}
                className="flex items-center gap-2 px-3 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <BarChart3 className="h-5 w-5" />
                <span className="text-sm font-medium hidden sm:inline">Reports</span>
              </Link>
              <Link
                to={`/workspace/${id}/settings`}
                className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <Settings className="h-5 w-5" />
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Workspace Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-xl"
              style={{ backgroundColor: currentWorkspace?.color || '#3B82F6' }}
            >
              {currentWorkspace?.title?.charAt(0).toUpperCase() || 'W'}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{currentWorkspace?.title || 'Workspace'}</h1>
              {currentWorkspace?.description && (
                <p className="text-gray-500 dark:text-gray-400">{currentWorkspace.description}</p>
              )}
            </div>
          </div>
          {canCreateBoards && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 flex items-center"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Board
            </button>
          )}
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Boards Grid */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Boards</h2>

          {isLoading ? (
            <BoardGridSkeleton />
          ) : boards.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
              <Layout className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {canViewBoards ? 'No boards yet' : 'No boards available'}
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6">
                {canCreateBoards
                  ? 'Create your first board to start organizing your work'
                  : 'You don\'t have permission to view boards in this workspace'}
              </p>
              {canCreateBoards && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700"
                >
                  Create Board
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {boards.map((board) => (
                <div
                  key={board.id}
                  onClick={() => handleBoardClick(board)}
                  className="group relative h-28 rounded-lg cursor-pointer overflow-hidden"
                  style={{ backgroundColor: board.background }}
                >
                  {/* Overlay */}
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors" />

                  {/* Content */}
                  <div className="relative h-full p-3 flex flex-col justify-between">
                    <div>
                      <h3 className="font-semibold text-white truncate">{board.title}</h3>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center text-white/80 text-xs">
                        {getVisibilityIcon(board.visibility)}
                      </div>
                      <button
                        onClick={(e) => handleToggleStar(board, e)}
                        className={`p-1 rounded transition-colors ${
                          board.starred
                            ? 'text-yellow-400'
                            : 'text-white/60 opacity-0 group-hover:opacity-100 hover:text-yellow-400'
                        }`}
                      >
                        <Star className={`h-4 w-4 ${board.starred ? 'fill-current' : ''}`} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Create Board Card */}
              {canCreateBoards && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="h-28 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center text-gray-500 dark:text-gray-400 transition-colors"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Create new board
                </button>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Create Board Modal */}
      {showCreateModal && (
        <CreateBoardModal
          workspaceId={id || ''}
          onClose={() => setShowCreateModal(false)}
          onCreate={(board) => {
            addBoard(board);
            setShowCreateModal(false);
          }}
        />
      )}
    </div>
  );
}

function CreateBoardModal({
  workspaceId,
  onClose,
  onCreate,
}: {
  workspaceId: string;
  onClose: () => void;
  onCreate: (board: Board) => void;
}) {
  const [formData, setFormData] = useState<CreateBoardData>({
    title: '',
    description: '',
    workspaceId,
    visibility: 'workspace',
    background: BOARD_BACKGROUNDS[0],
  });
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setError('Board title is required');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const board = await createBoard(formData);
      onCreate(board);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create board');
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Create Board</h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Preview */}
          <div
            className="h-24 rounded-lg flex items-end p-3"
            style={{ backgroundColor: formData.background }}
          >
            <span className="font-semibold text-white truncate">
              {formData.title || 'Board title'}
            </span>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
              Board Title
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              placeholder="Enter board title"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              Background
            </label>
            <div className="flex flex-wrap gap-2">
              {BOARD_BACKGROUNDS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setFormData({ ...formData, background: color })}
                  className={`w-10 h-8 rounded transition-transform ${
                    formData.background === color ? 'ring-2 ring-offset-2 ring-gray-400 dark:ring-gray-500 dark:ring-offset-gray-800 scale-110' : ''
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              Visibility
            </label>
            <div className="space-y-2">
              {[
                { value: 'private', label: 'Private', desc: 'Only you can see', icon: Lock },
                { value: 'workspace', label: 'Workspace', desc: 'All workspace members', icon: Users },
                { value: 'public', label: 'Public', desc: 'Anyone with link', icon: Globe },
              ].map((option) => (
                <label
                  key={option.value}
                  className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                    formData.visibility === option.value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                      : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="visibility"
                    value={option.value}
                    checked={formData.visibility === option.value}
                    onChange={(e) =>
                      setFormData({ ...formData, visibility: e.target.value as 'private' | 'workspace' | 'public' })
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
              Create Board
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
