import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  Check,
  CheckCheck,
  X,
  Clock,
  ExternalLink,
  ArrowLeft,
  Settings,
  User,
  AlarmClock,
  MessageSquare,
  AtSign,
  ArrowRight,
  CheckCircle,
  CheckSquare,
  Calendar,
  Tag,
  Target,
  Trophy,
  AlertTriangle,
  Flag,
  PartyPopper,
  XCircle,
  Archive,
  RefreshCw,
} from 'lucide-react';
import { useAuthStore } from '../lib/stores/auth';
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  getNotificationDisplay,
  type Notification,
  type NotificationIconName,
} from '../lib/api/notifications';
import { formatDateShort } from '../lib/utils/date';
import MainHeader from '../components/MainHeader';

// Decode HTML entities (for quotation marks and other special characters)
function decodeHtmlEntities(text: string): string {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
}

// Map icon names to Lucide icon components
function getNotificationIcon(iconName: NotificationIconName, colorClass: string) {
  const iconProps = { className: `h-5 w-5 ${colorClass}` };

  switch (iconName) {
    case 'user':
      return <User {...iconProps} />;
    case 'alarm-clock':
      return <AlarmClock {...iconProps} />;
    case 'message-square':
      return <MessageSquare {...iconProps} />;
    case 'at-sign':
      return <AtSign {...iconProps} />;
    case 'arrow-right':
      return <ArrowRight {...iconProps} />;
    case 'check-circle':
      return <CheckCircle {...iconProps} />;
    case 'check-square':
      return <CheckSquare {...iconProps} />;
    case 'calendar':
      return <Calendar {...iconProps} />;
    case 'tag':
      return <Tag {...iconProps} />;
    case 'target':
      return <Target {...iconProps} />;
    case 'trophy':
      return <Trophy {...iconProps} />;
    case 'alert-triangle':
      return <AlertTriangle {...iconProps} />;
    case 'flag':
      return <Flag {...iconProps} />;
    case 'party-popper':
      return <PartyPopper {...iconProps} />;
    case 'x-circle':
      return <XCircle {...iconProps} />;
    case 'archive':
      return <Archive {...iconProps} />;
    case 'refresh-cw':
      return <RefreshCw {...iconProps} />;
    case 'bell':
    default:
      return <Bell {...iconProps} />;
  }
}

export default function Notifications() {
  const { user } = useAuthStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadNotifications = useCallback(async () => {
    if (!user?.id) return;

    setIsLoading(true);
    try {
      const notifs = await fetchNotifications(user.id);
      setNotifications(notifs);
      setUnreadCount(notifs.filter(n => !n.read).length);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleMarkAsRead = async (notification: Notification) => {
    if (notification.read) return;

    try {
      await markNotificationRead(notification.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!user?.id || unreadCount === 0) return;

    try {
      await markAllNotificationsRead(user.id);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  const handleDelete = async (notificationId: string) => {
    try {
      await deleteNotification(notificationId);
      const deleted = notifications.find((n) => n.id === notificationId);
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      if (deleted && !deleted.read) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  const formatTime = (dateStr: string) => {
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
    return formatDateShort(date);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <MainHeader />

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link
              to="/dashboard"
              className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Notifications</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="flex items-center px-4 py-2 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
              >
                <CheckCheck className="h-4 w-4 mr-2" />
                Mark all as read
              </button>
            )}
            <Link
              to="/notifications/settings"
              className="flex items-center px-4 py-2 text-sm text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Link>
          </div>
        </div>

        {/* Notifications List */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          {isLoading ? (
            <div className="py-16 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-500 dark:text-gray-400">Loading notifications...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-16 text-center">
              <Bell className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400 text-lg">No notifications yet</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                You'll see updates here when they happen
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {notifications.map((notification) => {
                const display = getNotificationDisplay(notification.type);

                return (
                  <div
                    key={notification.id}
                    className={`px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                      !notification.read ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      {/* Icon - styled like ActivityFeed */}
                      <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                        {getNotificationIcon(display.iconName, display.color)}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${!notification.read ? 'font-medium' : ''} text-gray-900 dark:text-white`}>
                          {decodeHtmlEntities(notification.message)}
                        </p>

                        {notification.cardTitle && (
                          <p className="text-sm text-blue-600 dark:text-blue-400 mt-1 flex items-center">
                            <ExternalLink className="h-3 w-3 mr-1 flex-shrink-0" />
                            {notification.cardTitle}
                          </p>
                        )}

                        <div className="flex items-center mt-2 text-xs text-gray-500 dark:text-gray-400">
                          <Clock className="h-3 w-3 mr-1" />
                          {formatTime(notification.createdAt)}
                          {notification.actorName && (
                            <span className="ml-2">by {notification.actorName}</span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 ml-4">
                        {!notification.read && (
                          <button
                            onClick={() => handleMarkAsRead(notification)}
                            className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            title="Mark as read"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(notification.id)}
                          className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                          title="Delete notification"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
