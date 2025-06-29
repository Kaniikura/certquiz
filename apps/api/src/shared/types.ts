/**
 * Shared TypeScript types for the API
 */

/**
 * API response format
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  page: number;
  limit: number;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Request context (set by middleware)
 */
export interface RequestContext {
  requestId: string;
  startTime: number;
  user?: AuthUser;
}

/**
 * Authenticated user
 */
export interface AuthUser {
  id: string;
  email: string;
  username: string;
  role: UserRole;
}

/**
 * User roles
 */
export type UserRole = 'guest' | 'user' | 'premium' | 'admin';

/**
 * Type for async request handlers
 */
export type AsyncHandler<T = unknown> = () => Promise<T>;

/**
 * Environment type
 */
export type Environment = 'development' | 'test' | 'production';

/**
 * Health check status
 */
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  details?: Record<string, unknown>;
}

/**
 * Service health check
 */
export interface ServiceHealth {
  name: string;
  status: HealthStatus;
  responseTime?: number;
}

/**
 * Common database timestamps
 */
export interface Timestamps {
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Utility type to make all properties optional except the specified keys
 */
export type PartialExcept<T, K extends keyof T> = Partial<T> & Pick<T, K>;

/**
 * Utility type to make specified properties optional
 */
export type PartialPick<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Utility type for nullable properties
 */
export type Nullable<T> = T | null;

/**
 * Utility type for JSON-serializable values
 */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };
