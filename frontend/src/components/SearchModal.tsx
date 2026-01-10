import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Loader2, CreditCard, Layout } from 'lucide-react';
import { search, type SearchResult } from '../lib/api/search';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<{ cards: SearchResult[]; boards: SearchResult[] }>({
    cards: [],
    boards: [],
  });

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!query.trim()) {
      setResults({ cards: [], boards: [] });
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const searchResults = await search(query);
        setResults(searchResults);
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const handleResultClick = (result: SearchResult) => {
    onClose();
    setQuery('');
    setResults({ cards: [], boards: [] });

    if (result.type === 'board') {
      navigate(`/board/${result.id}`);
    } else if (result.type === 'card' && result.listId) {
      // Navigate to board containing the card
      // For now, we'll just close - in a full implementation,
      // we'd need to know the board ID for the card
      navigate(`/dashboard`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  const hasResults = results.cards.length > 0 || results.boards.length > 0;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-20">
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
            placeholder="Search cards and boards..."
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

        {/* Results */}
        <div className="max-h-96 overflow-y-auto">
          {!query.trim() ? (
            <div className="p-8 text-center text-gray-500">
              <Search className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>Start typing to search for cards and boards</p>
            </div>
          ) : isLoading ? (
            <div className="p-8 text-center">
              <Loader2 className="h-8 w-8 mx-auto animate-spin text-gray-400" />
            </div>
          ) : !hasResults ? (
            <div className="p-8 text-center text-gray-500">
              <p>No results found for "{query}"</p>
            </div>
          ) : (
            <div className="p-4">
              {/* Boards */}
              {results.boards.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-xs font-medium text-gray-500 uppercase mb-2 px-2">Boards</h3>
                  <div className="space-y-1">
                    {results.boards.map((board) => (
                      <button
                        key={board.id}
                        onClick={() => handleResultClick(board)}
                        className="w-full flex items-center px-3 py-2 rounded-lg hover:bg-gray-100 text-left"
                      >
                        <Layout className="h-5 w-5 text-blue-500 mr-3" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-800 truncate">{board.title}</p>
                          {board.description && (
                            <p className="text-sm text-gray-500 truncate">{board.description}</p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Cards */}
              {results.cards.length > 0 && (
                <div>
                  <h3 className="text-xs font-medium text-gray-500 uppercase mb-2 px-2">Cards</h3>
                  <div className="space-y-1">
                    {results.cards.map((card) => (
                      <button
                        key={card.id}
                        onClick={() => handleResultClick(card)}
                        className="w-full flex items-center px-3 py-2 rounded-lg hover:bg-gray-100 text-left"
                      >
                        <CreditCard className="h-5 w-5 text-gray-400 mr-3" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-800 truncate">{card.title}</p>
                          {card.description && (
                            <p className="text-sm text-gray-500 truncate">{card.description}</p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-4 py-3 flex items-center justify-between text-sm text-gray-500">
          <div className="flex items-center space-x-4">
            <span>
              <kbd className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">↑↓</kbd> to navigate
            </span>
            <span>
              <kbd className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">Enter</kbd> to select
            </span>
          </div>
          <span>
            <kbd className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">Esc</kbd> to close
          </span>
        </div>
      </div>
    </div>
  );
}
