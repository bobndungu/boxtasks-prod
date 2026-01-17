import { getAccessToken, fetchWithCsrf } from './client';
import { formatDate, formatTime, formatDateShort, EAT_TIMEZONE } from '../utils/date';

const API_URL = import.meta.env.VITE_API_URL || 'https://boxtasks2.ddev.site';

export type ChannelType = 'workspace' | 'board' | 'card' | 'direct';
export type MessageType = 'text' | 'system' | 'file';

export interface ChatUser {
  id: string;
  name: string;
  displayName: string;
  avatar?: string | null;
}

export interface ChatMessage {
  id: string;
  text: string;
  type: MessageType;
  sender: ChatUser | null;
  createdAt: number;
}

export interface ChatChannel {
  id: string;
  name: string;
  type: ChannelType;
  entityId?: string;
  participants: ChatUser[];
  lastMessage?: ChatMessage | null;
  createdAt: number;
  updatedAt: number;
}

export interface SendMessageData {
  channelId: string;
  message: string;
  type?: MessageType;
}

export interface CreateChannelData {
  name?: string;
  type: ChannelType;
  entityId?: string;
  participants?: string[];
}

// Fetch messages for a channel
export async function fetchMessages(
  channelId: string,
  options?: { limit?: number; before?: string }
): Promise<{ messages: ChatMessage[]; hasMore: boolean }> {
  const params = new URLSearchParams();
  if (options?.limit) params.set('limit', options.limit.toString());
  if (options?.before) params.set('before', options.before);

  const url = `${API_URL}/api/chat/messages/${channelId}${params.toString() ? '?' + params.toString() : ''}`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${getAccessToken()}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch messages');
  }

  return response.json();
}

// Send a message
export async function sendMessage(data: SendMessageData): Promise<ChatMessage> {
  const response = await fetchWithCsrf(`${API_URL}/api/chat/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to send message');
  }

  return response.json();
}

// Mark messages as read
export async function markMessagesRead(channelId: string): Promise<void> {
  await fetchWithCsrf(`${API_URL}/api/chat/mark-read/${channelId}`, {
    method: 'POST',
  });
}

// Send typing indicator
export async function sendTypingIndicator(channelId: string): Promise<void> {
  await fetchWithCsrf(`${API_URL}/api/chat/typing/${channelId}`, {
    method: 'POST',
  });
}

// Get channels for the current user
export async function fetchChannels(
  options?: { type?: ChannelType; entityId?: string }
): Promise<{ channels: ChatChannel[] }> {
  const params = new URLSearchParams();
  if (options?.type) params.set('type', options.type);
  if (options?.entityId) params.set('entityId', options.entityId);

  const url = `${API_URL}/api/chat/channels${params.toString() ? '?' + params.toString() : ''}`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${getAccessToken()}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch channels');
  }

  return response.json();
}

// Create or get a channel
export async function createOrGetChannel(data: CreateChannelData): Promise<ChatChannel> {
  const response = await fetchWithCsrf(`${API_URL}/api/chat/channels`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create channel');
  }

  return response.json();
}

// Format message time
export function formatMessageTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  // Same day - show time
  if (date.toDateString() === now.toDateString()) {
    return formatTime(date);
  }

  // Yesterday
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday ' + formatTime(date);
  }

  // Within a week
  if (diffDays < 7) {
    return formatDate(date, { weekday: 'short', timeZone: EAT_TIMEZONE }) + ' ' + formatTime(date);
  }

  // Older
  return formatDateShort(date) + ' ' + formatTime(date);
}

// Format relative time for last message preview
export function formatRelativeTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return formatDateShort(date);
}

// Get initials for avatar
export function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.split(' ');
  if (parts.length >= 2) {
    return parts[0][0].toUpperCase() + parts[1][0].toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}
