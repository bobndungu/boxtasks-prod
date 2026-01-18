import { useState, useRef, useEffect } from 'react';
import { Bookmark, Plus, Trash2, Check, Copy, ExternalLink, Filter } from 'lucide-react';
import type { ViewType } from './ViewSelector';
import type { ViewSettingsData } from './ViewSettings';
import type { FilterState } from './AdvancedFilters';

export interface SavedView {
  id: string;
  name: string;
  viewType: ViewType;
  settings: ViewSettingsData;
  filters?: FilterState;
  isDefault?: boolean;
  createdAt: string;
}

interface SavedViewsProps {
  boardId: string;
  currentView: ViewType;
  currentSettings: ViewSettingsData;
  currentFilters?: FilterState;
  savedViews: SavedView[];
  onSaveView: (name: string, isDefault: boolean, includeFilters: boolean) => void;
  onLoadView: (view: SavedView) => void;
  onDeleteView: (viewId: string) => void;
  onSetDefault: (viewId: string | null) => void;
}

export function SavedViews({
  // boardId reserved for future API integration
  currentView,
  currentSettings,
  currentFilters,
  savedViews,
  onSaveView,
  onLoadView,
  onDeleteView,
  onSetDefault,
}: SavedViewsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const [makeDefault, setMakeDefault] = useState(false);
  const [includeFilters, setIncludeFilters] = useState(true);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Check if current filters are active
  const hasActiveFilters = currentFilters && (
    currentFilters.labels.length > 0 ||
    currentFilters.members.length > 0 ||
    currentFilters.dueDateFilter !== null ||
    currentFilters.completionStatus !== null ||
    currentFilters.customFields.length > 0
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowSaveForm(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus input when showing save form
  useEffect(() => {
    if (showSaveForm && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showSaveForm]);

  const handleSaveView = () => {
    if (newViewName.trim()) {
      onSaveView(newViewName.trim(), makeDefault, includeFilters && !!hasActiveFilters);
      setNewViewName('');
      setMakeDefault(false);
      setIncludeFilters(true);
      setShowSaveForm(false);
    }
  };

  const generateShareUrl = (): string => {
    const url = new URL(window.location.href);
    url.searchParams.set('view', currentView);
    // Encode settings as base64 for sharing
    const settingsStr = btoa(JSON.stringify(currentSettings));
    url.searchParams.set('settings', settingsStr);
    return url.toString();
  };

  const handleCopyUrl = async () => {
    const url = generateShareUrl();
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  };

  const handleOpenInNewTab = () => {
    const url = generateShareUrl();
    window.open(url, '_blank');
  };

  const defaultView = savedViews.find((v) => v.isDefault);

  return (
    <div className="relative flex-shrink-0" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 sm:px-2 sm:py-1.5 rounded flex items-center gap-1"
        title="Saved Views"
      >
        <Bookmark className="h-4 w-4" />
        <span className="text-sm hidden sm:inline">Views</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-gray-800 rounded-lg shadow-lg border dark:border-gray-700 z-50">
          {/* Header */}
          <div className="px-3 py-2 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-700 rounded-t-lg">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Saved Views</h3>
          </div>

          {/* Share Current View Section */}
          <div className="p-3 border-b dark:border-gray-700">
            <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Share Current View</div>
            <div className="flex gap-2">
              <button
                onClick={handleCopyUrl}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-sm text-gray-700 dark:text-gray-300 transition-colors"
              >
                {copiedUrl ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                    <span className="text-green-600 dark:text-green-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy Link</span>
                  </>
                )}
              </button>
              <button
                onClick={handleOpenInNewTab}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-sm text-gray-700 dark:text-gray-300 transition-colors"
                title="Open in new tab"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Saved Views List */}
          <div className="max-h-60 overflow-y-auto">
            {savedViews.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                No saved views yet
              </div>
            ) : (
              <div className="py-1">
                {savedViews.map((view) => (
                  <div
                    key={view.id}
                    className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 group"
                  >
                    <button
                      onClick={() => {
                        onLoadView(view);
                        setIsOpen(false);
                      }}
                      className="flex-1 flex items-center gap-2 text-left"
                    >
                      <span className="text-sm text-gray-700 dark:text-gray-200">{view.name}</span>
                      <span className="text-xs text-gray-400 dark:text-gray-500 capitalize">({view.viewType})</span>
                      {view.filters && (
                        view.filters.labels.length > 0 ||
                        view.filters.members.length > 0 ||
                        view.filters.dueDateFilter !== null ||
                        view.filters.completionStatus !== null ||
                        view.filters.customFields.length > 0
                      ) && (
                        <span title="Has saved filters">
                          <Filter className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400" />
                        </span>
                      )}
                      {view.isDefault && (
                        <span className="text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded">
                          Default
                        </span>
                      )}
                    </button>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSetDefault(view.isDefault ? null : view.id);
                        }}
                        className={`p-1 rounded transition-colors ${
                          view.isDefault
                            ? 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30'
                            : 'text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30'
                        }`}
                        title={view.isDefault ? 'Remove as default' : 'Set as default'}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteView(view.id);
                        }}
                        className="p-1 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                        title="Delete view"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Save Current View Section */}
          <div className="border-t dark:border-gray-700 p-3">
            {showSaveForm ? (
              <div className="space-y-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={newViewName}
                  onChange={(e) => setNewViewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveView();
                    if (e.key === 'Escape') setShowSaveForm(false);
                  }}
                  placeholder="View name..."
                  className="w-full px-2 py-1.5 text-sm border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={makeDefault}
                      onChange={(e) => setMakeDefault(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                    />
                    Set as default view
                  </label>
                  {hasActiveFilters && (
                    <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeFilters}
                        onChange={(e) => setIncludeFilters(e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                      />
                      <Filter className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400" />
                      Include current filters
                    </label>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveView}
                    disabled={!newViewName.trim()}
                    className="flex-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setShowSaveForm(false);
                      setNewViewName('');
                      setMakeDefault(false);
                      setIncludeFilters(true);
                    }}
                    className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowSaveForm(true)}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Save Current View
              </button>
            )}
          </div>

          {/* Default View Info */}
          {defaultView && (
            <div className="px-3 py-2 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-700 rounded-b-lg">
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Default view: <span className="font-medium text-gray-700 dark:text-gray-200">{defaultView.name}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default SavedViews;
