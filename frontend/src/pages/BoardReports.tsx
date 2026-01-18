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
  Archive,
  Tag,
  Timer,
  ListTodo,
} from 'lucide-react';
import { formatDate, formatTime } from '../lib/utils/date';
import { fetchBoardReportData, type BoardReportData, type BoardListStats, type BoardMemberStats, type ActivityItem } from '../lib/api/dashboard';
import { useMercure } from '../lib/hooks/useMercure';
import MainHeader from '../components/MainHeader';

export default function BoardReports() {
  const { boardId } = useParams<{ boardId: string }>();
  const [data, setData] = useState<BoardReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadReport = async () => {
    if (!boardId) return;

    try {
      setIsLoading(true);
      setError(null);
      const reportData = await fetchBoardReportData(boardId);
      setData(reportData);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to load board report:', err);
      setError('Failed to load board report data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [boardId]);

  // Real-time updates via Mercure
  useMercure({
    topics: boardId ? [`/boards/${boardId}`] : [],
    onMessage: (event) => {
      // Refresh report on any board activity
      if (event.type.startsWith('card') || event.type.startsWith('list')) {
        loadReport();
      }
    },
    enabled: !!boardId,
  });

  if (isLoading && !data) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading board report...</span>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">{error}</p>
          <button
            onClick={loadReport}
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Main Header */}
      <MainHeader />

      {/* Page Subheader */}
      <header className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 sticky top-0 md:top-16 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-4">
              <Link
                to={`/board/${boardId}`}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </Link>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                <div>
                  <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Board Reports</h1>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{data.boardTitle}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {lastUpdated && (
                <span className="hidden sm:block text-sm text-gray-500 dark:text-gray-400">
                  Last updated: {formatTime(lastUpdated)}
                </span>
              )}
              <button
                onClick={loadReport}
                disabled={isLoading}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50 text-gray-700 dark:text-gray-300"
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
            title="Archived"
            value={data.stats.archivedCards}
            icon={<Archive className="h-5 w-5 text-purple-600" />}
            color="purple"
          />
        </div>

        {/* Estimates Summary */}
        {data.stats.totalEstimatedHours > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6 mb-8">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
              <Timer className="h-5 w-5 text-blue-600" />
              Estimates Summary
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">{data.stats.totalEstimatedHours}h</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Total Estimated</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">{data.stats.totalTrackedTime}h</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Time Tracked</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-600">{data.stats.totalBillableTime}h</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Billable Time</div>
              </div>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-8">
          {/* List Progress */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
                <ListTodo className="h-5 w-5 text-blue-600" />
                List Progress
              </h2>
              <div className="space-y-4">
                {data.lists.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-8">No lists yet</p>
                ) : (
                  data.lists.map((list) => (
                    <ListProgressCard key={list.id} list={list} />
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Labels Distribution */}
          <div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6 mb-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
                <Tag className="h-5 w-5 text-blue-600" />
                Labels Distribution
              </h2>
              <div className="space-y-3">
                {data.stats.cardsByLabel.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-4">No labels used</p>
                ) : (
                  data.stats.cardsByLabel.map((item) => (
                    <div key={item.label} className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="flex-1 text-sm capitalize text-gray-700 dark:text-gray-300">
                        {item.label}
                      </span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {item.count}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Team Stats */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
                <Users className="h-5 w-5 text-blue-600" />
                Team Performance
              </h2>
              <div className="space-y-3">
                {data.memberStats.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-8">No assigned members</p>
                ) : (
                  data.memberStats.map((member) => (
                    <TeamMemberCard key={member.id} member={member} />
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Due Dates and Activity */}
        <div className="mt-8 grid lg:grid-cols-2 gap-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
              <Calendar className="h-5 w-5 text-blue-600" />
              Upcoming Due Dates
            </h2>
            <div className="space-y-2">
              {data.cardsByDueDate.filter((d) => d.count > 0).length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">No upcoming due dates</p>
              ) : (
                data.cardsByDueDate.map((day) => (
                  <div key={day.date} className="flex items-center gap-3">
                    <span className="text-sm text-gray-600 dark:text-gray-400 w-24">
                      {formatDate(day.date, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                    <div className="flex-1 h-6 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{
                          width: `${Math.min((day.count / Math.max(...data.cardsByDueDate.map((d) => d.count), 1)) * 100, 100)}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium w-8 text-right text-gray-900 dark:text-white">{day.count}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
              <Activity className="h-5 w-5 text-blue-600" />
              Recent Activity
            </h2>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {data.recentActivity.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">No recent activity</p>
              ) : (
                data.recentActivity.map((activity) => (
                  <ActivityItemCard key={activity.id} activity={activity} />
                ))
              )}
            </div>
          </div>
        </div>

        {/* Completion Trend */}
        <div className="mt-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              Cards Created (Last 7 Days)
            </h2>
            <div className="flex items-end gap-2 h-32">
              {data.completionTrend.map((day) => {
                const maxCreated = Math.max(...data.completionTrend.map((d) => d.created), 1);
                const height = (day.created / maxCreated) * 100;
                return (
                  <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex flex-col items-center" style={{ height: '100px' }}>
                      <div
                        className="w-full bg-blue-500 rounded-t transition-all"
                        style={{ height: `${height}%`, minHeight: day.created > 0 ? '4px' : '0' }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {formatDate(day.date, { weekday: 'short' })}
                    </span>
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{day.created}</span>
                  </div>
                );
              })}
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
    blue: 'bg-blue-50 dark:bg-blue-900/20',
    green: 'bg-green-50 dark:bg-green-900/20',
    red: 'bg-red-50 dark:bg-red-900/20',
    orange: 'bg-orange-50 dark:bg-orange-900/20',
    gray: 'bg-gray-50 dark:bg-gray-800',
    purple: 'bg-purple-50 dark:bg-purple-900/20',
  };

  return (
    <div
      className={`${bgColors[color]} rounded-xl p-4 ${
        highlight ? 'ring-2 ring-red-400 ring-offset-2 dark:ring-offset-gray-900' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        {icon}
        {subtitle && <span className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</span>}
      </div>
      <div className="text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
      <div className="text-sm text-gray-600 dark:text-gray-400">{title}</div>
    </div>
  );
}

// List Progress Card
interface ListProgressCardProps {
  list: BoardListStats;
}

function ListProgressCard({ list }: ListProgressCardProps) {
  const progress = list.cardCount > 0
    ? Math.round((list.completedCount / list.cardCount) * 100)
    : 0;

  const isOverWip = list.wipLimit && list.cardCount > list.wipLimit;

  return (
    <div className={`p-4 border rounded-lg ${isOverWip ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-900/20' : 'border-gray-200 dark:border-gray-700'}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-medium text-gray-900 dark:text-white">{list.title}</h3>
        <div className="flex items-center gap-2">
          {list.wipLimit && (
            <span className={`text-xs px-2 py-0.5 rounded ${isOverWip ? 'bg-red-200 text-red-700 dark:bg-red-800 dark:text-red-200' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}`}>
              WIP: {list.cardCount}/{list.wipLimit}
            </span>
          )}
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {list.completedCount}/{list.cardCount} cards
          </span>
        </div>
      </div>
      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-green-500 rounded-full transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 text-right">
        {progress}% complete
      </div>
    </div>
  );
}

// Team Member Card
interface TeamMemberCardProps {
  member: BoardMemberStats;
}

function TeamMemberCard({ member }: TeamMemberCardProps) {
  const completionRate = member.assignedCards > 0
    ? Math.round((member.completedCards / member.assignedCards) * 100)
    : 0;

  return (
    <div className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-sm font-medium text-blue-700 dark:text-blue-300">
          {member.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-medium truncate text-gray-900 dark:text-white">{member.name}</div>
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs flex-wrap">
        <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded">
          {member.assignedCards} assigned
        </span>
        <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 rounded">
          {completionRate}% done
        </span>
        {member.overdueCards > 0 && (
          <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 rounded">
            {member.overdueCards} overdue
          </span>
        )}
      </div>
    </div>
  );
}

// Activity Item Component
interface ActivityItemCardProps {
  activity: ActivityItem;
}

function ActivityItemCard({ activity }: ActivityItemCardProps) {
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
        <p className="text-gray-700 dark:text-gray-300 truncate">
          {activity.description || `${activity.userName || 'Someone'} performed an action`}
        </p>
        {activity.cardTitle && (
          <p className="text-gray-500 dark:text-gray-400 truncate text-xs">on "{activity.cardTitle}"</p>
        )}
      </div>
      <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
        {formatTime(activity.timestamp)}
      </span>
    </div>
  );
}
