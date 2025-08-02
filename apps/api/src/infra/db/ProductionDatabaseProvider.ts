import type { Logger } from '@api/infra/logger/root-logger';
import postgres from 'postgres';
import type { ConnectionStats, DatabaseOptions, IDatabaseProvider } from './IDatabaseProvider';
import {
  createDrizzleInstance,
  PoolConfigs,
  shutdownConnection,
  validateDatabaseUrl,
} from './shared';
import type { DB } from './types';

/**
 * Configuration for production database provider
 */
export interface ProductionDatabaseConfig {
  databaseUrl: string;
  enableLogging: boolean;
  environment: string;
  defaultPoolConfig?: {
    max?: number;
    idleTimeout?: number;
    connectTimeout?: number;
  };
}

/**
 * Production database provider implementation
 *
 * Uses a factory pattern to create database connections with proper pooling.
 * Supports multiple connections with different configurations (e.g., for different workers in tests).
 */
export class ProductionDatabaseProvider implements IDatabaseProvider {
  private connections = new Map<
    string,
    {
      pool: postgres.Sql;
      db: DB;
      createdAt: Date;
    }
  >();

  constructor(
    private readonly logger: Logger,
    private readonly config: ProductionDatabaseConfig
  ) {}

  async getDatabase(options?: DatabaseOptions): Promise<DB> {
    const url = options?.databaseUrl ?? this.config.databaseUrl;
    const key = this.generateConnectionKey(url, options);

    // Force new connection if requested
    if (options?.forceNew && this.connections.has(key)) {
      await this.closeConnection(key);
    }

    if (!this.connections.has(key)) {
      this.logger.info({ key }, 'Creating new database connection');

      const validUrl = validateDatabaseUrl(url);
      const poolConfig = this.mergePoolConfig(options?.poolConfig);

      const pool = postgres(validUrl, poolConfig);
      const db = createDrizzleInstance(pool, {
        enableLogging: this.config.enableLogging,
        environment: this.config.environment,
      });

      this.connections.set(key, {
        pool,
        db,
        createdAt: new Date(),
      });
    }

    const connection = this.connections.get(key);
    if (!connection) {
      throw new Error(`Database connection not found for key: ${key}`);
    }
    return connection.db;
  }

  hasConnection(key?: string): boolean {
    if (key) {
      return this.connections.has(key);
    }
    return this.connections.size > 0;
  }

  getConnectionStats(): ConnectionStats {
    return {
      activeConnections: this.connections.size,
      totalConnections: this.connections.size,
      connectionKeys: Array.from(this.connections.keys()),
    };
  }

  async shutdown(): Promise<void> {
    this.logger.info(
      { connectionCount: this.connections.size },
      'Shutting down all database connections'
    );

    await Promise.all(
      Array.from(this.connections.entries()).map(([key]) => this.closeConnection(key))
    );
  }

  private async closeConnection(key: string): Promise<void> {
    const connection = this.connections.get(key);
    if (connection) {
      await shutdownConnection(connection.pool, {
        timeout: 5,
        onError: (error) => {
          this.logger.error({ key, error }, 'Error closing database connection');
        },
      });
      this.connections.delete(key);
    }
  }

  private generateConnectionKey(url: string, options?: DatabaseOptions): string {
    const parts = [url];

    if (options?.workerId) {
      parts.push(`worker:${options.workerId}`);
    }

    return parts.join('#');
  }

  private mergePoolConfig(
    customConfig?: DatabaseOptions['poolConfig']
  ): postgres.Options<Record<string, never>> {
    const baseConfig =
      this.config.environment === 'production'
        ? PoolConfigs.production(this.config.defaultPoolConfig?.max)
        : PoolConfigs.development();

    if (!customConfig) {
      return baseConfig;
    }

    return {
      ...baseConfig,
      ...(customConfig.max !== undefined && { max: customConfig.max }),
      ...(customConfig.idleTimeout !== undefined && { idle_timeout: customConfig.idleTimeout }),
      ...(customConfig.connectTimeout !== undefined && {
        connect_timeout: customConfig.connectTimeout,
      }),
    };
  }
}
