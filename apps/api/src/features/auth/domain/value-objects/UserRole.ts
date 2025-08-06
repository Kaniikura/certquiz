export enum UserRole {
  Guest = 'guest',
  User = 'user',
  Premium = 'premium',
  Admin = 'admin',
}

export namespace UserRole {
  const ROLE_HIERARCHY = [UserRole.Guest, UserRole.User, UserRole.Premium, UserRole.Admin] as const;

  /** Type representing the string values of UserRole enum */
  export type UserRoleString = 'guest' | 'user' | 'premium' | 'admin';

  /** Array of all valid role string values for runtime use */
  export const USER_ROLE_VALUES = Object.values(UserRole) as readonly UserRoleString[];

  /** Tuple of role values for Zod enum validation */
  export const USER_ROLE_TUPLE = USER_ROLE_VALUES as [UserRoleString, ...UserRoleString[]];

  export function fromString(value: string): UserRole {
    switch (value) {
      case 'guest':
        return UserRole.Guest;
      case 'user':
        return UserRole.User;
      case 'premium':
        return UserRole.Premium;
      case 'admin':
        return UserRole.Admin;
      default:
        return UserRole.User; // Safe default
    }
  }

  export function roleToString(role: UserRole): string {
    return role as string;
  }

  export function hasPermission(role: UserRole, requiredRole: UserRole): boolean {
    return ROLE_HIERARCHY.indexOf(role) >= ROLE_HIERARCHY.indexOf(requiredRole);
  }
}
