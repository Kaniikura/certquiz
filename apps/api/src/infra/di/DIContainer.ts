/**
 * Async Dependency Injection Container
 * @fileoverview Async DI container supporting both sync and async service factories
 */

type AsyncServiceFactory<T = unknown> = () => T | Promise<T>;
type ServiceToken<T = unknown> = symbol & { __brand: T };
export type Environment = 'test' | 'development' | 'production';

interface ServiceRegistration {
  factory: AsyncServiceFactory;
  singleton: boolean;
  instance?: unknown;
  instancePromise?: Promise<unknown>;
}

interface EnvironmentConfiguration {
  registrations: Map<symbol, ServiceRegistration>;
}

/**
 * Async dependency injection container
 * Supports:
 * - Async and sync service factories
 * - Service registration with factory functions
 * - Singleton and transient lifetimes
 * - Environment-specific configurations
 * - Type-safe token-based resolution
 */
export class DIContainer {
  private registrations = new Map<symbol, ServiceRegistration>();
  private environmentConfigs = new Map<Environment, EnvironmentConfiguration>();
  private currentEnvironment: Environment | null = null;

  /**
   * Register a service factory with the container
   * @param token - Unique symbol identifying the service
   * @param factory - Factory function that creates the service instance (can be async)
   * @param options - Registration options (singleton, etc.)
   */
  register<T>(
    token: ServiceToken<T> | symbol,
    factory: AsyncServiceFactory<T>,
    options: { singleton?: boolean } = { singleton: true }
  ): void {
    const registration: ServiceRegistration = {
      factory,
      singleton: options.singleton ?? true,
    };

    this.registrations.set(token as symbol, registration);
  }

  /**
   * Resolve a service from the container
   * @param token - Service token to resolve
   * @returns Promise of the resolved service instance
   * @throws Error if service is not registered
   */
  async resolve<T>(token: ServiceToken<T> | symbol): Promise<T> {
    const registration = this.getRegistration(token as symbol);

    if (!registration) {
      throw new Error(
        `Service not registered: ${token.toString()}. Did you forget to register it or configure the environment?`
      );
    }

    // Return existing instance for singletons
    if (registration.singleton) {
      if (registration.instance !== undefined) {
        return registration.instance as T;
      }

      // If there's an ongoing instance creation, wait for it
      if (registration.instancePromise !== undefined) {
        return registration.instancePromise as Promise<T>;
      }
    }

    // Create new instance
    const instancePromise = Promise.resolve(registration.factory());

    // For singletons, store the promise to prevent concurrent creation
    if (registration.singleton) {
      registration.instancePromise = instancePromise;
    }

    try {
      const instance = await instancePromise;

      // Cache singleton instances
      if (registration.singleton) {
        registration.instance = instance;
        registration.instancePromise = undefined; // Clear the promise
      }

      return instance as T;
    } catch (error) {
      // Clean up on error
      if (registration.singleton) {
        registration.instancePromise = undefined;
      }
      throw error;
    }
  }

  /**
   * Configure container for specific environment
   * @param env - Target environment
   */
  configureForEnvironment(env: Environment): void {
    this.currentEnvironment = env;
    const config = this.environmentConfigs.get(env);

    if (config) {
      // Clear current registrations
      this.registrations.clear();

      // Apply environment-specific registrations
      config.registrations.forEach((registration, token) => {
        this.registrations.set(token, { ...registration });
      });
    }
  }

  /**
   * Register environment-specific configuration
   * @param env - Target environment
   * @param configurator - Function to configure services for this environment
   */
  registerEnvironmentConfig(
    env: Environment,
    configurator: (container: DIContainer) => void
  ): void {
    // Create a temporary container to capture registrations
    const tempContainer = new DIContainer();

    // Copy current registrations to temp container
    this.registrations.forEach((registration, token) => {
      tempContainer.registrations.set(token, { ...registration });
    });

    // Apply environment-specific configuration
    configurator(tempContainer);

    // Store the configuration
    this.environmentConfigs.set(env, {
      registrations: new Map(tempContainer.registrations),
    });
  }

  /**
   * Check if a service is registered
   * @param token - Service token to check
   */
  has(token: ServiceToken<unknown> | symbol): boolean {
    return this.registrations.has(token as symbol);
  }

  /**
   * Clear all registrations and reset the container
   */
  clear(): void {
    this.registrations.clear();
    this.environmentConfigs.clear();
    this.currentEnvironment = null;
  }

  /**
   * Create a child container with inherited registrations
   * Useful for creating scoped containers
   */
  createChild(): DIContainer {
    const child = new DIContainer();

    // Copy registrations to child
    this.registrations.forEach((registration, token) => {
      child.registrations.set(token, {
        factory: registration.factory,
        singleton: registration.singleton,
        // Don't copy instances - child gets fresh instances
      });
    });

    // Copy environment configs
    this.environmentConfigs.forEach((config, env) => {
      child.environmentConfigs.set(env, {
        registrations: new Map(config.registrations),
      });
    });

    child.currentEnvironment = this.currentEnvironment;
    return child;
  }

  /**
   * Get service registration
   * @private
   */
  private getRegistration(token: symbol): ServiceRegistration | undefined {
    return this.registrations.get(token);
  }

  /**
   * Get current environment
   */
  getCurrentEnvironment(): Environment | null {
    return this.currentEnvironment;
  }

  /**
   * Get all registered service tokens
   * Useful for debugging and testing
   */
  getRegisteredTokens(): symbol[] {
    return Array.from(this.registrations.keys());
  }
}

/**
 * Create a type-safe service token
 * @param name - Human-readable name for the token
 */
export function createServiceToken<T>(name: string): ServiceToken<T> {
  return Symbol(name) as ServiceToken<T>;
}
