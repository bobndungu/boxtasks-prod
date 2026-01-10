import { useState, useCallback, useRef } from 'react';
import { toast } from '../stores/toast';

/**
 * Operation types for tracking pending operations
 */
interface PendingOperation<T> {
  id: string;
  previousState: T;
  timestamp: number;
}

/**
 * Options for optimistic operations
 */
interface OptimisticOptions {
  /** Error message to show if the operation fails */
  errorMessage?: string;
  /** Success message to show when operation completes */
  successMessage?: string;
  /** Whether to show toast notifications */
  showToasts?: boolean;
  /** Custom rollback handler */
  onRollback?: () => void;
}

/**
 * Hook for managing optimistic UI updates with automatic rollback on failure.
 *
 * Usage:
 * ```tsx
 * const { execute, isPending, rollback } = useOptimistic<Card[]>();
 *
 * // Optimistic card creation
 * execute({
 *   optimisticUpdate: (currentCards) => [...currentCards, tempCard],
 *   apiCall: () => createCard(data),
 *   onSuccess: (result) => updateState(result),
 *   options: { errorMessage: 'Failed to create card' }
 * });
 * ```
 */
export function useOptimistic<T>() {
  const [isPending, setIsPending] = useState(false);
  const pendingOps = useRef<Map<string, PendingOperation<T>>>(new Map());
  const operationCounter = useRef(0);

  /**
   * Execute an optimistic operation
   */
  const execute = useCallback(async <R>(params: {
    /** Current state to backup for rollback */
    currentState: T;
    /** Function to apply the optimistic update - called immediately */
    optimisticUpdate: (current: T) => T;
    /** The actual API call to make */
    apiCall: () => Promise<R>;
    /** Callback when API call succeeds */
    onSuccess?: (result: R) => void;
    /** Function to rollback to previous state */
    rollbackState: (previous: T) => void;
    /** Additional options */
    options?: OptimisticOptions;
  }): Promise<R | null> => {
    const { currentState, optimisticUpdate, apiCall, onSuccess, rollbackState, options = {} } = params;
    const { errorMessage = 'Operation failed', showToasts = true, onRollback } = options;

    // Generate unique operation ID
    const opId = `op_${Date.now()}_${operationCounter.current++}`;

    // Store previous state for potential rollback
    pendingOps.current.set(opId, {
      id: opId,
      previousState: currentState,
      timestamp: Date.now(),
    });

    setIsPending(true);

    // Apply optimistic update immediately
    const newState = optimisticUpdate(currentState);
    rollbackState(newState);

    try {
      // Make the actual API call
      const result = await apiCall();

      // Success - clear pending operation and call success handler
      pendingOps.current.delete(opId);

      if (onSuccess) {
        onSuccess(result);
      }

      setIsPending(pendingOps.current.size > 0);
      return result;
    } catch (error) {
      // Failure - rollback to previous state
      const pendingOp = pendingOps.current.get(opId);
      if (pendingOp) {
        rollbackState(pendingOp.previousState);
        pendingOps.current.delete(opId);
      }

      // Show error toast
      if (showToasts) {
        const message = error instanceof Error ? error.message : errorMessage;
        toast.error(message);
      }

      // Call custom rollback handler
      if (onRollback) {
        onRollback();
      }

      setIsPending(pendingOps.current.size > 0);
      return null;
    }
  }, []);

  /**
   * Manually rollback all pending operations
   */
  const rollbackAll = useCallback((rollbackState: (previous: T) => void) => {
    const ops = Array.from(pendingOps.current.values());
    if (ops.length > 0) {
      // Rollback to the oldest state
      const oldest = ops.sort((a, b) => a.timestamp - b.timestamp)[0];
      rollbackState(oldest.previousState);
      pendingOps.current.clear();
      setIsPending(false);
    }
  }, []);

  /**
   * Check if a specific operation is pending
   */
  const isOperationPending = useCallback((opId: string) => {
    return pendingOps.current.has(opId);
  }, []);

  /**
   * Get count of pending operations
   */
  const pendingCount = pendingOps.current.size;

  return {
    execute,
    isPending,
    pendingCount,
    rollbackAll,
    isOperationPending,
  };
}

