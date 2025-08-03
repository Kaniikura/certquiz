import type { Logger } from '@api/infra/logger/root-logger';
import { createTestDatabase } from '@test/helpers/db-core';
import postgres from 'postgres';
import { PostgresSingleton } from '../../../tests/containers/postgres';
import type { ConnectionStats, DatabaseOptions, IDatabaseProvider } from './IDatabaseProvider';
import { createDrizzleInstance, PoolConfigs } from './shared';
import type { DB } from './types';

/**
 * Test database provider implementation
 *
 * Provides per-worker database isolation for parallel test execution.
 * Each worker gets its own isolated database that is automatically cleaned up.
 */
export class TestDatabaseProvider implements IDatabaseProvider {
  private workerDatabases = new Map<
    string,
    {
      db: DB;
      pool: postgres.Sql;
      url: string;
      cleanup: () => Promise<void>;
      createdAt: Date;
    }
  >();
  private containerUrlPromise: Promise<string> | undefined;
  private resolvedContainerUrl: string | undefined;

  constructor(
    private readonly logger: Logger,
    containerUrl?: string
  ) {
    if (containerUrl) {
      this.resolvedContainerUrl = containerUrl;
    }
  }

  async getDatabase(options?: DatabaseOptions): Promise<DB> {
    // Use worker ID for test isolation - each worker gets its own database
    const workerId = options?.workerId ?? process.env.VITEST_WORKER_ID ?? 'default';

    if (!this.workerDatabases.has(workerId)) {
      await this.createWorkerDatabase(workerId);
    }

    const workerDb = this.workerDatabases.get(workerId);
    if (!workerDb) {
      throw new Error(`Test database not found for worker: ${workerId}`);
    }
    return workerDb.db;
  }

  hasConnection(key?: string): boolean {
    if (key) {
      return this.workerDatabases.has(key);
    }
    return this.workerDatabases.size > 0;
  }

  getConnectionStats(): ConnectionStats {
    const stats = {
      activeConnections: this.workerDatabases.size,
      totalConnections: this.workerDatabases.size,
      connectionKeys: Array.from(this.workerDatabases.keys()).map(
        (workerId) => `worker:${workerId}`
      ),
    };

    this.logger.debug({ stats }, 'Test database connection statistics');
    return stats;
  }

  async shutdown(): Promise<void> {
    this.logger.info({ workerCount: this.workerDatabases.size }, 'Shutting down test databases');
    const errors: Array<{ workerId: string; error: unknown }> = [];

    // Shutdown all worker databases in parallel
    await Promise.all(
      Array.from(this.workerDatabases.entries()).map(async ([workerId, db]) => {
        try {
          // Close connection pool first
          await db.pool.end({ timeout: 5 });

          // Then drop the test database
          await db.cleanup();

          this.logger.debug({ workerId }, 'Test database cleaned up');
        } catch (error) {
          this.logger.error({ workerId, error }, 'Error cleaning up test database');
          errors.push({ workerId, error });
        }
      })
    );

    this.workerDatabases.clear();

    if (errors.length > 0) {
      throw new AggregateError(
        errors.map((e) => e.error as Error),
        `Failed to cleanup ${errors.length} test database(s)`
      );
    }
  }

  private async getContainerUrl(): Promise<string> {
    if (this.resolvedContainerUrl) {
      return this.resolvedContainerUrl;
    }

    if (!this.containerUrlPromise) {
      this.containerUrlPromise = PostgresSingleton.getInstance().then((container) => {
        this.resolvedContainerUrl = container.getConnectionUri();
        return this.resolvedContainerUrl;
      });
    }

    return this.containerUrlPromise;
  }

  private async createWorkerDatabase(workerId: string): Promise<void> {
    this.logger.info({ workerId }, 'Creating test database for worker');

    const containerUrl = await this.getContainerUrl();

    // Create isolated database with unique name
    const { url, drop } = await createTestDatabase({
      root: containerUrl,
      migrate: true,
    });

    // Create connection pool with test-optimized settings
    const pool = postgres(url, PoolConfigs.test());

    // Create Drizzle instance
    const db = createDrizzleInstance(pool, {
      enableLogging: false,
      environment: 'test',
    });

    this.workerDatabases.set(workerId, {
      db,
      pool,
      url,
      cleanup: drop,
      createdAt: new Date(),
    });

    this.logger.debug({ workerId, url }, 'Test database created successfully');
  }
}
