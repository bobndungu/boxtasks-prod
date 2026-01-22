import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  BarChart3,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Users,
  TrendingUp,
  Activity,
  Loader2,
  ArrowLeft,
  RefreshCw,
  Calendar,
  UserX,
  Ban,
} from 'lucide-react';
import { fetchDashboardData, type DashboardData } from '../lib/api/dashboard';
import { useMercure } from '../lib/mercure';
import { formatDate, formatTime } from '../lib/utils/date';

export default function WorkspaceReports() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadDashboard = async () => {
    if (!workspaceId) return;

    try {
      setIsLoading(true);
      setError(null);
      const dashboardData = await fetchDashboardData(workspaceId);
      setData(dashboardData);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to load dashboard:', err);
      setError('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [workspaceId]);

  // Real-time updates via Mercure
  useMercure({
    topics: workspaceId ? [`/workspaces/${workspaceId}`] : [],
    onMessage: (event) => {
      // Refresh dashboard on any workspace activity
      if (event.type.startsWith('card') || event.type.startsWith('list')) {
        loadDashboard();
      }
    },
    enabled: !!workspaceId,
  });

  if (isLoading && !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-600">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading reports...</span>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600">{error}</p>
          <button
            onClick={loadDashboard}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const completionRate = data.stats.totalCards > 0
    ? Math.round((data.stats.completedCards / data.stats.totalCards) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link
                to={`/workspace/${workspaceId}`}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-6 w-6 text-blue-600" />
                <h1 className="text-xl font-semibold">Workspace Reports</h1>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {lastUpdated && (
                <span className="text-sm text-gray-500">
                  Last updated: {formatTime(lastUpdated)}
                </span>
              )}
              <button
                onClick={loadDashboard}
                disabled={isLoading}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <StatCard
            title="Total Cards"
            value={data.stats.totalCards}
            icon={<BarChart3 className="h-5 w-5 text-blue-600" />}
            color="blue"
          />
          <StatCard
            title="Completed"
            value={data.stats.completedCards}
            subtitle={`${completionRate}%`}
            icon={<CheckCircle2 className="h-5 w-5 text-green-600" />}
            color="green"
          />
          <StatCard
            title="Overdue"
            value={data.stats.overdueCards}
            icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
            color="red"
            highlight={data.stats.overdueCards > 0}
          />
          <StatCard
            title="Due Soon"
            value={data.stats.dueSoonCards}
            subtitle="7 days"
            icon={<Clock className="h-5 w-5 text-orange-600" />}
            color="orange"
          />
          <StatCard
            title="Unassigned"
            value={data.stats.unassignedCards}
            icon={<UserX className="h-5 w-5 text-gray-600" />}
            color="gray"
          />
          <StatCard
            title="Blocked"
            value={data.stats.blockedCards}
            icon={<Ban className="h-5 w-5 text-purple-600" />}
            color="purple"
          />
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Board Progress */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-600" />
                Board Progress
              </h2>
              <div className="space-y-4">
                {data.boards.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No boards yet</p>
                ) : (
                  data.boards.map((board) => (
                    <BoardProgressCard key={board.id} board={board} />
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Team Stats */}
          <div>
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                Team Performance
              </h2>
              <div className="space-y-3">
                {data.teamStats.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No team members</p>
                ) : (
                  data.teamStats.map((member) => (
                    <TeamMemberCard key={member.id} member={member} />
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Cards Due Soon Chart */}
        <div className="mt-8 grid lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              Upcoming Due Dates
            </h2>
            <div className="space-y-2">
              {data.cardsByDueDate.filter((d) => d.count > 0).length === 0 ? (
                <p className="text-gray-500 text-center py-8">No upcoming due dates</p>
              ) : (
                data.cardsByDueDate.map((day) => (
                  <div key={day.date} className="flex items-center gap-3">
                    <span className="text-sm text-gray-600 w-24">
                      {formatDate(day.date, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                    <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{
                          width: `${Math.min((day.count / Math.max(...data.cardsByDueDate.map((d) => d.count), 1)) * 100, 100)}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium w-8 text-right">{day.count}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-600" />
              Recent Activity
            </h2>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {data.recentActivity.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No recent activity</p>
              ) : (
                data.recentActivity.map((activity) => (
                  <ActivityItem key={activity.id} activity={activity} />
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// Stat Card Component
interface StatCardProps {
  title: string;
  value: number;
  subtitle?: string;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'red' | 'orange' | 'gray' | 'purple';
  highlight?: boolean;
}

function StatCard({ title, value, subtitle, icon, color, highlight }: StatCardProps) {
  const bgColors = {
    blue: 'bg-blue-50',
    green: 'bg-green-50',
    red: 'bg-red-50',
    orange: 'bg-orange-50',
    gray: 'bg-gray-50',
    purple: 'bg-purple-50',
  };

  return (
    <div
      className={`${bgColors[color]} rounded-xl p-4 ${
        highlight ? 'ring-2 ring-red-400 ring-offset-2' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        {icon}
        {subtitle && <span className="text-xs text-gray-500">{subtitle}</span>}
      </div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm text-gray-600">{title}</div>
    </div>
  );
}

// Board Progress Card
interface BoardProgressCardProps {
  board: {
    id: string;
    title: string;
    totalCards: number;
    completedCards: number;
    lists: { id: string; title: string; cardCount: number; completedCount: number }[];
  };
}

function BoardProgressCard({ board }: BoardProgressCardProps) {
  const progress = board.totalCards > 0
    ? Math.round((board.completedCards / board.totalCards) * 100)
    : 0;

  return (
    <Link
      to={`/board/${board.id}`}
      className="block p-4 border rounded-lg hover:border-blue-300 hover:bg-blue-50/50 transition-colors"
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-medium">{board.title}</h3>
        <span className="text-sm text-gray-500">
          {board.completedCards}/{board.totalCards} cards
        </span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-3">
        <div
          className="h-full bg-green-500 rounded-full transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="flex gap-2 flex-wrap">
        {board.lists.slice(0, 4).map((list) => (
          <span
            key={list.id}
            className="text-xs px-2 py-1 bg-gray-100 rounded-full"
          >
            {list.title}: {list.cardCount}
          </span>
        ))}
        {board.lists.length > 4 && (
          <span className="text-xs px-2 py-1 bg-gray-100 rounded-full">
            +{board.lists.length - 4} more
          </span>
        )}
      </div>
    </Link>
  );
}

// Team Member Card
interface TeamMemberCardProps {
  member: {
    id: string;
    name: string;
    email: string;
    assignedCards: number;
    completedCards: number;
    overdueCards: number;
  };
}

function TeamMemberCard({ member }: TeamMemberCardProps) {
  const completionRate = member.assignedCards > 0
    ? Math.round((member.completedCards / member.assignedCards) * 100)
    : 0;

  return (
    <div className="p-3 border rounded-lg">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-sm font-medium text-blue-700">
          {member.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="font-medium truncate">{member.name}</div>
          <div className="text-xs text-gray-500 truncate">{member.email}</div>
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
          {member.assignedCards} assigned
        </span>
        <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded">
          {completionRate}% done
        </span>
        {member.overdueCards > 0 && (
          <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded">
            {member.overdueCards} overdue
          </span>
        )}
      </div>
    </div>
  );
}

// Activity Item Component
interface ActivityItemProps {
  activity: {
    id: string;
    type: string;
    description: string;
    timestamp: string;
    userName?: string;
    cardTitle?: string;
  };
}

function ActivityItem({ activity }: ActivityItemProps) {
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'card_completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'card_created':
        return <BarChart3 className="h-4 w-4 text-blue-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-400" />;
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <div className="flex items-start gap-3 text-sm">
      <div className="mt-0.5">{getActivityIcon(activity.type)}</div>
      <div className="flex-1 min-w-0">
        <p className="text-gray-700 truncate">
          {activity.description || `${activity.userName || 'Someone'} performed an action`}
        </p>
        {activity.cardTitle && (
          <p className="text-gray-500 truncate text-xs">on "{activity.cardTitle}"</p>
        )}
      </div>
      <span className="text-xs text-gray-400 whitespace-nowrap">
        {formatTime(activity.timestamp)}
      </span>
    </div>
  );
}
