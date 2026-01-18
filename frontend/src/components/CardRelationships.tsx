import { useState, useEffect } from 'react';
import { Link2, Plus, X, Search, Loader2, ArrowRight, Ban, Copy, GitBranch } from 'lucide-react';
import {
  fetchRelationshipsByCard,
  createRelationship,
  deleteRelationship,
  searchCardsForLinking,
  RELATIONSHIP_TYPE_LABELS,
  type CardRelationship,
  type RelationshipType,
} from '../lib/api/relationships';

interface CardRelationshipsProps {
  cardId: string;
  boardId?: string;
  onRelationshipsChange?: () => void;
}

const RELATIONSHIP_ICONS: Record<RelationshipType, React.ReactNode> = {
  relates_to: <Link2 className="h-3.5 w-3.5" />,
  blocks: <Ban className="h-3.5 w-3.5 text-red-500" />,
  blocked_by: <Ban className="h-3.5 w-3.5 text-orange-500" />,
  duplicates: <Copy className="h-3.5 w-3.5" />,
  duplicated_by: <Copy className="h-3.5 w-3.5" />,
  parent_of: <GitBranch className="h-3.5 w-3.5" />,
  child_of: <GitBranch className="h-3.5 w-3.5 rotate-180" />,
};

export function CardRelationships({ cardId, boardId, onRelationshipsChange }: CardRelationshipsProps) {
  const [relationships, setRelationships] = useState<CardRelationship[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ id: string; title: string; listName?: string }>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedType, setSelectedType] = useState<RelationshipType>('relates_to');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    loadRelationships();
  }, [cardId]);

  const loadRelationships = async () => {
    try {
      setIsLoading(true);
      const rels = await fetchRelationshipsByCard(cardId);
      setRelationships(rels);
    } catch (err) {
      console.error('Failed to load relationships:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const searchTimeout = setTimeout(async () => {
      try {
        setIsSearching(true);
        const results = await searchCardsForLinking(searchQuery, cardId, boardId);
        // Filter out cards that already have this relationship
        const existingTargetIds = relationships.map((r) => r.targetCardId);
        setSearchResults(results.filter((card) => !existingTargetIds.includes(card.id)));
      } catch (err) {
        console.error('Failed to search cards:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(searchTimeout);
  }, [searchQuery, cardId, boardId, relationships]);

  const handleAddRelationship = async (targetCardId: string) => {
    try {
      setIsCreating(true);
      await createRelationship(cardId, targetCardId, selectedType);
      // Fetch the full relationship with card details
      await loadRelationships();
      setSearchQuery('');
      setSearchResults([]);
      setIsAdding(false);
      onRelationshipsChange?.();
    } catch (err) {
      console.error('Failed to create relationship:', err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteRelationship = async (relationshipId: string) => {
    try {
      await deleteRelationship(relationshipId);
      setRelationships(relationships.filter((r) => r.id !== relationshipId));
      onRelationshipsChange?.();
    } catch (err) {
      console.error('Failed to delete relationship:', err);
    }
  };

  // Group relationships by type
  const groupedRelationships = relationships.reduce((acc, rel) => {
    if (!acc[rel.type]) {
      acc[rel.type] = [];
    }
    acc[rel.type].push(rel);
    return acc;
  }, {} as Record<RelationshipType, CardRelationship[]>);

  const hasBlockingRelationships = relationships.some((r) => r.type === 'blocked_by');

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
          <Link2 className="h-4 w-4" />
          Linked Cards
          {hasBlockingRelationships && (
            <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">
              Blocked
            </span>
          )}
        </h4>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            <Plus className="h-3.5 w-3.5" />
            Link card
          </button>
        )}
      </div>

      {/* Add relationship form */}
      {isAdding && (
        <div className="border rounded-lg p-3 bg-gray-50 space-y-3">
          <div className="flex items-center gap-2">
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as RelationshipType)}
              className="px-2 py-1.5 border rounded text-sm focus:outline-none focus:border-blue-500"
            >
              {(Object.entries(RELATIONSHIP_TYPE_LABELS) as [RelationshipType, string][]).map(([type, label]) => (
                <option key={type} value={type}>
                  {label}
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                setIsAdding(false);
                setSearchQuery('');
                setSearchResults([]);
              }}
              className="p-1 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for a card..."
              className="w-full pl-9 pr-3 py-1.5 border rounded text-sm focus:outline-none focus:border-blue-500"
              autoFocus
            />
            {isSearching && (
              <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 animate-spin" />
            )}
          </div>

          {/* Search results */}
          {searchResults.length > 0 && (
            <div className="border rounded bg-white max-h-48 overflow-y-auto">
              {searchResults.map((card) => (
                <button
                  key={card.id}
                  onClick={() => handleAddRelationship(card.id)}
                  disabled={isCreating}
                  className="w-full px-3 py-2 text-left hover:bg-gray-50 border-b last:border-b-0 flex items-center justify-between disabled:opacity-50"
                >
                  <div>
                    <div className="text-sm font-medium text-gray-900">{card.title}</div>
                    {card.listName && (
                      <div className="text-xs text-gray-500">in {card.listName}</div>
                    )}
                  </div>
                  {isCreating ? (
                    <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              ))}
            </div>
          )}

          {searchQuery && !isSearching && searchResults.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-2">No cards found</p>
          )}
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />
        </div>
      )}

      {/* Existing relationships */}
      {!isLoading && relationships.length === 0 && !isAdding && (
        <p className="text-sm text-gray-500 dark:text-gray-400">No linked cards</p>
      )}

      {!isLoading && relationships.length > 0 && (
        <div className="space-y-3">
          {(Object.entries(groupedRelationships) as [RelationshipType, CardRelationship[]][]).map(
            ([type, rels]) => (
              <div key={type} className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600 uppercase tracking-wide">
                  {RELATIONSHIP_ICONS[type]}
                  {RELATIONSHIP_TYPE_LABELS[type]}
                  <span className="text-gray-400">({rels.length})</span>
                </div>
                <div className="space-y-1">
                  {rels.map((rel) => (
                    <div
                      key={rel.id}
                      className={`flex items-center justify-between px-2 py-1.5 rounded group ${
                        type === 'blocked_by'
                          ? 'bg-orange-50 border border-orange-200'
                          : type === 'blocks'
                          ? 'bg-red-50 border border-red-200'
                          : 'bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <ArrowRight className="h-3 w-3 text-gray-400 flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {rel.targetCard?.title || 'Unknown card'}
                          </div>
                          {rel.targetCard?.listName && (
                            <div className="text-xs text-gray-500">in {rel.targetCard.listName}</div>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteRelationship(rel.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-600 flex-shrink-0"
                        title="Remove link"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

export default CardRelationships;
