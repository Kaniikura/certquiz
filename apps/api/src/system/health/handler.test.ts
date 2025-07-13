import { describe, expect, it } from 'vitest';
import { livenessCheckHandler, readinessCheckHandler } from './handler';

describe('livenessCheckHandler', () => {
  it('should always return healthy status', () => {
    // Act
    const result = livenessCheckHandler();

    // Assert
    expect(result.status).toBe('healthy');
    expect(result.service).toBe('certquiz-api');
    expect(result.timestamp).toBeDefined();
    expect(new Date(result.timestamp).getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('should include version information', () => {
    // Act
    const result = livenessCheckHandler();

    // Assert
    expect(result.version).toBeDefined();
    expect(result.version).toMatch(/^\d+\.\d+\.\d+$/); // Semantic versioning format
  });

  it('should include environment information', () => {
    // Act
    const result = livenessCheckHandler();

    // Assert
    expect(result.environment).toBeDefined();
    expect(['development', 'test', 'staging', 'production']).toContain(result.environment);
  });

  it('should include uptime information', () => {
    // Act
    const result = livenessCheckHandler();

    // Assert
    expect(result.uptime).toBeDefined();
    expect(typeof result.uptime).toBe('number');
    expect(result.uptime).toBeGreaterThan(0);
  });

  it('should include memory usage information', () => {
    // Act
    const result = livenessCheckHandler();

    // Assert
    expect(result.memory).toBeDefined();
    expect(result.memory.heapUsed).toBeDefined();
    expect(result.memory.heapTotal).toBeDefined();
    expect(result.memory.rss).toBeDefined();
    expect(result.memory.heapUsed).toBeGreaterThan(0);
    expect(result.memory.heapTotal).toBeGreaterThan(0);
    expect(result.memory.rss).toBeGreaterThan(0);
  });
});

describe('readinessCheckHandler', () => {
  it('should return healthy status when database is healthy', async () => {
    // Arrange
    const mockDb = {
      ping: async () => {
        // Successful ping returns void
      },
    };

    // Act
    const result = await readinessCheckHandler({ db: mockDb });

    // Assert
    expect(result.status).toBe('healthy');
    expect(result.timestamp).toBeDefined();
    expect(new Date(result.timestamp).getTime()).toBeLessThanOrEqual(Date.now());
    expect(result.services.database.status).toBe('healthy');
  });

  it('should return unhealthy status when database ping throws error', async () => {
    // Arrange
    const mockDb = {
      ping: async () => {
        throw new Error('Database connection failed');
      },
    };

    // Act
    const result = await readinessCheckHandler({ db: mockDb });

    // Assert
    expect(result.status).toBe('unhealthy');
    expect(result.timestamp).toBeDefined();
    expect(result.services.database.status).toBe('unhealthy');
  });

  it('should handle different error types from database ping', async () => {
    // Arrange
    const mockDb = {
      ping: async () => {
        throw new Error('Connection failed');
      },
    };

    // Act
    const result = await readinessCheckHandler({ db: mockDb });

    // Assert
    expect(result.status).toBe('unhealthy');
    expect(result.timestamp).toBeDefined();
    expect(result.services.database.status).toBe('unhealthy');
  });

  it('should return valid ISO timestamp', async () => {
    // Arrange
    const mockDb = {
      ping: async () => {
        // Successful ping returns void
      },
    };

    // Act
    const result = await readinessCheckHandler({ db: mockDb });

    // Assert
    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
  });
});
