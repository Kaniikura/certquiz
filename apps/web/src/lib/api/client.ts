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
  health: async (): Promise<HealthResponse> => {
    const response = await fetch(`${API_BASE_URL}/health`);
    return await response.json();
  },

  // Auth endpoints
  auth: {
    login: async (credentials: { email: string; password: string }) => {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });
      return await response.json();
    },
  },

  // Quiz endpoints
  quiz: {
    start: async (config: { questionCount: number; examType: string }) => {
      const response = await fetch(`${API_BASE_URL}/api/quiz/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      return await response.json();
    },

    submitAnswer: async (
      sessionId: string,
      answer: { questionId: string; selectedOptions: string[] }
    ) => {
      const response = await fetch(`${API_BASE_URL}/api/quiz/${sessionId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(answer),
      });
      return await response.json();
    },

    complete: async (sessionId: string) => {
      const response = await fetch(`${API_BASE_URL}/api/quiz/${sessionId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      return await response.json();
    },

    getResults: async (sessionId: string) => {
      const response = await fetch(`${API_BASE_URL}/api/quiz/${sessionId}/results`);
      return await response.json();
    },
  },

  // Question endpoints
  questions: {
    list: async (params?: { page?: number; limit?: number; examType?: string }) => {
      const url = new URL(`${API_BASE_URL}/api/questions`);
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined) url.searchParams.set(key, value.toString());
        });
      }
      const response = await fetch(url.toString());
      return await response.json();
    },

    get: async (id: string) => {
      const response = await fetch(`${API_BASE_URL}/api/questions/${id}`);
      return await response.json();
    },
  },

  // User endpoints
  users: {
    register: async (userData: { email: string; username: string; password: string }) => {
      const response = await fetch(`${API_BASE_URL}/api/users/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });
      return await response.json();
    },

    profile: async () => {
      const response = await fetch(`${API_BASE_URL}/api/users/profile`);
      return await response.json();
    },
  },
} as const;

// API error handling helper
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public response?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Response wrapper for error handling
export async function handleApiResponse<T>(apiCall: () => Promise<T>): Promise<T> {
  try {
    const response = await apiCall();
    return response;
  } catch (error) {
    if (error instanceof Error) {
      throw new ApiError(error.message, 0, error);
    }

    throw new ApiError('Unknown error', 0, error);
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
