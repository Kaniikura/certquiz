import { describe, expect, it } from 'vitest';
import { healthCheckHandler } from './handler';

describe('healthCheckHandler', () => {
  it('should return healthy status with timestamp', async () => {
    // Act
    const result = await healthCheckHandler();

    // Assert
    expect(result.status).toBe('healthy');
    expect(result.service).toBe('certquiz-api');
    expect(result.timestamp).toBeDefined();
    expect(new Date(result.timestamp).getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('should include version information', async () => {
    // Act
    const result = await healthCheckHandler();

    // Assert
    expect(result.version).toBeDefined();
    expect(result.version).toMatch(/^\d+\.\d+\.\d+$/); // Semantic versioning format
  });

  it('should include environment information', async () => {
    // Act
    const result = await healthCheckHandler();

    // Assert
    expect(result.environment).toBeDefined();
    expect(['development', 'test', 'staging', 'production']).toContain(result.environment);
  });

  it('should include uptime information', async () => {
    // Act
    const result = await healthCheckHandler();

    // Assert
    expect(result.uptime).toBeDefined();
    expect(typeof result.uptime).toBe('number');
    expect(result.uptime).toBeGreaterThan(0);
  });

  it('should include memory usage information', async () => {
    // Act
    const result = await healthCheckHandler();

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
