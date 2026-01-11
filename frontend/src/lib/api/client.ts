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

// Token management
let accessToken: string | null = null;
let csrfToken: string | null = null;

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

export const setAccessToken = (token: string | null) => {
  accessToken = token;
  if (token) {
    localStorage.setItem('access_token', token);
  } else {
    localStorage.removeItem('access_token');
  }
};

export const getAccessToken = (): string | null => {
  if (accessToken) return accessToken;
  return localStorage.getItem('access_token');
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

  const { access_token, refresh_token } = response.data;
  setAccessToken(access_token);
  setRefreshToken(refresh_token);

  return response.data;
}

// Refresh the access token
export async function refreshAccessToken(): Promise<OAuthTokenResponse | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

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

    const { access_token, refresh_token: newRefreshToken } = response.data;
    setAccessToken(access_token);
    setRefreshToken(newRefreshToken);

    return response.data;
  } catch {
    // Refresh token is invalid, clear tokens
    setAccessToken(null);
    setRefreshToken(null);
    return null;
  }
}

// Logout - clear all tokens
export function logout(): void {
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

      // Refresh failed, redirect to login
      window.location.href = '/login';
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
          return fetch(url, { ...options, headers });
        }
      }
    } catch {
      // Not JSON, return original response
    }
  }

  return response;
}

export default apiClient;
