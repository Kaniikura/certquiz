# Rate Limiting Middleware

A flexible, extensible rate limiting middleware for Hono applications implementing the token bucket algorithm.

## Overview

This middleware provides:
- 🪣 **Token Bucket Algorithm**: Smooth rate limiting with burst capacity
- 🔌 **Pluggable Storage**: Strategy pattern for different backends (InMemory, Redis, Cloudflare)
- 🔑 **Flexible Key Generation**: IP-based, user-based, or custom strategies
- 📊 **Standard Headers**: draft-7 compliant rate limit headers
- 🛡️ **Fail-Open Strategy**: High availability with graceful degradation
- 🧪 **100% Test Coverage**: Comprehensive test suite with TDD approach

## Quick Start

### Basic Usage

```typescript
import { rateLimiter } from '@api/middleware/rate-limit';
import { InMemoryStore } from '@api/middleware/rate-limit/stores/in-memory';

// Apply rate limiting to all API routes
app.use('/api/*', rateLimiter({
  store: new InMemoryStore({
    windowMs: 60000,  // 1 minute
    limit: 100,       // 100 requests per minute
  }),
  windowMs: 60000,
  limit: 100,
  keyGenerator: 'ip',
}));
```

### Environment Configuration

Configure via environment variables:

```bash
# Enable/disable rate limiting
RATE_LIMIT_ENABLED=true

# Time window in milliseconds
RATE_LIMIT_WINDOW_MS=60000

# Maximum requests per window
RATE_LIMIT_MAX_REQUESTS=100

# Key generation strategy: 'ip' or 'user'
RATE_LIMIT_KEY_TYPE=ip
```

## Architecture

### Token Bucket Algorithm

The implementation uses a token bucket algorithm which provides:
- Smooth rate limiting without thundering herd issues
- Burst capacity for legitimate traffic spikes
- Continuous token refill based on elapsed time
- Accurate retry-after calculations

### Component Structure

```
rate-limit/
├── index.ts           # Main middleware factory
├── types.ts           # TypeScript interfaces
├── key-generators.ts  # Key generation strategies
└── stores/
    └── in-memory.ts   # In-memory store implementation
```

## Key Generation Strategies

### IP-Based (Default)

Extracts client IP from headers in priority order:

```typescript
keyGenerator: 'ip'

// Checks headers in order:
// 1. X-Forwarded-For (first IP if multiple)
// 2. CF-Connecting-IP (Cloudflare)
// 3. X-Real-IP
// 4. Falls back to 'unknown'
```

### User-Based

Uses authenticated user ID from JWT context:

```typescript
keyGenerator: 'user'

// Uses user.sub from JWT context
// Falls back to 'anonymous' for unauthenticated requests
```

### Composite Keys

Create path-specific rate limits:

```typescript
keyGenerator: (c) => getCompositeKey(c, 'ip')

// Generates keys like:
// - ip:192.168.1.1:/api/auth/login
// - user:123:/api/quiz/submit
```

### Custom Key Generators

Implement your own key generation logic:

```typescript
keyGenerator: (c) => {
  const apiKey = c.req.header('x-api-key');
  const tier = getTierFromApiKey(apiKey);
  return `tier:${tier}:${apiKey}`;
}
```

## Response Headers

All responses include draft-7 standard headers:

```http
RateLimit-Limit: 100
RateLimit-Remaining: 42
RateLimit-Reset: 1699564320
```

On rate limit exceeded (429):

```http
Retry-After: 23
```

## Error Responses

When rate limit is exceeded:

```json
{
  "error": {
    "message": "Too many requests",
    "code": "RATE_LIMIT"
  }
}
```

## Advanced Usage

### Different Limits for Different Routes

```typescript
// Strict limit for auth endpoints
app.use('/api/auth/*', rateLimiter({
  store: new InMemoryStore({ windowMs: 300000, limit: 5 }),
  windowMs: 300000,  // 5 minutes
  limit: 5,          // 5 attempts
  keyGenerator: 'ip',
}));

// More lenient for general API
app.use('/api/*', rateLimiter({
  store: new InMemoryStore({ windowMs: 60000, limit: 100 }),
  windowMs: 60000,
  limit: 100,
  keyGenerator: 'user',
}));
```

### Tiered Rate Limiting

