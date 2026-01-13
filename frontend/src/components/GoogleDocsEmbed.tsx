import { useState } from 'react';
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
} from 'lucide-react';
import { toast } from '../lib/stores/toast';

export interface GoogleDoc {
  url: string;
  title: string;
}

interface GoogleDocsEmbedProps {
  docs: GoogleDoc[];
  onAdd: (url: string, title: string) => Promise<void>;
  onRemove: (url: string) => Promise<void>;
  canEdit: boolean;
}

// Detect Google Doc type from URL
function getGoogleDocType(url: string): 'doc' | 'sheet' | 'slide' | 'form' | 'unknown' {
  if (url.includes('docs.google.com/document')) return 'doc';
  if (url.includes('docs.google.com/spreadsheets') || url.includes('sheets.google.com')) return 'sheet';
  if (url.includes('docs.google.com/presentation')) return 'slide';
  if (url.includes('docs.google.com/forms')) return 'form';
  return 'unknown';
}

// Get embed URL from Google Doc URL
function getEmbedUrl(url: string): string {
  const docType = getGoogleDocType(url);

  try {
    const urlObj = new URL(url);

    // Extract document ID
    const pathParts = urlObj.pathname.split('/');
    const dIndex = pathParts.indexOf('d');
    if (dIndex === -1 || dIndex >= pathParts.length - 1) return '';

    const docId = pathParts[dIndex + 1];

    switch (docType) {
      case 'doc':
        return `https://docs.google.com/document/d/${docId}/preview`;
      case 'sheet':
        return `https://docs.google.com/spreadsheets/d/${docId}/preview`;
      case 'slide':
        return `https://docs.google.com/presentation/d/${docId}/embed`;
      case 'form':
        return `https://docs.google.com/forms/d/${docId}/viewform?embedded=true`;
      default:
        return '';
    }
  } catch {
    return '';
  }
}

// Get icon for doc type
function DocIcon({ type, className }: { type: string; className?: string }) {
  switch (type) {
    case 'doc':
      return <FileText className={className} style={{ color: '#4285f4' }} />;
    case 'sheet':
      return <Sheet className={className} style={{ color: '#0f9d58' }} />;
    case 'slide':
      return <Presentation className={className} style={{ color: '#f4b400' }} />;
    default:
      return <FileText className={className} style={{ color: '#666' }} />;
  }
}

export function GoogleDocsEmbed({ docs, onAdd, onRemove, canEdit }: GoogleDocsEmbedProps) {
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

    // Validate Google Docs URL
    const docType = getGoogleDocType(newUrl);
    if (docType === 'unknown') {
      toast.error('Please enter a valid Google Docs, Sheets, or Slides URL');
      return;
    }

    try {
      setSaving(true);
      const title = newTitle.trim() || 'Google Document';
      await onAdd(newUrl.trim(), title);
      setNewUrl('');
      setNewTitle('');
      setShowAddForm(false);
      toast.success('Google Doc added');
    } catch (error) {
      console.error('Error adding Google Doc:', error);
      toast.error('Failed to add Google Doc');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (url: string) => {
    if (!confirm('Remove this Google Doc?')) return;

    try {
      await onRemove(url);
      toast.success('Google Doc removed');
    } catch (error) {
      console.error('Error removing Google Doc:', error);
      toast.error('Failed to remove Google Doc');
    }
  };

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full text-left"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          <FileText className="w-4 h-4" />
          Google Docs
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
              No Google Docs attached
            </p>
          ) : (
            <div className="space-y-2">
              {docs.map((doc) => {
                const docType = getGoogleDocType(doc.url);
                const embedUrl = getEmbedUrl(doc.url);
                const isExpanded = expandedDoc === doc.url;

                return (
                  <div
                    key={doc.url}
                    className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
                  >
                    <div className="flex items-center justify-between p-3">
                      <button
                        onClick={() => setExpandedDoc(isExpanded ? null : doc.url)}
                        className="flex items-center gap-2 flex-1 text-left"
                      >
                        <DocIcon type={docType} className="w-5 h-5" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {doc.title}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        )}
                      </button>
                      <div className="flex items-center gap-1">
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
                        Google Doc URL
                      </label>
                      <input
                        type="url"
                        value={newUrl}
                        onChange={(e) => setNewUrl(e.target.value)}
                        placeholder="https://docs.google.com/document/d/..."
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
                  Add Google Doc
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
