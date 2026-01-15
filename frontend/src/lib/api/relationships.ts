import { getAccessToken, fetchWithCsrf } from './client';

const API_URL = import.meta.env.VITE_API_URL || 'https://boxtasks2.ddev.site';

export type RelationshipType =
  | 'relates_to'
  | 'blocks'
  | 'blocked_by'
  | 'duplicates'
  | 'duplicated_by'
  | 'parent_of'
  | 'child_of';

export interface CardRelationship {
  id: string;
  sourceCardId: string;
  targetCardId: string;
  type: RelationshipType;
  createdAt: string;
  // Populated card details for display
  sourceCard?: {
    id: string;
    title: string;
    listId?: string;
    listName?: string;
  };
  targetCard?: {
    id: string;
    title: string;
    listId?: string;
    listName?: string;
  };
}

export const RELATIONSHIP_TYPE_LABELS: Record<RelationshipType, string> = {
  relates_to: 'Relates To',
  blocks: 'Blocks',
  blocked_by: 'Is Blocked By',
  duplicates: 'Duplicates',
  duplicated_by: 'Is Duplicated By',
  parent_of: 'Parent Of',
  child_of: 'Child Of',
};

// Get the inverse relationship type
export function getInverseRelationshipType(type: RelationshipType): RelationshipType {
  const inverses: Record<RelationshipType, RelationshipType> = {
    relates_to: 'relates_to',
    blocks: 'blocked_by',
    blocked_by: 'blocks',
    duplicates: 'duplicated_by',
    duplicated_by: 'duplicates',
    parent_of: 'child_of',
    child_of: 'parent_of',
  };
  return inverses[type];
}

// Transform JSON:API response to CardRelationship
function transformRelationship(data: Record<string, unknown>, included?: Record<string, unknown>[]): CardRelationship {
  const attrs = data.attributes as Record<string, unknown>;
  const rels = data.relationships as Record<string, { data: { id: string; type: string } | null }> | undefined;

  const relationship: CardRelationship = {
    id: data.id as string,
    sourceCardId: rels?.field_source_card?.data?.id || '',
    targetCardId: rels?.field_target_card?.data?.id || '',
    type: (attrs.field_relationship_type as RelationshipType) || 'relates_to',
    createdAt: attrs.created as string,
  };

  // Populate card details from included data
  if (included) {
    const sourceCard = included.find(
      (item) => item.id === relationship.sourceCardId && item.type === 'node--card'
    );
    const targetCard = included.find(
      (item) => item.id === relationship.targetCardId && item.type === 'node--card'
    );

    if (sourceCard) {
      const sourceAttrs = sourceCard.attributes as Record<string, unknown>;
      const sourceRels = sourceCard.relationships as Record<string, { data: { id: string } | null }> | undefined;
      relationship.sourceCard = {
        id: sourceCard.id as string,
        title: sourceAttrs.title as string,
        listId: sourceRels?.field_list?.data?.id,
      };
    }

    if (targetCard) {
      const targetAttrs = targetCard.attributes as Record<string, unknown>;
      const targetRels = targetCard.relationships as Record<string, { data: { id: string } | null }> | undefined;
      relationship.targetCard = {
        id: targetCard.id as string,
        title: targetAttrs.title as string,
        listId: targetRels?.field_list?.data?.id,
      };
    }
  }

  return relationship;
}

// Fetch all relationships for a card (where card is source or target)
export async function fetchRelationshipsByCard(cardId: string): Promise<CardRelationship[]> {
  // Fetch relationships where this card is the source
  const sourceResponse = await fetch(
    `${API_URL}/jsonapi/node/card_relationship?filter[field_source_card.id]=${cardId}&include=field_source_card,field_target_card`,
    {
      headers: {
        'Accept': 'application/vnd.api+json',
        'Authorization': `Bearer ${getAccessToken()}`,
      },
    }
  );

  // Fetch relationships where this card is the target
  const targetResponse = await fetch(
    `${API_URL}/jsonapi/node/card_relationship?filter[field_target_card.id]=${cardId}&include=field_source_card,field_target_card`,
    {
      headers: {
        'Accept': 'application/vnd.api+json',
        'Authorization': `Bearer ${getAccessToken()}`,
      },
    }
  );

  const relationships: CardRelationship[] = [];

  if (sourceResponse.ok) {
    const sourceResult = await sourceResponse.json();
    const sourceData = sourceResult.data;
    const included = sourceResult.included || [];
    if (Array.isArray(sourceData)) {
      relationships.push(...sourceData.map((item: Record<string, unknown>) =>
        transformRelationship(item, included)
      ));
    }
  }

  if (targetResponse.ok) {
    const targetResult = await targetResponse.json();
    const targetData = targetResult.data;
    const included = targetResult.included || [];
    if (Array.isArray(targetData)) {
      // For target relationships, we need to "flip" them to show from the card's perspective
      const targetRelationships = targetData.map((item: Record<string, unknown>) => {
        const rel = transformRelationship(item, included);
        // Swap source and target, and inverse the type
        return {
          ...rel,
          sourceCardId: rel.targetCardId,
          targetCardId: rel.sourceCardId,
          sourceCard: rel.targetCard,
          targetCard: rel.sourceCard,
          type: getInverseRelationshipType(rel.type),
        };
      });
      relationships.push(...targetRelationships);
    }
  }

  // Remove duplicates (in case both directions were stored)
  const uniqueRelationships = relationships.filter((rel, index, self) =>
    index === self.findIndex((r) => r.id === rel.id)
  );

  return uniqueRelationships;
}

