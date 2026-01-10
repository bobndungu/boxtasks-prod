import { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  CheckCircle2,
} from 'lucide-react';
import type { Card, CardLabel } from '../lib/api/cards';

interface TimelineViewProps {
  cards: Card[];
  onCardClick: (card: Card) => void;
}

const LABEL_COLORS: Record<CardLabel, string> = {
  green: 'bg-green-500',
  yellow: 'bg-yellow-400',
  orange: 'bg-orange-500',
  red: 'bg-red-500',
  purple: 'bg-purple-500',
  blue: 'bg-blue-500',
};

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function TimelineView({ cards, onCardClick }: TimelineViewProps) {
  const [weeksToShow, setWeeksToShow] = useState(4);
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Start from beginning of current week (Sunday)
    today.setDate(today.getDate() - today.getDay());
    return today;
  });

  // Calculate the date range
  const dateRange = useMemo(() => {
    const dates: Date[] = [];
    const current = new Date(startDate);
    for (let i = 0; i < weeksToShow * 7; i++) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return dates;
  }, [startDate, weeksToShow]);

  const endDate = dateRange[dateRange.length - 1];

  // Filter and prepare cards with dates
  const timelineCards = useMemo(() => {
    return cards
      .filter((card) => card.startDate || card.dueDate)
      .map((card) => {
        const start = card.startDate ? new Date(card.startDate) : card.dueDate ? new Date(card.dueDate) : null;
        const end = card.dueDate ? new Date(card.dueDate) : card.startDate ? new Date(card.startDate) : null;

        if (!start || !end) return null;

        return {
          ...card,
          startTime: start.getTime(),
          endTime: end.getTime(),
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .sort((a, b) => a.startTime - b.startTime);
  }, [cards]);

  // Navigate timeline
  const goToPreviousWeek = () => {
    const newStart = new Date(startDate);
    newStart.setDate(newStart.getDate() - 7);
    setStartDate(newStart);
  };

  const goToNextWeek = () => {
    const newStart = new Date(startDate);
    newStart.setDate(newStart.getDate() + 7);
    setStartDate(newStart);
  };

  const goToToday = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    today.setDate(today.getDate() - today.getDay());
    setStartDate(today);
  };

  // Calculate bar position and width
  const getBarStyle = (card: typeof timelineCards[0]): React.CSSProperties | null => {
    const rangeStart = startDate.getTime();
    const rangeEnd = endDate.getTime();
    const totalMs = rangeEnd - rangeStart;

    // Check if card overlaps with visible range
    if (card.endTime < rangeStart || card.startTime > rangeEnd) {
      return null;
    }

    const effectiveStart = Math.max(card.startTime, rangeStart);
    const effectiveEnd = Math.min(card.endTime, rangeEnd);

    const leftPercent = ((effectiveStart - rangeStart) / totalMs) * 100;
    const widthPercent = ((effectiveEnd - effectiveStart) / totalMs) * 100;

    return {
      left: `${leftPercent}%`,
      width: `${Math.max(widthPercent, 1)}%`, // Minimum 1% width
    };
  };

  // Check if a date is today
  const isToday = (date: Date): boolean => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  // Check if date is first of month
  const isFirstOfMonth = (date: Date): boolean => {
    return date.getDate() === 1;
  };

  // Format date for header
  const formatDate = (date: Date): string => {
    return `${date.getDate()}`;
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-gray-900">Timeline</h2>
          <button
            onClick={goToToday}
            className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
          >
            Today
          </button>
          <select
            value={weeksToShow}
            onChange={(e) => setWeeksToShow(Number(e.target.value))}
            className="px-2 py-1 text-sm border rounded-md"
          >
            <option value={2}>2 weeks</option>
            <option value={4}>4 weeks</option>
            <option value={8}>8 weeks</option>
            <option value={12}>12 weeks</option>
          </select>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={goToPreviousWeek}
            className="p-2 hover:bg-gray-100 rounded-md transition-colors"
            title="Previous week"
          >
            <ChevronLeft className="h-5 w-5 text-gray-600" />
          </button>
          <button
            onClick={goToNextWeek}
            className="p-2 hover:bg-gray-100 rounded-md transition-colors"
            title="Next week"
          >
            <ChevronRight className="h-5 w-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Timeline header with dates */}
      <div className="border-b bg-gray-50">
        {/* Month labels */}
        <div className="flex relative h-6">
          {dateRange.map((date, index) => (
            isFirstOfMonth(date) || index === 0 ? (
              <div
                key={`month-${index}`}
                className="absolute text-xs font-medium text-gray-600 px-1"
                style={{
                  left: `${(index / dateRange.length) * 100}%`,
                }}
              >
                {MONTHS_SHORT[date.getMonth()]} {date.getFullYear()}
              </div>
            ) : null
          ))}
        </div>
        {/* Day labels */}
        <div className="flex border-t">
          {dateRange.map((date, index) => (
            <div
              key={index}
              className={`flex-1 text-center text-xs py-1 border-r last:border-r-0 ${
                isToday(date) ? 'bg-blue-100 font-bold text-blue-700' : 'text-gray-500'
              } ${date.getDay() === 0 || date.getDay() === 6 ? 'bg-gray-100' : ''}`}
            >
              {formatDate(date)}
            </div>
          ))}
        </div>
      </div>

      {/* Timeline content */}
      <div className="flex-1 overflow-y-auto">
        {timelineCards.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <Calendar className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p>No cards with dates in this range</p>
              <p className="text-sm">Add start or due dates to cards to see them here</p>
            </div>
          </div>
        ) : (
          <div className="relative min-h-full">
            {/* Today line */}
            {dateRange.some(isToday) && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-blue-500 z-10"
                style={{
                  left: `${((new Date().setHours(0, 0, 0, 0) - startDate.getTime()) / (endDate.getTime() - startDate.getTime())) * 100}%`,
                }}
              />
            )}

            {/* Card bars */}
            <div className="py-2 space-y-1">
              {timelineCards.map((card) => {
                const barStyle = getBarStyle(card);
                if (!barStyle) return null;

                return (
                  <div key={card.id} className="relative h-8 px-2">
                    <button
                      onClick={() => onCardClick(card)}
                      className={`absolute h-6 rounded px-2 flex items-center gap-1 text-xs text-white shadow-sm transition-opacity hover:opacity-90 ${
                        card.completed
                          ? 'bg-green-500'
                          : card.labels.length > 0
                          ? LABEL_COLORS[card.labels[0]]
                          : 'bg-gray-500'
                      }`}
                      style={barStyle}
                      title={`${card.title}${card.startDate ? `\nStart: ${new Date(card.startDate).toLocaleDateString()}` : ''}${card.dueDate ? `\nDue: ${new Date(card.dueDate).toLocaleDateString()}` : ''}`}
                    >
                      {card.completed && <CheckCircle2 className="h-3 w-3 flex-shrink-0" />}
                      <span className="truncate">{card.title}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="px-4 py-2 border-t bg-gray-50 flex items-center gap-4 text-xs text-gray-600">
        <div className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          <span>{timelineCards.length} cards with dates</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-0.5 bg-blue-500" />
          <span>Today</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-2 bg-green-500 rounded" />
          <span>Completed</span>
        </div>
      </div>
    </div>
  );
}

export default TimelineView;
