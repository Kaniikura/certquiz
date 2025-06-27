import pino from 'pino';
import { Writable } from 'node:stream';

/**
 * Create a pino logger instance with appropriate configuration
 */
export const createLogger = (name: string) => {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const isTest = process.env.NODE_ENV === 'test';
  
  return pino({
    name,
    level: process.env.LOG_LEVEL || (isTest ? 'silent' : isDevelopment ? 'debug' : 'info'),
    ...(isDevelopment && !isTest && {
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname'
        }
      }
    })
  });
};

// Default logger instance
export const logger = createLogger('app');

// Test utilities - types and functions for testing

/**
 * Log entry type for test assertions
 */
export type LogEntry = {
  level: number;
  msg: string;
  [key: string]: unknown;
};

/**
 * Test logger with captured logs
 */
export type TestLogger = pino.Logger & {
  logs: LogEntry[];
};

/**
 * Helper constants for pino log levels
 */
export const LOG_LEVELS = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60
} as const;

/**
 * Create a test logger that captures logs for verification
 * @param options Optional pino options to override defaults
 * @returns Logger instance with logs array attached
 */
export function createTestLogger(options?: pino.LoggerOptions): TestLogger {
  const logs: LogEntry[] = [];
  
  const stream = new Writable({
    write(chunk: Buffer, _encoding: string, callback: () => void) {
      try {
        const log = JSON.parse(chunk.toString());
        logs.push(log);
      } catch (err) {
        // Ignore parse errors in test
      }
      callback();
    }
  });

  const logger = pino({ level: 'trace', ...options }, stream) as TestLogger;
  logger.logs = logs;
  
  return logger;
}

/**
 * Helper function to find logs by predicate
 * @param logs Array of log entries
 * @param predicate Filter function
 */
export function findLog(logs: LogEntry[], predicate: (log: LogEntry) => boolean): LogEntry | undefined {
  return logs.find(predicate);
}

/**
 * Helper function to find logs by level
 * @param logs Array of log entries
 * @param level Log level name
 */
export function findLogByLevel(logs: LogEntry[], level: keyof typeof LOG_LEVELS): LogEntry | undefined {
  return findLog(logs, log => log.level === LOG_LEVELS[level]);
}

/**
 * Helper function to find logs by message
 * @param logs Array of log entries
 * @param msg Message string or regex pattern
 */
export function findLogByMessage(logs: LogEntry[], msg: string | RegExp): LogEntry | undefined {
  return findLog(logs, log => 
    typeof msg === 'string' ? log.msg === msg : msg.test(log.msg)
  );
}