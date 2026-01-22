import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Workspace } from '../api/workspaces';

interface WorkspaceState {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
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
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      workspaces: [],
      currentWorkspace: null,
      isLoading: false,
      error: null,
      setWorkspaces: (workspaces) => set({ workspaces, isLoading: false }),
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
      clearWorkspaces: () => set({ workspaces: [], currentWorkspace: null }),
    }),
    {
      name: 'boxtasks_workspace',
      partialize: (state) => ({
        currentWorkspace: state.currentWorkspace,
      }),
    }
  )
);
