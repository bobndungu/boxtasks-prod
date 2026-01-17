import { useState, useEffect, useCallback } from 'react';
import { useConfirmDialog } from '../lib/hooks/useConfirmDialog';
import {
  Clock,
  Play,
  Square,
  Plus,
  Trash2,
  Loader2,
  ChevronDown,
  ChevronUp,
  Edit2,
  Check,
  X,
  DollarSign,
} from 'lucide-react';
import {
  fetchTimeEntriesByCard,
  startTimeEntry,
  stopTimeEntry,
  createTimeEntry,
  updateTimeEntry,
  deleteTimeEntry,
  getRunningTimeEntries,
  formatDuration,
  type TimeEntry,
} from '../lib/api/timeTracking';
import { toast } from '../lib/stores/toast';
import { useAuthStore } from '../lib/stores/auth';
import { formatDateShort, formatTime } from '../lib/utils/date';

interface TimeTrackerProps {
  cardId: string;
  cardTitle: string;
}

export function TimeTracker({ cardId, cardTitle }: TimeTrackerProps) {
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [runningEntry, setRunningEntry] = useState<TimeEntry | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  // Auth store for current user context
  useAuthStore();

  // Form state for manual entry
  const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0]);
  const [manualStartTime, setManualStartTime] = useState('09:00');
  const [manualEndTime, setManualEndTime] = useState('10:00');
  const [manualDescription, setManualDescription] = useState('');
  const [manualBillable, setManualBillable] = useState(false);

  // Edit form state
  const [editDuration, setEditDuration] = useState(0);
  const [editDescription, setEditDescription] = useState('');
  const [editBillable, setEditBillable] = useState(false);

  // Load time entries
  const loadEntries = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchTimeEntriesByCard(cardId);
      setEntries(data);

      // Check for running entry
      const running = data.find((e) => !e.endTime);
      if (running) {
        setRunningEntry(running);
      }
    } catch (error) {
      console.error('Error loading time entries:', error);
      toast.error('Failed to load time entries');
    } finally {
      setLoading(false);
    }
  }, [cardId]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  // Check for any running entries on this card
  useEffect(() => {
    const checkRunning = async () => {
      try {
        const running = await getRunningTimeEntries();
        const cardRunning = running.find((e) => e.cardId === cardId);
        if (cardRunning) {
          setRunningEntry(cardRunning);
        }
      } catch {
        // Ignore errors
      }
    };
    checkRunning();
  }, [cardId]);

  // Update elapsed time for running timer
  useEffect(() => {
    if (!runningEntry) {
      setElapsedTime(0);
      return;
    }

    const startTime = new Date(runningEntry.startTime).getTime();
    const updateElapsed = () => {
      const now = Date.now();
      setElapsedTime(Math.floor((now - startTime) / 1000));
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [runningEntry]);

  // Start timer
  const handleStart = async () => {
    try {
      setSaving(true);
      const entry = await startTimeEntry({
        cardId,
        description: `Working on: ${cardTitle}`,
      });
      setRunningEntry(entry);
      setEntries((prev) => [entry, ...prev]);
      toast.success('Timer started');
    } catch (error) {
      console.error('Error starting timer:', error);
      toast.error('Failed to start timer');
    } finally {
      setSaving(false);
    }
  };

  // Stop timer
  const handleStop = async () => {
    if (!runningEntry) return;

    try {
      setSaving(true);
      const updated = await stopTimeEntry(runningEntry.id);
      setRunningEntry(null);
      setEntries((prev) =>
        prev.map((e) => (e.id === updated.id ? updated : e))
      );
      toast.success(`Timer stopped: ${formatDuration(updated.duration)}`);
    } catch (error) {
      console.error('Error stopping timer:', error);
      toast.error('Failed to stop timer');
    } finally {
      setSaving(false);
    }
  };

  // Add manual entry
  const handleAddManual = async () => {
    try {
      setSaving(true);
      const startDateTime = `${manualDate}T${manualStartTime}:00`;
      const endDateTime = `${manualDate}T${manualEndTime}:00`;

      const entry = await createTimeEntry({
        cardId,
        startTime: startDateTime,
        endTime: endDateTime,
        description: manualDescription || undefined,
        billable: manualBillable,
      });

      setEntries((prev) => [entry, ...prev]);
      setShowAddForm(false);
      setManualDescription('');
      setManualBillable(false);
      toast.success('Time entry added');
    } catch (error) {
      console.error('Error adding time entry:', error);
      toast.error('Failed to add time entry');
    } finally {
      setSaving(false);
    }
  };

  // Start editing
  const startEditing = (entry: TimeEntry) => {
    setEditingId(entry.id);
    setEditDuration(entry.duration);
    setEditDescription(entry.description || '');
    setEditBillable(entry.billable);
  };

  // Save edit
  const handleSaveEdit = async (id: string) => {
    try {
      setSaving(true);
      const updated = await updateTimeEntry(id, {
        duration: editDuration,
        description: editDescription,
        billable: editBillable,
      });
      setEntries((prev) =>
        prev.map((e) => (e.id === id ? updated : e))
      );
      setEditingId(null);
      toast.success('Time entry updated');
    } catch (error) {
      console.error('Error updating time entry:', error);
      toast.error('Failed to update time entry');
    } finally {
      setSaving(false);
    }
  };

  // Delete entry
  const handleDelete = async (id: string) => {
    const confirmed = await confirm({
      title: 'Delete Time Entry',
      message: 'Are you sure you want to delete this time entry? This action cannot be undone.',
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!confirmed) return;

    try {
      await deleteTimeEntry(id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
      if (runningEntry?.id === id) {
        setRunningEntry(null);
      }
      toast.success('Time entry deleted');
    } catch (error) {
      console.error('Error deleting time entry:', error);
      toast.error('Failed to delete time entry');
    }
  };

  // Calculate total time
  const totalTime = entries.reduce((sum, e) => sum + e.duration, 0);
  const billableTime = entries.filter((e) => e.billable).reduce((sum, e) => sum + e.duration, 0);

  // Format elapsed time
  const formatElapsed = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
        >
          <Clock className="w-4 h-4" />
          Time Tracking
          {expanded ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {formatDuration(totalTime)} total
          {billableTime > 0 && (
            <span className="ml-2 text-green-600 dark:text-green-400">
              ({formatDuration(billableTime)} billable)
            </span>
          )}
        </div>
      </div>

      {/* Timer Controls */}
      <div className="flex items-center gap-2 mb-3">
        {runningEntry ? (
          <>
            <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="font-mono text-green-700 dark:text-green-400">
                {formatElapsed(elapsedTime)}
              </span>
            </div>
            <button
              onClick={handleStop}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Square className="w-4 h-4 fill-current" />
              )}
              Stop
            </button>
          </>
        ) : (
          <>
            <button
              onClick={handleStart}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4 fill-current" />
              )}
              Start Timer
            </button>
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <Plus className="w-4 h-4" />
              Add Manual
            </button>
          </>
        )}
      </div>

      {/* Manual Entry Form */}
      {showAddForm && (
        <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Add Time Entry
          </h4>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                Date
              </label>
              <input
                type="date"
                value={manualDate}
                onChange={(e) => setManualDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                Start Time
              </label>
              <input
                type="time"
                value={manualStartTime}
                onChange={(e) => setManualStartTime(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                End Time
              </label>
              <input
                type="time"
                value={manualEndTime}
                onChange={(e) => setManualEndTime(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>
          <div className="mb-3">
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              Description
            </label>
            <input
              type="text"
              value={manualDescription}
              onChange={(e) => setManualDescription(e.target.value)}
              placeholder="What did you work on?"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={manualBillable}
                onChange={(e) => setManualBillable(e.target.checked)}
                className="rounded border-gray-300 text-blue-600"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Billable</span>
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleAddManual}
                disabled={saving}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                Add Entry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Time Entries List */}
      {expanded && (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {entries.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
              No time entries yet
            </p>
          ) : (
            entries.map((entry) => (
              <div
                key={entry.id}
                className={`p-3 rounded-lg border ${
                  !entry.endTime
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                    : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                }`}
              >
                {editingId === entry.id ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-500 dark:text-gray-400">
                        Duration (min):
                      </label>
                      <input
                        type="number"
                        value={editDuration}
                        onChange={(e) => setEditDuration(parseInt(e.target.value) || 0)}
                        min={0}
                        className="w-20 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <input
                      type="text"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Description"
                      className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editBillable}
                          onChange={(e) => setEditBillable(e.target.checked)}
                          className="rounded border-gray-300 text-blue-600"
                        />
                        <span className="text-xs text-gray-700 dark:text-gray-300">Billable</span>
                      </label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditingId(null)}
                          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleSaveEdit(entry.id)}
                          disabled={saving}
                          className="p-1 text-green-600 hover:text-green-700"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {entry.endTime ? formatDuration(entry.duration) : 'Running...'}
                        </span>
                        {entry.billable && (
                          <DollarSign className="w-3 h-3 text-green-600 dark:text-green-400" />
                        )}
                        {!entry.endTime && (
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        )}
                      </div>
                      {entry.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {entry.description}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        {formatDateShort(entry.startTime)}{' '}
                        {formatTime(entry.startTime)}
                        {entry.endTime && (
                          <>
                            {' - '}
                            {formatTime(entry.endTime)}
                          </>
                        )}
                        {' • '}
                        {entry.userName}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {entry.endTime && (
                        <button
                          onClick={() => startEditing(entry)}
                          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(entry.id)}
                        className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
      <ConfirmDialog />
    </div>
  );
}
