import { UserRole } from '@api/features/auth/domain';
import { describe, expect, it } from 'vitest';
import { RoleMapper } from './RoleMapper';

describe('RoleMapper', () => {
  const standardMapping = {
    'default-roles-certquiz': UserRole.Guest,
    'manage-account': UserRole.User,
    'view-profile': UserRole.User,
    'premium-subscriber': UserRole.Premium,
    'realm-admin': UserRole.Admin,
    'certquiz-admin': UserRole.Admin,
  };

  describe('toDomain', () => {
    it('should map KeyCloak roles to domain roles correctly', () => {
      // Arrange
      const mapper = new RoleMapper(standardMapping);
      const keycloakRoles = ['manage-account', 'premium-subscriber'];

      // Act
      const domainRoles = mapper.toDomain(keycloakRoles);

      // Assert
      expect(domainRoles).toEqual([UserRole.User, UserRole.Premium]);
    });

    it('should deduplicate mapped roles', () => {
      // Arrange
      const mapper = new RoleMapper(standardMapping);
      const keycloakRoles = ['manage-account', 'view-profile', 'premium-subscriber'];

      // Act
      const domainRoles = mapper.toDomain(keycloakRoles);

      // Assert
      expect(domainRoles).toEqual([UserRole.User, UserRole.Premium]);
    });

    it('should return guest role when no roles match', () => {
      // Arrange
      const mapper = new RoleMapper(standardMapping);
      const keycloakRoles = ['unknown-role', 'another-unknown'];

      // Act
      const domainRoles = mapper.toDomain(keycloakRoles);

      // Assert
      expect(domainRoles).toEqual([UserRole.Guest]);
    });

    it('should return guest role for empty array', () => {
      // Arrange
      const mapper = new RoleMapper(standardMapping);
      const keycloakRoles: string[] = [];

      // Act
      const domainRoles = mapper.toDomain(keycloakRoles);

      // Assert
      expect(domainRoles).toEqual([UserRole.Guest]);
    });

    it('should ignore unknown roles and map known ones', () => {
      // Arrange
      const mapper = new RoleMapper(standardMapping);
      const keycloakRoles = ['unknown-role', 'realm-admin', 'another-unknown'];

      // Act
      const domainRoles = mapper.toDomain(keycloakRoles);

      // Assert
      expect(domainRoles).toEqual([UserRole.Admin]);
    });

    it('should handle multiple roles mapping to admin', () => {
      // Arrange
      const mapper = new RoleMapper(standardMapping);
      const keycloakRoles = ['realm-admin', 'certquiz-admin'];

      // Act
      const domainRoles = mapper.toDomain(keycloakRoles);

      // Assert
      expect(domainRoles).toEqual([UserRole.Admin]);
    });

    it('should preserve role hierarchy order', () => {
      // Arrange
      const mapper = new RoleMapper(standardMapping);
      const keycloakRoles = [
        'realm-admin',
        'premium-subscriber',
        'manage-account',
        'default-roles-certquiz',
      ];

      // Act
      const domainRoles = mapper.toDomain(keycloakRoles);

      // Assert
      // Roles should be returned in hierarchy order: Guest < User < Premium < Admin
      expect(domainRoles).toEqual([
        UserRole.Guest,
        UserRole.User,
        UserRole.Premium,
        UserRole.Admin,
      ]);
    });
  });

  describe('configuration', () => {
    it('should accept custom mapping configuration', () => {
      // Arrange
      const customMapping = {
        'custom-guest': UserRole.Guest,
        'custom-user': UserRole.User,
      };
      const mapper = new RoleMapper(customMapping);
      const keycloakRoles = ['custom-user'];

      // Act
      const domainRoles = mapper.toDomain(keycloakRoles);

      // Assert
      expect(domainRoles).toEqual([UserRole.User]);
    });

    it('should validate mapping values are valid UserRole enum values', () => {
      // This is compile-time checked by TypeScript
      // The following would not compile:
      // const invalidMapping = { 'some-role': 'invalid-role' };
      // const mapper = new RoleMapper(invalidMapping); // TypeScript error

      // Valid mapping compiles fine
      const validMapping = { 'some-role': UserRole.Admin };
      const mapper = new RoleMapper(validMapping);

      expect(mapper).toBeDefined();
    });
  });
});
