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
}

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling with token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

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

export default apiClient;
