import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { login as apiLogin, logout as apiLogout, getAccessToken, refreshAccessToken } from '../api/client';

export interface User {
  id: string;
  username: string;
  email: string;
  displayName: string;
  avatar?: string;
  bio?: string;
  jobTitle?: string;
  timezone?: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      error: null,
      setUser: (user) => set({ user, isAuthenticated: !!user, isLoading: false }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
      login: async (username: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          await apiLogin(username, password);
          // Fetch user info after successful login
          const response = await fetch(`${import.meta.env.VITE_API_URL || 'https://boxtasks2.ddev.site'}/jsonapi/user/user`, {
            headers: {
              'Authorization': `Bearer ${getAccessToken()}`,
              'Accept': 'application/vnd.api+json',
            },
          });
          const data = await response.json();
          // Find the logged-in user (filter by username)
          const userData = data.data?.find((u: { attributes: { name: string } }) => u.attributes.name === username);
          if (userData) {
            const user: User = {
              id: userData.id,
              username: userData.attributes.name,
              email: userData.attributes.mail || '',
              displayName: userData.attributes.field_display_name || userData.attributes.display_name || userData.attributes.name,
              bio: userData.attributes.field_bio?.value || '',
              jobTitle: userData.attributes.field_job_title || '',
              timezone: userData.attributes.field_timezone || userData.attributes.timezone || 'UTC',
            };
            set({ user, isAuthenticated: true, isLoading: false });
            return true;
          }
          set({ error: 'Failed to fetch user data', isLoading: false });
          return false;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Login failed';
          set({ error: message, isLoading: false });
          return false;
        }
      },
      logout: () => {
        apiLogout();
        set({ user: null, isAuthenticated: false, isLoading: false, error: null });
      },
      checkAuth: async () => {
        const token = getAccessToken();
        if (!token) {
          set({ user: null, isAuthenticated: false, isLoading: false });
          return;
        }
        // Try to refresh token if needed
        try {
          const newTokens = await refreshAccessToken();
          if (!newTokens) {
            get().logout();
          }
        } catch {
          get().logout();
        }
        set({ isLoading: false });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);
