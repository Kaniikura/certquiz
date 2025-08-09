/**
 * API Client for CertQuiz Backend
 * Simple fetch-based client for communicating with Hono API
 */

// API Base URL configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

// Type definitions for API responses
export interface ApiResponse<T = unknown> {
  success?: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface HealthResponse {
  status: string;
  message?: string;
}

/**
 * Creates an AbortSignal that times out after the specified milliseconds.
 * Provides a fallback for browsers that don't support AbortSignal.timeout().
 *
 * @param milliseconds - The timeout duration in milliseconds
 * @returns An AbortSignal that will abort after the timeout
 */
function createTimeoutSignal(milliseconds: number): AbortSignal {
  // Check if native AbortSignal.timeout is supported
  if ('timeout' in AbortSignal && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(milliseconds);
  }

  // Fallback: Create manual timeout with AbortController for older browsers
  const controller = new AbortController();
  setTimeout(() => controller.abort(), milliseconds);
  return controller.signal;
}

/**
 * Creates standardized API request configuration with defaults
 *
 * Provides consistent configuration for all API requests including:
 * - Accept: application/json header for all requests
 * - Content-Type: application/json header only when request has a body
 * - 10-second request timeout with browser compatibility fallback
 * - Extensible options that can be overridden per request
 *
 * @param options - Custom RequestInit options to merge with defaults
 * @returns RequestInit with merged configuration and timeout
 *
 * @example
 * ```typescript
 * // POST request with body (Content-Type added automatically)
 * fetch(url, createApiConfig({
 *   method: 'POST',
 *   body: JSON.stringify(data)
 * }));
 *
 * // GET request (no Content-Type, only Accept header)
 * fetch(url, createApiConfig({
 *   method: 'GET'
 * }));
 *
 * // Override default headers
 * fetch(url, createApiConfig({
 *   headers: { 'Authorization': 'Bearer token' }
 * }));
 *
 * // Custom timeout with fallback support
 * fetch(url, createApiConfig({
 *   signal: createTimeoutSignal(5000) // 5 seconds
 * }));
 * ```
 */
export const createApiConfig = (options: RequestInit = {}): RequestInit => {
  // Build headers based on request characteristics
  const headers: Record<string, string> = {
    // Always accept JSON responses
    Accept: 'application/json',
  };

  // Merge with existing headers if they exist
  if (options.headers) {
    // Convert headers to a plain object if needed
    const existingHeaders =
      options.headers instanceof Headers
        ? Object.fromEntries(options.headers.entries())
        : (options.headers as Record<string, string>);

    Object.assign(headers, existingHeaders);
  }

  // Only set Content-Type for requests with a body (if not already set)
  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  return {
    ...options,
    headers,
    signal: options.signal || createTimeoutSignal(10000),
  };
};

// Organized API endpoints with built-in error handling
export const api = {
  // Health endpoint
  health: async (): Promise<HealthResponse | null> => {
    return apiFetch<HealthResponse>(`${API_BASE_URL}/health`);
  },

  // Auth endpoints
  auth: {
    login: async (credentials: {
      email: string;
      password: string;
    }): Promise<ApiResponse | null> => {
      return apiFetch<ApiResponse>(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        body: JSON.stringify(credentials),
      });
    },
  },

  // Quiz endpoints
  quiz: {
    start: async (config: {
      questionCount: number;
      examType: string;
    }): Promise<ApiResponse | null> => {
      return apiFetch<ApiResponse>(`${API_BASE_URL}/api/quiz/start`, {
        method: 'POST',
        body: JSON.stringify(config),
      });
    },

    submitAnswer: async (
      sessionId: string,
      answer: { questionId: string; selectedOptions: string[] }
    ): Promise<ApiResponse | null> => {
      return apiFetch<ApiResponse>(`${API_BASE_URL}/api/quiz/${sessionId}/submit`, {
        method: 'POST',
        body: JSON.stringify(answer),
      });
    },

    complete: async (sessionId: string): Promise<ApiResponse | null> => {
      return apiFetch<ApiResponse>(`${API_BASE_URL}/api/quiz/${sessionId}/complete`, {
        method: 'POST',
      });
    },

    getResults: async (sessionId: string): Promise<ApiResponse | null> => {
      return apiFetch<ApiResponse>(`${API_BASE_URL}/api/quiz/${sessionId}/results`);
    },
  },

