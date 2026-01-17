import { useState, useEffect, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuthStore } from '../lib/stores/auth';
import { formatDate as formatDateEAT } from '../lib/utils/date';
import {
  fetchGoals,
  createGoal,
  updateGoal,
  deleteGoal,
  type Goal,
  type GoalStatus,
  type CreateGoalData,
  GOAL_STATUS_INFO,
  GOAL_COLORS,
  calculateProgressFromCards,
} from '../lib/api/goals';
import {
  Target,
  Plus,
  X,
  Loader2,
  Calendar,
  CheckCircle2,
  AlertCircle,
  MoreHorizontal,
  Trash2,
  Edit2,
  ArrowLeft,
  Link2,
} from 'lucide-react';
import { toast } from '../lib/stores/toast';

function Goals() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  useAuthStore();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);

  const loadGoals = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchGoals(workspaceId);
      setGoals(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load goals');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    loadGoals();
  }, [loadGoals]);

  const handleCreateGoal = async (data: Omit<CreateGoalData, 'workspaceId'>) => {
    try {
      const newGoal = await createGoal({ ...data, workspaceId: workspaceId! });
      setGoals(prev => [newGoal, ...prev]);
      setShowCreateModal(false);
      toast.success('Goal created successfully');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create goal');
    }
  };

  const handleUpdateGoal = async (goalId: string, updates: Partial<Goal>) => {
    try {
      const updatedGoal = await updateGoal(goalId, updates);
      setGoals(prev => prev.map(g => (g.id === goalId ? updatedGoal : g)));
      setEditingGoal(null);
      toast.success('Goal updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update goal');
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    if (!confirm('Are you sure you want to delete this goal?')) return;
    try {
      await deleteGoal(goalId);
      setGoals(prev => prev.filter(g => g.id !== goalId));
      setSelectedGoal(null);
      toast.success('Goal deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete goal');
    }
  };

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return null;
    return formatDateEAT(dateStr, 'medium');
  };

  // Group goals by status
  const activeGoals = goals.filter(g => ['not_started', 'in_progress', 'at_risk'].includes(g.status));
  const completedGoals = goals.filter(g => g.status === 'completed');
  const cancelledGoals = goals.filter(g => g.status === 'cancelled');

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
              <Target className="h-6 w-6 text-purple-600" />
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Goals</h1>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {goals.length} total
              </span>
            </div>

            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              New Goal
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
          </div>
        ) : error ? (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-400">
            {error}
          </div>
        ) : goals.length === 0 ? (
          <div className="text-center py-12">
            <Target className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No goals yet</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Create your first goal to track progress across multiple cards
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              <Plus className="h-4 w-4" />
              Create Goal
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Active Goals */}
            {activeGoals.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Active Goals ({activeGoals.length})
                </h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {activeGoals.map(goal => (
                    <GoalCard
                      key={goal.id}
                      goal={goal}
                      onSelect={() => setSelectedGoal(goal)}
                      onEdit={() => setEditingGoal(goal)}
                      onDelete={() => handleDeleteGoal(goal.id)}
                      formatDate={formatDate}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Completed Goals */}
            {completedGoals.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Completed ({completedGoals.length})
                </h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {completedGoals.map(goal => (
                    <GoalCard
                      key={goal.id}
                      goal={goal}
                      onSelect={() => setSelectedGoal(goal)}
                      onEdit={() => setEditingGoal(goal)}
                      onDelete={() => handleDeleteGoal(goal.id)}
                      formatDate={formatDate}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Cancelled Goals */}
            {cancelledGoals.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-gray-500 dark:text-gray-400 mb-4">
                  Cancelled ({cancelledGoals.length})
                </h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 opacity-60">
                  {cancelledGoals.map(goal => (
                    <GoalCard
                      key={goal.id}
                      goal={goal}
                      onSelect={() => setSelectedGoal(goal)}
                      onEdit={() => setEditingGoal(goal)}
                      onDelete={() => handleDeleteGoal(goal.id)}
                      formatDate={formatDate}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      {/* Create Goal Modal */}
      {showCreateModal && (
        <GoalFormModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateGoal}
        />
      )}

      {/* Edit Goal Modal */}
      {editingGoal && (
        <GoalFormModal
          goal={editingGoal}
          onClose={() => setEditingGoal(null)}
          onSubmit={(data) => handleUpdateGoal(editingGoal.id, data)}
        />
      )}

      {/* Goal Detail Modal */}
      {selectedGoal && (
        <GoalDetailModal
          goal={selectedGoal}
          onClose={() => setSelectedGoal(null)}
          onEdit={() => {
            setSelectedGoal(null);
            setEditingGoal(selectedGoal);
          }}
          onDelete={() => handleDeleteGoal(selectedGoal.id)}
          formatDate={formatDate}
        />
      )}
    </div>
  );
}

interface GoalCardProps {
  goal: Goal;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  formatDate: (date: string | undefined) => string | null;
}

function GoalCard({ goal, onSelect, onEdit, onDelete, formatDate }: GoalCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const statusInfo = GOAL_STATUS_INFO[goal.status];

  return (
    <div
      className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
      onClick={onSelect}
    >
      {/* Color bar */}
      <div className="h-2" style={{ backgroundColor: goal.color }} />

      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-medium text-gray-900 dark:text-white line-clamp-2">{goal.title}</h3>
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
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusInfo.color} ${statusInfo.bgColor} dark:bg-opacity-20`}>
          {statusInfo.label}
        </span>

        {/* Progress bar */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
            <span>Progress</span>
            <span>{goal.progress}%</span>
          </div>
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${goal.progress}%`,
                backgroundColor: goal.color,
              }}
            />
          </div>
        </div>

        {/* Target date & linked cards */}
        <div className="flex items-center justify-between mt-3 text-xs text-gray-500 dark:text-gray-400">
          {goal.targetDate && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDate(goal.targetDate)}
            </span>
          )}
          {goal.linkedCards && goal.linkedCards.length > 0 && (
            <span className="flex items-center gap-1">
              <Link2 className="h-3 w-3" />
              {goal.linkedCards.length} cards
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

type GoalFormData = Omit<CreateGoalData, 'workspaceId'>;

interface GoalFormModalProps {
  goal?: Goal;
  onClose: () => void;
  onSubmit: (data: GoalFormData) => Promise<void>;
}

function GoalFormModal({ goal, onClose, onSubmit }: GoalFormModalProps) {
  const [title, setTitle] = useState(goal?.title || '');
  const [description, setDescription] = useState(goal?.description || '');
  const [targetDate, setTargetDate] = useState(goal?.targetDate?.split('T')[0] || '');
  const [status, setStatus] = useState<GoalStatus>(goal?.status || 'not_started');
  const [progress, setProgress] = useState(goal?.progress || 0);
  const [color, setColor] = useState(goal?.color || '#0079BF');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim() || undefined,
        targetDate: targetDate || undefined,
        status,
        progress,
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
            {goal ? 'Edit Goal' : 'Create Goal'}
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
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="e.g., Launch new feature by Q2"
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
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
              placeholder="What do you want to achieve?"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Target Date
              </label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as GoalStatus)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {Object.entries(GOAL_STATUS_INFO).map(([value, info]) => (
                  <option key={value} value={value}>{info.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Progress: {progress}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={progress}
              onChange={(e) => setProgress(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Color
            </label>
            <div className="flex gap-2">
              {GOAL_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full ${color === c ? 'ring-2 ring-offset-2 ring-purple-500' : ''}`}
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
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {goal ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface GoalDetailModalProps {
  goal: Goal;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  formatDate: (date: string | undefined) => string | null;
}

function GoalDetailModal({ goal, onClose, onEdit, onDelete, formatDate }: GoalDetailModalProps) {
  const statusInfo = GOAL_STATUS_INFO[goal.status];
  const calculatedProgress = calculateProgressFromCards(goal.linkedCards);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        {/* Color header */}
        <div className="h-3 rounded-t-xl" style={{ backgroundColor: goal.color }} />

        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{goal.title}</h2>
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mt-2 ${statusInfo.color} ${statusInfo.bgColor} dark:bg-opacity-20`}>
              {statusInfo.label}
            </span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Progress */}
          <div>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-gray-600 dark:text-gray-400">Progress</span>
              <span className="font-medium text-gray-900 dark:text-white">{goal.progress}%</span>
            </div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${goal.progress}%`,
                  backgroundColor: goal.color,
                }}
              />
            </div>
            {goal.linkedCards && goal.linkedCards.length > 0 && calculatedProgress !== goal.progress && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Based on linked cards: {calculatedProgress}%
              </p>
            )}
          </div>

          {/* Description */}
          {goal.description && (
            <div>
              <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Description</h4>
              <p className="text-gray-900 dark:text-white whitespace-pre-wrap">{goal.description}</p>
            </div>
          )}

          {/* Target Date */}
          {goal.targetDate && (
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
              <Calendar className="h-4 w-4" />
              <span>Target: {formatDate(goal.targetDate)}</span>
            </div>
          )}

          {/* Linked Cards */}
          {goal.linkedCards && goal.linkedCards.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                Linked Cards ({goal.linkedCards.length})
              </h4>
              <div className="space-y-2">
                {goal.linkedCards.map((card) => (
                  <div
                    key={card.id}
                    className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                  >
                    {card.completed ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    )}
                    <span className={`text-sm ${card.completed ? 'line-through text-gray-500' : 'text-gray-900 dark:text-white'}`}>
                      {card.title}
                    </span>
                  </div>
                ))}
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
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            <Edit2 className="h-4 w-4" />
            Edit Goal
          </button>
        </div>
      </div>
    </div>
  );
}

export default Goals;
