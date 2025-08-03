# Rate Limiting Middleware Implementation Plan

## Current Status Summary (Updated: 2025-08-27)

**Overall Progress**: 🚀 **STARTING** (0 of 5 phases completed)

- ⏳ **Phase 1**: Core Types and Interfaces - **PENDING**
  - Define RateLimiterStore interface
  - Create type definitions
  - Document interfaces
  
- ⏳ **Phase 2**: InMemoryStore Implementation - **PENDING**
  - Token bucket algorithm
  - Automatic cleanup
  - Comprehensive unit tests
  
- ⏳ **Phase 3**: Key Generation Utilities - **PENDING**
  - IP-based key generator
  - User-based key generator
  - Composite key generator
  
- ⏳ **Phase 4**: Main Middleware Implementation - **PENDING**
  - Factory function
  - Response headers
  - Error handling
  
- ⏳ **Phase 5**: Integration and Documentation - **PENDING**
  - Export from middleware index
  - Update app factory
  - Document in API specification

## Progress Status (Updated: 2025-08-27)

### ⏳ Phase 1: Core Types and Interfaces - PENDING
- **Estimated Duration**: 1 hour
- **Developer**: Assistant with TDD approach
- **Prerequisites**: None

**Planned Tasks** (TDD Approach):
1. ❌ **RED**: Write failing tests for RateLimiterStore interface
2. ⏳ **GREEN**: Create minimal types.ts to make tests pass
3. ⏳ **REFACTOR**: Add comprehensive type documentation and examples

### ⏳ Phase 2: InMemoryStore Implementation - PENDING
- **Estimated Duration**: 2-3 hours
- **Prerequisites**: Phase 1 completion
- **TDD Cycles**: 5-6 cycles for different aspects

**Planned Tasks** (TDD Approach):
1. ❌ **RED**: Write tests for basic token consumption
2. ⏳ **GREEN**: Implement minimal consume() method
3. ⏳ **REFACTOR**: Optimize token bucket calculations
4. ❌ **RED**: Write tests for token refill logic
5. ⏳ **GREEN**: Implement refill calculations
6. ⏳ **REFACTOR**: Extract time calculations
7. ❌ **RED**: Write tests for cleanup mechanism
8. ⏳ **GREEN**: Implement automatic cleanup
9. ⏳ **REFACTOR**: Optimize memory usage

### ⏳ Phase 3: Key Generation Utilities - PENDING
- **Estimated Duration**: 1.5 hours
- **Prerequisites**: None (can be parallel with Phase 2)

**Planned Tasks** (TDD Approach):
1. ❌ **RED**: Write tests for IP key generation
2. ⏳ **GREEN**: Implement IP extraction with X-Forwarded-For
3. ⏳ **REFACTOR**: Add fallback logic
4. ❌ **RED**: Write tests for user key generation
5. ⏳ **GREEN**: Implement user ID extraction
6. ⏳ **REFACTOR**: Handle edge cases

### ⏳ Phase 4: Main Middleware Implementation - PENDING
- **Estimated Duration**: 2-3 hours
- **Prerequisites**: Phases 1-3 completion

**Planned Tasks** (TDD Approach):
1. ❌ **RED**: Write integration tests for middleware
2. ⏳ **GREEN**: Create basic middleware factory
3. ⏳ **REFACTOR**: Add configuration options
4. ❌ **RED**: Write tests for rate limit headers
5. ⏳ **GREEN**: Implement header setting
6. ⏳ **REFACTOR**: Follow draft-7 standard
7. ❌ **RED**: Write tests for error responses
8. ⏳ **GREEN**: Integrate with RateLimitError
9. ⏳ **REFACTOR**: Add graceful degradation

### ⏳ Phase 5: Integration and Documentation - PENDING
- **Estimated Duration**: 1 hour
- **Prerequisites**: Phases 1-4 completion

