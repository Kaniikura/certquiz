import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

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

// Create the connection pool
const databaseUrl = process.env.DATABASE_URL;
const nodeEnv = process.env.NODE_ENV || 'development';

// Validate DATABASE_URL
validateDatabaseUrl(databaseUrl);

// After validation, databaseUrl is guaranteed to be defined
const validDatabaseUrl = databaseUrl as string;

// Create postgres connection with environment-specific config
const poolConfig = getPoolConfig(nodeEnv);
export const pool = postgres(validDatabaseUrl, poolConfig);

// Create Drizzle instance without schema for now (Day 1 infrastructure)
// Schema will be added incrementally as we implement slices
export const db = drizzle(pool, {
  logger: nodeEnv === 'development',
});

// Export the database type
export type DrizzleDb = PostgresJsDatabase;

/**
 * Health check function
 */
export async function ping(): Promise<boolean> {
  try {
    await pool`SELECT 1`;
    return true;
  } catch (_error) {
    return false;
  }
}

/**
 * Gracefully shutdown the database connection
 */
export async function shutdownDatabase(): Promise<void> {
  try {
    await pool.end({ timeout: 5 }); // 5 second timeout
  } catch (error) {
    // Log error but don't throw - we want graceful shutdown
    if (nodeEnv !== 'test') {
      // biome-ignore lint/suspicious/noConsole: Critical shutdown error logging
      console.error('[database] Error during shutdown:', error);
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
