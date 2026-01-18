import { useState, useRef, useEffect } from 'react';
import { Settings } from 'lucide-react';
import type { ViewType } from './ViewSelector';
import { Select } from './ui/select';

export interface ViewSettingsData {
  calendar: {
    dateField: 'dueDate' | 'startDate';
    showCompleted: boolean;
  };
  timeline: {
    defaultWeeks: 2 | 4 | 8 | 12;
    showCompletedCards: boolean;
  };
  table: {
    visibleColumns: string[];
    defaultSort: 'title' | 'dueDate' | 'list' | 'completed';
    sortDirection: 'asc' | 'desc';
  };
  dashboard: {
    showCardsPerList: boolean;
    showCardsPerLabel: boolean;
    showOverdueCards: boolean;
    showDueSoonCards: boolean;
  };
}

export const DEFAULT_VIEW_SETTINGS: ViewSettingsData = {
  calendar: {
    dateField: 'dueDate',
    showCompleted: true,
  },
  timeline: {
    defaultWeeks: 4,
    showCompletedCards: true,
  },
  table: {
    visibleColumns: ['status', 'title', 'list', 'labels', 'dueDate', 'members'],
    defaultSort: 'title',
    sortDirection: 'asc',
  },
  dashboard: {
    showCardsPerList: true,
    showCardsPerLabel: true,
    showOverdueCards: true,
    showDueSoonCards: true,
  },
};

interface ViewSettingsProps {
  currentView: ViewType;
  settings: ViewSettingsData;
  onSettingsChange: (settings: ViewSettingsData) => void;
}

export function ViewSettings({ currentView, settings, onSettingsChange }: ViewSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const updateCalendarSettings = (key: keyof ViewSettingsData['calendar'], value: any) => {
    onSettingsChange({
      ...settings,
      calendar: { ...settings.calendar, [key]: value },
    });
  };

  const updateTimelineSettings = (key: keyof ViewSettingsData['timeline'], value: any) => {
    onSettingsChange({
      ...settings,
      timeline: { ...settings.timeline, [key]: value },
    });
  };

  const updateTableSettings = (key: keyof ViewSettingsData['table'], value: any) => {
    onSettingsChange({
      ...settings,
      table: { ...settings.table, [key]: value },
    });
  };

  const updateDashboardSettings = (key: keyof ViewSettingsData['dashboard'], value: boolean) => {
    onSettingsChange({
      ...settings,
      dashboard: { ...settings.dashboard, [key]: value },
    });
  };

  const toggleTableColumn = (column: string) => {
    const columns = settings.table.visibleColumns;
    if (columns.includes(column)) {
      onSettingsChange({
        ...settings,
        table: {
          ...settings.table,
          visibleColumns: columns.filter((c) => c !== column),
        },
      });
    } else {
      onSettingsChange({
        ...settings,
        table: {
          ...settings.table,
          visibleColumns: [...columns, column],
        },
      });
    }
  };

  // Don't show settings for Kanban view (no customization yet)
  if (currentView === 'kanban') {
    return null;
  }

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded transition-colors"
        title="View Settings"
      >
        <Settings className="h-4 w-4" />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border dark:border-gray-700 py-2 z-50">
          <div className="px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase border-b dark:border-gray-700">
            {currentView} View Settings
          </div>

          {/* Calendar Settings */}
          {currentView === 'calendar' && (
            <div className="p-3 space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-200 block mb-1">
                  Show cards by
                </label>
                <Select
                  value={settings.calendar.dateField}
                  onChange={(e) => updateCalendarSettings('dateField', e.target.value)}
                  size="sm"
                  options={[
                    { value: 'dueDate', label: 'Due Date' },
                    { value: 'startDate', label: 'Start Date' },
                  ]}
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.calendar.showCompleted}
                  onChange={(e) => updateCalendarSettings('showCompleted', e.target.checked)}
                  className="rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700"
                />
                Show completed cards
              </label>
            </div>
          )}

          {/* Timeline Settings */}
          {currentView === 'timeline' && (
            <div className="p-3 space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-200 block mb-1">
                  Default time range
                </label>
                <Select
                  value={String(settings.timeline.defaultWeeks)}
                  onChange={(e) => updateTimelineSettings('defaultWeeks', Number(e.target.value))}
                  size="sm"
                  options={[
                    { value: '2', label: '2 weeks' },
                    { value: '4', label: '4 weeks' },
                    { value: '8', label: '8 weeks' },
                    { value: '12', label: '12 weeks' },
                  ]}
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.timeline.showCompletedCards}
                  onChange={(e) => updateTimelineSettings('showCompletedCards', e.target.checked)}
                  className="rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700"
                />
                Show completed cards
              </label>
            </div>
          )}

          {/* Table Settings */}
          {currentView === 'table' && (
            <div className="p-3 space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-200 block mb-2">
                  Visible columns
                </label>
                <div className="space-y-1">
                  {[
                    { id: 'status', label: 'Status' },
                    { id: 'title', label: 'Title' },
                    { id: 'list', label: 'List' },
                    { id: 'labels', label: 'Labels' },
                    { id: 'dueDate', label: 'Due Date' },
                    { id: 'members', label: 'Members' },
                  ].map((col) => (
                    <label
                      key={col.id}
                      className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={settings.table.visibleColumns.includes(col.id)}
                        onChange={() => toggleTableColumn(col.id)}
                        className="rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700"
                        disabled={col.id === 'title'} // Title always visible
                      />
                      {col.label}
                      {col.id === 'title' && (
                        <span className="text-xs text-gray-400">(required)</span>
                      )}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-200 block mb-1">
                  Default sort
                </label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Select
                      value={settings.table.defaultSort}
                      onChange={(e) => updateTableSettings('defaultSort', e.target.value)}
                      size="sm"
                      options={[
                        { value: 'title', label: 'Title' },
                        { value: 'dueDate', label: 'Due Date' },
                        { value: 'list', label: 'List' },
                        { value: 'completed', label: 'Status' },
                      ]}
                    />
                  </div>
                  <div className="w-20">
                    <Select
                      value={settings.table.sortDirection}
                      onChange={(e) => updateTableSettings('sortDirection', e.target.value)}
                      size="sm"
                      options={[
                        { value: 'asc', label: 'Asc' },
                        { value: 'desc', label: 'Desc' },
                      ]}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Dashboard Settings */}
          {currentView === 'dashboard' && (
            <div className="p-3 space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-200 block mb-2">
                Show sections
              </label>
              {[
                { key: 'showCardsPerList' as const, label: 'Cards per List chart' },
                { key: 'showCardsPerLabel' as const, label: 'Cards per Label chart' },
                { key: 'showOverdueCards' as const, label: 'Overdue Cards list' },
                { key: 'showDueSoonCards' as const, label: 'Due Soon Cards list' },
              ].map((item) => (
                <label
                  key={item.key}
                  className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={settings.dashboard[item.key]}
                    onChange={(e) => updateDashboardSettings(item.key, e.target.checked)}
                    className="rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700"
                  />
                  {item.label}
                </label>
              ))}
            </div>
          )}

          {/* Reset button */}
          <div className="px-3 pt-2 border-t dark:border-gray-700 mt-2">
            <button
              onClick={() => {
                const defaultForView = DEFAULT_VIEW_SETTINGS[currentView as keyof typeof DEFAULT_VIEW_SETTINGS];
                if (defaultForView) {
                  onSettingsChange({
                    ...settings,
                    [currentView]: defaultForView,
                  });
                }
              }}
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            >
              Reset to defaults
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ViewSettings;