**Planned Tasks**:
1. ⏳ Export rate limiter from middleware index
2. ⏳ Add optional rate limiting to app factory
3. ⏳ Update API specification documentation
4. ⏳ Create usage examples and migration guide

## Executive Summary

This implementation plan addresses the need for rate limiting middleware in the CertQuiz API to:
- **Prevent abuse** and protect the API from excessive requests
- **Ensure fair usage** across all users
- **Prepare for horizontal scaling** with an extensible architecture

The implementation will follow a **Test-Driven Development (TDD)** approach with the Red-Green-Refactor cycle, using the **Strategy Pattern** for storage backends, starting with an in-memory implementation but designed for easy migration to Redis or Cloudflare Rate Limiting.

## Current State Analysis

### Current Situation
- **No rate limiting** currently implemented
- **RateLimitError** class exists in shared/errors.ts
- **HTTP 429 status** defined in shared/http-status.ts
- **Empty rate-limit directory** exists in middleware folder
- **API specification** mentions rate limiting but not implemented

### Requirements Analysis
Based on user requirements and research:
- **Token Bucket Algorithm** preferred over fixed window
- **Horizontal Scaling** consideration for future
- **Extensible Design** to support Redis/Cloudflare later
- **User and IP based** rate limiting capabilities
- **Standard Headers** support (RateLimit-*, Retry-After)

## Architecture Before/After

### Before: No Rate Limiting
```typescript
// Current state - no rate limiting
app.use('/api/*', auth({ required: false }));
app.route('/api/quiz', quizRoutes);
// Any client can make unlimited requests
```

### After: Extensible Rate Limiting
```typescript
// With rate limiting middleware
import { rateLimiter } from '@api/middleware/rate-limit';
import { InMemoryStore } from '@api/middleware/rate-limit/stores';

// Basic usage
app.use('/api/*', rateLimiter({
  store: new InMemoryStore(),
  windowMs: 60 * 1000,      // 1 minute
  limit: 100,               // 100 requests per window
  keyGenerator: 'ip',       // or 'user' or custom function
}));

// Advanced usage with different tiers
app.use('/api/*', rateLimiter({
  store: new InMemoryStore(),
  tiers: [
    { match: { authenticated: true }, limit: 1000, windowMs: 60000 },
    { match: { role: 'premium' }, limit: 5000, windowMs: 60000 },
    { match: { default: true }, limit: 100, windowMs: 60000 }
  ],
  standardHeaders: 'draft-7',
  legacyHeaders: false,
}));
```

## Detailed Execution Plan

### Phase 1: Core Types and Interfaces (TDD)
**Duration**: 1 hour | **Priority**: 🔴 Critical | **Risk**: Low

#### RED: Write Failing Tests First
```typescript
// types.test.ts
import { describe, it, expect } from 'vitest';
import type { RateLimiterStore, ConsumeResult, RateLimiterOptions } from './types';

describe('RateLimiterStore Interface', () => {
  it('should define consume method signature', () => {
    const mockStore: RateLimiterStore = {
      consume: async (key: string) => ({
        success: true,
        remaining: 99,
        resetTime: Date.now() + 60000,
      }),
    };
    
    expect(mockStore.consume).toBeDefined();
    expect(typeof mockStore.consume).toBe('function');
  });
});

describe('ConsumeResult Type', () => {
  it('should have required properties', () => {
    const result: ConsumeResult = {
      success: true,
      remaining: 50,
      resetTime: 1234567890,
    };
    
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('remaining');
    expect(result).toHaveProperty('resetTime');
  });
});
```

#### GREEN: Create Minimal Implementation
```typescript
// types.ts
export interface ConsumeResult {
  success: boolean;
  remaining: number;
  resetTime: number;
}

export interface RateLimiterStore {
  consume(key: string): Promise<ConsumeResult>;
}

export interface RateLimiterOptions {
  store: RateLimiterStore;
  windowMs: number;
  limit: number;
  keyGenerator: string | ((c: Context) => string);
}
```

