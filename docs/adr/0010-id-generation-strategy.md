# ADR-010: ID Generation Strategy (Deferred Implementation)

## Status
**Deferred** to Repository Implementation Phase (Task 5.2+)

## Context

Currently, ID generation is handled directly in value object factories using `crypto.randomUUID()`:

```typescript
// Current approach in Ids.ts
function generateId(): string {
  return crypto.randomUUID();
}

export const QuizSessionId = {
  generate: (): QuizSessionId => generateId() as QuizSessionId,
  // ...
};
```

During code review, it was noted that a prepared `IdGenerator` interface existed but was unused, raising concerns about dead code.

## Decision

1. **Remove unused `IdGenerator` interface** for Phase 1
2. **Keep current direct approach** in value object factories 
3. **Defer proper dependency injection** until repository implementation
4. **Document future implementation strategy**

## Rationale

### Why Remove Now
- **YAGNI Principle**: Not currently needed for Phase 1 completion
- **Code Hygiene**: Unused code adds maintenance burden and review confusion
- **Focus**: Task 5.2 (Auth Slice) is current priority

### Why Defer to Repository Phase
- **Natural Integration Point**: Repositories will need ID generation for persistence
- **Batch Refactoring**: Can be done together with other infrastructure changes
- **Risk Reduction**: Avoid premature abstraction without clear requirements

## Future Implementation

When repositories are implemented, the proper DDD approach will be:

```typescript
// Application layer generates IDs
export class StartQuizHandler {
  constructor(
    private readonly idGenerator: IdGenerator,
    private readonly quizRepository: IQuizRepository
  ) {}

  async handle(command: StartQuizCommand): Promise<Result<QuizSessionId>> {
    const quizId = QuizSessionId.of(this.idGenerator.generate());
    const quiz = QuizSession.create(quizId, command.config);
    
    await this.quizRepository.save(quiz);
    return ok(quiz.id);
  }
}

// Infrastructure implementations
interface IdGenerator {
  generate(): string;
}

class CryptoIdGenerator implements IdGenerator {
  generate(): string {
    return crypto.randomUUID();
  }
}

class TestIdGenerator implements IdGenerator {
  private counter = 1;
  generate(): string {
    return `test-id-${this.counter++}`;
  }
}
```

## Benefits of Future Approach

1. **Domain Purity**: Domain layer becomes side-effect free
2. **Testability**: Deterministic ID generation in tests
3. **Flexibility**: Easy to swap ID generation strategies
4. **Consistency**: Follows DDD infrastructure patterns

## Implementation Timeline

- **Phase 1**: Continue with current approach (direct crypto calls)
- **Task 5.2+**: Implement proper dependency injection with repositories
- **Target**: Sprint after Auth slice completion

## Related

- Task 5.1: ✅ Quiz Domain completed with current approach
- Task 5.2: 🟡 Auth Slice (next priority)
- Backlog: "Refactor ID generation to Infrastructure layer"

## References

- [Domain-Driven Design by Eric Evans](https://www.domainlanguage.com/ddd/)
- [YAGNI Principle](https://martinfowler.com/bliki/Yagni.html)
- Project Task List: Phase 1 Implementation Plan