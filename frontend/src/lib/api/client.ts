import axios, { AxiosError, AxiosRequestConfig } from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'https://boxtasks2.ddev.site';
const API_BASE_PATH = import.meta.env.VITE_API_BASE_PATH || '/jsonapi';

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

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Token expired, try to refresh or redirect to login
      setAccessToken(null);
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
