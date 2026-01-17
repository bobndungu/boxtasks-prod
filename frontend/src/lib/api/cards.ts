import { getAccessToken, fetchWithCsrf } from './client';

const API_URL = import.meta.env.VITE_API_URL || 'https://boxtasks2.ddev.site';

// Helper function to format dates for Drupal JSON:API datetime fields
// Drupal JSON:API requires RFC 3339 format: Y-m-d\TH:i:sP (e.g., 2026-01-26T11:30:00+00:00)
function formatDateForDrupal(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  let formatted = dateStr;
  // Remove existing timezone info - we'll add UTC timezone at the end
  formatted = formatted.replace(/[+-]\d{2}:\d{2}$/, '').replace(/[+-]\d{4}$/, '').replace('Z', '');
  // Remove milliseconds if present
  formatted = formatted.replace(/\.\d{3}/, '');
  // Add seconds if missing (datetime-local gives HH:MM without seconds)
  if (/T\d{2}:\d{2}$/.test(formatted)) {
    formatted += ':00';
  }
  // If no time part, add default time
  if (!formatted.includes('T')) {
    formatted += 'T12:00:00';
  }
  // Add UTC timezone suffix (required by Drupal JSON:API RFC 3339 format)
  formatted += '+00:00';
  return formatted;
}

/**
 * Helper function to normalize dates FROM Drupal JSON:API.
 * Drupal returns datetime fields without timezone suffix (e.g., "2026-01-17T18:07:23").
 * JavaScript interprets such strings as LOCAL time, but they are actually UTC.
 * This function ensures dates are properly marked as UTC so they display correctly.
 */
function normalizeDateFromDrupal(dateStr: string | null | undefined): string | undefined {
  if (!dateStr) return undefined;
  // If the date already has timezone info, return as-is
  if (/[+-]\d{2}:\d{2}$/.test(dateStr) || /Z$/.test(dateStr)) {
    return dateStr;
  }
  // Add 'Z' to indicate UTC - Drupal stores datetime fields in UTC
  return dateStr + 'Z';
}

export type CardLabel = 'green' | 'yellow' | 'orange' | 'red' | 'purple' | 'blue';

export interface CardMember {
  id: string;
  name: string;
  email?: string;
}

export interface TaxonomyReference {
  id: string;
  name: string;
}

export interface Card {
  id: string;
  title: string;
  description?: string;
  listId: string;
  position: number;
  startDate?: string;
  dueDate?: string;
  labels: CardLabel[];
  archived: boolean;
  completed: boolean;
  pinned: boolean;
  coverImageUrl?: string;
  coverImageId?: string;
  watcherIds: string[];
  watchers: CardMember[];
  memberIds: string[];
  members: CardMember[];
  department?: TaxonomyReference;
  client?: TaxonomyReference;
  createdAt: string;
  updatedAt: string;
  authorId?: string; // The user who created this card
  // Activity counts for expanded view
  commentCount: number;
  attachmentCount: number;
  checklistCompleted: number;
  checklistTotal: number;
  // Approval fields
  isApproved: boolean;
  approvedBy?: CardMember;
  approvedAt?: string;
  // Rejection fields
  isRejected: boolean;
  rejectedBy?: CardMember;
  rejectedAt?: string;
  // Estimate fields
  estimate?: number;
  estimateType?: 'hours' | 'points' | 'tshirt';
  complexity?: 'trivial' | 'low' | 'medium' | 'high' | 'very_high';
  // Google Docs
  googleDocs: { url: string; title: string }[];
}

export interface CreateCardData {
  title: string;
  listId: string;
  description?: string;
  position?: number;
  startDate?: string;
  dueDate?: string;
  labels?: CardLabel[];
  creatorId?: string; // Auto-assign creator as member
}

