import { useState } from 'react';
import { useConfirmDialog } from '../lib/hooks/useConfirmDialog';
import {
  FileText,
  Sheet,
  Presentation,
  Plus,
  Trash2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Loader2,
  Check,
  Eye,
  StickyNote,
} from 'lucide-react';
import { toast } from '../lib/stores/toast';

export interface SharePointDoc {
  url: string;
  title: string;
}

interface SharePointDocsEmbedProps {
  docs: SharePointDoc[];
  onAdd: (url: string, title: string) => Promise<void>;
  onRemove: (url: string) => Promise<void>;
  canEdit: boolean;
}

type SharePointDocType = 'word' | 'excel' | 'powerpoint' | 'onenote' | 'pdf' | 'generic';

// Detect SharePoint doc type from URL
function getSharePointDocType(url: string): SharePointDocType {
  const lower = url.toLowerCase();
  // Sharing link patterns: /:w:/ = Word, /:x:/ = Excel, /:p:/ = PowerPoint, /:o:/ = OneNote
  if (lower.includes('/:w:/') || lower.includes('.docx') || lower.includes('.doc')) return 'word';
  if (lower.includes('/:x:/') || lower.includes('.xlsx') || lower.includes('.xls')) return 'excel';
  if (lower.includes('/:p:/') || lower.includes('.pptx') || lower.includes('.ppt')) return 'powerpoint';
  if (lower.includes('/:o:/') || lower.includes('.one')) return 'onenote';
  if (lower.includes('.pdf')) return 'pdf';
  return 'generic';
}

// Check if the URL is a valid SharePoint URL
function isSharePointUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const host = urlObj.hostname.toLowerCase();
    return host.includes('.sharepoint.com') || host.includes('sharepoint.com');
  } catch {
    return false;
  }
}

// Get embed URL for SharePoint documents
function getEmbedUrl(url: string): string {
  try {
    const urlObj = new URL(url);

    // For sharing links (e.g., /:w:/s/site/docid), add action=embedview
    if (/\/:(w|x|p|o):\//.test(urlObj.pathname)) {
      // Append or replace action parameter
      urlObj.searchParams.set('action', 'embedview');
      return urlObj.toString();
    }

    // For direct file URLs, use the Office Online viewer
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
  } catch {
    return '';
  }
}

// Get icon for doc type
function DocIcon({ type, className }: { type: SharePointDocType; className?: string }) {
  switch (type) {
    case 'word':
      return <FileText className={className} style={{ color: '#2b579a' }} />;
    case 'excel':
      return <Sheet className={className} style={{ color: '#217346' }} />;
    case 'powerpoint':
      return <Presentation className={className} style={{ color: '#b7472a' }} />;
    case 'onenote':
      return <StickyNote className={className} style={{ color: '#7719aa' }} />;
    case 'pdf':
      return <FileText className={className} style={{ color: '#d32f2f' }} />;
    default:
      return <FileText className={className} style={{ color: '#0078d4' }} />;
  }
}

// Get label for doc type
function getDocTypeLabel(type: SharePointDocType): string {
  switch (type) {
    case 'word': return 'Word';
    case 'excel': return 'Excel';
    case 'powerpoint': return 'PowerPoint';
    case 'onenote': return 'OneNote';
    case 'pdf': return 'PDF';
    default: return 'Document';
  }
}

export function SharePointDocsEmbed({ docs, onAdd, onRemove, canEdit }: SharePointDocsEmbedProps) {
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const [expanded, setExpanded] = useState(docs.length > 0);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!newUrl.trim()) {
      toast.error('Please enter a URL');
      return;
    }

    if (!isSharePointUrl(newUrl)) {
      toast.error('Please enter a valid SharePoint URL (must contain .sharepoint.com)');
      return;
    }

    try {
      setSaving(true);
      const title = newTitle.trim() || `SharePoint ${getDocTypeLabel(getSharePointDocType(newUrl))}`;
      await onAdd(newUrl.trim(), title);
      setNewUrl('');
      setNewTitle('');
      setShowAddForm(false);
      toast.success('SharePoint document added');
    } catch (error) {
      console.error('Error adding SharePoint doc:', error);
      toast.error('Failed to add SharePoint document');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (url: string) => {
    const confirmed = await confirm({
      title: 'Remove SharePoint Document',
      message: 'Are you sure you want to remove this SharePoint document from the card?',
      confirmLabel: 'Remove',
      variant: 'danger',
    });
    if (!confirmed) return;

    try {
      await onRemove(url);
      toast.success('SharePoint document removed');
    } catch (error) {
      console.error('Error removing SharePoint doc:', error);
      toast.error('Failed to remove SharePoint document');
    }
  };

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full text-left"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          <FileText className="w-4 h-4" style={{ color: '#0078d4' }} />
          SharePoint Docs
          {docs.length > 0 && (
            <span className="px-1.5 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
              {docs.length}
            </span>
          )}
        </span>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </button>

      {expanded && (
        <div className="mt-4 space-y-3">
          {/* Docs List */}
          {docs.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
              No SharePoint documents attached
            </p>
          ) : (
            <div className="space-y-2">
              {docs.map((doc) => {
                const docType = getSharePointDocType(doc.url);
                const embedUrl = getEmbedUrl(doc.url);
                const isExpanded = expandedDoc === doc.url;

                return (
                  <div
                    key={doc.url}
                    className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
                  >
                    <div className="flex items-center justify-between p-3">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <DocIcon type={docType} className="w-5 h-5 flex-shrink-0" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {doc.title}
                        </span>
                        <span className="text-xs text-gray-400 flex-shrink-0">
                          {getDocTypeLabel(docType)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {embedUrl && (
                          <button
                            onClick={() => setExpandedDoc(isExpanded ? null : doc.url)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                            title="Preview"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                          title="Open in new tab"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                        {canEdit && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemove(doc.url);
                            }}
                            className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                            title="Remove"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Embedded Preview */}
                    {isExpanded && embedUrl && (
                      <div className="border-t border-gray-200 dark:border-gray-700">
                        <iframe
                          src={embedUrl}
                          className="w-full h-96 bg-white"
                          title={doc.title}
                          frameBorder="0"
                          allowFullScreen
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Add Form */}
          {canEdit && (
            <>
              {showAddForm ? (
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                        SharePoint URL
                      </label>
                      <input
                        type="url"
                        value={newUrl}
                        onChange={(e) => setNewUrl(e.target.value)}
                        placeholder="https://company.sharepoint.com/:w:/s/site/..."
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                        Title (optional)
                      </label>
                      <input
                        type="text"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        placeholder="My Document"
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setShowAddForm(false);
                          setNewUrl('');
                          setNewTitle('');
                        }}
                        className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleAdd}
                        disabled={saving || !newUrl.trim()}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                      >
                        {saving ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Check className="w-3 h-3" />
                        )}
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm border border-dashed border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 rounded-lg hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400"
                >
                  <Plus className="w-4 h-4" />
                  Add SharePoint Document
                </button>
              )}
            </>
          )}
        </div>
      )}
      <ConfirmDialog />
    </div>
  );
}
