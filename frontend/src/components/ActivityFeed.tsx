import { useState, useEffect } from 'react';
import { Clock, ArrowRight, RefreshCw, CheckCircle, Archive, Trash2, MessageSquare, User, Tag, Calendar, Paperclip, FileText, Building, Users, Pencil } from 'lucide-react';
import { fetchActivitiesByCard, fetchActivitiesByBoard, type Activity, type ActivityType, type ActivityData, getActivityDisplay } from '../lib/api/activities';
import ActivityDiff from './ActivityDiff';

interface ActivityFeedProps {
  cardId?: string;
  boardId?: string;
  maxItems?: number;
  showDiffs?: boolean;
  compact?: boolean;
}

// Format date for display (e.g., "2024-01-15" -> "Jan 15, 2024")
function formatDateValue(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}


// Get icon for activity type
function getActivityIcon(type: ActivityType) {
  switch (type) {
    case 'card_created':
      return <Clock className="h-4 w-4 text-blue-500" />;
    case 'card_moved':
      return <ArrowRight className="h-4 w-4 text-purple-500" />;
    case 'card_completed':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'card_archived':
    case 'list_archived':
      return <Archive className="h-4 w-4 text-orange-500" />;
    case 'card_restored':
      return <RefreshCw className="h-4 w-4 text-green-500" />;
    case 'card_deleted':
      return <Trash2 className="h-4 w-4 text-red-500" />;
    case 'comment_added':
    case 'comment_updated':
    case 'comment_deleted':
      return <MessageSquare className="h-4 w-4 text-blue-500" />;
    case 'member_added':
    case 'member_removed':
      return <User className="h-4 w-4 text-indigo-500" />;
    case 'label_added':
    case 'label_removed':
      return <Tag className="h-4 w-4 text-yellow-500" />;
    case 'due_date_set':
    case 'due_date_removed':
    case 'due_date_updated':
    case 'start_date_set':
    case 'start_date_removed':
    case 'start_date_updated':
      return <Calendar className="h-4 w-4 text-red-500" />;
    case 'attachment_added':
    case 'attachment_removed':
      return <Paperclip className="h-4 w-4 text-gray-500" />;
    case 'description_updated':
      return <FileText className="h-4 w-4 text-gray-500" />;
    case 'title_updated':
      return <Pencil className="h-4 w-4 text-blue-500" />;
    case 'department_set':
    case 'department_changed':
    case 'department_removed':
      return <Building className="h-4 w-4 text-teal-500" />;
    case 'client_set':
    case 'client_changed':
    case 'client_removed':
      return <Users className="h-4 w-4 text-pink-500" />;
    case 'custom_field_updated':
      return <Pencil className="h-4 w-4 text-purple-500" />;
    default:
      return <Clock className="h-4 w-4 text-gray-500" />;
  }
}

// Format activity time with full date and relative time
function formatActivityTime(dateStr: string): { fullDate: string; relative: string } {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // Full date format: "Jan 15 at 2:30:45 PM"
  const fullDate = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  }) + ' at ' + date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });

  // Relative time
  let relative: string;
  if (diffMins < 1) {
    relative = 'Just now';
  } else if (diffMins < 60) {
    relative = `${diffMins}m ago`;
  } else if (diffHours < 24) {
    relative = `${diffHours}h ago`;
  } else if (diffDays < 7) {
    relative = `${diffDays}d ago`;
  } else {
    relative = `${Math.floor(diffDays / 7)}w ago`;
  }

  return { fullDate, relative };
}

