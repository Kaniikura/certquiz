# API Specification

## Overview

RESTful API built with Hono framework, featuring type-safe endpoints with Zod validation and JWT authentication via identity provider.

Base URL: `http://localhost:4000/api`

## Authentication

All protected endpoints require JWT token in Authorization header:
```
Authorization: Bearer <jwt_token>
```

## Common Response Formats

### Success Response
```typescript
{
  success: true,
  data: T,
  meta?: {
    page?: number,
    limit?: number,
    total?: number
  }
}
```

### Error Response
```typescript
{
  success: false,
  error: {
    code: string,
    message: string,
    details?: any
  }
}
```

## Endpoints

### Authentication Endpoints

#### POST /auth/login
Login with identity provider credentials.

```typescript
// Route definition
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

app.post('/auth/login', 
  zValidator('json', z.object({
    email: z.string().email(),
    password: z.string().min(8)
  })),
  async (c) => {
    const { email, password } = c.req.valid('json');
    // Identity provider authentication logic
    return c.json({ success: true, data: { token, user } });
  }
);

// Request
{
  "email": "user@example.com",
  "password": "password123"
}

// Response
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "username": "user123",
      "role": "user"
    }
  }
}
```

#### POST /auth/refresh
Refresh JWT token.

```typescript
// Route definition
app.post('/auth/refresh', 
  async (c) => {
    const authHeader = c.req.header('authorization');
    if (!authHeader) {
      return c.json({ success: false, error: { code: 'MISSING_AUTH', message: 'Authorization header required' } }, 400);
    }
    const token = authHeader.replace('Bearer ', '');
    // Refresh logic
    return c.json({ success: true, data: { token } });
  }
);
```

#### GET /auth/me
Get current user profile.

```typescript
// Route definition (protected)
app.get('/auth/me', 
  authMiddleware,
  async (c) => {
    const user = c.get('user');
    return c.json({ 
      success: true, 
      data: user 
    });
  }
);

// Response
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "username": "user123",
    "role": "premium",
    "progress": {
      "level": 5,
      "experience": 1250,
      "badges": ["ospf-master", "streak-7"]
    }
  }
}
```

### Question Endpoints

#### GET /questions
Get paginated questions list.

```typescript
// Route definition
app.get('/questions',
  zValidator('query', z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(50).optional().default(10),
    examType: z.string().optional(),
    category: z.string().optional(),
    tags: z.string().optional()
  })),
  async (c) => {
    const { page, limit, examType, category, tags } = c.req.valid('query');
    const user = c.get('user');
    
    // Apply filters based on user role
    const filters = {
      status: 'active',
      ...(user?.role === 'guest' && { isPremium: false }),
      ...(examType && { examType }),
      ...(category && { category }),
      ...(tags && { tags: { contains: tags.split(',') } })
    };
    
    const questions = await db.query.questions.findMany({
      where: filters,
      limit,
      offset: (page - 1) * limit,
      with: {
        options: {
          columns: { id: true, text: true },
          orderBy: (options, { asc }) => [asc(options.order)]
        }
      }
    });
    
    return c.json({ 
      success: true, 
      data: questions,
      meta: { page, limit, total: 100 }
    });
  }
);

// Request
GET /questions?examType=CCNP&category=OSPF&page=1&limit=10

// Response
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "examType": "CCNP",
      "category": "OSPF",
      "tags": ["routing", "ospf"],
      "questionText": "What is the default OSPF hello interval?",
      "type": "single",
      "options": [
        { "id": "uuid1", "text": "10 seconds" },
        { "id": "uuid2", "text": "30 seconds" }
      ]
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 45
  }
}
```

#### GET /questions/:id
Get single question with full details.

```typescript
// Route definition
app.get('/questions/:id',
  zValidator('param', z.object({
    id: z.string().uuid()
  })),
  async (c) => {
    const { id } = c.req.valid('param');
    const user = c.get('user');
    
    const question = await db.query.questions.findFirst({
      where: eq(questions.id, id),
      with: {
        options: true,
        creator: {
          columns: { username: true }
        }
      }
    });
    
    if (!question) {
      throw new NotFoundError('Question not found');
    }
    
    // Remove detailed explanation for non-premium users
    if (user?.role !== 'premium' && user?.role !== 'admin') {
      delete question.detailedExplanation;
    }
    
    return c.json({ success: true, data: question });
  }
);
```

