import { getAccessToken } from './client';

const API_URL = import.meta.env.VITE_API_URL || 'https://boxtasks2.ddev.site';

export interface PresenceUser {
  userId: string;
  username: string;
  displayName: string;
  avatar: string;
  lastSeen?: number;
}

export interface PresenceUpdate {
  userId: string;
  username: string;
  displayName: string;
  avatar: string;
  action: 'join' | 'leave' | 'heartbeat';
  timestamp: string;
}

/**
 * Announces user presence on a board
 */
export async function announcePresence(boardId: string, action: 'join' | 'leave' | 'heartbeat' = 'join'): Promise<void> {
  const token = getAccessToken();
  if (!token) {
    return;
  }

  try {
    await fetch(`${API_URL}/api/presence/announce`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ boardId, action }),
    });
  } catch (error) {
    console.error('Failed to announce presence:', error);
  }
}

/**
 * Gets active users on a board
 */
export async function getActiveUsers(boardId: string): Promise<PresenceUser[]> {
  const token = getAccessToken();
  if (!token) {
    return [];
  }

  try {
    const response = await fetch(`${API_URL}/api/presence/${boardId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data.users || [];
  } catch (error) {
    console.error('Failed to get active users:', error);
    return [];
  }
}
