# Instructions for Claude Code

## 🚨 CRITICAL: Development Principles

### Test-Driven Development (TDD) is MANDATORY
- **NEVER** write code without tests first
- **ALWAYS** follow Red-Green-Refactor cycle
- **NO EXCEPTIONS** - This is the #1 rule

### Schema-Driven Development is REQUIRED
- **ALWAYS** define TypeSpec schemas before APIs
- **ALWAYS** update database schema before queries
- **NEVER** create endpoints without schema definition

## Project Context

You are implementing CertQuiz - a technical certification quiz application. The main context is in `/CLAUDE.md` at the project root. Always read that first.

## Implementation Approach

### 1. Test-Driven Development (TDD)
- **ALWAYS** write tests before implementation
- Test files go next to source files (`*.test.ts`)
- Use Vitest for testing
- Aim for 80% coverage minimum

### 2. Type Safety
- **NEVER** use `any` type
- Prefer explicit types over inference
- Use type guards for runtime validation
- All functions must have explicit return types

### 3. Database Operations
- Always use transactions for multi-table operations
- Use Drizzle's query builder, not raw SQL
- Handle errors with Result types
- Check `/docs/DATABASE_SCHEMA.md` for schema

### 4. Code Organization
```typescript
// Import order
1. External packages
2. Internal packages (@certquiz/*)
3. Relative imports
4. Type imports
```

## Common Patterns

### API Endpoint Pattern
```typescript
app.post('/api/resource', async ({ body, user }) => {
  // 1. Validate input (automatic with Elysia)
  // 2. Check permissions
  // 3. Perform business logic
  // 4. Return consistent response
  return { success: true, data: result };
}, {
  body: t.Object({ /* schema */ }),
  beforeHandle: [authMiddleware]
});
```

### Error Handling Pattern
```typescript
type Result<T> = 
  | { success: true; data: T }
  | { success: false; error: Error };

async function operation(): Promise<Result<Data>> {
  try {
    const data = await riskyOperation();
    return { success: true, data };
  } catch (error) {
    return { success: false, error };
  }
}
```

### Component Pattern (Svelte)
```svelte
<script lang="ts">
  // Props first
  export let prop: Type;
  
  // State
  let state = initialValue;
  
  // Reactive statements
  $: computed = deriveFrom(state);
  
  // Functions
  function handleEvent() {}
</script>

<!-- Template -->
<!-- Styles -->
```

## File Naming Conventions

- Components: `PascalCase.svelte`
- Utilities: `camelCase.ts`
- Types: `types/PascalCase.ts`
- Routes: `kebab-case/+page.svelte`
- API routes: `routes/resource.ts`

## Git Workflow

1. Create feature branch: `feat/feature-name`
2. Make atomic commits following @.claude/commit-convention.md
3. Write tests for all new code
4. Ensure all tests pass
5. Update relevant documentation

## Commit Message Format

Follow the convention defined in @.claude/commit-convention.md:
- Use Conventional Commits format with Gitmoji
- Example: `✨ feat(quiz): add timer functionality`
- Include descriptive body for complex changes
- Reference issues in footer when applicable

## Performance Considerations

- Keep API responses under 200ms
- Use database indexes (check schema)
- Implement pagination for lists
- Cache static data
- Lazy load frontend components

## Security Checklist

- [ ] Validate all inputs
- [ ] Use parameterized queries (Drizzle handles this)
- [ ] Check authentication on protected routes
- [ ] Sanitize user-generated content
- [ ] Never expose sensitive data in responses

## When Stuck

1. Check `/docs/TASK_LIST.md` for current task details
2. Refer to `/docs/API_SPECIFICATION.md` for endpoint examples
3. Follow patterns in `/docs/CODING_STANDARDS.md`
4. Look for similar implementations in codebase
5. Add TODO comment and move to next task

## Daily Workflow

1. Read CLAUDE.md for context
2. Check TASK_LIST.md for next task
3. Write tests first
4. Implement feature
5. Verify tests pass
6. Commit with proper message
7. Update task status in comments

## Important Reminders

- Mobile-first design (test on small screens)
- Dark mode support required
- Accessibility (ARIA labels, keyboard nav)
- Keep functions small (<20 lines preferred)
- Document complex logic with comments

## Phase 1 Priorities

Focus on core functionality only:
1. Basic quiz taking
2. User authentication
3. Progress tracking
4. Admin question management

Do NOT implement in Phase 1:
- Community features
- Payment integration
- Gamification
- Advanced question types

## Testing Commands

```bash
# Run all tests
bun test

# Run specific test file
bun test auth.test.ts

# Run with coverage
bun test --coverage

# Run in watch mode
bun test --watch
```

Remember: Quality over speed. Write clean, tested code that follows the established patterns.