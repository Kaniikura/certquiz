# 6. Use URL-Based API Versioning

Date: 2025-06-27

## Status

Accepted

## Context

As the quiz application evolves, we will need to make breaking changes to our API:

- Changing response formats
- Modifying endpoint behaviors
- Removing deprecated fields
- Restructuring resources

Without versioning, we would:
- Break existing client applications
- Force all clients to update simultaneously
- Unable to support multiple app versions in production

We considered several versioning strategies:
1. URL path versioning: `/api/v1/questions`
2. Header versioning: `Accept: application/vnd.quiz.v1+json`
3. Query parameter: `/api/questions?version=1`

## Decision

We will use URL-based versioning with the pattern `/api/v{number}/resource`.

Implementation:
```typescript
// Route structure
app.group('/api/v1', (v1) => {
  v1.use('/questions', questionRoutes);
  v1.use('/quiz', quizRoutes);
  v1.use('/auth', authRoutes);
});

// Future versions
app.group('/api/v2', (v2) => {
  v2.use('/questions', questionRoutesV2);
  // Can selectively upgrade endpoints
});
```

Versioning policies:
- Major versions only (v1, v2, not v1.1)
- Support previous version for 6 months minimum
- Deprecation warnings in headers
- Clear migration guides for breaking changes

## Consequences

**Positive:**
- Clear version visibility in URLs
- Easy to route different versions
- Simple for clients to understand
- Can run multiple versions simultaneously
- Easy to deprecate old versions

**Negative:**
- URLs become longer
- Some code duplication between versions
- Need to maintain multiple versions

**Neutral:**
- Version is part of the API contract
- Requires clear versioning policy
- Documentation must cover all active versions