import { getAccessToken } from './client';

const API_URL = import.meta.env.VITE_API_URL || 'https://boxtasks2.ddev.site';

export type ReactionType = '👍' | '👎' | '❤️' | '😄' | '🎉' | '😮';

export interface CommentReaction {
  type: ReactionType;
  userIds: string[];
}

export interface CardComment {
  id: string;
  text: string;
  cardId: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  updatedAt: string;
  reactions: CommentReaction[];
}

export interface CreateCommentData {
  text: string;
  cardId: string;
}

// Transform JSON:API response to CardComment
function transformComment(data: Record<string, unknown>, included?: Record<string, unknown>[]): CardComment {
  const attrs = data.attributes as Record<string, unknown>;
  const rels = data.relationships as Record<string, { data: { id: string; type: string } | null }> | undefined;

  // Get author info from included if available
  let authorName = 'Unknown User';
  const authorId = rels?.uid?.data?.id || '';
  if (included && authorId) {
    const author = included.find((item) => item.id === authorId && item.type === 'user--user');
    if (author) {
      const authorAttrs = author.attributes as Record<string, unknown>;
      authorName = (authorAttrs.display_name as string) || (authorAttrs.name as string) || 'Unknown User';
    }
  }

  // Parse reactions from JSON
  let reactions: CommentReaction[] = [];
  const reactionsJson = attrs.field_comment_reactions as string | null;
  if (reactionsJson) {
    try {
      reactions = JSON.parse(reactionsJson);
    } catch {
      reactions = [];
    }
  }

  return {
    id: data.id as string,
    text: (attrs.field_comment_text as { value?: string })?.value || '',
    cardId: rels?.field_comment_card?.data?.id || '',
    authorId,
    authorName,
    createdAt: attrs.created as string,
    updatedAt: attrs.changed as string,
    reactions,
  };
}

// Fetch all comments for a card
export async function fetchCommentsByCard(cardId: string): Promise<CardComment[]> {
  const response = await fetch(
    `${API_URL}/jsonapi/node/card_comment?filter[field_comment_card.id]=${cardId}&include=uid&sort=-created`,
    {
      headers: {
        'Accept': 'application/vnd.api+json',
        'Authorization': `Bearer ${getAccessToken()}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch comments');
  }

  const result = await response.json();
  const data = result.data;
  const included = result.included;
  if (!Array.isArray(data)) return [];

  return data.map((item: Record<string, unknown>) => transformComment(item, included));
}

// Create a new comment
export async function createComment(data: CreateCommentData): Promise<CardComment> {
  const response = await fetch(`${API_URL}/jsonapi/node/card_comment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
      'Authorization': `Bearer ${getAccessToken()}`,
    },
    body: JSON.stringify({
      data: {
        type: 'node--card_comment',
        attributes: {
          title: `Comment on card`,
          field_comment_text: { value: data.text },
        },
        relationships: {
          field_comment_card: {
            data: { type: 'node--card', id: data.cardId },
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.errors?.[0]?.detail || 'Failed to create comment');
  }

  const result = await response.json();
  return transformComment(result.data, result.included);
}

// Update a comment
export async function updateComment(id: string, text: string): Promise<CardComment> {
  const response = await fetch(`${API_URL}/jsonapi/node/card_comment/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
      'Authorization': `Bearer ${getAccessToken()}`,
    },
    body: JSON.stringify({
      data: {
        type: 'node--card_comment',
        id,
        attributes: {
          field_comment_text: { value: text },
        },
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.errors?.[0]?.detail || 'Failed to update comment');
  }

  const result = await response.json();
  return transformComment(result.data, result.included);
}

// Delete a comment
export async function deleteComment(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/jsonapi/node/card_comment/${id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${getAccessToken()}`,
    },
  });

  if (!response.ok && response.status !== 204) {
    throw new Error('Failed to delete comment');
  }
}

// Toggle a reaction on a comment
export async function toggleReaction(commentId: string, reactionType: ReactionType, userId: string, currentReactions: CommentReaction[]): Promise<CommentReaction[]> {
  // Clone current reactions
  const reactions = currentReactions.map(r => ({ ...r, userIds: [...r.userIds] }));

  // Find existing reaction of this type
  const existingReaction = reactions.find(r => r.type === reactionType);

  if (existingReaction) {
    const userIndex = existingReaction.userIds.indexOf(userId);
    if (userIndex >= 0) {
      // User already reacted, remove their reaction
      existingReaction.userIds.splice(userIndex, 1);
      // Remove reaction type if no users left
      if (existingReaction.userIds.length === 0) {
        const reactionIndex = reactions.indexOf(existingReaction);
        reactions.splice(reactionIndex, 1);
      }
    } else {
      // User hasn't reacted, add their reaction
      existingReaction.userIds.push(userId);
    }
  } else {
    // New reaction type
    reactions.push({ type: reactionType, userIds: [userId] });
  }

  // Save to backend
  const response = await fetch(`${API_URL}/jsonapi/node/card_comment/${commentId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
      'Authorization': `Bearer ${getAccessToken()}`,
    },
    body: JSON.stringify({
      data: {
        type: 'node--card_comment',
        id: commentId,
        attributes: {
          field_comment_reactions: JSON.stringify(reactions),
        },
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.errors?.[0]?.detail || 'Failed to toggle reaction');
  }

  return reactions;
}