#### POST /questions (Admin/User)
Create a new question.

```typescript
// Route definition (protected)
app.post('/questions',
  zValidator('json', z.object({
    examType: z.string(),
    category: z.string(),
    tags: z.array(z.string()),
    questionText: z.string().min(10),
    type: z.union([z.literal('single'), z.literal('multiple')]),
    options: z.array(z.object({
      text: z.string(),
      isCorrect: z.boolean()
    })).min(2).max(6),
    explanation: z.string(),
    detailedExplanation: z.string().optional(),
    images: z.array(z.string()).optional()
  })),
  authMiddleware,
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    
    const question = await db.transaction(async (tx) => {
      const [newQuestion] = await tx.insert(questions).values({
        ...body,
        createdById: user.id,
        createdByName: user.username,
        isUserGenerated: user.role !== 'admin',
        status: user.role === 'admin' ? 'active' : 'pending'
      }).returning();
      
      // Insert options
      await tx.insert(questionOptions).values(
        body.options.map((opt, idx) => ({
          questionId: newQuestion.id,
          text: opt.text,
          isCorrect: opt.isCorrect,
          order: idx
        }))
      );
      
      return newQuestion;
    });
    
    return c.json({ success: true, data: question });
  }
);

// Request
{
  "examType": "CCNP",
  "category": "OSPF",
  "tags": ["routing", "ospf", "advanced"],
  "questionText": "Which OSPF LSA type is used for external routes?",
  "type": "single",
  "options": [
    { "text": "Type 1", "isCorrect": false },
    { "text": "Type 5", "isCorrect": true },
    { "text": "Type 3", "isCorrect": false },
    { "text": "Type 7", "isCorrect": false }
  ],
  "explanation": "Type 5 LSAs are used for external routes in OSPF."
}
```

#### PUT /questions/:id (Admin)
Update an existing question.

```typescript
// Route definition (admin only)
app.put('/questions/:id',
  zValidator('param', z.object({ 
    id: z.string().uuid() 
  })),
  zValidator('json', z.object({
    examType: z.string(),
    category: z.string(),
    tags: z.array(z.string()),
    questionText: z.string().min(10),
    explanation: z.string(),
    detailedExplanation: z.string().optional()
  }).partial()),
  authMiddleware,
  adminOnly,
  async (c) => {
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    const user = c.get('user');
    
    // Record history before update
    const oldQuestion = await db.query.questions.findFirst({
      where: eq(questions.id, id),
      with: { options: true }
    });
    
    await db.transaction(async (tx) => {
      // Update question
      await tx.update(questions).set({
        ...body,
        version: sql`version + 1`,
        updatedAt: new Date()
      }).where(eq(questions.id, id));
      
      // Record history
      await tx.insert(questionHistory).values({
        questionId: id,
        version: oldQuestion.version + 1,
        changes: { /* diff */ },
        editedById: user.id
      });
    });
    
    return c.json({ success: true });
  }
);
```

### Quiz Session Endpoints

#### POST /quiz/start
Start a new quiz session.

```typescript
// Route definition
app.post('/quiz/start',
  zValidator('json', z.object({
    questionCount: z.union([
      z.literal(1), 
      z.literal(3), 
      z.literal(5), 
      z.literal(10)
    ]),
    examType: z.string().optional(),
    category: z.string().optional()
  })),
  async (c) => {
    const { questionCount, examType, category } = c.req.valid('json');
    const user = c.get('user');
    
    // Get random questions
    const questionList = await db.execute(sql`
      SELECT id FROM questions 
      WHERE status = 'active'
      ${examType ? sql`AND exam_type = ${examType}` : sql``}
      ${category ? sql`AND category = ${category}` : sql``}
      ${user?.role === 'guest' ? sql`AND is_premium = false` : sql``}
      ORDER BY RANDOM()
      LIMIT ${questionCount}
    `);
    
    // Create session
    const [session] = await db.insert(quizSessions).values({
      userId: user?.id || 'guest',
      examType,
      category,
      questionCount
    }).returning();
    
    // Add questions to session
    await db.insert(sessionQuestions).values(
      questionList.map((q, idx) => ({
        sessionId: session.id,
        questionId: q.id,
        order: idx
      }))
    );
    
    return c.json({ 
      success: true, 
      data: { 
        sessionId: session.id,
        questionCount,
        firstQuestion: await getQuestionByOrder(session.id, 0)
      }
    });
  }
);
```