  // Question endpoints
  questions: {
    list: async (params?: {
      page?: number;
      limit?: number;
      examType?: string;
    }): Promise<ApiResponse | null> => {
      const url = new URL(`${API_BASE_URL}/api/questions`);
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined) url.searchParams.set(key, value.toString());
        });
      }
      return apiFetch<ApiResponse>(url.toString());
    },

    get: async (id: string): Promise<ApiResponse | null> => {
      return apiFetch<ApiResponse>(`${API_BASE_URL}/api/questions/${id}`);
    },
  },

  // User endpoints
  users: {
    register: async (userData: {
      email: string;
      username: string;
      password: string;
    }): Promise<ApiResponse | null> => {
      return apiFetch<ApiResponse>(`${API_BASE_URL}/api/users/register`, {
        method: 'POST',
        body: JSON.stringify(userData),
      });
    },

    profile: async (): Promise<ApiResponse | null> => {
      return apiFetch<ApiResponse>(`${API_BASE_URL}/api/users/profile`);
    },
  },
} as const;

// Enhanced API error handling helper
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public response?: unknown
  ) {
    super(message);
    this.name = 'ApiError';

    // Ensure stack trace points to actual error location
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }

  get isClientError(): boolean {
    return this.status >= 400 && this.status < 500;
  }

  get isServerError(): boolean {
    return this.status >= 500 && this.status < 600;
  }

  get isNetworkError(): boolean {
    return this.status === 0;
  }
}

/**
 * Centralized fetch helper with built-in error handling
 *
 * Performs a fetch request with automatic error checking, status validation,
 * and appropriate response parsing based on content type. Throws ApiError for
 * non-2xx responses.
 *
 * @param url The URL to fetch
 * @param config Optional fetch configuration
 * @returns Promise<T | null> Parsed response (JSON for application/json, null for 204 No Content, text for others)
 * @throws {ApiError} For HTTP errors (4xx, 5xx) or network errors
 */
async function apiFetch<T>(url: string, config?: RequestInit): Promise<T | null> {
  try {
    const response = await fetch(url, createApiConfig(config));

    if (!response.ok) {
      // Try to extract error message from response body
      let errorBody: unknown;
      try {
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          errorBody = await response.json();
        } else {
          errorBody = await response.text();
        }
      } catch {
        errorBody = 'Unable to read error response';
      }

      throw new ApiError(
        `HTTP ${response.status}: ${response.statusText}`,
        response.status,
        errorBody
      );
    }

    // Handle 204 No Content responses
    if (response.status === 204) {
      return null;
    }

    // Check Content-Type to determine how to parse the response
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      return await response.json();
    }

    // For non-JSON responses, return the text content
    // This allows the API to return text/plain or text/html if needed
    const text = await response.text();
    return text as unknown as T;
  } catch (error) {
    // Re-throw ApiError as-is
    if (error instanceof ApiError) {
      throw error;
    }

    // Handle network/other errors
    if (error instanceof Error) {
      throw new ApiError(`Network error: ${error.message}`, 0, error);
    }

    throw new ApiError('Unknown error occurred', 0, error);
  }
}

/**
 * Enhanced response wrapper with proper HTTP error handling
 *
 * Handles HTTP responses with proper status code checking, error extraction,
 * and JSON parsing. Throws ApiError for HTTP errors with detailed context.
 *
 * @param apiCall Function that returns a Promise<Response>
 * @returns Promise<T> Parsed JSON response data
 * @throws {ApiError} For HTTP errors (4xx, 5xx) or network errors
 *
 * @example
 * ```typescript
 * const user = await handleApiResponse<User>(() => api.users.profile());
 * ```
 */
export async function handleApiResponse<T>(apiCall: () => Promise<Response>): Promise<T> {
  try {
    const response = await apiCall();

    if (!response.ok) {
      // Try to extract error message from response body
      let errorBody: string;
      try {
        errorBody = await response.text();
      } catch {
        errorBody = 'Unable to read error response';
      }

      throw new ApiError(
        `HTTP ${response.status}: ${response.statusText}`,
        response.status,
        errorBody
      );
    }

    return await response.json();
  } catch (error) {
    // Re-throw ApiError as-is
    if (error instanceof ApiError) {
      throw error;
    }

    // Handle network/other errors
    if (error instanceof Error) {
      throw new ApiError(`Network error: ${error.message}`, 0, error);
    }

    throw new ApiError('Unknown error occurred', 0, error);
  }
}

// Authenticated API wrapper (for future auth integration)
export function createAuthenticatedFetch(
  token: string
): (url: string, options?: RequestInit) => Promise<Response> {
  return (url: string, options: RequestInit = {}) => {
    return fetch(
      url,
      createApiConfig({
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${token}`,
        },
      })
    );
  };
}
