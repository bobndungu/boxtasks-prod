import { useState, useMemo, useRef, useEffect } from 'react';
import {
  Filter,
  X,
  Tag,
  User,
  Calendar,
  CheckSquare,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Hash,
  Trash2,
} from 'lucide-react';
import type { CardLabel } from '../lib/api/cards';
import type { CustomFieldDefinition } from '../lib/api/customFields';

export interface FilterState {
  labels: CardLabel[];
  members: string[];
  dueDateFilter: DueDateFilterType | null;
  completionStatus: CompletionStatusType | null;
  customFields: CustomFieldFilterItem[];
}

export type DueDateFilterType = 'overdue' | 'today' | 'this_week' | 'this_month' | 'no_date';

export type CompletionStatusType = 'completed' | 'not_completed';

export interface CustomFieldFilterItem {
  definitionId: string;
  value: string;
}

interface AdvancedFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  availableMembers: Array<{ id: string; name: string; avatar?: string }>;
  customFieldDefs: CustomFieldDefinition[];
  currentUserId?: string;
}

const LABEL_COLORS: Record<CardLabel, { bg: string; text: string }> = {
  green: { bg: '#61bd4f', text: 'white' },
  yellow: { bg: '#f2d600', text: 'black' },
  orange: { bg: '#ff9f1a', text: 'white' },
  red: { bg: '#eb5a46', text: 'white' },
  purple: { bg: '#c377e0', text: 'white' },
  blue: { bg: '#0079bf', text: 'white' },
};

const LABEL_OPTIONS: CardLabel[] = ['green', 'yellow', 'orange', 'red', 'purple', 'blue'];

const DUE_DATE_OPTIONS: { value: DueDateFilterType; label: string; icon: React.ReactNode }[] = [
  { value: 'overdue', label: 'Overdue', icon: <AlertTriangle className="h-4 w-4 text-red-500" /> },
  { value: 'today', label: 'Due today', icon: <Clock className="h-4 w-4 text-orange-500" /> },
  { value: 'this_week', label: 'Due this week', icon: <Calendar className="h-4 w-4 text-blue-500" /> },
  { value: 'this_month', label: 'Due this month', icon: <Calendar className="h-4 w-4 text-gray-500" /> },
  { value: 'no_date', label: 'No due date', icon: <Calendar className="h-4 w-4 text-gray-300" /> },
];

const COMPLETION_OPTIONS: { value: CompletionStatusType; label: string }[] = [
  { value: 'completed', label: 'Completed' },
  { value: 'not_completed', label: 'Not completed' },
];