/**
 * Hook for optimistic state management with a specific state type.
 * Simpler version for managing a single piece of state optimistically.
 */
export function useOptimisticState<T>(initialState: T) {
  const [state, setState] = useState<T>(initialState);
  const [previousState, setPreviousState] = useState<T | null>(null);
  const [isPending, setIsPending] = useState(false);

  /**
   * Apply an optimistic update
   */
  const optimisticUpdate = useCallback(
    async <R>(
      newState: T | ((prev: T) => T),
      apiCall: () => Promise<R>,
      options: OptimisticOptions = {}
    ): Promise<R | null> => {
      const { errorMessage = 'Operation failed', showToasts = true } = options;

      // Save current state for rollback
      setPreviousState(state);
      setIsPending(true);

      // Apply optimistic update
      const updatedState = typeof newState === 'function'
        ? (newState as (prev: T) => T)(state)
        : newState;
      setState(updatedState);

      try {
        const result = await apiCall();
        setPreviousState(null);
        setIsPending(false);
        return result;
      } catch (error) {
        // Rollback
        if (previousState !== null) {
          setState(previousState);
        }
        setPreviousState(null);
        setIsPending(false);

        if (showToasts) {
          const message = error instanceof Error ? error.message : errorMessage;
          toast.error(message);
        }
        return null;
      }
    },
    [state, previousState]
  );

  /**
   * Manually rollback to previous state
   */
  const rollback = useCallback(() => {
    if (previousState !== null) {
      setState(previousState);
      setPreviousState(null);
      setIsPending(false);
    }
  }, [previousState]);

  return {
    state,
    setState,
    optimisticUpdate,
    rollback,
    isPending,
    previousState,
  };
}

/**
 * Hook for managing optimistic Map operations (like cardsByList)
 */
export function useOptimisticMap<K, V>() {
  const { execute, isPending, pendingCount } = useOptimistic<Map<K, V>>();

  /**
   * Optimistically set a value in the map
   */
  const optimisticSet = useCallback(
    async <R>(params: {
      currentMap: Map<K, V>;
      key: K;
      value: V;
      apiCall: () => Promise<R>;
      setMap: (map: Map<K, V>) => void;
      onSuccess?: (result: R) => void;
      options?: OptimisticOptions;
    }): Promise<R | null> => {
      const { currentMap, key, value, apiCall, setMap, onSuccess, options } = params;

      return execute({
        currentState: currentMap,
        optimisticUpdate: (map) => {
          const newMap = new Map(map);
          newMap.set(key, value);
          return newMap;
        },
        apiCall,
        onSuccess,
        rollbackState: setMap,
        options,
      });
    },
    [execute]
  );

  /**
   * Optimistically delete a key from the map
   */
  const optimisticDelete = useCallback(
    async <R>(params: {
      currentMap: Map<K, V>;
      key: K;
      apiCall: () => Promise<R>;
      setMap: (map: Map<K, V>) => void;
      onSuccess?: (result: R) => void;
      options?: OptimisticOptions;
    }): Promise<R | null> => {
      const { currentMap, key, apiCall, setMap, onSuccess, options } = params;

      return execute({
        currentState: currentMap,
        optimisticUpdate: (map) => {
          const newMap = new Map(map);
          newMap.delete(key);
          return newMap;
        },
        apiCall,
        onSuccess,
        rollbackState: setMap,
        options,
      });
    },
    [execute]
  );

  /**
   * Optimistically update a value in the map
   */
  const optimisticUpdate = useCallback(
    async <R>(params: {
      currentMap: Map<K, V>;
      key: K;
      updater: (current: V | undefined) => V;
      apiCall: () => Promise<R>;
      setMap: (map: Map<K, V>) => void;
      onSuccess?: (result: R) => void;
      options?: OptimisticOptions;
    }): Promise<R | null> => {
      const { currentMap, key, updater, apiCall, setMap, onSuccess, options } = params;

      return execute({
        currentState: currentMap,
        optimisticUpdate: (map) => {
          const newMap = new Map(map);
          newMap.set(key, updater(map.get(key)));
          return newMap;
        },
        apiCall,
        onSuccess,
        rollbackState: setMap,
        options,
      });
    },
    [execute]
  );

  return {
    optimisticSet,
    optimisticDelete,
    optimisticUpdate,
    isPending,
    pendingCount,
  };
}