// Component to display activity data with diffs
function ActivityDataDisplay({ type, data }: { type: ActivityType; data: ActivityData | null }) {
  if (!data) return null;

  // Card moved - show from/to lists
  if (type === 'card_moved' && data.from_list && data.to_list) {
    return (
      <div className="mt-1.5 flex items-center gap-1.5 text-xs">
        <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded">
          {data.from_list}
        </span>
        <ArrowRight className="h-3 w-3 text-gray-400 flex-shrink-0" />
        <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded">
          {data.to_list}
        </span>
      </div>
    );
  }

  // Due date changes
  if ((type === 'due_date_set' || type === 'due_date_updated' || type === 'due_date_removed') && (data.old_value || data.new_value || data.due_date)) {
    const oldDate = data.old_value ? formatDateValue(data.old_value) : null;
    const newDate = data.new_value || data.due_date ? formatDateValue(data.new_value || data.due_date || '') : null;

    if (type === 'due_date_set' && newDate) {
      return (
        <div className="mt-1.5 text-xs">
          <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-1.5 py-0.5 rounded">
            {newDate}
          </span>
        </div>
      );
    }

    if (type === 'due_date_removed' && oldDate) {
      return (
        <div className="mt-1.5 text-xs">
          <span className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-1.5 py-0.5 rounded line-through">
            {oldDate}
          </span>
        </div>
      );
    }

    if (type === 'due_date_updated' && oldDate && newDate) {
      return (
        <div className="mt-1.5 flex items-center gap-1.5 text-xs">
          <span className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-1.5 py-0.5 rounded line-through">
            {oldDate}
          </span>
          <ArrowRight className="h-3 w-3 text-gray-400 flex-shrink-0" />
          <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-1.5 py-0.5 rounded">
            {newDate}
          </span>
        </div>
      );
    }
  }

  // Start date changes
  if ((type === 'start_date_set' || type === 'start_date_updated' || type === 'start_date_removed') && (data.old_value || data.new_value || data.start_date)) {
    const oldDate = data.old_value ? formatDateValue(data.old_value) : null;
    const newDate = data.new_value || data.start_date ? formatDateValue(data.new_value || data.start_date || '') : null;

    if (type === 'start_date_set' && newDate) {
      return (
        <div className="mt-1.5 text-xs">
          <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-1.5 py-0.5 rounded">
            {newDate}
          </span>
        </div>
      );
    }

    if (type === 'start_date_removed' && oldDate) {
      return (
        <div className="mt-1.5 text-xs">
          <span className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-1.5 py-0.5 rounded line-through">
            {oldDate}
          </span>
        </div>
      );
    }

    if (type === 'start_date_updated' && oldDate && newDate) {
      return (
        <div className="mt-1.5 flex items-center gap-1.5 text-xs">
          <span className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-1.5 py-0.5 rounded line-through">
            {oldDate}
          </span>
          <ArrowRight className="h-3 w-3 text-gray-400 flex-shrink-0" />
          <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-1.5 py-0.5 rounded">
            {newDate}
          </span>
        </div>
      );
    }
  }

  // Title changes
  if (data.old_value && data.new_value && (type === 'title_updated' || type === 'card_updated' || data.field_name === 'title')) {
    // Check if this looks like a title change (not too long)
    if (data.old_value.length < 200 && data.new_value.length < 200) {
      return (
        <div className="mt-1.5 flex items-center gap-1.5 text-xs flex-wrap">
          <span className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-1.5 py-0.5 rounded line-through">
            {data.old_value}
          </span>
          <ArrowRight className="h-3 w-3 text-gray-400 flex-shrink-0" />
          <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-1.5 py-0.5 rounded">
            {data.new_value}
          </span>
        </div>
      );
    }
  }

  // Label changes
  if ((type === 'label_added' || type === 'label_removed') && data.label) {
    return (
      <div className="mt-1.5 text-xs">
        <span className={`px-1.5 py-0.5 rounded ${
          type === 'label_added'
            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
            : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 line-through'
        }`}>
          {data.label}
        </span>
      </div>
    );
  }

  // Member changes
  if ((type === 'member_added' || type === 'member_removed') && data.member_name) {
    return (
      <div className="mt-1.5 text-xs">
        <span className={`px-1.5 py-0.5 rounded ${
          type === 'member_added'
            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
            : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
        }`}>
          {data.member_name}
        </span>
      </div>
    );
  }

  // Checklist changes
  if (type === 'checklist_added' && data.checklist_name) {
    return (
      <div className="mt-1.5 text-xs">
        <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-1.5 py-0.5 rounded">
          {data.checklist_name}
        </span>
      </div>
    );
  }

  // Comment added/updated - show comment text
  if ((type === 'comment_added' || type === 'comment_updated') && data.comment_text) {
    return (
      <div className="mt-1.5 text-xs">
        <div className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1.5 rounded italic">
          "{data.comment_text}"
        </div>
      </div>
    );
  }

  // Custom field changes
  if (type === 'custom_field_updated' && data.field_name) {
    // If we have old and new values, show diff
    if (data.old_value && data.new_value) {
      return (
        <div className="mt-1.5 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-medium text-gray-600 dark:text-gray-400">{data.field_name}:</span>
            <span className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-1.5 py-0.5 rounded line-through">
              {data.old_value}
            </span>
            <ArrowRight className="h-3 w-3 text-gray-400 flex-shrink-0" />
            <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-1.5 py-0.5 rounded">
              {data.new_value}
            </span>
          </div>
        </div>
      );
    }
    // Just new value (first time set)
    if (data.new_value) {
      return (
        <div className="mt-1.5 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-medium text-gray-600 dark:text-gray-400">{data.field_name}:</span>
            <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-1.5 py-0.5 rounded">
              {data.new_value}
            </span>
          </div>
        </div>
      );
    }
  }

  return null;
}

