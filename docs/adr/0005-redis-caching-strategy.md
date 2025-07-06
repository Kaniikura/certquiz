# 5. Use Redis for Multi-Level Caching

Date: 2025-06-27

## Status

Deprecated - Redis caching removed in favor of Neon database's built-in connection pooling and PostgreSQL's native caching

## Context

The quiz application has several performance challenges:

- Question data is read frequently but changes rarely
- Quiz sessions need fast access during active gameplay
- User progress calculations can be expensive
- JWT validation happens on every request
- Database load increases linearly with users

Without caching, we observed:
- Average response time of 300-500ms for question endpoints
- Database CPU usage reaching 80% with moderate load
- Poor user experience due to slow page loads

## Decision

We will implement Redis as our caching layer with multiple cache levels:

**1. Entity Cache** (TTL: 1 hour)
- Individual questions: `question:{id}`
- User profiles: `user:{id}:profile`
- Badge definitions: `badge:{id}`

**2. Query Cache** (TTL: 15 minutes)
- Question lists: `questions:list:{examType}:{category}:{page}`
- Search results: `search:{hash(params)}`
- Leaderboards: `leaderboard:{type}:{period}`

**3. Session Cache** (TTL: 30 minutes)
- Active quiz sessions: `quiz:{sessionId}:active`
- JWT validation: `jwt:valid:{userId}:{tokenHash}`

**4. Computed Cache** (TTL: 5 minutes)
- User statistics: `user:{id}:stats`
- Category progress: `user:{id}:progress:{category}`

Cache invalidation strategy:
```typescript
// Repository automatically invalidates on write
async update(id: string, data: Partial<Question>) {
  const result = await this.db.update(...);
  await this.cache.deletePattern(`question:${id}:*`);
  await this.cache.deletePattern(`questions:list:*`);
  return result;
}
```

## Consequences

**Positive:**
- 10x improvement in read performance (30ms vs 300ms)
- Reduced database load by 70%
- Better scalability for concurrent users
- Improved user experience with faster responses

**Negative:**
- Additional infrastructure to maintain
- Cache invalidation complexity
- Potential for stale data
- Memory costs for Redis instances

**Neutral:**
- Need to monitor cache hit rates
- TTL values need tuning based on usage patterns
- Team needs to understand caching patterns