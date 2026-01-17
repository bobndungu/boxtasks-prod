import { useState, useEffect, useCallback } from 'react';
import { useConfirmDialog } from '../lib/hooks/useConfirmDialog';
import { Link, useParams } from 'react-router-dom';
import { useAuthStore } from '../lib/stores/auth';
import { formatDate as formatDateEAT } from '../lib/utils/date';
import {
  fetchMilestones,
  createMilestone,
  updateMilestone,
  deleteMilestone,
  isMilestoneOverdue,
  isMilestoneDueSoon,
  type Milestone,
  type MilestoneStatus,
  type CreateMilestoneData,
  MILESTONE_STATUS_INFO,
  MILESTONE_COLORS,
} from '../lib/api/milestones';
import { fetchGoals, type Goal } from '../lib/api/goals';
import {
  Flag,
  Plus,
  X,
  Loader2,
  Calendar,
  MoreHorizontal,
  Trash2,
  Edit2,
  ArrowLeft,
  Target,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { toast } from '../lib/stores/toast';

function Milestones() {
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const { workspaceId } = useParams<{ workspaceId: string }>();
  useAuthStore();
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  const [selectedMilestone, setSelectedMilestone] = useState<Milestone | null>(null);

  const loadData = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      const [milestonesData, goalsData] = await Promise.all([
        fetchMilestones(workspaceId),
        fetchGoals(workspaceId),
      ]);
      setMilestones(milestonesData);
      setGoals(goalsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load milestones');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateMilestone = async (data: Omit<CreateMilestoneData, 'workspaceId'>) => {
    try {
      const newMilestone = await createMilestone({ ...data, workspaceId: workspaceId! });
      setMilestones(prev => [newMilestone, ...prev]);
      setShowCreateModal(false);
      toast.success('Milestone created successfully');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create milestone');
    }
  };

  const handleUpdateMilestone = async (milestoneId: string, updates: Partial<Milestone>) => {
    try {
      const updatedMilestone = await updateMilestone(milestoneId, updates);
      setMilestones(prev => prev.map(m => (m.id === milestoneId ? updatedMilestone : m)));
      setEditingMilestone(null);
      toast.success('Milestone updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update milestone');
    }
  };

  const handleDeleteMilestone = async (milestoneId: string) => {
    const confirmed = await confirm({
      title: 'Delete Milestone',
      message: 'Are you sure you want to delete this milestone? This action cannot be undone.',
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!confirmed) return;
    try {
      await deleteMilestone(milestoneId);
      setMilestones(prev => prev.filter(m => m.id !== milestoneId));
      setSelectedMilestone(null);
      toast.success('Milestone deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete milestone');
    }
  };

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return null;
    return formatDateEAT(dateStr, 'medium');
  };

  // Group milestones by status
  const upcomingMilestones = milestones.filter(m => ['not_started', 'in_progress'].includes(m.status));
  const completedMilestones = milestones.filter(m => m.status === 'completed');
  const missedMilestones = milestones.filter(m => m.status === 'missed');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Link
                to={`/workspace/${workspaceId}`}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <Flag className="h-6 w-6 text-green-600" />
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Milestones</h1>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {milestones.length} total
              </span>
            </div>

            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              New Milestone
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-green-600" />
          </div>
        ) : error ? (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-400">
            {error}
          </div>
        ) : milestones.length === 0 ? (
          <div className="text-center py-12">
            <Flag className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No milestones yet</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Create milestones to track key checkpoints in your projects
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Plus className="h-4 w-4" />
              Create Milestone
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Upcoming Milestones */}
            {upcomingMilestones.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Upcoming ({upcomingMilestones.length})
                </h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {upcomingMilestones.map(milestone => (
                    <MilestoneCard
                      key={milestone.id}
                      milestone={milestone}
                      onSelect={() => setSelectedMilestone(milestone)}
                      onEdit={() => setEditingMilestone(milestone)}
                      onDelete={() => handleDeleteMilestone(milestone.id)}
                      formatDate={formatDate}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Completed Milestones */}
            {completedMilestones.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Completed ({completedMilestones.length})
                </h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {completedMilestones.map(milestone => (
                    <MilestoneCard
                      key={milestone.id}
                      milestone={milestone}
                      onSelect={() => setSelectedMilestone(milestone)}
                      onEdit={() => setEditingMilestone(milestone)}
                      onDelete={() => handleDeleteMilestone(milestone.id)}
                      formatDate={formatDate}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Missed Milestones */}
            {missedMilestones.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-4">
                  Missed ({missedMilestones.length})
                </h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 opacity-80">
                  {missedMilestones.map(milestone => (
                    <MilestoneCard
                      key={milestone.id}
                      milestone={milestone}
                      onSelect={() => setSelectedMilestone(milestone)}
                      onEdit={() => setEditingMilestone(milestone)}
                      onDelete={() => handleDeleteMilestone(milestone.id)}
                      formatDate={formatDate}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      {/* Create Milestone Modal */}
      {showCreateModal && (
        <MilestoneFormModal
          goals={goals}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateMilestone}
        />
      )}

      {/* Edit Milestone Modal */}
      {editingMilestone && (
        <MilestoneFormModal
          milestone={editingMilestone}
          goals={goals}
          onClose={() => setEditingMilestone(null)}
          onSubmit={(data) => handleUpdateMilestone(editingMilestone.id, data)}
        />
      )}

      {/* Milestone Detail Modal */}
      {selectedMilestone && (
        <MilestoneDetailModal
          milestone={selectedMilestone}
          onClose={() => setSelectedMilestone(null)}
          onEdit={() => {
            setSelectedMilestone(null);
            setEditingMilestone(selectedMilestone);
          }}
          onDelete={() => handleDeleteMilestone(selectedMilestone.id)}
          formatDate={formatDate}
        />
      )}
      <ConfirmDialog />
    </div>
  );
}

interface MilestoneCardProps {
  milestone: Milestone;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  formatDate: (date: string | undefined) => string | null;
}

function MilestoneCard({ milestone, onSelect, onEdit, onDelete, formatDate }: MilestoneCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const statusInfo = MILESTONE_STATUS_INFO[milestone.status];
  const isOverdue = isMilestoneOverdue(milestone);
  const isDueSoon = isMilestoneDueSoon(milestone);

  return (
    <div
      className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
      onClick={onSelect}
    >
      {/* Color bar */}
      <div className="h-2" style={{ backgroundColor: milestone.color }} />

      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <Flag className="h-4 w-4" style={{ color: milestone.color }} />
            <h3 className="font-medium text-gray-900 dark:text-white line-clamp-2">{milestone.title}</h3>
          </div>
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              <MoreHorizontal className="h-4 w-4 text-gray-500" />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-full mt-1 w-32 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                    onEdit();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <Edit2 className="h-4 w-4" />
                  Edit
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                    onDelete();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Status badge */}
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusInfo.color} ${statusInfo.bgColor} ${statusInfo.darkBgColor}`}>
          {statusInfo.label}
        </span>

        {/* Due date */}
        {milestone.dueDate && (
          <div className="flex items-center gap-1 mt-3 text-xs">
            {isOverdue ? (
              <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                <AlertTriangle className="h-3 w-3" />
                Overdue: {formatDate(milestone.dueDate)}
              </span>
            ) : isDueSoon ? (
              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <Clock className="h-3 w-3" />
                Due soon: {formatDate(milestone.dueDate)}
              </span>
            ) : (
              <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                <Calendar className="h-3 w-3" />
                {formatDate(milestone.dueDate)}
              </span>
            )}
          </div>
        )}

        {/* Linked Goal */}
        {milestone.goalName && (
          <div className="flex items-center gap-1 mt-2 text-xs text-gray-500 dark:text-gray-400">
            <Target className="h-3 w-3" />
            <span className="truncate">{milestone.goalName}</span>
          </div>
        )}
      </div>
    </div>
  );
}

type MilestoneFormData = Omit<CreateMilestoneData, 'workspaceId'>;

interface MilestoneFormModalProps {
  milestone?: Milestone;
  goals: Goal[];
  onClose: () => void;
  onSubmit: (data: MilestoneFormData) => Promise<void>;
}

function MilestoneFormModal({ milestone, goals, onClose, onSubmit }: MilestoneFormModalProps) {
  const [title, setTitle] = useState(milestone?.title || '');
  const [description, setDescription] = useState(milestone?.description || '');
  const [dueDate, setDueDate] = useState(milestone?.dueDate?.split('T')[0] || '');
  const [status, setStatus] = useState<MilestoneStatus>(milestone?.status || 'not_started');
  const [goalId, setGoalId] = useState<string>(milestone?.goalId || '');
  const [color, setColor] = useState(milestone?.color || '#519839');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim() || undefined,
        dueDate: dueDate || undefined,
        status,
        goalId: goalId || undefined,
        color,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {milestone ? 'Edit Milestone' : 'Create Milestone'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="e.g., Complete MVP by end of month"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
              placeholder="What needs to be achieved for this milestone?"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as MilestoneStatus)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {Object.entries(MILESTONE_STATUS_INFO).map(([value, info]) => (
                  <option key={value} value={value}>{info.label}</option>
                ))}
              </select>
            </div>
          </div>

          {goals.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Linked Goal (optional)
              </label>
              <select
                value={goalId}
                onChange={(e) => setGoalId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">No goal linked</option>
                {goals.map(goal => (
                  <option key={goal.id} value={goal.id}>{goal.title}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Color
            </label>
            <div className="flex gap-2">
              {MILESTONE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full ${color === c ? 'ring-2 ring-offset-2 ring-green-500' : ''}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !title.trim()}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {milestone ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface MilestoneDetailModalProps {
  milestone: Milestone;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  formatDate: (date: string | undefined) => string | null;
}

function MilestoneDetailModal({ milestone, onClose, onEdit, onDelete, formatDate }: MilestoneDetailModalProps) {
  const statusInfo = MILESTONE_STATUS_INFO[milestone.status];
  const isOverdue = isMilestoneOverdue(milestone);
  const isDueSoon = isMilestoneDueSoon(milestone);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        {/* Color header */}
        <div className="h-3 rounded-t-xl" style={{ backgroundColor: milestone.color }} />

        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Flag className="h-5 w-5" style={{ color: milestone.color }} />
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{milestone.title}</h2>
            </div>
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusInfo.color} ${statusInfo.bgColor} ${statusInfo.darkBgColor}`}>
              {statusInfo.label}
            </span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Description */}
          {milestone.description && (
            <div>
              <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Description</h4>
              <p className="text-gray-900 dark:text-white whitespace-pre-wrap">{milestone.description}</p>
            </div>
          )}

          {/* Due Date */}
          {milestone.dueDate && (
            <div>
              <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Due Date</h4>
              <div className="flex items-center gap-2">
                {isOverdue ? (
                  <span className="flex items-center gap-2 text-red-600 dark:text-red-400">
                    <AlertTriangle className="h-4 w-4" />
                    <span>Overdue: {formatDate(milestone.dueDate)}</span>
                  </span>
                ) : isDueSoon ? (
                  <span className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                    <Clock className="h-4 w-4" />
                    <span>Due soon: {formatDate(milestone.dueDate)}</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <Calendar className="h-4 w-4" />
                    <span>{formatDate(milestone.dueDate)}</span>
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Linked Goal */}
          {milestone.goalName && (
            <div>
              <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Linked Goal</h4>
              <div className="flex items-center gap-2 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <Target className="h-4 w-4 text-purple-600" />
                <span className="text-purple-900 dark:text-purple-300 font-medium">{milestone.goalName}</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-between">
          <button
            onClick={onDelete}
            className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
          <button
            onClick={onEdit}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Edit2 className="h-4 w-4" />
            Edit Milestone
          </button>
        </div>
      </div>
    </div>
  );
}

export default Milestones;
