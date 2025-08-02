import type { QuizSession } from '@api/features/quiz/domain/aggregates/QuizSession';
import type { IQuizRepository } from '@api/features/quiz/domain/repositories/IQuizRepository';
import type { QuizSessionId, UserId } from '@api/features/quiz/domain/value-objects/Ids';
import { QuizState } from '@api/features/quiz/domain/value-objects/QuizState';

/**
 * In-memory implementation of IQuizRepository
 */
export class InMemoryQuizRepository implements IQuizRepository {
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
      if (
        session.state === QuizState.Expired ||
        (session.state === QuizState.InProgress &&
          session.config.timeLimit &&
          now.getTime() - session.startedAt.getTime() >= session.config.timeLimit * 1000)
      ) {
        expiredSessions.push(session);
      }
    }

    return expiredSessions.slice(0, limit);
  }

  async findActiveByUser(userId: UserId): Promise<QuizSession | null> {
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
