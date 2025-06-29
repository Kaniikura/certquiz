import { random } from 'es-toolkit';
import type { Logger } from 'pino';
import type { RedisClientOptions, RedisClientType } from 'redis';
import { createClient } from 'redis';
import { createLogger } from './logger';

let logger = createLogger('redis');

/**
 * Cache interface for abstracted cache operations
 */
export interface Cache {
  init(): Promise<void>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  close(): Promise<void>;
  // Health check method
  ping(): Promise<string>;
}

/**
 * Set a custom logger instance for testing purposes
 * @param customLogger Logger instance to use
 */
export function setLogger(customLogger: Logger): void {
  logger = customLogger;
}

/**
 * Reset logger to default instance
 */
export function resetLogger(): void {
  logger = createLogger('redis');
}

/**
 * Parse Redis connection URL
 * @param url Redis connection URL (e.g., redis://user:pass@localhost:6379/0)
 * @param activeLogger Logger instance to use
 * @returns Partial Redis options or empty object if parsing fails
 * @throws Never - errors are logged and empty object returned to allow fallback to defaults
 */
function parseRedisUrl(url: string, activeLogger = logger): Partial<RedisClientOptions> {
  try {
    const parsed = new URL(url);
    return {
      url: url,
      // Extract database from pathname if present
      database: parsed.pathname ? parseInt(parsed.pathname.slice(1) || '0', 10) : 0,
    };
  } catch (error) {
    activeLogger.error({ err: error as Error, url }, 'Failed to parse Redis URL');
    activeLogger.warn('Using default Redis configuration due to invalid REDIS_URL');
    // Return empty object to allow fallback to default configuration
    // This prevents the app from crashing due to misconfiguration
    return {};
  }
}

/**
 * Validate Redis configuration
 */
function validateRedisConfig(config: RedisClientOptions): void {
  const errors: string[] = [];

  // For URL-based config, validate the URL
  if (config.url) {
    try {
      const parsed = new URL(config.url);

      // Validate protocol
      if (!['redis:', 'rediss:'].includes(parsed.protocol)) {
        errors.push(`Invalid Redis protocol: ${parsed.protocol}. Must be redis: or rediss:`);
      }

      // Validate port
      const port = parseInt(parsed.port || '6379', 10);
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        errors.push(`Redis port must be between 1 and 65535, got ${port}`);
      }
    } catch (_urlError) {
      errors.push(`Invalid Redis URL: ${config.url}`);
    }
  }

  // Validate database index
  if (
    config.database !== undefined &&
    (!Number.isInteger(config.database) || config.database < 0 || config.database > 15)
  ) {
    errors.push(`Redis database must be between 0 and 15, got ${config.database}`);
  }

  // Validate connection timeout
  if (config.socket?.connectTimeout && config.socket.connectTimeout < 0) {
    errors.push(`Redis connectTimeout must be positive, got ${config.socket.connectTimeout}`);
  }

  if (errors.length > 0) {
    const error = new Error(`Invalid Redis configuration: ${errors.join(', ')}`);
    logger.error({ errors }, 'Redis configuration validation failed');
    throw error;
  }

  logger.debug(
    {
      url: config.url,
      database: config.database,
    },
    'Redis configuration validated successfully'
  );
}

/**
 * Get Redis configuration from environment variables
 * @param env Environment variables object
 * @param customLogger Optional logger instance for testing
 */
