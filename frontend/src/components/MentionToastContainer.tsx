import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, AtSign, ExternalLink } from 'lucide-react';
import { useMentionToastStore, type MentionToast } from '../lib/stores/mentionToasts';
import { useAuthStore } from '../lib/stores/auth';
import { useUserNotifications } from '../lib/hooks/useMercure';
import {
  fetchNotifications,
  markNotificationRead,
  fetchCardBoardId,
  type Notification,
} from '../lib/api/notifications';

// Format relative time
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// Single mention toast component
function MentionToastItem({ toast, onClose, onClick }: {
  toast: MentionToast;
  onClose: () => void;
  onClick: () => void;
}) {
  return (
    <div
      className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-purple-200 dark:border-purple-800 p-4 max-w-sm animate-slide-up cursor-pointer hover:shadow-xl transition-shadow"
      onClick={onClick}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="flex-shrink-0 w-10 h-10 bg-purple-100 dark:bg-purple-900/40 rounded-full flex items-center justify-center">
          <AtSign className="h-5 w-5 text-purple-600 dark:text-purple-400" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-gray-900 dark:text-white text-sm">
              {toast.actorName}
            </span>
            <span className="text-gray-500 dark:text-gray-400 text-xs">
              mentioned you
            </span>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 mb-2">
            {toast.message}
          </p>

          <div className="flex items-center gap-2 text-xs text-purple-600 dark:text-purple-400">
            <ExternalLink className="h-3 w-3" />
            <span className="truncate">{toast.cardTitle}</span>
          </div>

          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            {formatRelativeTime(toast.createdAt)}
          </p>
        </div>

        {/* Close button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          aria-label="Dismiss notification"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// Main container component
export function MentionToastContainer() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const { toasts, addToast, removeToast, clearAll, isToastDismissed, setToasts } = useMentionToastStore();

  // Handle real-time notification via Mercure
  const handleRealtimeNotification = useCallback((notification: unknown) => {
    const notif = notification as Notification;

    // Only handle @mention notifications
    if (notif.type !== 'mentioned') return;
    if (!notif.cardId || !notif.cardTitle) return;

    // Create toast from notification
    const toast: MentionToast = {
      id: `toast-${notif.id}-${Date.now()}`,
      notificationId: notif.id,
      cardId: notif.cardId,
      cardTitle: notif.cardTitle,
      actorName: notif.actorName || 'Someone',
      message: notif.message,
      createdAt: notif.createdAt,
    };

    addToast(toast);
  }, [addToast]);

  // Subscribe to real-time notifications
  useUserNotifications(user?.id, handleRealtimeNotification);

  // Load unread @mention notifications on mount
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    const loadUnreadMentions = async () => {
      try {
        const notifications = await fetchNotifications(user.id);

        // Filter for unread @mention notifications
        const unreadMentions = notifications.filter(
          (n) => n.type === 'mentioned' && !n.read && n.cardId && n.cardTitle
        );

        // Convert to toast format
        const mentionToasts: MentionToast[] = unreadMentions
          .filter((n) => !isToastDismissed(n.id))
          .map((n) => ({
            id: `toast-${n.id}`,
            notificationId: n.id,
            cardId: n.cardId!,
            cardTitle: n.cardTitle!,
            actorName: n.actorName || 'Someone',
            message: n.message,
            createdAt: n.createdAt,
          }));

        setToasts(mentionToasts);
      } catch (error) {
        console.error('Failed to load unread mentions:', error);
      }
    };

    loadUnreadMentions();
  }, [isAuthenticated, user?.id, isToastDismissed, setToasts]);

  // Handle toast click - navigate to card
  const handleToastClick = async (toast: MentionToast) => {
    try {
      // Mark as read
      await markNotificationRead(toast.notificationId);

      // Get board ID and navigate
      const boardId = await fetchCardBoardId(toast.cardId);
      if (boardId) {
        navigate(`/board/${boardId}?card=${toast.cardId}`);
      }

      // Remove the toast
      removeToast(toast.id);
    } catch (error) {
      console.error('Failed to handle toast click:', error);
      // Still remove the toast even if navigation fails
      removeToast(toast.id);
    }
  };

  // Handle close - just dismiss without navigating
  const handleClose = async (toast: MentionToast) => {
    try {
      // Mark as read
      await markNotificationRead(toast.notificationId);
    } catch {
      // Ignore errors
    }
    removeToast(toast.id);
  };

  // Don't render if not authenticated or no toasts
  if (!isAuthenticated || toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-32 md:bottom-24 right-4 z-40 flex flex-col gap-3 max-h-[60vh] overflow-y-auto"
      role="region"
      aria-label="Mention notifications"
    >
      {/* Clear all button if multiple toasts */}
      {toasts.length > 1 && (
        <div className="flex justify-end mb-1">
          <button
            onClick={clearAll}
            className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 bg-white dark:bg-gray-800 px-2 py-1 rounded shadow border border-gray-200 dark:border-gray-700"
          >
            Dismiss all ({toasts.length})
          </button>
        </div>
      )}

      {/* Toast stack - newest at bottom so older ones are on top */}
      {toasts.map((toast) => (
        <MentionToastItem
          key={toast.id}
          toast={toast}
          onClose={() => handleClose(toast)}
          onClick={() => handleToastClick(toast)}
        />
      ))}
    </div>
  );
}

export default MentionToastContainer;
