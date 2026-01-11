import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, X, Loader2, UserPlus } from 'lucide-react';
import type { WorkspaceMember } from '../lib/api/workspaces';

interface MemberDropdownProps {
  members: WorkspaceMember[];
  selectedIds?: string[];
  excludeIds?: string[];
  onSelect: (member: WorkspaceMember) => void;
  onRemove?: (memberId: string) => void;
  placeholder?: string;
  multiple?: boolean;
  showEmail?: boolean;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  dropdownPosition?: 'bottom' | 'top';
  maxHeight?: string;
  emptyMessage?: string;
  buttonLabel?: string;
  showSelectedInButton?: boolean;
}

export default function MemberDropdown({
  members,
  selectedIds = [],
  excludeIds = [],
  onSelect,
  onRemove,
  placeholder = 'Select member...',
  multiple = false,
  showEmail = true,
  disabled = false,
  loading = false,
  className = '',
  dropdownPosition = 'bottom',
  maxHeight = '200px',
  emptyMessage = 'No members available',
  buttonLabel,
  showSelectedInButton = true,
}: MemberDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter out excluded members
  const availableMembers = members.filter(m => !excludeIds.includes(m.id));
  const selectedMembers = members.filter(m => selectedIds.includes(m.id));

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (member: WorkspaceMember) => {
    onSelect(member);
    if (!multiple) {
      setIsOpen(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getButtonContent = () => {
    if (loading) {
      return (
        <>
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          Loading...
        </>
      );
    }

    if (buttonLabel) {
      return (
        <>
          <UserPlus className="h-4 w-4 mr-2" />
          {buttonLabel}
        </>
      );
    }

    if (showSelectedInButton && selectedMembers.length > 0) {
      if (selectedMembers.length === 1) {
        return (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
              {getInitials(selectedMembers[0].displayName)}
            </div>
            <span className="truncate">{selectedMembers[0].displayName}</span>
          </div>
        );
      }
      return (
        <span className="flex items-center gap-2">
          <span className="bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded-full">
            {selectedMembers.length}
          </span>
          {selectedMembers.length} members selected
        </span>
      );
    }

    return (
      <>
        <UserPlus className="h-4 w-4 mr-2 text-gray-400" />
        {placeholder}
      </>
    );
  };

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled || loading}
        className={`w-full flex items-center justify-between px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed ${
          isOpen ? 'ring-2 ring-blue-500 border-blue-500' : ''
        }`}
      >
        <span className="flex items-center flex-1 min-w-0">
          {getButtonContent()}
        </span>
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform flex-shrink-0 ml-2 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div
          className={`absolute left-0 right-0 ${
            dropdownPosition === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'
          } bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-[9999] overflow-hidden`}
        >
          {/* Selected members (if multiple) */}
          {multiple && selectedMembers.length > 0 && (
            <div className="p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Selected:</p>
              <div className="flex flex-wrap gap-1">
                {selectedMembers.map(member => (
                  <span
                    key={member.id}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs"
                  >
                    {member.displayName}
                    {onRemove && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemove(member.id);
                        }}
                        className="hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Member list */}
          <div className="overflow-y-auto" style={{ maxHeight }}>
            {availableMembers.length === 0 ? (
              <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                {emptyMessage}
              </div>
            ) : (
              availableMembers.map(member => {
                const isSelected = selectedIds.includes(member.id);
                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => handleSelect(member)}
                    className={`w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-left ${
                      isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                      {getInitials(member.displayName)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white truncate">
                        {member.displayName}
                      </p>
                      {showEmail && member.email && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {member.email}
                        </p>
                      )}
                    </div>
                    {isSelected && (
                      <Check className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
