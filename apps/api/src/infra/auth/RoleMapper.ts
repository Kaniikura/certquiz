import { UserRole } from '@api/features/auth/domain/value-objects/UserRole';
import { getRootLogger } from '@api/infra/logger/root-logger';

/**
 * Maps external identity provider roles to domain UserRole values.
 * Acts as an Anti-corruption layer in DDD terminology.
 */
export interface IRoleMapper {
  /**
   * Converts external roles (e.g., KeyCloak) to domain roles.
   * @param externalRoles Array of role strings from the identity provider
   * @returns Array of domain UserRole values, guaranteed to contain at least Guest role
   */
  toDomain(externalRoles: string[]): UserRole[];
}

/**
 * KeyCloak to Domain role mapper implementation.
 * Configurable via mapping object passed to constructor.
 */
export class RoleMapper implements IRoleMapper {
  private readonly roleMapping: Record<string, UserRole>;

  constructor(roleMapping: Record<string, UserRole>) {
    this.roleMapping = roleMapping;
  }

  public toDomain(externalRoles: string[]): UserRole[] {
    const domainRoles = new Set<UserRole>();
    const logger = getRootLogger().child({ module: 'RoleMapper' });

    // Map each external role to domain role
    for (const role of externalRoles) {
      const mappedRole = this.roleMapping[role];
      if (mappedRole !== undefined) {
        domainRoles.add(mappedRole);
      } else if (process.env.NODE_ENV !== 'test') {
        // Log unmapped roles for monitoring
        logger.warn({ unmappedRole: role }, 'Unmapped role encountered');
      }
    }

    // Ensure at least Guest role is present
    if (domainRoles.size === 0) {
      domainRoles.add(UserRole.Guest);
    }

    // Return roles in hierarchy order for consistency
    return this.sortByHierarchy(Array.from(domainRoles));
  }

  /**
   * Sorts roles by their hierarchy order.
   * Guest < User < Premium < Admin
   */
  private sortByHierarchy(roles: UserRole[]): UserRole[] {
    const hierarchy = [UserRole.Guest, UserRole.User, UserRole.Premium, UserRole.Admin];
    return roles.sort((a, b) => hierarchy.indexOf(a) - hierarchy.indexOf(b));
  }
}

/**
 * Default KeyCloak to Domain role mapping configuration.
 * Can be overridden via environment variables or config files.
 */
export const DEFAULT_ROLE_MAPPING: Record<string, UserRole> = {
  // KeyCloak default roles
  'default-roles-certquiz': UserRole.Guest,
  offline_access: UserRole.Guest,
  uma_authorization: UserRole.Guest,

  // Account management roles
  'manage-account': UserRole.User,
  'manage-account-links': UserRole.User,
  'view-profile': UserRole.User,

  // Application-specific roles
  'certquiz-user': UserRole.User,
  'certquiz-premium': UserRole.Premium,
  'premium-subscriber': UserRole.Premium,

  // Admin roles
  'certquiz-admin': UserRole.Admin,
  'realm-admin': UserRole.Admin,
  admin: UserRole.Admin,
};
