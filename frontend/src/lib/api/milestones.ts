import { fetchWithCsrf } from './client';

const API_URL = import.meta.env.VITE_API_URL || 'https://boxtasks2.ddev.site';

export type MilestoneStatus = 'not_started' | 'in_progress' | 'completed' | 'missed';

export interface Milestone {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;
  status: MilestoneStatus;
  color: string;
  workspaceId: string;
  workspaceName?: string;
  goalId?: string;
  goalName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMilestoneData {
  title: string;
  description?: string;
  dueDate?: string;
  status?: MilestoneStatus;
  color?: string;
  workspaceId: string;
  goalId?: string;
}

export interface UpdateMilestoneData {
  title?: string;
  description?: string;
  dueDate?: string;
  status?: MilestoneStatus;
  color?: string;
  goalId?: string;
}

// Status display info
export const MILESTONE_STATUS_INFO: Record<MilestoneStatus, { label: string; color: string; bgColor: string; darkBgColor: string }> = {
  not_started: { label: 'Not Started', color: 'text-gray-600 dark:text-gray-400', bgColor: 'bg-gray-100', darkBgColor: 'dark:bg-gray-700' },
  in_progress: { label: 'In Progress', color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-100', darkBgColor: 'dark:bg-blue-900/30' },
  completed: { label: 'Completed', color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-100', darkBgColor: 'dark:bg-green-900/30' },
  missed: { label: 'Missed', color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-100', darkBgColor: 'dark:bg-red-900/30' },
};

// Default milestone colors
export const MILESTONE_COLORS = [
  '#519839', // Green (default)
  '#0079BF', // Blue
  '#D29034', // Orange
  '#B04632', // Red
  '#89609E', // Purple
  '#CD5A91', // Pink
  '#00AECC', // Teal
  '#838C91', // Gray
];

/**
 * Fetch all milestones for a workspace
 */
export async function fetchMilestones(workspaceId: string): Promise<Milestone[]> {
  const response = await fetchWithCsrf(
    `${API_URL}/jsonapi/node/milestone?filter[field_milestone_workspace.id]=${workspaceId}&include=field_milestone_workspace,field_milestone_goal&sort=-created`,
    {
      headers: {
        'Accept': 'application/vnd.api+json',
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch milestones');
  }

  const data = await response.json();
  const included = data.included || [];

  return (data.data || []).map((item: any) => mapMilestoneFromApi(item, included));
}

/**
 * Fetch milestones for a specific goal
 */
export async function fetchMilestonesByGoal(goalId: string): Promise<Milestone[]> {
  const response = await fetchWithCsrf(
    `${API_URL}/jsonapi/node/milestone?filter[field_milestone_goal.id]=${goalId}&include=field_milestone_workspace,field_milestone_goal&sort=field_milestone_due_date`,
    {
      headers: {
        'Accept': 'application/vnd.api+json',
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch milestones');
  }

  const data = await response.json();
  const included = data.included || [];

  return (data.data || []).map((item: any) => mapMilestoneFromApi(item, included));
}

/**
 * Fetch a single milestone by ID
 */
export async function fetchMilestone(milestoneId: string): Promise<Milestone> {
  const response = await fetchWithCsrf(
    `${API_URL}/jsonapi/node/milestone/${milestoneId}?include=field_milestone_workspace,field_milestone_goal`,
    {
      headers: {
        'Accept': 'application/vnd.api+json',
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch milestone');
  }

  const data = await response.json();
  return mapMilestoneFromApi(data.data, data.included || []);
}

/**
 * Create a new milestone
 */
export async function createMilestone(milestoneData: CreateMilestoneData): Promise<Milestone> {
  const relationships: Record<string, unknown> = {
    field_milestone_workspace: {
      data: { type: 'node--workspace', id: milestoneData.workspaceId },
    },
  };

  if (milestoneData.goalId) {
    relationships.field_milestone_goal = {
      data: { type: 'node--goal', id: milestoneData.goalId },
    };
  }

  const response = await fetchWithCsrf(`${API_URL}/jsonapi/node/milestone`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: {
        type: 'node--milestone',
        attributes: {
          title: milestoneData.title,
          field_milestone_description: milestoneData.description ? { value: milestoneData.description } : null,
          field_milestone_due_date: milestoneData.dueDate || null,
          field_milestone_status: milestoneData.status || 'not_started',
          field_milestone_color: milestoneData.color || '#519839',
        },
        relationships,
      },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.errors?.[0]?.detail || 'Failed to create milestone');
  }

  const data = await response.json();
  return mapMilestoneFromApi(data.data, data.included || []);
}

/**
 * Update an existing milestone
 */
export async function updateMilestone(milestoneId: string, updates: UpdateMilestoneData): Promise<Milestone> {
  const attributes: Record<string, unknown> = {};
  const relationships: Record<string, unknown> = {};

  if (updates.title !== undefined) {
    attributes.title = updates.title;
  }
  if (updates.description !== undefined) {
    attributes.field_milestone_description = updates.description ? { value: updates.description } : null;
  }
  if (updates.dueDate !== undefined) {
    attributes.field_milestone_due_date = updates.dueDate || null;
  }
  if (updates.status !== undefined) {
    attributes.field_milestone_status = updates.status;
  }
  if (updates.color !== undefined) {
    attributes.field_milestone_color = updates.color;
  }
  if (updates.goalId !== undefined) {
    relationships.field_milestone_goal = updates.goalId
      ? { data: { type: 'node--goal', id: updates.goalId } }
      : { data: null };
  }

  const body: Record<string, unknown> = {
    data: {
      type: 'node--milestone',
      id: milestoneId,
      attributes,
    },
  };

  if (Object.keys(relationships).length > 0) {
    (body.data as any).relationships = relationships;
  }

  const response = await fetchWithCsrf(`${API_URL}/jsonapi/node/milestone/${milestoneId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.errors?.[0]?.detail || 'Failed to update milestone');
  }

  const data = await response.json();
  return mapMilestoneFromApi(data.data, data.included || []);
}

/**
 * Delete a milestone
 */
export async function deleteMilestone(milestoneId: string): Promise<void> {
  const response = await fetchWithCsrf(`${API_URL}/jsonapi/node/milestone/${milestoneId}`, {
    method: 'DELETE',
    headers: {
      'Accept': 'application/vnd.api+json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to delete milestone');
  }
}

/**
 * Check if milestone is overdue
 */
export function isMilestoneOverdue(milestone: Milestone): boolean {
  if (!milestone.dueDate || milestone.status === 'completed') return false;
  return new Date(milestone.dueDate) < new Date();
}

/**
 * Check if milestone is due soon (within 7 days)
 */
export function isMilestoneDueSoon(milestone: Milestone): boolean {
  if (!milestone.dueDate || milestone.status === 'completed') return false;
  const dueDate = new Date(milestone.dueDate);
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  return dueDate >= now && dueDate <= sevenDaysFromNow;
}

/**
 * Map API response to Milestone interface
 */
function mapMilestoneFromApi(item: any, included: any[]): Milestone {
  const workspaceRef = item.relationships?.field_milestone_workspace?.data;
  const goalRef = item.relationships?.field_milestone_goal?.data;

  // Find workspace from included
  const workspace = workspaceRef
    ? included.find((inc: any) => inc.type === 'node--workspace' && inc.id === workspaceRef.id)
    : null;

  // Find goal from included
  const goal = goalRef
    ? included.find((inc: any) => inc.type === 'node--goal' && inc.id === goalRef.id)
    : null;

  return {
    id: item.id,
    title: item.attributes.title,
    description: item.attributes.field_milestone_description?.value || '',
    dueDate: item.attributes.field_milestone_due_date || undefined,
    status: item.attributes.field_milestone_status || 'not_started',
    color: item.attributes.field_milestone_color || '#519839',
    workspaceId: workspaceRef?.id || '',
    workspaceName: workspace?.attributes?.title || '',
    goalId: goalRef?.id || undefined,
    goalName: goal?.attributes?.title || undefined,
    createdAt: item.attributes.created,
    updatedAt: item.attributes.changed,
  };
}