// Create a new relationship
export async function createRelationship(
  sourceCardId: string,
  targetCardId: string,
  type: RelationshipType
): Promise<CardRelationship> {
  const response = await fetchWithCsrf(`${API_URL}/jsonapi/node/card_relationship`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: {
        type: 'node--card_relationship',
        attributes: {
          title: `Relationship`,
          field_relationship_type: type,
        },
        relationships: {
          field_source_card: {
            data: { type: 'node--card', id: sourceCardId },
          },
          field_target_card: {
            data: { type: 'node--card', id: targetCardId },
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.errors?.[0]?.detail || 'Failed to create relationship');
  }

  const result = await response.json();
  return transformRelationship(result.data);
}

// Delete a relationship
export async function deleteRelationship(id: string): Promise<void> {
  const response = await fetchWithCsrf(`${API_URL}/jsonapi/node/card_relationship/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok && response.status !== 204) {
    throw new Error('Failed to delete relationship');
  }
}

// Check if a card is blocked (has any "blocked_by" relationships from incomplete cards)
export async function isCardBlocked(cardId: string): Promise<boolean> {
  const relationships = await fetchRelationshipsByCard(cardId);
  return relationships.some((rel) => rel.type === 'blocked_by');
}

// Get all cards that block this card
export async function getBlockingCards(cardId: string): Promise<CardRelationship[]> {
  const relationships = await fetchRelationshipsByCard(cardId);
  return relationships.filter((rel) => rel.type === 'blocked_by');
}

// Get all cards that this card blocks
export async function getBlockedCards(cardId: string): Promise<CardRelationship[]> {
  const relationships = await fetchRelationshipsByCard(cardId);
  return relationships.filter((rel) => rel.type === 'blocks');
}

// Search for cards to link (for the UI picker)
export async function searchCardsForLinking(
  query: string,
  excludeCardId: string,
  boardId?: string
): Promise<Array<{ id: string; title: string; listName?: string }>> {
  let filterParams = `filter[title][operator]=CONTAINS&filter[title][value]=${encodeURIComponent(query)}`;

  // Exclude the current card
  filterParams += `&filter[exclude][condition][path]=id&filter[exclude][condition][operator]=<>&filter[exclude][condition][value]=${excludeCardId}`;

  // Optionally filter by board
  if (boardId) {
    filterParams += `&filter[field_card_list.field_list_board.id]=${boardId}`;
  }

  const response = await fetch(
    `${API_URL}/jsonapi/node/card?${filterParams}&include=field_card_list&page[limit]=20&sort=-created`,
    {
      headers: {
        'Accept': 'application/vnd.api+json',
        'Authorization': `Bearer ${getAccessToken()}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to search cards');
  }

  const result = await response.json();
  const cards = result.data || [];
  const included = result.included || [];

  return cards.map((card: Record<string, unknown>) => {
    const attrs = card.attributes as Record<string, unknown>;
    const rels = card.relationships as Record<string, { data: { id: string } | null }> | undefined;
    const listId = rels?.field_list?.data?.id;

    // Find list name from included
    const list = included.find(
      (item: Record<string, unknown>) => item.id === listId && item.type === 'node--list'
    );
    const listAttrs = list?.attributes as Record<string, unknown> | undefined;

    return {
      id: card.id as string,
      title: attrs.title as string,
      listName: listAttrs?.title as string | undefined,
    };
  });
}
