import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  X,
  Loader2,
  CreditCard,
  Layout,
  MessageSquare,
  CheckSquare,
  Folder,
  ChevronRight
} from 'lucide-react';
import { globalSearch, type SearchResult, type GlobalSearchResults } from '../lib/api/search';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId?: string; // Optional: filter results to specific workspace
}

type ResultCategory = 'all' | 'cards' | 'boards' | 'comments' | 'checklists';

export default function SearchModal({ isOpen, onClose, workspaceId }: SearchModalProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<GlobalSearchResults>({
    cards: [],
    boards: [],
    comments: [],
    checklists: [],
    totalResults: 0,
  });
  const [activeCategory, setActiveCategory] = useState<ResultCategory>('all');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setQuery('');
      setResults({ cards: [], boards: [], comments: [], checklists: [], totalResults: 0 });
      setActiveCategory('all');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Search with debounce
  useEffect(() => {
    if (!query.trim()) {
      setResults({ cards: [], boards: [], comments: [], checklists: [], totalResults: 0 });
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const searchResults = await globalSearch(query, workspaceId);
        setResults(searchResults);
        setSelectedIndex(0);
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, workspaceId]);

  // Get flattened list of results for keyboard navigation
  const getAllResults = useCallback((): SearchResult[] => {
    if (activeCategory === 'all') {
      return [...results.boards, ...results.cards, ...results.comments, ...results.checklists];
    }
    switch (activeCategory) {
      case 'boards': return results.boards;
      case 'cards': return results.cards;
      case 'comments': return results.comments;
      case 'checklists': return results.checklists;
      default: return [];
    }
  }, [results, activeCategory]);

  const handleResultClick = (result: SearchResult) => {
    onClose();
    setQuery('');
    setResults({ cards: [], boards: [], comments: [], checklists: [], totalResults: 0 });

    if (result.type === 'board') {
      navigate(`/board/${result.id}`);
    } else if (result.boardId) {
      // Navigate to board with card selected
      navigate(`/board/${result.boardId}?card=${result.cardId || result.id}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const allResults = getAllResults();

    switch (e.key) {
      case 'Escape':
        onClose();
        break;
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, allResults.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (allResults[selectedIndex]) {
          handleResultClick(allResults[selectedIndex]);
        }
        break;
    }
  };

  if (!isOpen) return null;

  const hasResults = results.totalResults > 0;
  const filteredResults = getAllResults();

  const categoryTabs = [
    { id: 'all' as const, label: 'All', count: results.totalResults },
    { id: 'cards' as const, label: 'Cards', count: results.cards.length },
    { id: 'boards' as const, label: 'Boards', count: results.boards.length },
    { id: 'comments' as const, label: 'Comments', count: results.comments.length },
    { id: 'checklists' as const, label: 'Checklists', count: results.checklists.length },
  ];

  const getResultIcon = (type: string) => {
    switch (type) {
      case 'board': return <Layout className="h-5 w-5 text-blue-500" />;
      case 'card': return <CreditCard className="h-5 w-5 text-gray-400" />;
      case 'comment': return <MessageSquare className="h-5 w-5 text-green-500" />;
      case 'checklist': return <CheckSquare className="h-5 w-5 text-purple-500" />;
      default: return <CreditCard className="h-5 w-5 text-gray-400" />;
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-16"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden">
        {/* Search Input */}
        <div className="flex items-center border-b px-4">
          <Search className="h-5 w-5 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={workspaceId ? "Search in this workspace..." : "Search all workspaces..."}
            className="flex-1 px-4 py-4 text-lg outline-none"
          />
          {isLoading && <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />}
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg ml-2"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Category Tabs */}
        {hasResults && (
          <div className="flex items-center gap-1 px-4 py-2 border-b bg-gray-50">
            {categoryTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveCategory(tab.id);
                  setSelectedIndex(0);
                }}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  activeCategory === tab.id
                    ? 'bg-blue-100 text-blue-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className={`ml-1.5 text-xs ${
                    activeCategory === tab.id ? 'text-blue-600' : 'text-gray-400'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Results */}
        <div className="max-h-96 overflow-y-auto">
          {!query.trim() ? (
            <div className="p-8 text-center text-gray-500">
              <Search className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>Search for cards, boards, comments, and checklists</p>
              <p className="text-sm mt-2 text-gray-400">
                {workspaceId ? 'Searching within current workspace' : 'Searching across all your workspaces'}
              </p>
            </div>
          ) : isLoading ? (
            <div className="p-8 text-center">
              <Loader2 className="h-8 w-8 mx-auto animate-spin text-gray-400" />
            </div>
          ) : !hasResults ? (
            <div className="p-8 text-center text-gray-500">
              <p>No results found for "{query}"</p>
              <p className="text-sm mt-2 text-gray-400">Try different keywords or check your spelling</p>
            </div>
          ) : (
            <div className="p-2">
              {filteredResults.map((result, index) => (
                <button
                  key={`${result.type}-${result.id}`}
                  onClick={() => handleResultClick(result)}
                  className={`w-full flex items-start px-3 py-3 rounded-lg text-left transition-colors ${
                    index === selectedIndex
                      ? 'bg-blue-50 border border-blue-200'
                      : 'hover:bg-gray-50 border border-transparent'
                  }`}
                >
                  <div className="flex-shrink-0 mt-0.5 mr-3">
                    {getResultIcon(result.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-800 truncate">{result.title}</p>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        result.type === 'board' ? 'bg-blue-100 text-blue-700' :
                        result.type === 'card' ? 'bg-gray-100 text-gray-600' :
                        result.type === 'comment' ? 'bg-green-100 text-green-700' :
                        'bg-purple-100 text-purple-700'
                      }`}>
                        {result.type}
                      </span>
                    </div>
                    {result.description && (
                      <p className="text-sm text-gray-500 truncate mt-0.5">{result.description}</p>
                    )}
                    {/* Context breadcrumb */}
                    <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                      {result.workspaceName && (
                        <>
                          <Folder className="h-3 w-3" />
                          <span>{result.workspaceName}</span>
                        </>
                      )}
                      {result.boardTitle && (
                        <>
                          <ChevronRight className="h-3 w-3" />
                          <Layout className="h-3 w-3" />
                          <span>{result.boardTitle}</span>
                        </>
                      )}
                      {result.cardTitle && result.type !== 'card' && (
                        <>
                          <ChevronRight className="h-3 w-3" />
                          <CreditCard className="h-3 w-3" />
                          <span>{result.cardTitle}</span>
                        </>
                      )}
                      {result.listTitle && result.type === 'card' && (
                        <>
                          <ChevronRight className="h-3 w-3" />
                          <span>in {result.listTitle}</span>
                        </>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-4 py-3 flex items-center justify-between text-sm text-gray-500 bg-gray-50">
          <div className="flex items-center space-x-4">
            <span>
              <kbd className="px-2 py-1 bg-white border rounded text-xs font-mono shadow-sm">↑↓</kbd> navigate
            </span>
            <span>
              <kbd className="px-2 py-1 bg-white border rounded text-xs font-mono shadow-sm">Enter</kbd> select
            </span>
            <span>
              <kbd className="px-2 py-1 bg-white border rounded text-xs font-mono shadow-sm">Tab</kbd> filter
            </span>
          </div>
          <span>
            <kbd className="px-2 py-1 bg-white border rounded text-xs font-mono shadow-sm">Esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}
