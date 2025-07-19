/**
 * Fake Unit of Work implementation for unit testing
 *
 * This provides a test double that implements the IUnitOfWork interface
 * without requiring actual database connections. Useful for testing
 * business logic in isolation from database infrastructure.
 */

import type { User } from '@api/features/auth/domain/entities/User';
import type { IUserRepository } from '@api/features/auth/domain/repositories/IUserRepository';
import type { Email } from '@api/features/auth/domain/value-objects/Email';
import type { UserId } from '@api/features/auth/domain/value-objects/UserId';
import type { QuizSession } from '@api/features/quiz/domain/aggregates/QuizSession';
import type { IQuizRepository } from '@api/features/quiz/domain/repositories/IQuizRepository';
import type {
  QuizSessionId,
  UserId as QuizUserId,
} from '@api/features/quiz/domain/value-objects/Ids';
import { QuizState } from '@api/features/quiz/domain/value-objects/QuizState';
import type { IUnitOfWork } from '@api/infra/db/IUnitOfWork';

/**
 * In-memory fake implementation of IUserRepository
 */
export class FakeUserRepository implements IUserRepository {
  private users: Map<string, User> = new Map();
  private emailIndex: Map<string, User> = new Map();
  private identityProviderIndex: Map<string, User> = new Map();
  private usernameIndex: Map<string, User> = new Map();

  async findById(id: UserId): Promise<User | null> {
    return this.users.get(id.toString()) || null;
  }

  async findByEmail(email: Email): Promise<User | null> {
    return this.emailIndex.get(email.toString()) || null;
  }

  async findByIdentityProviderId(identityProviderId: string): Promise<User | null> {
    return this.identityProviderIndex.get(identityProviderId) || null;
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.usernameIndex.get(username) || null;
  }

  async save(user: User): Promise<void> {
    const data = user.toPersistence();

    // Update all indexes
    this.users.set(data.userId, user);
    this.emailIndex.set(data.email, user);
    if (data.identityProviderId) {
      this.identityProviderIndex.set(data.identityProviderId, user);
    }
    this.usernameIndex.set(data.username, user);
  }

  async isEmailTaken(email: Email, excludeUserId?: UserId): Promise<boolean> {
    const user = await this.findByEmail(email);
    if (!user) return false;
    if (excludeUserId && user.id === excludeUserId) return false;
    return true;
  }

  async isUsernameTaken(username: string, excludeUserId?: UserId): Promise<boolean> {
    const user = await this.findByUsername(username);
    if (!user) return false;
    if (excludeUserId && user.id === excludeUserId) return false;
    return true;
  }

  // Test helper methods
  clear(): void {
    this.users.clear();
    this.emailIndex.clear();
    this.identityProviderIndex.clear();
    this.usernameIndex.clear();
  }

  getAll(): User[] {
    return Array.from(this.users.values());
  }
}

/**
 * In-memory fake implementation of IQuizRepository
 */
export class FakeQuizRepository implements IQuizRepository {
  private sessions: Map<string, QuizSession> = new Map();
  private userActiveSessionIndex: Map<string, QuizSession> = new Map();

  async findById(id: QuizSessionId): Promise<QuizSession | null> {
    return this.sessions.get(id.toString()) || null;
  }

  async save(session: QuizSession): Promise<void> {
    this.sessions.set(session.id.toString(), session);

    // Update user active session index
    if (session.state === QuizState.InProgress) {
      this.userActiveSessionIndex.set(session.userId.toString(), session);
    } else {
      this.userActiveSessionIndex.delete(session.userId.toString());
    }
  }

  async findExpiredSessions(now: Date, limit: number): Promise<QuizSession[]> {
    const expiredSessions: QuizSession[] = [];

    for (const session of this.sessions.values()) {
      // Check if session is expired based on state or time limit
      if (session.state === QuizState.Expired) {
        expiredSessions.push(session);
      } else if (session.state === QuizState.InProgress && session.config.timeLimit) {
        const elapsed = now.getTime() - session.startedAt.getTime();
        if (elapsed >= session.config.timeLimit * 1000 && expiredSessions.length < limit) {
          expiredSessions.push(session);
        }
      }

      if (expiredSessions.length >= limit) {
        break;
      }
    }

    return expiredSessions;
  }

  async findActiveByUser(userId: QuizUserId): Promise<QuizSession | null> {
    return this.userActiveSessionIndex.get(userId.toString()) || null;
  }

  // Test helper methods
  clear(): void {
    this.sessions.clear();
    this.userActiveSessionIndex.clear();
  }

  getAll(): QuizSession[] {
    return Array.from(this.sessions.values());
  }
}

/**
 * Fake Unit of Work implementation for testing
 *
 * Simulates transaction behavior without actual database transactions.
 * All operations are performed in-memory.
 */
export class FakeUnitOfWork implements IUnitOfWork {
  private userRepository: FakeUserRepository;
  private quizRepository: FakeQuizRepository;
  private isTransactionActive = false;
  private isCommitted = false;
  private isRolledBack = false;

  constructor(userRepository?: FakeUserRepository, quizRepository?: FakeQuizRepository) {
    this.userRepository = userRepository || new FakeUserRepository();
    this.quizRepository = quizRepository || new FakeQuizRepository();
  }

  async begin(): Promise<void> {
    if (this.isTransactionActive) {
      throw new Error('Transaction already active');
    }
    this.isTransactionActive = true;
    this.isCommitted = false;
    this.isRolledBack = false;
  }

  async commit(): Promise<void> {
    if (!this.isTransactionActive) {
      throw new Error('No active transaction');
    }
    if (this.isRolledBack) {
      throw new Error('Transaction already rolled back');
    }
    this.isCommitted = true;
    this.isTransactionActive = false;
  }

  async rollback(): Promise<void> {
    if (!this.isTransactionActive) {
      throw new Error('No active transaction');
    }
    if (this.isCommitted) {
      throw new Error('Transaction already committed');
    }
    this.isRolledBack = true;
    this.isTransactionActive = false;
  }

  getUserRepository(): IUserRepository {
    return this.userRepository;
  }

  getQuizRepository(): IQuizRepository {
    return this.quizRepository;
  }

  // Test helper methods
  isInTransaction(): boolean {
    return this.isTransactionActive;
  }

  hasCommitted(): boolean {
    return this.isCommitted;
  }

  hasRolledBack(): boolean {
    return this.isRolledBack;
  }
}

/**
 * Factory for creating FakeUnitOfWork instances
 */
export class FakeUnitOfWorkFactory {
  private userRepository: FakeUserRepository;
  private quizRepository: FakeQuizRepository;

  constructor() {
    this.userRepository = new FakeUserRepository();
    this.quizRepository = new FakeQuizRepository();
  }

  create(): FakeUnitOfWork {
    return new FakeUnitOfWork(this.userRepository, this.quizRepository);
  }

  // Test helper methods
  getUserRepository(): FakeUserRepository {
    return this.userRepository;
  }

  getQuizRepository(): FakeQuizRepository {
    return this.quizRepository;
  }

  clear(): void {
    this.userRepository.clear();
    this.quizRepository.clear();
  }
}

/**
 * Helper function to execute a callback with a fake unit of work
 * Mimics the behavior of withUnitOfWork but with fake implementation
 */
export async function withFakeUnitOfWork<T>(
  factory: FakeUnitOfWorkFactory,
  callback: (uow: IUnitOfWork) => Promise<T>
): Promise<T> {
  const uow = factory.create();
  await uow.begin();

  try {
    const result = await callback(uow);
    await uow.commit();
    return result;
  } catch (error) {
    await uow.rollback();
    throw error;
  }
}
