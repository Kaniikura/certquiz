/**
 * Performance test data generation utilities
 * @fileoverview Helper functions to generate test data for performance benchmarks
 */

import { randomUUID } from 'node:crypto';
import * as schema from '@api/infra/db/schema';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { QuizStateValue } from '../schema/enums';

/**
 * Generate test quiz sessions for performance benchmarking
 * Creates completed quiz sessions with realistic score distributions
 */
export async function seedQuizSessions(
  trx: PostgresJsDatabase<typeof schema>,
  count: number,
  options: {
    questionsPerQuiz?: number;
    userIdPrefix?: string;
  } = {}
): Promise<void> {
  const { questionsPerQuiz = 10, userIdPrefix = 'test-user' } = options;

  // Create test users first (10 users to distribute load)
  // Use a timestamp to ensure unique users per test run
  const timestamp = Date.now();
  const userIds = [];
  for (let i = 0; i < 10; i++) {
    const userId = randomUUID();
    userIds.push(userId);
  }

  // Insert test users
  await trx
    .insert(schema.authUser)
    .values(
      userIds.map((id, index) => ({
        userId: id,
        email: `${userIdPrefix}-${timestamp}-${index}@test.com`,
        username: `${userIdPrefix}_${timestamp}_${index}`,
        identityProviderId: null,
        role: 'user' as const,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: new Date(),
      }))
    )
    .onConflictDoNothing();

  const sessions = [];
  const batchSize = 100; // Insert in batches to avoid memory issues

  for (let i = 0; i < count; i++) {
    // Generate realistic score distribution (normal distribution around 70%)
    const correctAnswers = Math.floor(
      Math.random() * questionsPerQuiz * 0.3 + questionsPerQuiz * 0.55
    );

    sessions.push({
      sessionId: randomUUID(),
      ownerId: userIds[i % 10], // Distribute across 10 users
      state: 'COMPLETED' as QuizStateValue,
      questionCount: questionsPerQuiz,
      currentQuestionIndex: questionsPerQuiz - 1,
      startedAt: new Date(Date.now() - 3600000), // 1 hour ago
      expiresAt: null,
      completedAt: new Date(Date.now() - 1800000), // 30 minutes ago
      version: 1,
      config: {
        questionCount: questionsPerQuiz,
        timeLimit: null,
        examType: 'CCNA',
      },
      questionOrder: Array.from({ length: questionsPerQuiz }, () => randomUUID()),
      answers: generateAnswersJson(questionsPerQuiz, correctAnswers),
      correctAnswers,
      updatedAt: new Date(Date.now() - 1800000),
    });

    // Insert in batches
    if (sessions.length >= batchSize || i === count - 1) {
      await trx.insert(schema.quizSessionSnapshot).values(sessions);
      sessions.length = 0; // Clear array
    }
  }
}

/**
 * Generate realistic answers JSON for a quiz session
 */
function generateAnswersJson(
  questionCount: number,
  correctCount: number
): Record<
  string,
  { questionId: string; selectedOption: string; isCorrect: boolean; answeredAt: string }
> {
  const answers: Record<
    string,
    { questionId: string; selectedOption: string; isCorrect: boolean; answeredAt: string }
  > = {};
  const correctIndices = new Set<number>();

  // Randomly select which questions will be correct
  while (correctIndices.size < correctCount) {
    correctIndices.add(Math.floor(Math.random() * questionCount));
  }

  for (let i = 0; i < questionCount; i++) {
    const questionId = `question-${i}`;
    answers[questionId] = {
      questionId,
      selectedOption: correctIndices.has(i) ? 'correct-option' : 'wrong-option',
      isCorrect: correctIndices.has(i),
      answeredAt: new Date(Date.now() - 2700000 + i * 60000).toISOString(), // Space out by 1 minute
    };
  }

  return answers;
}

/**
 * Clear all quiz session data (for test cleanup)
 */
export async function clearQuizSessions(trx: PostgresJsDatabase<typeof schema>): Promise<void> {
  await trx.delete(schema.quizSessionSnapshot);
  // Note: Don't delete auth_user since it has cascading deletes
}
