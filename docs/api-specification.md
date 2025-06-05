# API Specification

## Overview

RESTful API built with Elysia framework, featuring type-safe endpoints with Zod validation and JWT authentication via KeyCloak.

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
Login with KeyCloak credentials.

```typescript
// Route definition
app.post('/auth/login', async ({ body }) => {
  const { email, password } = body;
  // KeyCloak authentication logic
  return { success: true, data: { token, user } };
}, {
  body: t.Object({
    email: t.String({ format: 'email' }),
    password: t.String({ minLength: 8 })
  })
});

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
app.post('/auth/refresh', async ({ headers }) => {
  const token = headers.authorization?.replace('Bearer ', '');
  // Refresh logic
  return { success: true, data: { token } };
}, {
  headers: t.Object({
    authorization: t.String()
  })
});
```

#### GET /auth/me
Get current user profile.

```typescript
// Route definition (protected)
app.get('/auth/me', async ({ user }) => {
  return { 
    success: true, 
    data: user 
  };
}, {
  beforeHandle: [authMiddleware]
});

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
app.get('/questions', async ({ query, user }) => {
  const { page = 1, limit = 10, examType, category, tags } = query;
  
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
  
  return { 
    success: true, 
    data: questions,
    meta: { page, limit, total: 100 }
  };
}, {
  query: t.Object({
    page: t.Optional(t.Number({ minimum: 1 })),
    limit: t.Optional(t.Number({ minimum: 1, maximum: 50 })),
    examType: t.Optional(t.String()),
    category: t.Optional(t.String()),
    tags: t.Optional(t.String())
  })
});

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
app.get('/questions/:id', async ({ params: { id }, user }) => {
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
  
  return { success: true, data: question };
}, {
  params: t.Object({
    id: t.String({ format: 'uuid' })
  })
});
```

#### POST /questions (Admin/User)
Create a new question.

```typescript
// Route definition (protected)
app.post('/questions', async ({ body, user }) => {
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
  
  return { success: true, data: question };
}, {
  body: t.Object({
    examType: t.String(),
    category: t.String(),
    tags: t.Array(t.String()),
    questionText: t.String({ minLength: 10 }),
    type: t.Union([t.Literal('single'), t.Literal('multiple')]),
    options: t.Array(t.Object({
      text: t.String(),
      isCorrect: t.Boolean()
    }), { minItems: 2, maxItems: 6 }),
    explanation: t.String(),
    detailedExplanation: t.Optional(t.String()),
    images: t.Optional(t.Array(t.String()))
  }),
  beforeHandle: [authMiddleware]
});

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
app.put('/questions/:id', async ({ params: { id }, body, user }) => {
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
  
  return { success: true };
}, {
  params: t.Object({ id: t.String({ format: 'uuid' }) }),
  body: t.Partial(/* question schema */),
  beforeHandle: [authMiddleware, adminOnly]
});
```

### Quiz Session Endpoints

#### POST /quiz/start
Start a new quiz session.

```typescript
// Route definition
app.post('/quiz/start', async ({ body, user }) => {
  const { questionCount, examType, category } = body;
  
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
  
  return { 
    success: true, 
    data: { 
      sessionId: session.id,
      questionCount,
      firstQuestion: await getQuestionByOrder(session.id, 0)
    }
  };
}, {
  body: t.Object({
    questionCount: t.Union([
      t.Literal(1), 
      t.Literal(3), 
      t.Literal(5), 
      t.Literal(10)
    ]),
    examType: t.Optional(t.String()),
    category: t.Optional(t.String())
  })
});
```

#### POST /quiz/:sessionId/answer
Submit answer for current question.

```typescript
// Route definition
app.post('/quiz/:sessionId/answer', async ({ params: { sessionId }, body, user }) => {
  const { questionId, selectedOptions } = body;
  
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
  
  return {
    success: true,
    data: {
      isCorrect,
      explanation: question.explanation,
      correctOptions: question.options.filter(o => o.isCorrect).map(o => o.id),
      nextQuestion,
      isComplete: !nextQuestion
    }
  };
}, {
  params: t.Object({ sessionId: t.String({ format: 'uuid' }) }),
  body: t.Object({
    questionId: t.String({ format: 'uuid' }),
    selectedOptions: t.Array(t.String({ format: 'uuid' }))
  })
});
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
app.get('/progress', async ({ user }) => {
  const progress = await db.query.userProgress.findFirst({
    where: eq(userProgress.userId, user.id)
  });
  
  const recentBadges = await db.query.userBadges.findMany({
    where: eq(userBadges.userId, user.id),
    with: { badge: true },
    orderBy: (ub, { desc }) => [desc(ub.unlockedAt)],
    limit: 5
  });
  
  return {
    success: true,
    data: {
      ...progress,
      recentBadges: recentBadges.map(ub => ub.badge)
    }
  };
}, {
  beforeHandle: [authMiddleware]
});
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

```typescript
// Rate limit middleware
const rateLimiter = new RateLimiter({
  points: 100, // requests
  duration: 60, // per minute
  keyPrefix: 'api'
});

app.use(async ({ request, set }) => {
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  
  try {
    await rateLimiter.consume(ip);
  } catch {
    set.status = 429;
    return {
      success: false,
      error: {
        code: 'RATE_LIMIT',
        message: 'Too many requests'
      }
    };
  }
});
```

## CORS Configuration

```typescript
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```