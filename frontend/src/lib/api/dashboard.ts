import { getAccessToken } from './client';

const API_URL = import.meta.env.VITE_API_URL || 'https://boxtasks2.ddev.site';

export interface DashboardStats {
  totalCards: number;
  completedCards: number;
  overdueCards: number;
  dueSoonCards: number; // Due within 7 days
  unassignedCards: number;
  blockedCards: number;
}

export interface ListStats {
  id: string;
  title: string;
  cardCount: number;
  completedCount: number;
}

export interface BoardStats {
  id: string;
  title: string;
  totalCards: number;
  completedCards: number;
  lists: ListStats[];
}

export interface ActivityItem {
  id: string;
  type: 'card_created' | 'card_completed' | 'card_moved' | 'comment_added' | 'card_assigned';
  description: string;
  timestamp: string;
  userId?: string;
  userName?: string;
  cardId?: string;
  cardTitle?: string;
  boardId?: string;
  boardTitle?: string;
}

export interface TeamMemberStats {
  id: string;
  name: string;
  email: string;
  assignedCards: number;
  completedCards: number;
  overdueCards: number;
}

export interface DashboardData {
  stats: DashboardStats;
  boards: BoardStats[];
  recentActivity: ActivityItem[];
  teamStats: TeamMemberStats[];
  cardsByDueDate: { date: string; count: number }[];
  completionTrend: { date: string; completed: number; created: number }[];
}