export function getRedisConfig(
  env: Record<string, string | undefined> = process.env,
  customLogger?: Logger
): RedisClientOptions {
  // Use custom logger if provided
  const activeLogger = customLogger || logger;

  const baseConfig: RedisClientOptions = {
    url: 'redis://localhost:6379',
    socket: {
      reconnectStrategy: (retries: number) => {
        const maxRetries = parseInt(env.REDIS_MAX_RETRIES || '10', 10);
        if (retries <= 0 || retries >= maxRetries) {
          if (retries >= maxRetries) {
            activeLogger.warn(
              { attempts: retries, maxRetries },
              'Max retry attempts reached. Connection failed.'
            );
          }
          return false; // Stop retrying
        }

        // Exponential backoff with jitter: base * 2^(retries-1) + random jitter
        const baseDelay = Math.min(2 ** (retries - 1) * 1000, 16000);
        // Add jitter: ±20% of base delay to prevent thundering herd
        const jitter = random(baseDelay * 0.8, baseDelay * 1.2);
        const delay = Math.round(jitter);

        activeLogger.info(
          {
            attempt: retries,
            maxAttempts: maxRetries,
            delay,
            baseDelay,
            jitter: delay - baseDelay,
          },
          `Retry attempt ${retries}/${maxRetries}`
        );

        return delay;
      },
      keepAlive: 30000,
    },
  };

  // Apply environment-specific configuration
  if (env.REDIS_URL !== undefined) {
    // REDIS_URL takes precedence (even if empty string)
    const urlConfig = parseRedisUrl(env.REDIS_URL, activeLogger);
    // Only apply URL config if parsing was successful (url property exists)
    if (urlConfig.url) {
      Object.assign(baseConfig, urlConfig);
    }
    // If parsing failed, we'll stick with the default configuration
  } else {
    // Fallback to individual variables
    const host = env.REDIS_HOST || 'localhost';
    const port = env.REDIS_PORT || '6379';
    const password = env.REDIS_PASSWORD;
    const database = env.REDIS_DB || '0';

    let urlStr = `redis://${host}:${port}`;
    if (password) {
      urlStr = `redis://:${password}@${host}:${port}`;
    }
    if (database !== '0') {
      urlStr += `/${database}`;
    }

    baseConfig.url = urlStr;
  }

  // Apply additional configuration options
  if (env.REDIS_CONNECT_TIMEOUT) {
    if (!baseConfig.socket) baseConfig.socket = {};
    baseConfig.socket.connectTimeout = parseInt(env.REDIS_CONNECT_TIMEOUT, 10);
  }

  // Validate the final configuration
  try {
    validateRedisConfig(baseConfig);
  } catch (error) {
    activeLogger.warn('Using default Redis configuration despite validation errors');
    // In development, we reset to defaults. In production, this should probably throw.
    if (env.NODE_ENV === 'production') {
      throw error;
    } else {
      // Reset to safe defaults when validation fails
      baseConfig.url = 'redis://localhost:6379';
      baseConfig.database = 0;
    }
  }

  return baseConfig;
}

/**
 * Create a Redis client instance
 */
export function createRedisClient(
  env: Record<string, string | undefined> = process.env
): RedisClientType {
  const config = getRedisConfig(env);
  const client = createClient(config) as RedisClientType;

  // Error handling
  client.on('error', (err) => {
    logger.error(
      {
        err,
        url: config.url,
      },
      'Redis client error'
    );
  });

  client.on('connect', () => {
    logger.info(
      {
        url: config.url,
      },
      'Redis client connected'
    );
  });

  client.on('ready', () => {
    logger.info(
      {
        url: config.url,
      },
      'Redis client ready'
    );
  });

  client.on('end', () => {
    logger.warn(
      {
        url: config.url,
      },
      'Redis client connection ended'
    );
  });

  client.on('reconnecting', () => {
    logger.info(
      {
        url: config.url,
      },
      'Redis client reconnecting'
    );
  });

  return client;
}

/**
 * Singleton Redis client for the application
 */
let redisClient: RedisClientType | null = null;

/**
 * Get or create the singleton Redis client
 * Note: This function is now async because connection is required
 */
export async function getRedisClient(): Promise<RedisClientType> {
  if (!redisClient) {
    redisClient = createRedisClient();
  }

  if (!redisClient.isOpen) {
    await redisClient.connect();
  }

  return redisClient;
}

/**
 * Close the Redis connection gracefully
 */
