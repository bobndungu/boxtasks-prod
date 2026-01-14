import { fetchWithCsrf } from './client';

const API_URL = import.meta.env.VITE_API_URL || 'https://boxtasks2.ddev.site';

export type GoalStatus = 'not_started' | 'in_progress' | 'at_risk' | 'completed' | 'cancelled';

export interface Goal {
  id: string;
  title: string;
  description?: string;
  targetDate?: string;
  status: GoalStatus;
  progress: number;
  color: string;
  workspaceId: string;
  workspaceName?: string;
  linkedCardIds: string[];
  linkedCards?: Array<{
    id: string;
    title: string;
    completed: boolean;
    listName?: string;
    boardName?: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGoalData {
  title: string;
  description?: string;
  targetDate?: string;
  status?: GoalStatus;
  progress?: number;
  color?: string;
  workspaceId: string;
  linkedCardIds?: string[];
}

export interface UpdateGoalData {
  title?: string;
  description?: string;
  targetDate?: string;
  status?: GoalStatus;
  progress?: number;
  color?: string;
  linkedCardIds?: string[];
}

// Status display info
export const GOAL_STATUS_INFO: Record<GoalStatus, { label: string; color: string; bgColor: string }> = {
  not_started: { label: 'Not Started', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  in_progress: { label: 'In Progress', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  at_risk: { label: 'At Risk', color: 'text-orange-600', bgColor: 'bg-orange-100' },
  completed: { label: 'Completed', color: 'text-green-600', bgColor: 'bg-green-100' },
  cancelled: { label: 'Cancelled', color: 'text-red-600', bgColor: 'bg-red-100' },
};

// Default goal colors
export const GOAL_COLORS = [
  '#0079BF', // Blue
  '#D29034', // Orange
  '#519839', // Green
  '#B04632', // Red
  '#89609E', // Purple
  '#CD5A91', // Pink
  '#00AECC', // Teal
  '#838C91', // Gray
];

/**
 * Fetch all goals for a workspace
 */
export async function fetchGoals(workspaceId: string): Promise<Goal[]> {
  const response = await fetchWithCsrf(
    `${API_URL}/jsonapi/node/goal?filter[field_goal_workspace.id]=${workspaceId}&include=field_goal_workspace,field_goal_cards&sort=-created`,
    {
      headers: {
        'Accept': 'application/vnd.api+json',
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch goals');
  }

  const data = await response.json();
  const included = data.included || [];

  return (data.data || []).map((item: any) => mapGoalFromApi(item, included));
}

/**
 * Fetch a single goal by ID
 */
export async function fetchGoal(goalId: string): Promise<Goal> {
  const response = await fetchWithCsrf(
    `${API_URL}/jsonapi/node/goal/${goalId}?include=field_goal_workspace,field_goal_cards`,
    {
      headers: {
        'Accept': 'application/vnd.api+json',
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch goal');
  }

  const data = await response.json();
  return mapGoalFromApi(data.data, data.included || []);
}

/**
 * Create a new goal
 */
export async function createGoal(goalData: CreateGoalData): Promise<Goal> {
  const relationships: Record<string, unknown> = {
    field_goal_workspace: {
      data: { type: 'node--workspace', id: goalData.workspaceId },
    },
  };

  if (goalData.linkedCardIds && goalData.linkedCardIds.length > 0) {
    relationships.field_goal_cards = {
      data: goalData.linkedCardIds.map(id => ({ type: 'node--card', id })),
    };
  }

  const response = await fetchWithCsrf(`${API_URL}/jsonapi/node/goal`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: {
        type: 'node--goal',
        attributes: {
          title: goalData.title,
          field_goal_description: goalData.description ? { value: goalData.description } : null,
          field_goal_target_date: goalData.targetDate || null,
          field_goal_status: goalData.status || 'not_started',
          field_goal_progress: goalData.progress || 0,
          field_goal_color: goalData.color || '#0079BF',
        },
        relationships,
      },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.errors?.[0]?.detail || 'Failed to create goal');
  }

  const data = await response.json();
  return mapGoalFromApi(data.data, data.included || []);
}

/**
 * Update an existing goal
 */
export async function updateGoal(goalId: string, updates: UpdateGoalData): Promise<Goal> {
  const attributes: Record<string, unknown> = {};
  const relationships: Record<string, unknown> = {};

  if (updates.title !== undefined) {
    attributes.title = updates.title;
  }
  if (updates.description !== undefined) {
    attributes.field_goal_description = updates.description ? { value: updates.description } : null;
  }
  if (updates.targetDate !== undefined) {
    attributes.field_goal_target_date = updates.targetDate || null;
  }
  if (updates.status !== undefined) {
    attributes.field_goal_status = updates.status;
  }
  if (updates.progress !== undefined) {
    attributes.field_goal_progress = updates.progress;
  }
  if (updates.color !== undefined) {
    attributes.field_goal_color = updates.color;
  }
  if (updates.linkedCardIds !== undefined) {
    relationships.field_goal_cards = {
      data: updates.linkedCardIds.map(id => ({ type: 'node--card', id })),
    };
  }

  const body: Record<string, unknown> = {
    data: {
      type: 'node--goal',
      id: goalId,
      attributes,
    },
  };

  if (Object.keys(relationships).length > 0) {
    (body.data as any).relationships = relationships;
  }

  const response = await fetchWithCsrf(`${API_URL}/jsonapi/node/goal/${goalId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.errors?.[0]?.detail || 'Failed to update goal');
  }

  const data = await response.json();
  return mapGoalFromApi(data.data, data.included || []);
}

/**
 * Delete a goal
 */
export async function deleteGoal(goalId: string): Promise<void> {
  const response = await fetchWithCsrf(`${API_URL}/jsonapi/node/goal/${goalId}`, {
    method: 'DELETE',
    headers: {
      'Accept': 'application/vnd.api+json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to delete goal');
  }
}

/**
 * Link cards to a goal
 */
export async function linkCardsToGoal(goalId: string, cardIds: string[]): Promise<Goal> {
  return updateGoal(goalId, { linkedCardIds: cardIds });
}

/**
 * Calculate goal progress based on linked cards completion
 */
export function calculateProgressFromCards(linkedCards: Goal['linkedCards']): number {
  if (!linkedCards || linkedCards.length === 0) return 0;
  const completedCount = linkedCards.filter(c => c.completed).length;
  return Math.round((completedCount / linkedCards.length) * 100);
}

/**
 * Map API response to Goal interface
 */
function mapGoalFromApi(item: any, included: any[]): Goal {
  const workspaceRef = item.relationships?.field_goal_workspace?.data;
  const cardsRef = item.relationships?.field_goal_cards?.data || [];

  // Find workspace from included
  const workspace = workspaceRef
    ? included.find((inc: any) => inc.type === 'node--workspace' && inc.id === workspaceRef.id)
    : null;

  // Find cards from included
  const linkedCards = cardsRef
    .map((ref: any) => {
      const card = included.find((inc: any) => inc.type === 'node--card' && inc.id === ref.id);
      if (!card) return null;
      return {
        id: card.id,
        title: card.attributes.title,
        // Production doesn't have field_card_completed
        completed: (card.attributes as any).field_card_completed || false,
      };
    })
    .filter(Boolean);

  return {
    id: item.id,
    title: item.attributes.title,
    description: item.attributes.field_goal_description?.value || '',
    targetDate: item.attributes.field_goal_target_date || undefined,
    status: item.attributes.field_goal_status || 'not_started',
    progress: item.attributes.field_goal_progress || 0,
    color: item.attributes.field_goal_color || '#0079BF',
    workspaceId: workspaceRef?.id || '',
    workspaceName: workspace?.attributes?.title || '',
    linkedCardIds: cardsRef.map((ref: any) => ref.id),
    linkedCards,
    createdAt: item.attributes.created,
    updatedAt: item.attributes.changed,
  };
}
