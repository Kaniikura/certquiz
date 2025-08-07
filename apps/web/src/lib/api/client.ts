/**
 * API Client for CertQuiz Backend
 * Simple fetch-based client for communicating with Hono API
 */

import { browser } from '$app/environment';

// API Base URL configuration
const API_BASE_URL = browser
  ? import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'
  : 'http://localhost:4000';

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

// Organized API endpoints
export const api = {
  // Health endpoint
  health: async (): Promise<Response> => {
    return fetch(`${API_BASE_URL}/health`);
  },

  // Auth endpoints
  auth: {
    login: async (credentials: { email: string; password: string }): Promise<Response> => {
      return fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });
    },
  },

  // Quiz endpoints
  quiz: {
    start: async (config: { questionCount: number; examType: string }): Promise<Response> => {
      return fetch(`${API_BASE_URL}/api/quiz/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
    },

    submitAnswer: async (
      sessionId: string,
      answer: { questionId: string; selectedOptions: string[] }
    ): Promise<Response> => {
      return fetch(`${API_BASE_URL}/api/quiz/${sessionId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(answer),
      });
    },

    complete: async (sessionId: string): Promise<Response> => {
      return fetch(`${API_BASE_URL}/api/quiz/${sessionId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
    },

    getResults: async (sessionId: string): Promise<Response> => {
      return fetch(`${API_BASE_URL}/api/quiz/${sessionId}/results`);
    },
  },

  // Question endpoints
  questions: {
    list: async (params?: {
      page?: number;
      limit?: number;
      examType?: string;
    }): Promise<Response> => {
      const url = new URL(`${API_BASE_URL}/api/questions`);
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined) url.searchParams.set(key, value.toString());
        });
      }
      return fetch(url.toString());
    },

    get: async (id: string): Promise<Response> => {
      return fetch(`${API_BASE_URL}/api/questions/${id}`);
    },
  },

  // User endpoints
  users: {
    register: async (userData: {
      email: string;
      username: string;
      password: string;
    }): Promise<Response> => {
      return fetch(`${API_BASE_URL}/api/users/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });
    },

    profile: async (): Promise<Response> => {
      return fetch(`${API_BASE_URL}/api/users/profile`);
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
    return this.status >= 500;
  }

  get isNetworkError(): boolean {
    return this.status === 0;
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
export function createAuthenticatedFetch(token: string) {
  return (url: string, options: RequestInit = {}) => {
    return fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });
  };
}
