import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  GitBranch,
  Plus,
  Trash2,
  Edit2,
  Loader2,
  ChevronRight,
  X,
  MoreHorizontal,
} from 'lucide-react';
import {
  fetchMindMapsByBoard,
  createMindMap,
  updateMindMap,
  deleteMindMap,
  type MindMap,
} from '../lib/api/mindmaps';
import { toast } from '../lib/stores/toast';

interface MindMapsPanelProps {
  boardId: string;
  onClose: () => void;
}

export function MindMapsPanel({ boardId, onClose }: MindMapsPanelProps) {
  const [mindMaps, setMindMaps] = useState<MindMap[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  useEffect(() => {
    loadMindMaps();
  }, [boardId]);

  const loadMindMaps = async () => {
    try {
      setLoading(true);
      const data = await fetchMindMapsByBoard(boardId);
      setMindMaps(data);
    } catch (error) {
      console.error('Error loading mind maps:', error);
      toast.error('Failed to load mind maps');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newTitle.trim()) {
      toast.error('Please enter a title');
      return;
    }

    try {
      setCreating(true);
      const newMindMap = await createMindMap({
        title: newTitle.trim(),
        boardId,
        description: newDescription.trim() || undefined,
      });
      setMindMaps((prev) => [newMindMap, ...prev]);
      setNewTitle('');
      setNewDescription('');
      setShowCreateForm(false);
      toast.success('Mind map created');
    } catch (error) {
      console.error('Error creating mind map:', error);
      toast.error('Failed to create mind map');
    } finally {
      setCreating(false);
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editTitle.trim()) {
      toast.error('Please enter a title');
      return;
    }

    try {
      await updateMindMap(id, {
        title: editTitle.trim(),
        description: editDescription.trim() || undefined,
      });
      setMindMaps((prev) =>
        prev.map((m) =>
          m.id === id
            ? { ...m, title: editTitle.trim(), description: editDescription.trim() || '' }
            : m
        )
      );
      setEditingId(null);
      toast.success('Mind map updated');
    } catch (error) {
      console.error('Error updating mind map:', error);
      toast.error('Failed to update mind map');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this mind map?')) return;

    try {
      await deleteMindMap(id);
      setMindMaps((prev) => prev.filter((m) => m.id !== id));
      toast.success('Mind map deleted');
    } catch (error) {
      console.error('Error deleting mind map:', error);
      toast.error('Failed to delete mind map');
    }
  };

  const startEditing = (mindMap: MindMap) => {
    setEditingId(mindMap.id);
    setEditTitle(mindMap.title);
    setEditDescription(mindMap.description || '');
    setMenuOpenId(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-96 h-full bg-white dark:bg-gray-800 shadow-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-blue-600" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Mind Maps</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Create Button */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          {showCreateForm ? (
            <div className="space-y-3">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Mind map title..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Description (optional)..."
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {creating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  Create
                </button>
                <button
                  onClick={() => {
                    setShowCreateForm(false);
                    setNewTitle('');
                    setNewDescription('');
                  }}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowCreateForm(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              New Mind Map
            </button>
          )}
        </div>

        {/* Mind Maps List */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
            </div>
          ) : mindMaps.length === 0 ? (
            <div className="text-center py-8">
              <GitBranch className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400">No mind maps yet</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                Create one to start brainstorming
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {mindMaps.map((mindMap) => (
                <div
                  key={mindMap.id}
                  className="bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden"
                >
                  {editingId === mindMap.id ? (
                    <div className="p-3 space-y-3">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                        autoFocus
                      />
                      <textarea
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        placeholder="Description..."
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleUpdate(mindMap.id)}
                          className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-3 py-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3">
                      <div className="flex items-start justify-between">
                        <Link
                          to={`/board/${boardId}/mindmap/${mindMap.id}`}
                          className="flex-1 group"
                        >
                          <h3 className="font-medium text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 flex items-center gap-1">
                            {mindMap.title}
                            <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </h3>
                          {mindMap.description && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                              {mindMap.description}
                            </p>
                          )}
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                            {mindMap.nodes.length} nodes
                          </p>
                        </Link>
                        <div className="relative">
                          <button
                            onClick={() =>
                              setMenuOpenId(menuOpenId === mindMap.id ? null : mindMap.id)
                            }
                            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                          {menuOpenId === mindMap.id && (
                            <div className="absolute right-0 mt-1 w-32 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-10">
                              <button
                                onClick={() => startEditing(mindMap)}
                                className="w-full px-3 py-1.5 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                              >
                                <Edit2 className="w-3 h-3" />
                                Edit
                              </button>
                              <button
                                onClick={() => handleDelete(mindMap.id)}
                                className="w-full px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                              >
                                <Trash2 className="w-3 h-3" />
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
