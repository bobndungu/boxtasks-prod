import {
  LayoutGrid,
  Calendar,
  GanttChart,
  Table,
  LayoutDashboard,
  ChevronDown,
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

export type ViewType = 'kanban' | 'calendar' | 'timeline' | 'table' | 'dashboard';

interface ViewSelectorProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  className?: string;
}

const VIEW_OPTIONS: { type: ViewType; label: string; icon: React.ReactNode }[] = [
  { type: 'kanban', label: 'Kanban', icon: <LayoutGrid className="h-4 w-4" /> },
  { type: 'calendar', label: 'Calendar', icon: <Calendar className="h-4 w-4" /> },
  { type: 'timeline', label: 'Timeline', icon: <GanttChart className="h-4 w-4" /> },
  { type: 'table', label: 'Table', icon: <Table className="h-4 w-4" /> },
  { type: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
];

export function ViewSelector({ currentView, onViewChange, className = '' }: ViewSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentOption = VIEW_OPTIONS.find((v) => v.type === currentView) || VIEW_OPTIONS[0];

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

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-md text-sm transition-colors"
      >
        {currentOption.icon}
        <span>{currentOption.label}</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-44 bg-white rounded-lg shadow-lg py-1 z-50">
          {VIEW_OPTIONS.map((option) => (
            <button
              key={option.type}
              onClick={() => {
                onViewChange(option.type);
                setIsOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-100 transition-colors ${
                currentView === option.type
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-700'
              }`}
            >
              <span className={currentView === option.type ? 'text-blue-600' : 'text-gray-400'}>
                {option.icon}
              </span>
              <span>{option.label}</span>
              {currentView === option.type && (
                <svg className="ml-auto h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default ViewSelector;
