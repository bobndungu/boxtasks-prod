/**
 * Comprehensive error handling utilities for BoxTasks
 */

// Custom error types
export class ApiError extends Error {
  status: number;
  code?: string;
  details?: Record<string, unknown>;

  constructor(
    message: string,
    status: number,
    code?: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class NetworkError extends Error {
  constructor(message: string = 'Network error. Please check your connection.') {
    super(message);
    this.name = 'NetworkError';
  }
}

export class AuthenticationError extends Error {
  constructor(message: string = 'Please log in to continue.') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class ValidationError extends Error {
  fields?: Record<string, string[]>;

  constructor(
    message: string,
    fields?: Record<string, string[]>
  ) {
    super(message);
    this.name = 'ValidationError';
    this.fields = fields;
  }
}

// Error codes with user-friendly messages
export const ERROR_MESSAGES: Record<string, string> = {
  // Network errors
  NETWORK_ERROR: 'Unable to connect to the server. Please check your internet connection.',
  TIMEOUT: 'The request took too long. Please try again.',

  // Authentication errors
  UNAUTHORIZED: 'Your session has expired. Please log in again.',
  FORBIDDEN: 'You don\'t have permission to perform this action.',
  INVALID_CREDENTIALS: 'Invalid email or password.',

  // Resource errors
  NOT_FOUND: 'The requested resource was not found.',
  CONFLICT: 'This action conflicts with existing data.',

  // Validation errors
  VALIDATION_ERROR: 'Please check your input and try again.',
  INVALID_INPUT: 'Some fields contain invalid data.',

  // Server errors
  SERVER_ERROR: 'Something went wrong on our end. Please try again later.',
  SERVICE_UNAVAILABLE: 'The service is temporarily unavailable. Please try again later.',

  // Rate limiting
  RATE_LIMITED: 'Too many requests. Please wait a moment and try again.',

  // Generic
  UNKNOWN: 'An unexpected error occurred. Please try again.',
};

/**
 * Get a user-friendly error message from an error object
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    // Check for specific status codes
    switch (error.status) {
      case 400:
        return error.message || ERROR_MESSAGES.VALIDATION_ERROR;
      case 401:
        return ERROR_MESSAGES.UNAUTHORIZED;
      case 403:
        return ERROR_MESSAGES.FORBIDDEN;
      case 404:
        return ERROR_MESSAGES.NOT_FOUND;
      case 409:
        return error.message || ERROR_MESSAGES.CONFLICT;
      case 422:
        return error.message || ERROR_MESSAGES.VALIDATION_ERROR;
      case 429:
        return ERROR_MESSAGES.RATE_LIMITED;
      case 500:
      case 502:
      case 503:
        return ERROR_MESSAGES.SERVICE_UNAVAILABLE;
      default:
        return error.message || ERROR_MESSAGES.UNKNOWN;
    }
  }

  if (error instanceof NetworkError) {
    return error.message;
  }

  if (error instanceof AuthenticationError) {
    return error.message;
  }

  if (error instanceof ValidationError) {
    return error.message;
  }

  if (error instanceof Error) {
    // Check for common error patterns
    if (error.message.includes('fetch') || error.message.includes('network')) {
      return ERROR_MESSAGES.NETWORK_ERROR;
    }
    if (error.message.includes('timeout')) {
      return ERROR_MESSAGES.TIMEOUT;
    }
    return error.message || ERROR_MESSAGES.UNKNOWN;
  }

  if (typeof error === 'string') {
    return error;
  }

  return ERROR_MESSAGES.UNKNOWN;
}

/**
 * Parse API response errors into structured errors
 */
export async function parseApiError(response: Response): Promise<ApiError> {
  let message = 'Request failed';
  let code: string | undefined;
  let details: Record<string, unknown> | undefined;

  try {
    const data = await response.json();

    // Handle JSON:API error format
    if (data.errors && Array.isArray(data.errors)) {
      const firstError = data.errors[0];
      message = firstError.detail || firstError.title || message;
      code = firstError.code;
      details = { errors: data.errors };
    }
    // Handle standard error format
    else if (data.message) {
      message = data.message;
      code = data.code;
      details = data.details;
    }
    // Handle validation errors
    else if (data.error) {
      message = typeof data.error === 'string' ? data.error : 'Validation error';
      details = data;
    }
  } catch {
    // Response wasn't JSON, use status text
    message = response.statusText || message;
  }

  return new ApiError(message, response.status, code, details);
}

/**
 * Error logger for development and production
 */
export function logError(error: unknown, context?: string): void {
  const errorInfo = {
    message: error instanceof Error ? error.message : String(error),
    name: error instanceof Error ? error.name : 'Unknown',
    stack: error instanceof Error ? error.stack : undefined,
    context,
    timestamp: new Date().toISOString(),
    url: typeof window !== 'undefined' ? window.location.href : undefined,
  };

  // Always log to console in development
  if (import.meta.env.DEV) {
    console.error('Error logged:', errorInfo);
  }

  // In production, you would send this to an error tracking service
  // e.g., Sentry, LogRocket, etc.
  // if (import.meta.env.PROD) {
  //   sendToErrorService(errorInfo);
  // }
}

/**
 * Retry wrapper for failed operations
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    delay?: number;
    backoff?: boolean;
    shouldRetry?: (error: unknown) => boolean;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    delay = 1000,
    backoff = true,
    shouldRetry = (error) => {
      // Only retry network errors and 5xx server errors
      if (error instanceof NetworkError) return true;
      if (error instanceof ApiError && error.status >= 500) return true;
      return false;
    },
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt < maxRetries && shouldRetry(error)) {
        const waitTime = backoff ? delay * Math.pow(2, attempt) : delay;
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        continue;
      }

      throw error;
    }
  }

  throw lastError;
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof NetworkError) return true;
  if (error instanceof ApiError) {
    return error.status >= 500 || error.status === 429;
  }
  return false;
}

/**
 * Check if error is an authentication error
 */
export function isAuthError(error: unknown): boolean {
  if (error instanceof AuthenticationError) return true;
  if (error instanceof ApiError) {
    return error.status === 401 || error.status === 403;
  }
  return false;
}

/**
 * Format validation errors for display
 */
export function formatValidationErrors(error: ValidationError): Record<string, string> {
  const formatted: Record<string, string> = {};

  if (error.fields) {
    for (const [field, messages] of Object.entries(error.fields)) {
      formatted[field] = messages[0] || 'Invalid value';
    }
  }

  return formatted;
}
