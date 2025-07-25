import postgres from 'postgres';
import {
  createDrizzleInstance,
  PoolConfigs,
  performHealthCheck,
  shutdownConnection,
  validateDatabaseUrl,
} from './shared';
import type { DB } from './types';

/**
 * Get environment-specific pool configuration
 * Uses shared pool configurations with environment-specific settings
 */
function getPoolConfig(environment: string) {
  switch (environment) {
    case 'development':
      return PoolConfigs.development();

    case 'production': {
      let maxConnections: number | undefined;
      if (process.env.DB_POOL_MAX) {
        const parsed = parseInt(process.env.DB_POOL_MAX, 10);
        maxConnections = Number.isNaN(parsed) ? undefined : parsed;
      }
      return PoolConfigs.production(maxConnections);
    }

    default:
      return PoolConfigs.development(); // Default to development settings
  }
}

// Lazy initialization variables
let _pool: postgres.Sql | undefined;
let _db: DB | undefined;

/**
 * Initialize the database connection
 * Called lazily on first use or explicitly from composition root
 */
function initializeDatabase(): { pool: postgres.Sql; db: DB } {
  if (!_pool || !_db) {
    const databaseUrl = process.env.DATABASE_URL;
    const nodeEnv = process.env.NODE_ENV || 'development';

    // Validate DATABASE_URL using shared utility
    const validDatabaseUrl = validateDatabaseUrl(databaseUrl);

    // Create postgres connection with environment-specific config
    const poolConfig = getPoolConfig(nodeEnv);
    _pool = postgres(validDatabaseUrl, poolConfig);

    // Create Drizzle instance using shared utility
    _db = createDrizzleInstance(_pool, {
      enableLogging: nodeEnv === 'development',
      environment: nodeEnv,
    });
  }

  // TypeScript doesn't understand that _pool and _db are guaranteed to be non-null here
  // due to the lazy initialization pattern. We'll cast them safely.
  return { pool: _pool as postgres.Sql, db: _db as DB };
}

/**
 * Get the database connection pool
 * Initializes on first use
 */
function getPool(): postgres.Sql {
  const { pool } = initializeDatabase();
  return pool;
}

/**
 * Get the Drizzle database instance
 * Initializes on first use
 */
export function getDb(): DB {
  const { db } = initializeDatabase();
  return db;
}

// Export for backward compatibility during migration
// These will be removed once all code is updated to use getDb()/getPool()
export const pool = new Proxy({} as postgres.Sql, {
  get(_target, prop, receiver) {
    const actualPool = getPool();
    const value = Reflect.get(actualPool, prop, receiver);
    return typeof value === 'function' ? value.bind(actualPool) : value;
  },
});

export const db = new Proxy({} as DB, {
  get(_target, prop, receiver) {
    const actualDb = getDb();
    const value = Reflect.get(actualDb, prop, receiver);
    return typeof value === 'function' ? value.bind(actualDb) : value;
  },
});

/**
 * Health check function
 * Throws an error if the database is unreachable
 */
export async function ping(): Promise<void> {
  const pool = getPool();
  await performHealthCheck(pool);
}

/**
 * Gracefully shutdown the database connection
 */
export async function shutdownDatabase(): Promise<void> {
  await shutdownConnection(_pool, {
    timeout: 5,
    onError: (error) => {
      // Log error but don't throw - we want graceful shutdown
      // biome-ignore lint/suspicious/noConsole: Critical shutdown error logging
      console.error('[database] Error during shutdown:', error);
    },
  });

  // Reset for clean state
  _pool = undefined;
  _db = undefined;
}

// Register graceful shutdown handlers for production and development
// Test environments use their own cleanup mechanisms
if (typeof process !== 'undefined') {
  const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];

  signals.forEach((signal) => {
    process.on(signal, async () => {
      await shutdownDatabase();
      process.exit(0);
    });
  });
}

// Re-export types for external use
export type { DB, Queryable, Tx } from './types';
