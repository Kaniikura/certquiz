import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  _resetIsolationState,
  getWorkerDatabaseName,
  quoteIdentifier,
  validateWorkerId,
} from './connection';

describe('Worker Database Isolation - Unit Tests', () => {
  afterEach(() => {
    _resetIsolationState();
    vi.clearAllMocks();
  });

  describe('validateWorkerId', () => {
    it('should accept valid worker IDs', () => {
      // Valid patterns - alphanumeric only
      expect(() => validateWorkerId('0')).not.toThrow();
      expect(() => validateWorkerId('worker1')).not.toThrow();
      expect(() => validateWorkerId('test123')).not.toThrow();
      expect(() => validateWorkerId('ABC123xyz')).not.toThrow();
    });

    it('should reject worker IDs with special characters', () => {
      // SQL injection attempts
      expect(() => validateWorkerId("'; DROP DATABASE --")).toThrow('Invalid worker ID');
      expect(() => validateWorkerId('worker-with-dash')).toThrow('Invalid worker ID');
      expect(() => validateWorkerId('worker.with.dot')).toThrow('Invalid worker ID');
      expect(() => validateWorkerId('worker with space')).toThrow('Invalid worker ID');
      expect(() => validateWorkerId('worker/slash')).toThrow('Invalid worker ID');
      expect(() => validateWorkerId('worker$dollar')).toThrow('Invalid worker ID');
      // Underscores are now also rejected
      expect(() => validateWorkerId('worker_1')).toThrow('Invalid worker ID');
      expect(() => validateWorkerId('test_worker')).toThrow('Invalid worker ID');
    });

    it('should reject empty worker IDs', () => {
      expect(() => validateWorkerId('')).toThrow('Invalid worker ID');
    });

    it('should provide helpful error messages', () => {
      expect(() => validateWorkerId('worker@email')).toThrow(
        'Invalid worker ID: "worker@email". Worker IDs must contain only alphanumeric characters (no underscores).'
      );
    });
  });

  describe('_resetIsolationState', () => {
    it('should be callable without errors', () => {
      // This just ensures the helper works
      expect(() => _resetIsolationState()).not.toThrow();
    });
  });

  describe('quoteIdentifier', () => {
    it('should quote simple identifiers', () => {
      expect(quoteIdentifier('mydatabase')).toBe('"mydatabase"');
      expect(quoteIdentifier('test123')).toBe('"test123"');
      expect(quoteIdentifier('CertQuiz_DB')).toBe('"CertQuiz_DB"');
    });

    it('should escape double quotes within identifiers', () => {
      expect(quoteIdentifier('my"database')).toBe('"my""database"');
      expect(quoteIdentifier('test"with"quotes')).toBe('"test""with""quotes"');
      expect(quoteIdentifier('"""')).toBe('""""""""'); // Three quotes become six quotes plus surrounding quotes (8 total)
    });

    it('should handle edge cases', () => {
      expect(quoteIdentifier('')).toBe('""'); // Empty identifier
      expect(quoteIdentifier(' ')).toBe('" "'); // Space
      expect(quoteIdentifier('a')).toBe('"a"'); // Single character
    });
  });

  describe('getWorkerDatabaseName', () => {
    it('should construct valid database names', () => {
      const result1 = getWorkerDatabaseName('worker1');
      expect(result1.raw).toBe('certquiz_test_worker_worker1');
      expect(result1.quoted).toBe('"certquiz_test_worker_worker1"');

      const result2 = getWorkerDatabaseName('0');
      expect(result2.raw).toBe('certquiz_test_worker_0');
      expect(result2.quoted).toBe('"certquiz_test_worker_0"');

      const result3 = getWorkerDatabaseName('ABC123');
      expect(result3.raw).toBe('certquiz_test_worker_ABC123');
      expect(result3.quoted).toBe('"certquiz_test_worker_ABC123"');
    });

    it('should reject invalid worker IDs', () => {
      expect(() => getWorkerDatabaseName('worker-1')).toThrow('Invalid worker ID');
      expect(() => getWorkerDatabaseName('worker_1')).toThrow('Invalid worker ID');
      expect(() => getWorkerDatabaseName('worker.1')).toThrow('Invalid worker ID');
      expect(() => getWorkerDatabaseName('')).toThrow('Invalid worker ID');
      expect(() => getWorkerDatabaseName('worker@1')).toThrow('Invalid worker ID');
    });

    it('should perform whitelist validation', () => {
      // This test verifies the whitelist validation logic
      // The function should only accept database names that match the expected pattern
      const validWorker = 'test123';
      const result = getWorkerDatabaseName(validWorker);
      expect(result.raw).toMatch(/^certquiz_test_worker_[a-zA-Z0-9]+$/);
    });

    it('should provide defense in depth', () => {
      // Even with a valid worker ID, the function validates the complete database name
      // This ensures multiple layers of security
      const result = getWorkerDatabaseName('secure');
      expect(result.raw).toBe('certquiz_test_worker_secure');
      expect(result.quoted).toBe('"certquiz_test_worker_secure"');
      // The quoted version provides SQL injection protection
      expect(result.quoted).toMatch(/^"[^"]+"$/); // Ensures it's properly quoted
    });
  });

  // Note: More complex tests involving actual database operations,
  // concurrent initialization, and race condition prevention should be
  // implemented as integration tests in tests/integration/infra/ folder.
  //
  // Those tests would use real PostgreSQL containers and verify:
  // 1. Unique databases are created per worker
  // 2. Concurrent calls return the same instance
  // 3. Cleanup removes all worker databases
});

// Note: withEnv helper is defined locally in each test file that needs it