#### REFACTOR: Add Documentation and Types
```typescript
// types.ts (enhanced)
/**
 * Result of attempting to consume a token from the rate limiter
 */
export interface ConsumeResult {
  /** Whether the request is allowed (token was available) */
  success: boolean;
  /** Number of tokens remaining in the current window */
  remaining: number;
  /** UNIX timestamp (ms) when the rate limit window resets */
  resetTime: number;
  /** Optional retry after duration in seconds */
  retryAfter?: number;
}

/**
 * Storage backend interface for rate limiter
 */
export interface RateLimiterStore {
  /**
   * Attempts to consume a token for the given key
   * @param key - Unique identifier for the client
   * @returns Promise resolving to consumption result
   */
  consume(key: string): Promise<ConsumeResult>;
  
  /**
   * Optional: Clear expired entries
   */
  cleanup?(): Promise<void>;
}
```

### Phase 2: InMemoryStore Implementation (TDD)
**Duration**: 2-3 hours | **Priority**: 🔴 Critical | **Risk**: Medium

#### Cycle 1: Basic Token Consumption

##### RED: Write Failing Test
```typescript
// in-memory.test.ts
describe('InMemoryStore', () => {
  it('should allow first request', async () => {
    const store = new InMemoryStore({
      windowMs: 60000,
      limit: 100,
    });
    
    const result = await store.consume('test-key');
    
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(99);
  });
});
```

##### GREEN: Minimal Implementation
```typescript
// in-memory.ts
export class InMemoryStore implements RateLimiterStore {
  private buckets = new Map<string, TokenBucket>();
  
  constructor(private options: InMemoryStoreOptions) {}
  
  async consume(key: string): Promise<ConsumeResult> {
    return {
      success: true,
      remaining: 99,
      resetTime: Date.now() + this.options.windowMs,
    };
  }
}
```

##### REFACTOR: Implement Proper Logic
```typescript
// in-memory.ts (enhanced)
interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

export class InMemoryStore implements RateLimiterStore {
  private buckets = new Map<string, TokenBucket>();
  
  async consume(key: string): Promise<ConsumeResult> {
    const now = Date.now();
    let bucket = this.buckets.get(key);
    
    if (!bucket) {
      bucket = {
        tokens: this.options.limit,
        lastRefill: now,
      };
      this.buckets.set(key, bucket);
    }
    
    // Token bucket refill logic
    const elapsed = now - bucket.lastRefill;
    const tokensToAdd = elapsed * (this.options.limit / this.options.windowMs);
    bucket.tokens = Math.min(this.options.limit, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
    
    // Attempt to consume
    if (bucket.tokens >= 1) {
      bucket.tokens--;
      return {
        success: true,
        remaining: Math.floor(bucket.tokens),
        resetTime: now + this.options.windowMs,
      };
    }
    
    return {
      success: false,
      remaining: 0,
      resetTime: now + this.options.windowMs,
      retryAfter: Math.ceil((1 - bucket.tokens) / (this.options.limit / this.options.windowMs)),
    };
  }
}
```

### Phase 3: Key Generation Utilities (TDD)
**Duration**: 1.5 hours | **Priority**: 🟡 High | **Risk**: Low

#### RED: Write Failing Tests
```typescript
// key-generators.test.ts
describe('Key Generators', () => {
  describe('getIpKey', () => {
    it('should extract IP from X-Forwarded-For header', () => {
      const mockContext = {
        req: {
          header: (name: string) => {
            if (name === 'x-forwarded-for') return '192.168.1.1, 10.0.0.1';
            return null;
          },
        },
      };
      
      const key = getIpKey(mockContext as any);
      expect(key).toBe('ip:192.168.1.1');
    });
  });
  
  describe('getUserKey', () => {
    it('should extract user ID from context', () => {
      const mockContext = {
        get: (name: string) => {
          if (name === 'user') return { sub: 'user-123' };
          return null;
        },
      };
      
      const key = getUserKey(mockContext as any);
      expect(key).toBe('user:user-123');
    });
  });
});
```

