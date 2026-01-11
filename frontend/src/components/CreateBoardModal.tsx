import { useState, useEffect } from 'react';
import { Loader2, Lock, Users, Globe, X } from 'lucide-react';
import { createBoard, type Board, type CreateBoardData } from '../lib/api/boards';
import { useWorkspaceStore } from '../lib/stores/workspace';

const BOARD_BACKGROUNDS = [
  '#0079BF', '#D29034', '#519839', '#B04632', '#89609E',
  '#CD5A91', '#4BBF6B', '#00AECC', '#838C91', '#172B4D',
];

interface CreateBoardModalProps {
  workspaceId?: string;
  onClose: () => void;
  onCreate: (board: Board) => void;
}

export default function CreateBoardModal({
  workspaceId,
  onClose,
  onCreate,
}: CreateBoardModalProps) {
  const { workspaces } = useWorkspaceStore();
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(workspaceId || '');
  const [formData, setFormData] = useState<Omit<CreateBoardData, 'workspaceId'>>({
    title: '',
    description: '',
    visibility: 'workspace',
    background: BOARD_BACKGROUNDS[0],
  });
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Set default workspace if not provided
  useEffect(() => {
    if (!workspaceId && workspaces.length > 0 && !selectedWorkspaceId) {
      setSelectedWorkspaceId(workspaces[0].id);
    }
  }, [workspaceId, workspaces, selectedWorkspaceId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setError('Board title is required');
      return;
    }
    if (!selectedWorkspaceId) {
      setError('Please select a workspace');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const board = await createBoard({
        ...formData,
        workspaceId: selectedWorkspaceId,
      });
      onCreate(board);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create board');
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Create Board</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          </button>
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

          {/* Workspace Selector (only show if no workspaceId prop) */}
          {!workspaceId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Workspace
              </label>
              <select
                value={selectedWorkspaceId}
                onChange={(e) => setSelectedWorkspaceId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Select a workspace</option>
                {workspaces.map((ws) => (
                  <option key={ws.id} value={ws.id}>
                    {ws.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Board Title
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Enter board title"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
              disabled={isCreating || !selectedWorkspaceId}
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
