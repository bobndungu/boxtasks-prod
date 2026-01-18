import { getAccessToken } from './client';
import type { Card, CardMember } from './cards';
import type { Activity, ActivityType } from './activities';

const API_URL = import.meta.env.VITE_API_URL || 'https://boxtasks2.ddev.site';

// Date range filter options
export type DateRangePreset = '7days' | '30days' | '90days' | 'custom';

export interface DateRange {
  start: Date;
  end: Date;
}

export interface ReportFilters {
  workspaceId: string;
  boardIds?: string[];
  memberIds?: string[];
  dateRange: DateRange;
  includeArchived?: boolean;
}

// User Performance Stats
export interface UserPerformanceStats {
  userId: string;
  userName: string;
  userEmail?: string;
  cardsCompleted: number;
  cardsAssigned: number;
  cardsCreated: number;
  completionRate: number; // 0-100
  avgCompletionTimeHours: number | null; // null if no completed cards
  overdueCards: number;
  approvedCards: number;
  rejectedCards: number;
  onTimeCompletions: number;
  lateCompletions: number;
}

export interface PerformanceSummary {
  totalCardsCompleted: number;
  totalCardsCreated: number;
  avgCompletionTimeHours: number | null;
  topPerformers: UserPerformanceStats[];
  needsAttention: UserPerformanceStats[];
}

export interface PerformanceReport {
  users: UserPerformanceStats[];
  summary: PerformanceSummary;
  dateRange: DateRange;
}

// Task Duration Stats
export interface DurationBucket {
  label: string;
  minHours: number;
  maxHours: number | null;
  count: number;
  percentage: number;
}

export interface OverdueAnalysis {
  totalOverdue: number;
  overdueByDays: { days: string; count: number }[];
  overdueByUser: { userId: string; userName: string; count: number }[];
}

export interface TaskDurationReport {
  avgCreationToCompletionHours: number | null;
  avgApprovalToCompletionHours: number | null;
  medianCompletionTimeHours: number | null;
  cardsByDuration: DurationBucket[];
  overdueAnalysis: OverdueAnalysis;
  dateRange: DateRange;
}

// Workload Stats
export interface UserWorkloadStats {
  userId: string;
  userName: string;
  userEmail?: string;
  openCards: number;
  completedCards: number;
  overdueCards: number;
  rejectedCards: number;
  cardsCreatedThisPeriod: number;
  workloadScore: number; // Normalized 0-100 based on relative workload
}

export interface WorkloadDistribution {
  totalOpenCards: number;
  avgCardsPerUser: number;
  balanceIndex: number; // 0-100, higher is more balanced
  mostOverloaded: UserWorkloadStats[];
  leastLoaded: UserWorkloadStats[];
}

export interface WorkloadReport {
  users: UserWorkloadStats[];
  distribution: WorkloadDistribution;
  dateRange: DateRange;
}

// Trends Stats
export interface TrendDataPoint {
  date: string;
  value: number;
}

export interface TrendsReport {
  cardsCompletedOverTime: TrendDataPoint[];
  cardsCreatedOverTime: TrendDataPoint[];
  completionVelocity: TrendDataPoint[]; // Rolling average
  overdueOverTime: TrendDataPoint[];
  dateRange: DateRange;
  granularity: 'daily' | 'weekly' | 'monthly';
}

// Activity Report
export interface ActivitySummary {
  totalActivities: number;
  activitiesByType: { type: ActivityType; count: number; label: string }[];
  activitiesByUser: { userId: string; userName: string; count: number }[];
  mostActiveCards: { cardId: string; cardTitle: string; activityCount: number }[];
}

export interface ActivityReport {
  summary: ActivitySummary;
  recentActivities: Activity[];
  dateRange: DateRange;
}

