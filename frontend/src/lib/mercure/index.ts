/**
 * Centralized Mercure hooks using the MercureManager singleton
 *
 * This provides the same API as the original useMercure hooks but uses
 * a single shared EventSource connection for all subscriptions.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import MercureManager, { type MercureMessage } from './MercureManager';

// Re-export types
export type { MercureMessage } from './MercureManager';

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
  | 'workspace.member_added'
  | 'workspace.member_removed'
  | 'workspace.member_role_changed'
  | 'workspace.assigned'
  | 'workspace.unassigned'
  | 'workspace.role_permissions_updated'
  | 'board.member_added'
  | 'board.member_removed'
  | 'permissions.updated'
  | 'customfield.value_created'
  | 'customfield.value_updated'
  | 'customfield.value_deleted'
  | 'customfield.definition_created'
  | 'customfield.definition_updated'
  | 'customfield.definition_deleted';

export interface MercureConnectionState {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  lastEventTime: Date | null;
}

// Helper to create stable callback refs
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function useStableCallback<T extends (...args: any[]) => any>(callback: T | undefined): T | undefined {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return useCallback(((...args: any[]) => callbackRef.current?.(...args)) as T, []);
}

interface UseMercureOptions {
  topics: string[];
  onMessage?: (message: MercureMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  enabled?: boolean;
}

/**
 * React hook for subscribing to Mercure real-time updates
 * Uses the centralized MercureManager for a single shared connection
 */
export function useMercure(options: UseMercureOptions) {
  const { topics, onMessage, onConnect, onDisconnect, enabled = true } = options;

  const stableOnMessage = useStableCallback(onMessage);
  const stableOnConnect = useStableCallback(onConnect);
  const stableOnDisconnect = useStableCallback(onDisconnect);

  const [connectionState, setConnectionState] = useState<MercureConnectionState>(
    MercureManager.getConnectionState()
  );

  const wasConnectedRef = useRef(false);

  // Subscribe to connection state changes
  useEffect(() => {
    const unsubscribe = MercureManager.onStateChange((state) => {
      setConnectionState(state);

      // Handle connect/disconnect callbacks
      if (state.connected && !wasConnectedRef.current) {
        wasConnectedRef.current = true;
        stableOnConnect?.();
      } else if (!state.connected && wasConnectedRef.current) {
        wasConnectedRef.current = false;
        stableOnDisconnect?.();
      }
    });

    return unsubscribe;
  }, [stableOnConnect, stableOnDisconnect]);

  // Subscribe to topics
  useEffect(() => {
    if (!enabled || topics.length === 0) {
      return;
    }

    // Subscribe to all topics
    const unsubscribers = topics.map((topic) =>
      MercureManager.subscribe(topic, (message) => {
        stableOnMessage?.(message);
      })
    );

    // Cleanup: unsubscribe from all topics
    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, topics.join(','), stableOnMessage]);

  const reconnect = useCallback(() => {
    MercureManager.forceReconnect();
  }, []);

  return {
    ...connectionState,
    reconnect,
  };
}

// ============================================
// Data Types
// ============================================

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

export interface CustomFieldValueData {
  id: string;
  cardId: string;
  definitionId: string;
  definitionTitle: string | null;
  value: string | null;
  type: string | null;
}

export interface CustomFieldValueDeletedData {
  id: string;
  cardId: string;
  definitionId: string;
}

export interface CustomFieldDefinitionData {
  id: string;
  title: string;
  boardId: string;
  workspaceId: string | null;
  type: string;
  options: unknown[];
  required: boolean;
  position: number;
  displayLocation: string;
  scope: string;
  visibilityMode?: 'all_cards' | 'template_only' | 'manual';
  roleIds?: string[];
  groupId?: string;
}

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

export interface PermissionsUpdatedData {
  roleId: string;
  roleName: string;
}

export interface WorkspaceRolePermissionsUpdatedData {
  workspaceId: string;
  roleId: string;
  roleName: string;
}

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

