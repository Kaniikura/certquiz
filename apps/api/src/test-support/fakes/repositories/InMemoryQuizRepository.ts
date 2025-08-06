import type { UserId } from '@api/features/auth/domain/value-objects/UserId';
import type { QuizSession } from '@api/features/quiz/domain/aggregates/QuizSession';
import type {
  AdminQuizParams,
  IQuizRepository,
  QuizWithUserInfo,
} from '@api/features/quiz/domain/repositories/IQuizRepository';
import type { QuizSessionId } from '@api/features/quiz/domain/value-objects/Ids';
import { QuizState } from '@api/features/quiz/domain/value-objects/QuizState';
import type { PaginatedResult } from '@api/shared/types/pagination';

/**
 * In-memory implementation of IQuizRepository
 */
export class InMemoryQuizRepository implements IQuizRepository {
  private sessions: Map<string, QuizSession> = new Map();
  private userActiveSessionIndex: Map<string, QuizSession> = new Map();

  // Mock user data for admin operations (in real app this would come from auth service)
  private mockUsers: Map<string, { email: string }> = new Map([
    ['user1', { email: 'user1@example.com' }],
    ['user2', { email: 'user2@example.com' }],
    ['admin1', { email: 'admin@example.com' }],
  ]);

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

  async countTotalSessions(): Promise<number> {
    return this.sessions.size;
  }

  async countActiveSessions(): Promise<number> {
    let activeCount = 0;
    for (const session of this.sessions.values()) {
      if (session.state === QuizState.InProgress) {
        activeCount++;
      }
    }
    return activeCount;
  }

  async getAverageScore(): Promise<number> {
    // TODO: Implement proper score calculation
    // This requires access to question details to compare selectedOptionIds
    // with correctOptionIds. For now, return placeholder value.
    return 0;
  }

  async findAllForAdmin(params: AdminQuizParams): Promise<PaginatedResult<QuizWithUserInfo>> {
    const { page, pageSize, filters, orderBy = 'startedAt', orderDir = 'desc' } = params;

    // Get all sessions
    let sessions = Array.from(this.sessions.values());

    // Apply filters
    if (filters?.state) {
      sessions = sessions.filter((session) => session.state.toString() === filters.state);
    }

    if (filters?.userId) {
      sessions = sessions.filter((session) => session.userId.toString() === filters.userId);
    }

    if (filters?.startDate) {
      const startDate = filters.startDate;
      sessions = sessions.filter((session) => session.startedAt >= startDate);
    }

    if (filters?.endDate) {
      const endDate = filters.endDate;
      sessions = sessions.filter((session) => session.startedAt <= endDate);
    }

    // Sort sessions
    sessions.sort((a, b) => {
      const dateA = orderBy === 'startedAt' ? a.startedAt : a.completedAt;
      const dateB = orderBy === 'startedAt' ? b.startedAt : b.completedAt;

      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;

      const comparison = dateA.getTime() - dateB.getTime();
      return orderDir === 'asc' ? comparison : -comparison;
    });

    // Apply pagination
    const totalCount = sessions.length;
    const offset = (page - 1) * pageSize;
    const paginatedSessions = sessions.slice(offset, offset + pageSize);

    // Map to QuizWithUserInfo
    const items: QuizWithUserInfo[] = paginatedSessions.map((session) => {
      const userEmail =
        this.mockUsers.get(session.userId.toString())?.email || 'unknown@example.com';

      // Calculate score for completed sessions
      let score: number | null = null;
      if (session.state !== QuizState.InProgress) {
        // Mock score calculation for testing - assume 75% correct
        score = 75;
      }

      return {
        sessionId: session.id.toString(),
        userId: session.userId.toString(),
        userEmail,
        state: session.state,
        score,
        questionCount: 20, // Mock question count for testing
        startedAt: session.startedAt,
        completedAt: session.completedAt || null, // Convert undefined to null
      };
    });

    return {
      items,
      total: totalCount,
      page,
      pageSize,
    };
  }

  async deleteWithCascade(sessionId: QuizSessionId): Promise<void> {
    const sessionKey = sessionId.toString();
    const session = this.sessions.get(sessionKey);

    if (session) {
      // Remove from main sessions map
      this.sessions.delete(sessionKey);

      // Remove from active session index if present
      this.userActiveSessionIndex.delete(session.userId.toString());
    }

    // In a real implementation, this would also delete related records
    // like answers, events, etc. For testing, we just remove the session.
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
