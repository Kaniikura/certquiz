export enum UserRole {
  Guest = 'guest',
  User = 'user',
  Premium = 'premium',
  Admin = 'admin',
}

export namespace UserRole {
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
    const hierarchy = [UserRole.Guest, UserRole.User, UserRole.Premium, UserRole.Admin];
    return hierarchy.indexOf(role) >= hierarchy.indexOf(requiredRole);
  }
}