// Build lookup maps from included array for O(1) access instead of O(n) linear search
// This is called once per API response and cached for all card transformations
function buildIncludedMaps(included?: Record<string, unknown>[]): {
  usersById: Map<string, Record<string, unknown>>;
  taxonomyById: Map<string, Record<string, unknown>>;
  filesById: Map<string, Record<string, unknown>>;
} {
  const usersById = new Map<string, Record<string, unknown>>();
  const taxonomyById = new Map<string, Record<string, unknown>>();
  const filesById = new Map<string, Record<string, unknown>>();

  if (included) {
    for (const item of included) {
      const id = item.id as string;
      const type = item.type as string;
      if (type === 'user--user') {
        usersById.set(id, item);
      } else if (type?.startsWith('taxonomy_term--')) {
        taxonomyById.set(id, item);
      } else if (type === 'file--file') {
        filesById.set(id, item);
      }
    }
  }

  return { usersById, taxonomyById, filesById };
}

// Transform JSON:API response to Card - optimized with Map lookups
function transformCard(
  data: Record<string, unknown>,
  included?: Record<string, unknown>[],
  // Optional pre-built maps for batch processing (avoids rebuilding for each card)
  maps?: ReturnType<typeof buildIncludedMaps>
): Card {
  const attrs = data.attributes as Record<string, unknown>;
  const rels = data.relationships as Record<string, { data: { id: string; type?: string } | { id: string; type?: string }[] | null }> | undefined;

  // Use pre-built maps or build them (for single card fetches)
  const { usersById, taxonomyById, filesById } = maps || buildIncludedMaps(included);

  // Get cover image URL from included if available - O(1) lookup
  let coverImageUrl: string | undefined;
  let coverImageId: string | undefined;
  const coverData = rels?.field_card_cover?.data;
  const coverFileId = coverData && !Array.isArray(coverData) ? coverData.id : undefined;
  if (coverFileId) {
    coverImageId = coverFileId;
    const file = filesById.get(coverFileId);
    if (file) {
      const fileAttrs = file.attributes as Record<string, unknown>;
      const uri = (fileAttrs.uri as { url?: string })?.url || '';
      if (uri) {
        coverImageUrl = uri.startsWith('http') ? uri : `${API_URL}${uri}`;
      }
    }
  }

  // Get watcher IDs and watcher data - O(1) lookups
  const watchersData = rels?.field_card_watchers?.data || rels?.field_watchers?.data;
  const watcherIds: string[] = Array.isArray(watchersData)
    ? watchersData.map((w) => w.id)
    : [];

  const watchers: CardMember[] = watcherIds.map((watcherId) => {
    const user = usersById.get(watcherId);
    if (user) {
      const userAttrs = user.attributes as Record<string, unknown>;
      return {
        id: watcherId,
        name: (userAttrs.field_display_name as string) || (userAttrs.name as string) || 'Unknown User',
        email: userAttrs.mail as string | undefined,
      };
    }
    return { id: watcherId, name: 'Unknown User' };
  });

  // Get member IDs and member data - O(1) lookups
  const membersData = rels?.field_card_members?.data;
  const memberIds: string[] = Array.isArray(membersData)
    ? membersData.map((m) => m.id)
    : [];

  const members: CardMember[] = memberIds.map((memberId) => {
    const user = usersById.get(memberId);
    if (user) {
      const userAttrs = user.attributes as Record<string, unknown>;
      return {
        id: memberId,
        name: (userAttrs.field_display_name as string) || (userAttrs.name as string) || 'Unknown User',
        email: userAttrs.mail as string | undefined,
      };
    }
    return { id: memberId, name: 'Unknown User' };
  });

  // Get list ID (single reference)
  const listData = rels?.field_card_list?.data;
  const listId = listData && !Array.isArray(listData) ? listData.id : '';

  // Get department data - O(1) lookup
  let department: { id: string; name: string } | undefined;
  const departmentData = rels?.field_card_department?.data;
  const departmentId = departmentData && !Array.isArray(departmentData) ? departmentData.id : undefined;
  if (departmentId) {
    const departmentTerm = taxonomyById.get(departmentId);
    if (departmentTerm) {
      const termAttrs = departmentTerm.attributes as Record<string, unknown>;
      department = {
        id: departmentId,
        name: termAttrs.name as string,
      };
    }
  }

  // Get client data - O(1) lookup
  let client: { id: string; name: string } | undefined;
  const clientData = rels?.field_card_client?.data;
  const clientId = clientData && !Array.isArray(clientData) ? clientData.id : undefined;
  if (clientId) {
    const clientTerm = taxonomyById.get(clientId);
    if (clientTerm) {
      const termAttrs = clientTerm.attributes as Record<string, unknown>;
      client = {
        id: clientId,
        name: termAttrs.name as string,
      };
    }
  }

  // Get author ID (node creator)
  const authorData = rels?.uid?.data;
  const authorId = authorData && !Array.isArray(authorData) ? authorData.id : undefined;

  // Get approval data - O(1) lookup
  const isApproved = (attrs.field_card_approved as boolean) || false;
  let approvedBy: CardMember | undefined;
  const approvedByData = rels?.field_card_approved_by?.data;
  const approvedById = approvedByData && !Array.isArray(approvedByData) ? approvedByData.id : undefined;
  if (approvedById) {
    const approverUser = usersById.get(approvedById);
    if (approverUser) {
      const userAttrs = approverUser.attributes as Record<string, unknown>;
      approvedBy = {
        id: approvedById,
        name: (userAttrs.field_display_name as string) || (userAttrs.display_name as string) || (userAttrs.name as string) || 'Unknown',
      };
    }
  }
  const approvedAt = normalizeDateFromDrupal(attrs.field_card_approved_at as string);

  // Get rejection data - O(1) lookup
  const isRejected = (attrs.field_card_rejected as boolean) || false;
  let rejectedBy: CardMember | undefined;
  const rejectedByData = rels?.field_card_rejected_by?.data;
  const rejectedById = rejectedByData && !Array.isArray(rejectedByData) ? rejectedByData.id : undefined;
  if (rejectedById) {
    const rejecterUser = usersById.get(rejectedById);
    if (rejecterUser) {
      const userAttrs = rejecterUser.attributes as Record<string, unknown>;
      rejectedBy = {
        id: rejectedById,
        name: (userAttrs.field_display_name as string) || (userAttrs.display_name as string) || (userAttrs.name as string) || 'Unknown',
      };
    }
  }
  const rejectedAt = normalizeDateFromDrupal(attrs.field_card_rejected_at as string);

  return {
    id: data.id as string,
    title: attrs.title as string,
    // Card content type uses field_card_description (text_long with format)
    description: (attrs.field_card_description as { value?: string })?.value || '',
    listId,
    position: (attrs.field_card_position as number) || 0,
    // Production uses 'field_start_date' instead of 'field_card_start_date'
    // Use normalizeDateFromDrupal to ensure UTC dates are properly parsed
    startDate: normalizeDateFromDrupal((attrs.field_start_date as string) || (attrs.field_card_start_date as string)),
    dueDate: normalizeDateFromDrupal((attrs.field_card_due_date as string) || (attrs.field_due_date as string)),
    // Production uses 'field_labels' as entity references - handle both formats
    labels: (attrs.field_card_labels as CardLabel[]) || [],
    archived: (attrs.field_card_archived as boolean) || (attrs.field_archived as boolean) || false,
    // Production doesn't have field_card_completed - default to false
    completed: (attrs.field_card_completed as boolean) || false,
    // Production uses 'field_pinned' instead of 'field_card_pinned'
    pinned: (attrs.field_pinned as boolean) || (attrs.field_card_pinned as boolean) || false,
    coverImageUrl,
    coverImageId,
    watcherIds,
    watchers,
    memberIds,
    members,
    department,
    client,
    createdAt: attrs.created as string,
    updatedAt: attrs.changed as string,
    authorId,
    // Initialize counts to 0 - will be populated when loading board if needed
    commentCount: 0,
    attachmentCount: 0,
    checklistCompleted: 0,
    checklistTotal: 0,
    // Approval fields
    isApproved,
    approvedBy,
    approvedAt,
    // Rejection fields
    isRejected,
    rejectedBy,
    rejectedAt,
    // Estimate fields
    estimate: (attrs.field_card_estimate as number) || undefined,
    estimateType: (attrs.field_card_estimate_type as 'hours' | 'points' | 'tshirt') || undefined,
    complexity: (attrs.field_card_complexity as 'trivial' | 'low' | 'medium' | 'high' | 'very_high') || undefined,
    // Google Docs
    googleDocs: Array.isArray(attrs.field_card_google_docs)
      ? (attrs.field_card_google_docs as { uri: string; title: string }[]).map((doc) => ({
          url: doc.uri,
          title: doc.title || 'Google Document',
        }))
      : [],
  };
}