// Helper: Fetch all cards for a workspace within date range
async function fetchCardsForReports(filters: ReportFilters): Promise<Card[]> {
  // Build filter parameters
  let filterParams = '';

  // Workspace filter - get all boards in workspace first
  const boardsResponse = await fetch(
    `${API_URL}/jsonapi/node/board?filter[field_board_workspace.id]=${filters.workspaceId}`,
    {
      headers: {
        'Accept': 'application/vnd.api+json',
        'Authorization': `Bearer ${getAccessToken()}`,
      },
    }
  );

  if (!boardsResponse.ok) {
    throw new Error('Failed to fetch boards');
  }

  const boardsResult = await boardsResponse.json();
  let boardIds: string[] = filters.boardIds || [];

  if (boardIds.length === 0) {
    // Get all boards in workspace
    boardIds = (boardsResult.data || []).map((b: { id: string }) => b.id);
  }

  if (boardIds.length === 0) {
    return [];
  }

  // Get lists for these boards
  let listFilterParams = 'filter[or-group][group][conjunction]=OR';
  boardIds.forEach((id, index) => {
    listFilterParams += `&filter[board-${index}][condition][path]=field_list_board.id`;
    listFilterParams += `&filter[board-${index}][condition][value]=${id}`;
    listFilterParams += `&filter[board-${index}][condition][memberOf]=or-group`;
  });

  const listsResponse = await fetch(
    `${API_URL}/jsonapi/node/board_list?${listFilterParams}`,
    {
      headers: {
        'Accept': 'application/vnd.api+json',
        'Authorization': `Bearer ${getAccessToken()}`,
      },
    }
  );

  if (!listsResponse.ok) {
    throw new Error('Failed to fetch lists');
  }

  const listsResult = await listsResponse.json();
  const listIds: string[] = (listsResult.data || []).map((l: { id: string }) => l.id);

  if (listIds.length === 0) {
    return [];
  }

  // Now fetch cards from these lists
  filterParams = 'filter[or-group][group][conjunction]=OR';
  listIds.forEach((id, index) => {
    filterParams += `&filter[list-${index}][condition][path]=field_card_list.id`;
    filterParams += `&filter[list-${index}][condition][value]=${id}`;
    filterParams += `&filter[list-${index}][condition][memberOf]=or-group`;
  });

  // Date range filter for created date
  const startDateStr = filters.dateRange.start.toISOString().split('T')[0];
  const endDateStr = filters.dateRange.end.toISOString().split('T')[0];
  filterParams += `&filter[date-start][condition][path]=created`;
  filterParams += `&filter[date-start][condition][operator]=%3E%3D`;
  filterParams += `&filter[date-start][condition][value]=${startDateStr}`;
  filterParams += `&filter[date-end][condition][path]=created`;
  filterParams += `&filter[date-end][condition][operator]=%3C%3D`;
  filterParams += `&filter[date-end][condition][value]=${endDateStr}T23:59:59`;

  // Archive filter
  if (!filters.includeArchived) {
    filterParams += '&filter[field_card_archived][value]=0';
  }

  const cardsResponse = await fetch(
    `${API_URL}/jsonapi/node/card?${filterParams}&include=field_card_members,uid,field_card_approved_by,field_card_rejected_by&page[limit]=500`,
    {
      headers: {
        'Accept': 'application/vnd.api+json',
        'Authorization': `Bearer ${getAccessToken()}`,
      },
    }
  );

  if (!cardsResponse.ok) {
    throw new Error('Failed to fetch cards');
  }

  const cardsResult = await cardsResponse.json();
  const cards: Card[] = [];
  const included = cardsResult.included || [];

  // Build user lookup map
  const usersById = new Map<string, { name: string; email?: string }>();
  for (const item of included) {
    if (item.type === 'user--user') {
      const attrs = item.attributes as Record<string, unknown>;
      usersById.set(item.id as string, {
        name: (attrs.field_display_name as string) || (attrs.name as string) || 'Unknown',
        email: attrs.mail as string | undefined,
      });
    }
  }

  for (const item of cardsResult.data || []) {
    const attrs = item.attributes as Record<string, unknown>;
    const rels = item.relationships as Record<string, { data: unknown }> | undefined;

    // Get member IDs and data
    const membersData = rels?.field_card_members?.data;
    const memberIds: string[] = Array.isArray(membersData)
      ? membersData.map((m: { id: string }) => m.id)
      : [];

    const members: CardMember[] = memberIds.map((id) => {
      const user = usersById.get(id);
      return {
        id,
        name: user?.name || 'Unknown',
        email: user?.email,
      };
    });

    // Get author
    const authorData = rels?.uid?.data as { id: string } | null;
    const authorId = authorData?.id;

    // Get approval data
    const approvedByData = rels?.field_card_approved_by?.data as { id: string } | null;
    const approvedById = approvedByData?.id;
    let approvedBy: CardMember | undefined;
    if (approvedById) {
      const user = usersById.get(approvedById);
      approvedBy = {
        id: approvedById,
        name: user?.name || 'Unknown',
        email: user?.email,
      };
    }

    // Get rejection data
    const rejectedByData = rels?.field_card_rejected_by?.data as { id: string } | null;
    const rejectedById = rejectedByData?.id;
    let rejectedBy: CardMember | undefined;
    if (rejectedById) {
      const user = usersById.get(rejectedById);
      rejectedBy = {
        id: rejectedById,
        name: user?.name || 'Unknown',
        email: user?.email,
      };
    }

    const card: Card = {
      id: item.id as string,
      title: attrs.title as string,
      description: (attrs.field_card_description as { value?: string })?.value || '',
      listId: (rels?.field_card_list?.data as { id: string })?.id || '',
      position: (attrs.field_card_position as number) || 0,
      startDate: attrs.field_card_start_date as string | undefined,
      dueDate: attrs.field_card_due_date as string | undefined,
      labels: (attrs.field_card_labels as Card['labels']) || [],
      archived: (attrs.field_card_archived as boolean) || false,
      completed: (attrs.field_card_completed as boolean) || false,
      pinned: (attrs.field_pinned as boolean) || false,
      watcherIds: [],
      watchers: [],
      memberIds,
      members,
      createdAt: attrs.created as string,
      updatedAt: attrs.changed as string,
      authorId,
      commentCount: 0,
      attachmentCount: 0,
      checklistCompleted: 0,
      checklistTotal: 0,
      isApproved: (attrs.field_card_approved as boolean) || false,
      approvedBy,
      approvedAt: attrs.field_card_approved_at as string | undefined,
      isRejected: (attrs.field_card_rejected as boolean) || false,
      rejectedBy,
      rejectedAt: attrs.field_card_rejected_at as string | undefined,
      googleDocs: [],
    };

    // Filter by member if specified
    if (filters.memberIds && filters.memberIds.length > 0) {
      if (!card.memberIds.some(id => filters.memberIds!.includes(id)) &&
          !filters.memberIds.includes(card.authorId || '')) {
        continue;
      }
    }

    cards.push(card);
  }

  return cards;
}

