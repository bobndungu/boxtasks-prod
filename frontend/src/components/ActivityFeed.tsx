import { useState, useEffect } from 'react';
import { Clock, ArrowRight, RefreshCw, CheckCircle, Archive, Trash2, MessageSquare, User, Tag, Calendar, Paperclip, FileText, Building, Users } from 'lucide-react';
import { fetchActivitiesByCard, fetchActivitiesByBoard, type Activity, type ActivityType, getActivityDisplay } from '../lib/api/activities';
import ActivityDiff from './ActivityDiff';
import { formatDateShort } from '../lib/utils/date';

interface ActivityFeedProps {
  cardId?: string;
  boardId?: string;
  maxItems?: number;
  showDiffs?: boolean;
  compact?: boolean;
}

interface ActivityMeta {
  oldValue?: string;
  newValue?: string;
  fieldName?: string;
  fromList?: string;
  toList?: string;
}

// Parse activity description for metadata
function parseActivityMeta(description: string, type: ActivityType): ActivityMeta {
  const meta: ActivityMeta = {};

  // First, try to parse the entire description as JSON (new format from Drupal)
  try {
    if (description.startsWith('{') && description.endsWith('}')) {
      const parsed = JSON.parse(description);
      if (parsed.old !== undefined) meta.oldValue = parsed.old;
      if (parsed.new !== undefined) meta.newValue = parsed.new;
      if (parsed.field) meta.fieldName = formatFieldName(parsed.field);
      if (parsed.from_list) meta.fromList = parsed.from_list;
      if (parsed.to_list) meta.toList = parsed.to_list;
      return meta;
    }
  } catch {
    // Not JSON format, continue with regex parsing
  }

  // Parse card movement: "moved from X to Y"
  if (type === 'card_moved') {
    const moveMatch = description.match(/from "?([^"]+)"? to "?([^"]+)"?/i);
    if (moveMatch) {
      meta.fromList = moveMatch[1];
      meta.toList = moveMatch[2];
    }
  }

  // Parse field changes: "changed X from Y to Z"
  const changeMatch = description.match(/changed (\w+) from "?([^"]+)"? to "?([^"]+)"?/i);
  if (changeMatch) {
    meta.fieldName = changeMatch[1];
    meta.oldValue = changeMatch[2];
    meta.newValue = changeMatch[3];
  }

  // Parse description updates: old vs new description in JSON format (legacy)
  if (type === 'description_updated' || type === 'card_updated') {
    try {
      const jsonMatch = description.match(/\{[^}]+\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        meta.oldValue = parsed.old || parsed.oldValue;
        meta.newValue = parsed.new || parsed.newValue;
        meta.fieldName = parsed.field ? formatFieldName(parsed.field) : 'Description';
      }
    } catch {
      // Not JSON format, use as-is
    }
  }

  return meta;
}

// Format field name for display
function formatFieldName(fieldName: string): string {
  // Remove common prefixes
  const name = fieldName.replace(/^field_card_/, '').replace(/^field_/, '');
  // Convert snake_case to Title Case
  return name
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
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
    case 'department_set':
    case 'department_changed':
    case 'department_removed':
      return <Building className="h-4 w-4 text-teal-500" />;
    case 'client_set':
    case 'client_changed':
    case 'client_removed':
      return <Users className="h-4 w-4 text-pink-500" />;
    default:
      return <Clock className="h-4 w-4 text-gray-500" />;
  }
}

// Format relative time
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDateShort(date);
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
        const meta = parseActivityMeta(activity.description || '', activity.type);

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

                {/* Card movement visualization */}
                {activity.type === 'card_moved' && meta.fromList && meta.toList && (
                  <div className="mt-2 flex items-center gap-2 text-sm">
                    <span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-gray-700 dark:text-gray-300">
                      {meta.fromList}
                    </span>
                    <ArrowRight className="h-4 w-4 text-gray-400" />
                    <span className="bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded text-blue-700 dark:text-blue-300">
                      {meta.toList}
                    </span>
                  </div>
                )}

                {/* Field change diff */}
                {showDiffs && meta.oldValue && meta.newValue && (
                  <ActivityDiff
                    oldText={meta.oldValue}
                    newText={meta.newValue}
                    fieldName={meta.fieldName}
                    showInline={true}
                  />
                )}

                {/* Activity description (if no diff parsed) */}
                {activity.description && !meta.oldValue && !meta.fromList && (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                    {activity.description}
                  </p>
                )}

                {/* Timestamp */}
                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                  {formatRelativeTime(activity.createdAt)}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