#### POST /quiz/:sessionId/answer
Submit answer for current question.

```typescript
// Route definition
app.post('/quiz/:sessionId/answer',
  zValidator('param', z.object({ 
    sessionId: z.string().uuid() 
  })),
  zValidator('json', z.object({
    questionId: z.string().uuid(),
    selectedOptions: z.array(z.string().uuid())
  })),
  async (c) => {
    const { sessionId } = c.req.valid('param');
    const { questionId, selectedOptions } = c.req.valid('json');
    const user = c.get('user');
    
    // Validate answer and calculate if correct
    const question = await db.query.questions.findFirst({
      where: eq(questions.id, questionId),
      with: { options: true }
    });
    
    const isCorrect = checkAnswer(question, selectedOptions);
    
    // Update session question
    await db.update(sessionQuestions)
      .set({
        answeredAt: new Date(),
        selectedOptions,
        isCorrect
      })
      .where(and(
        eq(sessionQuestions.sessionId, sessionId),
        eq(sessionQuestions.questionId, questionId)
      ));
    
    // Update user progress if logged in
    if (user) {
      await updateUserProgress(user.id, question.category, isCorrect);
    }
    
    // Get next question or finish
    const nextQuestion = await getNextQuestion(sessionId);
    
    return c.json({
      success: true,
      data: {
        isCorrect,
        explanation: question.explanation,
        correctOptions: question.options.filter(o => o.isCorrect).map(o => o.id),
        nextQuestion,
        isComplete: !nextQuestion
      }
    });
  }
);
```

#### GET /quiz/:sessionId/results
Get quiz session results.

```typescript
// Route definition
app.get('/quiz/:sessionId/results', async ({ params: { sessionId } }) => {
  const results = await db.query.quizSessions.findFirst({
    where: eq(quizSessions.id, sessionId),
    with: {
      questions: {
        with: {
          question: {
            with: { options: true }
          }
        }
      }
    }
  });
  
  const score = results.questions.filter(q => q.isCorrect).length;
  const accuracy = (score / results.questionCount) * 100;
  
  return {
    success: true,
    data: {
      score,
      total: results.questionCount,
      accuracy,
      duration: calculateDuration(results.startedAt, results.completedAt),
      questions: results.questions.map(q => ({
        id: q.question.id,
        questionText: q.question.questionText,
        isCorrect: q.isCorrect,
        selectedOptions: q.selectedOptions,
        correctOptions: q.question.options.filter(o => o.isCorrect).map(o => o.id)
      }))
    }
  };
}, {
  params: t.Object({ sessionId: t.String({ format: 'uuid' }) })
});
```

### Progress & Gamification Endpoints

#### GET /progress
Get user learning progress.

```typescript
// Route definition (protected)
app.get('/progress',
  authMiddleware,
  async (c) => {
    const user = c.get('user');
    
    const progress = await db.query.userProgress.findFirst({
      where: eq(userProgress.userId, user.id)
    });
    
    const recentBadges = await db.query.userBadges.findMany({
      where: eq(userBadges.userId, user.id),
      with: { badge: true },
      orderBy: (ub, { desc }) => [desc(ub.unlockedAt)],
      limit: 5
    });
    
    return c.json({
      success: true,
      data: {
        ...progress,
        recentBadges: recentBadges.map(ub => ub.badge)
      }
    });
  }
);
```

#### GET /badges
Get all available badges.

```typescript
// Route definition
app.get('/badges', async ({ user }) => {
  const allBadges = await db.query.badges.findMany();
  
  if (user) {
    const userBadges = await db.query.userBadges.findMany({
      where: eq(userBadges.userId, user.id)
    });
    
    const unlockedIds = new Set(userBadges.map(ub => ub.badgeId));
    
    return {
      success: true,
      data: allBadges.map(badge => ({
        ...badge,
        isUnlocked: unlockedIds.has(badge.id),
        progress: calculateBadgeProgress(user, badge)
      }))
    };
  }
  
  return { success: true, data: allBadges };
});
```

