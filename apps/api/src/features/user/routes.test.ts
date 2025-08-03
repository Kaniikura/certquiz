/**
 * User routes integration tests
 * @fileoverview Basic tests for user routes structure
 */

import { InMemoryDatabaseContext } from '@api/test-support/fakes/persistence/InMemoryDatabaseContext';
import { describe, expect, it } from 'vitest';

describe('User Routes Structure', () => {
  it('should export createUserRoutes factory function', async () => {
    const { createUserRoutes } = await import('./routes-factory');

    // Assert - Should be a function that creates a Hono instance
    expect(createUserRoutes).toBeDefined();
    expect(typeof createUserRoutes).toBe('function');

    // Test that it creates a valid Hono instance
    const databaseContext = new InMemoryDatabaseContext();
    const userRoutes = createUserRoutes(databaseContext);
    expect(userRoutes).toBeDefined();
    expect(typeof userRoutes.fetch).toBe('function');
  });

  it('should have the required route handlers defined', async () => {
    // Import route modules to verify they export the expected functions
    const { registerRoute } = await import('./register/route');
    const { getProfileRoute } = await import('./get-profile/route');

    expect(registerRoute).toBeDefined();
    expect(getProfileRoute).toBeDefined();
  });

  it('should have the repository interface defined', async () => {
    const IUserRepository = await import('./domain/repositories/IUserRepository');

    expect(IUserRepository).toBeDefined();
  });

  it('should have all use case handlers defined', async () => {
    const { registerHandler } = await import('./register/handler');
    const { getProfileHandler } = await import('./get-profile/handler');

    expect(registerHandler).toBeDefined();
    expect(getProfileHandler).toBeDefined();

    expect(typeof registerHandler).toBe('function');
    expect(typeof getProfileHandler).toBe('function');
  });

  it('should have validation schemas defined', async () => {
    const { registerSchema } = await import('./register/validation');
    const { getProfileSchema } = await import('./get-profile/validation');

    expect(registerSchema).toBeDefined();
    expect(getProfileSchema).toBeDefined();
  });

  it('should have DTOs defined', async () => {
    const registerDto = await import('./register/dto');
    const getProfileDto = await import('./get-profile/dto');

    expect(registerDto).toBeDefined();
    expect(getProfileDto).toBeDefined();
  });

  it('should have User domain entities and value objects defined', async () => {
    const { User } = await import('./domain/entities/User');
    const { UserProgress } = await import('./domain/entities/UserProgress');
    const { Level } = await import('./domain/value-objects/Level');
    const { Experience } = await import('./domain/value-objects/Experience');
    const { Accuracy } = await import('./domain/value-objects/Accuracy');
    const { StudyTime } = await import('./domain/value-objects/StudyTime');
    const { Streak } = await import('./domain/value-objects/Streak');
    const { CategoryStats } = await import('./domain/value-objects/CategoryStats');

    expect(User).toBeDefined();
    expect(UserProgress).toBeDefined();
    expect(Level).toBeDefined();
    expect(Experience).toBeDefined();
    expect(Accuracy).toBeDefined();
    expect(StudyTime).toBeDefined();
    expect(Streak).toBeDefined();
    expect(CategoryStats).toBeDefined();
  });
});