```typescript
// Custom key generator for tier-based limiting
const tierKeyGenerator = (c: Context) => {
  const user = c.get('user');
  const tier = user?.tier || 'free';
  return `${tier}:${user?.sub || getIpKey(c)}`;
};

// Different stores for different tiers
const freeStore = new InMemoryStore({ windowMs: 60000, limit: 10 });
const proStore = new InMemoryStore({ windowMs: 60000, limit: 100 });
const enterpriseStore = new InMemoryStore({ windowMs: 60000, limit: 1000 });

// Apply based on user tier
app.use('/api/*', async (c, next) => {
  const user = c.get('user');
  const tier = user?.tier || 'free';
  
  const store = tier === 'enterprise' ? enterpriseStore :
                tier === 'pro' ? proStore : freeStore;
  
  return rateLimiter({
    store,
    windowMs: 60000,
    limit: store.options.limit,
    keyGenerator: tierKeyGenerator,
  })(c, next);
});
```

## Migration Guide

### Future Redis Store

The architecture is designed for easy migration to Redis:

```typescript
// Future Redis implementation
class RedisStore implements RateLimiterStore {
  constructor(private redis: Redis, private options: RedisStoreOptions) {}
  
  async consume(key: string): Promise<ConsumeResult> {
    // Use Lua script for atomic operations
    const result = await this.redis.eval(
      RATE_LIMIT_LUA_SCRIPT,
      1,
      key,
      this.options.limit,
      this.options.windowMs,
      Date.now()
    );
    
    return parseRedisResult(result);
  }
}

// Migration is just changing the store
app.use('/api/*', rateLimiter({
  store: new RedisStore(redis, { windowMs: 60000, limit: 100 }),
  windowMs: 60000,
  limit: 100,
  keyGenerator: 'ip',
}));
```

### Future Cloudflare Rate Limiting

For Cloudflare Workers:

```typescript
// Future Cloudflare implementation
class CloudflareStore implements RateLimiterStore {
  constructor(private binding: RateLimit) {}
  
  async consume(key: string): Promise<ConsumeResult> {
    const { success, remaining, resetTime } = await this.binding.limit({ key });
    
    return {
      success,
      remaining,
      resetTime: resetTime * 1000, // Convert to ms
      retryAfter: success ? undefined : Math.ceil((resetTime * 1000 - Date.now()) / 1000),
    };
  }
}
```

## Performance Considerations

### Memory Management

The InMemoryStore automatically manages memory to prevent leaks:

```typescript
// Automatic cleanup every 10 minutes (configurable)
const store = new InMemoryStore({
  windowMs: 60000,
  limit: 100,
  cleanupIntervalMs: 5 * 60 * 1000, // Optional: 5 minutes
});

// Graceful shutdown (important for production)
process.on('SIGTERM', () => {
  store.destroy(); // Stops cleanup timer
  process.exit(0);
});
```

**Memory Characteristics**:
- Entries expire after 2x the window duration
- Automatic cleanup runs every 10 minutes by default
- ~1MB memory usage for 10,000 active keys (1-minute window)
- Cleanup happens in background, doesn't block requests

### Request Overhead

- Token bucket calculation: <0.1ms
- Header setting: <0.1ms
- Total overhead: <1ms per request

### Scaling Considerations

For horizontal scaling:
1. Use Redis store (future implementation)
2. Or use sticky sessions with InMemoryStore
3. Or use Cloudflare's edge rate limiting

## Testing

Run the comprehensive test suite:

```bash
# Run all rate limiting tests
bun test rate-limit

# Run with coverage
bun test --coverage rate-limit
```

## Best Practices

1. **Choose Appropriate Windows**: 
   - Auth endpoints: 5-15 minutes
   - General API: 1 minute
   - Heavy operations: 1 hour

2. **Set Reasonable Limits**:
   - Consider your server capacity
   - Allow for burst traffic
   - Different limits for different operations

3. **Monitor and Adjust**:
   - Log rate limit hits
   - Monitor 429 responses
   - Adjust limits based on usage patterns

4. **Consider User Experience**:
   - Provide clear error messages
   - Include retry-after information
   - Consider grace periods for authenticated users

## Troubleshooting

### Common Issues

1. **All requests blocked**: Check if limit is too low or window too long
2. **Headers not showing**: Ensure middleware is applied before routes
3. **IP detection failing**: Check proxy/CDN configuration
4. **Memory growing**: 
   - Verify automatic cleanup is enabled (default: every 10 minutes)
   - Call `store.destroy()` on application shutdown
   - Consider shorter `cleanupIntervalMs` for high-traffic applications
   - Monitor memory usage in production

### Debug Logging

Enable debug logging:

```typescript
const logger = c.get('logger');
logger.debug('Rate limit consumed', { key, remaining, success });
```

## Future Enhancements

- [ ] Redis store implementation
- [ ] Cloudflare store implementation
- [ ] Sliding window algorithm option
- [ ] Distributed rate limiting
- [ ] Rate limit metrics/monitoring
- [ ] Dynamic rate limit adjustment
- [ ] Webhook for rate limit events

## License

Part of the CertQuiz API project.