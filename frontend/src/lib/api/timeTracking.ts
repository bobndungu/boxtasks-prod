import { getAccessToken, fetchWithCsrf } from './client';

const API_URL = import.meta.env.VITE_API_URL || 'https://boxtasks2.ddev.site';

export interface TimeEntry {
  id: string;
  cardId: string;
  userId: string;
  userName: string;
  startTime: string;
  endTime?: string;
  duration: number; // in minutes
  description?: string;
  billable: boolean;
  createdAt: string;
  updatedAt: string;
}

// Transform JSON:API response to TimeEntry
function transformTimeEntry(data: Record<string, unknown>, included?: Record<string, unknown>[]): TimeEntry {
  const attrs = data.attributes as Record<string, unknown>;
  const rels = data.relationships as Record<string, { data: { id: string } | null }> | undefined;

  const cardRef = rels?.field_time_card?.data;
  const cardId = cardRef ? cardRef.id : '';

  // Get user info
  const userId = (data.uid as { id: string })?.id || '';
  let userName = 'Unknown User';

  if (included) {
    const user = included.find(
      (item) => item.type === 'user--user' && item.id === userId
    );
    if (user) {
      const userAttrs = user.attributes as Record<string, unknown>;
      userName = (userAttrs.field_display_name as string) || (userAttrs.name as string) || 'Unknown User';
    }
  }

  return {
    id: data.id as string,
    cardId,
    userId,
    userName,
    startTime: attrs.field_time_start as string,
    endTime: attrs.field_time_end as string | undefined,
    duration: (attrs.field_time_duration as number) || 0,
    description: (attrs.field_time_description as { value?: string })?.value || '',
    billable: (attrs.field_time_billable as boolean) || false,
    createdAt: attrs.created as string,
    updatedAt: attrs.changed as string,
  };
}

