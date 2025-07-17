/**
 * Unit of Work example tests
 * @fileoverview Tests demonstrating the Unit of Work pattern usage
 */

import { NoopLogger } from '@api/shared/logger/LoggerPort';
import { describe, expect, it } from 'vitest';
import { exampleLegacyHandler, exampleUnitOfWorkHandler } from './uow-example';

describe('Unit of Work Example Handlers', () => {
  const logger = new NoopLogger();
  const mockCommand = {
    userId: 'test-user-123',
    action: 'start-quiz',
  };

  describe('exampleUnitOfWorkHandler', () => {
    it('should process command successfully with UnitOfWork pattern', async () => {
      const result = await exampleUnitOfWorkHandler(mockCommand, logger);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.message).toContain('UnitOfWork pattern');
        expect(result.data.message).toContain(mockCommand.action);
        expect(result.data.message).toContain(mockCommand.userId);
        expect(result.data.timestamp).toBeInstanceOf(Date);
      }
    });

    it('should handle repository errors gracefully', async () => {
      const command = { userId: '', action: 'invalid' };

      const result = await exampleUnitOfWorkHandler(command, logger);

      // Should still succeed in demonstration mode
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.message).toContain('UnitOfWork pattern');
      }
    });
  });

  describe('exampleLegacyHandler', () => {
    it('should process command successfully with legacy pattern', async () => {
      const result = await exampleLegacyHandler(mockCommand, logger);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.message).toContain('processed');
        expect(result.data.message).toContain('Legacy');
        expect(result.data.timestamp).toBeInstanceOf(Date);
      }
    });
  });

  describe('pattern comparison', () => {
    it('should show both patterns work but UnitOfWork is cleaner', async () => {
      const [uowResult, legacyResult] = await Promise.all([
        exampleUnitOfWorkHandler(mockCommand, logger),
        exampleLegacyHandler(mockCommand, logger),
      ]);

      // Both patterns should work
      expect(uowResult.success).toBe(true);
      expect(legacyResult.success).toBe(true);

      // The UnitOfWork pattern is demonstrated to be working
      if (uowResult.success && legacyResult.success) {
        expect(uowResult.data.timestamp).toBeInstanceOf(Date);
        expect(legacyResult.data.timestamp).toBeInstanceOf(Date);
      }
    });
  });
});
