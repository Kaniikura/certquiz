import { drizzle } from 'drizzle-orm/postgres-js';
import postgres, { type Sql } from 'postgres';
import * as schema from '../db/schema';

/**
 * Database interface that wraps Drizzle ORM with additional functionality
 */
export interface Database {
  // Drizzle ORM methods
  select: ReturnType<typeof drizzle>['select'];
  insert: ReturnType<typeof drizzle>['insert'];
  update: ReturnType<typeof drizzle>['update'];
  delete: ReturnType<typeof drizzle>['delete'];
  transaction: ReturnType<typeof drizzle>['transaction'];

  // Custom methods
  close(): Promise<void>;
  ping(): Promise<boolean>;
}

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

/**
 * Creates a new database connection with proper configuration
 */
export function createDatabase(): Database {
  const databaseUrl = process.env.DATABASE_URL;
  const nodeEnv = process.env.NODE_ENV || 'development';

  // Validate DATABASE_URL
  validateDatabaseUrl(databaseUrl);

  // After validation, databaseUrl is guaranteed to be string
  const validDatabaseUrl = databaseUrl as string;

  // Create postgres connection with environment-specific config
  const poolConfig = getPoolConfig(nodeEnv);
  const sql: Sql = postgres(validDatabaseUrl, poolConfig);

  // Create Drizzle instance with schema
  const db = drizzle(sql, {
    schema,
    logger: nodeEnv === 'development',
  });

  // Track if connection is closed
  let isClosed = false;

  return {
    // Drizzle ORM methods
    select: db.select.bind(db),
    insert: db.insert.bind(db),
    update: db.update.bind(db),
    delete: db.delete.bind(db),
    transaction: db.transaction.bind(db),

    // Graceful shutdown
    async close(): Promise<void> {
      if (isClosed) {
        return; // Already closed, don't attempt again
      }

      try {
        await sql.end({ timeout: 5 }); // 5 second timeout
      } catch (error) {
        // Log error but don't throw - we want graceful shutdown
        if (nodeEnv !== 'test') {
          // Use console.error only for critical shutdown errors
          // In production, this would be replaced with proper logging
          // biome-ignore lint/suspicious/noConsole: Critical shutdown error logging
          console.error('[database] Forced close after timeout:', error);
        }
      } finally {
        // Always mark as closed, regardless of success/failure
        isClosed = true;
      }
    },

    // Health check
    async ping(): Promise<boolean> {
      if (isClosed) {
        return false;
      }

      try {
        await sql`SELECT 1`;
        return true;
      } catch (_error) {
        return false;
      }
    },
  };
}

// Singleton database instance
let dbInstance: Database | null = null;

/**
 * Gets or creates the singleton database instance
 */
export function getDatabase(): Database {
  if (!dbInstance) {
    dbInstance = createDatabase();
  }
  return dbInstance;
}

/**
 * Gracefully shutdown the database connection
 */
export async function shutdownDatabase(): Promise<void> {
  if (dbInstance) {
    try {
      await dbInstance.close();
    } catch (error) {
      // Suppress errors during shutdown
      const nodeEnv = process.env.NODE_ENV || 'development';
      if (nodeEnv !== 'test') {
        // Use console.error only for critical shutdown errors
        // In production, this would be replaced with proper logging
        // biome-ignore lint/suspicious/noConsole: Critical shutdown error logging
        console.error('[database] Error during shutdown:', error);
      }
    } finally {
      dbInstance = null;
    }
  }
}

// Register graceful shutdown handlers
if (typeof process !== 'undefined') {
  const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];

  signals.forEach((signal) => {
    process.on(signal, async () => {
      await shutdownDatabase();
    });
  });
}

// Type is already exported above with the interface declaration
