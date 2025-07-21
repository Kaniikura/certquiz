import type { LoggerPort } from '@api/shared/logger/LoggerPort';
import { TestClock } from '@api/test-support/TestClock';
import { beforeEach, describe, expect, it } from 'vitest';
import { User } from '../entities/User';
import { Email, UserId, UserRole } from '../value-objects';
import { DrizzleUserRepository } from './DrizzleUserRepository';

// Simple mock logger for testing
class MockLogger implements LoggerPort {
  public infoMessages: string[] = [];
  public errorMessages: string[] = [];

  info(message: string, _meta?: Record<string, unknown>): void {
    this.infoMessages.push(message);
  }

  warn(_message: string, _meta?: Record<string, unknown>): void {
    // Not used in repository tests
  }

  error(message: string, _meta?: Record<string, unknown>): void {
    this.errorMessages.push(message);
  }

  debug(_message: string, _meta?: Record<string, unknown>): void {
    // Not used in repository tests
  }
}

// Mock connection that simulates database operations
class MockConnection {
  // biome-ignore lint/suspicious/noExplicitAny: Test mock requires flexible data storage
  private users: Map<string, any> = new Map();
  // biome-ignore lint/suspicious/noExplicitAny: Test mock requires flexible data storage
  private progress: Map<string, any> = new Map();

  // biome-ignore lint/suspicious/noExplicitAny: Mock method parameter
  select(_fields?: any) {
    const fromBuilder = {
      // biome-ignore lint/suspicious/noExplicitAny: Mock method parameter
      from: (_table: any) => ({
        innerJoin: () => ({
          // biome-ignore lint/suspicious/noExplicitAny: Mock method parameter
          where: (_condition: any) => ({
            limit: () => {
              // Simulate finding user by joining tables
              // biome-ignore lint/suspicious/noExplicitAny: Mock result array
              const results: any[] = [];
              for (const [userId, authData] of this.users) {
                const progressData = this.progress.get(userId);
                if (progressData) {
                  results.push({
                    // Auth fields
                    userId: authData.userId,
                    email: authData.email,
                    username: authData.username,
                    role: authData.role,
                    identityProviderId: authData.identityProviderId,
                    isActive: authData.isActive,
                    createdAt: authData.createdAt,
                    updatedAt: authData.updatedAt,
                    // Progress fields
                    level: progressData.level,
                    experience: progressData.experience,
                    totalQuestions: progressData.totalQuestions,
                    correctAnswers: progressData.correctAnswers,
                    accuracy: progressData.accuracy,
                    studyTimeMinutes: progressData.studyTimeMinutes,
                    currentStreak: progressData.currentStreak,
                    lastStudyDate: progressData.lastStudyDate,
                    categoryStats: progressData.categoryStats,
                    progressUpdatedAt: progressData.updatedAt,
                  });
                }
              }
              return results.slice(0, 1); // limit(1)
            },
          }),
        }),
        // biome-ignore lint/suspicious/noExplicitAny: Mock method parameter
        where: (_condition: any) => ({
          limit: () => {
            // For simple where queries (like isEmailTaken/isUsernameTaken)
            // biome-ignore lint/suspicious/noExplicitAny: Mock result array
            const results: any[] = [];
            for (const [_userId, authData] of this.users) {
              results.push({ count: authData.userId });
            }
            return results.slice(0, 1);
          },
        }),
      }),
    };
    return fromBuilder;
  }

  insert() {
    return {
      // biome-ignore lint/suspicious/noExplicitAny: Mock method parameter
      values: (data: any) => ({
        // biome-ignore lint/suspicious/noExplicitAny: Mock method parameter
        onConflictDoUpdate: ({ target }: any) => {
          if (target?.name === 'user_id') {
            // Simulate upsert
            if (data.userId) {
              this.users.set(data.userId, data);
            }
          }
          return Promise.resolve();
        },
      }),
    };
  }

  update() {
    return {
      // biome-ignore lint/suspicious/noExplicitAny: Mock method parameter
      set: (_data: any) => ({
        // biome-ignore lint/suspicious/noExplicitAny: Mock method parameter
        where: (_condition: any) => {
          // Simulate update
          return Promise.resolve();
        },
      }),
    };
  }

  // biome-ignore lint/suspicious/noExplicitAny: Mock transaction types
  transaction(fn: (tx: any) => Promise<any>) {
    return fn(this);
  }

  // Helper methods for testing
  // biome-ignore lint/suspicious/noExplicitAny: Test helper method parameters
  addUser(authData: any, progressData: any) {
    this.users.set(authData.userId, authData);
    this.progress.set(authData.userId, progressData);
  }

  clear() {
    this.users.clear();
    this.progress.clear();
  }
}

