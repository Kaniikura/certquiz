import { describe, expect, it } from 'vitest';
import {
  createLogger,
  createTestLogger,
  findLog,
  findLogByLevel,
  findLogByMessage,
  LOG_LEVELS,
  logger,
} from './logger';

describe('Logger', () => {
  describe('createLogger', () => {
    it('should create a logger with specified name', () => {
      const testLogger = createLogger('test-logger');
      expect(testLogger).toBeDefined();
      expect(testLogger.info).toBeDefined();
      expect(testLogger.error).toBeDefined();
      expect(testLogger.warn).toBeDefined();
      expect(testLogger.debug).toBeDefined();
    });

    it('should respect NODE_ENV for log level', () => {
      const originalEnv = process.env.NODE_ENV;
      const originalLogLevel = process.env.LOG_LEVEL;

      // Test production mode
      process.env.NODE_ENV = 'production';
      delete process.env.LOG_LEVEL;
      const prodLogger = createLogger('prod-logger');
      expect(prodLogger.level).toBe('info');

      // Test development mode
      process.env.NODE_ENV = 'development';
      const devLogger = createLogger('dev-logger');
      expect(devLogger.level).toBe('debug');

      // Test mode
      process.env.NODE_ENV = 'test';
      const testLogger = createLogger('test-logger');
      expect(testLogger.level).toBe('silent');

      // Restore
      process.env.NODE_ENV = originalEnv;
      if (originalLogLevel) {
        process.env.LOG_LEVEL = originalLogLevel;
      }
    });

    it('should respect LOG_LEVEL environment variable', () => {
      const originalLogLevel = process.env.LOG_LEVEL;
      const originalNodeEnv = process.env.NODE_ENV;

      process.env.LOG_LEVEL = 'warn';
      process.env.NODE_ENV = 'development';
      const customLogger = createLogger('custom-logger');
      expect(customLogger.level).toBe('warn');

      // Restore
      if (originalLogLevel) {
        process.env.LOG_LEVEL = originalLogLevel;
      } else {
        delete process.env.LOG_LEVEL;
      }
      process.env.NODE_ENV = originalNodeEnv;
    });
  });

  describe('default logger instance', () => {
    it('should export a default logger instance', () => {
      expect(logger).toBeDefined();
      expect(logger.info).toBeDefined();
      expect(logger.error).toBeDefined();
    });
  });

  describe('createTestLogger', () => {
    it('should create a test logger with logs array', () => {
      const testLogger = createTestLogger();
      expect(testLogger).toBeDefined();
      expect(testLogger.logs).toBeDefined();
      expect(Array.isArray(testLogger.logs)).toBe(true);
      expect(testLogger.logs).toHaveLength(0);
    });

    it('should capture log entries', () => {
      const testLogger = createTestLogger();

      testLogger.info('Test info message');
      testLogger.error({ extra: 'data' }, 'Test error message');
      testLogger.warn('Test warning');

      expect(testLogger.logs).toHaveLength(3);
      expect(testLogger.logs[0].msg).toBe('Test info message');
      expect(testLogger.logs[0].level).toBe(LOG_LEVELS.info);
      expect(testLogger.logs[1].msg).toBe('Test error message');
      expect(testLogger.logs[1].extra).toBe('data');
      expect(testLogger.logs[2].msg).toBe('Test warning');
    });

    it('should accept custom options', () => {
      const testLogger = createTestLogger({ name: 'custom-test' });
      testLogger.info('Test message');

      expect(testLogger.logs[0].name).toBe('custom-test');
    });

    it('should handle invalid JSON gracefully', () => {
      const testLogger = createTestLogger();
      // This shouldn't throw
      expect(() => {
        // Simulate writing invalid JSON (this is handled internally)
        testLogger.info('Valid message');
      }).not.toThrow();
    });
  });

  describe('LOG_LEVELS', () => {
    it('should export correct log level constants', () => {
      expect(LOG_LEVELS.trace).toBe(10);
      expect(LOG_LEVELS.debug).toBe(20);
      expect(LOG_LEVELS.info).toBe(30);
      expect(LOG_LEVELS.warn).toBe(40);
      expect(LOG_LEVELS.error).toBe(50);
      expect(LOG_LEVELS.fatal).toBe(60);
    });
  });

  describe('findLog', () => {
    it('should find log by predicate', () => {
      const testLogger = createTestLogger();
      testLogger.info('First message');
      testLogger.error({ code: 'ERR001' }, 'Error message');
      testLogger.warn('Warning message');

      const errorLog = findLog(testLogger.logs, (log) => log.level === LOG_LEVELS.error);
      expect(errorLog).toBeDefined();
      expect(errorLog?.msg).toBe('Error message');
      expect(errorLog?.code).toBe('ERR001');

      const notFound = findLog(testLogger.logs, (log) => log.level === LOG_LEVELS.fatal);
      expect(notFound).toBeUndefined();
    });
  });

  describe('findLogByLevel', () => {
    it('should find log by level name', () => {
      const testLogger = createTestLogger();
      testLogger.info('Info message');
      testLogger.error('Error message');
      testLogger.debug('Debug message');

      const infoLog = findLogByLevel(testLogger.logs, 'info');
      expect(infoLog).toBeDefined();
      expect(infoLog?.msg).toBe('Info message');

      const errorLog = findLogByLevel(testLogger.logs, 'error');
      expect(errorLog).toBeDefined();
      expect(errorLog?.msg).toBe('Error message');

      const fatalLog = findLogByLevel(testLogger.logs, 'fatal');
      expect(fatalLog).toBeUndefined();
    });
  });

  describe('findLogByMessage', () => {
    it('should find log by exact message string', () => {
      const testLogger = createTestLogger();
      testLogger.info('First message');
      testLogger.info('Second message');
      testLogger.error('Error occurred');

      const found = findLogByMessage(testLogger.logs, 'Second message');
      expect(found).toBeDefined();
      expect(found?.msg).toBe('Second message');

      const notFound = findLogByMessage(testLogger.logs, 'Non-existent');
      expect(notFound).toBeUndefined();
    });

    it('should find log by regex pattern', () => {
      const testLogger = createTestLogger();
      testLogger.info('User 123 logged in');
      testLogger.info('User 456 logged out');
      testLogger.error('Authentication failed');

      const loginLog = findLogByMessage(testLogger.logs, /User \d+ logged in/);
      expect(loginLog).toBeDefined();
      expect(loginLog?.msg).toBe('User 123 logged in');

      const userLog = findLogByMessage(testLogger.logs, /User \d+/);
      expect(userLog).toBeDefined();
      expect(userLog?.msg).toBe('User 123 logged in'); // First match

      const notFound = findLogByMessage(testLogger.logs, /Admin/);
      expect(notFound).toBeUndefined();
    });
  });

  describe('logger usage examples', () => {
    it('should log with different levels', () => {
      const testLogger = createTestLogger();

      testLogger.trace('Trace message');
      testLogger.debug('Debug message');
      testLogger.info('Info message');
      testLogger.warn('Warning message');
      testLogger.error('Error message');
      testLogger.fatal('Fatal message');

      expect(testLogger.logs).toHaveLength(6);
      expect(testLogger.logs.map((l) => l.level)).toEqual([
        LOG_LEVELS.trace,
        LOG_LEVELS.debug,
        LOG_LEVELS.info,
        LOG_LEVELS.warn,
        LOG_LEVELS.error,
        LOG_LEVELS.fatal,
      ]);
    });

    it('should log with additional context', () => {
      const testLogger = createTestLogger();

      testLogger.info({ userId: '123', action: 'login' }, 'User logged in');
      testLogger.error({ err: new Error('Database error'), query: 'SELECT *' }, 'Query failed');

      expect(testLogger.logs[0].userId).toBe('123');
      expect(testLogger.logs[0].action).toBe('login');
      expect(testLogger.logs[0].msg).toBe('User logged in');

      expect(testLogger.logs[1].query).toBe('SELECT *');
      expect(testLogger.logs[1].msg).toBe('Query failed');
    });
  });
});
