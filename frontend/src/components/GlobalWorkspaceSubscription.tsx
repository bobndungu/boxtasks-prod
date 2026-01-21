import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '../lib/stores/auth';
import { useWorkspaceStore } from '../lib/stores/workspace';
import { fetchWorkspaces } from '../lib/api/workspaces';
import { useUserWorkspaceUpdates } from '../lib/hooks/useMercure';

/**
 * Global component that handles workspace subscription and automatic refresh.
 *
 * This component should be rendered in ProtectedRoute to ensure:
 * 1. Workspaces are always fresh when the user is authenticated
 * 2. Real-time updates are received when the user is added/removed from workspaces
 * 3. The workspace list updates automatically without requiring logout/login
 */
export default function GlobalWorkspaceSubscription() {
  const { user } = useAuthStore();
  const { setWorkspaces, setCurrentWorkspace, currentWorkspace, workspaces } = useWorkspaceStore();
  const hasInitialFetch = useRef(false);
  const lastFetchTime = useRef<number>(0);

  // Refresh workspaces from the server
  const refreshWorkspaces = useCallback(async () => {
    // Prevent rapid successive fetches (debounce 2 seconds)
    const now = Date.now();
    if (now - lastFetchTime.current < 2000) {
      return;
    }
    lastFetchTime.current = now;

    try {
      const data = await fetchWorkspaces();
      setWorkspaces(data);

      // Handle workspace changes
      if (currentWorkspace && data.length > 0) {
        const stillExists = data.some(w => w.id === currentWorkspace.id);
        if (!stillExists) {
          // Current workspace is no longer accessible, switch to first available
          setCurrentWorkspace(data[0]);
        }
      } else if (!currentWorkspace && data.length > 0) {
        // No current workspace, set the first one
        setCurrentWorkspace(data[0]);
      } else if (data.length === 0) {
        // No workspaces available
        setCurrentWorkspace(null);
      }
    } catch (error) {
      console.error('Failed to refresh workspaces:', error);
    }
  }, [currentWorkspace, setWorkspaces, setCurrentWorkspace]);

  // Subscribe to real-time workspace assignment updates
  useUserWorkspaceUpdates(user?.id, {
    onWorkspaceAssigned: () => {
      // User was added to a new workspace - refresh the list
      console.log('[GlobalWorkspaceSubscription] Workspace assigned event received');
      refreshWorkspaces();
    },
    onWorkspaceUnassigned: () => {
      // User was removed from a workspace - refresh the list
      console.log('[GlobalWorkspaceSubscription] Workspace unassigned event received');
      refreshWorkspaces();
    },
  });

  // Fetch workspaces on initial mount (when user becomes authenticated)
  // This ensures we always have fresh data when the app loads
  useEffect(() => {
    if (user?.id && !hasInitialFetch.current) {
      hasInitialFetch.current = true;
      // Always fetch fresh data on initial load
      // This catches any changes that happened while the user was logged out
      refreshWorkspaces();
    }
  }, [user?.id, refreshWorkspaces]);

  // Reset initial fetch flag when user changes (e.g., logout then login as different user)
  useEffect(() => {
    if (!user?.id) {
      hasInitialFetch.current = false;
    }
  }, [user?.id]);

  // Periodic refresh every 5 minutes to catch any missed events
  // This is a fallback for cases where Mercure events don't arrive
  useEffect(() => {
    if (!user?.id) return;

    const interval = setInterval(() => {
      // Only refresh if we have workspaces (don't refresh if initial load failed)
      if (workspaces.length > 0) {
        refreshWorkspaces();
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [user?.id, workspaces.length, refreshWorkspaces]);

  // This component doesn't render anything
  return null;
}
