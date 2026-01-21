import { useEffect, useRef, useState, useCallback } from 'react';

// Mercure Hub URL - defaults to localhost:3000 for development
const MERCURE_HUB_URL = import.meta.env.VITE_MERCURE_URL || 'http://localhost:3000/.well-known/mercure';

// Helper to create stable callback refs
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function useStableCallback<T extends (...args: any[]) => any>(callback: T | undefined): T | undefined {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return useCallback(((...args: any[]) => callbackRef.current?.(...args)) as T, []);
}

export type MercureEventType =
  | 'card.created'
  | 'card.updated'
  | 'card.deleted'
  | 'card.moved'
  | 'card.reordered'
  | 'list.created'
  | 'list.updated'
  | 'list.deleted'
  | 'list.reordered'
  | 'comment.created'
  | 'comment.updated'
  | 'comment.deleted'
  | 'member.assigned'
  | 'member.unassigned'
  | 'presence.update'
  | 'message.created'
  | 'user.typing'
  | 'activity.created'
  // Workspace membership events
  | 'workspace.member_added'
  | 'workspace.member_removed'
  | 'workspace.member_role_changed'
  | 'workspace.assigned'
  | 'workspace.unassigned'
  | 'workspace.role_permissions_updated'
  // Board membership events
  | 'board.member_added'
  | 'board.member_removed'
  // Permission events
  | 'permissions.updated';

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
  const isMountedRef = useRef(true);
  const isIntentionalDisconnect = useRef(false);
  const maxReconnectAttempts = 5;
  const baseReconnectDelay = 1000; // 1 second

  const disconnect = useCallback(() => {
    // Mark as intentional disconnect to prevent reconnection attempts
    isIntentionalDisconnect.current = true;

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    if (isMountedRef.current) {
      setConnectionState(prev => ({
        ...prev,
        connected: false,
        connecting: false,
      }));
    }
  }, []);

  const connect = useCallback(() => {
    if (!enabled || topics.length === 0) {
      return;
    }

    // Don't connect if already connected or connecting
    if (eventSourceRef.current?.readyState === EventSource.OPEN) {
      return;
    }

    // Reset intentional disconnect flag when connecting
    isIntentionalDisconnect.current = false;

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

        // Skip state updates and reconnection if unmounting or intentionally disconnecting
        if (!isMountedRef.current || isIntentionalDisconnect.current) {
          return;
        }

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
            // Double-check we're still mounted and not intentionally disconnecting
            if (isMountedRef.current && !isIntentionalDisconnect.current) {
              connect();
            }
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
    isMountedRef.current = true;

    if (enabled && topics.length > 0) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      isMountedRef.current = false;
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

export interface PresenceUpdateData {
  userId: string;
  username: string;
  displayName: string;
  avatar: string;
  action: 'join' | 'leave' | 'heartbeat';
  timestamp: string;
}

export interface MemberAssignmentData {
  cardId: string;
  userId: string;
  userName: string;
  userDisplayName: string;
  memberIds: string[];
  members: Array<{
    id: string;
    name: string;
    email?: string;
  }>;
}

export interface ActivityCreatedData {
  id: string;
  type: string;
  description: string;
  cardId: string | null;
  boardId: string | null;
  authorId: string | null;
  authorName: string;
  createdAt: string;
  data: Record<string, unknown> | null;
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
    onCardReordered?: (reorderData: { listId: string; cardPositions: Record<string, number> }) => void;
    onListCreated?: (listData: unknown) => void;
    onListUpdated?: (listData: unknown) => void;
    onListDeleted?: (listId: string) => void;
    onListReordered?: (listPositions: Record<string, number>) => void;
    onCommentCreated?: (commentData: unknown) => void;
    onCommentDeleted?: (commentData: unknown) => void;
    onPresenceUpdate?: (presenceData: PresenceUpdateData) => void;
    onMemberAssigned?: (data: MemberAssignmentData) => void;
    onMemberUnassigned?: (data: MemberAssignmentData) => void;
    onActivityCreated?: (data: ActivityCreatedData) => void;
    // Board member events
    onBoardMemberAdded?: (data: BoardMemberAddedData) => void;
    onBoardMemberRemoved?: (data: BoardMemberRemovedData) => void;
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
      case 'card.reordered':
        callbacks.onCardReordered?.(message.data as { listId: string; cardPositions: Record<string, number> });
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
      case 'list.reordered':
        callbacks.onListReordered?.(message.data as Record<string, number>);
        break;
      case 'comment.created':
        callbacks.onCommentCreated?.(message.data);
        break;
      case 'comment.deleted':
        callbacks.onCommentDeleted?.(message.data);
        break;
      case 'presence.update':
        callbacks.onPresenceUpdate?.(message.data as PresenceUpdateData);
        break;
      case 'member.assigned':
        callbacks.onMemberAssigned?.(message.data as MemberAssignmentData);
        break;
      case 'member.unassigned':
        callbacks.onMemberUnassigned?.(message.data as MemberAssignmentData);
        break;
      case 'activity.created':
        callbacks.onActivityCreated?.(message.data as ActivityCreatedData);
        break;
      case 'board.member_added':
        callbacks.onBoardMemberAdded?.(message.data as BoardMemberAddedData);
        break;
      case 'board.member_removed':
        callbacks.onBoardMemberRemoved?.(message.data as BoardMemberRemovedData);
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

/**
 * Hook for subscribing to chat channel messages
 */
export interface ChatMessageData {
  id: string;
  channelId: string;
  text: string;
  type: string;
  sender: {
    id: string;
    name: string;
    displayName: string;
    avatar?: string | null;
  };
  createdAt: number;
}

export interface TypingData {
  channelId: string;
  user: {
    id: string;
    name: string;
    displayName: string;
    avatar?: string | null;
  };
  timestamp: number;
}

export function useChatSubscription(
  channelId: string | undefined,
  callbacks: {
    onMessage?: (message: ChatMessageData) => void;
    onTyping?: (data: TypingData) => void;
  }
) {
  const topics = channelId ? [`/chat/${channelId}`] : [];

  const handleMessage = useCallback((message: MercureMessage) => {
    switch (message.type) {
      case 'message.created':
        callbacks.onMessage?.(message.data as ChatMessageData);
        break;
      case 'user.typing':
        callbacks.onTyping?.(message.data as TypingData);
        break;
    }
  }, [callbacks]);

  return useMercure({
    topics,
    onMessage: handleMessage,
    enabled: !!channelId,
  });
}

/**
 * Data types for workspace membership events
 */
export interface WorkspaceMemberAddedData {
  workspaceId: string;
  userId: string;
  displayName: string;
  email: string;
  roleId: string | null;
  roleName: string | null;
}

export interface WorkspaceMemberRemovedData {
  workspaceId: string;
  userId: string;
}

export interface WorkspaceMemberRoleChangedData {
  workspaceId: string;
  userId: string;
  displayName: string;
  roleId: string;
  roleName: string;
}

export interface WorkspaceAssignedData {
  workspaceId: string;
  roleId: string | null;
  roleName: string | null;
}

export interface WorkspaceUnassignedData {
  workspaceId: string;
}

/**
 * Data types for board membership events
 */
export interface BoardMemberAddedData {
  boardId: string;
  userId: string;
  displayName: string;
  email: string;
  roleId: string | null;
  roleName: string | null;
  isAdmin: boolean;
}

export interface BoardMemberRemovedData {
  boardId: string;
  userId: string;
}

/**
 * Hook for subscribing to workspace-specific updates
 * This is used for real-time workspace member changes and permission updates
 */
export function useWorkspaceUpdates(
  workspaceId: string | undefined,
  callbacks: {
    onMemberAdded?: (data: WorkspaceMemberAddedData) => void;
    onMemberRemoved?: (data: WorkspaceMemberRemovedData) => void;
    onMemberRoleChanged?: (data: WorkspaceMemberRoleChangedData) => void;
    onRolePermissionsUpdated?: (data: WorkspaceRolePermissionsUpdatedData) => void;
  }
) {
  const topics = workspaceId ? [`/workspaces/${workspaceId}`] : [];

  const handleMessage = useCallback((message: MercureMessage) => {
    switch (message.type) {
      case 'workspace.member_added':
        callbacks.onMemberAdded?.(message.data as WorkspaceMemberAddedData);
        break;
      case 'workspace.member_removed':
        callbacks.onMemberRemoved?.(message.data as WorkspaceMemberRemovedData);
        break;
      case 'workspace.member_role_changed':
        callbacks.onMemberRoleChanged?.(message.data as WorkspaceMemberRoleChangedData);
        break;
      case 'workspace.role_permissions_updated':
        callbacks.onRolePermissionsUpdated?.(message.data as WorkspaceRolePermissionsUpdatedData);
        break;
    }
  }, [callbacks]);

  return useMercure({
    topics,
    onMessage: handleMessage,
    enabled: !!workspaceId,
  });
}

/**
 * Hook for subscribing to user's workspace assignments
 * This allows the user to see new workspace invitations in real-time
 */
export function useUserWorkspaceUpdates(
  userId: string | undefined,
  callbacks: {
    onWorkspaceAssigned?: (data: WorkspaceAssignedData) => void;
    onWorkspaceUnassigned?: (data: WorkspaceUnassignedData) => void;
  }
) {
  const topics = userId ? [`/users/${userId}/workspaces`] : [];

  const handleMessage = useCallback((message: MercureMessage) => {
    switch (message.type) {
      case 'workspace.assigned':
        callbacks.onWorkspaceAssigned?.(message.data as WorkspaceAssignedData);
        break;
      case 'workspace.unassigned':
        callbacks.onWorkspaceUnassigned?.(message.data as WorkspaceUnassignedData);
        break;
    }
  }, [callbacks]);

  return useMercure({
    topics,
    onMessage: handleMessage,
    enabled: !!userId,
  });
}

/**
 * Data type for permission update events
 */
export interface PermissionsUpdatedData {
  roleId: string;
  roleName: string;
}

/**
 * Hook for subscribing to user's permission updates
 * This allows real-time permission refresh when roles are modified
 */
export function useUserPermissionUpdates(
  userId: string | undefined,
  callbacks: {
    onPermissionsUpdated?: (data: PermissionsUpdatedData) => void;
  }
) {
  const topics = userId ? [`/users/${userId}/permissions`] : [];

  const handleMessage = useCallback((message: MercureMessage) => {
    switch (message.type) {
      case 'permissions.updated':
        callbacks.onPermissionsUpdated?.(message.data as PermissionsUpdatedData);
        break;
    }
  }, [callbacks]);

  return useMercure({
    topics,
    onMessage: handleMessage,
    enabled: !!userId,
  });
}

/**
 * Data type for workspace role permissions update events
 */
export interface WorkspaceRolePermissionsUpdatedData {
  workspaceId: string;
  roleId: string;
  roleName: string;
}

export default useMercure;
