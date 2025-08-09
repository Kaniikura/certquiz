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
 * Custom AbortController with proper timeout cleanup
 * Prevents memory leaks by managing setTimeout lifecycle
 */
class CleanupAbortController extends AbortController {
  private timeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor(milliseconds: number) {
    super();
    this.timeoutId = setTimeout(() => {
      this.abort();
      this.timeoutId = null;
    }, milliseconds);
  }

  override abort(reason?: unknown): void {
    // Clear timeout to prevent memory leaks
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    super.abort(reason);
  }
}

/**
 * Creates an AbortSignal that times out after the specified milliseconds.
 * Provides a fallback for browsers that don't support AbortSignal.timeout().
 * The fallback implementation includes proper cleanup to prevent memory leaks.
 *
 * @param milliseconds - The timeout duration in milliseconds
 * @returns An AbortSignal that will abort after the timeout
 */
function createTimeoutSignal(milliseconds: number): AbortSignal {
  // Check if native AbortSignal.timeout is supported
  if ('timeout' in AbortSignal && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(milliseconds);
  }

  // Fallback: Create manual timeout with proper cleanup for older browsers
  const controller = new CleanupAbortController(milliseconds);
  return controller.signal;
}

/**
 * Normalize headers from any HeadersInit format to a plain object
 *
 * Handles all three possible HeadersInit types:
 * - Record<string, string> (plain object)
 * - string[][] (array of tuples)
 * - Headers instance
 *
 * @param headers Headers in any HeadersInit format
 * @returns Plain object with header key-value pairs
 */
function normalizeHeaders(headers?: HeadersInit): Record<string, string> {
  if (!headers) {
    return {};
  }

  // Handle Headers instance
  if (headers instanceof Headers) {
    return Object.fromEntries(headers.entries());
  }

  // Handle array of tuples
  if (Array.isArray(headers)) {
    const normalized: Record<string, string> = {};
    for (const [key, value] of headers) {
      // For duplicate keys, the last value wins (standard behavior)
      normalized[key] = value;
    }
    return normalized;
  }

  // Handle plain object
  return headers as Record<string, string>;
}

/**
 * Checks if the content type represents JSON data
 *
 * Handles all JSON-based media types including:
 * - application/json
 * - application/problem+json
 * - application/vnd.api+json
 * - And other +json suffixed types
 *
 * @param contentType The content-type header value
 * @returns true if the content type indicates JSON data
 */
function isJsonContentType(contentType: string | null): boolean {
  if (!contentType) {
    return false;
  }
  return contentType.includes('application/json') || contentType.includes('+json');
}

/**
 * Safely reads error response body based on content type
 *
 * Attempts to parse JSON for JSON content types, falls back to text
 * for other content types. Handles parsing errors gracefully.
 *
 * @param response The Response object to read from
 * @returns Promise resolving to the response body or error message
 */
async function readErrorResponseBody(response: Response): Promise<unknown> {
  try {
    const contentType = response.headers.get('content-type');
    if (isJsonContentType(contentType)) {
      return await response.json();
    }
    return await response.text();
  } catch {
    return 'Unable to read error response';
  }
}

/**
 * Parses successful response body based on content type and status
 *
 * Handles different response types appropriately:
 * - 204 No Content: returns null
 * - JSON content types: parses as JSON
 * - Other content types: returns as text (cast to T)
 *
 * @param response The successful Response object to parse
 * @returns Promise resolving to parsed response or null for 204
 */
async function parseResponse<T>(response: Response): Promise<T | null> {
  // Handle 204 No Content responses
  if (response.status === 204) {
    return null;
  }

  // Check Content-Type to determine parsing method
  const contentType = response.headers.get('content-type');
  if (isJsonContentType(contentType)) {
    return await response.json();
  }

  // For non-JSON responses, return as text (cast to T for flexibility)
  const text = await response.text();
  return text as unknown as T;
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

  // Merge with existing headers if they exist (properly normalized)
  const existingHeaders = normalizeHeaders(options.headers);
  Object.assign(headers, existingHeaders);

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
      const errorBody = await readErrorResponseBody(response);
      throw new ApiError(
        `HTTP ${response.status}: ${response.statusText}`,
        response.status,
        errorBody
      );
    }

    return await parseResponse<T>(response);
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
 * Returns null for non-JSON responses to maintain backward compatibility.
 *
 * @param apiCall Function that returns a Promise<Response>
 * @returns Promise<T | null> Parsed JSON response data, or null for 204/non-JSON responses
 * @throws {ApiError} For HTTP errors (4xx, 5xx) or network errors
 *
 * @example
 * ```typescript
 * const user = await handleApiResponse<User>(() => api.users.profile());
 * ```
 */
export async function handleApiResponse<T>(apiCall: () => Promise<Response>): Promise<T | null> {
  try {
    const response = await apiCall();

    if (!response.ok) {
      const errorBody = await readErrorResponseBody(response);
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

    // For handleApiResponse, only return JSON content, null for others (backward compatibility)
    const contentType = response.headers.get('content-type');
    if (isJsonContentType(contentType)) {
      return await response.json();
    }

    return null;
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
    // Normalize headers to plain object first
    const normalizedHeaders = normalizeHeaders(options.headers);

    // Only add Authorization if not already present
    if (!normalizedHeaders.Authorization && !normalizedHeaders.authorization) {
      normalizedHeaders.Authorization = `Bearer ${token}`;
    }

    return fetch(
      url,
      createApiConfig({
        ...options,
        headers: normalizedHeaders,
      })
    );
  };
}
