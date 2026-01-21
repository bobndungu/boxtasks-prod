import { useState, useEffect } from 'react';
import { X, Loader2, Globe, Building2, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import {
  updateTemplate,
  type CardTemplate,
  type CardLabel,
  type ChecklistTemplate,
} from '../lib/api/templates';
import { fetchWorkspaces } from '../lib/api/workspaces';
import { toast } from '../lib/stores/toast';

const AVAILABLE_LABELS: { value: CardLabel; color: string; name: string }[] = [
  { value: 'green', color: '#61bd4f', name: 'Green' },
  { value: 'yellow', color: '#f2d600', name: 'Yellow' },
  { value: 'orange', color: '#ff9f1a', name: 'Orange' },
  { value: 'red', color: '#eb5a46', name: 'Red' },
  { value: 'purple', color: '#c377e0', name: 'Purple' },
  { value: 'blue', color: '#0079bf', name: 'Blue' },
];

interface EditTemplateModalProps {
  template: CardTemplate;
  workspaceId: string;
  onClose: () => void;
  onUpdate: () => void;
}

interface Workspace {
  id: string;
  title: string;
}

export default function EditTemplateModal({
  template,
  workspaceId,
  onClose,
  onUpdate,
}: EditTemplateModalProps) {
  const [title, setTitle] = useState(template.title);
  const [description, setDescription] = useState(template.description || '');
  const [labels, setLabels] = useState<CardLabel[]>(template.labels);
  const [checklists, setChecklists] = useState<ChecklistTemplate[]>(template.checklists);
  const [scope, setScope] = useState<'global' | 'workspace'>(
    template.workspaceId ? 'workspace' : 'global'
  );
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(
    template.workspaceId || workspaceId
  );
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedChecklists, setExpandedChecklists] = useState<Set<number>>(new Set([0]));

  useEffect(() => {
    const loadWorkspaces = async () => {
      try {
        const ws = await fetchWorkspaces();
        setWorkspaces(ws);
      } catch {
        // Ignore - workspaces are optional
      }
    };
    loadWorkspaces();
  }, []);

  const handleLabelToggle = (label: CardLabel) => {
    setLabels((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );
  };

  const handleAddChecklist = () => {
    const newIndex = checklists.length;
    setChecklists([...checklists, { title: `Checklist ${newIndex + 1}`, items: [] }]);
    setExpandedChecklists((prev) => new Set([...prev, newIndex]));
  };

  const handleRemoveChecklist = (index: number) => {
    setChecklists(checklists.filter((_, i) => i !== index));
  };

  const handleChecklistTitleChange = (index: number, newTitle: string) => {
    const updated = [...checklists];
    updated[index] = { ...updated[index], title: newTitle };
    setChecklists(updated);
  };

  const handleAddChecklistItem = (checklistIndex: number) => {
    const updated = [...checklists];
    updated[checklistIndex] = {
      ...updated[checklistIndex],
      items: [...updated[checklistIndex].items, { title: '' }],
    };
    setChecklists(updated);
  };

  const handleChecklistItemChange = (checklistIndex: number, itemIndex: number, value: string) => {
    const updated = [...checklists];
    updated[checklistIndex].items[itemIndex] = { title: value };
    setChecklists(updated);
  };

  const handleRemoveChecklistItem = (checklistIndex: number, itemIndex: number) => {
    const updated = [...checklists];
    updated[checklistIndex] = {
      ...updated[checklistIndex],
      items: updated[checklistIndex].items.filter((_, i) => i !== itemIndex),
    };
    setChecklists(updated);
  };

  const toggleChecklistExpanded = (index: number) => {
    setExpandedChecklists((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('Template title is required');
      return;
    }

    // Filter out empty checklist items
    const cleanedChecklists = checklists
      .filter((c) => c.title.trim())
      .map((c) => ({
        ...c,
        items: c.items.filter((item) => item.title.trim()),
      }));

    setIsSaving(true);
    try {
      await updateTemplate(template.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        labels,
        checklists: cleanedChecklists,
        workspaceId: scope === 'workspace' ? selectedWorkspaceId || undefined : undefined,
      });
      toast.success('Template updated');
      onUpdate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update template');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between shrink-0">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Edit Template</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Template Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Enter template title"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
              placeholder="Add a description..."
            />
          </div>

          {/* Scope */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Template Scope
            </label>
            <div className="space-y-2">
              <label
                className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                  scope === 'global'
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                    : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <input
                  type="radio"
                  name="scope"
                  value="global"
                  checked={scope === 'global'}
                  onChange={() => setScope('global')}
                  className="sr-only"
                />
                <Globe className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-3" />
                <div>
                  <span className="font-medium text-gray-900 dark:text-white">Global</span>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Available in all workspaces
                  </p>
                </div>
              </label>

              <label
                className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                  scope === 'workspace'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <input
                  type="radio"
                  name="scope"
                  value="workspace"
                  checked={scope === 'workspace'}
                  onChange={() => setScope('workspace')}
                  className="sr-only"
                />
                <Building2 className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-3" />
                <div className="flex-1">
                  <span className="font-medium text-gray-900 dark:text-white">Workspace</span>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Only available in specific workspace
                  </p>
                </div>
              </label>

              {scope === 'workspace' && workspaces.length > 0 && (
                <select
                  value={selectedWorkspaceId || ''}
                  onChange={(e) => setSelectedWorkspaceId(e.target.value || null)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  {workspaces.map((ws) => (
                    <option key={ws.id} value={ws.id}>
                      {ws.title}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Labels */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Labels
            </label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_LABELS.map((label) => (
                <button
                  key={label.value}
                  type="button"
                  onClick={() => handleLabelToggle(label.value)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    labels.includes(label.value)
                      ? 'ring-2 ring-offset-2 ring-gray-400'
                      : 'opacity-60 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: label.color, color: 'white' }}
                >
                  {label.name}
                </button>
              ))}
            </div>
          </div>

          {/* Checklists */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Checklists
              </label>
              <button
                type="button"
                onClick={handleAddChecklist}
                className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
              >
                <Plus className="h-4 w-4" />
                Add Checklist
              </button>
            </div>

            <div className="space-y-3">
              {checklists.map((checklist, checklistIndex) => (
                <div
                  key={checklistIndex}
                  className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden"
                >
                  <div
                    className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 cursor-pointer"
                    onClick={() => toggleChecklistExpanded(checklistIndex)}
                  >
                    {expandedChecklists.has(checklistIndex) ? (
                      <ChevronUp className="h-4 w-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    )}
                    <input
                      type="text"
                      value={checklist.title}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleChecklistTitleChange(checklistIndex, e.target.value);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 bg-transparent border-none outline-none text-gray-900 dark:text-white font-medium"
                      placeholder="Checklist title"
                    />
                    <span className="text-xs text-gray-400">
                      {checklist.items.length} items
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveChecklist(checklistIndex);
                      }}
                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </button>
                  </div>

                  {expandedChecklists.has(checklistIndex) && (
                    <div className="p-3 space-y-2">
                      {checklist.items.map((item, itemIndex) => (
                        <div key={itemIndex} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={item.title}
                            onChange={(e) =>
                              handleChecklistItemChange(
                                checklistIndex,
                                itemIndex,
                                e.target.value
                              )
                            }
                            className="flex-1 px-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                            placeholder="Item title"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              handleRemoveChecklistItem(checklistIndex, itemIndex)
                            }
                            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
                          >
                            <X className="h-4 w-4 text-gray-400" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => handleAddChecklistItem(checklistIndex)}
                        className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 mt-2"
                      >
                        <Plus className="h-4 w-4" />
                        Add item
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {checklists.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">
                  No checklists. Click "Add Checklist" to create one.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !title.trim()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center"
          >
            {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
