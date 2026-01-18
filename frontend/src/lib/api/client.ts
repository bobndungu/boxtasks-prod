import axios from 'axios';
import type { AxiosError, AxiosRequestConfig } from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'https://boxtasks2.ddev.site';
const API_BASE_PATH = import.meta.env.VITE_API_BASE_PATH || '/jsonapi';

// OAuth configuration
const OAUTH_CLIENT_ID = import.meta.env.VITE_OAUTH_CLIENT_ID || 'boxtasks-frontend';
const OAUTH_CLIENT_SECRET = import.meta.env.VITE_OAUTH_CLIENT_SECRET || 'boxtasks-secret';

// Create axios instance for JSON:API
export const apiClient = axios.create({
  baseURL: `${API_URL}${API_BASE_PATH}`,
  headers: {
    'Content-Type': 'application/vnd.api+json',
    'Accept': 'application/vnd.api+json',
  },
  withCredentials: true,
});

// Create axios instance for custom API endpoints (non-JSON:API)
// This is used for endpoints like /api/board/{id}/data that don't follow JSON:API spec
export const customApiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  withCredentials: true,
});

// Token management
let accessToken: string | null = null;
let csrfToken: string | null = null;
let tokenExpiresAt: number | null = null;
let tokenRefreshTimer: ReturnType<typeof setTimeout> | null = null;
let sessionHeartbeatTimer: ReturnType<typeof setInterval> | null = null;

// Session event callbacks
type SessionEventCallback = (event: 'refreshed' | 'expiring' | 'expired' | 'error', message?: string) => void;
let sessionEventCallbacks: SessionEventCallback[] = [];

export const onSessionEvent = (callback: SessionEventCallback): (() => void) => {
  sessionEventCallbacks.push(callback);
  return () => {
    sessionEventCallbacks = sessionEventCallbacks.filter(cb => cb !== callback);
  };
};

const emitSessionEvent = (event: 'refreshed' | 'expiring' | 'expired' | 'error', message?: string) => {
  sessionEventCallbacks.forEach(cb => cb(event, message));
};

// CSRF token management for session-based authentication
export const getCsrfToken = async (): Promise<string | null> => {
  if (csrfToken) return csrfToken;

  try {
    const response = await axios.get(`${API_URL}/session/token`, {
      withCredentials: true,
    });
    csrfToken = response.data;
    return csrfToken;
  } catch {
    console.warn('Failed to fetch CSRF token');
    return null;
  }
};

export const clearCsrfToken = (): void => {
  csrfToken = null;
};

export const setAccessToken = (token: string | null, expiresIn?: number) => {
  accessToken = token;
  if (token) {
    localStorage.setItem('access_token', token);
    if (expiresIn) {
      // Store expiration time (current time + expires_in seconds)
      tokenExpiresAt = Date.now() + (expiresIn * 1000);
      localStorage.setItem('token_expires_at', tokenExpiresAt.toString());
    }
  } else {
    localStorage.removeItem('access_token');
    localStorage.removeItem('token_expires_at');
    tokenExpiresAt = null;
  }
};

export const getAccessToken = (): string | null => {
  if (accessToken) return accessToken;
  return localStorage.getItem('access_token');
};

export const getTokenExpiresAt = (): number | null => {
  if (tokenExpiresAt) return tokenExpiresAt;
  const stored = localStorage.getItem('token_expires_at');
  if (stored) {
    tokenExpiresAt = parseInt(stored, 10);
    return tokenExpiresAt;
  }
  return null;
};

// Token expiry buffer constants
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // Refresh 5 minutes before expiry
const TOKEN_EXPIRING_WARNING_MS = 2 * 60 * 1000; // Warn 2 minutes before expiry
const SESSION_HEARTBEAT_INTERVAL_MS = 60 * 1000; // Check every minute

export const getTimeUntilExpiry = (): number => {
  const expiresAt = getTokenExpiresAt();
  if (!expiresAt) return Infinity;
  return expiresAt - Date.now();
};

export const isTokenExpiring = (): boolean => {
  const timeUntilExpiry = getTimeUntilExpiry();
  return timeUntilExpiry > 0 && timeUntilExpiry <= TOKEN_REFRESH_BUFFER_MS;
};

export const isTokenExpired = (): boolean => {
  const timeUntilExpiry = getTimeUntilExpiry();
  if (timeUntilExpiry === Infinity) return false; // If no expiration info, assume valid
  return timeUntilExpiry <= 0;
};

export const isTokenValid = (): boolean => {
  const token = getAccessToken();
  if (!token) return false;
  return !isTokenExpired();
};

