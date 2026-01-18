import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { Loader2, Clock, AlertTriangle, CheckCircle, Timer } from 'lucide-react';
import {
  type ReportFilters,
  type TaskDurationReport,
  generateTaskDurationReport,
} from '../../lib/api/reports';

interface TasksTabProps {
  filters: ReportFilters;
}

const DURATION_COLORS = ['#10B981', '#34D399', '#6EE7B7', '#FCD34D', '#F59E0B', '#EF4444', '#DC2626', '#991B1B'];
const OVERDUE_COLORS = ['#FEF3C7', '#FCD34D', '#F59E0B', '#DC2626'];

export function TasksTab({ filters }: TasksTabProps) {
  const [report, setReport] = useState<TaskDurationReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadReport() {
      if (!filters.workspaceId) return;

      setLoading(true);
      setError(null);

      try {
        const data = await generateTaskDurationReport(filters);
        setReport(data);
      } catch (err) {
        console.error('Failed to load task duration report:', err);
        setError('Failed to load task duration data');
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

  if (!report) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No task duration data available for the selected period.</p>
      </div>
    );
  }

  // Format time for display
  const formatTime = (hours: number | null): string => {
    if (hours === null) return 'N/A';
    if (hours < 1) return '< 1 hour';
    if (hours < 24) return `${Math.round(hours)} hours`;
    const days = Math.round(hours / 24);
    return `${days} day${days !== 1 ? 's' : ''}`;
  };

  // Filter duration buckets with data for pie chart
  const durationPieData = report.cardsByDuration.filter(b => b.count > 0);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Avg Completion Time</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatTime(report.avgCreationToCompletionHours)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <Timer className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Median Time</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatTime(report.medianCompletionTimeHours)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
              <CheckCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Post-Approval Time</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatTime(report.avgApprovalToCompletionHours)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Currently Overdue</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {report.overdueAnalysis.totalOverdue}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Duration Distribution Bar Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Task Duration Distribution
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={report.cardsByDuration}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} interval={0} angle={-45} textAnchor="end" height={80} />
              <YAxis />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3">
                        <p className="font-medium text-gray-900 dark:text-white">{data.label}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {data.count} tasks ({data.percentage}%)
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {report.cardsByDuration.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={DURATION_COLORS[index % DURATION_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Duration Distribution Pie Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Duration Breakdown
          </h3>
          {durationPieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={durationPieData as unknown as Array<Record<string, unknown>>}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(props) => {
                    const { payload } = props as { payload: { label: string; percentage: number } };
                    return payload.percentage > 5 ? `${payload.label} (${payload.percentage}%)` : '';
                  }}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {durationPieData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={DURATION_COLORS[index % DURATION_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, _name, props) => {
                    const payload = (props as { payload: { label: string; percentage: number } }).payload;
                    return [`${value} tasks (${payload.percentage}%)`, payload.label];
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-500">
              No completed tasks in this period
            </div>
          )}
        </div>
      </div>

      {/* Overdue Analysis */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Overdue Analysis
        </h3>

        {report.overdueAnalysis.totalOverdue > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Overdue by Days */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                How Long Overdue
              </h4>
              <div className="space-y-2">
                {report.overdueAnalysis.overdueByDays.map((item, index) => (
                  <div key={item.days} className="flex items-center gap-3">
                    <div className="w-24 text-sm text-gray-600 dark:text-gray-400">{item.days}</div>
                    <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${report.overdueAnalysis.totalOverdue > 0 ? (item.count / report.overdueAnalysis.totalOverdue) * 100 : 0}%`,
                          backgroundColor: OVERDUE_COLORS[index],
                        }}
                      />
                    </div>
                    <div className="w-12 text-sm text-right font-medium text-gray-900 dark:text-white">
                      {item.count}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Overdue by User */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Overdue by User
              </h4>
              {report.overdueAnalysis.overdueByUser.length > 0 ? (
                <div className="space-y-2">
                  {report.overdueAnalysis.overdueByUser.slice(0, 5).map((user) => (
                    <div key={user.userId} className="flex items-center justify-between p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {user.userName}
                      </span>
                      <span className="text-sm font-bold text-red-600 dark:text-red-400">
                        {user.count} overdue
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400">No users with overdue tasks</p>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
            <p className="text-lg font-medium text-gray-900 dark:text-white">No Overdue Tasks</p>
            <p className="text-gray-500 dark:text-gray-400">All tasks are on schedule!</p>
          </div>
        )}
      </div>

      {/* Duration Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Duration Buckets
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Tasks
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Percentage
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Distribution
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {report.cardsByDuration.map((bucket, index) => (
                <tr key={bucket.label} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900 dark:text-white">
                    {bucket.label}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-600 dark:text-gray-300">
                    {bucket.count}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-600 dark:text-gray-300">
                    {bucket.percentage}%
                  </td>
                  <td className="px-4 py-3">
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{
                          width: `${bucket.percentage}%`,
                          backgroundColor: DURATION_COLORS[index % DURATION_COLORS.length],
                        }}
                      />
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
