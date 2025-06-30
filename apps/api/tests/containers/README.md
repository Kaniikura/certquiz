# Testcontainers Setup

This directory contains the testcontainers configuration for integration and E2E tests.

## Overview

We use [Testcontainers](https://testcontainers.com/) to provide real PostgreSQL and Redis instances for integration tests. This ensures tests run in an environment that closely matches production while maintaining isolation and repeatability.

## How It Works

1. **Automatic Container Management**: When you run integration tests, testcontainers automatically:
   - Starts PostgreSQL and Redis containers if needed
   - Reuses existing containers for faster test runs
   - Sets the correct environment variables (`DATABASE_URL`, `REDIS_URL`)

2. **Test Isolation**: Each test suite gets a clean database state:
   - PostgreSQL is reset using `resetToCleanState()` 
   - Redis can be flushed using `flushAll()`

3. **Performance Optimization**:
   - Containers are reused between test runs (`.withReuse()`)
   - First run: ~5-7 seconds (pulling images)
   - Subsequent runs: <1 second

## Usage

### Running Tests

```bash
# Run unit tests only (no containers)
bun run test:unit

# Run integration tests (starts containers automatically)
bun run test:integration

# Run all tests
bun run test
```

### In Test Files

```typescript
import { PostgresSingleton } from '../containers';

describe('Database Test', () => {
  beforeAll(async () => {
    // Reset database to clean state
    await PostgresSingleton.resetToCleanState();
    
    // Run migrations if needed
    const connectionUrl = await PostgresSingleton.getConnectionUrl();
    // ... run Drizzle migrations
  });

  it('should query database', async () => {
    // Your test code - DATABASE_URL is already set
    const result = await db.query.users.findMany();
    expect(result).toHaveLength(0);
  });
});
```

## Architecture

### Container Singletons

- `postgres.ts`: PostgreSQL container management
- `redis.ts`: Redis container management
- `index.ts`: Global setup/teardown for Vitest

### Configuration

The containers are configured in the root `vitest.config.ts`:
- Unit tests: `TEST_TYPE=unit`, uses memory cache
- Integration tests: `TEST_TYPE=integration`, uses real Redis
- E2E tests: `TEST_TYPE=e2e`, uses real Redis

## CI/CD

In GitHub Actions, testcontainers work automatically without any special configuration:
- No need for service containers in the workflow
- Docker is pre-installed on GitHub runners
- Containers start and stop automatically

## Troubleshooting

### Container not starting

```bash
# Check if Docker is running
docker ps

# Check container logs
docker logs $(docker ps -a | grep postgres | awk '{print $1}')
```

### Port conflicts

Testcontainers automatically assigns random ports to avoid conflicts. The connection URLs are dynamically generated.

### Slow first run

The first test run pulls Docker images. This is normal and subsequent runs will be much faster.

### Clean up containers

```bash
# Stop all testcontainers
docker stop $(docker ps -q --filter label=org.testcontainers)

# Remove all testcontainers
docker rm $(docker ps -aq --filter label=org.testcontainers)
```

## Benefits

1. **Real Database Testing**: Tests run against actual PostgreSQL, not mocks
2. **Isolation**: Each test suite gets a clean database
3. **Portability**: Works identically on local machines and CI
4. **No Manual Setup**: No need to create test databases manually
5. **Fast Feedback**: Container reuse makes tests quick

## Future Improvements

- Add KeyCloak container for auth integration tests
- Implement database snapshots for complex test scenarios
- Add performance benchmarks
- Consider using testcontainers cloud for faster CI builds