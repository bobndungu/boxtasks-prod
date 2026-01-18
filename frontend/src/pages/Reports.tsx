import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  BarChart3,
  Clock,
  Users,
  TrendingUp,
  Activity,
  Download,
  FileText,
  ChevronDown,
  Loader2,
  AlertCircle,
  Calendar,
} from 'lucide-react';
import { usePermissions, type ReportType } from '../lib/hooks/usePermissions';
import { fetchWorkspaces, type Workspace, fetchWorkspaceMembers, type WorkspaceMember } from '../lib/api/workspaces';
import { fetchBoardsByWorkspace, type Board } from '../lib/api/boards';
import {
  type DateRangePreset,
  type DateRange,
  type ReportFilters,
  getDateRangeFromPreset,
} from '../lib/api/reports';
import { PerformanceTab } from '../components/reports/PerformanceTab';
import { TasksTab } from '../components/reports/TasksTab';
import { WorkloadTab } from '../components/reports/WorkloadTab';
import { TrendsTab } from '../components/reports/TrendsTab';
import { ActivityTab } from '../components/reports/ActivityTab';
import { exportToCSV, exportToPDF } from '../lib/utils/reportExport';
import MainHeader from '../components/MainHeader';

type TabId = 'performance' | 'tasks' | 'workload' | 'trends' | 'activity';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ElementType;
  reportType: ReportType;
}

const TABS: Tab[] = [
  { id: 'performance', label: 'Performance', icon: BarChart3, reportType: 'performance' },
  { id: 'tasks', label: 'Tasks', icon: Clock, reportType: 'tasks' },
  { id: 'workload', label: 'Workload', icon: Users, reportType: 'workload' },
  { id: 'trends', label: 'Trends', icon: TrendingUp, reportType: 'tasks' },
  { id: 'activity', label: 'Activity', icon: Activity, reportType: 'activity' },
];

const DATE_PRESETS: { value: DateRangePreset; label: string }[] = [
  { value: '7days', label: 'Last 7 days' },
  { value: '30days', label: 'Last 30 days' },
  { value: '90days', label: 'Last 90 days' },
  { value: 'custom', label: 'Custom range' },
];

interface Member {
  id: string;
  name: string;
}