// Sparse fieldsets to reduce payload size - only request fields we actually use
const SPARSE_FIELDSETS = [
  'fields[user--user]=name,field_display_name,mail',
  'fields[taxonomy_term--department]=name',
  'fields[taxonomy_term--client]=name',
  'fields[file--file]=uri',
].join('&');

// Fetch all cards for a list
export async function fetchCardsByList(listId: string): Promise<Card[]> {
  const response = await fetch(
    `${API_URL}/jsonapi/node/card?filter[field_card_list.id]=${listId}&filter[field_card_archived][value]=0&sort=field_card_position&include=field_card_members,field_card_department,field_card_client,field_card_approved_by,field_card_rejected_by,field_card_watchers&${SPARSE_FIELDSETS}`,
    {
      headers: {
        'Accept': 'application/vnd.api+json',
        'Authorization': `Bearer ${getAccessToken()}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch cards');
  }

  const result = await response.json();
  const data = result.data;
  const included = result.included as Record<string, unknown>[] | undefined;
  if (!Array.isArray(data)) return [];

  // Build maps once for O(1) lookups across all cards
  const maps = buildIncludedMaps(included);
  return data.map((item) => transformCard(item, included, maps));
}

// Fetch all cards for multiple lists (for board view) - uses OR filter for single request
export async function fetchCardsByBoard(_boardId: string, listIds: string[]): Promise<Map<string, Card[]>> {
  if (listIds.length === 0) return new Map();

  // Use OR group filter for fetching cards from multiple lists in a single request
  let filterParams = 'filter[or-group][group][conjunction]=OR';
  listIds.forEach((id, index) => {
    filterParams += `&filter[list-${index}][condition][path]=field_card_list.id`;
    filterParams += `&filter[list-${index}][condition][value]=${id}`;
    filterParams += `&filter[list-${index}][condition][memberOf]=or-group`;
  });

  const response = await fetch(
    `${API_URL}/jsonapi/node/card?${filterParams}&filter[field_card_archived][value]=0&sort=field_card_position&include=field_card_members,field_card_department,field_card_client,field_card_approved_by,field_card_rejected_by,field_card_watchers&${SPARSE_FIELDSETS}&page[limit]=200`,
    {
      headers: {
        'Accept': 'application/vnd.api+json',
        'Authorization': `Bearer ${getAccessToken()}`,
      },
    }
  );

  if (!response.ok) {
    // Fall back to parallel queries if complex filter fails
    const cardMap = new Map<string, Card[]>();
    const promises = listIds.map(listId =>
      fetchCardsByList(listId).then(cards => ({ listId, cards }))
    );
    const results = await Promise.all(promises);
    results.forEach(({ listId, cards }) => cardMap.set(listId, cards));
    return cardMap;
  }

  const result = await response.json();
  const data = result.data;
  const included = result.included as Record<string, unknown>[] | undefined;

  const cardMap = new Map<string, Card[]>();
  listIds.forEach((id) => cardMap.set(id, []));

  if (Array.isArray(data)) {
    // Build maps once for O(1) lookups across all cards in batch
    const maps = buildIncludedMaps(included);
    data.forEach((item) => {
      const card = transformCard(item, included, maps);
      const existing = cardMap.get(card.listId) || [];
      cardMap.set(card.listId, [...existing, card]);
    });
  }

  return cardMap;
}

// Fetch a single card
export async function fetchCard(id: string): Promise<Card> {
  const response = await fetch(`${API_URL}/jsonapi/node/card/${id}?include=field_card_members,field_card_department,field_card_client,field_card_approved_by,field_card_rejected_by,field_card_watchers&${SPARSE_FIELDSETS}`, {
    headers: {
      'Accept': 'application/vnd.api+json',
      'Authorization': `Bearer ${getAccessToken()}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch card');
  }

  const result = await response.json();
  const included = result.included as Record<string, unknown>[] | undefined;
  return transformCard(result.data, included);
}

// Create a new card
export async function createCard(data: CreateCardData): Promise<Card> {
  // Build relationships object
  const relationships: Record<string, unknown> = {
    field_card_list: {
      data: { type: 'node--board_list', id: data.listId },
    },
  };

  // Auto-assign creator as member if creatorId is provided
  if (data.creatorId) {
    relationships.field_card_members = {
      data: [{ type: 'user--user', id: data.creatorId }],
    };
  }

  const response = await fetchWithCsrf(`${API_URL}/jsonapi/node/card`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: {
        type: 'node--card',
        attributes: {
          title: data.title,
          // Card content type uses field_card_description (text_long with format)
          field_card_description: data.description ? { value: data.description, format: 'basic_html' } : null,
          field_card_position: data.position || 0,
          // Production uses 'field_start_date' instead of 'field_card_start_date'
          field_start_date: formatDateForDrupal(data.startDate),
          // Use field_card_due_date (exists on production)
          field_card_due_date: formatDateForDrupal(data.dueDate),
          field_card_archived: false,
        },
        relationships,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.errors?.[0]?.detail || 'Failed to create card');
  }

  const result = await response.json();
  return transformCard(result.data);
}

// Update a card
export async function updateCard(id: string, data: Partial<CreateCardData> & { archived?: boolean; completed?: boolean; pinned?: boolean; estimate?: number | null; estimateType?: 'hours' | 'points' | 'tshirt' | null; complexity?: 'trivial' | 'low' | 'medium' | 'high' | 'very_high' | null }): Promise<Card> {
  const attributes: Record<string, unknown> = {};
  const relationships: Record<string, unknown> = {};

  if (data.title) attributes.title = data.title;
  if (data.description !== undefined) {
    // Card content type uses field_card_description (text_long with format)
    attributes.field_card_description = data.description ? { value: data.description, format: 'basic_html' } : null;
  }
  if (data.position !== undefined) attributes.field_card_position = data.position;
  if (data.startDate !== undefined) {
    // Production uses 'field_start_date' instead of 'field_card_start_date'
    attributes.field_start_date = formatDateForDrupal(data.startDate);
  }
  if (data.dueDate !== undefined) {
    // Use field_card_due_date (exists on production)
    attributes.field_card_due_date = formatDateForDrupal(data.dueDate);
  }
  if (data.archived !== undefined) attributes.field_card_archived = data.archived;
  // Production uses 'field_pinned' instead of 'field_card_pinned'
  if (data.pinned !== undefined) attributes.field_pinned = data.pinned;
  // Estimate fields
  if (data.estimate !== undefined) attributes.field_card_estimate = data.estimate;
  if (data.estimateType !== undefined) attributes.field_card_estimate_type = data.estimateType;
  if (data.complexity !== undefined) attributes.field_card_complexity = data.complexity;

  if (data.listId) {
    relationships.field_card_list = {
      data: { type: 'node--board_list', id: data.listId },
    };
  }

  const response = await fetchWithCsrf(`${API_URL}/jsonapi/node/card/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: {
        type: 'node--card',
        id,
        attributes,
        ...(Object.keys(relationships).length > 0 && { relationships }),
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.errors?.[0]?.detail || 'Failed to update card');
  }

  const result = await response.json();
  return transformCard(result.data);
}

// Delete a card
export async function deleteCard(id: string): Promise<void> {
  const response = await fetchWithCsrf(`${API_URL}/jsonapi/node/card/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok && response.status !== 204) {
    throw new Error('Failed to delete card');
  }
}

// Move a card to a different list
export async function moveCard(cardId: string, targetListId: string, position: number): Promise<Card> {
  return updateCard(cardId, { listId: targetListId, position });
}

// Archive a card
export async function archiveCard(id: string): Promise<Card> {
  return updateCard(id, { archived: true });
}

// Restore (unarchive) a card
export async function restoreCard(id: string): Promise<Card> {
  return updateCard(id, { archived: false });
}

// Fetch archived cards for a board (across all lists)
export async function fetchArchivedCardsByBoard(_boardId: string, listIds: string[]): Promise<Card[]> {
  if (listIds.length === 0) return [];

  // Use OR group filter for fetching archived cards from multiple lists in a single request
  let filterParams = 'filter[or-group][group][conjunction]=OR';
  listIds.forEach((id, index) => {
    filterParams += `&filter[list-${index}][condition][path]=field_card_list.id`;
    filterParams += `&filter[list-${index}][condition][value]=${id}`;
    filterParams += `&filter[list-${index}][condition][memberOf]=or-group`;
  });

  const response = await fetch(
    `${API_URL}/jsonapi/node/card?${filterParams}&filter[field_card_archived][value]=1&sort=-changed&include=field_card_members,field_card_department,field_card_client,field_card_approved_by,field_card_rejected_by,field_card_watchers&${SPARSE_FIELDSETS}`,
    {
      headers: {
        'Accept': 'application/vnd.api+json',
        'Authorization': `Bearer ${getAccessToken()}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch archived cards');
  }

  const result = await response.json();
  const data = result.data;
  const included = result.included as Record<string, unknown>[] | undefined;
  if (!Array.isArray(data)) return [];

  // Build maps once for O(1) lookups across all cards
  const maps = buildIncludedMaps(included);
  return data.map((item) => transformCard(item, included, maps));
}

// Update card department
export async function updateCardDepartment(cardId: string, departmentId: string | null): Promise<Card> {
  const response = await fetchWithCsrf(`${API_URL}/jsonapi/node/card/${cardId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: {
        type: 'node--card',
        id: cardId,
        relationships: {
          field_card_department: {
            data: departmentId ? { type: 'taxonomy_term--department', id: departmentId } : null,
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.errors?.[0]?.detail || 'Failed to update card department');
  }

  return fetchCard(cardId);
}

// Update card client
export async function updateCardClient(cardId: string, clientId: string | null): Promise<Card> {
  const response = await fetchWithCsrf(`${API_URL}/jsonapi/node/card/${cardId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: {
        type: 'node--card',
        id: cardId,
        relationships: {
          field_card_client: {
            data: clientId ? { type: 'taxonomy_term--client', id: clientId } : null,
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.errors?.[0]?.detail || 'Failed to update card client');
  }

  return fetchCard(cardId);
}

// Upload a cover image for a card
export async function uploadCardCover(cardId: string, file: File): Promise<Card> {
  // Step 1: Upload the file
  const uploadResponse = await fetchWithCsrf(
    `${API_URL}/jsonapi/node/card/${cardId}/field_card_cover`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Accept': 'application/vnd.api+json',
        'Content-Disposition': `file; filename="${encodeURIComponent(file.name)}"`,
      },
      body: file,
    }
  );

  if (!uploadResponse.ok) {
    const error = await uploadResponse.json();
    throw new Error(error.errors?.[0]?.detail || 'Failed to upload cover image');
  }

  // Fetch the updated card to get the cover image URL
  return fetchCard(cardId);
}

// Remove cover image from a card
export async function removeCardCover(cardId: string): Promise<Card> {
  const response = await fetchWithCsrf(`${API_URL}/jsonapi/node/card/${cardId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: {
        type: 'node--card',
        id: cardId,
        relationships: {
          field_card_cover: {
            data: null,
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.errors?.[0]?.detail || 'Failed to remove cover image');
  }

  const result = await response.json();
  const included = result.included as Record<string, unknown>[] | undefined;
  return transformCard(result.data, included);
}

// Watch a card (add current user to watchers)
export async function watchCard(cardId: string, userId: string): Promise<Card> {
  // First fetch current watchers
  const card = await fetchCard(cardId);
  const currentWatchers = card.watcherIds || [];

  // Add user if not already watching
  if (currentWatchers.includes(userId)) {
    return card;
  }

  const newWatchers = [...currentWatchers, userId];

  const response = await fetchWithCsrf(`${API_URL}/jsonapi/node/card/${cardId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: {
        type: 'node--card',
        id: cardId,
        relationships: {
          field_card_watchers: {
            data: newWatchers.map(id => ({ type: 'user--user', id })),
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.errors?.[0]?.detail || 'Failed to watch card');
  }

  // Fetch the updated card to get all relationship data (members, watchers, etc.)
  return fetchCard(cardId);
}

// Unwatch a card (remove current user from watchers)
export async function unwatchCard(cardId: string, userId: string): Promise<Card> {
  // First fetch current watchers
  const card = await fetchCard(cardId);
  const currentWatchers = card.watcherIds || [];

  // Remove user if watching
  if (!currentWatchers.includes(userId)) {
    return card;
  }

  const newWatchers = currentWatchers.filter(id => id !== userId);

  const response = await fetchWithCsrf(`${API_URL}/jsonapi/node/card/${cardId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: {
        type: 'node--card',
        id: cardId,
        relationships: {
          field_card_watchers: {
            data: newWatchers.length > 0
              ? newWatchers.map(id => ({ type: 'user--user', id }))
              : [],
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.errors?.[0]?.detail || 'Failed to unwatch card');
  }

  // Fetch the updated card to get all relationship data (members, watchers, etc.)
  return fetchCard(cardId);
}

// Assign a member to a card
export async function assignMember(cardId: string, userId: string): Promise<Card> {
  // First fetch current members
  const card = await fetchCard(cardId);
  const currentMembers = card.memberIds || [];

  // Add user if not already assigned
  if (currentMembers.includes(userId)) {
    return card;
  }

  const newMembers = [...currentMembers, userId];

  const response = await fetchWithCsrf(`${API_URL}/jsonapi/node/card/${cardId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: {
        type: 'node--card',
        id: cardId,
        relationships: {
          field_card_members: {
            data: newMembers.map(id => ({ type: 'user--user', id })),
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.errors?.[0]?.detail || 'Failed to assign member');
  }

  // Fetch the updated card to get member details
  return fetchCard(cardId);
}

// Unassign a member from a card
export async function unassignMember(cardId: string, userId: string): Promise<Card> {
  // First fetch current members
  const card = await fetchCard(cardId);
  const currentMembers = card.memberIds || [];

  // Remove user if assigned
  if (!currentMembers.includes(userId)) {
    return card;
  }

  const newMembers = currentMembers.filter(id => id !== userId);

  const response = await fetchWithCsrf(`${API_URL}/jsonapi/node/card/${cardId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: {
        type: 'node--card',
        id: cardId,
        relationships: {
          field_card_members: {
            data: newMembers.length > 0
              ? newMembers.map(id => ({ type: 'user--user', id }))
              : [],
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.errors?.[0]?.detail || 'Failed to unassign member');
  }

  // Fetch the updated card to get member details
  return fetchCard(cardId);
}

// Approve a card (sets approval status, approver, and timestamp; clears rejection)
export async function approveCard(cardId: string, approverId: string): Promise<Card> {
  // Format datetime for Drupal (RFC 3339 without milliseconds: Y-m-d\TH:i:sP)
  const drupalDatetime = new Date().toISOString().replace(/\.\d{3}Z$/, '+00:00');

  const response = await fetchWithCsrf(`${API_URL}/jsonapi/node/card/${cardId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: {
        type: 'node--card',
        id: cardId,
        attributes: {
          field_card_approved: true,
          field_card_approved_at: drupalDatetime,
          field_card_rejected: false,
          field_card_rejected_at: null,
        },
        relationships: {
          field_card_approved_by: {
            data: { type: 'user--user', id: approverId },
          },
          field_card_rejected_by: {
            data: null,
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.errors?.[0]?.detail || 'Failed to approve card');
  }

  return fetchCard(cardId);
}

// Reject a card (sets rejection status and clears approval)
export async function rejectCard(cardId: string, rejecterId: string): Promise<Card> {
  // Format datetime for Drupal (RFC 3339 without milliseconds: Y-m-d\TH:i:sP)
  const drupalDatetime = new Date().toISOString().replace(/\.\d{3}Z$/, '+00:00');

  const response = await fetchWithCsrf(`${API_URL}/jsonapi/node/card/${cardId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: {
        type: 'node--card',
        id: cardId,
        attributes: {
          field_card_approved: false,
          field_card_approved_at: null,
          field_card_rejected: true,
          field_card_rejected_at: drupalDatetime,
        },
        relationships: {
          field_card_approved_by: {
            data: null,
          },
          field_card_rejected_by: {
            data: { type: 'user--user', id: rejecterId },
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.errors?.[0]?.detail || 'Failed to reject card');
  }

  return fetchCard(cardId);
}

// Clear approval/rejection status (reset to neither approved nor rejected)
export async function clearApprovalStatus(cardId: string): Promise<Card> {
  // Clear the boolean flags - this is what determines approval/rejection status
  // The 'by' and 'at' fields will remain as historical record but won't matter since the status is cleared
  const response = await fetchWithCsrf(`${API_URL}/jsonapi/node/card/${cardId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: {
        type: 'node--card',
        id: cardId,
        attributes: {
          field_card_approved: false,
          field_card_rejected: false,
        },
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('Failed to clear approval status:', error);
    throw new Error(error.errors?.[0]?.detail || 'Failed to clear approval status');
  }

  return fetchCard(cardId);
}

// Add a Google Doc to a card
export async function addGoogleDoc(cardId: string, url: string, title: string): Promise<Card> {
  // First fetch current Google Docs
  const card = await fetchCard(cardId);
  const currentDocs = card.googleDocs || [];

  // Check if already exists
  if (currentDocs.some(doc => doc.url === url)) {
    return card;
  }

  // Add the new doc
  const newDocs = [...currentDocs, { url, title }];

  const response = await fetchWithCsrf(`${API_URL}/jsonapi/node/card/${cardId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: {
        type: 'node--card',
        id: cardId,
        attributes: {
          field_card_google_docs: newDocs.map(doc => ({
            uri: doc.url,
            title: doc.title,
          })),
        },
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.errors?.[0]?.detail || 'Failed to add Google Doc');
  }

  return fetchCard(cardId);
}

// Remove a Google Doc from a card
export async function removeGoogleDoc(cardId: string, url: string): Promise<Card> {
  // First fetch current Google Docs
  const card = await fetchCard(cardId);
  const currentDocs = card.googleDocs || [];

  // Check if exists
  if (!currentDocs.some(doc => doc.url === url)) {
    return card;
  }

  // Remove the doc
  const newDocs = currentDocs.filter(doc => doc.url !== url);

  const response = await fetchWithCsrf(`${API_URL}/jsonapi/node/card/${cardId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: {
        type: 'node--card',
        id: cardId,
        attributes: {
          field_card_google_docs: newDocs.length > 0
            ? newDocs.map(doc => ({
                uri: doc.url,
                title: doc.title,
              }))
            : [],
        },
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.errors?.[0]?.detail || 'Failed to remove Google Doc');
  }

  return fetchCard(cardId);
}