// ============================================
// Specialized Hooks
// ============================================

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
    onBoardMemberAdded?: (data: BoardMemberAddedData) => void;
    onBoardMemberRemoved?: (data: BoardMemberRemovedData) => void;
    onCustomFieldValueCreated?: (data: CustomFieldValueData) => void;
    onCustomFieldValueUpdated?: (data: CustomFieldValueData) => void;
    onCustomFieldValueDeleted?: (data: CustomFieldValueDeletedData) => void;
    onCustomFieldDefinitionCreated?: (data: CustomFieldDefinitionData) => void;
    onCustomFieldDefinitionUpdated?: (data: CustomFieldDefinitionData) => void;
    onCustomFieldDefinitionDeleted?: (definitionId: string) => void;
  }
) {
  const topics = boardId ? [`/boards/${boardId}`] : [];

  const handleMessage = useCallback(
    (message: MercureMessage) => {
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
        case 'customfield.value_created':
          callbacks.onCustomFieldValueCreated?.(message.data as CustomFieldValueData);
          break;
        case 'customfield.value_updated':
          callbacks.onCustomFieldValueUpdated?.(message.data as CustomFieldValueData);
          break;
        case 'customfield.value_deleted':
          callbacks.onCustomFieldValueDeleted?.(message.data as CustomFieldValueDeletedData);
          break;
        case 'customfield.definition_created':
          callbacks.onCustomFieldDefinitionCreated?.(message.data as CustomFieldDefinitionData);
          break;
        case 'customfield.definition_updated':
          callbacks.onCustomFieldDefinitionUpdated?.(message.data as CustomFieldDefinitionData);
          break;
        case 'customfield.definition_deleted':
          callbacks.onCustomFieldDefinitionDeleted?.(message.data as string);
          break;
      }
    },
    [callbacks]
  );

  return useMercure({
    topics,
    onMessage: handleMessage,
    enabled: !!boardId,
  });
}

/**
 * Hook for subscribing to user-specific notifications
 */
export function useUserNotifications(userId: string | undefined, onNotification: (notification: unknown) => void) {
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
export function useChatSubscription(
  channelId: string | undefined,
  callbacks: {
    onMessage?: (message: ChatMessageData) => void;
    onTyping?: (data: TypingData) => void;
  }
) {
  const topics = channelId ? [`/chat/${channelId}`] : [];

  const handleMessage = useCallback(
    (message: MercureMessage) => {
      switch (message.type) {
        case 'message.created':
          callbacks.onMessage?.(message.data as ChatMessageData);
          break;
        case 'user.typing':
          callbacks.onTyping?.(message.data as TypingData);
          break;
      }
    },
    [callbacks]
  );

  return useMercure({
    topics,
    onMessage: handleMessage,
    enabled: !!channelId,
  });
}

/**
 * Hook for subscribing to workspace-specific updates
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

  const handleMessage = useCallback(
    (message: MercureMessage) => {
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
    },
    [callbacks]
  );

  return useMercure({
    topics,
    onMessage: handleMessage,
    enabled: !!workspaceId,
  });
}

/**
 * Hook for subscribing to user's workspace assignments
 */
export function useUserWorkspaceUpdates(
  userId: string | undefined,
  callbacks: {
    onWorkspaceAssigned?: (data: WorkspaceAssignedData) => void;
    onWorkspaceUnassigned?: (data: WorkspaceUnassignedData) => void;
  }
) {
  const topics = userId ? [`/users/${userId}/workspaces`] : [];

  const handleMessage = useCallback(
    (message: MercureMessage) => {
      switch (message.type) {
        case 'workspace.assigned':
          callbacks.onWorkspaceAssigned?.(message.data as WorkspaceAssignedData);
          break;
        case 'workspace.unassigned':
          callbacks.onWorkspaceUnassigned?.(message.data as WorkspaceUnassignedData);
          break;
      }
    },
    [callbacks]
  );

  return useMercure({
    topics,
    onMessage: handleMessage,
    enabled: !!userId,
  });
}

/**
 * Hook for subscribing to user's permission updates
 */
export function useUserPermissionUpdates(
  userId: string | undefined,
  callbacks: {
    onPermissionsUpdated?: (data: PermissionsUpdatedData) => void;
  }
) {
  const topics = userId ? [`/users/${userId}/permissions`] : [];

  const handleMessage = useCallback(
    (message: MercureMessage) => {
      switch (message.type) {
        case 'permissions.updated':
          callbacks.onPermissionsUpdated?.(message.data as PermissionsUpdatedData);
          break;
      }
    },
    [callbacks]
  );

  return useMercure({
    topics,
    onMessage: handleMessage,
    enabled: !!userId,
  });
}

export default useMercure;
