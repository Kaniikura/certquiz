import type { DB } from './types';

/**
 * Database provider interface for flexible database connection management
 * Supports both production singleton and test isolation strategies
 */
export interface IDatabaseProvider {
  /**
   * Get a database instance with optional configuration
   * @param options - Configuration for database connection
   * @returns Promise resolving to database instance
   */
  getDatabase(options?: DatabaseOptions): Promise<DB>;

  /**
   * Check if provider has an active connection
   * @param key - Optional key to check specific connection
   */
  hasConnection(key?: string): boolean;

  /**
   * Get statistics about current connections
   */
  getConnectionStats(): ConnectionStats;

  /**
   * Gracefully shutdown all database connections
   */
  shutdown(): Promise<void>;
}

/**
 * Options for database connection configuration
 */
export interface DatabaseOptions {
  /** Override database URL (primarily for tests) */
  databaseUrl?: string;

  /** Worker ID for test isolation (e.g., VITEST_WORKER_ID) */
  workerId?: string;

  /** Custom pool configuration */
  poolConfig?: {
    max?: number;
    idleTimeout?: number;
    connectTimeout?: number;
  };

  /** Force new connection (bypass cache) */
  forceNew?: boolean;
}

/**
 * Statistics about database connections
 */
export interface ConnectionStats {
  activeConnections: number;
  totalConnections: number;
  connectionKeys: string[];
}
