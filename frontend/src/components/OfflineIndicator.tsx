import { CloudOff, Cloud, RefreshCw, Loader2 } from 'lucide-react';
import { useOfflineQueue } from '../lib/hooks/useOfflineQueue';

interface OfflineIndicatorProps {
  showQueueCount?: boolean;
  className?: string;
}

/**
 * Indicator component showing offline status and queued actions.
 */
export function OfflineIndicator({ showQueueCount = true, className = '' }: OfflineIndicatorProps) {
  const { isOnline, queuedCount, isProcessing, processQueue } = useOfflineQueue();

  // Don't show anything if online and no queued items
  if (isOnline && queuedCount === 0) {
    return null;
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {!isOnline ? (
        <div
          className="flex items-center gap-1.5 px-2 py-1 bg-amber-100 text-amber-800 rounded-md text-sm"
          title="You are offline. Actions will be queued."
        >
          <CloudOff className="h-4 w-4" />
          <span>Offline</span>
        </div>
      ) : isProcessing ? (
        <div
          className="flex items-center gap-1.5 px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-sm"
          title="Syncing queued actions..."
        >
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Syncing...</span>
        </div>
      ) : queuedCount > 0 ? (
        <button
          onClick={() => processQueue()}
          className="flex items-center gap-1.5 px-2 py-1 bg-amber-100 text-amber-800 hover:bg-amber-200 rounded-md text-sm transition-colors"
          title={`${queuedCount} queued action${queuedCount > 1 ? 's' : ''} pending. Click to sync.`}
        >
          <RefreshCw className="h-4 w-4" />
          {showQueueCount && <span>{queuedCount} pending</span>}
        </button>
      ) : null}
    </div>
  );
}

/**
 * Full offline banner for more prominent display.
 */
export function OfflineBanner() {
  const { isOnline, queuedCount, isProcessing, processQueue } = useOfflineQueue();

  if (isOnline && queuedCount === 0) {
    return null;
  }

  return (
    <div
      className={`px-4 py-2 text-sm flex items-center justify-between ${
        !isOnline
          ? 'bg-amber-500 text-white'
          : 'bg-blue-500 text-white'
      }`}
    >
      <div className="flex items-center gap-2">
        {!isOnline ? (
          <>
            <CloudOff className="h-4 w-4" />
            <span>
              You are offline. {queuedCount > 0 && `${queuedCount} action${queuedCount > 1 ? 's' : ''} will be synced when you're back online.`}
            </span>
          </>
        ) : (
          <>
            <Cloud className="h-4 w-4" />
            <span>
              {isProcessing
                ? 'Syncing queued actions...'
                : `${queuedCount} action${queuedCount > 1 ? 's' : ''} pending sync.`}
            </span>
          </>
        )}
      </div>

      {isOnline && queuedCount > 0 && !isProcessing && (
        <button
          onClick={() => processQueue()}
          className="flex items-center gap-1 px-2 py-1 bg-white/20 hover:bg-white/30 rounded text-xs transition-colors"
        >
          <RefreshCw className="h-3 w-3" />
          Sync now
        </button>
      )}
    </div>
  );
}

export default OfflineIndicator;