// Schedule proactive token refresh
const scheduleTokenRefresh = () => {
  // Clear any existing timer
  if (tokenRefreshTimer) {
    clearTimeout(tokenRefreshTimer);
    tokenRefreshTimer = null;
  }

  const timeUntilExpiry = getTimeUntilExpiry();
  if (timeUntilExpiry === Infinity || timeUntilExpiry <= 0) return;

  // Calculate when to refresh (5 minutes before expiry, or halfway if less than 10 minutes)
  const refreshIn = Math.max(
    timeUntilExpiry - TOKEN_REFRESH_BUFFER_MS,
    timeUntilExpiry / 2,
    1000 // At least 1 second
  );

  tokenRefreshTimer = setTimeout(async () => {
    try {
      const result = await refreshAccessToken();
      if (result) {
        emitSessionEvent('refreshed', 'Session refreshed successfully');
      } else {
        emitSessionEvent('expired', 'Session expired - please log in again');
      }
    } catch {
      emitSessionEvent('error', 'Failed to refresh session');
    }
  }, refreshIn);
};

// Start session heartbeat monitoring
export const startSessionMonitoring = () => {
  // Clear any existing heartbeat
  if (sessionHeartbeatTimer) {
    clearInterval(sessionHeartbeatTimer);
    sessionHeartbeatTimer = null;
  }

  // Start new heartbeat
  sessionHeartbeatTimer = setInterval(() => {
    const timeUntilExpiry = getTimeUntilExpiry();

    // Warn if session is about to expire
    if (timeUntilExpiry > 0 && timeUntilExpiry <= TOKEN_EXPIRING_WARNING_MS) {
      emitSessionEvent('expiring', `Session expiring in ${Math.ceil(timeUntilExpiry / 1000)} seconds`);
    }

    // If expired, emit event
    if (timeUntilExpiry <= 0 && getAccessToken()) {
      emitSessionEvent('expired', 'Session has expired');
    }
  }, SESSION_HEARTBEAT_INTERVAL_MS);

  // Also schedule the proactive refresh
  scheduleTokenRefresh();
};

// Stop session monitoring
export const stopSessionMonitoring = () => {
  if (tokenRefreshTimer) {
    clearTimeout(tokenRefreshTimer);
    tokenRefreshTimer = null;
  }
  if (sessionHeartbeatTimer) {
    clearInterval(sessionHeartbeatTimer);
    sessionHeartbeatTimer = null;
  }
};

export const getRefreshToken = (): string | null => {
  return localStorage.getItem('refresh_token');
};

export const setRefreshToken = (token: string | null) => {
  if (token) {
    localStorage.setItem('refresh_token', token);
  } else {
    localStorage.removeItem('refresh_token');
  }
};

// OAuth token response interface
interface OAuthTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

// Login with username and password
export async function login(username: string, password: string): Promise<OAuthTokenResponse> {
  const response = await axios.post<OAuthTokenResponse>(
    `${API_URL}/oauth/token`,
    new URLSearchParams({
      grant_type: 'password',
      client_id: OAUTH_CLIENT_ID,
      client_secret: OAUTH_CLIENT_SECRET,
      username,
      password,
    }),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  );

  const { access_token, refresh_token, expires_in } = response.data;
  setAccessToken(access_token, expires_in);
  setRefreshToken(refresh_token);

  // Start session monitoring after successful login
  startSessionMonitoring();

  return response.data;
}

// Refresh the access token
let isRefreshing = false;
let refreshPromise: Promise<OAuthTokenResponse | null> | null = null;

