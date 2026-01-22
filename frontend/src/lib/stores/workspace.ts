import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Workspace } from '../api/workspaces';

// Staleness threshold in milliseconds (1 minute)
const STALE_THRESHOLD = 60 * 1000;

interface WorkspaceState {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  workspacesLastFetched: number | null;
  isLoading: boolean;
  error: string | null;
  setWorkspaces: (workspaces: Workspace[]) => void;
  addWorkspace: (workspace: Workspace) => void;
  updateWorkspace: (workspace: Workspace) => void;
  removeWorkspace: (id: string) => void;
  setCurrentWorkspace: (workspace: Workspace | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearWorkspaces: () => void;
  isWorkspacesStale: () => boolean;
  invalidateWorkspacesCache: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      workspaces: [],
      currentWorkspace: null,
      workspacesLastFetched: null,
      isLoading: false,
      error: null,
      setWorkspaces: (workspaces) => set({ workspaces, isLoading: false, workspacesLastFetched: Date.now() }),
      addWorkspace: (workspace) =>
        set((state) => ({ workspaces: [...state.workspaces, workspace] })),
      updateWorkspace: (workspace) =>
        set((state) => ({
          workspaces: state.workspaces.map((w) =>
            w.id === workspace.id ? workspace : w
          ),
          currentWorkspace:
            state.currentWorkspace?.id === workspace.id
              ? workspace
              : state.currentWorkspace,
        })),
      removeWorkspace: (id) =>
        set((state) => ({
          workspaces: state.workspaces.filter((w) => w.id !== id),
          currentWorkspace:
            state.currentWorkspace?.id === id ? null : state.currentWorkspace,
        })),
      setCurrentWorkspace: (currentWorkspace) => set({ currentWorkspace }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
      // Clear all workspaces (used on logout)
      clearWorkspaces: () => set({ workspaces: [], currentWorkspace: null, workspacesLastFetched: null }),
      isWorkspacesStale: () => {
        const { workspacesLastFetched } = get();
        if (!workspacesLastFetched) return true;
        return Date.now() - workspacesLastFetched > STALE_THRESHOLD;
      },
      invalidateWorkspacesCache: () => set({ workspacesLastFetched: null }),
    }),
    {
      name: 'boxtasks_workspace',
      partialize: (state) => ({
        currentWorkspace: state.currentWorkspace,
      }),
    }
  )
);