/**
 * Hook for managing optimistic array operations
 */
export function useOptimisticArray<T extends { id: string }>() {
  const { execute, isPending, pendingCount } = useOptimistic<T[]>();

  /**
   * Optimistically add an item to the array
   */
  const optimisticAdd = useCallback(
    async <R>(params: {
      currentArray: T[];
      item: T;
      apiCall: () => Promise<R>;
      setArray: (arr: T[]) => void;
      onSuccess?: (result: R) => void;
      options?: OptimisticOptions;
    }): Promise<R | null> => {
      const { currentArray, item, apiCall, setArray, onSuccess, options } = params;

      return execute({
        currentState: currentArray,
        optimisticUpdate: (arr) => [...arr, item],
        apiCall,
        onSuccess,
        rollbackState: setArray,
        options,
      });
    },
    [execute]
  );

  /**
   * Optimistically remove an item from the array
   */
  const optimisticRemove = useCallback(
    async <R>(params: {
      currentArray: T[];
      itemId: string;
      apiCall: () => Promise<R>;
      setArray: (arr: T[]) => void;
      onSuccess?: (result: R) => void;
      options?: OptimisticOptions;
    }): Promise<R | null> => {
      const { currentArray, itemId, apiCall, setArray, onSuccess, options } = params;

      return execute({
        currentState: currentArray,
        optimisticUpdate: (arr) => arr.filter((item) => item.id !== itemId),
        apiCall,
        onSuccess,
        rollbackState: setArray,
        options,
      });
    },
    [execute]
  );

  /**
   * Optimistically update an item in the array
   */
  const optimisticUpdate = useCallback(
    async <R>(params: {
      currentArray: T[];
      itemId: string;
      updater: (item: T) => T;
      apiCall: () => Promise<R>;
      setArray: (arr: T[]) => void;
      onSuccess?: (result: R) => void;
      options?: OptimisticOptions;
    }): Promise<R | null> => {
      const { currentArray, itemId, updater, apiCall, setArray, onSuccess, options } = params;

      return execute({
        currentState: currentArray,
        optimisticUpdate: (arr) =>
          arr.map((item) => (item.id === itemId ? updater(item) : item)),
        apiCall,
        onSuccess,
        rollbackState: setArray,
        options,
      });
    },
    [execute]
  );

  /**
   * Optimistically reorder items in the array
   */
  const optimisticReorder = useCallback(
    async <R>(params: {
      currentArray: T[];
      fromIndex: number;
      toIndex: number;
      apiCall: () => Promise<R>;
      setArray: (arr: T[]) => void;
      onSuccess?: (result: R) => void;
      options?: OptimisticOptions;
    }): Promise<R | null> => {
      const { currentArray, fromIndex, toIndex, apiCall, setArray, onSuccess, options } = params;

      return execute({
        currentState: currentArray,
        optimisticUpdate: (arr) => {
          const newArr = [...arr];
          const [removed] = newArr.splice(fromIndex, 1);
          newArr.splice(toIndex, 0, removed);
          return newArr;
        },
        apiCall,
        onSuccess,
        rollbackState: setArray,
        options,
      });
    },
    [execute]
  );

  return {
    optimisticAdd,
    optimisticRemove,
    optimisticUpdate,
    optimisticReorder,
    isPending,
    pendingCount,
  };
}

export default useOptimistic;
