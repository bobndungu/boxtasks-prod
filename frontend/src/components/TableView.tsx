import { useState, useMemo } from 'react';
import {
  ChevronUp,
  ChevronDown,
  CheckCircle2,
  Circle,
  Clock,
  User,
  List,
} from 'lucide-react';
import type { Card, CardLabel } from '../lib/api/cards';
import type { BoardList } from '../lib/api/lists';

interface TableViewProps {
  cards: Card[];
  lists: BoardList[];
  onCardClick: (card: Card) => void;
}

type SortField = 'title' | 'list' | 'dueDate' | 'completed' | 'labels';
type SortDirection = 'asc' | 'desc';

const LABEL_COLORS: Record<CardLabel, { bg: string; text: string }> = {
  green: { bg: 'bg-green-100', text: 'text-green-700' },
  yellow: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  orange: { bg: 'bg-orange-100', text: 'text-orange-700' },
  red: { bg: 'bg-red-100', text: 'text-red-700' },
  purple: { bg: 'bg-purple-100', text: 'text-purple-700' },
  blue: { bg: 'bg-blue-100', text: 'text-blue-700' },
};

export function TableView({ cards, lists, onCardClick }: TableViewProps) {
  const [sortField, setSortField] = useState<SortField>('title');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Create list lookup map
  const listMap = useMemo(() => {
    const map = new Map<string, BoardList>();
    lists.forEach((list) => map.set(list.id, list));
    return map;
  }, [lists]);

  // Sort cards
  const sortedCards = useMemo(() => {
    const sorted = [...cards].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'list': {
          const listA = listMap.get(a.listId)?.title || '';
          const listB = listMap.get(b.listId)?.title || '';
          comparison = listA.localeCompare(listB);
          break;
        }
        case 'dueDate': {
          const dateA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
          const dateB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
          comparison = dateA - dateB;
          break;
        }
        case 'completed':
          comparison = (a.completed ? 1 : 0) - (b.completed ? 1 : 0);
          break;
        case 'labels':
          comparison = a.labels.length - b.labels.length;
          break;
        default:
          comparison = 0;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [cards, sortField, sortDirection, listMap]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
    });
  };

  const isOverdue = (dueDate: string | null, completed: boolean): boolean => {
    if (!dueDate || completed) return false;
    return new Date(dueDate) < new Date();
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <div className="w-4 h-4" />;
    }
    return sortDirection === 'asc' ? (
      <ChevronUp className="h-4 w-4" />
    ) : (
      <ChevronDown className="h-4 w-4" />
    );
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow overflow-hidden">
      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                onClick={() => handleSort('completed')}
              >
                <div className="flex items-center gap-1">
                  <span>Status</span>
                  <SortIcon field="completed" />
                </div>
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                onClick={() => handleSort('title')}
              >
                <div className="flex items-center gap-1">
                  <span>Title</span>
                  <SortIcon field="title" />
                </div>
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                onClick={() => handleSort('list')}
              >
                <div className="flex items-center gap-1">
                  <span>List</span>
                  <SortIcon field="list" />
                </div>
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                onClick={() => handleSort('labels')}
              >
                <div className="flex items-center gap-1">
                  <span>Labels</span>
                  <SortIcon field="labels" />
                </div>
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                onClick={() => handleSort('dueDate')}
              >
                <div className="flex items-center gap-1">
                  <span>Due Date</span>
                  <SortIcon field="dueDate" />
                </div>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Members
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedCards.map((card) => {
              const list = listMap.get(card.listId);
              const overdue = isOverdue(card.dueDate, card.completed);

              return (
                <tr
                  key={card.id}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => onCardClick(card)}
                >
                  {/* Status */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    {card.completed ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <Circle className="h-5 w-5 text-gray-300" />
                    )}
                  </td>

                  {/* Title */}
                  <td className="px-4 py-3">
                    <div className={`text-sm font-medium ${card.completed ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                      {card.title}
                    </div>
                    {card.description && (
                      <div className="text-xs text-gray-500 truncate max-w-xs">
                        {card.description.substring(0, 50)}
                        {card.description.length > 50 && '...'}
                      </div>
                    )}
                  </td>

                  {/* List */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <List className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-600">
                        {list?.title || 'Unknown'}
                      </span>
                    </div>
                  </td>

                  {/* Labels */}
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {card.labels.length > 0 ? (
                        card.labels.map((label) => (
                          <span
                            key={label}
                            className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${LABEL_COLORS[label].bg} ${LABEL_COLORS[label].text}`}
                          >
                            {label}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </div>
                  </td>

                  {/* Due Date */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className={`flex items-center gap-1.5 text-sm ${
                      overdue ? 'text-red-600 font-medium' : 'text-gray-600'
                    }`}>
                      {card.dueDate && <Clock className={`h-4 w-4 ${overdue ? 'text-red-500' : 'text-gray-400'}`} />}
                      <span>{formatDate(card.dueDate)}</span>
                    </div>
                  </td>

                  {/* Members */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    {card.memberIds && card.memberIds.length > 0 ? (
                      <div className="flex items-center gap-1">
                        <User className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-600">
                          {card.memberIds.length}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {cards.length === 0 && (
          <div className="flex items-center justify-center h-64 text-gray-500">
            <div className="text-center">
              <List className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p>No cards found</p>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t bg-gray-50 flex items-center justify-between text-xs text-gray-600">
        <div>
          {sortedCards.length} cards • {sortedCards.filter((c) => c.completed).length} completed
        </div>
        <div>
          Click column headers to sort
        </div>
      </div>
    </div>
  );
}

export default TableView;
