import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Check,
  Edit2,
  Archive,
  Pin,
  Calendar,
  Clock,
  MessageCircle,
  Paperclip,
  CheckSquare,
  X,
} from 'lucide-react';
import { LABEL_COLORS } from './constants';
import type { SortableCardProps } from './types';
import { highlightText } from '../../lib/utils/highlight';
import { formatDateCompactNoYear, formatDateTimeCompactNoYear, formatDateRangeNoYear } from '../../lib/utils/date';

export function SortableCard({
  card,
  onClick,
  onQuickComplete,
  onQuickArchive,
  onQuickEdit,
  customFieldDefs,
  cardCustomFieldValues,
  searchQuery = '',
  fieldVisibility,
  canArchiveCard,
}: SortableCardProps) {
  const [showQuickActions, setShowQuickActions] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow ${
        card.completed ? 'opacity-60' : ''
      } ${card.pinned ? 'ring-2 ring-amber-400' : ''}`}
      onMouseEnter={() => setShowQuickActions(true)}
      onMouseLeave={() => setShowQuickActions(false)}
    >
      {/* Pin Indicator */}
      {card.pinned && (
        <div className="absolute -top-1 -left-1 z-10">
          <div className="bg-amber-400 text-white p-1 rounded-full shadow-md" title="Pinned to top">
            <Pin className="h-3 w-3 fill-current" />
          </div>
        </div>
      )}

      {/* Quick Actions - appear on hover */}
      {showQuickActions && !isDragging && (
        <div className="absolute top-1 right-1 flex items-center gap-0.5 z-10">
          <button
            onClick={onQuickComplete}
            className={`p-1 rounded transition-colors ${
              card.completed
                ? 'bg-green-500 text-white hover:bg-green-600'
                : 'bg-white/90 text-gray-600 hover:bg-green-50 hover:text-green-600 shadow-sm'
            }`}
            title={card.completed ? 'Mark incomplete' : 'Mark complete'}
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onQuickEdit}
            className="p-1 bg-white/90 text-gray-600 rounded shadow-sm hover:bg-blue-50 hover:text-blue-600 transition-colors"
            title="Edit card"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          {canArchiveCard && (
            <button
              onClick={onQuickArchive}
              className="p-1 bg-white/90 text-gray-600 rounded shadow-sm hover:bg-orange-50 hover:text-orange-600 transition-colors"
              title="Archive card"
            >
              <Archive className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Cover Image */}
      {card.coverImageUrl && (
        <div
          className="w-full h-32 bg-cover bg-center rounded-t-lg"
          style={{ backgroundImage: `url(${card.coverImageUrl})` }}
          {...attributes}
          {...listeners}
          onClick={onClick}
        />
      )}

      {/* Card Content - draggable area */}
      <div
        {...attributes}
        {...listeners}
        onClick={onClick}
        className={`p-3 cursor-grab active:cursor-grabbing ${card.coverImageUrl ? 'pt-2' : ''}`}
      >
        {fieldVisibility.labels && card.labels.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {card.labels.map((label) => (
              fieldVisibility.expanded ? (
                <div
                  key={label}
                  className="px-2 py-0.5 rounded text-xs font-medium text-white"
                  style={{ backgroundColor: LABEL_COLORS[label] }}
                >
                  {label.charAt(0).toUpperCase() + label.slice(1)}
                </div>
              ) : (
                <div
                  key={label}
                  className="w-10 h-2 rounded"
                  style={{ backgroundColor: LABEL_COLORS[label] }}
                />
              )
            ))}
          </div>
        )}
        <div className="flex items-start gap-2">
          {card.completed && (
            <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Check className="h-3 w-3 text-white" />
            </div>
          )}
          <p className={`text-sm ${card.completed ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
            {searchQuery ? highlightText(card.title, searchQuery) : card.title}
          </p>
        </div>

        {/* Approval/Rejection Status Badge */}
        {(card.isApproved || card.isRejected) && (
          <div className={`mt-2 flex items-center gap-1 text-xs px-1.5 py-0.5 rounded ${
            card.isApproved
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {card.isApproved ? (
              <>
                <Check className="h-3 w-3" />
                <span>Approved{card.approvedBy?.name ? ` by ${card.approvedBy.name}` : ''}</span>
              </>
            ) : (
              <>
                <X className="h-3 w-3" />
                <span>Rejected{card.rejectedBy?.name ? ` by ${card.rejectedBy.name}` : ''}</span>
              </>
            )}
          </div>
        )}

        {/* Description preview - expanded view only */}
        {fieldVisibility.expanded && card.description && (
          <p className="text-xs text-gray-500 mt-2 line-clamp-2 leading-relaxed">
            {card.description.length > 120 ? card.description.substring(0, 120) + '...' : card.description}
          </p>
        )}

        {/* Checklist and Comment counts - controlled by Show/Hide settings */}
        {!fieldVisibility.expanded && (
          (fieldVisibility.checklists && card.checklistTotal > 0) ||
          (fieldVisibility.comments && card.commentCount > 0)
        ) && (
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {fieldVisibility.checklists && card.checklistTotal > 0 && (
              <span className={`flex items-center gap-1 text-xs px-1.5 py-0.5 rounded ${
                card.checklistCompleted === card.checklistTotal
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
              }`}>
                <CheckSquare className="h-3 w-3" />
                {card.checklistCompleted}/{card.checklistTotal}
              </span>
            )}
            {fieldVisibility.comments && card.commentCount > 0 && (
              <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                <MessageCircle className="h-3 w-3" />
                {card.commentCount}
              </span>
            )}
          </div>
        )}

        {/* Activity badges - expanded view only */}
        {fieldVisibility.expanded && (card.commentCount > 0 || card.attachmentCount > 0 || card.checklistTotal > 0) && (
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {card.commentCount > 0 && (
              <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                <MessageCircle className="h-3 w-3" />
                {card.commentCount}
              </span>
            )}
            {card.attachmentCount > 0 && (
              <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                <Paperclip className="h-3 w-3" />
                {card.attachmentCount}
              </span>
            )}
            {card.checklistTotal > 0 && (
              <span className={`flex items-center gap-1 text-xs px-1.5 py-0.5 rounded ${
                card.checklistCompleted === card.checklistTotal
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
              }`}>
                <CheckSquare className="h-3 w-3" />
                {card.checklistCompleted}/{card.checklistTotal}
              </span>
            )}
          </div>
        )}

        {/* Dates */}
        {((fieldVisibility.startDate && card.startDate) || (fieldVisibility.dueDate && card.dueDate) || card.description) && (
          <div className="flex items-center gap-2 mt-2 text-xs text-gray-500 flex-wrap">
            {(() => {
              // Check if we can show a combined date range (same day with both dates)
              const dateRange = fieldVisibility.startDate && fieldVisibility.dueDate
                ? formatDateRangeNoYear(card.startDate, card.dueDate)
                : null;

              if (dateRange?.combined) {
                // Same day - show combined format "4:00 PM - 7:00 PM on 15 Jan 2026"
                const dueDate = new Date(card.dueDate!);
                const now = new Date();
                const diffMs = dueDate.getTime() - now.getTime();
                const diffHours = diffMs / (1000 * 60 * 60);

                let colorClass = 'text-gray-500 dark:text-gray-400';
                let bgClass = '';

                if (card.completed) {
                  colorClass = 'text-green-600 dark:text-green-400';
                  bgClass = 'bg-green-50 dark:bg-green-900/20';
                } else if (diffHours < 0) {
                  // Overdue
                  colorClass = 'text-red-600 dark:text-red-400';
                  bgClass = 'bg-red-50 dark:bg-red-900/20';
                } else if (diffHours <= 1) {
                  // Due within 1 hour
                  colorClass = 'text-amber-600 dark:text-amber-400';
                  bgClass = 'bg-amber-50 dark:bg-amber-900/20';
                }
                // More than 1 hour away = gray (default)

                return (
                  <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${colorClass} ${bgClass}`}>
                    <Calendar className="h-3 w-3" />
                    <span>{dateRange.display}</span>
                  </span>
                );
              }

              // Different days or only one date - show separately
              return (
                <>
                  {fieldVisibility.startDate && card.startDate && (() => {
                    const startDate = new Date(card.startDate);
                    const hasTime = startDate.getHours() !== 0 || startDate.getMinutes() !== 0;

                    return (
                      <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20">
                        <Clock className="h-3 w-3" />
                        <span>{hasTime ? formatDateTimeCompactNoYear(card.startDate) : formatDateCompactNoYear(card.startDate)}</span>
                      </span>
                    );
                  })()}
                  {fieldVisibility.dueDate && card.dueDate && (() => {
                    const dueDate = new Date(card.dueDate);
                    const now = new Date();
                    const diffMs = dueDate.getTime() - now.getTime();
                    const diffHours = diffMs / (1000 * 60 * 60);

                    let colorClass = 'text-gray-500 dark:text-gray-400';
                    let bgClass = '';

                    if (card.completed) {
                      colorClass = 'text-green-600 dark:text-green-400';
                      bgClass = 'bg-green-50 dark:bg-green-900/20';
                    } else if (diffHours < 0) {
                      // Overdue
                      colorClass = 'text-red-600 dark:text-red-400';
                      bgClass = 'bg-red-50 dark:bg-red-900/20';
                    } else if (diffHours <= 1) {
                      // Due within 1 hour
                      colorClass = 'text-amber-600 dark:text-amber-400';
                      bgClass = 'bg-amber-50 dark:bg-amber-900/20';
                    }
                    // More than 1 hour away = gray (default)

                    const hasTime = dueDate.getHours() !== 0 || dueDate.getMinutes() !== 0;

                    return (
                      <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${colorClass} ${bgClass}`}>
                        <Calendar className="h-3 w-3" />
                        <span>Due: {hasTime ? formatDateTimeCompactNoYear(card.dueDate) : formatDateCompactNoYear(card.dueDate)}</span>
                      </span>
                    );
                  })()}
                </>
              );
            })()}
          </div>
        )}

        {/* Member Names */}
        {fieldVisibility.members && card.members && card.members.length > 0 && (
          <div className="flex justify-end mt-2">
            <div className="text-xs text-gray-500 dark:text-gray-400 text-right">
              {card.members.map((member, index) => (
                <span key={member.id}>
                  {member.name}
                  {index < card.members.length - 1 && ', '}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Custom Fields */}
        {fieldVisibility.customFields && cardCustomFieldValues.length > 0 && customFieldDefs.length > 0 && (
          <div className="mt-2 space-y-1">
            {(fieldVisibility.expanded ? cardCustomFieldValues : cardCustomFieldValues.slice(0, 2)).map((cfv) => {
              const fieldDef = customFieldDefs.find((d) => d.id === cfv.definitionId);
              if (!fieldDef || !cfv.value) return null;

              let displayValue: React.ReactNode = cfv.value;
              const truncateLength = fieldVisibility.expanded ? 60 : 30;

              if (fieldDef.type === 'date' && cfv.value) {
                displayValue = formatDateCompactNoYear(cfv.value);
              } else if (fieldDef.type === 'checkbox') {
                displayValue = cfv.value === 'true' ? 'Yes' : 'No';
              } else if (fieldDef.type === 'currency' && cfv.value) {
                displayValue = `$${parseFloat(cfv.value).toFixed(2)}`;
              } else if (fieldDef.type === 'rating' && cfv.value) {
                const rating = parseInt(cfv.value);
                displayValue = (
                  <span className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <svg
                        key={star}
                        className={`w-3 h-3 ${star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </span>
                );
              } else if (fieldDef.type === 'longtext' && cfv.value) {
                displayValue = cfv.value.length > truncateLength ? cfv.value.substring(0, truncateLength) + '...' : cfv.value;
              } else if (fieldDef.type === 'url' && cfv.value) {
                try {
                  const url = new URL(cfv.value);
                  displayValue = url.hostname;
                } catch {
                  displayValue = cfv.value;
                }
              }

              return (
                <div key={cfv.id} className="flex items-center text-xs text-gray-500">
                  <span className={`font-medium text-gray-600 truncate ${fieldVisibility.expanded ? 'max-w-[100px]' : 'max-w-[60px]'}`}>{fieldDef.title}:</span>
                  <span className="ml-1 truncate">{displayValue}</span>
                </div>
              );
            })}
            {!fieldVisibility.expanded && cardCustomFieldValues.length > 2 && (
              <div className="text-xs text-gray-400">
                +{cardCustomFieldValues.length - 2} more fields
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