export default function Reports() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Get workspace from URL or default
  const workspaceIdParam = searchParams.get('workspace');
  const tabParam = (searchParams.get('tab') as TabId) || 'performance';

  // State
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>(workspaceIdParam || '');
  const [boards, setBoards] = useState<Board[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedBoardIds, setSelectedBoardIds] = useState<string[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [datePreset, setDatePreset] = useState<DateRangePreset>('30days');
  const [customDateRange, setCustomDateRange] = useState<DateRange | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>(tabParam);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showBoardFilter, setShowBoardFilter] = useState(false);
  const [showMemberFilter, setShowMemberFilter] = useState(false);
  const [exporting, setExporting] = useState<'csv' | 'pdf' | null>(null);

  // Permissions
  const { canViewReport, canExportReports, canViewAnyReport, loading: permissionsLoading } = usePermissions(selectedWorkspaceId);

  // Load workspaces
  useEffect(() => {
    async function loadWorkspaces() {
      try {
        const data = await fetchWorkspaces();
        setWorkspaces(data);

        // Auto-select first workspace if none selected
        if (!selectedWorkspaceId && data.length > 0) {
          setSelectedWorkspaceId(data[0].id);
        }
      } catch (err) {
        console.error('Failed to load workspaces:', err);
        setError('Failed to load workspaces');
      } finally {
        setLoading(false);
      }
    }

    loadWorkspaces();
  }, []);

  // Load boards and members when workspace changes
  useEffect(() => {
    if (!selectedWorkspaceId) return;

    async function loadWorkspaceData() {
      try {
        const [boardsData, membersData] = await Promise.all([
          fetchBoardsByWorkspace(selectedWorkspaceId),
          fetchWorkspaceMembers(selectedWorkspaceId),
        ]);

        setBoards(boardsData);
        setMembers(membersData.map((m: WorkspaceMember) => ({ id: m.id, name: m.displayName || m.email })));
        setSelectedBoardIds([]);
        setSelectedMemberIds([]);
      } catch (err) {
        console.error('Failed to load workspace data:', err);
      }
    }

    loadWorkspaceData();

    // Update URL
    setSearchParams({ workspace: selectedWorkspaceId, tab: activeTab });
  }, [selectedWorkspaceId]);

  // Update URL when tab changes
  useEffect(() => {
    if (selectedWorkspaceId) {
      setSearchParams({ workspace: selectedWorkspaceId, tab: activeTab });
    }
  }, [activeTab]);

  // Get current date range
  const dateRange = datePreset === 'custom' && customDateRange
    ? customDateRange
    : getDateRangeFromPreset(datePreset);

  // Build filters
  const filters: ReportFilters = {
    workspaceId: selectedWorkspaceId,
    boardIds: selectedBoardIds.length > 0 ? selectedBoardIds : undefined,
    memberIds: selectedMemberIds.length > 0 ? selectedMemberIds : undefined,
    dateRange,
    includeArchived: false,
  };

  // Check if user can view the active tab
  const activeTabConfig = TABS.find(t => t.id === activeTab);
  const canViewActiveTab = activeTabConfig ? canViewReport(activeTabConfig.reportType) : false;

  // Find first accessible tab
  const firstAccessibleTab = TABS.find(t => canViewReport(t.reportType));

  // Redirect to accessible tab if current is not accessible
  useEffect(() => {
    if (!permissionsLoading && !canViewActiveTab && firstAccessibleTab) {
      setActiveTab(firstAccessibleTab.id);
    }
  }, [canViewActiveTab, firstAccessibleTab, permissionsLoading]);

  const handleExportCSV = async () => {
    if (!canExportReports()) return;
    setExporting('csv');
    try {
      await exportToCSV(activeTab, filters);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(null);
    }
  };

  const handleExportPDF = async () => {
    if (!canExportReports()) return;
    setExporting('pdf');
    try {
      await exportToPDF(activeTab, filters);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(null);
    }
  };

  const toggleBoardSelection = (boardId: string) => {
    setSelectedBoardIds(prev =>
      prev.includes(boardId)
        ? prev.filter(id => id !== boardId)
        : [...prev, boardId]
    );
  };

  const toggleMemberSelection = (memberId: string) => {
    setSelectedMemberIds(prev =>
      prev.includes(memberId)
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  // Loading state
  if (loading || permissionsLoading) {
    return (
      <>
        <MainHeader />
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </>
    );
  }

  // No access to any reports
  if (!canViewAnyReport()) {
    return (
      <>
        <MainHeader />
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <AlertCircle className="h-12 w-12 text-gray-400 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            No Report Access
          </h2>
          <p className="text-gray-500 dark:text-gray-400 max-w-md">
            You don't have permission to view any reports. Please contact your workspace administrator.
          </p>
        </div>
      </>
    );
  }

  // No workspaces
  if (workspaces.length === 0) {
    return (
      <>
        <MainHeader />
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <FileText className="h-12 w-12 text-gray-400 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            No Workspaces Found
          </h2>
          <p className="text-gray-500 dark:text-gray-400">
            You need to be a member of at least one workspace to view reports.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <MainHeader />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Reports
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Analyze performance, track progress, and identify trends
            </p>
          </div>

          {/* Export Buttons */}
          {canExportReports() && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportCSV}
                disabled={!!exporting}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                {exporting === 'csv' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Export CSV
              </button>
              <button
                onClick={handleExportPDF}
                disabled={!!exporting}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {exporting === 'pdf' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
                Export PDF
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          {/* Workspace Selector */}
          <div className="flex-shrink-0">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Workspace
            </label>
            <select
              value={selectedWorkspaceId}
              onChange={(e) => setSelectedWorkspaceId(e.target.value)}
              className="block w-48 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.title}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range */}
          <div className="flex-shrink-0">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Date Range
            </label>
            <div className="flex items-center gap-2">
              <select
                value={datePreset}
                onChange={(e) => setDatePreset(e.target.value as DateRangePreset)}
                className="block rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {DATE_PRESETS.map((preset) => (
                  <option key={preset.value} value={preset.value}>
                    {preset.label}
                  </option>
                ))}
              </select>

              {datePreset === 'custom' && (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={customDateRange?.start.toISOString().split('T')[0] || ''}
                    onChange={(e) => setCustomDateRange(prev => ({
                      start: new Date(e.target.value),
                      end: prev?.end || new Date(),
                    }))}
                    className="block rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm px-3 py-2"
                  />
                  <span className="text-gray-500">to</span>
                  <input
                    type="date"
                    value={customDateRange?.end.toISOString().split('T')[0] || ''}
                    onChange={(e) => setCustomDateRange(prev => ({
                      start: prev?.start || new Date(),
                      end: new Date(e.target.value),
                    }))}
                    className="block rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm px-3 py-2"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Board Filter */}
          <div className="relative flex-shrink-0">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Boards
            </label>
            <button
              onClick={() => setShowBoardFilter(!showBoardFilter)}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              {selectedBoardIds.length === 0 ? 'All Boards' : `${selectedBoardIds.length} selected`}
              <ChevronDown className="h-4 w-4" />
            </button>

            {showBoardFilter && (
              <div className="absolute z-10 mt-1 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                <div className="p-2">
                  <button
                    onClick={() => setSelectedBoardIds([])}
                    className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                  >
                    Clear selection
                  </button>
                </div>
                <div className="border-t border-gray-200 dark:border-gray-700">
                  {boards.map((board) => (
                    <label
                      key={board.id}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedBoardIds.includes(board.id)}
                        onChange={() => toggleBoardSelection(board.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      {board.title}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Member Filter */}
          <div className="relative flex-shrink-0">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Members
            </label>
            <button
              onClick={() => setShowMemberFilter(!showMemberFilter)}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              {selectedMemberIds.length === 0 ? 'All Members' : `${selectedMemberIds.length} selected`}
              <ChevronDown className="h-4 w-4" />
            </button>

            {showMemberFilter && (
              <div className="absolute z-10 mt-1 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                <div className="p-2">
                  <button
                    onClick={() => setSelectedMemberIds([])}
                    className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                  >
                    Clear selection
                  </button>
                </div>
                <div className="border-t border-gray-200 dark:border-gray-700">
                  {members.map((member) => (
                    <label
                      key={member.id}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedMemberIds.includes(member.id)}
                        onChange={() => toggleMemberSelection(member.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      {member.name}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Date Range Display */}
          <div className="flex-shrink-0 ml-auto">
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <Calendar className="h-4 w-4" />
              <span>
                {dateRange.start.toLocaleDateString()} - {dateRange.end.toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Close dropdowns when clicking outside */}
      {(showBoardFilter || showMemberFilter) && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => {
            setShowBoardFilter(false);
            setShowMemberFilter(false);
          }}
        />
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="flex gap-4 -mb-px overflow-x-auto" aria-label="Report tabs">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const hasAccess = canViewReport(tab.reportType);

            return (
              <button
                key={tab.id}
                onClick={() => hasAccess && setActiveTab(tab.id)}
                disabled={!hasAccess}
                className={`
                  flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors
                  ${activeTab === tab.id
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : hasAccess
                      ? 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
                      : 'border-transparent text-gray-300 dark:text-gray-600 cursor-not-allowed'
                  }
                `}
                title={hasAccess ? '' : 'No permission to view this report'}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
              <AlertCircle className="h-5 w-5" />
              <span>{error}</span>
            </div>
          </div>
        )}

        {selectedWorkspaceId && canViewActiveTab && (
          <>
            {activeTab === 'performance' && <PerformanceTab filters={filters} />}
            {activeTab === 'tasks' && <TasksTab filters={filters} />}
            {activeTab === 'workload' && <WorkloadTab filters={filters} />}
            {activeTab === 'trends' && <TrendsTab filters={filters} />}
            {activeTab === 'activity' && <ActivityTab filters={filters} />}
          </>
        )}

        {selectedWorkspaceId && !canViewActiveTab && (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <AlertCircle className="h-12 w-12 text-gray-400 mb-4" />
            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No Access to This Report
            </h2>
            <p className="text-gray-500 dark:text-gray-400">
              You don't have permission to view this report type.
            </p>
          </div>
        )}
      </div>
      </div>
    </>
  );
}
