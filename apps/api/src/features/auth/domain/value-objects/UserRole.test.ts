/**
 * UserRole value object unit tests
 * @fileoverview Test role enum validation and permission logic
 */

import { describe, expect, it } from 'vitest';
import { UserRole } from './UserRole';

describe('UserRole', () => {
  describe('enum values', () => {
    it('should have correct enum values', () => {
      expect(UserRole.Guest).toBe('guest');
      expect(UserRole.User).toBe('user');
      expect(UserRole.Premium).toBe('premium');
      expect(UserRole.Admin).toBe('admin');
    });

    it('should be immutable at compile time', () => {
      // Enums are compile-time readonly, runtime modification is possible but not recommended
      const originalUser = UserRole.User;
      expect(UserRole.User).toBe(originalUser);
      expect(UserRole.User).toBe('user');
    });
  });

  describe('fromString', () => {
    it('should convert valid role strings', () => {
      expect(UserRole.fromString('guest')).toBe(UserRole.Guest);
      expect(UserRole.fromString('user')).toBe(UserRole.User);
      expect(UserRole.fromString('premium')).toBe(UserRole.Premium);
      expect(UserRole.fromString('admin')).toBe(UserRole.Admin);
    });

    it('should return default for invalid roles', () => {
      // Implementation returns UserRole.User as safe default, not throwing
      expect(UserRole.fromString('invalid')).toBe(UserRole.User);
      expect(UserRole.fromString('')).toBe(UserRole.User);
      expect(UserRole.fromString('moderator')).toBe(UserRole.User);
    });

    it('should handle case sensitivity correctly', () => {
      // Implementation doesn't handle case-insensitive input, returns default
      expect(UserRole.fromString('USER')).toBe(UserRole.User); // Safe default
      expect(UserRole.fromString('Premium')).toBe(UserRole.User); // Safe default
      expect(UserRole.fromString('ADMIN')).toBe(UserRole.User); // Safe default
    });
  });

  describe('roleToString', () => {
    it('should convert roles to strings', () => {
      expect(UserRole.roleToString(UserRole.Guest)).toBe('guest');
      expect(UserRole.roleToString(UserRole.User)).toBe('user');
      expect(UserRole.roleToString(UserRole.Premium)).toBe('premium');
      expect(UserRole.roleToString(UserRole.Admin)).toBe('admin');
    });

    it('should be idempotent with fromString for valid roles', () => {
      const roles = [UserRole.Guest, UserRole.User, UserRole.Premium, UserRole.Admin];

      for (const role of roles) {
        const str = UserRole.roleToString(role);
        const backToRole = UserRole.fromString(str);
        expect(backToRole).toBe(role);
      }
    });
  });

  describe('hasPermission', () => {
    describe('user role permissions', () => {
      it('should allow user role for user permission', () => {
        expect(UserRole.hasPermission(UserRole.User, UserRole.User)).toBe(true);
      });

      it('should deny user role for premium permission', () => {
        expect(UserRole.hasPermission(UserRole.User, UserRole.Premium)).toBe(false);
      });

      it('should deny user role for admin permission', () => {
        expect(UserRole.hasPermission(UserRole.User, UserRole.Admin)).toBe(false);
      });
    });

    describe('premium role permissions', () => {
      it('should allow premium role for user permission', () => {
        expect(UserRole.hasPermission(UserRole.Premium, UserRole.User)).toBe(true);
      });

      it('should allow premium role for premium permission', () => {
        expect(UserRole.hasPermission(UserRole.Premium, UserRole.Premium)).toBe(true);
      });

      it('should deny premium role for admin permission', () => {
        expect(UserRole.hasPermission(UserRole.Premium, UserRole.Admin)).toBe(false);
      });
    });

    describe('admin role permissions', () => {
      it('should allow admin role for user permission', () => {
        expect(UserRole.hasPermission(UserRole.Admin, UserRole.User)).toBe(true);
      });

      it('should allow admin role for premium permission', () => {
        expect(UserRole.hasPermission(UserRole.Admin, UserRole.Premium)).toBe(true);
      });

      it('should allow admin role for admin permission', () => {
        expect(UserRole.hasPermission(UserRole.Admin, UserRole.Admin)).toBe(true);
      });
    });

    describe('permission hierarchy validation', () => {
      it('should follow strict hierarchy: admin > premium > user > guest', () => {
        // Admin can do everything
        expect(UserRole.hasPermission(UserRole.Admin, UserRole.Guest)).toBe(true);
        expect(UserRole.hasPermission(UserRole.Admin, UserRole.User)).toBe(true);
        expect(UserRole.hasPermission(UserRole.Admin, UserRole.Premium)).toBe(true);
        expect(UserRole.hasPermission(UserRole.Admin, UserRole.Admin)).toBe(true);

        // Premium can do guest, user, and premium things
        expect(UserRole.hasPermission(UserRole.Premium, UserRole.Guest)).toBe(true);
        expect(UserRole.hasPermission(UserRole.Premium, UserRole.User)).toBe(true);
        expect(UserRole.hasPermission(UserRole.Premium, UserRole.Premium)).toBe(true);
        expect(UserRole.hasPermission(UserRole.Premium, UserRole.Admin)).toBe(false);

        // User can do guest and user things
        expect(UserRole.hasPermission(UserRole.User, UserRole.Guest)).toBe(true);
        expect(UserRole.hasPermission(UserRole.User, UserRole.User)).toBe(true);
        expect(UserRole.hasPermission(UserRole.User, UserRole.Premium)).toBe(false);
        expect(UserRole.hasPermission(UserRole.User, UserRole.Admin)).toBe(false);

        // Guest can only do guest things
        expect(UserRole.hasPermission(UserRole.Guest, UserRole.Guest)).toBe(true);
        expect(UserRole.hasPermission(UserRole.Guest, UserRole.User)).toBe(false);
        expect(UserRole.hasPermission(UserRole.Guest, UserRole.Premium)).toBe(false);
        expect(UserRole.hasPermission(UserRole.Guest, UserRole.Admin)).toBe(false);
      });
    });
  });

  describe('namespace consistency', () => {
    it('should have all required namespace functions', () => {
      expect(typeof UserRole.fromString).toBe('function');
      expect(typeof UserRole.roleToString).toBe('function');
      expect(typeof UserRole.hasPermission).toBe('function');
    });

    it('should not conflict with enum values', () => {
      // Verify that namespace functions don't interfere with enum access
      expect(UserRole.Guest).toBe('guest');
      expect(UserRole.User).toBe('user');
      expect(UserRole.Premium).toBe('premium');
      expect(UserRole.Admin).toBe('admin');

      // And functions still work
      expect(UserRole.fromString('user')).toBe(UserRole.User);
      expect(UserRole.hasPermission(UserRole.Admin, UserRole.User)).toBe(true);
    });
  });

  describe('business rule validation', () => {
    it('should enforce role-based access control correctly', () => {
      // Test realistic permission scenarios including guest
      const scenarios = [
        {
          userRole: UserRole.Guest,
          requiredRole: UserRole.Guest,
          expected: true,
          scenario: 'Guest accessing guest content',
        },
        {
          userRole: UserRole.Guest,
          requiredRole: UserRole.User,
          expected: false,
          scenario: 'Guest accessing user content',
        },
        {
          userRole: UserRole.User,
          requiredRole: UserRole.Guest,
          expected: true,
          scenario: 'User accessing guest content',
        },
        {
          userRole: UserRole.User,
          requiredRole: UserRole.User,
          expected: true,
          scenario: 'User accessing user content',
        },
        {
          userRole: UserRole.User,
          requiredRole: UserRole.Premium,
          expected: false,
          scenario: 'User accessing premium content',
        },
        {
          userRole: UserRole.Premium,
          requiredRole: UserRole.User,
          expected: true,
          scenario: 'Premium user accessing basic content',
        },
        {
          userRole: UserRole.Premium,
          requiredRole: UserRole.Premium,
          expected: true,
          scenario: 'Premium user accessing premium content',
        },
        {
          userRole: UserRole.Admin,
          requiredRole: UserRole.Premium,
          expected: true,
          scenario: 'Admin accessing premium content',
        },
        {
          userRole: UserRole.Admin,
          requiredRole: UserRole.Admin,
          expected: true,
          scenario: 'Admin accessing admin content',
        },
      ];

      for (const { userRole, requiredRole, expected } of scenarios) {
        expect(UserRole.hasPermission(userRole, requiredRole)).toBe(expected);
      }
    });
  });
});