export function AdvancedFilters({
  filters,
  onFiltersChange,
  availableMembers,
  customFieldDefs,
  currentUserId,
}: AdvancedFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['labels', 'dueDate']));
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsExpanded(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.labels.length > 0) count++;
    if (filters.members.length > 0) count++;
    if (filters.dueDateFilter) count++;
    if (filters.completionStatus) count++;
    if (filters.customFields.length > 0) count += filters.customFields.length;
    return count;
  }, [filters]);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const toggleLabel = (label: CardLabel) => {
    const newLabels = filters.labels.includes(label)
      ? filters.labels.filter((l) => l !== label)
      : [...filters.labels, label];
    onFiltersChange({ ...filters, labels: newLabels });
  };

  const toggleMember = (memberId: string) => {
    const newMembers = filters.members.includes(memberId)
      ? filters.members.filter((m) => m !== memberId)
      : [...filters.members, memberId];
    onFiltersChange({ ...filters, members: newMembers });
  };

  const setDueDateFilter = (value: DueDateFilterType | null) => {
    onFiltersChange({ ...filters, dueDateFilter: value });
  };

  const setCompletionStatus = (value: CompletionStatusType | null) => {
    onFiltersChange({ ...filters, completionStatus: value });
  };

  const setCustomFieldFilter = (definitionId: string, value: string) => {
    const existing = filters.customFields.filter((f) => f.definitionId !== definitionId);
    if (value) {
      existing.push({ definitionId, value });
    }
    onFiltersChange({ ...filters, customFields: existing });
  };

  const clearAllFilters = () => {
    onFiltersChange({
      labels: [],
      members: [],
      dueDateFilter: null,
      completionStatus: null,
      customFields: [],
    });
  };

  const getCustomFieldValue = (defId: string) => {
    return filters.customFields.find((f) => f.definitionId === defId)?.value || '';
  };

  return (
    <div ref={dropdownRef} className="relative">
      {/* Filter Toggle Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
          activeFilterCount > 0
            ? 'bg-white/20 text-white hover:bg-white/30'
            : 'bg-white/10 text-white hover:bg-white/20'
        }`}
      >
        <Filter className="h-4 w-4" />
        Filters
        {activeFilterCount > 0 && (
          <span className="flex items-center justify-center h-5 w-5 bg-white/30 text-white text-xs rounded-full">
            {activeFilterCount}
          </span>
        )}
        <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
      </button>

      {/* Filter Panel */}
      {isExpanded && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-xl border dark:border-gray-700 z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b dark:border-gray-700">
            <h3 className="font-semibold text-gray-800 dark:text-white">Filters</h3>
            <div className="flex items-center gap-2">
              {activeFilterCount > 0 && (
                <button
                  onClick={clearAllFilters}
                  className="text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 flex items-center gap-1"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear all
                </button>
              )}
              <button
                onClick={() => setIsExpanded(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <X className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {/* Labels Section */}
            <div className="border-b dark:border-gray-700">
              <button
                onClick={() => toggleSection('labels')}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                  <span className="font-medium text-gray-700 dark:text-gray-200">Labels</span>
                  {filters.labels.length > 0 && (
                    <span className="text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded">
                      {filters.labels.length}
                    </span>
                  )}
                </div>
                {expandedSections.has('labels') ? (
                  <ChevronUp className="h-4 w-4 text-gray-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                )}
              </button>
              {expandedSections.has('labels') && (
                <div className="px-4 pb-3">
                  <div className="flex flex-wrap gap-2">
                    {LABEL_OPTIONS.map((label) => (
                      <button
                        key={label}
                        onClick={() => toggleLabel(label)}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded text-sm font-medium transition-all ${
                          filters.labels.includes(label)
                            ? 'ring-2 ring-offset-1 ring-blue-500'
                            : ''
                        }`}
                        style={{
                          backgroundColor: LABEL_COLORS[label].bg,
                          color: LABEL_COLORS[label].text,
                        }}
                      >
                        {label}
                        {filters.labels.includes(label) && (
                          <CheckSquare className="h-3 w-3" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Members Section */}
            <div className="border-b dark:border-gray-700">
              <button
                onClick={() => toggleSection('members')}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                  <span className="font-medium text-gray-700 dark:text-gray-200">Members</span>
                  {filters.members.length > 0 && (
                    <span className="text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded">
                      {filters.members.length}
                    </span>
                  )}
                </div>
                {expandedSections.has('members') ? (
                  <ChevronUp className="h-4 w-4 text-gray-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                )}
              </button>
              {expandedSections.has('members') && (
                <div className="px-4 pb-3 space-y-1">
                  {currentUserId && (
                    <button
                      onClick={() => toggleMember(currentUserId)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                        filters.members.includes(currentUserId)
                          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <User className="h-4 w-4" />
                      <span>Me (My cards)</span>
                      {filters.members.includes(currentUserId) && (
                        <CheckSquare className="h-4 w-4 ml-auto" />
                      )}
                    </button>
                  )}
                  {availableMembers
                    .filter((m) => m.id !== currentUserId)
                    .map((member) => (
                      <button
                        key={member.id}
                        onClick={() => toggleMember(member.id)}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                          filters.members.includes(member.id)
                            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700'
                            : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {member.avatar ? (
                          <img
                            src={member.avatar}
                            alt=""
                            className="h-5 w-5 rounded-full"
                          />
                        ) : (
                          <div className="h-5 w-5 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-xs text-gray-700 dark:text-gray-300">
                            {member.name[0]}
                          </div>
                        )}
                        <span className="truncate">{member.name}</span>
                        {filters.members.includes(member.id) && (
                          <CheckSquare className="h-4 w-4 ml-auto flex-shrink-0" />
                        )}
                      </button>
                    ))}
                </div>
              )}
            </div>

            {/* Due Date Section */}
            <div className="border-b dark:border-gray-700">
              <button
                onClick={() => toggleSection('dueDate')}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                  <span className="font-medium text-gray-700 dark:text-gray-200">Due Date</span>
                  {filters.dueDateFilter && (
                    <span className="text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded">
                      1
                    </span>
                  )}
                </div>
                {expandedSections.has('dueDate') ? (
                  <ChevronUp className="h-4 w-4 text-gray-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                )}
              </button>
              {expandedSections.has('dueDate') && (
                <div className="px-4 pb-3 space-y-1">
                  {DUE_DATE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() =>
                        setDueDateFilter(
                          filters.dueDateFilter === option.value ? null : option.value
                        )
                      }
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                        filters.dueDateFilter === option.value
                          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {option.icon}
                      <span>{option.label}</span>
                      {filters.dueDateFilter === option.value && (
                        <CheckSquare className="h-4 w-4 ml-auto" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Completion Status Section */}
            <div className="border-b dark:border-gray-700">
              <button
                onClick={() => toggleSection('completion')}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <div className="flex items-center gap-2">
                  <CheckSquare className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                  <span className="font-medium text-gray-700 dark:text-gray-200">Status</span>
                  {filters.completionStatus && (
                    <span className="text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded">
                      1
                    </span>
                  )}
                </div>
                {expandedSections.has('completion') ? (
                  <ChevronUp className="h-4 w-4 text-gray-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                )}
              </button>
              {expandedSections.has('completion') && (
                <div className="px-4 pb-3 space-y-1">
                  {COMPLETION_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() =>
                        setCompletionStatus(
                          filters.completionStatus === option.value ? null : option.value
                        )
                      }
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                        filters.completionStatus === option.value
                          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <CheckSquare
                        className={`h-4 w-4 ${
                          option.value === 'completed' ? 'text-green-500' : 'text-gray-400'
                        }`}
                      />
                      <span>{option.label}</span>
                      {filters.completionStatus === option.value && (
                        <CheckSquare className="h-4 w-4 ml-auto text-blue-600 dark:text-blue-400" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Custom Fields Section */}
            {customFieldDefs.length > 0 && (
              <div>
                <button
                  onClick={() => toggleSection('customFields')}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <div className="flex items-center gap-2">
                    <Hash className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                    <span className="font-medium text-gray-700 dark:text-gray-200">Custom Fields</span>
                    {filters.customFields.length > 0 && (
                      <span className="text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded">
                        {filters.customFields.length}
                      </span>
                    )}
                  </div>
                  {expandedSections.has('customFields') ? (
                    <ChevronUp className="h-4 w-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  )}
                </button>
                {expandedSections.has('customFields') && (
                  <div className="px-4 pb-3 space-y-3">
                    {customFieldDefs.map((fieldDef) => (
                      <div key={fieldDef.id}>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                          {fieldDef.title}
                        </label>
                        {fieldDef.type === 'checkbox' ? (
                          <select
                            value={getCustomFieldValue(fieldDef.id)}
                            onChange={(e) => setCustomFieldFilter(fieldDef.id, e.target.value)}
                            className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          >
                            <option value="">Any</option>
                            <option value="true">Yes</option>
                            <option value="false">No</option>
                          </select>
                        ) : fieldDef.type === 'dropdown' ? (
                          <select
                            value={getCustomFieldValue(fieldDef.id)}
                            onChange={(e) => setCustomFieldFilter(fieldDef.id, e.target.value)}
                            className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          >
                            <option value="">Any</option>
                            {fieldDef.options?.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={fieldDef.type === 'number' ? 'number' : 'text'}
                            value={getCustomFieldValue(fieldDef.id)}
                            onChange={(e) => setCustomFieldFilter(fieldDef.id, e.target.value)}
                            placeholder={`Filter by ${fieldDef.title.toLowerCase()}...`}
                            className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          {activeFilterCount > 0 && (
            <div className="px-4 py-3 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 rounded-b-xl">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} active
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Helper function to check if a card matches the filters
export function matchesFilters(
  card: {
    labels: string[];
    memberIds?: string[];
    dueDate?: string;
    completed?: boolean;
  },
  filters: FilterState,
  cardCustomFieldValues: Array<{ definitionId: string; value: string }>,
  customFieldDefs: CustomFieldDefinition[]
): boolean {
  // Check labels filter
  if (filters.labels.length > 0) {
    if (!filters.labels.some((label) => card.labels.includes(label))) {
      return false;
    }
  }

  // Check members filter
  if (filters.members.length > 0) {
    if (!filters.members.some((memberId) => card.memberIds?.includes(memberId))) {
      return false;
    }
  }

  // Check due date filter
  if (filters.dueDateFilter) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dueDate = card.dueDate ? new Date(card.dueDate) : null;

    switch (filters.dueDateFilter) {
      case 'overdue':
        if (!dueDate || dueDate >= today) return false;
        break;
      case 'today': {
        if (!dueDate) return false;
        const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
        if (dueDateOnly.getTime() !== today.getTime()) return false;
        break;
      }
      case 'this_week': {
        if (!dueDate) return false;
        const weekEnd = new Date(today);
        weekEnd.setDate(today.getDate() + (7 - today.getDay()));
        if (dueDate < today || dueDate > weekEnd) return false;
        break;
      }
      case 'this_month': {
        if (!dueDate) return false;
        const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        if (dueDate < today || dueDate > monthEnd) return false;
        break;
      }
      case 'no_date':
        if (dueDate) return false;
        break;
    }
  }

  // Check completion status
  if (filters.completionStatus) {
    const isCompleted = card.completed ?? false;
    if (filters.completionStatus === 'completed' && !isCompleted) return false;
    if (filters.completionStatus === 'not_completed' && isCompleted) return false;
  }

  // Check custom fields
  if (filters.customFields.length > 0) {
    for (const filterItem of filters.customFields) {
      const cardValue = cardCustomFieldValues.find((v) => v.definitionId === filterItem.definitionId);
      if (!cardValue) return false;

      const fieldDef = customFieldDefs.find((d) => d.id === filterItem.definitionId);
      if (fieldDef?.type === 'checkbox' || fieldDef?.type === 'dropdown') {
        if (cardValue.value !== filterItem.value) return false;
      } else {
        if (!cardValue.value.toLowerCase().includes(filterItem.value.toLowerCase())) return false;
      }
    }
  }

  return true;
}

// Default empty filter state
export const DEFAULT_FILTER_STATE: FilterState = {
  labels: [],
  members: [],
  dueDateFilter: null,
  completionStatus: null,
  customFields: [],
};
