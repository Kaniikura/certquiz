export enum UserRole {
  Guest = 'guest',
  User = 'user',
  Premium = 'premium',
  Admin = 'admin',
}

export namespace UserRole {
  const ROLE_HIERARCHY = [UserRole.Guest, UserRole.User, UserRole.Premium, UserRole.Admin] as const;

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
