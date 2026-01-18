import { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Loader2, TrendingUp, Calendar, Activity } from 'lucide-react';
import {
  type ReportFilters,
  type TrendsReport,
  generateTrendsReport,
} from '../../lib/api/reports';

interface TrendsTabProps {
  filters: ReportFilters;
}

export function TrendsTab({ filters }: TrendsTabProps) {
  const [report, setReport] = useState<TrendsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadReport() {
      if (!filters.workspaceId) return;

      setLoading(true);
      setError(null);

      try {
        const data = await generateTrendsReport(filters);
        setReport(data);
      } catch (err) {
        console.error('Failed to load trends report:', err);
        setError('Failed to load trends data');
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

  if (!report || report.cardsCompletedOverTime.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No trends data available for the selected period.</p>
      </div>
    );
  }

  // Format date for display
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    if (report.granularity === 'daily') {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else if (report.granularity === 'weekly') {
      return `Week of ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    }
  };

  // Calculate totals
  const totalCompleted = report.cardsCompletedOverTime.reduce((sum, d) => sum + d.value, 0);
  const totalCreated = report.cardsCreatedOverTime.reduce((sum, d) => sum + d.value, 0);

  // Average velocity
  const avgVelocity = report.completionVelocity.length > 0
    ? report.completionVelocity.reduce((sum, d) => sum + d.value, 0) / report.completionVelocity.length
    : 0;

  // Net change (created - completed)
  const netChange = totalCreated - totalCompleted;

  // Combine data for the main chart
  const combinedData = report.cardsCompletedOverTime.map((item, index) => ({
    date: item.date,
    formattedDate: formatDate(item.date),
    completed: item.value,
    created: report.cardsCreatedOverTime[index]?.value || 0,
    velocity: report.completionVelocity[index]?.value || 0,
    overdue: report.overdueOverTime[index]?.value || 0,
  }));

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Completed</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {totalCompleted}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Created</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {totalCreated}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Calendar className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Avg Velocity</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {avgVelocity.toFixed(1)}
                <span className="text-sm font-normal text-gray-500">/{report.granularity.slice(0, -2)}</span>
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${netChange <= 0 ? 'bg-green-100 dark:bg-green-900/30' : 'bg-yellow-100 dark:bg-yellow-900/30'}`}>
              <TrendingUp className={`h-5 w-5 ${netChange <= 0 ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}`} />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Net Change</p>
              <p className={`text-2xl font-bold ${netChange <= 0 ? 'text-green-600' : 'text-yellow-600'}`}>
                {netChange > 0 ? '+' : ''}{netChange}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Created vs Completed Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Cards Created vs Completed
        </h3>
        <ResponsiveContainer width="100%" height={350}>
          <AreaChart data={combinedData}>
            <defs>
              <linearGradient id="colorCreated" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="formattedDate"
              tick={{ fontSize: 12 }}
              interval="preserveStartEnd"
            />
            <YAxis />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3">
                      <p className="font-medium text-gray-900 dark:text-white mb-2">{label}</p>
                      {payload.map((entry, index) => (
                        <p key={index} className="text-sm" style={{ color: entry.color }}>
                          {entry.name}: {entry.value}
                        </p>
                      ))}
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="created"
              name="Created"
              stroke="#3B82F6"
              fillOpacity={1}
              fill="url(#colorCreated)"
            />
            <Area
              type="monotone"
              dataKey="completed"
              name="Completed"
              stroke="#10B981"
              fillOpacity={1}
              fill="url(#colorCompleted)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Velocity Trend */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Completion Velocity (Rolling Average)
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={combinedData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="formattedDate"
              tick={{ fontSize: 12 }}
              interval="preserveStartEnd"
            />
            <YAxis />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3">
                      <p className="font-medium text-gray-900 dark:text-white mb-2">{label}</p>
                      <p className="text-sm text-purple-600">
                        Velocity: {(payload[0].value as number).toFixed(1)} cards/{report.granularity.slice(0, -2)}
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Line
              type="monotone"
              dataKey="velocity"
              name="Velocity"
              stroke="#8B5CF6"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Overdue Trend */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Overdue Tasks Over Time
        </h3>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={combinedData}>
            <defs>
              <linearGradient id="colorOverdue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="formattedDate"
              tick={{ fontSize: 12 }}
              interval="preserveStartEnd"
            />
            <YAxis />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3">
                      <p className="font-medium text-gray-900 dark:text-white mb-2">{label}</p>
                      <p className="text-sm text-red-600">
                        Overdue: {payload[0].value}
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Area
              type="monotone"
              dataKey="overdue"
              name="Overdue"
              stroke="#EF4444"
              fillOpacity={1}
              fill="url(#colorOverdue)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Data Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Detailed Trends Data ({report.granularity})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Period
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Completed
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Velocity
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Overdue
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Net
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {combinedData.map((row) => {
                const net = row.created - row.completed;
                return (
                  <tr key={row.date} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900 dark:text-white">
                      {row.formattedDate}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-blue-600 dark:text-blue-400">
                      {row.created}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-green-600 dark:text-green-400">
                      {row.completed}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-purple-600 dark:text-purple-400">
                      {row.velocity.toFixed(1)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {row.overdue > 0 ? (
                        <span className="text-sm font-medium text-red-600 dark:text-red-400">
                          {row.overdue}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-sm font-medium ${net <= 0 ? 'text-green-600' : 'text-yellow-600'}`}>
                        {net > 0 ? '+' : ''}{net}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
