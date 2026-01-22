import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Check, Plus, Settings, Loader2 } from 'lucide-react';
import { useWorkspaceStore } from '../lib/stores/workspace';
import { fetchWorkspaces, type Workspace } from '../lib/api/workspaces';
import { useAuthStore } from '../lib/stores/auth';
import { useUserWorkspaceUpdates } from '../lib/hooks/useMercure';

export default function WorkspaceSwitcher() {
  const navigate = useNavigate();
  const { workspaces, currentWorkspace, setWorkspaces, setCurrentWorkspace, setFetchingWorkspaces, shouldFetchWorkspaces } = useWorkspaceStore();
  const { user } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Callback to refresh workspaces from server
  const refreshWorkspaces = useCallback(async () => {
    try {
      const data = await fetchWorkspaces();
      setWorkspaces(data);

      // Handle workspace changes
      if (currentWorkspace && data.length > 0) {
        const stillExists = data.some(w => w.id === currentWorkspace.id);
        if (!stillExists) {
          setCurrentWorkspace(data[0]);
        }
      } else if (!currentWorkspace && data.length > 0) {
        setCurrentWorkspace(data[0]);
      } else if (data.length === 0) {
        setCurrentWorkspace(null);
      }
    } catch {
      // Silent fail
    }
  }, [currentWorkspace, setWorkspaces, setCurrentWorkspace]);

  // Subscribe to real-time workspace assignment updates
  useUserWorkspaceUpdates(user?.id, {
    onWorkspaceAssigned: () => {
      // User was added to a new workspace - refresh the list
      refreshWorkspaces();
    },
    onWorkspaceUnassigned: (data) => {
      // User was removed from a workspace - refresh the list
      refreshWorkspaces();
      // If the removed workspace is the current one, this will be handled by refreshWorkspaces
      if (currentWorkspace?.id === data.workspaceId) {
        // The refresh will auto-select another workspace
      }
    },
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load workspaces if not already loaded or stale AND not currently fetching
  useEffect(() => {
    // Only fetch if workspaces should be fetched (stale AND not currently fetching)
    if (shouldFetchWorkspaces()) {
      loadWorkspaces();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadWorkspaces = async () => {
    setIsLoading(true);
    setFetchingWorkspaces(true);
    try {
      await refreshWorkspaces();
    } finally {
      setIsLoading(false);
    }
  };

  const handleWorkspaceSelect = (workspace: Workspace) => {
    setCurrentWorkspace(workspace);
    setIsOpen(false);
    navigate(`/workspace/${workspace.id}`);
  };

  const handleViewAll = () => {
    setIsOpen(false);
    navigate('/workspaces');
  };

  const handleSettings = () => {
    if (currentWorkspace) {
      setIsOpen(false);
      navigate(`/workspace/${currentWorkspace.id}/settings`);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-1 lg:space-x-2 px-2 lg:px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        {currentWorkspace ? (
          <>
            <div
              className="w-5 h-5 lg:w-6 lg:h-6 rounded flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              style={{ backgroundColor: currentWorkspace.color }}
            >
              {currentWorkspace.title.charAt(0).toUpperCase()}
            </div>
            <span className="hidden lg:block font-medium text-sm lg:text-base text-gray-900 dark:text-white max-w-24 lg:max-w-32 truncate">
              {currentWorkspace.title}
            </span>
          </>
        ) : (
          <span className="text-sm lg:text-base text-gray-500 dark:text-gray-400">Select workspace</span>
        )}
        <ChevronDown className={`h-4 w-4 text-gray-500 dark:text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
          <div className="p-2 border-b border-gray-100 dark:border-gray-700">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 px-2 py-1">WORKSPACES</p>
          </div>

          <div className="max-h-64 overflow-y-auto py-1">
            {isLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              </div>
            ) : workspaces.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">
                No workspaces yet
              </div>
            ) : (
              workspaces.map((workspace) => (
                <button
                  key={workspace.id}
                  onClick={() => handleWorkspaceSelect(workspace)}
                  className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-left"
                >
                  <div className="flex items-center space-x-2">
                    <div
                      className="w-6 h-6 rounded flex items-center justify-center text-white text-xs font-bold"
                      style={{ backgroundColor: workspace.color }}
                    >
                      {workspace.title.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-40">
                      {workspace.title}
                    </span>
                  </div>
                  {currentWorkspace?.id === workspace.id && (
                    <Check className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  )}
                </button>
              ))
            )}
          </div>

          <div className="border-t border-gray-100 dark:border-gray-700 p-1">
            {currentWorkspace && (
              <button
                onClick={handleSettings}
                className="w-full flex items-center px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded"
              >
                <Settings className="h-4 w-4 mr-2" />
                Workspace Settings
              </button>
            )}
            <button
              onClick={handleViewAll}
              className="w-full flex items-center px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded"
            >
              <Plus className="h-4 w-4 mr-2" />
              View All Workspaces
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
