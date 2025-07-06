# 4. Implement Event-Driven Architecture for Cross-Cutting Concerns

Date: 2025-06-27

## Status

Superseded by [ADR-0009](./0009-vertical-slice-architecture.md)

## Context

The quiz application has several cross-cutting concerns that span multiple services:

- When a quiz is completed, we need to:
  - Update user progress
  - Check for badge unlocks
  - Update statistics
  - Send notifications
  - Create audit logs

- When a user levels up, we need to:
  - Unlock new content
  - Send congratulations
  - Update leaderboards

Implementing these directly in services creates tight coupling and violates the single responsibility principle. Services would need to know about and depend on many other services.

## Decision

We will implement an event bus for publishing and handling domain events.

Services will emit events for significant state changes:
```typescript
// In QuizService
async completeQuiz(sessionId: string) {
  // ... complete quiz logic ...
  
  await this.eventBus.emit({
    type: EventType.QUIZ_COMPLETED,
    aggregateId: session.id,
    payload: {
      userId: session.userId,
      score: result.score,
      category: session.category
    }
  });
}
```

Handlers will react to events asynchronously:
```typescript
// In ProgressService
eventBus.on(EventType.QUIZ_COMPLETED, async (event) => {
  await this.updateUserProgress(event.payload.userId, event.payload);
  await this.checkBadgeUnlocks(event.payload.userId);
});
```

Implementation phases:
1. Phase 1: In-memory event bus for same-process events
2. Phase 2: Redis Pub/Sub for distributed events
3. Phase 3: Message queue (RabbitMQ) for durability

## Consequences

**Positive:**
- Services are loosely coupled
- Easy to add new reactions to events
- Audit logging becomes trivial
- Enables event sourcing in the future
- Better separation of concerns

**Negative:**
- Eventual consistency between aggregates
- Debugging can be more complex
- Need to handle event ordering and deduplication
- Additional infrastructure complexity

**Neutral:**
- Team needs to understand event-driven patterns
- Need to document event flows
- Event schema versioning becomes important