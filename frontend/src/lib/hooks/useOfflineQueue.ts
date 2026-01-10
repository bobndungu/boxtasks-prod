import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from '../stores/toast';

/**
 * Queued action with metadata
 */
interface QueuedAction<T = unknown> {
  id: string;
  action: () => Promise<T>;
  description: string;
  timestamp: number;
  retries: number;
  maxRetries: number;
}

/**
 * Offline queue state
 */
interface OfflineQueueState {
  isOnline: boolean;
  queuedActions: QueuedAction[];
  isProcessing: boolean;
  lastSyncTime: Date | null;
}

/**
 * Options for queueing an action
 */
interface QueueOptions {
  description?: string;
  maxRetries?: number;
  immediate?: boolean; // If online, execute immediately without queueing
}

/**
 * Hook for managing offline action queue.
 * Queues actions when offline and replays them when connectivity is restored.
 *
 * Usage:
 * ```tsx
 * const { isOnline, queueAction, queuedCount, processQueue } = useOfflineQueue();
 *
 * // Queue an action
 * await queueAction(
 *   () => createCard(data),
 *   { description: 'Create card', immediate: true }
 * );
 * ```
 */
export function useOfflineQueue() {
  const [state, setState] = useState<OfflineQueueState>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    queuedActions: [],
    isProcessing: false,
    lastSyncTime: null,
  });

  const queueRef = useRef<QueuedAction[]>([]);
  const processingRef = useRef(false);
  const actionCounter = useRef(0);

  // Update queue ref when state changes
  useEffect(() => {
    queueRef.current = state.queuedActions;
  }, [state.queuedActions]);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setState((prev) => ({ ...prev, isOnline: true }));
      toast.success('Back online');
      // Automatically process queue when back online
      processQueue();
    };

    const handleOffline = () => {
      setState((prev) => ({ ...prev, isOnline: false }));
      toast.warning('You are offline. Actions will be queued.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load persisted queue from localStorage on mount
  useEffect(() => {
    try {
      const persisted = localStorage.getItem('offlineQueue');
      if (persisted) {
        const parsed = JSON.parse(persisted);
        // Note: We can't restore actual functions, so persisted queue is informational only
        // Real implementation would need to serialize action data and recreate functions
        if (Array.isArray(parsed) && parsed.length > 0) {
          console.log('Found persisted offline queue with', parsed.length, 'items');
        }
      }
    } catch (e) {
      console.error('Failed to load persisted offline queue:', e);
    }
  }, []);

  // Persist queue metadata to localStorage
  const persistQueue = useCallback(() => {
    try {
      const toStore = queueRef.current.map((action) => ({
        id: action.id,
        description: action.description,
        timestamp: action.timestamp,
        retries: action.retries,
      }));
      localStorage.setItem('offlineQueue', JSON.stringify(toStore));
    } catch (e) {
      console.error('Failed to persist offline queue:', e);
    }
  }, []);

  /**
   * Queue an action to be executed
   */
  const queueAction = useCallback(async <T>(
    action: () => Promise<T>,
    options: QueueOptions = {}
  ): Promise<T | null> => {
    const { description = 'Action', maxRetries = 3, immediate = true } = options;

    // If online and immediate mode, execute directly
    if (state.isOnline && immediate) {
      try {
        return await action();
      } catch (error) {
        // If network error while online, queue for retry
        if (error instanceof TypeError && error.message.includes('fetch')) {
          console.log('Network error detected, queueing action');
        } else {
          throw error; // Re-throw non-network errors
        }
      }
    }

    // Queue the action
    const queuedAction: QueuedAction<T> = {
      id: `action_${Date.now()}_${actionCounter.current++}`,
      action,
      description,
      timestamp: Date.now(),
      retries: 0,
      maxRetries,
    };

    setState((prev) => ({
      ...prev,
      queuedActions: [...prev.queuedActions, queuedAction as QueuedAction],
    }));

    persistQueue();

    if (!state.isOnline) {
      toast.info(`"${description}" queued for when you're back online`);
    }

    return null;
  }, [state.isOnline, persistQueue]);

  /**
   * Process all queued actions
   */
  const processQueue = useCallback(async () => {
    if (processingRef.current || !state.isOnline || queueRef.current.length === 0) {
      return;
    }

    processingRef.current = true;
    setState((prev) => ({ ...prev, isProcessing: true }));

    const queue = [...queueRef.current];
    const results: { success: string[]; failed: string[] } = { success: [], failed: [] };

    for (const action of queue) {
      try {
        await action.action();
        results.success.push(action.description);

        // Remove from queue
        setState((prev) => ({
          ...prev,
          queuedActions: prev.queuedActions.filter((a) => a.id !== action.id),
        }));
      } catch (error) {
        console.error(`Failed to process queued action "${action.description}":`, error);

        // Increment retry count
        if (action.retries < action.maxRetries) {
          setState((prev) => ({
            ...prev,
            queuedActions: prev.queuedActions.map((a) =>
              a.id === action.id ? { ...a, retries: a.retries + 1 } : a
            ),
          }));
        } else {
          // Max retries reached, remove from queue
          results.failed.push(action.description);
          setState((prev) => ({
            ...prev,
            queuedActions: prev.queuedActions.filter((a) => a.id !== action.id),
          }));
        }
      }
    }

    processingRef.current = false;
    setState((prev) => ({
      ...prev,
      isProcessing: false,
      lastSyncTime: new Date(),
    }));

    persistQueue();

    // Show results
    if (results.success.length > 0) {
      toast.success(`Synced ${results.success.length} queued action${results.success.length > 1 ? 's' : ''}`);
    }
    if (results.failed.length > 0) {
      toast.error(`Failed to sync ${results.failed.length} action${results.failed.length > 1 ? 's' : ''}`);
    }
  }, [state.isOnline, persistQueue]);

  /**
   * Clear all queued actions
   */
  const clearQueue = useCallback(() => {
    setState((prev) => ({
      ...prev,
      queuedActions: [],
    }));
    localStorage.removeItem('offlineQueue');
    toast.info('Offline queue cleared');
  }, []);

  /**
   * Remove a specific action from the queue
   */
  const removeFromQueue = useCallback((actionId: string) => {
    setState((prev) => ({
      ...prev,
      queuedActions: prev.queuedActions.filter((a) => a.id !== actionId),
    }));
    persistQueue();
  }, [persistQueue]);

  return {
    isOnline: state.isOnline,
    queuedActions: state.queuedActions,
    queuedCount: state.queuedActions.length,
    isProcessing: state.isProcessing,
    lastSyncTime: state.lastSyncTime,
    queueAction,
    processQueue,
    clearQueue,
    removeFromQueue,
  };
}

export default useOfflineQueue;
