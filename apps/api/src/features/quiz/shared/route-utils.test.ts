/**
 * Tests for route utilities
 * @fileoverview Test error mapping and route utilities
 */

import { AuthorizationError } from '@api/shared/errors';
import { describe, expect, it } from 'vitest';
import { mapDomainErrorToHttp } from './route-utils';

describe('route-utils', () => {
  describe('mapDomainErrorToHttp', () => {
    it('should map AuthorizationError to 403 status with proper message', () => {
      // Arrange
      const error = new AuthorizationError('Session belongs to different user');

      // Act
      const result = mapDomainErrorToHttp(error);

      // Assert
      expect(result.status).toBe(403);
      expect(result.body.error).toBe('Session belongs to different user');
      expect(result.body.code).toBe('UNAUTHORIZED');
    });

    it('should handle unknown errors with 500 status', () => {
      // Arrange
      const error = new Error('Some unknown error');

      // Act
      const result = mapDomainErrorToHttp(error);

      // Assert
      expect(result.status).toBe(500);
      expect(result.body.error).toBe('Internal server error');
      expect(result.body.code).toBeUndefined();
    });
  });
});
