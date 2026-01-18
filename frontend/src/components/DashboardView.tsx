import { useMemo } from 'react';
import {
  LayoutDashboard,
  CheckCircle2,
  Clock,
  AlertCircle,
  List as ListIcon,
  TrendingUp,
  Tag,
} from 'lucide-react';
import type { Card, CardLabel } from '../lib/api/cards';
import type { BoardList } from '../lib/api/lists';
import { formatDateShort } from '../lib/utils/date';

interface DashboardSettings {
  showCardsPerList: boolean;
  showCardsPerLabel: boolean;
  showOverdueCards: boolean;
  showDueSoonCards: boolean;
}

interface DashboardViewProps {
  cards: Card[];
  lists: BoardList[];
  onCardClick: (card: Card) => void;
  settings?: DashboardSettings;
}

const LABEL_COLORS: Record<CardLabel, { bg: string; bar: string }> = {
  green: { bg: 'bg-green-100', bar: 'bg-green-500' },
  yellow: { bg: 'bg-yellow-100', bar: 'bg-yellow-500' },
  orange: { bg: 'bg-orange-100', bar: 'bg-orange-500' },
  red: { bg: 'bg-red-100', bar: 'bg-red-500' },
  purple: { bg: 'bg-purple-100', bar: 'bg-purple-500' },
  blue: { bg: 'bg-blue-100', bar: 'bg-blue-500' },
};

const DEFAULT_SETTINGS: DashboardSettings = {
  showCardsPerList: true,
  showCardsPerLabel: true,
  showOverdueCards: true,
  showDueSoonCards: true,
};

