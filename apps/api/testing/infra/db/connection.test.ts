import { afterEach, describe, expect, it, vi } from 'vitest';
import { _resetIsolationState, validateWorkerId } from './connection';

describe('Worker Database Isolation - Unit Tests', () => {
  afterEach(() => {
    _resetIsolationState();
    vi.clearAllMocks();
  });

  describe('validateWorkerId', () => {
    it('should accept valid worker IDs', () => {
      // Valid patterns
      expect(() => validateWorkerId('0')).not.toThrow();
      expect(() => validateWorkerId('worker_1')).not.toThrow();
      expect(() => validateWorkerId('test_worker_123')).not.toThrow();
      expect(() => validateWorkerId('ABC123_xyz')).not.toThrow();
    });

    it('should reject worker IDs with special characters', () => {
      // SQL injection attempts
      expect(() => validateWorkerId("'; DROP DATABASE --")).toThrow('Invalid worker ID');
      expect(() => validateWorkerId('worker-with-dash')).toThrow('Invalid worker ID');
      expect(() => validateWorkerId('worker.with.dot')).toThrow('Invalid worker ID');
      expect(() => validateWorkerId('worker with space')).toThrow('Invalid worker ID');
      expect(() => validateWorkerId('worker/slash')).toThrow('Invalid worker ID');
      expect(() => validateWorkerId('worker$dollar')).toThrow('Invalid worker ID');
    });

    it('should reject empty worker IDs', () => {
      expect(() => validateWorkerId('')).toThrow('Invalid worker ID');
    });

    it('should provide helpful error messages', () => {
      expect(() => validateWorkerId('worker@email')).toThrow(
        'Invalid worker ID: "worker@email". Worker IDs must contain only alphanumeric characters and underscores.'
      );
    });
  });

  describe('_resetIsolationState', () => {
    it('should be callable without errors', () => {
      // This just ensures the helper works
      expect(() => _resetIsolationState()).not.toThrow();
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
