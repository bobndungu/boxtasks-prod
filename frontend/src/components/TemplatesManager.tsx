import { useState, useEffect } from 'react';
import {
  X,
  Loader2,
  Search,
  Archive,
  RotateCcw,
  Trash2,
  Edit3,
  Globe,
  Building2,
  LayoutGrid,
  FileText,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  fetchTemplates,
  fetchArchivedTemplates,
  archiveTemplate,
  restoreTemplate,
  deleteTemplate,
  type CardTemplate,
} from '../lib/api/templates';
import { toast } from '../lib/stores/toast';
import { usePermissions } from '../lib/hooks/usePermissions';
import { useAuthStore } from '../lib/stores/auth';
import EditTemplateModal from './EditTemplateModal';

interface TemplatesManagerProps {
  workspaceId: string;
  boardId?: string;
  onClose: () => void;
}

export default function TemplatesManager({ workspaceId, boardId, onClose }: TemplatesManagerProps) {
  const { user } = useAuthStore();
  const { canTemplate } = usePermissions(workspaceId);
  const [templates, setTemplates] = useState<CardTemplate[]>([]);
  const [archivedTemplates, setArchivedTemplates] = useState<CardTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<CardTemplate | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const loadTemplates = async () => {
    setIsLoading(true);
    try {
      const [active, archived] = await Promise.all([
        fetchTemplates({ workspaceId }),
        fetchArchivedTemplates(workspaceId),
      ]);
      setTemplates(active);
      setArchivedTemplates(archived);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load templates');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, [workspaceId]);

  const handleArchive = async (template: CardTemplate) => {
    try {
      await archiveTemplate(template.id);
      toast.success(`Template "${template.title}" archived`);
      await loadTemplates();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to archive template');
    }
  };

  const handleRestore = async (template: CardTemplate) => {
    try {
      await restoreTemplate(template.id);
      toast.success(`Template "${template.title}" restored`);
      await loadTemplates();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to restore template');
    }
  };

  const handleDelete = async (template: CardTemplate) => {
    setDeletingId(template.id);
    try {
      await deleteTemplate(template.id);
      toast.success(`Template "${template.title}" deleted`);
      setShowDeleteConfirm(null);
      await loadTemplates();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete template');
    } finally {
      setDeletingId(null);
    }
  };

  const isOwner = (template: CardTemplate) => template.authorId === user?.id;

  const canEditTemplate = (template: CardTemplate) => canTemplate('edit', isOwner(template));
  const canDeleteTemplate = (template: CardTemplate) => canTemplate('delete', isOwner(template));

  const displayedTemplates = showArchived ? archivedTemplates : templates;
  const filteredTemplates = displayedTemplates.filter((t) =>
    t.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between shrink-0">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Manage Templates</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Search & Filters */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 space-y-3 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search templates..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <button
            onClick={() => setShowArchived(!showArchived)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              showArchived
                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {showArchived ? (
              <>
                <Eye className="h-4 w-4" />
                Showing Archived
              </>
            ) : (
              <>
                <EyeOff className="h-4 w-4" />
                Show Archived ({archivedTemplates.length})
              </>
            )}
          </button>
        </div>

        {/* Template List */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400">
                {searchQuery
                  ? 'No templates match your search'
                  : showArchived
                  ? 'No archived templates'
                  : 'No templates yet'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTemplates.map((template) => (
                <div
                  key={template.id}
                  className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900 dark:text-white truncate">
                          {template.title}
                        </h3>
                        {template.boardId ? (
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs rounded-full">
                            <LayoutGrid className="h-3 w-3" />
                            Board
                          </span>
                        ) : template.workspaceId ? (
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded-full">
                            <Building2 className="h-3 w-3" />
                            Workspace
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs rounded-full">
                            <Globe className="h-3 w-3" />
                            Global
                          </span>
                        )}
                        {template.archived && (
                          <span className="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 text-xs rounded-full">
                            Archived
                          </span>
                        )}
                      </div>
                      {template.description && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                          {template.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                        {template.labels.length > 0 && (
                          <span>{template.labels.length} labels</span>
                        )}
                        {template.checklists.length > 0 && (
                          <span>{template.checklists.length} checklists</span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      {canEditTemplate(template) && (
                        <button
                          onClick={() => setEditingTemplate(template)}
                          className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                          title="Edit template"
                        >
                          <Edit3 className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                        </button>
                      )}

                      {canEditTemplate(template) && (
                        <button
                          onClick={() =>
                            template.archived
                              ? handleRestore(template)
                              : handleArchive(template)
                          }
                          className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                          title={template.archived ? 'Restore template' : 'Archive template'}
                        >
                          {template.archived ? (
                            <RotateCcw className="h-4 w-4 text-green-500" />
                          ) : (
                            <Archive className="h-4 w-4 text-yellow-500" />
                          )}
                        </button>
                      )}

                      {canDeleteTemplate(template) && (
                        <>
                          {showDeleteConfirm === template.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleDelete(template)}
                                disabled={deletingId === template.id}
                                className="p-2 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 rounded transition-colors"
                                title="Confirm delete"
                              >
                                {deletingId === template.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin text-red-500" />
                                ) : (
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                )}
                              </button>
                              <button
                                onClick={() => setShowDeleteConfirm(null)}
                                className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                                title="Cancel"
                              >
                                <X className="h-4 w-4 text-gray-500" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setShowDeleteConfirm(template.id)}
                              className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                              title="Delete template"
                            >
                              <Trash2 className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 shrink-0">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium"
          >
            Close
          </button>
        </div>
      </div>

      {/* Edit Template Modal */}
      {editingTemplate && (
        <EditTemplateModal
          template={editingTemplate}
          workspaceId={workspaceId}
          boardId={boardId}
          onClose={() => setEditingTemplate(null)}
          onUpdate={() => {
            setEditingTemplate(null);
            loadTemplates();
          }}
        />
      )}
    </div>
  );
}
