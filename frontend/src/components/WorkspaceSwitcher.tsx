import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Check, Plus, Settings, Loader2 } from 'lucide-react';
import { useWorkspaceStore } from '../lib/stores/workspace';
import { fetchWorkspaces, type Workspace } from '../lib/api/workspaces';

export default function WorkspaceSwitcher() {
  const navigate = useNavigate();
  const { workspaces, currentWorkspace, setWorkspaces, setCurrentWorkspace } = useWorkspaceStore();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  // Load workspaces if not already loaded
  useEffect(() => {
    if (workspaces.length === 0) {
      loadWorkspaces();
    }
  }, []);

  const loadWorkspaces = async () => {
    setIsLoading(true);
    try {
      const data = await fetchWorkspaces();
      setWorkspaces(data);
    } catch {
      // Silent fail
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
        className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
      >
        {currentWorkspace ? (
          <>
            <div
              className="w-6 h-6 rounded flex items-center justify-center text-white text-xs font-bold"
              style={{ backgroundColor: currentWorkspace.color }}
            >
              {currentWorkspace.title.charAt(0).toUpperCase()}
            </div>
            <span className="font-medium text-gray-900 max-w-32 truncate">
              {currentWorkspace.title}
            </span>
          </>
        ) : (
          <span className="text-gray-500">Select workspace</span>
        )}
        <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          <div className="p-2 border-b border-gray-100">
            <p className="text-xs font-medium text-gray-500 px-2 py-1">WORKSPACES</p>
          </div>

          <div className="max-h-64 overflow-y-auto py-1">
            {isLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              </div>
            ) : workspaces.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500 text-center">
                No workspaces yet
              </div>
            ) : (
              workspaces.map((workspace) => (
                <button
                  key={workspace.id}
                  onClick={() => handleWorkspaceSelect(workspace)}
                  className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 text-left"
                >
                  <div className="flex items-center space-x-2">
                    <div
                      className="w-6 h-6 rounded flex items-center justify-center text-white text-xs font-bold"
                      style={{ backgroundColor: workspace.color }}
                    >
                      {workspace.title.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-gray-900 truncate max-w-40">
                      {workspace.title}
                    </span>
                  </div>
                  {currentWorkspace?.id === workspace.id && (
                    <Check className="h-4 w-4 text-blue-600" />
                  )}
                </button>
              ))
            )}
          </div>

          <div className="border-t border-gray-100 p-1">
            {currentWorkspace && (
              <button
                onClick={handleSettings}
                className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded"
              >
                <Settings className="h-4 w-4 mr-2" />
                Workspace Settings
              </button>
            )}
            <button
              onClick={handleViewAll}
              className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded"
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
