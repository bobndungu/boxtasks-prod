import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, Check, CheckCheck, X, Clock, ExternalLink, Wifi, WifiOff } from 'lucide-react';
import { useAuthStore } from '../lib/stores/auth';
import { useUserNotifications } from '../lib/hooks/useMercure';
import {
  fetchNotifications,
  fetchUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  getNotificationDisplay,
  type Notification,
} from '../lib/api/notifications';

interface NotificationDropdownProps {
  className?: string;
}

export default function NotificationDropdown({ className = '' }: NotificationDropdownProps) {
  const { user } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [hasNewNotification, setHasNewNotification] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Handle real-time notification via Mercure
  const handleRealtimeNotification = useCallback((notification: unknown) => {
    const notif = notification as Notification;

    // Add to the top of the list
    setNotifications(prev => [notif, ...prev.filter(n => n.id !== notif.id)]);
    setUnreadCount(prev => prev + 1);
    setHasNewNotification(true);

    // Play notification sound if supported
    try {
      const audio = new Audio('/notification.mp3');
      audio.volume = 0.3;
      audio.play().catch(() => {});
    } catch {
      // Ignore audio errors
    }

    // Show browser notification if permitted
    if (Notification.permission === 'granted') {
      const display = getNotificationDisplay(notif.type);
      new Notification('BoxTasks', {
        body: notif.message,
        icon: '/icon-192.png',
        tag: notif.id,
      });
    }

    // Clear the new notification indicator after 3 seconds
    setTimeout(() => setHasNewNotification(false), 3000);
  }, []);

  // Subscribe to real-time notifications via Mercure
  const { connected: mercureConnected } = useUserNotifications(user?.id, handleRealtimeNotification);

  const loadNotifications = useCallback(async () => {
    if (!user?.id) return;

    setIsLoading(true);
    try {
      const [notifs, count] = await Promise.all([
        fetchNotifications(user.id),
        fetchUnreadCount(user.id),
      ]);
      setNotifications(notifs);
      setUnreadCount(count);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  // Load notifications on mount and when user changes
  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Request browser notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Fallback polling for when Mercure is not connected (every 60 seconds instead of 30)
  useEffect(() => {
    if (!user?.id || mercureConnected) return;

    const interval = setInterval(async () => {
      try {
        const count = await fetchUnreadCount(user.id);
        setUnreadCount(count);
      } catch (error) {
        // Silently fail on polling errors
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [user?.id, mercureConnected]);

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

  const handleToggle = async () => {
    const willOpen = !isOpen;
    setIsOpen(willOpen);
    if (willOpen) {
      await loadNotifications();
    }
  };

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

  const handleDelete = async (notificationId: string, e: React.MouseEvent) => {
    e.stopPropagation();

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

  const handleNotificationClick = async (notification: Notification) => {
    await handleMarkAsRead(notification);

    // Navigate to card if there's a card reference
    if (notification.cardId) {
      // You could use React Router's navigate here
      // For now, we'll just close the dropdown
      setIsOpen(false);
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
    return date.toLocaleDateString();
  };

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Bell Button */}
      <button
        onClick={handleToggle}
        className={`p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 rounded-lg relative ${hasNewNotification ? 'animate-pulse' : ''}`}
        aria-label="Notifications"
        title={mercureConnected ? 'Real-time notifications active' : 'Checking for notifications...'}
      >
        <Bell className={`h-5 w-5 ${hasNewNotification ? 'animate-bounce text-blue-600' : ''}`} />
        {unreadCount > 0 && (
          <span className={`absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-xs font-medium rounded-full flex items-center justify-center ${hasNewNotification ? 'animate-ping' : ''}`}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
        {/* Connection status indicator */}
        <span className={`absolute bottom-0.5 right-0.5 w-2 h-2 rounded-full ${mercureConnected ? 'bg-green-500' : 'bg-gray-400'}`} title={mercureConnected ? 'Connected' : 'Disconnected'} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 max-h-[480px] flex flex-col">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900 dark:text-white">Notifications</h3>
              {mercureConnected ? (
                <span className="flex items-center text-xs text-green-600 dark:text-green-400" title="Real-time updates active">
                  <Wifi className="h-3 w-3 mr-0.5" />
                  Live
                </span>
              ) : (
                <span className="flex items-center text-xs text-gray-400" title="Polling for updates">
                  <WifiOff className="h-3 w-3 mr-0.5" />
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center"
              >
                <CheckCheck className="h-4 w-4 mr-1" />
                Mark all read
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="overflow-y-auto flex-1">
            {isLoading ? (
              <div className="py-8 text-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-8 text-center">
                <Bell className="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">No notifications yet</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
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
                      onClick={() => handleNotificationClick(notification)}
                      className={`px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors ${
                        !notification.read ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                      }`}
                    >
                      <div className="flex items-start">
                        {/* Icon */}
                        <span className={`text-lg mr-3 ${display.color}`}>{display.icon}</span>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm ${!notification.read ? 'font-medium' : ''} text-gray-900 dark:text-white`}>
                            {notification.message}
                          </p>

                          {notification.cardTitle && (
                            <p className="text-sm text-blue-600 dark:text-blue-400 mt-0.5 flex items-center truncate">
                              <ExternalLink className="h-3 w-3 mr-1 flex-shrink-0" />
                              {notification.cardTitle}
                            </p>
                          )}

                          <div className="flex items-center mt-1 text-xs text-gray-500 dark:text-gray-400">
                            <Clock className="h-3 w-3 mr-1" />
                            {formatTime(notification.createdAt)}
                            {notification.actorName && (
                              <span className="ml-2">by {notification.actorName}</span>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center ml-2">
                          {!notification.read && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMarkAsRead(notification);
                              }}
                              className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded"
                              title="Mark as read"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={(e) => handleDelete(notification.id, e)}
                            className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded"
                            title="Delete"
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

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700 flex-shrink-0">
              <button
                onClick={() => setIsOpen(false)}
                className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 w-full text-center"
              >
                View all notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
