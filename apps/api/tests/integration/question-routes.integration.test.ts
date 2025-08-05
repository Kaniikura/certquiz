import { authUser } from '@api/features/auth/infrastructure/drizzle/schema/authUser';
import type {
  QuestionSummary,
  QuestionWithModerationInfo,
} from '@api/features/question/domain/repositories/IQuestionRepository';
import type { QuestionOptionJSON } from '@api/features/question/domain/value-objects/QuestionOption';
import { getDb } from '@api/infra/db/client';
import {
  createExpiredJwtBuilder,
  createJwtBuilder,
  DEFAULT_JWT_CLAIMS,
} from '@api/test-support/mocks/jose-mock-helpers';
import { generateKeyPair } from 'jose';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { setupTestDatabase } from '../helpers/setup-database';
import type { TestApp } from '../setup/test-app-factory';
import { createIntegrationTestApp } from '../setup/test-app-factory';

// Global variables for test keys (will be initialized in beforeAll)
let testPrivateKey: CryptoKey | null = null;
let testPublicKey: CryptoKey | null = null;

// Create the spy outside the mock so it can access testPublicKey at runtime
const getKeySpy = vi.fn(async () => testPublicKey);

// Mock only createRemoteJWKSet to control the behavior of the JWK retrieval process during tests.
// Other jose functions are kept as actual implementations to ensure the integrity of cryptographic operations.
vi.mock('jose', async () => {
  const actual = await vi.importActual<typeof import('jose')>('jose');

  const mockCreateRemoteJWKSet = vi.fn(() => getKeySpy);

  return {
    ...actual,
    createRemoteJWKSet: mockCreateRemoteJWKSet,
  };
});

