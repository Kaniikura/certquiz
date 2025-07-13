# ADR-004: Auth Domain AggregateRoot Architecture Decision

## Status
Accepted

## Context

In our codebase, we have two different implementations of AggregateRoot:

1. **Quiz Domain**: Full event sourcing implementation with versioning, event management, and replay capabilities
2. **Auth Domain**: Simplified implementation with only basic identity and equality

This architectural difference raises questions about consistency and may confuse new developers joining the team.

## Decision

We decided to keep the Auth domain's AggregateRoot implementation **minimal and non-event-sourced** for the following reasons:

### 1. YAGNI Principle (You Aren't Gonna Need It)
- **Current Requirements**: Auth operations (login, user management) do not require:
  - Event replay for audit trails
  - Partial event rehydration
  - Complex domain event coordination
  - Optimistic concurrency control with versioning

- **Premature Infrastructure**: Adding event sourcing capabilities without concrete use cases violates YAGNI and adds unnecessary complexity.

### 2. Domain Complexity Differences

#### Quiz Domain (Event Sourcing Justified)
- **Complex State Transitions**: Quiz sessions involve multiple steps (start → answer → complete)
- **Audit Requirements**: Need to replay quiz attempts for analysis
- **Temporal Queries**: "What was the quiz state after question 3?"
- **Concurrency**: Multiple operations on same quiz session

#### Auth Domain (Simple State Management)
- **Simple Operations**: Create user, update profile, login validation
- **CRUD-based**: Most operations are straightforward create/read/update/delete
- **No Replay Needs**: No business requirement to reconstruct user state from events
- **Low Concurrency**: User operations typically don't conflict

### 3. Bounded Context Isolation (DDD)

Following Domain-Driven Design principles:
- **Different Bounded Contexts** should have different technical approaches based on their specific needs
- **Auth Context** has different complexity and requirements than **Quiz Context**
- **Consistency** doesn't mean identical implementation across all domains

### 4. Future Evolution Path

When/if Auth domain needs event sourcing:

1. **Extract Common Base**: Create `shared/kernel/EventSourcedAggregateRoot`
2. **Migrate Quiz First**: Prove extraction works correctly
3. **Opt-in Auth**: Only when concrete business requirements emerge
4. **Deprecate Simple**: Use ESLint rules to prevent new simple aggregates

## Consequences

### Positive
- ✅ **Simpler Codebase**: Auth domain remains focused and lightweight
- ✅ **YAGNI Compliance**: No speculative infrastructure
- ✅ **Clear Boundaries**: Different domains solve different problems
- ✅ **Faster Development**: No event sourcing overhead for simple operations

### Negative
- ⚠️ **Initial Confusion**: New developers may wonder about inconsistency
- ⚠️ **Future Migration**: If event sourcing becomes needed, migration required
- ⚠️ **Pattern Diversity**: Two different aggregate patterns in codebase

### Mitigation
- 📝 **Documentation**: This ADR explains the decision
- 📝 **Code Comments**: Both AggregateRoot files link to this ADR
- 📝 **Team Education**: Onboarding includes explanation of domain differences

## Technical Implementation

### Quiz Domain AggregateRoot
```typescript
export abstract class AggregateRoot<TId, TEventPayloads> {
  private _version: number = 0;
  private _uncommittedEvents: DomainEvent<TId, TEventPayloads>[] = [];
  // ... full event sourcing implementation
}
```

### Auth Domain AggregateRoot  
```typescript
export abstract class AggregateRoot<TId> {
  constructor(public readonly id: TId) {}
  equals(other: AggregateRoot<TId>): boolean {
    return this.id === other.id;
  }
}
```

## Review Criteria

This decision should be reconsidered if:

1. **Audit Requirements**: Auth operations need detailed audit trails
2. **Compliance Needs**: Regulatory requirements for user action replay
3. **Complex Workflows**: Multi-step user registration/verification processes
4. **Event Integration**: Need to publish auth events to external systems
5. **Temporal Queries**: Business needs to query historical user states

## References

- [Event Sourcing Pattern](https://martinfowler.com/eaaDev/EventSourcing.html)
- [YAGNI Principle](https://martinfowler.com/bliki/Yagni.html)
- [Bounded Context](https://martinfowler.com/bliki/BoundedContext.html)
- Quiz Domain Implementation: `apps/api/src/features/quiz/domain/base/AggregateRoot.ts`
- Auth Domain Implementation: `apps/api/src/features/auth/domain/base/AggregateRoot.ts`

---
**Date**: 2025-07-12  
**Authors**: Claude Code Implementation Team  
**Reviewers**: Development Team Lead