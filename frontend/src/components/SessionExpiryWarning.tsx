import { useEffect, useState } from 'react';
import { useAuthStore } from '../lib/stores/auth';
import { getTimeUntilExpiry, refreshAccessToken } from '../lib/api/client';

export function SessionExpiryWarning() {
  const { sessionExpiring, sessionExpiryMessage, isAuthenticated, setSessionExpiring } = useAuthStore();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  // Update time remaining every second when warning is shown
  useEffect(() => {
    if (!sessionExpiring || !isAuthenticated) {
      setTimeRemaining(null);
      return;
    }

    const updateTime = () => {
      const remaining = getTimeUntilExpiry();
      setTimeRemaining(remaining > 0 ? remaining : 0);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);

    return () => clearInterval(interval);
  }, [sessionExpiring, isAuthenticated]);

  const handleExtendSession = async () => {
    setIsRefreshing(true);
    try {
      const result = await refreshAccessToken();
      if (result) {
        setSessionExpiring(false, null);
      }
    } catch {
      // Error handled by session monitoring
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDismiss = () => {
    setSessionExpiring(false, null);
  };

  if (!sessionExpiring || !isAuthenticated) {
    return null;
  }

  const formatTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes > 0) {
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${seconds}s`;
  };

  const isExpired = timeRemaining !== null && timeRemaining <= 0;

  return (
    <div
      role="alertdialog"
      aria-labelledby="session-warning-title"
      aria-describedby="session-warning-desc"
      className="fixed top-4 right-4 z-[100] max-w-sm animate-in slide-in-from-top-2 fade-in duration-300"
    >
      <div className={`rounded-lg shadow-lg border ${
        isExpired
          ? 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800'
          : 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800'
      }`}>
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className={`flex-shrink-0 rounded-full p-1.5 ${
              isExpired
                ? 'bg-red-100 dark:bg-red-800/50'
                : 'bg-amber-100 dark:bg-amber-800/50'
            }`}>
              {isExpired ? (
                <svg className="h-5 w-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              ) : (
                <svg className="h-5 w-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3
                id="session-warning-title"
                className={`text-sm font-semibold ${
                  isExpired
                    ? 'text-red-800 dark:text-red-200'
                    : 'text-amber-800 dark:text-amber-200'
                }`}
              >
                {isExpired ? 'Session Expired' : 'Session Expiring'}
              </h3>
              <p
                id="session-warning-desc"
                className={`text-sm mt-1 ${
                  isExpired
                    ? 'text-red-700 dark:text-red-300'
                    : 'text-amber-700 dark:text-amber-300'
                }`}
              >
                {sessionExpiryMessage || (isExpired ? 'Please log in again' : 'Your session is about to expire')}
              </p>
              {timeRemaining !== null && !isExpired && (
                <p className="text-xs mt-1 text-amber-600 dark:text-amber-400 font-mono">
                  Expires in {formatTime(timeRemaining)}
                </p>
              )}
            </div>
            {!isExpired && (
              <button
                onClick={handleDismiss}
                className="flex-shrink-0 text-amber-500 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-200"
                aria-label="Dismiss warning"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          {!isExpired && (
            <div className="mt-3 flex gap-2">
              <button
                onClick={handleExtendSession}
                disabled={isRefreshing}
                className="flex-1 px-3 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
              >
                {isRefreshing ? 'Extending...' : 'Extend Session'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
