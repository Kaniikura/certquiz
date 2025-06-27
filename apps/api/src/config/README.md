# Configuration

This directory contains configuration modules for the API application, including environment variables and Redis configuration.

## Usage

```typescript
// Import the env proxy object
import { env } from '@/config';

// Access environment variables with full type safety
console.log(env.DATABASE_URL);
console.log(env.API_PORT); // number type
console.log(env.isDevelopment); // boolean helper

// Or import specific functions
import { loadEnv, validateEnv } from '@/config';

// Validate environment on startup
const config = loadEnv(); // Throws if invalid
```

## Environment Variables

Required variables (see `.env.example`):
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `KEYCLOAK_URL` - KeyCloak server URL
- `KEYCLOAK_REALM` - KeyCloak realm name
- `JWT_SECRET` - Secret for JWT signing (min 16 chars)
- `BMAC_WEBHOOK_SECRET` - Buy Me a Coffee webhook secret

Optional variables:
- `API_PORT` - API server port (default: 4000)
- `NODE_ENV` - Environment (default: development)
- `FRONTEND_URL` - Frontend URL (default: http://localhost:5173)

## Type Safety

All environment variables are validated using Zod schemas and provide full TypeScript support:

```typescript
// TypeScript knows these types
env.API_PORT // number
env.NODE_ENV // 'development' | 'production' | 'test'
env.isDevelopment // boolean
```

## Testing

The configuration is tested with:
- Unit tests for validation logic
- Integration tests for actual environment loading

Run tests: `bun test src/config/`

## Redis Configuration

The Redis configuration module (`redis.ts`) provides connection management with automatic retry and health check support.

### Usage

```typescript
import { getRedisClient } from './redis';

const redis = getRedisClient();
await redis.set('key', 'value');
const value = await redis.get('key');
```

### Environment Variables

```env
REDIS_URL=redis://localhost:6379  # or individual REDIS_HOST, REDIS_PORT, REDIS_PASSWORD
```

### Features

- Exponential backoff retry strategy
- Health check integration
- TypeScript support with ioredis
- Singleton pattern for connection reuse

### Testing

```bash
bun test src/config/redis.test.ts          # Unit tests
bun test src/integration/redis-connection.test.ts  # Integration tests
```

For more details, see the inline documentation in `redis.ts`.