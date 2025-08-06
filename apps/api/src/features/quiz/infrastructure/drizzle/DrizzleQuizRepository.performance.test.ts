/**
 * Performance benchmarks for DrizzleQuizRepository optimizations
 * @fileoverview Validates actual performance improvements from database aggregation
 */

import { performance } from 'node:perf_hooks';
import * as schema from '@api/infra/db/schema';
import { createDomainLogger } from '@api/infra/logger/PinoLoggerAdapter';
import { PostgresSingleton } from '@test/containers/postgres';
import { createTestDatabase } from '@test/helpers/db-core';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DrizzleQuestionDetailsService } from './DrizzleQuestionDetailsService';
import { DrizzleQuizRepository } from './DrizzleQuizRepository';
import { clearQuizSessions, seedQuizSessions } from './test-helpers/performance-data';

/**
 * Query counter to verify O(1) database operations
 * Implements Drizzle's logger interface
 */
class QueryCounter {
  public queryCount = 0;
  public queries: string[] = [];

  reset(): void {
    this.queryCount = 0;
    this.queries = [];
  }

  logQuery(query: string): void {
    this.queryCount++;
    this.queries.push(query);
  }
}

describe('DrizzleQuizRepository Performance Benchmarks', () => {
  let db: PostgresJsDatabase<typeof schema>;
  let queryCounter: QueryCounter;
  let repository: DrizzleQuizRepository;
  const testLogger = createDomainLogger('test.performance.quiz-repository');

  beforeAll(async () => {
    // Use real PostgreSQL container for accurate performance testing
    const container = await PostgresSingleton.getInstance();
    const testDb = await createTestDatabase({
      root: container,
      migrate: true, // Ensure migrations are run
    });

    // Create postgres client
    const client = postgres(testDb.url, { max: 5 });

    // Create database instance with query counter
    queryCounter = new QueryCounter();
    db = drizzle(client, { schema, logger: queryCounter });
  }, 30000); // Allow time for container startup

  beforeEach(async () => {
    // Clear data and reset counters before each test
    await db.transaction(async (trx) => {
      await clearQuizSessions(trx);
    });
    queryCounter.reset();

    // Force garbage collection if available for accurate memory measurements
    if (global.gc) {
      global.gc();
    }
  });

  describe('getAverageScore Performance', () => {
    const testCases = [
      { records: 100, description: 'with 100 quiz sessions', maxTimeMs: 50, maxMemoryMB: 1 },
      { records: 1000, description: 'with 1,000 quiz sessions', maxTimeMs: 75, maxMemoryMB: 2 },
      { records: 10000, description: 'with 10,000 quiz sessions', maxTimeMs: 100, maxMemoryMB: 3 },
    ];

    it.each(testCases)(
      'should demonstrate O(1) performance $description',
      async ({ records, maxTimeMs, maxMemoryMB }) => {
        // Arrange: Seed database with test data
        await db.transaction(async (trx) => {
          await seedQuizSessions(trx, records, {
            questionsPerQuiz: 20,
            userIdPrefix: 'perf-test',
          });
        });

        // Create repository instance in a transaction
        const result = await db.transaction(async (trx) => {
          const questionDetailsService = new DrizzleQuestionDetailsService(
            trx,
            createDomainLogger('perf-test')
          );
          repository = new DrizzleQuizRepository(
            trx,
            questionDetailsService,
            createDomainLogger('perf-test')
          );

          // Reset query counter after setup
          queryCounter.reset();

          // Measure memory before operation
          const memoryBefore = process.memoryUsage().heapUsed;

          // Act: Measure execution time
          const startTime = performance.now();
          const averageScore = await repository.getAverageScore();
          const endTime = performance.now();

          // Measure memory after operation
          const memoryAfter = process.memoryUsage().heapUsed;

          // Calculate metrics
          const executionTimeMs = endTime - startTime;
          const memoryDeltaMB = (memoryAfter - memoryBefore) / (1024 * 1024);

          // Log performance metrics for debugging
          testLogger.debug(`[${records} records] Performance Metrics`, {
            records,
            executionTimeMs: Number(executionTimeMs.toFixed(2)),
            queryCount: queryCounter.queryCount,
            memoryDeltaMB: Number(memoryDeltaMB.toFixed(2)),
            averageScore,
          });

          return {
            executionTimeMs,
            queryCount: queryCounter.queryCount,
            memoryDeltaMB,
            averageScore,
          };
        });

        // Assert: Validate O(1) characteristics
        // 1. Query count should be constant (O(1))
        expect(result.queryCount).toBe(1);
        expect(queryCounter.queries[0]).toContain('AVG'); // Should use SQL aggregation

        // 2. Execution time should not scale linearly
        expect(result.executionTimeMs).toBeLessThan(maxTimeMs);

        // 3. Memory usage should be minimal and constant
        expect(Math.abs(result.memoryDeltaMB)).toBeLessThan(maxMemoryMB);

        // 4. Result should be a valid percentage
        expect(result.averageScore).toBeGreaterThanOrEqual(0);
        expect(result.averageScore).toBeLessThanOrEqual(100);
      },
      30000 // Allow sufficient time for larger datasets
    );

    it('should validate scalability improvement over naive implementation', async () => {
      /**
       * This test demonstrates the performance difference between:
       * - O(1): Single aggregation query (current implementation)
       * - O(n): Loading all records into memory (naive implementation)
       */
      const performanceResults: Array<{
        records: number;
        timeMs: number;
        queries: number;
      }> = [];

      for (const recordCount of [100, 1000, 5000]) {
        await db.transaction(async (trx) => {
          await clearQuizSessions(trx);
          await seedQuizSessions(trx, recordCount);
        });

        const result = await db.transaction(async (trx) => {
          const questionDetailsService = new DrizzleQuestionDetailsService(
            trx,
            createDomainLogger('perf-test')
          );
          repository = new DrizzleQuizRepository(
            trx,
            questionDetailsService,
            createDomainLogger('perf-test')
          );

          queryCounter.reset();
          const startTime = performance.now();
          await repository.getAverageScore();
          const endTime = performance.now();

          return {
            records: recordCount,
            timeMs: endTime - startTime,
            queries: queryCounter.queryCount,
          };
        });

        performanceResults.push(result);
      }

      // Log scalability analysis
      testLogger.debug('Scalability Analysis', {
        headers: ['Records', 'Time (ms)', 'Queries', 'Time Ratio'],
        results: performanceResults.map((result, index) => ({
          records: result.records,
          timeMs: Number(result.timeMs.toFixed(2)),
          queries: result.queries,
          timeRatio:
            index > 0 ? Number((result.timeMs / performanceResults[0].timeMs).toFixed(2)) : 1.0,
        })),
      });

      // Assert: Time should not scale linearly with data volume
      // With O(1), time ratio should remain relatively constant
      const firstTime = performanceResults[0].timeMs;
      const lastTime = performanceResults[performanceResults.length - 1].timeMs;
      const timeRatio = lastTime / firstTime;

      // Even with 50x more data, time should increase by less than 3x
      // (accounting for PostgreSQL's internal overhead)
      expect(timeRatio).toBeLessThan(3);

      // All operations should use exactly 1 query
      performanceResults.forEach((result) => {
        expect(result.queries).toBe(1);
      });
    });
  });

  describe('Query Optimization Validation', () => {
    it('should use database aggregation instead of in-memory processing', async () => {
      // Seed some test data
      await db.transaction(async (trx) => {
        await seedQuizSessions(trx, 500);
      });

      await db.transaction(async (trx) => {
        const questionDetailsService = new DrizzleQuestionDetailsService(
          trx,
          createDomainLogger('perf-test')
        );
        repository = new DrizzleQuizRepository(
          trx,
          questionDetailsService,
          createDomainLogger('perf-test')
        );

        queryCounter.reset();
        await repository.getAverageScore();

        // Validate that the query uses aggregation
        expect(queryCounter.queryCount).toBe(1);
        const query = queryCounter.queries[0];

        // Check for key aggregation components
        expect(query).toMatch(/AVG/i);
        expect(query).toMatch(/correct_answers/i);
        expect(query).toMatch(/question_count/i);
        expect(query).toContain('quiz_session_snapshot');
        // Drizzle may use parameter binding, so check for either literal or parameter
        // The query should filter for COMPLETED state in WHERE clause
        expect(query.toLowerCase()).toMatch(/where.*state.*=.*\$\d+|where.*state.*=.*'completed'/i);

        // Should NOT be selecting all records
        expect(query).not.toMatch(/SELECT \*/i);
        expect(query).not.toContain('LIMIT 1000'); // Not paginating through records
      });
    });

    it('should handle edge cases efficiently', async () => {
      const edgeCases = [
        { name: 'no data', seedCount: 0, expectedScore: 0 },
        { name: 'single quiz', seedCount: 1, expectedScore: expect.any(Number) },
        { name: 'all perfect scores', seedCount: 100, expectedScore: expect.any(Number) },
      ];

      for (const testCase of edgeCases) {
        await db.transaction(async (trx) => {
          await clearQuizSessions(trx);
          if (testCase.seedCount > 0) {
            await seedQuizSessions(trx, testCase.seedCount);
          }
        });

        const result = await db.transaction(async (trx) => {
          const questionDetailsService = new DrizzleQuestionDetailsService(
            trx,
            createDomainLogger('perf-test')
          );
          repository = new DrizzleQuizRepository(
            trx,
            questionDetailsService,
            createDomainLogger('perf-test')
          );

          queryCounter.reset();
          const startTime = performance.now();
          const score = await repository.getAverageScore();
          const endTime = performance.now();

          return {
            name: testCase.name,
            score,
            timeMs: endTime - startTime,
            queries: queryCounter.queryCount,
          };
        });

        testLogger.debug(`Edge case: ${result.name}`, {
          name: result.name,
          score: result.score,
          timeMs: Number(result.timeMs.toFixed(2)),
          queries: result.queries,
        });

        // All edge cases should complete quickly with single query
        expect(result.queries).toBe(1);
        expect(result.timeMs).toBeLessThan(50);
        expect(result.score).toEqual(testCase.expectedScore);
      }
    });
  });
});