describe('DrizzleUserRepository', () => {
  let mockConnection: MockConnection;
  let mockLogger: MockLogger;
  // biome-ignore lint/suspicious/noExplicitAny: Repository generic type for tests
  let repository: DrizzleUserRepository<any>;
  let clock: TestClock;

  beforeEach(() => {
    mockConnection = new MockConnection();
    mockLogger = new MockLogger();
    // biome-ignore lint/suspicious/noExplicitAny: Type assertion for mock connection
    repository = new DrizzleUserRepository(mockConnection as any, mockLogger);
    clock = new TestClock(new Date('2025-01-01T12:00:00Z'));
  });

  describe('findById', () => {
    it('should return user when found', async () => {
      const userId = 'user-123';
      const authData = {
        userId,
        email: 'john@example.com',
        username: 'john_doe',
        role: 'user',
        identityProviderId: 'auth0|123',
        isActive: true,
        createdAt: new Date('2025-01-01T10:00:00Z'),
        updatedAt: new Date('2025-01-01T12:00:00Z'),
      };

      const progressData = {
        level: 5,
        experience: 400,
        totalQuestions: 100,
        correctAnswers: 80,
        accuracy: '80.00',
        studyTimeMinutes: 120,
        currentStreak: 7,
        lastStudyDate: new Date('2025-01-01T12:00:00Z'),
        categoryStats: {
          version: 1,
          categories: {
            CCNA: { correct: 8, total: 10, accuracy: 80 },
          },
        },
        updatedAt: new Date('2025-01-01T12:00:00Z'),
      };

      mockConnection.addUser(authData, progressData);

      const user = await repository.findById(UserId.of(userId));

      expect(user).toBeDefined();
      if (user) {
        expect(user.id.toString()).toBe(userId);
        expect(user.email.toString()).toBe('john@example.com');
        expect(user.username).toBe('john_doe');
        expect(user.progress.level.value).toBe(5);
        expect(user.progress.experience.value).toBe(400);
        expect(user.progress.currentStreak.days).toBe(7);
      }
    });

    it('should return null when user not found', async () => {
      const user = await repository.findById(UserId.of('nonexistent'));
      expect(user).toBeNull();
    });
  });

  describe('save', () => {
    it('should save user and progress data', async () => {
      const userResult = User.create(
        {
          email: 'new@example.com',
          username: 'new_user',
          role: UserRole.User,
        },
        clock
      );
      if (!userResult.success) {
        throw new Error('Failed to create user for test');
      }
      const user = userResult.data;

      await expect(repository.save(user)).resolves.not.toThrow();
      expect(mockLogger.infoMessages).toContain('User saved successfully');
    });
  });

  describe('create', () => {
    it('should create new user with progress', async () => {
      const userResult = User.create(
        {
          email: 'create@example.com',
          username: 'create_user',
          role: UserRole.User,
        },
        clock
      );
      if (!userResult.success) {
        throw new Error('Failed to create user for test');
      }
      const user = userResult.data;

      await expect(repository.create(user)).resolves.not.toThrow();
      expect(mockLogger.infoMessages).toContain('User created successfully');
    });
  });

  describe('updateProgress', () => {
    it('should update only progress data', async () => {
      const userResult = User.create(
        {
          email: 'progress@example.com',
          username: 'progress_user',
          role: UserRole.User,
        },
        clock
      );
      if (!userResult.success) {
        throw new Error('Failed to create user for test');
      }
      const user = userResult.data;

      const updatedUser = user.completeQuiz(
        {
          correctAnswers: 8,
          totalQuestions: 10,
          category: 'CCNA',
          studyTimeMinutes: 30,
        },
        clock
      );

      await expect(repository.updateProgress(updatedUser)).resolves.not.toThrow();
      expect(mockLogger.infoMessages).toContain('User progress updated successfully');
    });
  });

  describe('isEmailTaken', () => {
    it('should return true when email is taken', async () => {
      const emailResult = Email.create('taken@example.com');
      if (!emailResult.success) {
        throw new Error('Failed to create email for test');
      }
      const email = emailResult.data;

      // Mock the database to have this email
      mockConnection.addUser(
        {
          userId: 'user-123',
          email: 'taken@example.com',
          username: 'taken_user',
          role: 'user',
          identityProviderId: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          level: 1,
          experience: 0,
          totalQuestions: 0,
          correctAnswers: 0,
          accuracy: '0.00',
          studyTimeMinutes: 0,
          currentStreak: 0,
          lastStudyDate: null,
          categoryStats: { version: 1 },
          updatedAt: new Date(),
        }
      );

      const result = await repository.isEmailTaken(email);
      expect(result).toBe(true);
    });

    it('should return false when email is not taken', async () => {
      const emailResult = Email.create('available@example.com');
      if (!emailResult.success) {
        throw new Error('Failed to create email for test');
      }
      const email = emailResult.data;
      const result = await repository.isEmailTaken(email);
      expect(result).toBe(false);
    });
  });

  describe('isUsernameTaken', () => {
    it('should return true when username is taken', async () => {
      // Mock the database to have this username
      mockConnection.addUser(
        {
          userId: 'user-123',
          email: 'user@example.com',
          username: 'taken_username',
          role: 'user',
          identityProviderId: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          level: 1,
          experience: 0,
          totalQuestions: 0,
          correctAnswers: 0,
          accuracy: '0.00',
          studyTimeMinutes: 0,
          currentStreak: 0,
          lastStudyDate: null,
          categoryStats: { version: 1 },
          updatedAt: new Date(),
        }
      );

      const result = await repository.isUsernameTaken('taken_username');
      expect(result).toBe(true);
    });

    it('should return false when username is not taken', async () => {
      const result = await repository.isUsernameTaken('available_username');
      expect(result).toBe(false);
    });
  });

  describe('withTransaction', () => {
    it('should execute function within transaction', async () => {
      const result = await repository.withTransaction(async (txRepo) => {
        expect(txRepo).toBeInstanceOf(DrizzleUserRepository);
        return 'success';
      });

      expect(result).toBe('success');
    });
  });
});