export async function closeRedisConnection(): Promise<void> {
  if (redisClient) {
    logger.info('Closing Redis connection...');

    try {
      // Set a timeout for graceful shutdown (5 seconds)
      const shutdownTimeoutMs = 5000;
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Redis shutdown timeout for ${redisClient?.options?.url}`)),
          shutdownTimeoutMs
        )
      );

      // Try to quit gracefully
      const quitPromise = redisClient.quit();

      await Promise.race([quitPromise, timeoutPromise]);

      logger.info('Redis connection closed gracefully');
    } catch (error) {
      logger.error({ err: error as Error }, 'Error during Redis shutdown, forcing disconnect');
      // Force disconnect if graceful shutdown fails
      await redisClient.disconnect();
    } finally {
      redisClient = null;
    }
  }
}

/**
 * Graceful shutdown state
 */
let isShuttingDown = false;
let shutdownTimeout: NodeJS.Timeout | null = null;

/**
 * Setup graceful shutdown handlers
 */
export function setupGracefulShutdown(): void {
  const shutdownHandler = async (signal: string) => {
    // Prevent multiple shutdowns
    if (isShuttingDown) {
      logger.warn({ signal }, 'Shutdown already in progress, ignoring signal');
      return;
    }

    isShuttingDown = true;
    logger.info({ signal }, 'Received signal, starting graceful shutdown...');

    // Set a forced exit timeout (30 seconds)
    shutdownTimeout = setTimeout(() => {
      logger.error('Forced shutdown due to timeout');
      process.exit(1);
    }, 30000);

    try {
      await closeRedisConnection();
      logger.info('Graceful shutdown completed');

      // Clear the forced exit timeout
      if (shutdownTimeout) {
        clearTimeout(shutdownTimeout);
        shutdownTimeout = null;
      }

      // Let the process exit naturally instead of calling process.exit()
      // This allows other cleanup handlers to run
    } catch (error) {
      logger.error({ err: error as Error }, 'Error during graceful shutdown');

      // Clear timeout and exit with error code
      if (shutdownTimeout) {
        clearTimeout(shutdownTimeout);
        shutdownTimeout = null;
      }

      process.exitCode = 1;
    }
  };

  // Handle various termination signals
  process.on('SIGINT', () => void shutdownHandler('SIGINT'));
  process.on('SIGTERM', () => void shutdownHandler('SIGTERM'));
  process.on('SIGUSR2', () => void shutdownHandler('SIGUSR2')); // For nodemon restart

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    logger.error({ err: error }, 'Uncaught exception');
    void shutdownHandler('uncaughtException');
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error({ reason, promise }, 'Unhandled rejection');
    void shutdownHandler('unhandledRejection');
  });
}

/**
 * Check if the application is shutting down
 */
export function isAppShuttingDown(): boolean {
  return isShuttingDown;
}

/**
 * Redis implementation of the Cache interface
 */
class RedisCache implements Cache {
  private client!: RedisClientType;

  async init() {
    // Use the singleton Redis client
    this.client = await getRedisClient();
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds = 60): Promise<void> {
    await this.client.set(key, value, { EX: ttlSeconds });
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async close(): Promise<void> {
    // Use the proper graceful shutdown method
    await closeRedisConnection();
  }

  async ping(): Promise<string> {
    return this.client.ping();
  }
}

/**
 * In-memory implementation of the Cache interface
 * Used when Redis is not available (e.g., smoke tests)
 */
class MemoryCache implements Cache {
  private store = new Map<string, { value: string; expiry: number }>();
  private timers = new Map<string, NodeJS.Timeout>();

  async init(): Promise<void> {
    // Nothing to initialize for in-memory cache
    logger.info('MemoryCache initialized');
  }

  async get(key: string): Promise<string | null> {
    const record = this.store.get(key);
    if (!record) return null;

    if (Date.now() > record.expiry) {
      this.store.delete(key);
      this.timers.delete(key);
      return null;
    }

    return record.value;
  }

  async set(key: string, value: string, ttlSeconds = 60): Promise<void> {
    // Clear existing timer if any
    const existingTimer = this.timers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const expiry = Date.now() + ttlSeconds * 1000;
    this.store.set(key, { value, expiry });

    // Set up auto-cleanup timer
    // Cap timeout at maximum safe value (24.8 days) to prevent integer overflow
    const timeoutMs = Math.min(ttlSeconds * 1000, 2147483647);
    const timer = setTimeout(() => {
      this.store.delete(key);
      this.timers.delete(key);
    }, timeoutMs);

    this.timers.set(key, timer);
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);

    // Clear timer if exists
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }
  }

  async close(): Promise<void> {
    // Clear all timers to prevent memory leaks
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this.store.clear();
  }

  async ping(): Promise<string> {
    return 'PONG';
  }
}

/**
 * Factory function to create the appropriate cache implementation
 */
export function createCache(): Cache {
  const cacheDriver = process.env.CACHE_DRIVER || 'redis';
  const redisUrl = process.env.REDIS_URL;
  const nodeEnv = process.env.NODE_ENV;

  logger.info({ cacheDriver, nodeEnv }, 'Creating cache instance');

  // Prevent accidental use of MemoryCache in production
  if (cacheDriver === 'memory' && nodeEnv === 'production') {
    throw new Error(
      'MemoryCache is not allowed in production environment. Please configure Redis.'
    );
  }

  if (cacheDriver === 'memory') {
    return new MemoryCache();
  }

  if (!redisUrl) {
    // Also check for production when falling back to memory cache
    if (nodeEnv === 'production') {
      throw new Error('REDIS_URL is required in production environment.');
    }
    logger.warn('REDIS_URL not provided, falling back to memory cache');
    return new MemoryCache();
  }

  return new RedisCache();
}