// Fetch all cards for a workspace and calculate stats
export async function fetchDashboardData(workspaceId: string): Promise<DashboardData> {
  const token = getAccessToken();
  const headers = {
    'Accept': 'application/vnd.api+json',
    'Authorization': `Bearer ${token}`,
  };

  // Fetch all boards for the workspace
  let boardsData: Array<Record<string, unknown>> = [];
  try {
    const boardsResponse = await fetch(
      `${API_URL}/jsonapi/node/board?filter[field_board_workspace.id]=${workspaceId}&filter[field_board_archived][value]=0&sort=-created`,
      { headers }
    );

    if (boardsResponse.ok) {
      const boardsResult = await boardsResponse.json();
      boardsData = boardsResult.data || [];
    }
  } catch (err) {
    console.error('Error fetching boards:', err);
  }

  // Fetch all cards for the workspace (through board relationship)
  const boardIds = boardsData.map((b) => (b as { id: string }).id);
  let allCards: Array<Record<string, unknown>> = [];
  const cardsByBoard: Map<string, Array<Record<string, unknown>>> = new Map();

  // Fetch cards for each board
  for (const boardId of boardIds) {
    try {
      const cardsResponse = await fetch(
        `${API_URL}/jsonapi/node/card?filter[field_card_list.field_list_board.id]=${boardId}`,
        { headers }
      );

      if (cardsResponse.ok) {
        const cardsResult = await cardsResponse.json();
        const boardCards = cardsResult.data || [];
        if (Array.isArray(boardCards)) {
          cardsByBoard.set(boardId, boardCards);
          allCards = [...allCards, ...boardCards];
        }
      }
    } catch (err) {
      console.error(`Error fetching cards for board ${boardId}:`, err);
    }
  }

  // Calculate stats
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  let completedCards = 0;
  let overdueCards = 0;
  let dueSoonCards = 0;
  let unassignedCards = 0;
  let blockedCards = 0;

  allCards.forEach((card) => {
    const attrs = card.attributes as Record<string, unknown>;
    const rels = card.relationships as Record<string, { data: unknown }>;

    // Check completion
    if (attrs.field_card_completed) {
      completedCards++;
    }

    // Check due date
    const dueDate = attrs.field_card_due_date as string | null;
    if (dueDate) {
      const due = new Date(dueDate);
      if (due < now && !attrs.field_card_completed) {
        overdueCards++;
      } else if (due <= sevenDaysFromNow && due >= now && !attrs.field_card_completed) {
        dueSoonCards++;
      }
    }

    // Check assigned
    const assigned = rels?.field_card_assigned?.data;
    if (!assigned || (Array.isArray(assigned) && assigned.length === 0)) {
      unassignedCards++;
    }

    // Note: blockedCards would require fetching relationships, simplified for now
  });

  const stats: DashboardStats = {
    totalCards: allCards.length,
    completedCards,
    overdueCards,
    dueSoonCards,
    unassignedCards,
    blockedCards,
  };

  // Build board stats (simplified - no list-level breakdown)
  const boards: BoardStats[] = boardsData.map((board: Record<string, unknown>) => {
    const boardAttrs = board.attributes as Record<string, unknown>;
    const boardId = board.id as string;

    // Get cards for this specific board
    const boardCards = cardsByBoard.get(boardId) || [];

    const completedBoardCards = boardCards.filter((c) => {
      const cAttrs = c.attributes as Record<string, unknown>;
      return cAttrs.field_card_completed;
    }).length;

    return {
      id: boardId,
      title: boardAttrs.title as string,
      totalCards: boardCards.length,
      completedCards: completedBoardCards,
      lists: [], // Simplified - no list breakdown for now
    };
  });

  // Fetch recent activity
  const activityResponse = await fetch(
    `${API_URL}/jsonapi/node/activity?filter[field_activity_workspace.id]=${workspaceId}&sort=-created&page[limit]=20&include=field_activity_user,field_activity_card`,
    { headers }
  );

  let recentActivity: ActivityItem[] = [];
  if (activityResponse.ok) {
    const activityResult = await activityResponse.json();
    const activityData = activityResult.data || [];
    const activityIncluded = activityResult.included || [];

    recentActivity = activityData.map((activity: Record<string, unknown>) => {
      const attrs = activity.attributes as Record<string, unknown>;
      const rels = activity.relationships as Record<string, { data: { id: string } | null }>;

      const userId = rels?.field_activity_user?.data?.id;
      const cardId = rels?.field_activity_card?.data?.id;

      const user = activityIncluded.find((i: Record<string, unknown>) => i.id === userId);
      const card = activityIncluded.find((i: Record<string, unknown>) => i.id === cardId);

      return {
        id: activity.id as string,
        type: (attrs.field_activity_type as string) || 'card_created',
        description: attrs.field_activity_description as string,
        timestamp: attrs.created as string,
        userId,
        userName: user ? ((user.attributes as Record<string, unknown>).field_display_name as string) || ((user.attributes as Record<string, unknown>).name as string) : undefined,
        cardId,
        cardTitle: card ? (card.attributes as Record<string, unknown>).title as string : undefined,
      };
    });
  }

  // Fetch workspace members for team stats
  const membersResponse = await fetch(
    `${API_URL}/jsonapi/node/workspace/${workspaceId}?include=field_workspace_members`,
    { headers }
  );

  let teamStats: TeamMemberStats[] = [];
  if (membersResponse.ok) {
    const membersResult = await membersResponse.json();
    const membersIncluded = membersResult.included || [];

    const members = membersIncluded.filter(
      (i: Record<string, unknown>) => i.type === 'user--user'
    );

    teamStats = members.map((member: Record<string, unknown>) => {
      const memberAttrs = member.attributes as Record<string, unknown>;
      const memberId = member.id as string;

      const assignedCards = allCards.filter((c) => {
        const cRels = c.relationships as Record<string, { data: Array<{ id: string }> | null }>;
        const assigned = cRels?.field_card_assigned?.data;
        return Array.isArray(assigned) && assigned.some((a) => a.id === memberId);
      });

      const completedMemberCards = assignedCards.filter((c) => {
        const cAttrs = c.attributes as Record<string, unknown>;
        return cAttrs.field_card_completed;
      });

      const overdueMemberCards = assignedCards.filter((c) => {
        const cAttrs = c.attributes as Record<string, unknown>;
        const dueDate = cAttrs.field_card_due_date as string | null;
        if (dueDate && !cAttrs.field_card_completed) {
          return new Date(dueDate) < now;
        }
        return false;
      });

      return {
        id: memberId,
        name: memberAttrs.field_display_name as string || memberAttrs.name as string || 'Unknown',
        email: memberAttrs.mail as string || '',
        assignedCards: assignedCards.length,
        completedCards: completedMemberCards.length,
        overdueCards: overdueMemberCards.length,
      };
    });
  }

  // Calculate cards by due date (next 14 days)
  const cardsByDueDate: { date: string; count: number }[] = [];
  for (let i = 0; i < 14; i++) {
    const date = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().split('T')[0];

    const count = allCards.filter((c) => {
      const cAttrs = c.attributes as Record<string, unknown>;
      const dueDate = cAttrs.field_card_due_date as string | null;
      if (dueDate && !cAttrs.field_card_completed) {
        return dueDate.startsWith(dateStr);
      }
      return false;
    }).length;

    cardsByDueDate.push({ date: dateStr, count });
  }

  // Completion trend (last 7 days) - simplified, would need activity log for accurate data
  const completionTrend: { date: string; completed: number; created: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().split('T')[0];

    // This is simplified - in production you'd track actual completion dates
    completionTrend.push({
      date: dateStr,
      completed: Math.floor(Math.random() * 5), // Placeholder
      created: Math.floor(Math.random() * 3), // Placeholder
    });
  }

  return {
    stats,
    boards,
    recentActivity,
    teamStats,
    cardsByDueDate,
    completionTrend,
  };
}

