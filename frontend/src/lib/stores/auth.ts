import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  login as apiLogin,
  logout as apiLogout,
  getAccessToken,
  setAccessToken,
  setRefreshToken,
  refreshAccessToken,
  isTokenValid,
  isTokenExpired,
  startSessionMonitoring,
  stopSessionMonitoring,
  onSessionEvent
} from '../api/client';

export interface User {
  id: string;
  username: string;
  email: string;
  displayName: string;
  avatar?: string;
  bio?: string;
  jobTitle?: string;
  timezone?: string;
  mentionHandle?: string;
  roles?: string[];
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  sessionExpiring: boolean;
  sessionExpiryMessage: string | null;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setSessionExpiring: (expiring: boolean, message?: string | null) => void;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  initSessionMonitoring: () => () => void;
  setTokens: (accessToken: string, refreshToken?: string, expiresIn?: number) => void;
  fetchUser: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      error: null,
      sessionExpiring: false,
      sessionExpiryMessage: null,
      setUser: (user) => set({ user, isAuthenticated: !!user, isLoading: false }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
      setSessionExpiring: (sessionExpiring, sessionExpiryMessage = null) =>
        set({ sessionExpiring, sessionExpiryMessage }),
      login: async (username: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          await apiLogin(username, password);
          // Fetch user info after successful login using /api/me
          const response = await fetch(`${import.meta.env.VITE_API_URL || 'https://boxtasks2.ddev.site'}/api/me`, {
            headers: {
              'Authorization': `Bearer ${getAccessToken()}`,
              'Accept': 'application/json',
            },
          });

          if (!response.ok) {
            set({ error: 'Failed to fetch user data', isLoading: false });
            return false;
          }

          const userData = await response.json();
          if (userData && userData.id) {
            const user: User = {
              id: userData.id,
              username: userData.name,
              email: userData.mail || '',
              displayName: userData.display_name || userData.name,
              bio: userData.bio || '',
              jobTitle: userData.job_title || '',
              timezone: userData.timezone || 'UTC',
              mentionHandle: userData.mention_handle || '',
              roles: userData.roles || [],
            };
            set({ user, isAuthenticated: true, isLoading: false });
            return true;
          }
          set({ error: 'Failed to fetch user data', isLoading: false });
          return false;
        } catch (error: unknown) {
          // Extract meaningful error message from OAuth response
          let message = 'Login failed';

          if (error && typeof error === 'object') {
            const axiosError = error as { response?: { data?: { error_description?: string; error?: string; message?: string }; status?: number }; message?: string };

            if (axiosError.response?.data) {
              const data = axiosError.response.data;
              // OAuth error format: { error: "invalid_grant", error_description: "The user credentials were incorrect." }
              if (data.error_description) {
                message = data.error_description;
              } else if (data.error === 'invalid_grant') {
                message = 'Invalid username or password';
              } else if (data.error === 'invalid_client') {
                message = 'Authentication configuration error. Please contact support.';
              } else if (data.message) {
                message = data.message;
              } else if (data.error) {
                message = data.error;
              }
            } else if (axiosError.response?.status === 400) {
              message = 'Invalid username or password';
            } else if (axiosError.response?.status === 403) {
              message = 'Account is locked. Please try again later or contact support.';
            } else if (axiosError.response?.status === 429) {
              message = 'Too many login attempts. Please wait a few minutes and try again.';
            } else if (axiosError.message) {
              message = axiosError.message;
            }
          } else if (error instanceof Error) {
            message = error.message;
          }

          set({ error: message, isLoading: false });
          return false;
        }
      },
      logout: () => {
        stopSessionMonitoring();
        apiLogout();
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
          sessionExpiring: false,
          sessionExpiryMessage: null
        });
      },
      checkAuth: async () => {
        const token = getAccessToken();
        const { user, isAuthenticated } = get();

        // No token at all - definitely not authenticated
        if (!token) {
          set({ user: null, isAuthenticated: false, isLoading: false });
          return;
        }

        // Token exists and is still valid - keep current auth state
        if (isTokenValid()) {
          // If we have persisted user data and valid token, we're good
          if (user && isAuthenticated) {
            // Start session monitoring for existing valid session
            startSessionMonitoring();
            set({ isLoading: false });
            return;
          }
        }

        // Token is expired or about to expire - try to refresh
        if (isTokenExpired()) {
          try {
            const newTokens = await refreshAccessToken();
            if (!newTokens) {
              // Refresh failed and token is expired - log out
              get().logout();
              return;
            }
            // Refresh succeeded - monitoring is started by refreshAccessToken
            set({ isLoading: false });
            return;
          } catch {
            // Refresh failed - log out
            get().logout();
            return;
          }
        }

        // Token exists but we don't have user data - this shouldn't happen often
        // but if it does, the user is still authenticated
        if (token && !user) {
          startSessionMonitoring();
          set({ isAuthenticated: true, isLoading: false });
          return;
        }

        set({ isLoading: false });
      },
      initSessionMonitoring: () => {
        // Subscribe to session events
        const unsubscribe = onSessionEvent((event, message) => {
          const { isAuthenticated } = get();
          if (!isAuthenticated) return;

          switch (event) {
            case 'expiring':
              set({
                sessionExpiring: true,
                sessionExpiryMessage: message || 'Your session is about to expire'
              });
              break;
            case 'refreshed':
              set({
                sessionExpiring: false,
                sessionExpiryMessage: null
              });
              break;
            case 'expired':
              // Give user a chance to see the message before logout
              set({
                sessionExpiring: true,
                sessionExpiryMessage: message || 'Your session has expired'
              });
              // Delay logout to show message
              setTimeout(() => {
                get().logout();
                window.location.href = '/login?expired=1';
              }, 2000);
              break;
            case 'error':
              set({
                sessionExpiring: true,
                sessionExpiryMessage: message || 'Session error occurred'
              });
              break;
          }
        });

        // Start monitoring if already authenticated
        if (get().isAuthenticated && getAccessToken()) {
          startSessionMonitoring();
        }

        return unsubscribe;
      },
      setTokens: (accessToken: string, refreshToken?: string, expiresIn: number = 3600) => {
        setAccessToken(accessToken, expiresIn);
        if (refreshToken) {
          setRefreshToken(refreshToken);
        }
        startSessionMonitoring();
      },
      fetchUser: async () => {
        try {
          const token = getAccessToken();
          if (!token) {
            return false;
          }

          // Fetch current user using /api/me endpoint
          const response = await fetch(`${import.meta.env.VITE_API_URL || 'https://boxtasks2.ddev.site'}/api/me`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json',
            },
          });

          if (!response.ok) {
            throw new Error('Failed to fetch user data');
          }

          const userData = await response.json();

          if (userData && userData.id) {
            const user: User = {
              id: userData.id,
              username: userData.name,
              email: userData.mail || '',
              displayName: userData.display_name || userData.name,
              bio: userData.bio || '',
              jobTitle: userData.job_title || '',
              timezone: userData.timezone || 'UTC',
              mentionHandle: userData.mention_handle || '',
              roles: userData.roles || [],
            };
            set({ user, isAuthenticated: true, isLoading: false });
            return true;
          }

          return false;
        } catch (error) {
          console.error('Error fetching user:', error);
          return false;
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);
