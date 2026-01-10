import { useEffect, useState, useCallback, useRef } from 'react';
import { announcePresence, getActiveUsers, type PresenceUser, type PresenceUpdate } from '../api/presence';
import { useAuthStore } from '../stores/auth';

const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const STALE_THRESHOLD = 60000; // 60 seconds

interface UsePresenceOptions {
  boardId: string | undefined;
  enabled?: boolean;
}

export function usePresence({ boardId, enabled = true }: UsePresenceOptions) {
  const [activeUsers, setActiveUsers] = useState<PresenceUser[]>([]);
  const { user: currentUser, isAuthenticated } = useAuthStore();
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasJoinedRef = useRef(false);

  // Handle presence updates from Mercure
  const handlePresenceUpdate = useCallback((update: PresenceUpdate) => {
    setActiveUsers((prev) => {
      const filtered = prev.filter((u) => u.userId !== update.userId);

      if (update.action === 'leave') {
        return filtered;
      }

      // Add or update user
      return [
        ...filtered,
        {
          userId: update.userId,
          username: update.username,
          displayName: update.displayName,
          avatar: update.avatar,
          lastSeen: Date.now(),
        },
      ];
    });
  }, []);

  // Join board and start heartbeat
  useEffect(() => {
    if (!enabled || !boardId || !isAuthenticated || !currentUser) {
      return;
    }

    // Announce join
    announcePresence(boardId, 'join');
    hasJoinedRef.current = true;

    // Fetch initial active users
    getActiveUsers(boardId).then(setActiveUsers);

    // Start heartbeat
    heartbeatIntervalRef.current = setInterval(() => {
      announcePresence(boardId, 'heartbeat');
    }, HEARTBEAT_INTERVAL);

    // Cleanup: announce leave
    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      if (hasJoinedRef.current && boardId) {
        announcePresence(boardId, 'leave');
        hasJoinedRef.current = false;
      }
    };
  }, [boardId, enabled, isAuthenticated, currentUser]);

  // Handle page visibility change
  useEffect(() => {
    if (!enabled || !boardId || !isAuthenticated) {
      return;
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // User switched away from tab - could announce "away" status
      } else {
        // User returned - send heartbeat
        announcePresence(boardId, 'heartbeat');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [boardId, enabled, isAuthenticated]);

  // Clean up stale users periodically
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      setActiveUsers((prev) =>
        prev.filter((u) => !u.lastSeen || now - u.lastSeen < STALE_THRESHOLD)
      );
    }, STALE_THRESHOLD);

    return () => clearInterval(cleanupInterval);
  }, []);

  // Filter out current user from display
  const otherUsers = activeUsers.filter((u) => u.userId !== currentUser?.id);

  return {
    activeUsers: otherUsers,
    allUsers: activeUsers,
    handlePresenceUpdate,
    isCurrentUserActive: activeUsers.some((u) => u.userId === currentUser?.id),
  };
}
