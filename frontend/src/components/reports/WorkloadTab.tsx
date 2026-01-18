import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Loader2, Users, Scale, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import {
  type ReportFilters,
  type WorkloadReport,
  generateWorkloadReport,
} from '../../lib/api/reports';

interface WorkloadTabProps {
  filters: ReportFilters;
}

const WORKLOAD_COLORS = {
  light: '#10B981',
  moderate: '#F59E0B',
  heavy: '#EF4444',
};

function getWorkloadColor(score: number): string {
  if (score <= 33) return WORKLOAD_COLORS.light;
  if (score <= 66) return WORKLOAD_COLORS.moderate;
  return WORKLOAD_COLORS.heavy;
}

function getWorkloadLabel(score: number): string {
  if (score <= 33) return 'Light';
  if (score <= 66) return 'Moderate';
  return 'Heavy';
}

export function WorkloadTab({ filters }: WorkloadTabProps) {
  const [report, setReport] = useState<WorkloadReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadReport() {
      if (!filters.workspaceId) return;

      setLoading(true);
      setError(null);

      try {
        const data = await generateWorkloadReport(filters);
        setReport(data);
      } catch (err) {
        console.error('Failed to load workload report:', err);
        setError('Failed to load workload data');
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
        <p>No workload data available for the selected period.</p>
      </div>
    );
  }

  // Prepare chart data
  const workloadChartData = report.users
    .filter(u => u.openCards > 0 || u.completedCards > 0)
    .slice(0, 15)
    .map(u => ({
      name: u.userName.split(' ')[0],
      open: u.openCards,
      completed: u.completedCards,
      overdue: u.overdueCards,
      score: u.workloadScore,
    }));

  // Balance indicator
  const getBalanceStatus = (index: number): { label: string; color: string } => {
    if (index >= 80) return { label: 'Excellent', color: 'text-green-600' };
    if (index >= 60) return { label: 'Good', color: 'text-blue-600' };
    if (index >= 40) return { label: 'Fair', color: 'text-yellow-600' };
    return { label: 'Poor', color: 'text-red-600' };
  };

  const balanceStatus = getBalanceStatus(report.distribution.balanceIndex);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Open Cards</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {report.distribution.totalOpenCards}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Avg per User</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {report.distribution.avgCardsPerUser}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Scale className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Balance Index</p>
              <p className={`text-2xl font-bold ${balanceStatus.color}`}>
                {report.distribution.balanceIndex}%
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
              <p className="text-sm text-gray-500 dark:text-gray-400">Balance Status</p>
              <p className={`text-2xl font-bold ${balanceStatus.color}`}>
                {balanceStatus.label}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Workload Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Workload by User
        </h3>
        {workloadChartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={workloadChartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={80} />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3">
                        <p className="font-medium text-gray-900 dark:text-white mb-2">{data.name}</p>
                        <p className="text-sm text-blue-600">Open: {data.open}</p>
                        <p className="text-sm text-green-600">Completed: {data.completed}</p>
                        {data.overdue > 0 && (
                          <p className="text-sm text-red-600">Overdue: {data.overdue}</p>
                        )}
                        <p className="text-sm text-gray-500 mt-1">
                          Workload: {getWorkloadLabel(data.score)}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="open" stackId="a" name="Open" fill="#3B82F6" />
              <Bar dataKey="completed" stackId="a" name="Completed" fill="#10B981" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[400px] flex items-center justify-center text-gray-500">
            No workload data
          </div>
        )}
      </div>

      {/* Most/Least Loaded */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Most Overloaded */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-red-500" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Most Loaded
            </h3>
          </div>
          <div className="space-y-3">
            {report.distribution.mostOverloaded.map((user) => (
              <div
                key={user.userId}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
              >
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{user.userName}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {user.openCards} open • {user.completedCards} completed
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="px-2 py-1 text-xs font-medium rounded-full"
                    style={{
                      backgroundColor: getWorkloadColor(user.workloadScore) + '20',
                      color: getWorkloadColor(user.workloadScore),
                    }}
                  >
                    {getWorkloadLabel(user.workloadScore)}
                  </span>
                  {user.overdueCards > 0 && (
                    <span className="px-2 py-1 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full">
                      {user.overdueCards} overdue
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Least Loaded */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingDown className="h-5 w-5 text-green-500" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Least Loaded
            </h3>
          </div>
          <div className="space-y-3">
            {report.distribution.leastLoaded.map((user) => (
              <div
                key={user.userId}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
              >
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{user.userName}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {user.openCards} open • {user.completedCards} completed
                  </p>
                </div>
                <span
                  className="px-2 py-1 text-xs font-medium rounded-full"
                  style={{
                    backgroundColor: getWorkloadColor(user.workloadScore) + '20',
                    color: getWorkloadColor(user.workloadScore),
                  }}
                >
                  {getWorkloadLabel(user.workloadScore)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Detailed Workload Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            All Users Workload
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
                  Open Cards
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Completed
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Overdue
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Rejected
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Workload
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
                    {user.openCards}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-600 dark:text-gray-300">
                    {user.completedCards}
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
                    {user.rejectedCards}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-600 dark:text-gray-300">
                    {user.cardsCreatedThisPeriod}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2 max-w-[100px]">
                        <div
                          className="h-2 rounded-full transition-all"
                          style={{
                            width: `${user.workloadScore}%`,
                            backgroundColor: getWorkloadColor(user.workloadScore),
                          }}
                        />
                      </div>
                      <span
                        className="text-xs font-medium"
                        style={{ color: getWorkloadColor(user.workloadScore) }}
                      >
                        {getWorkloadLabel(user.workloadScore)}
                      </span>
                    </div>
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