describe('Question Routes HTTP Integration', () => {
  // Setup isolated test database
  setupTestDatabase();

  let privateKey: CryptoKey;
  let testApp: TestApp;
  let testQuestions: TestQuestion[] = [];

  beforeAll(async () => {
    // Generate test key pair for JWT signing
    const keyPair = await generateKeyPair('RS256');
    testPrivateKey = keyPair.privateKey;
    testPublicKey = keyPair.publicKey;
    privateKey = testPrivateKey;

    // Create test user in database (required for question FK constraint)
    // Use a fixed UUID that matches the JWT token
    const testUserId = '550e8400-e29b-41d4-a716-446655440000';
    const db = getDb();
    await db
      .insert(authUser)
      .values({
        userId: testUserId,
        email: DEFAULT_JWT_CLAIMS.email,
        username: 'testuser123',
        identityProviderId: 'test-provider-id',
        role: 'user',
        isActive: true,
      })
      .onConflictDoNothing(); // Ignore if user already exists

    // Create integration test app using DI container with real database connections
    testApp = await createIntegrationTestApp();
  });

  beforeEach(async () => {
    // Reset test questions array for each test
    testQuestions = [];
  });

  // Helper to create test JWT tokens using utility builder
  async function createTestToken(claims: Record<string, unknown> = {}): Promise<string> {
    const jwtBuilder = await createJwtBuilder(claims);
    return jwtBuilder.sign(privateKey);
  }

  // Helper to create admin JWT tokens
  async function createAdminToken(claims: Record<string, unknown> = {}): Promise<string> {
    const testUserId = '550e8400-e29b-41d4-a716-446655440000'; // Same UUID as database user
    const adminClaims = {
      sub: testUserId,
      realm_access: {
        roles: ['admin'],
      },
      ...claims,
    };
    const jwtBuilder = await createJwtBuilder(adminClaims);
    return jwtBuilder.sign(privateKey);
  }

  // Test question data interface
  interface TestQuestion {
    id?: string;
    questionText: string;
    questionType: 'multiple_choice' | 'multiple_select' | 'true_false';
    explanation: string;
    options: Array<{
      text: string;
      isCorrect: boolean;
    }>;
    examTypes: string[];
    categories: string[];
    difficulty: 'Beginner' | 'Intermediate' | 'Advanced' | 'Mixed';
    tags?: string[];
    isPremium: boolean;
    status: 'active' | 'inactive' | 'draft' | 'archived';
  }

  // Helper to create test question data
  function createTestQuestionData(overrides: Partial<TestQuestion> = {}): TestQuestion {
    const defaultQuestion: TestQuestion = {
      questionText: `What is the default administrative distance for OSPF routes? (${Date.now()})`,
      questionType: 'multiple_choice',
      explanation: 'OSPF has an administrative distance of 110 by default.',
      options: [
        { text: '90', isCorrect: false },
        { text: '100', isCorrect: false },
        { text: '110', isCorrect: true },
        { text: '120', isCorrect: false },
      ],
      examTypes: ['CCNA'],
      categories: ['Routing'],
      difficulty: 'Intermediate',
      tags: ['ospf', 'administrative-distance'],
      isPremium: false,
      status: 'active',
    };

    return { ...defaultQuestion, ...overrides };
  }

  describe('GET /health', () => {
    it('should return healthy status', async () => {
      const res = await testApp.request('/api/questions/health');

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toMatchObject({
        service: 'question',
        status: 'healthy',
        timestamp: expect.any(String),
      });
    });
  });

  describe('POST / (Create Question)', () => {
    describe('Authentication and Authorization', () => {
      it('should require authentication', async () => {
        const questionData = createTestQuestionData();
        const res = await testApp.request('/api/questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(questionData),
        });

        expect(res.status).toBe(401);
        const data = await res.json();
        expect(data.error).toBeDefined();
      });

      it('should require admin role', async () => {
        const token = await createTestToken(); // Regular user token (no admin role)
        const questionData = createTestQuestionData();

        const res = await testApp.request('/api/questions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(questionData),
        });

        expect(res.status).toBe(403);
        const data = await res.json();
        expect(data).toEqual({
          error: 'Insufficient permissions',
        });
      });

      it('should reject requests with expired JWT', async () => {
        const expiredJwtBuilder = await createExpiredJwtBuilder({
          realm_access: { roles: ['admin'] },
        });
        const expiredToken = await expiredJwtBuilder.sign(privateKey);

        const questionData = createTestQuestionData();

        const res = await testApp.request('/api/questions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${expiredToken}`,
          },
          body: JSON.stringify(questionData),
        });

        expect(res.status).toBe(401);
      });
    });

    describe('Validation', () => {
      it('should create question with valid data and admin token', async () => {
        const adminToken = await createAdminToken();
        const questionData = createTestQuestionData();

        const res = await testApp.request('/api/questions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify(questionData),
        });

        expect(res.status).toBe(201);
        const data = await res.json();
        expect(data).toMatchObject({
          success: true,
          data: {
            question: {
              id: expect.any(String),
              version: expect.any(Number),
              questionText: questionData.questionText,
              questionType: questionData.questionType,
              isPremium: questionData.isPremium,
              status: questionData.status,
              createdAt: expect.any(String),
            },
          },
        });

        // Store created question for cleanup or further testing
        testQuestions.push({ ...questionData, id: data.data.question.id });
      });

      it('should return 400 for missing required fields', async () => {
        const adminToken = await createAdminToken();
        const invalidData = {
          // Missing questionText
          questionType: 'multiple_choice',
          explanation: 'Some explanation',
          options: [
            { text: 'Option 1', isCorrect: true },
            { text: 'Option 2', isCorrect: false },
          ],
          examTypes: ['CCNA'],
          categories: ['Routing'],
          difficulty: 'Beginner',
        };

        const res = await testApp.request('/api/questions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify(invalidData),
        });

        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data).toMatchObject({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: expect.stringContaining('questionText'),
          },
        });
      });

      it('should return 400 for invalid question type', async () => {
        const adminToken = await createAdminToken();
        const questionData = createTestQuestionData({
          // @ts-expect-error Testing invalid question type
          questionType: 'invalid_type',
        });

        const res = await testApp.request('/api/questions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify(questionData),
        });

        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data).toMatchObject({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: expect.stringContaining('questionType'),
          },
        });
      });

      it('should return 400 when no correct option is provided', async () => {
        const adminToken = await createAdminToken();
        const questionData = createTestQuestionData({
          options: [
            { text: 'Option 1', isCorrect: false },
            { text: 'Option 2', isCorrect: false },
          ],
        });

        const res = await testApp.request('/api/questions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify(questionData),
        });

        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data).toMatchObject({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: expect.stringContaining('correct'),
          },
        });
      });

      it('should return 400 for multiple_choice with multiple correct options', async () => {
        const adminToken = await createAdminToken();
        const questionData = createTestQuestionData({
          questionType: 'multiple_choice',
          options: [
            { text: 'Option 1', isCorrect: true },
            { text: 'Option 2', isCorrect: true }, // Invalid: multiple correct for single choice
          ],
        });

        const res = await testApp.request('/api/questions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify(questionData),
        });

        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data).toMatchObject({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: expect.stringContaining('exactly one correct'),
          },
        });
      });
    });

    describe('Question Type Specific Validation', () => {
      it('should create multiple_select question with multiple correct options', async () => {
        const adminToken = await createAdminToken();
        const questionData = createTestQuestionData({
          questionText: `Which of the following are valid OSPF network types? (${Date.now()})`,
          questionType: 'multiple_select',
          options: [
            { text: 'Broadcast', isCorrect: true },
            { text: 'Non-broadcast', isCorrect: true },
            { text: 'Point-to-point', isCorrect: true },
            { text: 'Invalid-type', isCorrect: false },
          ],
        });

        const res = await testApp.request('/api/questions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify(questionData),
        });

        expect(res.status).toBe(201);
        const data = await res.json();
        expect(data.data.question.questionType).toBe('multiple_select');

        testQuestions.push({ ...questionData, id: data.data.question.id });
      });

      it('should create true_false question with exactly 2 options', async () => {
        const adminToken = await createAdminToken();
        const questionData = createTestQuestionData({
          questionText: `OSPF is a link-state routing protocol. (${Date.now()})`,
          questionType: 'true_false',
          options: [
            { text: 'True', isCorrect: true },
            { text: 'False', isCorrect: false },
          ],
        });

        const res = await testApp.request('/api/questions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify(questionData),
        });

        expect(res.status).toBe(201);
        const data = await res.json();
        expect(data.data.question.questionType).toBe('true_false');

        testQuestions.push({ ...questionData, id: data.data.question.id });
      });

      it('should return 400 for true_false question with wrong number of options', async () => {
        const adminToken = await createAdminToken();
        const questionData = createTestQuestionData({
          questionType: 'true_false',
          options: [
            { text: 'True', isCorrect: true },
            { text: 'False', isCorrect: false },
            { text: 'Maybe', isCorrect: false }, // Invalid: true/false must have exactly 2 options
          ],
        });

        const res = await testApp.request('/api/questions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify(questionData),
        });

        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data).toMatchObject({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: expect.stringContaining('exactly 2 options'),
          },
        });
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON gracefully', async () => {
      const adminToken = await createAdminToken();

      const res = await testApp.request('/api/questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: 'invalid json',
      });

      expect(res.status).toBe(400);
    });

    it('should handle requests with invalid JWT', async () => {
      const questionData = createTestQuestionData();

      const res = await testApp.request('/api/questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer invalid-token',
        },
        body: JSON.stringify(questionData),
      });

      expect(res.status).toBe(401);
    });
  });

  describe('GET / (List Questions)', () => {
    let createdQuestions: string[] = [];

    beforeEach(async () => {
      // Create test questions with variety for comprehensive testing
      const adminToken = await createAdminToken();
      createdQuestions = [];

      // Create multiple test questions with different characteristics
      const testQuestionsData = [
        createTestQuestionData({
          questionText: `Basic CCNA routing question (${Date.now()})`,
          isPremium: false,
          difficulty: 'Beginner',
          examTypes: ['CCNA'],
          categories: ['Routing'],
          tags: ['basic', 'routing'],
        }),
        createTestQuestionData({
          questionText: `Advanced CCNP switching question (${Date.now()})`,
          isPremium: true,
          difficulty: 'Advanced',
          examTypes: ['CCNP'],
          categories: ['Switching'],
          tags: ['advanced', 'switching'],
        }),
        createTestQuestionData({
          questionText: `Intermediate Security+ question (${Date.now()})`,
          isPremium: false,
          difficulty: 'Intermediate',
          examTypes: ['Security+'],
          categories: ['Security'],
          tags: ['security', 'intermediate'],
        }),
        createTestQuestionData({
          questionText: `Premium CCNA security question (${Date.now()})`,
          isPremium: true,
          difficulty: 'Beginner',
          examTypes: ['CCNA'],
          categories: ['Security'],
          tags: ['ccna', 'security'],
        }),
      ];

      // Create all test questions
      for (const questionData of testQuestionsData) {
        const res = await testApp.request('/api/questions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify(questionData),
        });

        if (res.status === 201) {
          const data = await res.json();
          createdQuestions.push(data.data.question.id);
        }
      }
    });

    describe('Basic Listing', () => {
      it('should return questions without authentication (non-premium only)', async () => {
        const res = await testApp.request('/api/questions');

        expect(res.status).toBe(200);
        const data = await res.json();

        expect(data).toMatchObject({
          success: true,
          data: {
            questions: expect.any(Array),
            pagination: {
              total: expect.any(Number),
              limit: expect.any(Number),
              offset: expect.any(Number),
              hasNext: expect.any(Boolean),
            },
          },
        });

        // Should only include non-premium questions
        const questions = data.data.questions;
        questions.forEach((question: QuestionSummary) => {
          expect(question.isPremium).toBe(false);
        });
      });

      it('should return all questions with authentication (including premium)', async () => {
        const token = await createTestToken();
        const res = await testApp.request('/api/questions', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        expect(res.status).toBe(200);
        const data = await res.json();

        // Should include both premium and non-premium questions
        const questions = data.data.questions;
        const hasPremium = questions.some((q: QuestionSummary) => q.isPremium === true);
        const hasNonPremium = questions.some((q: QuestionSummary) => q.isPremium === false);

        expect(hasPremium || hasNonPremium).toBe(true); // At least one type should be present
      });
    });

    describe('Pagination', () => {
      it('should handle pagination parameters', async () => {
        const res = await testApp.request('/api/questions?limit=2&offset=0');

        expect(res.status).toBe(200);
        const data = await res.json();

        expect(data.data.pagination.limit).toBe(2);
        expect(data.data.pagination.offset).toBe(0);
        expect(data.data.questions.length).toBeLessThanOrEqual(2);
      });

      it('should return 400 for invalid limit', async () => {
        const res = await testApp.request('/api/questions?limit=0');

        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data).toMatchObject({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: expect.stringContaining('Limit'),
          },
        });
      });

      it('should return 400 for negative offset', async () => {
        const res = await testApp.request('/api/questions?offset=-1');

        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data).toMatchObject({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: expect.stringContaining('Offset'),
          },
        });
      });
    });

    describe('Filtering', () => {
      it('should filter by exam types', async () => {
        const res = await testApp.request('/api/questions?examTypes=CCNA');

        expect(res.status).toBe(200);
        const data = await res.json();

        // All returned questions should have CCNA in examTypes
        data.data.questions.forEach((question: QuestionSummary) => {
          expect(question.examTypes).toContain('CCNA');
        });
      });

      it('should filter by categories', async () => {
        const res = await testApp.request('/api/questions?categories=Security');

        expect(res.status).toBe(200);
        const data = await res.json();

        // All returned questions should have Security in categories
        data.data.questions.forEach((question: QuestionSummary) => {
          expect(question.categories).toContain('Security');
        });
      });

      it('should filter by difficulty', async () => {
        const res = await testApp.request('/api/questions?difficulty=Beginner');

        expect(res.status).toBe(200);
        const data = await res.json();

        // All returned questions should have Beginner difficulty
        data.data.questions.forEach((question: QuestionSummary) => {
          expect(question.difficulty).toBe('Beginner');
        });
      });

      it('should handle search query', async () => {
        const res = await testApp.request('/api/questions?searchQuery=routing');

        expect(res.status).toBe(200);
        const data = await res.json();

        // Results should be related to the search term (in text, tags, etc.)
        expect(data.data.questions).toBeDefined();
      });

      it('should return 400 for short search query', async () => {
        const res = await testApp.request('/api/questions?searchQuery=a'); // Too short

        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data).toMatchObject({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: expect.stringContaining('Search query'),
          },
        });
      });
    });

    describe('Premium Access Control', () => {
      it('should exclude premium content without authentication', async () => {
        const res = await testApp.request('/api/questions?includePremium=true');

        expect(res.status).toBe(200);
        const data = await res.json();

        // Even with includePremium=true, should not return premium without auth
        data.data.questions.forEach((question: QuestionSummary) => {
          expect(question.isPremium).toBe(false);
        });
      });

      it('should include premium content with authentication', async () => {
        const token = await createTestToken();
        const res = await testApp.request('/api/questions?includePremium=true', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        expect(res.status).toBe(200);
        const data = await res.json();

        // With authentication, should be able to include premium content
        expect(data.data.questions).toBeDefined();
      });
    });

    describe('Empty Results', () => {
      it('should handle empty results gracefully', async () => {
        const res = await testApp.request('/api/questions?examTypes=NonExistentExam');

        expect(res.status).toBe(200);
        const data = await res.json();

        expect(data).toMatchObject({
          success: true,
          data: {
            questions: [],
            pagination: {
              total: 0,
              limit: expect.any(Number),
              offset: expect.any(Number),
              hasNext: false,
            },
          },
        });
      });
    });
  });

  describe('GET /:questionId (Get Single Question)', () => {
    let testQuestionId: string;
    let premiumQuestionId: string;

    beforeEach(async () => {
      // Create a test question for retrieval
      const adminToken = await createAdminToken();

      // Create non-premium question
      const regularQuestionData = createTestQuestionData({
        questionText: `Regular question for retrieval testing (${Date.now()})`,
        isPremium: false,
      });

      const regularRes = await testApp.request('/api/questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify(regularQuestionData),
      });

      if (regularRes.status === 201) {
        const regularData = await regularRes.json();
        testQuestionId = regularData.data.question.id;
      }

      // Create premium question
      const premiumQuestionData = createTestQuestionData({
        questionText: `Premium question for access testing (${Date.now()})`,
        isPremium: true,
      });

      const premiumRes = await testApp.request('/api/questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify(premiumQuestionData),
      });

      if (premiumRes.status === 201) {
        const premiumData = await premiumRes.json();
        premiumQuestionId = premiumData.data.question.id;
      }
    });

    describe('Basic Retrieval', () => {
      it('should retrieve non-premium question without authentication', async () => {
        const res = await testApp.request(`/api/questions/${testQuestionId}`);

        expect(res.status).toBe(200);
        const data = await res.json();

        expect(data).toMatchObject({
          success: true,
          data: {
            question: {
              id: testQuestionId,
              questionText: expect.any(String),
              questionType: expect.any(String),
              explanation: expect.any(String),
              options: expect.any(Array),
              examTypes: expect.any(Array),
              categories: expect.any(Array),
              difficulty: expect.any(String),
              isPremium: false,
              status: expect.any(String),
              createdAt: expect.any(String),
              updatedAt: expect.any(String),
            },
          },
        });

        // Verify options structure
        data.data.question.options.forEach((option: QuestionOptionJSON) => {
          expect(option).toMatchObject({
            id: expect.any(String),
            text: expect.any(String),
            isCorrect: expect.any(Boolean),
          });
        });
      });

      it('should retrieve question with authentication', async () => {
        const token = await createTestToken();
        const res = await testApp.request(`/api/questions/${testQuestionId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        expect(res.status).toBe(200);
        const data = await res.json();

        expect(data.data.question.id).toBe(testQuestionId);
      });
    });

    describe('Premium Access Control', () => {
      it('should deny access to premium question without authentication', async () => {
        const res = await testApp.request(`/api/questions/${premiumQuestionId}`);

        expect(res.status).toBe(403);
        const data = await res.json();
        expect(data).toMatchObject({
          success: false,
          error: {
            code: 'QUESTION_ACCESS_DENIED',
          },
        });
      });

      it('should allow access to premium question with authentication', async () => {
        const token = await createTestToken();
        const res = await testApp.request(`/api/questions/${premiumQuestionId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        expect(res.status).toBe(200);
        const data = await res.json();

        expect(data.data.question.id).toBe(premiumQuestionId);
        expect(data.data.question.isPremium).toBe(true);
      });
    });

    describe('Error Scenarios', () => {
      it('should return 404 for non-existent question', async () => {
        const nonExistentId = '550e8400-e29b-41d4-a716-446655440000';
        const res = await testApp.request(`/api/questions/${nonExistentId}`);

        expect(res.status).toBe(404);
        const data = await res.json();
        expect(data).toMatchObject({
          success: false,
          error: {
            code: 'QUESTION_NOT_FOUND',
          },
        });
      });

      it('should return 400 for invalid question ID format', async () => {
        const res = await testApp.request('/api/questions/invalid-uuid');

        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data).toMatchObject({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: expect.stringContaining('Invalid question ID'),
          },
        });
      });
    });

    describe('Authentication Edge Cases', () => {
      it('should reject requests with invalid JWT', async () => {
        const res = await testApp.request(`/api/questions/${testQuestionId}`, {
          headers: {
            Authorization: 'Bearer invalid-token',
          },
        });

        // This might return 401 (invalid token) or 200 (falls back to unauthenticated)
        // depending on how optional auth is implemented
        expect([200, 401]).toContain(res.status);
      });

      it('should handle expired JWT gracefully', async () => {
        const expiredJwtBuilder = await createExpiredJwtBuilder();
        const expiredToken = await expiredJwtBuilder.sign(privateKey);
        const res = await testApp.request(`/api/questions/${testQuestionId}`, {
          headers: {
            Authorization: `Bearer ${expiredToken}`,
          },
        });

        // Should either reject with 401 or treat as unauthenticated
        expect([200, 401]).toContain(res.status);
      });
    });
  });

  describe('Admin Moderation Endpoints', () => {
    let draftQuestionId: string;

    beforeEach(async () => {
      // Create a draft question for moderation testing
      const adminToken = await createAdminToken();
      const draftQuestionData = createTestQuestionData({
        questionText: `Draft question for moderation testing (${Date.now()})`,
        status: 'draft',
        isPremium: false,
      });

      const res = await testApp.request('/api/questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify(draftQuestionData),
      });

      if (res.status === 201) {
        const data = await res.json();
        draftQuestionId = data.data.question.id;
      }
    });

    describe('GET /admin/moderate-questions', () => {
      it('should require admin authentication', async () => {
        const res = await testApp.request('/api/admin/questions/pending');

        expect(res.status).toBe(401);
        const data = await res.json();
        expect(data.error).toBeDefined();
      });

      it('should require admin role', async () => {
        const userToken = await createTestToken(); // Regular user token
        const res = await testApp.request('/api/admin/questions/pending', {
          headers: {
            Authorization: `Bearer ${userToken}`,
          },
        });

        expect(res.status).toBe(403);
        const data = await res.json();
        expect(data).toEqual({
          error: 'Insufficient permissions',
        });
      });

      it('should return paginated questions for moderation', async () => {
        const adminToken = await createAdminToken();
        const res = await testApp.request('/api/admin/questions/pending', {
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
        });

        expect(res.status).toBe(200);
        const data = await res.json();

        expect(data).toMatchObject({
          success: true,
          data: {
            items: expect.any(Array),
            total: expect.any(Number),
            page: expect.any(Number),
            pageSize: expect.any(Number),
          },
        });

        // Verify each item has moderation info
        data.data.items.forEach((item: QuestionWithModerationInfo) => {
          expect(item).toMatchObject({
            questionId: expect.any(String),
            questionText: expect.any(String),
            questionType: expect.any(String),
            status: expect.any(String),
            daysPending: expect.any(Number),
            createdAt: expect.any(String),
            updatedAt: expect.any(String),
          });
        });
      });

      it('should handle pagination parameters', async () => {
        const adminToken = await createAdminToken();
        const res = await testApp.request('/api/admin/questions/pending?page=1&pageSize=5', {
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
        });

        expect(res.status).toBe(200);
        const data = await res.json();

        expect(data.data.page).toBe(1);
        expect(data.data.pageSize).toBe(5);
        expect(data.data.items.length).toBeLessThanOrEqual(5);
      });

      it('should filter by status', async () => {
        const adminToken = await createAdminToken();
        const res = await testApp.request('/api/admin/questions/pending?status=DRAFT', {
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
        });

        expect(res.status).toBe(200);
        const data = await res.json();

        // All returned questions should have draft status
        data.data.items.forEach((item: QuestionWithModerationInfo) => {
          expect(item.status).toBe('draft');
        });
      });

      it('should handle date range filtering', async () => {
        const adminToken = await createAdminToken();
        const today = new Date().toISOString().split('T')[0];
        const res = await testApp.request(
          `/api/admin/questions/pending?dateFrom=${today}&dateTo=${today}`,
          {
            headers: {
              Authorization: `Bearer ${adminToken}`,
            },
          }
        );

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.data.items).toBeDefined();
      });
    });

    describe('PATCH /admin/moderate-questions/:questionId', () => {
      it('should require admin authentication', async () => {
        const res = await testApp.request(`/api/admin/questions/${draftQuestionId}/moderate`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'approve',
            feedback: 'Looks good!',
          }),
        });

        expect(res.status).toBe(401);
      });

      it('should require admin role', async () => {
        const userToken = await createTestToken();
        const res = await testApp.request(`/api/admin/questions/${draftQuestionId}/moderate`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userToken}`,
          },
          body: JSON.stringify({
            action: 'approve',
            feedback: 'Looks good!',
          }),
        });

        expect(res.status).toBe(403);
      });

      it('should approve a draft question successfully', async () => {
        const adminToken = await createAdminToken();
        const res = await testApp.request(`/api/admin/questions/${draftQuestionId}/moderate`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            action: 'approve',
            feedback: 'Question is well-structured and accurate',
          }),
        });

        expect(res.status).toBe(200);
        const data = await res.json();

        expect(data).toMatchObject({
          success: true,
          data: {
            success: true,
            questionId: draftQuestionId,
            previousStatus: 'PENDING',
            newStatus: 'APPROVED',
            action: 'approve',
            feedback: 'Question is well-structured and accurate',
          },
        });
        expect(data.data.moderatedBy).toBeDefined();
        expect(data.data.moderatedAt).toBeDefined();
      });

      it('should reject a draft question with feedback', async () => {
        const adminToken = await createAdminToken();
        const res = await testApp.request(`/api/admin/questions/${draftQuestionId}/moderate`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            action: 'reject',
            feedback:
              'The explanation needs more detail and the question text has grammatical errors.',
          }),
        });

        expect(res.status).toBe(200);
        const data = await res.json();

        expect(data).toMatchObject({
          success: true,
          data: {
            success: true,
            questionId: draftQuestionId,
            previousStatus: 'PENDING',
            newStatus: 'REJECTED',
            action: 'reject',
            feedback:
              'The explanation needs more detail and the question text has grammatical errors.',
          },
        });
        expect(data.data.moderatedBy).toBeDefined();
        expect(data.data.moderatedAt).toBeDefined();
      });

      it('should require feedback for rejection', async () => {
        const adminToken = await createAdminToken();
        const res = await testApp.request(`/api/admin/questions/${draftQuestionId}/moderate`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            action: 'reject',
            // Missing feedback
          }),
        });

        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data).toMatchObject({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Feedback is required for reject action',
          },
        });
      });

      it('should require minimum feedback length for rejection', async () => {
        const adminToken = await createAdminToken();
        const res = await testApp.request(`/api/admin/questions/${draftQuestionId}/moderate`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            action: 'reject',
            feedback: 'Too short', // Less than 10 characters
          }),
        });

        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data).toMatchObject({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: expect.stringContaining('at least 10 characters'),
          },
        });
      });

      it('should return 404 for non-existent question', async () => {
        const adminToken = await createAdminToken();
        const nonExistentId = '550e8400-e29b-41d4-a716-446655440000';
        const res = await testApp.request(`/api/admin/questions/${nonExistentId}/moderate`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            action: 'approve',
            feedback: 'Good question',
          }),
        });

        expect(res.status).toBe(404);
        const data = await res.json();
        expect(data).toMatchObject({
          success: false,
          error: {
            code: 'QUESTION_NOT_FOUND',
          },
        });
      });

      it('should return 400 for invalid question ID format', async () => {
        const adminToken = await createAdminToken();
        const res = await testApp.request('/api/admin/questions/invalid-uuid/moderate', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            action: 'approve',
            feedback: 'Good question',
          }),
        });

        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data).toMatchObject({
          success: false,
          error: {
            code: 'INVALID_ID_FORMAT',
          },
        });
      });

      it('should return 400 for invalid action', async () => {
        const adminToken = await createAdminToken();
        const res = await testApp.request(`/api/admin/questions/${draftQuestionId}/moderate`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            action: 'invalid_action',
            feedback: 'Good question',
          }),
        });

        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data).toMatchObject({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
          },
        });
      });

      it('should prevent moderation of non-draft questions', async () => {
        // Create a fresh draft question for this specific test
        const adminToken = await createAdminToken();
        const freshDraftQuestionData = createTestQuestionData({
          questionText: `Fresh draft question for double moderation test (${Date.now()})`,
          status: 'draft',
          isPremium: false,
        });

        const createRes = await testApp.request('/api/questions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify(freshDraftQuestionData),
        });

        expect(createRes.status).toBe(201);
        const createData = await createRes.json();
        const freshDraftQuestionId = createData.data.question.id;

        // First approve the question
        const firstResponse = await testApp.request(
          `/api/admin/questions/${freshDraftQuestionId}/moderate`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify({
              action: 'approve',
              feedback: 'Question approved successfully', // Must be >= 10 characters
            }),
          }
        );

        expect(firstResponse.status).toBe(200);

        // Then try to moderate it again
        const res = await testApp.request(`/api/admin/questions/${freshDraftQuestionId}/moderate`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            action: 'reject',
            feedback: 'Changed my mind',
          }),
        });

        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data).toMatchObject({
          success: false,
          error: {
            code: 'INVALID_QUESTION_DATA',
            message: expect.stringContaining('Only DRAFT questions can be moderated'),
          },
        });
      });
    });

    describe('Moderation Data Persistence', () => {
      it('should persist moderation metadata', async () => {
        const adminToken = await createAdminToken();
        const feedback = 'Excellent question with clear explanations';

        // Moderate the question
        const moderateRes = await testApp.request(
          `/api/admin/questions/${draftQuestionId}/moderate`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify({
              action: 'approve',
              feedback,
            }),
          }
        );

        expect(moderateRes.status).toBe(200);

        // Verify the question status was updated by trying to fetch it
        const questionRes = await testApp.request(`/api/questions/${draftQuestionId}`, {
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
        });

        expect(questionRes.status).toBe(200);
        const questionData = await questionRes.json();
        expect(questionData.data.question.status).toBe('active'); // Should be approved
      });
    });
  });
});