#### GREEN: Implement Key Generators
```typescript
// key-generators.ts
import type { Context } from 'hono';
import type { AuthUser } from '@api/middleware/auth/auth-user';

export function getIpKey(c: Context): string {
  const forwarded = c.req.header('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';
  return `ip:${ip}`;
}

export function getUserKey(c: Context): string {
  const user = c.get('user') as AuthUser | undefined;
  return user ? `user:${user.sub}` : 'user:anonymous';
}
```

### Phase 4: Main Middleware Implementation (TDD)
**Duration**: 2-3 hours | **Priority**: 🔴 Critical | **Risk**: Medium

#### RED: Write Integration Tests
```typescript
// rate-limiter.test.ts
describe('rateLimiter middleware', () => {
  it('should allow requests within limit', async () => {
    const app = new Hono();
    const store = new InMemoryStore({ windowMs: 60000, limit: 2 });
    
    app.use('*', rateLimiter({ store, keyGenerator: 'ip' }));
    app.get('/', (c) => c.text('OK'));
    
    const res1 = await app.request('/');
    expect(res1.status).toBe(200);
    expect(res1.headers.get('X-RateLimit-Remaining')).toBe('1');
    
    const res2 = await app.request('/');
    expect(res2.status).toBe(200);
    expect(res2.headers.get('X-RateLimit-Remaining')).toBe('0');
    
    const res3 = await app.request('/');
    expect(res3.status).toBe(429);
  });
});
```

#### GREEN: Implement Middleware
```typescript
// index.ts
import { createMiddleware } from 'hono/factory';
import { RateLimitError } from '@api/shared/errors';
import type { RateLimiterOptions } from './types';

export function rateLimiter(options: RateLimiterOptions) {
  return createMiddleware(async (c, next) => {
    const key = typeof options.keyGenerator === 'string'
      ? getKeyGenerator(options.keyGenerator)(c)
      : options.keyGenerator(c);
    
    const result = await options.store.consume(key);
    
    // Set rate limit headers
    c.header('X-RateLimit-Remaining', result.remaining.toString());
    c.header('X-RateLimit-Reset', result.resetTime.toString());
    
    if (!result.success) {
      if (result.retryAfter) {
        c.header('Retry-After', result.retryAfter.toString());
      }
      throw new RateLimitError('Too many requests', result.retryAfter);
    }
    
    await next();
  });
}
```

## Technical Solution Design

### Strategy Pattern for Storage Backends

**Architecture**:
```
┌─────────────────┐
│   Middleware    │
│  (rateLimiter)  │
└────────┬────────┘
         │ uses
         ▼
┌─────────────────┐
│ RateLimiterStore│ ◄── Interface
└─────────────────┘
         △
         │ implements
    ┌────┴────┬─────────┬──────────┐
    │         │         │          │
┌───▼───┐ ┌──▼───┐ ┌──▼───┐ ┌────▼────┐
│InMemory│ │Redis │ │Cloud │ │  Mock   │
│ Store  │ │Store │ │flare │ │ Store   │
└────────┘ └──────┘ └──────┘ └─────────┘
```

### Token Bucket Algorithm

**Key Properties**:
- **Bucket Size**: Maximum tokens (burst capacity)
- **Refill Rate**: Tokens per millisecond
- **Current Tokens**: Available tokens at time T
- **Last Refill**: Timestamp of last calculation

**Algorithm**:
```
1. Calculate elapsed time since last refill
2. Calculate tokens to add: elapsed * refillRate
3. Update bucket: min(bucketSize, currentTokens + tokensToAdd)
4. If tokens >= 1:
   - Consume 1 token
   - Return success
5. Else:
   - Calculate retry after
   - Return failure
```

## Risk Analysis & Mitigation

### Technical Risks