export async function refreshAccessToken(): Promise<OAuthTokenResponse | null> {
  // Prevent multiple simultaneous refresh attempts
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const response = await axios.post<OAuthTokenResponse>(
        `${API_URL}/oauth/token`,
        new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: OAUTH_CLIENT_ID,
          client_secret: OAUTH_CLIENT_SECRET,
          refresh_token: refreshToken,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const { access_token, refresh_token: newRefreshToken, expires_in } = response.data;
      setAccessToken(access_token, expires_in);
      setRefreshToken(newRefreshToken);

      // Reschedule the next proactive refresh
      scheduleTokenRefresh();

      return response.data;
    } catch {
      // Refresh token is invalid, clear tokens and stop monitoring
      stopSessionMonitoring();
      setAccessToken(null);
      setRefreshToken(null);
      return null;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// Logout - clear all tokens and stop monitoring
export function logout(): void {
  stopSessionMonitoring();
  setAccessToken(null);
  setRefreshToken(null);
  clearCsrfToken();
}

// Request interceptor to add auth token and CSRF token
apiClient.interceptors.request.use(
  async (config) => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Add CSRF token for state-changing requests
    const method = config.method?.toUpperCase();
    if (method && ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
      const csrf = await getCsrfToken();
      if (csrf) {
        config.headers['X-CSRF-Token'] = csrf;
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling with token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean; _csrfRetry?: boolean };

    // Handle CSRF token errors (403 with CSRF message)
    if (error.response?.status === 403 && !originalRequest._csrfRetry) {
      const errorData = error.response.data as { message?: string } | undefined;
      if (errorData?.message?.toLowerCase().includes('csrf')) {
        originalRequest._csrfRetry = true;
        clearCsrfToken();

        // Get fresh CSRF token and retry
        const freshCsrf = await getCsrfToken();
        if (freshCsrf && originalRequest.headers) {
          originalRequest.headers['X-CSRF-Token'] = freshCsrf;
          return apiClient(originalRequest);
        }
      }
    }

    // Handle authentication errors
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      // Try to refresh the token
      const newTokens = await refreshAccessToken();
      if (newTokens) {
        // Retry the original request with new token
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${newTokens.access_token}`;
        return apiClient(originalRequest);
      }

      // Refresh failed - emit session expired event instead of abrupt redirect
      // This allows the UI to show a proper message to the user
      emitSessionEvent('expired', 'Your session has expired. Please log in again.');
    }
    return Promise.reject(error);
  }
);

// Add the same interceptors to customApiClient for non-JSON:API endpoints
customApiClient.interceptors.request.use(
  async (config) => {
    const token = getAccessToken();
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

customApiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    // Handle authentication errors
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      // Try to refresh the token
      const newTokens = await refreshAccessToken();
      if (newTokens) {
        // Retry the original request with new token
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${newTokens.access_token}`;
        return customApiClient(originalRequest);
      }

      // Refresh failed - emit session expired event
      emitSessionEvent('expired', 'Your session has expired. Please log in again.');
    }
    return Promise.reject(error);
  }
);

// JSON:API response types
export interface JsonApiResource<T = Record<string, unknown>> {
  id: string;
  type: string;
  attributes: T;
  relationships?: Record<string, {
    data: { id: string; type: string } | { id: string; type: string }[] | null;
  }>;
  links?: {
    self?: string;
  };
}

export interface JsonApiResponse<T = Record<string, unknown>> {
  data: JsonApiResource<T> | JsonApiResource<T>[];
  included?: JsonApiResource[];
  links?: {
    self?: string;
    next?: string;
    prev?: string;
  };
  meta?: {
    count?: number;
  };
}

// Generic fetch function for JSON:API
export async function fetchJsonApi<T>(
  endpoint: string,
  config?: AxiosRequestConfig
): Promise<JsonApiResponse<T>> {
  const response = await apiClient.get<JsonApiResponse<T>>(endpoint, config);
  return response.data;
}

// Create resource
export async function createJsonApi<T>(
  endpoint: string,
  data: Partial<T>,
  type: string
): Promise<JsonApiResource<T>> {
  const response = await apiClient.post<{ data: JsonApiResource<T> }>(endpoint, {
    data: {
      type,
      attributes: data,
    },
  });
  return response.data.data;
}

// Update resource
export async function updateJsonApi<T>(
  endpoint: string,
  id: string,
  data: Partial<T>,
  type: string
): Promise<JsonApiResource<T>> {
  const response = await apiClient.patch<{ data: JsonApiResource<T> }>(`${endpoint}/${id}`, {
    data: {
      id,
      type,
      attributes: data,
    },
  });
  return response.data.data;
}

// Delete resource
export async function deleteJsonApi(endpoint: string, id: string): Promise<void> {
  await apiClient.delete(`${endpoint}/${id}`);
}

// CSRF-aware fetch wrapper for use in API files that use raw fetch
// This adds CSRF token to state-changing requests (POST, PATCH, PUT, DELETE)
export async function fetchWithCsrf(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const method = options.method?.toUpperCase() || 'GET';
  const headers = new Headers(options.headers);

  // Add Authorization header if we have a token
  const token = getAccessToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Add CSRF token for state-changing requests
  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
    const csrf = await getCsrfToken();
    if (csrf) {
      headers.set('X-CSRF-Token', csrf);
    }
  }

  const response = await fetch(url, {
    ...options,
    headers,
    cache: 'no-store', // Bypass service worker caching for API requests
  });

  // If we get a 403 with CSRF error, retry with fresh token
  if (response.status === 403) {
    const clonedResponse = response.clone();
    try {
      const errorData = await clonedResponse.json();
      if (errorData?.message?.toLowerCase().includes('csrf') ||
          errorData?.errors?.[0]?.detail?.toLowerCase().includes('csrf')) {
        clearCsrfToken();
        const freshCsrf = await getCsrfToken();
        if (freshCsrf) {
          headers.set('X-CSRF-Token', freshCsrf);
          return fetch(url, { ...options, headers, cache: 'no-store' });
        }
      }
    } catch {
      // Not JSON, return original response
    }
  }

  return response;
}

export default apiClient;
