import type { ApiResponse } from '../types';

// Result type for error handling
export type Result<T, E = Error> = { success: true; data: T } | { success: false; error: E };

// Create success result
export function ok<T>(data: T): Result<T> {
  return { success: true, data };
}

// Create error result
export function err<E = Error>(error: E): Result<never, E> {
  return { success: false, error };
}

// Type guard for checking if result is success
export function isOk<T, E>(result: Result<T, E>): result is { success: true; data: T } {
  return result.success === true;
}

// Type guard for checking if result is error
export function isErr<T, E>(result: Result<T, E>): result is { success: false; error: E } {
  return result.success === false;
}

// Calculate quiz accuracy
export function calculateAccuracy(correct: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((correct / total) * 100);
}

// Calculate experience points
export function calculateExperience(correct: number, total: number, timeSpent: number): number {
  const basePoints = correct * 10;
  const accuracyBonus = calculateAccuracy(correct, total) >= 80 ? 20 : 0;
  const speedBonus = timeSpent < 60 ? 10 : 0; // Less than 1 minute per question
  return basePoints + accuracyBonus + speedBonus;
}

// Calculate user level from experience
export function calculateLevel(experience: number): number {
  // Level up every 100 experience points
  return Math.floor(experience / 100) + 1;
}

// Format duration in seconds to human-readable string
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

// Calculate duration between two dates in seconds
export function calculateDuration(start: Date, end?: Date): number {
  const endTime = end || new Date();
  return Math.floor((endTime.getTime() - start.getTime()) / 1000);
}

// Shuffle array using Fisher-Yates algorithm
export function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Validate email format
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Sanitize HTML to prevent XSS
export function sanitizeHtml(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

// Create API response
export function apiResponse<T>(data: T, meta?: ApiResponse<T>['meta']): ApiResponse<T> {
  return {
    success: true,
    data,
    ...(meta && { meta }),
  };
}

// Create API error response
export function apiError(code: string, message: string, details?: unknown): ApiResponse<never> {
  return {
    success: false,
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
  };
}

// Debounce function
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Throttle function
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

// Deep clone object
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as T;
  if (Array.isArray(obj)) return obj.map((item) => deepClone(item)) as T;

  const cloned = {} as T;
  for (const key in obj) {
    if (Object.hasOwn(obj, key)) {
      cloned[key] = deepClone(obj[key]);
    }
  }
  return cloned;
}

// Check if object is empty
export function isEmpty(obj: Record<string, unknown>): boolean {
  return Object.keys(obj).length === 0;
}

// Paginate array
export function paginate<T>(
  array: T[],
  page: number,
  limit: number
): { items: T[]; total: number; page: number; pages: number } {
  const start = (page - 1) * limit;
  const end = start + limit;
  const items = array.slice(start, end);
  const total = array.length;
  const pages = Math.ceil(total / limit);

  return { items, total, page, pages };
}

// Generate random ID (for testing/mocking)
export function generateId(): string {
  return crypto.randomUUID();
}

// Check if user has required role
export function hasRole(userRole: string, requiredRole: string): boolean {
  const roleHierarchy = ['guest', 'user', 'premium', 'admin'];
  const userIndex = roleHierarchy.indexOf(userRole);
  const requiredIndex = roleHierarchy.indexOf(requiredRole);
  return userIndex >= requiredIndex;
}
