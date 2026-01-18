import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Loader2, TrendingUp, Award, AlertTriangle, Users } from 'lucide-react';
import {
  type ReportFilters,
  type PerformanceReport,
  generatePerformanceReport,
} from '../../lib/api/reports';

interface PerformanceTabProps {
  filters: ReportFilters;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export function PerformanceTab({ filters }: PerformanceTabProps) {
  const [report, setReport] = useState<PerformanceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadReport() {
      if (!filters.workspaceId) return;

      setLoading(true);
      setError(null);

      try {
        const data = await generatePerformanceReport(filters);
        setReport(data);
      } catch (err) {
        console.error('Failed to load performance report:', err);
        setError('Failed to load performance data');
      } finally {
        setLoading(false);
      }
    }

    loadReport();
  }, [filters.workspaceId, filters.boardIds, filters.memberIds, filters.dateRange.start.toISOString(), filters.dateRange.end.toISOString()]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-red-600 dark:text-red-400">
        {error}
      </div>
    );
  }

  if (!report || report.users.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No performance data available for the selected period.</p>
      </div>
    );
  }

  // Prepare chart data
  const completionChartData = report.users
    .filter(u => u.cardsAssigned > 0)
    .slice(0, 10)
    .map(u => ({
      name: u.userName.split(' ')[0], // First name only for chart
      completed: u.cardsCompleted,
      assigned: u.cardsAssigned,
      rate: u.completionRate,
    }));

  const overdueChartData = report.users
    .filter(u => u.overdueCards > 0)
    .slice(0, 10)
    .map(u => ({
      name: u.userName.split(' ')[0],
      overdue: u.overdueCards,
    }));

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Cards Completed</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {report.summary.totalCardsCompleted}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <Users className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Cards Created</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {report.summary.totalCardsCreated}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Avg Completion Time</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {report.summary.avgCompletionTimeHours !== null
                  ? `${Math.round(report.summary.avgCompletionTimeHours / 24)}d`
                  : 'N/A'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Award className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Active Users</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {report.users.filter(u => u.cardsAssigned > 0 || u.cardsCreated > 0).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Completion by User */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Cards Completed by User
          </h3>
          {completionChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={completionChartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={80} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3">
                          <p className="font-medium text-gray-900 dark:text-white">{data.name}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Completed: {data.completed} / {data.assigned}
                          </p>
                          <p className="text-sm text-blue-600 dark:text-blue-400">
                            Rate: {data.rate}%
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="completed" fill="#3B82F6" radius={[0, 4, 4, 0]}>
                  {completionChartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-500">
              No completion data
            </div>
          )}
        </div>

        {/* Overdue by User */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Overdue Cards by User
          </h3>
          {overdueChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={overdueChartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={80} />
                <Tooltip />
                <Bar dataKey="overdue" fill="#EF4444" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-500">
              <div className="text-center">
                <TrendingUp className="h-8 w-8 mx-auto mb-2 text-green-500" />
                <p>No overdue cards!</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Top Performers & Needs Attention */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Performers */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-4">
            <Award className="h-5 w-5 text-yellow-500" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Top Performers
            </h3>
          </div>
          {report.summary.topPerformers.length > 0 ? (
            <div className="space-y-3">
              {report.summary.topPerformers.map((user, index) => (
                <div
                  key={user.userId}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-gray-400">#{index + 1}</span>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{user.userName}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {user.cardsCompleted} completed of {user.cardsAssigned}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-green-600 dark:text-green-400">
                      {user.completionRate}%
                    </span>
                    <p className="text-xs text-gray-500">completion</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-center py-4">
              Need at least 5 assigned cards to qualify
            </p>
          )}
        </div>

        {/* Needs Attention */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Needs Attention
            </h3>
          </div>
          {report.summary.needsAttention.length > 0 ? (
            <div className="space-y-3">
              {report.summary.needsAttention.map((user) => (
                <div
                  key={user.userId}
                  className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{user.userName}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {user.overdueCards > 0 && `${user.overdueCards} overdue`}
                      {user.overdueCards > 0 && user.completionRate < 50 && ' • '}
                      {user.completionRate < 50 && `${user.completionRate}% completion`}
                    </p>
                  </div>
                  {user.overdueCards > 0 && (
                    <span className="px-2 py-1 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full">
                      {user.overdueCards} overdue
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4">
              <TrendingUp className="h-8 w-8 mx-auto mb-2 text-green-500" />
              <p className="text-gray-500 dark:text-gray-400">Everyone is on track!</p>
            </div>
          )}
        </div>
      </div>

      {/* Detailed User Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            All Users Performance
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  User
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Assigned
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Completed
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Rate
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Overdue
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Avg Time
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Approved
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Rejected
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {report.users.map((user) => (
                <tr key={user.userId} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="font-medium text-gray-900 dark:text-white">{user.userName}</div>
                    {user.userEmail && (
                      <div className="text-sm text-gray-500 dark:text-gray-400">{user.userEmail}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-600 dark:text-gray-300">
                    {user.cardsCreated}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-600 dark:text-gray-300">
                    {user.cardsAssigned}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-600 dark:text-gray-300">
                    {user.cardsCompleted}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`text-sm font-medium ${
                      user.completionRate >= 80
                        ? 'text-green-600 dark:text-green-400'
                        : user.completionRate >= 50
                          ? 'text-yellow-600 dark:text-yellow-400'
                          : 'text-red-600 dark:text-red-400'
                    }`}>
                      {user.completionRate}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {user.overdueCards > 0 ? (
                      <span className="text-sm font-medium text-red-600 dark:text-red-400">
                        {user.overdueCards}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-600 dark:text-gray-300">
                    {user.avgCompletionTimeHours !== null
                      ? user.avgCompletionTimeHours < 24
                        ? `${user.avgCompletionTimeHours}h`
                        : `${Math.round(user.avgCompletionTimeHours / 24)}d`
                      : '-'}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-600 dark:text-gray-300">
                    {user.approvedCards}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-600 dark:text-gray-300">
                    {user.rejectedCards}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
