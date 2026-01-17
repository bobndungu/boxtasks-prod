import { getAccessToken, fetchWithCsrf } from './client';

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
 * Announces user presence on a board.
 * Supports both OAuth tokens and session cookie authentication.
 */
export async function announcePresence(boardId: string, action: 'join' | 'leave' | 'heartbeat' = 'join'): Promise<void> {
  try {
    await fetchWithCsrf(`${API_URL}/api/presence/announce`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ boardId, action }),
      credentials: 'include', // Include session cookies for cookie-based auth
    });
  } catch (error) {
    console.error('Failed to announce presence:', error);
  }
}

/**
 * Gets active users on a board.
 * Supports both OAuth tokens and session cookie authentication.
 */
export async function getActiveUsers(boardId: string): Promise<PresenceUser[]> {
  const token = getAccessToken();

  // Build headers - include token if available
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_URL}/api/presence/${boardId}`, {
      headers,
      credentials: 'include', // Include session cookies for cookie-based auth
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