// Fetch time entries for a card
export async function fetchTimeEntriesByCard(cardId: string): Promise<TimeEntry[]> {
  const response = await fetch(
    `${API_URL}/jsonapi/node/time_entry?filter[field_time_card.id]=${cardId}&include=uid&sort=-created`,
    {
      headers: {
        Accept: 'application/vnd.api+json',
        Authorization: `Bearer ${getAccessToken()}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch time entries');
  }

  const result = await response.json();
  const data = result.data;
  if (!Array.isArray(data)) return [];

  return data.map((item: Record<string, unknown>) => transformTimeEntry(item, result.included));
}

// Fetch time entries for the current user
export async function fetchMyTimeEntries(options?: {
  startDate?: string;
  endDate?: string;
}): Promise<TimeEntry[]> {
  let url = `${API_URL}/jsonapi/node/time_entry?include=uid,field_time_card&sort=-created`;

  // Add date filters if provided
  if (options?.startDate) {
    url += `&filter[field_time_start][condition][path]=field_time_start&filter[field_time_start][condition][operator]=%3E%3D&filter[field_time_start][condition][value]=${options.startDate}`;
  }
  if (options?.endDate) {
    url += `&filter[field_time_end][condition][path]=field_time_end&filter[field_time_end][condition][operator]=%3C%3D&filter[field_time_end][condition][value]=${options.endDate}`;
  }

  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.api+json',
      Authorization: `Bearer ${getAccessToken()}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch time entries');
  }

  const result = await response.json();
  const data = result.data;
  if (!Array.isArray(data)) return [];

  return data.map((item: Record<string, unknown>) => transformTimeEntry(item, result.included));
}

// Start a time entry (create with start time only)
export async function startTimeEntry(data: {
  cardId: string;
  description?: string;
  billable?: boolean;
}): Promise<TimeEntry> {
  const startTime = new Date().toISOString();

  const response = await fetchWithCsrf(`${API_URL}/jsonapi/node/time_entry`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      Accept: 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: {
        type: 'node--time_entry',
        attributes: {
          title: `Time entry for ${startTime}`,
          field_time_start: startTime,
          field_time_duration: 0,
          field_time_description: data.description ? { value: data.description } : null,
          field_time_billable: data.billable ?? false,
        },
        relationships: {
          field_time_card: {
            data: { type: 'node--card', id: data.cardId },
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.errors?.[0]?.detail || 'Failed to start time entry');
  }

  const result = await response.json();
  return transformTimeEntry(result.data);
}

// Stop a time entry (set end time and calculate duration)
export async function stopTimeEntry(id: string): Promise<TimeEntry> {
  // First, get the current entry to get the start time
  const getResponse = await fetch(`${API_URL}/jsonapi/node/time_entry/${id}`, {
    headers: {
      Accept: 'application/vnd.api+json',
      Authorization: `Bearer ${getAccessToken()}`,
    },
  });

  if (!getResponse.ok) {
    throw new Error('Failed to fetch time entry');
  }

  const current = await getResponse.json();
  const startTime = new Date((current.data.attributes as Record<string, unknown>).field_time_start as string);
  const endTime = new Date();
  const durationMs = endTime.getTime() - startTime.getTime();
  const durationMinutes = Math.max(1, Math.round(durationMs / 60000)); // At least 1 minute

  const response = await fetchWithCsrf(`${API_URL}/jsonapi/node/time_entry/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      Accept: 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: {
        type: 'node--time_entry',
        id,
        attributes: {
          field_time_end: endTime.toISOString(),
          field_time_duration: durationMinutes,
        },
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.errors?.[0]?.detail || 'Failed to stop time entry');
  }

  const result = await response.json();
  return transformTimeEntry(result.data);
}

// Create a manual time entry
export async function createTimeEntry(data: {
  cardId: string;
  startTime: string;
  endTime: string;
  description?: string;
  billable?: boolean;
}): Promise<TimeEntry> {
  const start = new Date(data.startTime);
  const end = new Date(data.endTime);
  const durationMs = end.getTime() - start.getTime();
  const durationMinutes = Math.max(1, Math.round(durationMs / 60000));

  const response = await fetchWithCsrf(`${API_URL}/jsonapi/node/time_entry`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      Accept: 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: {
        type: 'node--time_entry',
        attributes: {
          title: `Time entry for ${data.startTime}`,
          field_time_start: data.startTime,
          field_time_end: data.endTime,
          field_time_duration: durationMinutes,
          field_time_description: data.description ? { value: data.description } : null,
          field_time_billable: data.billable ?? false,
        },
        relationships: {
          field_time_card: {
            data: { type: 'node--card', id: data.cardId },
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.errors?.[0]?.detail || 'Failed to create time entry');
  }

  const result = await response.json();
  return transformTimeEntry(result.data);
}

// Update a time entry
export async function updateTimeEntry(
  id: string,
  data: {
    startTime?: string;
    endTime?: string;
    duration?: number;
    description?: string;
    billable?: boolean;
  }
): Promise<TimeEntry> {
  const attributes: Record<string, unknown> = {};

  if (data.startTime) attributes.field_time_start = data.startTime;
  if (data.endTime !== undefined) attributes.field_time_end = data.endTime || null;
  if (data.duration !== undefined) attributes.field_time_duration = data.duration;
  if (data.description !== undefined) {
    attributes.field_time_description = data.description ? { value: data.description } : null;
  }
  if (data.billable !== undefined) attributes.field_time_billable = data.billable;

  const response = await fetchWithCsrf(`${API_URL}/jsonapi/node/time_entry/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      Accept: 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: {
        type: 'node--time_entry',
        id,
        attributes,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.errors?.[0]?.detail || 'Failed to update time entry');
  }

  const result = await response.json();
  return transformTimeEntry(result.data);
}

// Delete a time entry
export async function deleteTimeEntry(id: string): Promise<void> {
  const response = await fetchWithCsrf(`${API_URL}/jsonapi/node/time_entry/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok && response.status !== 204) {
    throw new Error('Failed to delete time entry');
  }
}

// Get running time entries for the current user
export async function getRunningTimeEntries(): Promise<TimeEntry[]> {
  const response = await fetch(
    `${API_URL}/jsonapi/node/time_entry?filter[field_time_end][condition][path]=field_time_end&filter[field_time_end][condition][operator]=IS%20NULL&include=uid,field_time_card&sort=-created`,
    {
      headers: {
        Accept: 'application/vnd.api+json',
        Authorization: `Bearer ${getAccessToken()}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch running time entries');
  }

  const result = await response.json();
  const data = result.data;
  if (!Array.isArray(data)) return [];

  return data.map((item: Record<string, unknown>) => transformTimeEntry(item, result.included));
}

// Get total time for a card
export async function getTotalTimeForCard(cardId: string): Promise<number> {
  const entries = await fetchTimeEntriesByCard(cardId);
  return entries.reduce((total, entry) => total + entry.duration, 0);
}

// Format duration as human readable string
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${mins}m`;
}
