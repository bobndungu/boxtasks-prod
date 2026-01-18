import { useEffect, useState, useCallback } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X, Wifi, WifiOff } from 'lucide-react';

// Update check interval in milliseconds (30 seconds for faster detection)
const UPDATE_CHECK_INTERVAL = 30 * 1000;

// Auto-update mode: 'prompt' shows a notification, 'auto' updates silently
const AUTO_UPDATE_MODE: 'prompt' | 'auto' = 'auto';

export function PWAUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(registration: ServiceWorkerRegistration | undefined) {
      // Check for updates periodically (silently)
      if (registration) {
        setInterval(() => {
          registration.update().catch(() => {
            // Silently ignore update check failures
          });
        }, UPDATE_CHECK_INTERVAL);
      }
    },
    onRegisterError(error: Error) {
      console.error('SW registration error:', error);
    },
  });

  // Auto-update when new version is available
  useEffect(() => {
    if (needRefresh && AUTO_UPDATE_MODE === 'auto') {
      console.log('New version detected, auto-updating...');
      // Small delay to allow the UI to render if needed
      const timer = setTimeout(() => {
        updateServiceWorker(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [needRefresh, updateServiceWorker]);

  const close = useCallback(() => {
    setNeedRefresh(false);
  }, [setNeedRefresh]);

  // Don't show prompt in auto mode or when no refresh needed
  if (!needRefresh || AUTO_UPDATE_MODE === 'auto') return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm animate-slide-up">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <RefreshCw className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">
              Update available
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              A new version of BoxTasks is available. Reload to update.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => updateServiceWorker(true)}
                className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Reload
              </button>
              <button
                onClick={close}
                className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                Later
              </button>
            </div>
          </div>
          <button
            onClick={close}
            className="flex-shrink-0 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [showOffline, setShowOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowOffline(false);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Auto-hide the "back online" notification after 3 seconds
  useEffect(() => {
    if (isOnline && showOffline) {
      const timer = setTimeout(() => setShowOffline(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, showOffline]);

  if (!showOffline && isOnline) return null;

  return (
    <div
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-slide-down ${
        isOnline ? 'bg-green-500' : 'bg-yellow-500'
      } text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2`}
      role="status"
      aria-live="polite"
    >
      {isOnline ? (
        <>
          <Wifi className="h-4 w-4" />
          <span className="text-sm font-medium">Back online</span>
        </>
      ) : (
        <>
          <WifiOff className="h-4 w-4" />
          <span className="text-sm font-medium">You're offline</span>
        </>
      )}
    </div>
  );
}

// Hook to check if app is installed as PWA
export function useIsPWA(): boolean {
  const [isPWA, setIsPWA] = useState(false);

  useEffect(() => {
    // Check if running as standalone PWA
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    setIsPWA(isStandalone);
  }, []);

  return isPWA;
}

// Install prompt component
export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const isPWA = useIsPWA();

  useEffect(() => {
    // Don't show if already installed
    if (isPWA) return;

    // Check if user has dismissed before
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
      const dismissedDate = new Date(dismissed);
      const daysSinceDismissed = (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);
      // Don't show again for 7 days
      if (daysSinceDismissed < 7) return;
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, [isPWA]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('PWA installed');
    }

    setDeferredPrompt(null);
    setShowPrompt(false);
    setIsMinimized(false);
  };

  const handleMinimize = () => {
    setIsMinimized(true);
  };

  const handleExpand = () => {
    setIsMinimized(false);
  };

  const handleDontShowAgain = () => {
    localStorage.setItem('pwa-install-dismissed', new Date().toISOString());
    setShowPrompt(false);
    setIsMinimized(false);
  };

  if (!showPrompt) return null;

  // Minimized view
  if (isMinimized) {
    return (
      <div className="fixed bottom-20 md:bottom-4 right-4 z-50 animate-slide-up">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-3">
          <div className="flex items-center gap-3">
            <button
              onClick={handleExpand}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
              title="Expand"
            >
              <img
                src="/pwa-192x192.png"
                alt="BoxTasks"
                className="w-8 h-8 rounded-lg"
              />
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                Install App
              </span>
            </button>
            <div className="flex items-center gap-1">
              <button
                onClick={handleInstall}
                className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
                title="Install"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </button>
              <button
                onClick={handleDontShowAgain}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                title="Don't show again for 7 days"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <button
            onClick={handleDontShowAgain}
            className="mt-2 w-full text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            Don't show again
          </button>
        </div>
      </div>
    );
  }

  // Full view
  return (
    <div className="fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-50 animate-slide-up">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <img
              src="/pwa-192x192.png"
              alt="BoxTasks"
              className="w-12 h-12 rounded-lg"
            />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">
              Install BoxTasks
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Add BoxTasks to your home screen for quick access and offline support.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={handleInstall}
                className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Install
              </button>
              <button
                onClick={handleMinimize}
                className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                Not now
              </button>
            </div>
          </div>
          <button
            onClick={handleMinimize}
            className="flex-shrink-0 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
            aria-label="Minimize"
            title="Minimize"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