// Board Report Data Types
export interface BoardReportStats {
  totalCards: number;
  completedCards: number;
  overdueCards: number;
  dueSoonCards: number;
  unassignedCards: number;
  archivedCards: number;
  cardsByLabel: { label: string; count: number; color: string }[];
  totalEstimatedHours: number;
  totalTrackedTime: number;
  totalBillableTime: number;
}

export interface BoardListStats {
  id: string;
  title: string;
  position: number;
  cardCount: number;
  completedCount: number;
  wipLimit?: number;
}

export interface BoardMemberStats {
  id: string;
  name: string;
  avatar?: string;
  assignedCards: number;
  completedCards: number;
  overdueCards: number;
  trackedTime: number;
}

export interface BoardReportData {
  boardId: string;
  boardTitle: string;
  stats: BoardReportStats;
  lists: BoardListStats[];
  memberStats: BoardMemberStats[];
  cardsByDueDate: { date: string; count: number }[];
  recentActivity: ActivityItem[];
  completionTrend: { date: string; completed: number; created: number }[];
}

// Fetch board-specific report data
export async function fetchBoardReportData(boardId: string): Promise<BoardReportData> {
  const token = getAccessToken();
  const headers = {
    'Accept': 'application/vnd.api+json',
    'Authorization': `Bearer ${token}`,
  };

  // Fetch board details
  const boardResponse = await fetch(
    `${API_URL}/jsonapi/node/board/${boardId}`,
    { headers }
  );

  if (!boardResponse.ok) {
    throw new Error('Failed to fetch board data');
  }

  const boardResult = await boardResponse.json();
  const boardData = boardResult.data;
  const boardAttrs = boardData.attributes as Record<string, unknown>;

  // Fetch lists for this board (content type is list)
  const listsResponse = await fetch(
    `${API_URL}/jsonapi/node/list?filter[field_list_board.id]=${boardId}&filter[field_list_archived][value]=0&sort=field_list_position`,
    { headers }
  );

  let listsData: Array<Record<string, unknown>> = [];
  if (listsResponse.ok) {
    const listsResult = await listsResponse.json();
    listsData = listsResult.data || [];
  }

  // Fetch all cards for this board
  const cardsResponse = await fetch(
    `${API_URL}/jsonapi/node/card?filter[field_card_list.field_list_board.id]=${boardId}&include=field_card_members,field_card_list`,
    { headers }
  );

  let cardsData: Array<Record<string, unknown>> = [];
  let cardsIncluded: Array<Record<string, unknown>> = [];
  if (cardsResponse.ok) {
    const cardsResult = await cardsResponse.json();
    cardsData = cardsResult.data || [];
    cardsIncluded = cardsResult.included || [];
  }

  // Fetch archived cards count
  const archivedResponse = await fetch(
    `${API_URL}/jsonapi/node/card?filter[field_card_list.field_list_board.id]=${boardId}&filter[field_card_archived][value]=1`,
    { headers }
  );

  let archivedCount = 0;
  if (archivedResponse.ok) {
    const archivedResult = await archivedResponse.json();
    archivedCount = (archivedResult.data || []).length;
  }

  // Calculate stats
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  let completedCards = 0;
  let overdueCards = 0;
  let dueSoonCards = 0;
  let unassignedCards = 0;
  const labelCounts: Map<string, number> = new Map();
  let totalEstimatedHours = 0;

  // Extract unique members from included data
  const memberMap = new Map<string, { name: string; id: string }>();
  cardsIncluded.forEach((item) => {
    if (item.type === 'user--user') {
      const attrs = item.attributes as Record<string, unknown>;
      memberMap.set(item.id as string, {
        id: item.id as string,
        name: (attrs.field_display_name as string) || (attrs.name as string) || 'Unknown',
      });
    }
  });

  // Track member stats
  const memberCardCounts = new Map<string, { assigned: number; completed: number; overdue: number }>();

  // Non-archived cards only for stats
  const activeCards = cardsData.filter((card) => {
    const attrs = card.attributes as Record<string, unknown>;
    return !attrs.field_card_archived;
  });

  activeCards.forEach((card) => {
    const attrs = card.attributes as Record<string, unknown>;
    const rels = card.relationships as Record<string, { data: unknown }>;

    // Check completion
    if (attrs.field_card_completed) {
      completedCards++;
    }

    // Check due date
    const dueDate = attrs.field_card_due_date as string | null;
    if (dueDate) {
      const due = new Date(dueDate);
      if (due < now && !attrs.field_card_completed) {
        overdueCards++;
      } else if (due <= sevenDaysFromNow && due >= now && !attrs.field_card_completed) {
        dueSoonCards++;
      }
    }

    // Check assigned
    const members = rels?.field_card_members?.data as Array<{ id: string }> | null;
    if (!members || members.length === 0) {
      unassignedCards++;
    } else {
      // Track member stats
      members.forEach((member) => {
        const current = memberCardCounts.get(member.id) || { assigned: 0, completed: 0, overdue: 0 };
        current.assigned++;
        if (attrs.field_card_completed) {
          current.completed++;
        }
        if (dueDate && new Date(dueDate) < now && !attrs.field_card_completed) {
          current.overdue++;
        }
        memberCardCounts.set(member.id, current);
      });
    }

    // Count labels
    const labels = attrs.field_card_labels as string[] | null;
    if (labels && Array.isArray(labels)) {
      labels.forEach((label) => {
        labelCounts.set(label, (labelCounts.get(label) || 0) + 1);
      });
    }

    // Sum estimates (convert to hours)
    const estimate = attrs.field_card_estimate as number | null;
    const estimateType = attrs.field_card_estimate_type as string | null;
    if (estimate) {
      if (estimateType === 'hours') {
        totalEstimatedHours += estimate;
      } else if (estimateType === 'points') {
        // Assume 1 point = 2 hours for conversion
        totalEstimatedHours += estimate * 2;
      } else if (estimateType === 'tshirt') {
        // T-shirt sizes: 1=XS(1h), 2=S(2h), 3=M(4h), 5=L(8h), 8=XL(16h), 13=XXL(24h)
        const tshirtToHours: Record<number, number> = { 1: 1, 2: 2, 3: 4, 5: 8, 8: 16, 13: 24 };
        totalEstimatedHours += tshirtToHours[estimate] || estimate * 2;
      }
    }
  });

  // Label colors
  const labelColors: Record<string, string> = {
    green: '#61bd4f',
    yellow: '#f2d600',
    orange: '#ff9f1a',
    red: '#eb5a46',
    purple: '#c377e0',
    blue: '#0079bf',
  };

  const cardsByLabel = Array.from(labelCounts.entries()).map(([label, count]) => ({
    label,
    count,
    color: labelColors[label] || '#666',
  }));

  // Build list stats
  const lists: BoardListStats[] = listsData.map((list) => {
    const listAttrs = list.attributes as Record<string, unknown>;
    const listId = list.id as string;

    const listCards = activeCards.filter((c) => {
      const cRels = c.relationships as Record<string, { data: { id: string } | null }>;
      return cRels?.field_card_list?.data?.id === listId;
    });

    const completedListCards = listCards.filter((c) => {
      const cAttrs = c.attributes as Record<string, unknown>;
      return cAttrs.field_card_completed;
    });

    return {
      id: listId,
      title: listAttrs.title as string,
      position: (listAttrs.field_list_position as number) || 0,
      cardCount: listCards.length,
      completedCount: completedListCards.length,
      wipLimit: listAttrs.field_list_wip_limit as number | undefined,
    };
  });

  // Build member stats
  const memberStats: BoardMemberStats[] = Array.from(memberMap.entries()).map(([memberId, member]) => {
    const counts = memberCardCounts.get(memberId) || { assigned: 0, completed: 0, overdue: 0 };
    return {
      id: memberId,
      name: member.name,
      assignedCards: counts.assigned,
      completedCards: counts.completed,
      overdueCards: counts.overdue,
      trackedTime: 0, // Would need to fetch time entries
    };
  }).filter((m) => m.assignedCards > 0);

  // Fetch recent activity for this board
  // Get card IDs to filter activities client-side
  const cardIds = new Set(activeCards.map((c) => c.id as string));

  let recentActivity: ActivityItem[] = [];

  try {
    // Fetch recent activities and filter by cards in this board client-side
    const activityResponse = await fetch(
      `${API_URL}/jsonapi/node/activity?sort=-created&page[limit]=100&include=field_activity_user,field_activity_card`,
      { headers }
    );

    if (activityResponse.ok) {
      const activityResult = await activityResponse.json();
      const activityData = activityResult.data || [];
      const activityIncluded = activityResult.included || [];

      // Filter to only activities for cards in this board
      const boardActivities = activityData.filter((activity: Record<string, unknown>) => {
        const actRels = activity.relationships as Record<string, { data: { id: string } | null }>;
        const cardId = actRels?.field_activity_card?.data?.id;
        return cardId && cardIds.has(cardId);
      });

      recentActivity = boardActivities.slice(0, 20).map((activity: Record<string, unknown>) => {
        const actAttrs = activity.attributes as Record<string, unknown>;
        const actRels = activity.relationships as Record<string, { data: { id: string } | null }>;

        const userId = actRels?.field_activity_user?.data?.id;
        const cardId = actRels?.field_activity_card?.data?.id;

        const user = activityIncluded.find((i: Record<string, unknown>) => i.id === userId);
        const card = activityIncluded.find((i: Record<string, unknown>) => i.id === cardId);

        return {
          id: activity.id as string,
          type: (actAttrs.field_activity_type as string) || 'card_created',
          description: actAttrs.field_activity_description as string,
          timestamp: actAttrs.created as string,
          userId,
          userName: user ? ((user.attributes as Record<string, unknown>).field_display_name as string) || ((user.attributes as Record<string, unknown>).name as string) : undefined,
          cardId,
          cardTitle: card ? (card.attributes as Record<string, unknown>).title as string : undefined,
        };
      });
    }
  } catch (err) {
    console.error('Error fetching activities:', err);
    // Activity fetch failed, continue without it
  }

  // Calculate cards by due date (next 14 days)
  const cardsByDueDate: { date: string; count: number }[] = [];
  for (let i = 0; i < 14; i++) {
    const date = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().split('T')[0];

    const count = activeCards.filter((c) => {
      const cAttrs = c.attributes as Record<string, unknown>;
      const cardDueDate = cAttrs.field_card_due_date as string | null;
      if (cardDueDate && !cAttrs.field_card_completed) {
        return cardDueDate.startsWith(dateStr);
      }
      return false;
    }).length;

    cardsByDueDate.push({ date: dateStr, count });
  }

  // Completion trend (last 7 days) - simplified
  const completionTrend: { date: string; completed: number; created: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().split('T')[0];

    // Count cards created on this date
    const createdCount = activeCards.filter((c) => {
      const cAttrs = c.attributes as Record<string, unknown>;
      const created = cAttrs.created as string;
      return created?.startsWith(dateStr);
    }).length;

    completionTrend.push({
      date: dateStr,
      completed: 0, // Would need completion date tracking for accuracy
      created: createdCount,
    });
  }

  const stats: BoardReportStats = {
    totalCards: activeCards.length,
    completedCards,
    overdueCards,
    dueSoonCards,
    unassignedCards,
    archivedCards: archivedCount,
    cardsByLabel,
    totalEstimatedHours,
    totalTrackedTime: 0, // Would need time entries fetch
    totalBillableTime: 0, // Would need time entries fetch
  };

  return {
    boardId,
    boardTitle: boardAttrs.title as string,
    stats,
    lists,
    memberStats,
    cardsByDueDate,
    recentActivity,
    completionTrend,
  };
}

// Fetch blocked cards count (requires relationships)
export async function fetchBlockedCardsCount(_workspaceId: string): Promise<number> {
  const token = getAccessToken();

  const response = await fetch(
    `${API_URL}/jsonapi/node/card_relationship?filter[field_relationship_type]=blocked_by`,
    {
      headers: {
        'Accept': 'application/vnd.api+json',
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    return 0;
  }

  const result = await response.json();
  const uniqueBlockedCards = new Set(
    (result.data || []).map((r: Record<string, unknown>) => {
      const rels = r.relationships as Record<string, { data: { id: string } | null }>;
      return rels?.field_source_card?.data?.id;
    })
  );

  return uniqueBlockedCards.size;
}
