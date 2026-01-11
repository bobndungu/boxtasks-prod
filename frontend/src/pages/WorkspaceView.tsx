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
} from 'lucide-react';
import { useWorkspaceStore } from '../lib/stores/workspace';
import { useBoardStore } from '../lib/stores/board';
import { BoardGridSkeleton, PageLoading } from '../components/BoardSkeleton';
import { fetchWorkspace } from '../lib/api/workspaces';
import { fetchBoardsByWorkspace, createBoard, toggleBoardStar, type Board, type CreateBoardData } from '../lib/api/boards';

const BOARD_BACKGROUNDS = [
  '#0079BF', '#D29034', '#519839', '#B04632', '#89609E',
  '#CD5A91', '#4BBF6B', '#00AECC', '#838C91', '#172B4D',
];

export default function WorkspaceView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentWorkspace, setCurrentWorkspace } = useWorkspaceStore();
  const { boards, setBoards, addBoard, updateBoard, setLoading, isLoading } = useBoardStore();

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
      <div className="min-h-screen bg-gray-50">
        <PageLoading message="Loading workspace..." />
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
              <div className="flex items-center">
                <div
                  className="w-6 h-6 rounded flex items-center justify-center text-white text-xs font-bold mr-2"
                  style={{ backgroundColor: currentWorkspace?.color || '#3B82F6' }}
                >
                  {currentWorkspace?.title?.charAt(0).toUpperCase() || 'W'}
                </div>
                <span className="font-medium text-gray-900">{currentWorkspace?.title || 'Workspace'}</span>
              </div>
            </div>
            <div className="ml-auto flex items-center space-x-2">
              <Link
                to={`/workspace/${id}/goals`}
                className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <Target className="h-5 w-5" />
                <span className="text-sm font-medium">Goals</span>
              </Link>
              <Link
                to={`/workspace/${id}/settings`}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
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
              <h1 className="text-2xl font-bold text-gray-900">{currentWorkspace?.title || 'Workspace'}</h1>
              {currentWorkspace?.description && (
                <p className="text-gray-500">{currentWorkspace.description}</p>
              )}
            </div>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 flex items-center"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Board
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Boards Grid */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Boards</h2>

          {isLoading ? (
            <BoardGridSkeleton />
          ) : boards.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <Layout className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No boards yet</h3>
              <p className="text-gray-500 mb-6">
                Create your first board to start organizing your work
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700"
              >
                Create Board
              </button>
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
              <button
                onClick={() => setShowCreateModal(true)}
                className="h-28 rounded-lg bg-gray-100 hover:bg-gray-200 border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-500 transition-colors"
              >
                <Plus className="h-5 w-5 mr-2" />
                Create new board
              </button>
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
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Create Board</h2>
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
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Board Title
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              placeholder="Enter board title"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Background
            </label>
            <div className="flex flex-wrap gap-2">
              {BOARD_BACKGROUNDS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setFormData({ ...formData, background: color })}
                  className={`w-10 h-8 rounded transition-transform ${
                    formData.background === color ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''
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
                { value: 'private', label: 'Private', desc: 'Only you can see', icon: Lock },
                { value: 'workspace', label: 'Workspace', desc: 'All workspace members', icon: Users },
                { value: 'public', label: 'Public', desc: 'Anyone with link', icon: Globe },
              ].map((option) => (
                <label
                  key={option.value}
                  className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
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
                      setFormData({ ...formData, visibility: e.target.value as 'private' | 'workspace' | 'public' })
                    }
                    className="sr-only"
                  />
                  <option.icon className="h-5 w-5 text-gray-500 mr-3" />
                  <div>
                    <span className="font-medium text-gray-900">{option.label}</span>
                    <p className="text-xs text-gray-500">{option.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium"
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
