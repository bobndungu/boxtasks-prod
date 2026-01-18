import { useRegisterSW } from 'virtual:pwa-register/react';
import { useCallback, useEffect } from 'react';

/**
 * Hook to manage service worker registration and updates.
 *
 * Features:
 * - Automatically checks for updates every 60 seconds
 * - Provides needRefresh state when new content is available
 * - Provides updateServiceWorker function to apply updates
 * - Auto-reloads when service worker updates (for seamless deployments)
 */
export function useServiceWorker() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    // Check for SW updates every 60 seconds
    onRegisteredSW(swUrl, registration) {
      if (registration) {
        // Check for updates periodically
        setInterval(() => {
          registration.update();
        }, 60 * 1000); // Check every 60 seconds
      }
    },
    onRegisterError(error) {
      console.error('Service worker registration error:', error);
    },
  });

  // Auto-update when new service worker is available
  // This ensures deployments take effect without user action
  useEffect(() => {
    if (needRefresh) {
      // Automatically apply update and reload
      // For a smoother UX, you could show a toast notification instead
      updateServiceWorker(true);
    }
  }, [needRefresh, updateServiceWorker]);

  const dismissUpdate = useCallback(() => {
    setNeedRefresh(false);
  }, [setNeedRefresh]);

  return {
    needRefresh,
    updateServiceWorker: () => updateServiceWorker(true),
    dismissUpdate,
  };
}

export default useServiceWorker;
