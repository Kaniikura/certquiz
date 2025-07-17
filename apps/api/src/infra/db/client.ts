import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Type aliases for Drizzle database and transaction
export type DB = PostgresJsDatabase<typeof schema>;
export type Tx = Parameters<DB['transaction']>[0] extends (tx: infer T) => unknown ? T : never;

// Queryable interface for repositories to work with both DB and Tx
export type Queryable = Pick<DB, 'select' | 'insert' | 'update' | 'delete' | 'execute' | 'query'>;

/**
 * Connection pool configuration based on environment
 */
function getPoolConfig(environment: string) {
  const common = {
    idle_timeout: 30, // Close idle connections after 30 seconds
    max_lifetime: 60 * 60, // Recycle connections after 1 hour
    connect_timeout: 10, // 10 second connection timeout
  };

  switch (environment) {
    case 'test':
      return {
        ...common,
        max: 1, // Single connection for deterministic tests
        prepare: false, // Disable prepared statements for tests
      };

    case 'development':
      return {
        ...common,
        max: 5, // Small pool for development
      };

    case 'production':
      return {
        ...common,
        max: Number(process.env.DB_POOL_MAX ?? 20), // Configurable pool size
      };

    default:
      return {
        ...common,
        max: 5, // Default to development settings
      };
  }
}

/**
 * Validates the DATABASE_URL format
 */
function validateDatabaseUrl(url: string | undefined): void {
  if (!url) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  if (!url.startsWith('postgresql://') && !url.startsWith('postgres://')) {
    throw new Error(
      'DATABASE_URL must be a valid PostgreSQL connection string starting with postgresql:// or postgres://'
    );
  }

  try {
    new URL(url);
  } catch (_error) {
    throw new Error('DATABASE_URL is not a valid URL format');
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

    // Validate DATABASE_URL
    validateDatabaseUrl(databaseUrl);

    // After validation, databaseUrl is guaranteed to be defined
    const validDatabaseUrl = databaseUrl as string;

    // Create postgres connection with environment-specific config
    const poolConfig = getPoolConfig(nodeEnv);
    _pool = postgres(validDatabaseUrl, poolConfig);

    // Create Drizzle instance with schema
    _db = drizzle(_pool, {
      logger: nodeEnv === 'development',
      schema,
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
export function getPool(): postgres.Sql {
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

// Export the database type
export type DrizzleDb = DB;

/**
 * Health check function
 * Throws an error if the database is unreachable
 */
export async function ping(): Promise<void> {
  const pool = getPool();
  await pool`SELECT 1`; // Will throw if DB is unreachable
}

/**
 * Gracefully shutdown the database connection
 */
export async function shutdownDatabase(): Promise<void> {
  // Only shutdown if initialized
  if (_pool) {
    try {
      await _pool.end({ timeout: 5 }); // 5 second timeout
      // Reset for clean state
      _pool = undefined;
      _db = undefined;
    } catch (error) {
      // Log error but don't throw - we want graceful shutdown
      const nodeEnv = process.env.NODE_ENV || 'development';
      if (nodeEnv !== 'test') {
        // biome-ignore lint/suspicious/noConsole: Critical shutdown error logging
        console.error('[database] Error during shutdown:', error);
      }
    }
  }
}

// Register graceful shutdown handlers
if (typeof process !== 'undefined') {
  const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];

  signals.forEach((signal) => {
    process.on(signal, async () => {
      await shutdownDatabase();
      process.exit(0);
    });
  });
}