### Community Endpoints

#### POST /reports
Report a problem with a question.

```typescript
// Route definition (protected)
app.post('/reports', async ({ body, user }) => {
  const report = await db.insert(problemReports).values({
    ...body,
    reporterId: user.id,
    status: 'pending'
  }).returning();
  
  return { success: true, data: report[0] };
}, {
  body: t.Object({
    questionId: t.String({ format: 'uuid' }),
    type: t.Union([
      t.Literal('error'),
      t.Literal('unclear'),
      t.Literal('outdated')
    ]),
    description: t.String({ minLength: 10, maxLength: 500 })
  }),
  beforeHandle: [authMiddleware]
});
```

#### GET /reports/mine
Get user's submitted reports.

```typescript
// Route definition (protected)
app.get('/reports/mine', async ({ user, query }) => {
  const { page = 1, limit = 10 } = query;
  
  const reports = await db.query.problemReports.findMany({
    where: eq(problemReports.reporterId, user.id),
    with: {
      question: {
        columns: { questionText: true }
      }
    },
    orderBy: (reports, { desc }) => [desc(reports.createdAt)],
    limit,
    offset: (page - 1) * limit
  });
  
  return { 
    success: true, 
    data: reports,
    meta: { page, limit }
  };
}, {
  query: t.Object({
    page: t.Optional(t.Number({ minimum: 1 })),
    limit: t.Optional(t.Number({ minimum: 1, maximum: 50 }))
  }),
  beforeHandle: [authMiddleware]
});
```

### Admin Endpoints

#### GET /admin/reports
Get all problem reports for review.

```typescript
// Route definition (admin only)
app.get('/admin/reports', async ({ query }) => {
  const { status = 'pending', page = 1, limit = 20 } = query;
  
  const reports = await db.query.problemReports.findMany({
    where: eq(problemReports.status, status),
    with: {
      question: true,
      reporter: {
        columns: { username: true, email: true }
      }
    },
    orderBy: (reports, { asc }) => [asc(reports.createdAt)],
    limit,
    offset: (page - 1) * limit
  });
  
  return { success: true, data: reports };
}, {
  query: t.Object({
    status: t.Optional(t.Union([
      t.Literal('pending'),
      t.Literal('accepted'),
      t.Literal('rejected')
    ])),
    page: t.Optional(t.Number()),
    limit: t.Optional(t.Number())
  }),
  beforeHandle: [authMiddleware, adminOnly]
});
```

#### POST /admin/reports/:id/review
Review and update report status.

```typescript
// Route definition (admin only)
app.post('/admin/reports/:id/review', async ({ params: { id }, body, user }) => {
  const { status, adminComment } = body;
  
  await db.update(problemReports).set({
    status,
    adminComment,
    reviewedById: user.id,
    resolvedAt: new Date()
  }).where(eq(problemReports.id, id));
  
  return { success: true };
}, {
  params: t.Object({ id: t.String({ format: 'uuid' }) }),
  body: t.Object({
    status: t.Union([t.Literal('accepted'), t.Literal('rejected')]),
    adminComment: t.Optional(t.String())
  }),
  beforeHandle: [authMiddleware, adminOnly]
});
```

#### GET /admin/stats
Get system statistics.

```typescript
// Route definition (admin only)
app.get('/admin/stats', async () => {
  const stats = await db.execute(sql`
    SELECT 
      (SELECT COUNT(*) FROM users) as total_users,
      (SELECT COUNT(*) FROM users WHERE role = 'premium') as premium_users,
      (SELECT COUNT(*) FROM questions) as total_questions,
      (SELECT COUNT(*) FROM questions WHERE is_user_generated = true) as user_questions,
      (SELECT COUNT(*) FROM quiz_sessions WHERE completed_at IS NOT NULL) as completed_quizzes,
      (SELECT AVG(accuracy) FROM user_progress) as avg_accuracy
  `);
  
  return { success: true, data: stats[0] };
}, {
  beforeHandle: [authMiddleware, adminOnly]
});
```

