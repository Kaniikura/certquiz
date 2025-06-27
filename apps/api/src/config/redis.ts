import Redis from 'ioredis';
import type { RedisOptions } from 'ioredis';
import { random } from 'es-toolkit';
import { createLogger } from '../lib/logger';
import type { Logger } from 'pino';

let logger = createLogger('redis');

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
function parseRedisUrl(url: string, activeLogger = logger): Partial<RedisOptions> {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname || 'localhost',
      port: parseInt(parsed.port || '6379', 10),
      password: parsed.password || undefined,
      db: parsed.pathname ? parseInt(parsed.pathname.slice(1) || '0', 10) : 0
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
function validateRedisConfig(config: RedisOptions): void {
  const errors: string[] = [];

  // Validate host
  if (!config.host || config.host.trim() === '') {
    errors.push('Redis host is required');
  }

  // Validate port
  if (config.port === undefined || config.port === null) {
    errors.push('Redis port is required');
  } else if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
    errors.push(`Redis port must be between 1 and 65535, got ${config.port}`);
  }

  // Validate db index
  if (config.db !== undefined && (!Number.isInteger(config.db) || config.db < 0 || config.db > 15)) {
    errors.push(`Redis db must be between 0 and 15, got ${config.db}`);
  }

  // Validate connection timeout
  if (config.connectTimeout && config.connectTimeout < 0) {
    errors.push(`Redis connectTimeout must be positive, got ${config.connectTimeout}`);
  }

  if (errors.length > 0) {
    const error = new Error(`Invalid Redis configuration: ${errors.join(', ')}`);
    logger.error({ errors }, 'Redis configuration validation failed');
    throw error;
  }

  logger.debug({
    host: config.host,
    port: config.port,
    db: config.db
  }, 'Redis configuration validated successfully');
}

/**
 * Get Redis configuration from environment variables
 * @param env Environment variables object
 * @param customLogger Optional logger instance for testing
 */
export function getRedisConfig(
  env: Record<string, string | undefined> = process.env,
  customLogger?: Logger
): RedisOptions {
  // Use custom logger if provided
  const activeLogger = customLogger || logger;
  
  const baseConfig: RedisOptions = {
    host: 'localhost',
    port: 6379,
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: true,
    retryStrategy: (times: number) => {
      const maxRetries = parseInt(env.REDIS_MAX_RETRIES || '10', 10);
      if (times <= 0 || times >= maxRetries) {
        if (times >= maxRetries) {
          activeLogger.warn({ attempts: times, maxRetries }, 'Max retry attempts reached. Connection failed.');
        }
        return null;
      }
      
      // Exponential backoff with jitter: base * 2^(times-1) + random jitter
      const baseDelay = Math.min(Math.pow(2, times - 1) * 1000, 16000);
      // Add jitter: ±20% of base delay to prevent thundering herd
      const jitter = random(baseDelay * 0.8, baseDelay * 1.2);
      const delay = Math.round(jitter);
      
      activeLogger.info({
        attempt: times,
        maxAttempts: 10,
        delay,
        baseDelay,
        jitter: delay - baseDelay
      }, `Retry attempt ${times}/10`);
      
      return delay;
    }
  };

  // Apply environment-specific configuration
  if (env.REDIS_URL) {
    // REDIS_URL takes precedence
    const urlConfig = parseRedisUrl(env.REDIS_URL, activeLogger);
    Object.assign(baseConfig, urlConfig);
  } else {
    // Fallback to individual variables
    if (env.REDIS_HOST) {
      baseConfig.host = env.REDIS_HOST;
    }
    if (env.REDIS_PORT) {
      baseConfig.port = parseInt(env.REDIS_PORT, 10);
    }
    if (env.REDIS_PASSWORD) {
      baseConfig.password = env.REDIS_PASSWORD;
    }
  }
  
  // Apply additional configuration options
  if (env.REDIS_CONNECT_TIMEOUT) {
    baseConfig.connectTimeout = parseInt(env.REDIS_CONNECT_TIMEOUT, 10);
  }

  // Validate the final configuration
  try {
    validateRedisConfig(baseConfig);
  } catch (error) {
    activeLogger.warn('Using default Redis configuration despite validation errors');
    // In development, we might want to continue with defaults.
    // In production, this should probably throw.
    if (env.NODE_ENV === 'production') {
      throw error;
    }
  }

  return baseConfig;
}

/**
 * Create a Redis client instance
 */
export function createRedisClient(env: Record<string, string | undefined> = process.env): Redis {
  const config = getRedisConfig(env);
  const client = new Redis(config);

  // Error handling
  client.on('error', (err) => {
    logger.error({
      err,
      host: config.host,
      port: config.port
    }, 'Redis client error');
  });

  client.on('connect', () => {
    logger.info({
      host: config.host,
      port: config.port
    }, 'Redis client connected');
  });

  client.on('ready', () => {
    logger.info({
      host: config.host,
      port: config.port
    }, 'Redis client ready');
  });

  client.on('close', () => {
    logger.warn({
      host: config.host,
      port: config.port
    }, 'Redis client connection closed');
  });

  client.on('reconnecting', (delay: number) => {
    logger.info({
      host: config.host,
      port: config.port,
      delay
    }, 'Redis client reconnecting');
  });

  return client;
}

/**
 * Singleton Redis client for the application
 */
let redisClient: Redis | null = null;

/**
 * Get or create the singleton Redis client
 */
export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = createRedisClient();
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
      // Set a timeout for graceful shutdown
        setTimeout(() => reject(new Error(`Redis shutdown timeout for ${redisClient.options.host}:${redisClient.options.port}`)), shutdownTimeout);
      
      // Try to quit gracefully
      const quitPromise = redisClient.quit();
      
      await Promise.race([quitPromise, timeoutPromise]);
      
      logger.info('Redis connection closed gracefully');
    } catch (error) {
      logger.error({ err: error as Error }, 'Error during Redis shutdown, forcing disconnect');
      // Force disconnect if graceful shutdown fails
      redisClient.disconnect();
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