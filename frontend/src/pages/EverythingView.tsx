import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../lib/stores/auth';
import {
  fetchEverythingView,
  type GlobalCard,
  type EverythingViewFilters,
  type BoardRef,
  type WorkspaceRef
} from '../lib/api/globalViews';
import { Layers, CheckCircle2, Clock, Filter, SortAsc, SortDesc, ChevronDown, ExternalLink } from 'lucide-react';
import MainHeader from '../components/MainHeader';

interface GroupedCards {
  [workspaceId: string]: {
    workspace: WorkspaceRef;
    boards: {
      [boardId: string]: {
        board: BoardRef;
        cards: GlobalCard[];
      };
    };
  };
}

function EverythingView() {
  useAuthStore();
  const [cards, setCards] = useState<GlobalCard[]>([]);
  const [boards, setBoards] = useState<BoardRef[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceRef[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filters, setFilters] = useState<EverythingViewFilters>({
    archived: '0',
    sort: 'updated',
    order: 'desc',
  });
  const [showFilters, setShowFilters] = useState(false);

  // Grouping
  const [groupBy, setGroupBy] = useState<'workspace' | 'board' | 'none'>('workspace');

  const loadCards = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchEverythingView(filters);
      setCards(response.cards);
      setBoards(response.boards);
      setWorkspaces(response.workspaces);
      setTotal(response.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cards');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  const updateFilter = <K extends keyof EverythingViewFilters>(
    key: K,
    value: EverythingViewFilters[K]
  ) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const toggleSort = () => {
    setFilters(prev => ({
      ...prev,
      order: prev.order === 'asc' ? 'desc' : 'asc',
    }));
  };

  // Group cards by workspace/board
  const groupedCards: GroupedCards = cards.reduce((acc, card) => {
    const wsId = card.workspace.id || 'unknown';
    const boardId = card.board.id || 'unknown';

    if (!acc[wsId]) {
      acc[wsId] = {
        workspace: card.workspace,
        boards: {},
      };
    }

    if (!acc[wsId].boards[boardId]) {
      acc[wsId].boards[boardId] = {
        board: card.board,
        cards: [],
      };
    }

    acc[wsId].boards[boardId].cards.push(card);
    return acc;
  }, {} as GroupedCards);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { text: `${Math.abs(diffDays)}d overdue`, class: 'text-red-600 dark:text-red-400' };
    } else if (diffDays === 0) {
      return { text: 'Today', class: 'text-amber-600 dark:text-amber-400' };
    } else if (diffDays === 1) {
      return { text: 'Tomorrow', class: 'text-amber-600 dark:text-amber-400' };
    } else if (diffDays <= 7) {
      return { text: `${diffDays}d`, class: 'text-gray-600 dark:text-gray-400' };
    } else {
      return { text: date.toLocaleDateString(), class: 'text-gray-500 dark:text-gray-500' };
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-16 md:pb-0">
      {/* Main Header */}
      <MainHeader />

      {/* Everything Page Subheader */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 md:top-16 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <Layers className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Everything</h1>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {total} cards
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                  showFilters
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
                }`}
              >
                <Filter className="h-4 w-4" />
                Filters
              </button>

              <div className="relative">
                <select
                  value={groupBy}
                  onChange={(e) => setGroupBy(e.target.value as 'workspace' | 'board' | 'none')}
                  className="appearance-none bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="workspace">Group by Workspace</option>
                  <option value="board">Group by Board</option>
                  <option value="none">No Grouping</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="py-4 border-t border-gray-200 dark:border-gray-700 flex flex-wrap gap-4">
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Workspace</label>
                <select
                  value={filters.workspace || ''}
                  onChange={(e) => updateFilter('workspace', e.target.value || undefined)}
                  className="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm"
                >
                  <option value="">All Workspaces</option>
                  {workspaces.map(ws => (
                    <option key={ws.id} value={ws.id}>{ws.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Board</label>
                <select
                  value={filters.board || ''}
                  onChange={(e) => updateFilter('board', e.target.value || undefined)}
                  className="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm"
                >
                  <option value="">All Boards</option>
                  {boards.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Due Date</label>
                <select
                  value={filters.dueDate || ''}
                  onChange={(e) => updateFilter('dueDate', e.target.value as EverythingViewFilters['dueDate'] || undefined)}
                  className="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm"
                >
                  <option value="">Any Due Date</option>
                  <option value="overdue">Overdue</option>
                  <option value="today">Due Today</option>
                  <option value="week">Due This Week</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Status</label>
                <select
                  value={filters.completed || ''}
                  onChange={(e) => updateFilter('completed', e.target.value as EverythingViewFilters['completed'] || undefined)}
                  className="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm"
                >
                  <option value="">All</option>
                  <option value="0">Active</option>
                  <option value="1">Completed</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Sort By</label>
                <div className="flex items-center gap-1">
                  <select
                    value={filters.sort || 'updated'}
                    onChange={(e) => updateFilter('sort', e.target.value as EverythingViewFilters['sort'])}
                    className="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm"
                  >
                    <option value="updated">Last Updated</option>
                    <option value="due_date">Due Date</option>
                    <option value="created">Created</option>
                    <option value="title">Title</option>
                  </select>
                  <button
                    onClick={toggleSort}
                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    {filters.order === 'asc' ? (
                      <SortAsc className="h-4 w-4" />
                    ) : (
                      <SortDesc className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : error ? (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-400">
            {error}
          </div>
        ) : cards.length === 0 ? (
          <div className="text-center py-12">
            <Layers className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No cards found</h3>
            <p className="text-gray-500 dark:text-gray-400">
              {Object.keys(filters).length > 1 ? 'Try adjusting your filters' : 'Create some cards to see them here'}
            </p>
          </div>
        ) : groupBy === 'none' ? (
          // Flat list
          <div className="space-y-2">
            {cards.map(card => (
              <CardRow key={card.id} card={card} formatDate={formatDate} />
            ))}
          </div>
        ) : (
          // Grouped view
          <div className="space-y-8">
            {Object.entries(groupedCards).map(([wsId, wsData]) => (
              <div key={wsId}>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold">
                    {wsData.workspace.name.charAt(0).toUpperCase()}
                  </span>
                  {wsData.workspace.name}
                </h2>
                {groupBy === 'workspace' ? (
                  // Group by workspace: show boards inside
                  <div className="space-y-6 ml-4">
                    {Object.entries(wsData.boards).map(([boardId, boardData]) => (
                      <div key={boardId}>
                        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                          <Link
                            to={`/board/${boardId}`}
                            className="hover:underline flex items-center gap-1"
                          >
                            {boardData.board.name}
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                          <span className="text-gray-400">({boardData.cards.length})</span>
                        </h3>
                        <div className="space-y-2">
                          {boardData.cards.map(card => (
                            <CardRow key={card.id} card={card} formatDate={formatDate} showBoard={false} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  // Group by board: just show cards
                  <div className="space-y-2 ml-4">
                    {Object.values(wsData.boards).flatMap(bd => bd.cards).map(card => (
                      <CardRow key={card.id} card={card} formatDate={formatDate} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

interface CardRowProps {
  card: GlobalCard;
  formatDate: (dateStr: string | null) => { text: string; class: string } | null;
  showBoard?: boolean;
}

function CardRow({ card, formatDate, showBoard = true }: CardRowProps) {
  const dueInfo = formatDate(card.dueDate);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {card.completed && (
              <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
            )}
            <h4 className={`font-medium truncate ${
              card.completed
                ? 'text-gray-500 dark:text-gray-500 line-through'
                : 'text-gray-900 dark:text-white'
            }`}>
              {card.title}
            </h4>
          </div>

          <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
            {showBoard && (
              <Link
                to={`/board/${card.board.id}`}
                className="hover:underline flex items-center gap-1"
              >
                {card.board.name}
              </Link>
            )}
            <span className="text-gray-300 dark:text-gray-600">•</span>
            <span>{card.list.name}</span>
          </div>

          {/* Labels */}
          {card.labels && card.labels.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {card.labels.map(label => (
                <span
                  key={label.id}
                  className="px-2 py-0.5 rounded-full text-xs font-medium text-white"
                  style={{ backgroundColor: label.color }}
                >
                  {label.name}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 flex-shrink-0">
          {/* Members */}
          {card.members && card.members.length > 0 && (
            <div className="flex -space-x-2">
              {card.members.slice(0, 3).map(member => (
                <div
                  key={member.id}
                  className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-xs font-medium border-2 border-white dark:border-gray-800"
                  title={member.displayName}
                >
                  {member.displayName.charAt(0).toUpperCase()}
                </div>
              ))}
              {card.members.length > 3 && (
                <div className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xs text-gray-600 dark:text-gray-400 border-2 border-white dark:border-gray-800">
                  +{card.members.length - 3}
                </div>
              )}
            </div>
          )}

          {/* Due date */}
          {dueInfo && (
            <div className={`flex items-center gap-1 text-sm ${dueInfo.class}`}>
              <Clock className="h-4 w-4" />
              {dueInfo.text}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default EverythingView;