### Subscription Endpoints

#### POST /webhooks/bmac
Buy Me a Coffee webhook endpoint.

```typescript
// Route definition (public webhook)
app.post('/webhooks/bmac', async ({ body, headers }) => {
  // Verify webhook signature
  const signature = headers['x-bmac-signature'];
  if (!verifyBMaCSignature(body, signature)) {
    return { success: false, error: 'Invalid signature' };
  }
  
  const { type, email } = body;
  
  if (type === 'membership.started') {
    // Find user by email and upgrade to premium
    const user = await db.query.users.findFirst({
      where: eq(users.email, email)
    });
    
    if (user) {
      await db.update(subscriptions).set({
        plan: 'premium',
        status: 'active',
        buyMeACoffeeEmail: email,
        startDate: new Date()
      }).where(eq(subscriptions.userId, user.id));
      
      await db.update(users).set({
        role: 'premium'
      }).where(eq(users.id, user.id));
    }
  } else if (type === 'membership.cancelled') {
    // Downgrade to free plan
    // Similar logic...
  }
  
  return { success: true };
}, {
  body: t.Object({
    type: t.String(),
    email: t.String(),
    // Other BMaC fields...
  })
});
```

## Error Handling

```typescript
// Global error handler
app.onError(({ code, error }) => {
  if (error instanceof ValidationError) {
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input',
        details: error.details
      }
    };
  }
  
  if (error instanceof UnauthorizedError) {
    return {
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required'
      }
    };
  }
  
  // Default error
  return {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred'
    }
  };
});
```

## Rate Limiting

The API implements rate limiting using a token bucket algorithm to prevent abuse and ensure fair usage.

### Configuration

Rate limiting is configured via environment variables:

- `RATE_LIMIT_ENABLED`: Enable/disable rate limiting (default: true in production)
- `RATE_LIMIT_WINDOW_MS`: Time window in milliseconds (default: 60000 = 1 minute)
- `RATE_LIMIT_MAX_REQUESTS`: Maximum requests per window (default: 100)
- `RATE_LIMIT_KEY_TYPE`: Key generation strategy - 'ip' or 'user' (default: 'ip')

### Implementation

```typescript
import { rateLimiter } from '@api/middleware/rate-limit';
import { InMemoryStore } from '@api/middleware/rate-limit/stores/in-memory';

// Rate limiting applied to all /api/* routes
app.use('/api/*', rateLimiter({
  store: new InMemoryStore({
    windowMs: 60000,
    limit: 100,
  }),
  windowMs: 60000,
  limit: 100,
  keyGenerator: 'ip', // or 'user' for authenticated rate limiting
}));
```

### Response Headers

All API responses include rate limit headers following the draft-7 standard:

- `RateLimit-Limit`: Maximum number of requests allowed in the window
- `RateLimit-Remaining`: Number of requests remaining in the current window
- `RateLimit-Reset`: Unix timestamp (seconds) when the rate limit window resets

### Rate Limit Exceeded Response

When rate limit is exceeded, the API returns HTTP 429:

```json
{
  "error": {
    "message": "Too many requests",
    "code": "RATE_LIMIT"
  }
}
```

Additionally, a `Retry-After` header is included indicating when the client can retry (in seconds).

### Key Generation Strategies

1. **IP-based** (`keyGenerator: 'ip'`):
   - Extracts client IP from headers in order: X-Forwarded-For, CF-Connecting-IP, X-Real-IP
   - Suitable for public endpoints and anonymous users
   - Default strategy

2. **User-based** (`keyGenerator: 'user'`):
   - Uses authenticated user ID from JWT token
   - Falls back to 'anonymous' for unauthenticated requests
   - Suitable for authenticated endpoints

3. **Custom** (provide function):
   ```typescript
   keyGenerator: (c) => `custom:${c.req.header('x-api-key') || 'default'}`
   ```

### Failure Handling

The rate limiter implements a fail-open strategy for high availability:
- If the store encounters an error, requests are allowed to proceed
- Errors are logged but don't block legitimate traffic
- This prevents the rate limiter from becoming a single point of failure

## CORS Configuration

```typescript
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```