| Risk | Probability | Impact | Mitigation Strategy |
|------|-------------|--------|-------------------|
| **Memory Leak** | Medium | High | Implement automatic cleanup, monitor memory usage |
| **Clock Skew** | Low | Medium | Use monotonic time, handle negative elapsed time |
| **Race Conditions** | Low | Low | Node.js single-threaded, but prepare for Redis atomicity |
| **Performance Impact** | Medium | Medium | Benchmark middleware overhead, optimize hot paths |

### Mitigation Strategies

1. **Memory Management**:
   - Implement TTL-based cleanup
   - Set maximum entries limit
   - Monitor memory usage in tests

2. **Graceful Degradation**:
   - Fail-open option for high availability
   - Fallback to no rate limiting on store failure
   - Log failures for monitoring

## Success Metrics & Validation

### Quantitative Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| **Test Coverage** | >90% | Vitest coverage report |
| **Performance Overhead** | <1ms per request | Benchmark tests |
| **Memory Usage** | <100MB for 10k keys | Memory profiling |
| **TypeScript Compliance** | 0 errors | `bun run typecheck` |

### Validation Checklist

#### Implementation Validation
- [ ] All tests passing (unit + integration)
- [ ] TypeScript compilation clean
- [ ] Biome linting passed
- [ ] Coverage >90%

#### Functional Validation
- [ ] Rate limiting works for IP keys
- [ ] Rate limiting works for user keys
- [ ] Headers set correctly
- [ ] Error responses correct

#### Performance Validation
- [ ] Overhead <1ms
- [ ] Memory usage acceptable
- [ ] No memory leaks
- [ ] Cleanup works

## Timeline & Resource Allocation

### Schedule

| Phase | Duration | Start | End | Status |
|-------|----------|-------|-----|--------|
| Phase 1 | 1 hour | TBD | TBD | Pending |
| Phase 2 | 2-3 hours | TBD | TBD | Pending |
| Phase 3 | 1.5 hours | TBD | TBD | Pending |
| Phase 4 | 2-3 hours | TBD | TBD | Pending |
| Phase 5 | 1 hour | TBD | TBD | Pending |
| **Total** | **8-10 hours** | | | |

### Development Approach
- **TDD Cycles**: Red-Green-Refactor for each component
- **Incremental Progress**: Complete each phase before moving to next
- **Continuous Validation**: Run tests after each green phase

## Long-term Maintenance Strategy

### Future Enhancements

1. **Redis Store Implementation**:
   ```typescript
   export class RedisStore implements RateLimiterStore {
     constructor(private redis: Redis) {}
     
     async consume(key: string): Promise<ConsumeResult> {
       // Use Lua script for atomic operations
       const result = await this.redis.eval(RATE_LIMIT_SCRIPT, 1, key, ...args);
       return parseRedisResult(result);
     }
   }
   ```

2. **Cloudflare Store Implementation**:
   ```typescript
   export class CloudflareStore implements RateLimiterStore {
     constructor(private binding: RateLimit) {}
     
     async consume(key: string): Promise<ConsumeResult> {
       const { success } = await this.binding.limit({ key });
       // Map Cloudflare response to our interface
     }
   }
   ```

### Monitoring and Observability

1. **Metrics to Track**:
   - Rate limit hits/misses
   - Store performance
   - Memory usage
   - Error rates

2. **Logging**:
   ```typescript
   logger.info('Rate limit consumed', {
     key,
     remaining: result.remaining,
     success: result.success,
   });
   ```

## Conclusion

This implementation plan provides a solid foundation for rate limiting in the CertQuiz API that:
- **Starts simple** with in-memory storage
- **Scales elegantly** to Redis/Cloudflare
- **Follows best practices** with TDD and clean architecture
- **Integrates seamlessly** with existing middleware stack

The token bucket algorithm provides smooth rate limiting without the thundering herd problem of fixed windows, while the Strategy Pattern ensures easy migration to production-ready storage backends when needed.

**Next Steps**: Begin Phase 1 implementation with TDD approach, creating failing tests first and then implementing minimal code to make them pass.