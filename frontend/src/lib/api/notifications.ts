import { getAccessToken } from './client';

const API_URL = import.meta.env.VITE_API_URL || 'https://boxtasks2.ddev.site';

export type NotificationType =
  | 'member_assigned'
  | 'member_removed'
  | 'card_due'
  | 'comment_added'
  | 'mentioned'
  | 'card_moved'
  | 'card_completed'
  | 'checklist_completed'
  | 'due_date_approaching'
  | 'label_added';

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  cardId?: string;
  cardTitle?: string;
  actorId?: string;
  actorName?: string;
  read: boolean;
  createdAt: string;
}

export interface CreateNotificationData {
  userId: string;
  type: NotificationType;
  message: string;
  cardId?: string;
  actorId?: string;
}

// Transform JSON:API response to Notification
function transformNotification(data: Record<string, unknown>, included?: Record<string, unknown>[]): Notification {
  const attrs = data.attributes as Record<string, unknown>;
  const rels = data.relationships as Record<string, { data: { id: string; type: string } | null }> | undefined;

  // Get card info from included if available
  let cardTitle: string | undefined;
  const cardId = rels?.field_notification_card?.data?.id;
  if (included && cardId) {
    const card = included.find((item) => item.id === cardId && item.type === 'node--card');
    if (card) {
      const cardAttrs = card.attributes as Record<string, unknown>;
      cardTitle = cardAttrs.title as string;
    }
  }

  // Get actor info from included if available
  let actorName: string | undefined;
  const actorId = rels?.field_notification_actor?.data?.id;
  if (included && actorId) {
    const actor = included.find((item) => item.id === actorId && item.type === 'user--user');
    if (actor) {
      const actorAttrs = actor.attributes as Record<string, unknown>;
      actorName = (actorAttrs.display_name as string) || (actorAttrs.name as string);
    }
  }

  return {
    id: data.id as string,
    type: (attrs.field_notification_type as NotificationType) || 'member_assigned',
    message: (attrs.field_notification_message as string) || '',
    cardId,
    cardTitle,
    actorId,
    actorName,
    read: (attrs.field_notification_read as boolean) || false,
    createdAt: attrs.created as string,
  };
}

// Fetch notifications for the current user
export async function fetchNotifications(userId: string): Promise<Notification[]> {
  const response = await fetch(
    `${API_URL}/jsonapi/node/notification?filter[field_notification_user.id]=${userId}&include=field_notification_card,field_notification_actor&sort=-created`,
    {
      headers: {
        'Accept': 'application/vnd.api+json',
        'Authorization': `Bearer ${getAccessToken()}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch notifications');
  }

  const result = await response.json();
  const data = result.data;
  const included = result.included as Record<string, unknown>[] | undefined;
  if (!Array.isArray(data)) return [];

  return data.map((item: Record<string, unknown>) => transformNotification(item, included));
}

// Fetch unread notification count
export async function fetchUnreadCount(userId: string): Promise<number> {
  const response = await fetch(
    `${API_URL}/jsonapi/node/notification?filter[field_notification_user.id]=${userId}&filter[field_notification_read]=0`,
    {
      headers: {
        'Accept': 'application/vnd.api+json',
        'Authorization': `Bearer ${getAccessToken()}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch unread count');
  }

  const result = await response.json();
  return result.data?.length || 0;
}

// Create a new notification
export async function createNotification(data: CreateNotificationData): Promise<Notification> {
  const relationships: Record<string, unknown> = {
    field_notification_user: {
      data: { type: 'user--user', id: data.userId },
    },
  };

  if (data.cardId) {
    relationships.field_notification_card = {
      data: { type: 'node--card', id: data.cardId },
    };
  }

  if (data.actorId) {
    relationships.field_notification_actor = {
      data: { type: 'user--user', id: data.actorId },
    };
  }

  const response = await fetch(`${API_URL}/jsonapi/node/notification`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
      'Authorization': `Bearer ${getAccessToken()}`,
    },
    body: JSON.stringify({
      data: {
        type: 'node--notification',
        attributes: {
          title: `Notification: ${data.type}`,
          field_notification_type: data.type,
          field_notification_message: data.message,
          field_notification_read: false,
        },
        relationships,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.errors?.[0]?.detail || 'Failed to create notification');
  }

  const result = await response.json();
  return transformNotification(result.data, result.included);
}

// Mark a notification as read
export async function markNotificationRead(id: string): Promise<Notification> {
  const response = await fetch(`${API_URL}/jsonapi/node/notification/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
      'Authorization': `Bearer ${getAccessToken()}`,
    },
    body: JSON.stringify({
      data: {
        type: 'node--notification',
        id,
        attributes: {
          field_notification_read: true,
        },
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.errors?.[0]?.detail || 'Failed to mark notification as read');
  }

  const result = await response.json();
  return transformNotification(result.data, result.included);
}

// Mark all notifications as read
export async function markAllNotificationsRead(userId: string): Promise<void> {
  const notifications = await fetchNotifications(userId);
  const unreadNotifications = notifications.filter((n) => !n.read);

  await Promise.all(unreadNotifications.map((n) => markNotificationRead(n.id)));
}

// Delete a notification
export async function deleteNotification(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/jsonapi/node/notification/${id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${getAccessToken()}`,
    },
  });

  if (!response.ok && response.status !== 204) {
    throw new Error('Failed to delete notification');
  }
}

// Get icon and label for notification type
export function getNotificationDisplay(type: NotificationType): { icon: string; label: string; color: string } {
  const displays: Record<NotificationType, { icon: string; label: string; color: string }> = {
    member_assigned: { icon: '👤', label: 'Assigned to you', color: 'text-blue-600' },
    member_removed: { icon: '👤', label: 'Removed from card', color: 'text-gray-600' },
    card_due: { icon: '⏰', label: 'Card is due', color: 'text-red-600' },
    comment_added: { icon: '💬', label: 'New comment', color: 'text-green-600' },
    mentioned: { icon: '@', label: 'Mentioned you', color: 'text-purple-600' },
    card_moved: { icon: '↔️', label: 'Card moved', color: 'text-gray-600' },
    card_completed: { icon: '✅', label: 'Card completed', color: 'text-green-600' },
    checklist_completed: { icon: '☑️', label: 'Checklist item completed', color: 'text-green-500' },
    due_date_approaching: { icon: '📅', label: 'Due date approaching', color: 'text-orange-600' },
    label_added: { icon: '🏷️', label: 'Label added', color: 'text-blue-500' },
  };
  return displays[type] || { icon: '🔔', label: 'Notification', color: 'text-gray-600' };
}
