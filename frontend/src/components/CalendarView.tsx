import { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  CheckCircle2,
} from 'lucide-react';
import type { Card, CardLabel } from '../lib/api/cards';

interface CalendarSettings {
  dateField: 'dueDate' | 'startDate';
  showCompleted: boolean;
}

interface CalendarViewProps {
  cards: Card[];
  onCardClick: (card: Card) => void;
  settings?: CalendarSettings;
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const LABEL_COLORS: Record<CardLabel, string> = {
  green: 'bg-green-500',
  yellow: 'bg-yellow-400',
  orange: 'bg-orange-500',
  red: 'bg-red-500',
  purple: 'bg-purple-500',
  blue: 'bg-blue-500',
};

const DEFAULT_SETTINGS: CalendarSettings = {
  dateField: 'dueDate',
  showCompleted: true,
};

export function CalendarView({ cards, onCardClick, settings = DEFAULT_SETTINGS }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const { dateField, showCompleted } = settings;

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Calculate calendar days
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const firstDayOfWeek = firstDayOfMonth.getDay();
    const daysInMonth = lastDayOfMonth.getDate();

    const days: { date: Date; isCurrentMonth: boolean }[] = [];

    // Previous month days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthLastDay - i),
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
      });
    }

    // Next month days (fill to 6 weeks)
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
      });
    }

    return days;
  }, [year, month]);

  // Group cards by selected date field
  const cardsByDate = useMemo(() => {
    const map = new Map<string, Card[]>();

    cards.forEach((card) => {
      // Skip completed cards if setting says so
      if (!showCompleted && card.completed) return;

      // Use the selected date field (dueDate or startDate)
      const dateValue = dateField === 'startDate' ? card.startDate : card.dueDate;
      if (dateValue) {
        const dateKey = dateValue.split('T')[0]; // YYYY-MM-DD
        const existing = map.get(dateKey) || [];
        existing.push(card);
        map.set(dateKey, existing);
      }
    });

    return map;
  }, [cards, dateField, showCompleted]);

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const formatDateKey = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  const isToday = (date: Date): boolean => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {MONTHS[month]} {year}
          </h2>
          <button
            onClick={goToToday}
            className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
          >
            Today
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={goToPreviousMonth}
            className="p-2 hover:bg-gray-100 rounded-md transition-colors"
            title="Previous month"
          >
            <ChevronLeft className="h-5 w-5 text-gray-600" />
          </button>
          <button
            onClick={goToNextMonth}
            className="p-2 hover:bg-gray-100 rounded-md transition-colors"
            title="Next month"
          >
            <ChevronRight className="h-5 w-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 border-b bg-gray-50">
        {DAYS_OF_WEEK.map((day) => (
          <div
            key={day}
            className="px-2 py-2 text-center text-sm font-medium text-gray-500"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="flex-1 grid grid-cols-7 overflow-hidden">
        {calendarDays.map((dayInfo, index) => {
          const dateKey = formatDateKey(dayInfo.date);
          const dayCards = cardsByDate.get(dateKey) || [];
          const today = isToday(dayInfo.date);

          return (
            <div
              key={index}
              className={`min-h-[100px] border-b border-r p-1 ${
                dayInfo.isCurrentMonth ? 'bg-white' : 'bg-gray-50'
              } ${index % 7 === 0 ? 'border-l' : ''}`}
            >
              <div
                className={`text-right text-sm mb-1 ${
                  today
                    ? 'font-bold'
                    : dayInfo.isCurrentMonth
                    ? 'text-gray-900'
                    : 'text-gray-400'
                }`}
              >
                {today ? (
                  <span className="inline-flex items-center justify-center w-6 h-6 bg-blue-500 text-white rounded-full">
                    {dayInfo.date.getDate()}
                  </span>
                ) : (
                  dayInfo.date.getDate()
                )}
              </div>

              {/* Cards for this day */}
              <div className="space-y-0.5 overflow-y-auto max-h-[80px]">
                {dayCards.slice(0, 3).map((card) => (
                  <button
                    key={card.id}
                    onClick={() => onCardClick(card)}
                    className={`w-full text-left px-1.5 py-0.5 rounded text-xs truncate transition-colors ${
                      card.completed
                        ? 'bg-green-100 text-green-700 line-through'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    }`}
                    title={card.title}
                  >
                    <div className="flex items-center gap-1">
                      {/* Labels */}
                      {card.labels.length > 0 && (
                        <div className="flex gap-0.5">
                          {card.labels.slice(0, 2).map((label) => (
                            <span
                              key={label}
                              className={`w-1.5 h-1.5 rounded-full ${LABEL_COLORS[label]}`}
                            />
                          ))}
                        </div>
                      )}
                      {card.completed && (
                        <CheckCircle2 className="h-3 w-3 text-green-600 flex-shrink-0" />
                      )}
                      <span className="truncate">{card.title}</span>
                    </div>
                  </button>
                ))}
                {dayCards.length > 3 && (
                  <div className="text-xs text-gray-500 px-1.5">
                    +{dayCards.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="px-4 py-2 border-t bg-gray-50 flex items-center gap-4 text-xs text-gray-600">
        <div className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          <span>
            {cards.filter((c) => (dateField === 'startDate' ? c.startDate : c.dueDate) && (showCompleted || !c.completed)).length} cards
            {' '}(by {dateField === 'startDate' ? 'start date' : 'due date'})
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-flex items-center justify-center w-4 h-4 bg-blue-500 text-white rounded-full text-[10px]">
            {new Date().getDate()}
          </span>
          <span>Today</span>
        </div>
      </div>
    </div>
  );
}

export default CalendarView;
