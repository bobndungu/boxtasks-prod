import { useEffect, useRef, useState, useCallback } from 'react';

// Mercure Hub URL - defaults to localhost:3000 for development
const MERCURE_HUB_URL = import.meta.env.VITE_MERCURE_URL || 'http://localhost:3000/.well-known/mercure';

// Helper to create stable callback refs
function useStableCallback<T extends (...args: unknown[]) => unknown>(callback: T | undefined): T | undefined {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  return useCallback(((...args) => callbackRef.current?.(...args)) as T, []);
}

export type MercureEventType =
  | 'card.created'
  | 'card.updated'
  | 'card.deleted'
  | 'card.moved'
  | 'list.created'
  | 'list.updated'
  | 'list.deleted'
  | 'list.reordered'
  | 'comment.created'
  | 'comment.updated'
  | 'comment.deleted'
  | 'member.assigned'
  | 'member.unassigned';

export interface MercureMessage<T = unknown> {
  type: MercureEventType;
  data: T;
  timestamp: string;
  actorId?: string;
}

export interface MercureConnectionState {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  lastEventTime: Date | null;
}

interface UseMercureOptions {
  topics: string[];
  onMessage?: (message: MercureMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
  enabled?: boolean;
}

/**
 * React hook for subscribing to Mercure real-time updates
 */
export function useMercure(options: UseMercureOptions) {
  const {
    topics,
    onMessage,
    onConnect,
    onDisconnect,
    onError,
    enabled = true
  } = options;

  // Use stable callback refs to prevent infinite loops
  const stableOnMessage = useStableCallback(onMessage);
  const stableOnConnect = useStableCallback(onConnect);
  const stableOnDisconnect = useStableCallback(onDisconnect);
  const stableOnError = useStableCallback(onError);

  const [connectionState, setConnectionState] = useState<MercureConnectionState>({
    connected: false,
    connecting: false,
    error: null,
    lastEventTime: null,
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const baseReconnectDelay = 1000; // 1 second

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setConnectionState(prev => ({
      ...prev,
      connected: false,
      connecting: false,
    }));
  }, []);

  const connect = useCallback(() => {
    if (!enabled || topics.length === 0) {
      return;
    }

    // Don't connect if already connected or connecting
    if (eventSourceRef.current?.readyState === EventSource.OPEN) {
      return;
    }

    setConnectionState(prev => ({
      ...prev,
      connecting: true,
      error: null,
    }));

    // Build the URL with topic subscriptions
    const url = new URL(MERCURE_HUB_URL);
    topics.forEach(topic => {
      url.searchParams.append('topic', topic);
    });

    try {
      const eventSource = new EventSource(url.toString(), {
        withCredentials: false, // Anonymous subscription
      });

      eventSource.onopen = () => {
        reconnectAttempts.current = 0;
        setConnectionState({
          connected: true,
          connecting: false,
          error: null,
          lastEventTime: new Date(),
        });
        stableOnConnect?.();
      };

      eventSource.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as MercureMessage;
          setConnectionState(prev => ({
            ...prev,
            lastEventTime: new Date(),
          }));
          stableOnMessage?.(message);
        } catch (parseError) {
          console.error('Failed to parse Mercure message:', parseError);
        }
      };

      eventSource.onerror = () => {
        const wasConnected = eventSourceRef.current?.readyState === EventSource.OPEN;

        eventSource.close();
        eventSourceRef.current = null;

        setConnectionState(prev => ({
          ...prev,
          connected: false,
          connecting: false,
          error: 'Connection lost',
        }));

        if (wasConnected) {
          stableOnDisconnect?.();
        }

        // Attempt to reconnect with exponential backoff
        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = baseReconnectDelay * Math.pow(2, reconnectAttempts.current);
          reconnectAttempts.current++;

          console.log(`Mercure: Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current})`);

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else {
          const error = new Error('Max reconnection attempts reached');
          setConnectionState(prev => ({
            ...prev,
            error: error.message,
          }));
          stableOnError?.(error);
        }
      };

      eventSourceRef.current = eventSource;
    } catch (error) {
      setConnectionState(prev => ({
        ...prev,
        connecting: false,
        error: error instanceof Error ? error.message : 'Failed to connect',
      }));
      stableOnError?.(error instanceof Error ? error : new Error('Failed to connect'));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, topics.join(',')]);

  // Connect when topics change or enabled changes
  useEffect(() => {
    if (enabled && topics.length > 0) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, topics.join(',')]);

  // Manual reconnect function
  const reconnect = useCallback(() => {
    reconnectAttempts.current = 0;
    disconnect();
    connect();
  }, [connect, disconnect]);

  return {
    ...connectionState,
    reconnect,
    disconnect,
  };
}

/**
 * Hook for subscribing to board-specific updates
 */
export function useBoardUpdates(
  boardId: string | undefined,
  callbacks: {
    onCardCreated?: (cardData: unknown) => void;
    onCardUpdated?: (cardData: unknown) => void;
    onCardDeleted?: (cardId: string) => void;
    onCardMoved?: (moveData: { cardId: string; fromListId: string; toListId: string; position: number }) => void;
    onListCreated?: (listData: unknown) => void;
    onListUpdated?: (listData: unknown) => void;
    onListDeleted?: (listId: string) => void;
    onCommentCreated?: (commentData: unknown) => void;
  }
) {
  const topics = boardId ? [`/boards/${boardId}`] : [];

  const handleMessage = useCallback((message: MercureMessage) => {
    switch (message.type) {
      case 'card.created':
        callbacks.onCardCreated?.(message.data);
        break;
      case 'card.updated':
        callbacks.onCardUpdated?.(message.data);
        break;
      case 'card.deleted':
        callbacks.onCardDeleted?.(message.data as string);
        break;
      case 'card.moved':
        callbacks.onCardMoved?.(message.data as { cardId: string; fromListId: string; toListId: string; position: number });
        break;
      case 'list.created':
        callbacks.onListCreated?.(message.data);
        break;
      case 'list.updated':
        callbacks.onListUpdated?.(message.data);
        break;
      case 'list.deleted':
        callbacks.onListDeleted?.(message.data as string);
        break;
      case 'comment.created':
        callbacks.onCommentCreated?.(message.data);
        break;
    }
  }, [callbacks]);

  return useMercure({
    topics,
    onMessage: handleMessage,
    enabled: !!boardId,
  });
}

/**
 * Hook for subscribing to user-specific notifications
 */
export function useUserNotifications(
  userId: string | undefined,
  onNotification: (notification: unknown) => void
) {
  const topics = userId ? [`/users/${userId}/notifications`] : [];

  return useMercure({
    topics,
    onMessage: (message) => {
      onNotification(message.data);
    },
    enabled: !!userId,
  });
}

export default useMercure;