export function DashboardView({ cards, lists, onCardClick, settings = DEFAULT_SETTINGS }: DashboardViewProps) {
  // Calculate statistics
  const stats = useMemo(() => {
    const total = cards.length;
    const completed = cards.filter((c) => c.completed).length;
    const now = new Date();
    const overdue = cards.filter(
      (c) => c.dueDate && !c.completed && new Date(c.dueDate) < now
    ).length;
    const dueSoon = cards.filter((c) => {
      if (!c.dueDate || c.completed) return false;
      const due = new Date(c.dueDate);
      const threeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      return due >= now && due <= threeDays;
    }).length;
    const withMembers = cards.filter((c) => c.memberIds && c.memberIds.length > 0).length;

    return {
      total,
      completed,
      overdue,
      dueSoon,
      withMembers,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }, [cards]);

  // Cards per list
  const cardsPerList = useMemo(() => {
    const listMap = new Map<string, { list: BoardList; count: number }>();
    lists.forEach((list) => {
      listMap.set(list.id, { list, count: 0 });
    });
    cards.forEach((card) => {
      const item = listMap.get(card.listId);
      if (item) {
        item.count++;
      }
    });
    return Array.from(listMap.values()).sort((a, b) => b.count - a.count);
  }, [cards, lists]);

  // Cards per label
  const cardsPerLabel = useMemo(() => {
    const labelMap = new Map<CardLabel, number>();
    cards.forEach((card) => {
      card.labels.forEach((label) => {
        labelMap.set(label, (labelMap.get(label) || 0) + 1);
      });
    });
    return Array.from(labelMap.entries()).sort((a, b) => b[1] - a[1]);
  }, [cards]);

  // Overdue cards
  const overdueCards = useMemo(() => {
    const now = new Date();
    return cards
      .filter((c) => c.dueDate && !c.completed && new Date(c.dueDate) < now)
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
      .slice(0, 5);
  }, [cards]);

  // Due soon cards
  const dueSoonCards = useMemo(() => {
    const now = new Date();
    const threeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    return cards
      .filter((c) => {
        if (!c.dueDate || c.completed) return false;
        const due = new Date(c.dueDate);
        return due >= now && due <= threeDays;
      })
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
      .slice(0, 5);
  }, [cards]);

  const maxListCount = Math.max(...cardsPerList.map((l) => l.count), 1);
  const maxLabelCount = Math.max(...cardsPerLabel.map(([, count]) => count), 1);

  const formatDateLocal = (dateString: string): string => {
    return formatDateShort(dateString) || '';
  };

  return (
    <div className="flex flex-col h-full bg-gray-100 dark:bg-gray-900 overflow-auto p-4">
      <div className="max-w-6xl mx-auto w-full">
        {/* Header */}
        <div className="flex items-center gap-2 mb-6">
          <LayoutDashboard className="h-6 w-6 text-gray-700 dark:text-gray-300" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Dashboard</h2>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Cards</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.total}</p>
              </div>
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                <ListIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Completed</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.completed}</p>
              </div>
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
                <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <div className="mt-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Completion rate</span>
                <span className="font-medium text-green-600 dark:text-green-400">{stats.completionRate}%</span>
              </div>
              <div className="mt-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all duration-300"
                  style={{ width: `${stats.completionRate}%` }}
                />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Overdue</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.overdue}</p>
              </div>
              <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full">
                <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Due Soon</p>
                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.dueSoon}</p>
              </div>
              <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-full">
                <Clock className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Charts Row */}
        {(settings.showCardsPerList || settings.showCardsPerLabel) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Cards per List */}
            {settings.showCardsPerList && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                  <h3 className="font-medium text-gray-900 dark:text-gray-100">Cards per List</h3>
                </div>
                <div className="space-y-3">
                  {cardsPerList.slice(0, 6).map(({ list, count }) => (
                    <div key={list.id}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-700 dark:text-gray-300 truncate max-w-[200px]">{list.title}</span>
                        <span className="text-gray-500 dark:text-gray-400">{count}</span>
                      </div>
                      <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all duration-300"
                          style={{ width: `${(count / maxListCount) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                  {cardsPerList.length === 0 && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No lists yet</p>
                  )}
                </div>
              </div>
            )}

            {/* Cards per Label */}
            {settings.showCardsPerLabel && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Tag className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                  <h3 className="font-medium text-gray-900 dark:text-gray-100">Cards per Label</h3>
                </div>
                <div className="space-y-3">
                  {cardsPerLabel.slice(0, 6).map(([label, count]) => (
                    <div key={label}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className={`capitalize ${LABEL_COLORS[label].bg} px-2 py-0.5 rounded text-xs font-medium`}>
                          {label}
                        </span>
                        <span className="text-gray-500 dark:text-gray-400">{count}</span>
                      </div>
                      <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${LABEL_COLORS[label].bar}`}
                          style={{ width: `${(count / maxLabelCount) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                  {cardsPerLabel.length === 0 && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No labels used yet</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Card Lists Row */}
        {(settings.showOverdueCards || settings.showDueSoonCards) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Overdue Cards */}
            {settings.showOverdueCards && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                <div className="flex items-center gap-2 mb-4">
                  <AlertCircle className="h-5 w-5 text-red-500 dark:text-red-400" />
                  <h3 className="font-medium text-gray-900 dark:text-gray-100">Overdue Cards</h3>
                </div>
                <div className="space-y-2">
                  {overdueCards.map((card) => (
                    <button
                      key={card.id}
                      onClick={() => onCardClick(card)}
                      className="w-full text-left p-2 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-900 dark:text-gray-100 group-hover:text-red-700 dark:group-hover:text-red-400 truncate max-w-[200px]">
                          {card.title}
                        </span>
                        <span className="text-xs text-red-600 dark:text-red-400 font-medium">
                          {formatDateLocal(card.dueDate!)}
                        </span>
                      </div>
                    </button>
                  ))}
                  {overdueCards.length === 0 && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No overdue cards</p>
                  )}
                </div>
              </div>
            )}

            {/* Due Soon Cards */}
            {settings.showDueSoonCards && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="h-5 w-5 text-yellow-500 dark:text-yellow-400" />
                  <h3 className="font-medium text-gray-900 dark:text-gray-100">Due in Next 3 Days</h3>
                </div>
                <div className="space-y-2">
                  {dueSoonCards.map((card) => (
                    <button
                      key={card.id}
                      onClick={() => onCardClick(card)}
                      className="w-full text-left p-2 rounded-md hover:bg-yellow-50 dark:hover:bg-yellow-900/20 transition-colors group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-900 dark:text-gray-100 group-hover:text-yellow-700 dark:group-hover:text-yellow-400 truncate max-w-[200px]">
                          {card.title}
                        </span>
                        <span className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">
                          {formatDateLocal(card.dueDate!)}
                        </span>
                      </div>
                    </button>
                  ))}
                  {dueSoonCards.length === 0 && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No upcoming due dates</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer Stats */}
        <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center justify-around text-center">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Lists</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{lists.length}</p>
            </div>
            <div className="h-8 w-px bg-gray-200 dark:bg-gray-700" />
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Cards</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{stats.total}</p>
            </div>
            <div className="h-8 w-px bg-gray-200 dark:bg-gray-700" />
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Assigned</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{stats.withMembers}</p>
            </div>
            <div className="h-8 w-px bg-gray-200 dark:bg-gray-700" />
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Done</p>
              <p className="text-lg font-semibold text-green-600 dark:text-green-400">{stats.completionRate}%</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardView;