export default function ActivityFeed({
  cardId,
  boardId,
  maxItems = 20,
  showDiffs = true,
  compact = false,
}: ActivityFeedProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadActivities = async () => {
      setLoading(true);
      setError(null);
      try {
        let data: Activity[] = [];
        if (cardId) {
          data = await fetchActivitiesByCard(cardId);
        } else if (boardId) {
          data = await fetchActivitiesByBoard(boardId);
        }
        setActivities(data.slice(0, maxItems));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load activities');
      } finally {
        setLoading(false);
      }
    };

    if (cardId || boardId) {
      loadActivities();
    }
  }, [cardId, boardId, maxItems]);

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-red-600 dark:text-red-400 py-2">
        {error}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-4">
        <Clock className="h-8 w-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
        <p className="text-sm text-gray-500 dark:text-gray-400">No activity yet</p>
      </div>
    );
  }

  return (
    <div className={compact ? 'space-y-2' : 'space-y-4'}>
      {activities.map((activity) => {
        const display = getActivityDisplay(activity.type);
        const time = formatActivityTime(activity.createdAt);
        const hasStructuredData = activity.data && (
          activity.data.from_list ||
          activity.data.to_list ||
          activity.data.old_value ||
          activity.data.new_value ||
          activity.data.due_date ||
          activity.data.start_date ||
          activity.data.label ||
          activity.data.member_name ||
          activity.data.checklist_name ||
          activity.data.comment_text ||
          activity.data.field_name
        );

        return (
          <div
            key={activity.id}
            className={`${compact ? 'py-1' : 'py-2'} border-b border-gray-100 dark:border-gray-700 last:border-0`}
          >
            <div className="flex items-start gap-3">
              {/* Avatar */}
              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 text-sm font-medium flex-shrink-0">
                {activity.authorName.charAt(0).toUpperCase()}
              </div>

              <div className="flex-1 min-w-0">
                {/* Activity header */}
                <div className="flex items-center gap-2">
                  {getActivityIcon(activity.type)}
                  <p className="text-sm text-gray-900 dark:text-white">
                    <span className="font-medium">{activity.authorName}</span>
                    {' '}
                    <span className="text-gray-600 dark:text-gray-400">
                      {display.label}
                    </span>
                  </p>
                </div>

                {/* Structured activity data display */}
                {showDiffs && <ActivityDataDisplay type={activity.type} data={activity.data} />}

                {/* Description diff for text changes (description field) */}
                {showDiffs && activity.type === 'description_updated' && activity.data?.old_value && activity.data?.new_value && (
                  <ActivityDiff
                    oldText={activity.data.old_value}
                    newText={activity.data.new_value}
                    fieldName="Description"
                    showInline={true}
                  />
                )}

                {/* Fallback: Activity description (if no structured data) */}
                {activity.description && !hasStructuredData && (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                    {activity.description}
                  </p>
                )}

                {/* Timestamp with full date and relative time */}
                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                  {time.fullDate} · {time.relative}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
