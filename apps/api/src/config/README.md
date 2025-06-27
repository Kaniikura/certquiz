# Environment Configuration

This module provides type-safe environment variable configuration for the API server.

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