// Helper: Fetch activities for reports
async function fetchActivitiesForReports(filters: ReportFilters): Promise<Activity[]> {
  // Get board IDs
  let boardIds: string[] = filters.boardIds || [];

  if (boardIds.length === 0) {
    const boardsResponse = await fetch(
      `${API_URL}/jsonapi/node/board?filter[field_board_workspace.id]=${filters.workspaceId}`,
      {
        headers: {
          'Accept': 'application/vnd.api+json',
          'Authorization': `Bearer ${getAccessToken()}`,
        },
      }
    );

    if (!boardsResponse.ok) {
      return [];
    }

    const boardsResult = await boardsResponse.json();
    boardIds = (boardsResult.data || []).map((b: { id: string }) => b.id);
  }

  if (boardIds.length === 0) {
    return [];
  }

  // Build filter for multiple boards
  let filterParams = 'filter[or-group][group][conjunction]=OR';
  boardIds.forEach((id, index) => {
    filterParams += `&filter[board-${index}][condition][path]=field_activity_board.id`;
    filterParams += `&filter[board-${index}][condition][value]=${id}`;
    filterParams += `&filter[board-${index}][condition][memberOf]=or-group`;
  });

  // Date range filter
  const startDateStr = filters.dateRange.start.toISOString().split('T')[0];
  const endDateStr = filters.dateRange.end.toISOString().split('T')[0];
  filterParams += `&filter[date-start][condition][path]=created`;
  filterParams += `&filter[date-start][condition][operator]=%3E%3D`;
  filterParams += `&filter[date-start][condition][value]=${startDateStr}`;
  filterParams += `&filter[date-end][condition][path]=created`;
  filterParams += `&filter[date-end][condition][operator]=%3C%3D`;
  filterParams += `&filter[date-end][condition][value]=${endDateStr}T23:59:59`;

  const response = await fetch(
    `${API_URL}/jsonapi/node/activity?${filterParams}&include=uid&sort=-created&page[limit]=500`,
    {
      headers: {
        'Accept': 'application/vnd.api+json',
        'Authorization': `Bearer ${getAccessToken()}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch activities');
  }

  const result = await response.json();
  const activities: Activity[] = [];
  const included = result.included || [];

  // Build user lookup map
  const usersById = new Map<string, string>();
  for (const item of included) {
    if (item.type === 'user--user') {
      const attrs = item.attributes as Record<string, unknown>;
      usersById.set(
        item.id as string,
        (attrs.field_display_name as string) || (attrs.name as string) || 'Unknown'
      );
    }
  }

  for (const item of result.data || []) {
    const attrs = item.attributes as Record<string, unknown>;
    const rels = item.relationships as Record<string, { data: { id: string } | null }> | undefined;

    const authorId = rels?.uid?.data?.id || '';

    activities.push({
      id: item.id as string,
      type: (attrs.field_activity_type as ActivityType) || 'card_updated',
      description: (attrs.field_activity_description as { value?: string })?.value || '',
      cardId: rels?.field_activity_card?.data?.id || null,
      boardId: rels?.field_activity_board?.data?.id || null,
      authorId,
      authorName: usersById.get(authorId) || 'Unknown',
      createdAt: attrs.created as string,
      data: null,
    });
  }

  return activities;
}

// Helper: Get all unique users from cards
function getUsersFromCards(cards: Card[]): Map<string, { name: string; email?: string }> {
  const users = new Map<string, { name: string; email?: string }>();

  for (const card of cards) {
    // Add author
    if (card.authorId) {
      // We don't have author name directly, use member data if available
      if (!users.has(card.authorId)) {
        users.set(card.authorId, { name: 'Unknown' });
      }
    }

    // Add members
    for (const member of card.members) {
      users.set(member.id, { name: member.name, email: member.email });
    }

    // Add approver/rejecter
    if (card.approvedBy) {
      users.set(card.approvedBy.id, { name: card.approvedBy.name, email: card.approvedBy.email });
    }
    if (card.rejectedBy) {
      users.set(card.rejectedBy.id, { name: card.rejectedBy.name, email: card.rejectedBy.email });
    }
  }

  return users;
}

// Helper: Calculate hours between two dates
function hoursBetween(start: string | Date, end: string | Date): number {
  const startDate = start instanceof Date ? start : new Date(start);
  const endDate = end instanceof Date ? end : new Date(end);
  return (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
}

// Generate Performance Report
export async function generatePerformanceReport(filters: ReportFilters): Promise<PerformanceReport> {
  const cards = await fetchCardsForReports(filters);
  const users = getUsersFromCards(cards);

  const userStats = new Map<string, UserPerformanceStats>();

  // Initialize stats for all users
  for (const [userId, userData] of users) {
    userStats.set(userId, {
      userId,
      userName: userData.name,
      userEmail: userData.email,
      cardsCompleted: 0,
      cardsAssigned: 0,
      cardsCreated: 0,
      completionRate: 0,
      avgCompletionTimeHours: null,
      overdueCards: 0,
      approvedCards: 0,
      rejectedCards: 0,
      onTimeCompletions: 0,
      lateCompletions: 0,
    });
  }

  const completionTimes: Map<string, number[]> = new Map();
  const now = new Date();

  for (const card of cards) {
    // Track cards created
    if (card.authorId) {
      const stats = userStats.get(card.authorId);
      if (stats) {
        stats.cardsCreated++;
      }
    }

    // Track cards assigned
    for (const memberId of card.memberIds) {
      const stats = userStats.get(memberId);
      if (stats) {
        stats.cardsAssigned++;

        // Track completed cards
        if (card.completed || card.archived) {
          stats.cardsCompleted++;

          // Calculate completion time
          const completionTime = hoursBetween(card.createdAt, card.updatedAt);
          if (!completionTimes.has(memberId)) {
            completionTimes.set(memberId, []);
          }
          completionTimes.get(memberId)!.push(completionTime);

          // Check if completed on time
          if (card.dueDate) {
            const dueDate = new Date(card.dueDate);
            const completedDate = new Date(card.updatedAt);
            if (completedDate <= dueDate) {
              stats.onTimeCompletions++;
            } else {
              stats.lateCompletions++;
            }
          }
        }

        // Track overdue cards (not completed and past due date)
        if (!card.completed && !card.archived && card.dueDate) {
          const dueDate = new Date(card.dueDate);
          if (dueDate < now) {
            stats.overdueCards++;
          }
        }
      }
    }

    // Track approvals/rejections
    if (card.isApproved && card.approvedBy) {
      const stats = userStats.get(card.approvedBy.id);
      if (stats) {
        stats.approvedCards++;
      }
    }
    if (card.isRejected && card.rejectedBy) {
      const stats = userStats.get(card.rejectedBy.id);
      if (stats) {
        stats.rejectedCards++;
      }
    }
  }

  // Calculate averages and rates
  for (const [userId, stats] of userStats) {
    // Completion rate
    if (stats.cardsAssigned > 0) {
      stats.completionRate = Math.round((stats.cardsCompleted / stats.cardsAssigned) * 100);
    }

    // Average completion time
    const times = completionTimes.get(userId);
    if (times && times.length > 0) {
      stats.avgCompletionTimeHours = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
    }
  }

  const allStats = Array.from(userStats.values());

  // Calculate summary
  const totalCompleted = allStats.reduce((sum, s) => sum + s.cardsCompleted, 0);
  const totalCreated = allStats.reduce((sum, s) => sum + s.cardsCreated, 0);

  const allCompletionTimes = Array.from(completionTimes.values()).flat();
  const avgCompletionTime = allCompletionTimes.length > 0
    ? Math.round(allCompletionTimes.reduce((a, b) => a + b, 0) / allCompletionTimes.length)
    : null;

  // Top performers (highest completion rate with at least 5 cards)
  const topPerformers = allStats
    .filter(s => s.cardsAssigned >= 5)
    .sort((a, b) => b.completionRate - a.completionRate)
    .slice(0, 5);

  // Needs attention (high overdue + low completion rate)
  const needsAttention = allStats
    .filter(s => s.overdueCards > 0 || (s.cardsAssigned >= 5 && s.completionRate < 50))
    .sort((a, b) => b.overdueCards - a.overdueCards)
    .slice(0, 5);

  return {
    users: allStats.sort((a, b) => b.cardsCompleted - a.cardsCompleted),
    summary: {
      totalCardsCompleted: totalCompleted,
      totalCardsCreated: totalCreated,
      avgCompletionTimeHours: avgCompletionTime,
      topPerformers,
      needsAttention,
    },
    dateRange: filters.dateRange,
  };
}

// Generate Task Duration Report
export async function generateTaskDurationReport(filters: ReportFilters): Promise<TaskDurationReport> {
  const cards = await fetchCardsForReports(filters);

  const completedCards = cards.filter(c => c.completed || c.archived);
  const now = new Date();

  // Calculate completion times
  const creationToCompletionTimes: number[] = [];
  const approvalToCompletionTimes: number[] = [];

  for (const card of completedCards) {
    // Creation to completion
    const completionTime = hoursBetween(card.createdAt, card.updatedAt);
    creationToCompletionTimes.push(completionTime);

    // Approval to completion (if approved)
    if (card.isApproved && card.approvedAt) {
      const approvalTime = hoursBetween(card.approvedAt, card.updatedAt);
      approvalToCompletionTimes.push(approvalTime);
    }
  }

  // Calculate averages
  const avgCreationToCompletion = creationToCompletionTimes.length > 0
    ? Math.round(creationToCompletionTimes.reduce((a, b) => a + b, 0) / creationToCompletionTimes.length)
    : null;

  const avgApprovalToCompletion = approvalToCompletionTimes.length > 0
    ? Math.round(approvalToCompletionTimes.reduce((a, b) => a + b, 0) / approvalToCompletionTimes.length)
    : null;

  // Calculate median
  const sortedTimes = [...creationToCompletionTimes].sort((a, b) => a - b);
  const medianTime = sortedTimes.length > 0
    ? Math.round(sortedTimes[Math.floor(sortedTimes.length / 2)])
    : null;

  // Duration buckets
  const buckets: DurationBucket[] = [
    { label: '< 1 hour', minHours: 0, maxHours: 1, count: 0, percentage: 0 },
    { label: '1-4 hours', minHours: 1, maxHours: 4, count: 0, percentage: 0 },
    { label: '4-8 hours', minHours: 4, maxHours: 8, count: 0, percentage: 0 },
    { label: '1 day', minHours: 8, maxHours: 24, count: 0, percentage: 0 },
    { label: '2-3 days', minHours: 24, maxHours: 72, count: 0, percentage: 0 },
    { label: '4-7 days', minHours: 72, maxHours: 168, count: 0, percentage: 0 },
    { label: '1-2 weeks', minHours: 168, maxHours: 336, count: 0, percentage: 0 },
    { label: '> 2 weeks', minHours: 336, maxHours: null, count: 0, percentage: 0 },
  ];

  for (const time of creationToCompletionTimes) {
    for (const bucket of buckets) {
      if (time >= bucket.minHours && (bucket.maxHours === null || time < bucket.maxHours)) {
        bucket.count++;
        break;
      }
    }
  }

  // Calculate percentages
  const totalCompleted = creationToCompletionTimes.length;
  for (const bucket of buckets) {
    bucket.percentage = totalCompleted > 0 ? Math.round((bucket.count / totalCompleted) * 100) : 0;
  }

  // Overdue analysis
  const overdueCards = cards.filter(c => !c.completed && !c.archived && c.dueDate && new Date(c.dueDate) < now);

  const overdueByDays: { days: string; count: number }[] = [
    { days: '1-3 days', count: 0 },
    { days: '4-7 days', count: 0 },
    { days: '1-2 weeks', count: 0 },
    { days: '> 2 weeks', count: 0 },
  ];

  const overdueByUser = new Map<string, { userId: string; userName: string; count: number }>();

  for (const card of overdueCards) {
    const dueDate = new Date(card.dueDate!);
    const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysOverdue <= 3) overdueByDays[0].count++;
    else if (daysOverdue <= 7) overdueByDays[1].count++;
    else if (daysOverdue <= 14) overdueByDays[2].count++;
    else overdueByDays[3].count++;

    // Track by user
    for (const member of card.members) {
      if (!overdueByUser.has(member.id)) {
        overdueByUser.set(member.id, { userId: member.id, userName: member.name, count: 0 });
      }
      overdueByUser.get(member.id)!.count++;
    }
  }

  return {
    avgCreationToCompletionHours: avgCreationToCompletion,
    avgApprovalToCompletionHours: avgApprovalToCompletion,
    medianCompletionTimeHours: medianTime,
    cardsByDuration: buckets,
    overdueAnalysis: {
      totalOverdue: overdueCards.length,
      overdueByDays,
      overdueByUser: Array.from(overdueByUser.values()).sort((a, b) => b.count - a.count).slice(0, 10),
    },
    dateRange: filters.dateRange,
  };
}

// Generate Workload Report
export async function generateWorkloadReport(filters: ReportFilters): Promise<WorkloadReport> {
  const cards = await fetchCardsForReports(filters);
  const users = getUsersFromCards(cards);
  const now = new Date();

  const userWorkload = new Map<string, UserWorkloadStats>();

  // Initialize workload stats
  for (const [userId, userData] of users) {
    userWorkload.set(userId, {
      userId,
      userName: userData.name,
      userEmail: userData.email,
      openCards: 0,
      completedCards: 0,
      overdueCards: 0,
      rejectedCards: 0,
      cardsCreatedThisPeriod: 0,
      workloadScore: 0,
    });
  }

  for (const card of cards) {
    // Track cards created
    if (card.authorId) {
      const stats = userWorkload.get(card.authorId);
      if (stats) {
        stats.cardsCreatedThisPeriod++;
      }
    }

    // Track workload by member
    for (const member of card.members) {
      const stats = userWorkload.get(member.id);
      if (!stats) continue;

      if (card.completed || card.archived) {
        stats.completedCards++;
      } else {
        stats.openCards++;

        // Check if overdue
        if (card.dueDate && new Date(card.dueDate) < now) {
          stats.overdueCards++;
        }
      }

      // Track rejected
      if (card.isRejected) {
        stats.rejectedCards++;
      }
    }
  }

  const allStats = Array.from(userWorkload.values());

  // Calculate workload scores (normalized 0-100)
  const maxOpen = Math.max(...allStats.map(s => s.openCards), 1);
  for (const stats of allStats) {
    stats.workloadScore = Math.round((stats.openCards / maxOpen) * 100);
  }

  // Calculate distribution metrics
  const totalOpen = allStats.reduce((sum, s) => sum + s.openCards, 0);
  const avgCards = allStats.length > 0 ? totalOpen / allStats.length : 0;

  // Balance index (100 = perfectly balanced, 0 = all work on one person)
  const variance = allStats.length > 0
    ? allStats.reduce((sum, s) => sum + Math.pow(s.openCards - avgCards, 2), 0) / allStats.length
    : 0;
  const stdDev = Math.sqrt(variance);
  const balanceIndex = avgCards > 0 ? Math.max(0, Math.round(100 - (stdDev / avgCards) * 50)) : 100;

  // Sort for most/least loaded
  const sortedByWorkload = [...allStats].sort((a, b) => b.openCards - a.openCards);

  return {
    users: sortedByWorkload,
    distribution: {
      totalOpenCards: totalOpen,
      avgCardsPerUser: Math.round(avgCards * 10) / 10,
      balanceIndex,
      mostOverloaded: sortedByWorkload.slice(0, 5),
      leastLoaded: sortedByWorkload.slice(-5).reverse(),
    },
    dateRange: filters.dateRange,
  };
}

// Generate Trends Report
export async function generateTrendsReport(filters: ReportFilters): Promise<TrendsReport> {
  const cards = await fetchCardsForReports(filters);

  // Determine granularity based on date range
  const daysDiff = Math.ceil(
    (filters.dateRange.end.getTime() - filters.dateRange.start.getTime()) / (1000 * 60 * 60 * 24)
  );

  let granularity: 'daily' | 'weekly' | 'monthly';
  if (daysDiff <= 14) {
    granularity = 'daily';
  } else if (daysDiff <= 90) {
    granularity = 'weekly';
  } else {
    granularity = 'monthly';
  }

  // Group cards by period
  const completedByPeriod = new Map<string, number>();
  const createdByPeriod = new Map<string, number>();
  const overdueByPeriod = new Map<string, number>();

  const getDateKey = (date: Date): string => {
    if (granularity === 'daily') {
      return date.toISOString().split('T')[0];
    } else if (granularity === 'weekly') {
      const startOfWeek = new Date(date);
      startOfWeek.setDate(date.getDate() - date.getDay());
      return startOfWeek.toISOString().split('T')[0];
    } else {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
    }
  };

  // Initialize all periods
  const current = new Date(filters.dateRange.start);
  while (current <= filters.dateRange.end) {
    const key = getDateKey(current);
    completedByPeriod.set(key, 0);
    createdByPeriod.set(key, 0);
    overdueByPeriod.set(key, 0);

    if (granularity === 'daily') {
      current.setDate(current.getDate() + 1);
    } else if (granularity === 'weekly') {
      current.setDate(current.getDate() + 7);
    } else {
      current.setMonth(current.getMonth() + 1);
    }
  }

  for (const card of cards) {
    // Created
    const createdDate = new Date(card.createdAt);
    const createdKey = getDateKey(createdDate);
    if (createdByPeriod.has(createdKey)) {
      createdByPeriod.set(createdKey, (createdByPeriod.get(createdKey) || 0) + 1);
    }

    // Completed
    if (card.completed || card.archived) {
      const completedDate = new Date(card.updatedAt);
      const completedKey = getDateKey(completedDate);
      if (completedByPeriod.has(completedKey)) {
        completedByPeriod.set(completedKey, (completedByPeriod.get(completedKey) || 0) + 1);
      }
    }

    // Overdue tracking
    if (card.dueDate) {
      const dueDate = new Date(card.dueDate);
      const dueKey = getDateKey(dueDate);
      if (!card.completed && !card.archived && overdueByPeriod.has(dueKey)) {
        overdueByPeriod.set(dueKey, (overdueByPeriod.get(dueKey) || 0) + 1);
      }
    }
  }

  // Convert to arrays
  const sortedKeys = Array.from(completedByPeriod.keys()).sort();

  const completedOverTime = sortedKeys.map(date => ({
    date,
    value: completedByPeriod.get(date) || 0,
  }));

  const createdOverTime = sortedKeys.map(date => ({
    date,
    value: createdByPeriod.get(date) || 0,
  }));

  const overdueOverTime = sortedKeys.map(date => ({
    date,
    value: overdueByPeriod.get(date) || 0,
  }));

  // Calculate velocity (rolling average of completed)
  const windowSize = granularity === 'daily' ? 7 : granularity === 'weekly' ? 4 : 3;
  const velocityData: TrendDataPoint[] = [];

  for (let i = 0; i < completedOverTime.length; i++) {
    const windowStart = Math.max(0, i - windowSize + 1);
    const windowValues = completedOverTime.slice(windowStart, i + 1).map(d => d.value);
    const avg = windowValues.reduce((a, b) => a + b, 0) / windowValues.length;
    velocityData.push({
      date: completedOverTime[i].date,
      value: Math.round(avg * 10) / 10,
    });
  }

  return {
    cardsCompletedOverTime: completedOverTime,
    cardsCreatedOverTime: createdOverTime,
    completionVelocity: velocityData,
    overdueOverTime,
    dateRange: filters.dateRange,
    granularity,
  };
}

// Generate Activity Report
export async function generateActivityReport(filters: ReportFilters): Promise<ActivityReport> {
  const activities = await fetchActivitiesForReports(filters);

  // Count by type
  const byType = new Map<ActivityType, number>();
  const byUser = new Map<string, { userId: string; userName: string; count: number }>();
  const byCard = new Map<string, { cardId: string; cardTitle: string; activityCount: number }>();

  for (const activity of activities) {
    // By type
    byType.set(activity.type, (byType.get(activity.type) || 0) + 1);

    // By user
    if (!byUser.has(activity.authorId)) {
      byUser.set(activity.authorId, { userId: activity.authorId, userName: activity.authorName, count: 0 });
    }
    byUser.get(activity.authorId)!.count++;

    // By card (top cards by activity)
    if (activity.cardId) {
      if (!byCard.has(activity.cardId)) {
        byCard.set(activity.cardId, { cardId: activity.cardId, cardTitle: `Card ${activity.cardId.slice(0, 8)}`, activityCount: 0 });
      }
      byCard.get(activity.cardId)!.activityCount++;
    }
  }

  // Get display labels for activity types
  const activityLabels: Record<ActivityType, string> = {
    card_created: 'Cards Created',
    card_updated: 'Cards Updated',
    card_moved: 'Cards Moved',
    card_completed: 'Cards Completed',
    card_archived: 'Cards Archived',
    card_restored: 'Cards Restored',
    card_deleted: 'Cards Deleted',
    list_created: 'Lists Created',
    list_updated: 'Lists Updated',
    list_archived: 'Lists Archived',
    comment_added: 'Comments Added',
    comment_updated: 'Comments Updated',
    comment_deleted: 'Comments Deleted',
    member_added: 'Members Added',
    member_removed: 'Members Removed',
    label_added: 'Labels Added',
    label_removed: 'Labels Removed',
    due_date_set: 'Due Dates Set',
    due_date_removed: 'Due Dates Removed',
    due_date_updated: 'Due Dates Updated',
    start_date_set: 'Start Dates Set',
    start_date_removed: 'Start Dates Removed',
    start_date_updated: 'Start Dates Updated',
    checklist_added: 'Checklists Added',
    checklist_item_completed: 'Checklist Items Completed',
    checklist_item_uncompleted: 'Checklist Items Uncompleted',
    attachment_added: 'Attachments Added',
    attachment_removed: 'Attachments Removed',
    description_updated: 'Descriptions Updated',
    title_updated: 'Titles Updated',
    department_set: 'Departments Set',
    department_changed: 'Departments Changed',
    department_removed: 'Departments Removed',
    client_set: 'Clients Set',
    client_changed: 'Clients Changed',
    client_removed: 'Clients Removed',
    watcher_added: 'Watchers Added',
    watcher_removed: 'Watchers Removed',
    card_approved: 'Cards Approved',
    card_approval_removed: 'Approvals Removed',
    card_rejected: 'Cards Rejected',
    card_rejection_removed: 'Rejections Removed',
    custom_field_updated: 'Custom Fields Updated',
  };

  return {
    summary: {
      totalActivities: activities.length,
      activitiesByType: Array.from(byType.entries())
        .map(([type, count]) => ({ type, count, label: activityLabels[type] || type }))
        .sort((a, b) => b.count - a.count),
      activitiesByUser: Array.from(byUser.values()).sort((a, b) => b.count - a.count).slice(0, 10),
      mostActiveCards: Array.from(byCard.values()).sort((a, b) => b.activityCount - a.activityCount).slice(0, 10),
    },
    recentActivities: activities.slice(0, 50),
    dateRange: filters.dateRange,
  };
}

// Helper: Get date range from preset
export function getDateRangeFromPreset(preset: DateRangePreset): DateRange {
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const start = new Date();
  start.setHours(0, 0, 0, 0);

  switch (preset) {
    case '7days':
      start.setDate(start.getDate() - 7);
      break;
    case '30days':
      start.setDate(start.getDate() - 30);
      break;
    case '90days':
      start.setDate(start.getDate() - 90);
      break;
    case 'custom':
    default:
      start.setDate(start.getDate() - 30);
      break;
  }

  return { start, end };
}
