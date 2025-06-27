# Project Setup Guide

## Prerequisites

- Bun 1.0+ ([install](https://bun.sh))
- Docker & Docker Compose
- Git
- Node.js 18+ (for some tooling compatibility)

## Quick Start

```bash
# Clone and setup
git clone <repository-url>
cd cert-quiz
bun install
bun run setup

# Start development
bun run dev
```

## Detailed Setup Steps

### 1. Environment Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your values
# Required variables:
DATABASE_URL=postgresql://postgres:password@localhost:5432/certquiz
KEYCLOAK_REALM=certquiz
JWT_SECRET=generate-a-secure-random-string
BMAC_WEBHOOK_SECRET=from-buy-me-a-coffee-dashboard
```

### 2. Project Structure Creation

```bash
# Create monorepo structure
mkdir -p apps/{api,web} packages/{shared,typespec}
mkdir -p docker/{postgres,keycloak} k8s/{base,overlays}
mkdir -p .claude docs scripts tests

# Initialize workspaces
cat > package.json << 'EOF'
{
  "name": "cert-quiz",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "concurrently \"bun run dev:api\" \"bun run dev:web\"",
    "dev:api": "cd apps/api && bun run dev",
    "dev:web": "cd apps/web && bun run dev",
    "build": "bun run build:shared && bun run build:api && bun run build:web",
    "build:shared": "cd packages/shared && bun run build",
    "build:api": "cd apps/api && bun run build",
    "build:web": "cd apps/web && bun run build",
    "test": "bun run test:unit && bun run test:integration",
    "test:unit": "vitest run",
    "test:integration": "vitest run --config vitest.integration.config.ts",
    "db:generate": "cd apps/api && drizzle-kit generate:pg",
    "db:migrate": "cd apps/api && bun run src/db/migrate.ts",
    "db:studio": "cd apps/api && drizzle-kit studio",
    "docker:up": "docker-compose -f docker/docker-compose.yml up -d",
    "docker:down": "docker-compose -f docker/docker-compose.yml down",
    "docker:logs": "docker-compose -f docker/docker-compose.yml logs -f",
    "setup": "./scripts/setup.sh",
    "typecheck": "tsc --noEmit",
    "lint": "eslint . --ext .ts,.tsx,.svelte",
    "format": "prettier --write ."
  },
  "devDependencies": {
    "@types/bun": "latest",
    "concurrently": "^8.2.0",
    "typescript": "^5.3.0",
    "vitest": "^1.0.0",
    "prettier": "^3.1.0",
    "eslint": "^8.55.0"
  }
}
EOF
```

### 3. Shared Package Setup

```bash
cd packages/shared

cat > package.json << 'EOF'
{
  "name": "@certquiz/shared",
  "version": "1.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": ["dist"],
  "scripts": {
    "build": "bun build src/index.ts --outdir dist --target node",
    "dev": "bun build src/index.ts --outdir dist --watch"
  },
  "exports": {
    ".": "./dist/index.js",
    "./types": "./dist/types/index.js",
    "./constants": "./dist/constants/index.js",
    "./utils": "./dist/utils/index.js"
  }
}
EOF

# Create shared types
mkdir -p src/{types,constants,utils}

cat > src/types/index.ts << 'EOF'
export interface User {
  id: string;
  email: string;
  username: string;
  role: 'guest' | 'user' | 'premium' | 'admin';
  createdAt: Date;
}

export interface Question {
  id: string;
  examType: 'CCNP' | 'CCIE';
  category: string;
  tags: string[];
  questionText: string;
  type: 'single' | 'multiple';
  options: QuestionOption[];
  explanation: string;
  detailedExplanation?: string;
  images?: string[];
  createdBy: string;
  createdByName?: string;
  isUserGenerated: boolean;
  status: 'active' | 'pending' | 'archived';
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuestionOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface QuizSession {
  id: string;
  userId: string;
  questions: string[];
  currentIndex: number;
  answers: Record<string, string[]>;
  startedAt: Date;
  completedAt?: Date;
  score?: number;
}
EOF

cat > src/index.ts << 'EOF'
export * from './types';
export * from './constants';
export * from './utils';
EOF

cd ../..
```

### 4. API Server Setup

```bash
cd apps/api

cat > package.json << 'EOF'
{
  "name": "@certquiz/api",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "bun --watch src/index.ts",
    "build": "bun build src/index.ts --target bun --outdir dist",
    "start": "bun dist/index.js",
    "test": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "hono": "^4.7.0",
    "@hono/zod-validator": "^0.6.0",
    "drizzle-orm": "^0.29.0",
    "postgres": "^3.4.0",
    "zod": "^3.22.0",
    "@certquiz/shared": "workspace:*"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "drizzle-kit": "^0.20.0",
    "vitest": "^1.0.0"
  }
}
EOF

# Create folder structure
mkdir -p src/{routes,services,db,middleware,utils}

# Create entry point
cat > src/index.ts << 'EOF'
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serve } from '@hono/node-server';
import type { AppEnv } from './types/app';
import { healthRoutes } from './routes/health';
import { env } from './config';
import { getRedisClient } from './config/redis';

const app = new Hono<AppEnv>();

// Initialize Redis client
const redis = getRedisClient();

// Global middleware
app.use('*', logger());
app.use('*', cors({
  origin: env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

// Inject Redis client into context
app.use('*', async (c, next) => {
  c.set('redis', redis);
  await next();
});

// Mount routes
app.route('/health', healthRoutes);

// 404 handler
app.notFound((c) => {
  return c.json({ 
    success: false, 
    error: { 
      code: 'NOT_FOUND', 
      message: 'Route not found' 
    } 
  }, 404);
});

// Start server when run directly
if (import.meta.main) {
  const port = env.API_PORT || 4000;
  console.log(`🔥 Server starting on port ${port}`);

  serve({
    fetch: app.fetch,
    port,
  });
}

export default app;
EOF

# Create Drizzle config
cat > drizzle.config.ts << 'EOF'
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.DATABASE_URL!
  }
} satisfies Config;
EOF

cd ../..
```

### 5. Frontend Setup

```bash
cd apps/web

# Initialize SvelteKit
bunx create-svelte@latest . --template=skeleton-ts --no-install

cat > package.json << 'EOF'
{
  "name": "@certquiz/web",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest",
    "check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json"
  },
  "devDependencies": {
    "@sveltejs/adapter-node": "^2.0.0",
    "@sveltejs/kit": "^2.0.0",
    "@sveltejs/vite-plugin-svelte": "^3.0.0",
    "svelte": "^4.2.0",
    "svelte-check": "^3.6.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0",
    "vitest": "^1.0.0",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0"
  },
  "dependencies": {
    "@certquiz/shared": "workspace:*",
    "bits-ui": "^0.17.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.0",
    "tailwind-variants": "^0.2.0"
  }
}
EOF

# Setup TailwindCSS
bunx tailwindcss init -p

cat > tailwind.config.js << 'EOF'
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {},
  },
  plugins: [],
}
EOF

cd ../..
```

### 6. Docker Configuration

```bash
cat > docker/docker-compose.yml << 'EOF'
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
      POSTGRES_DB: certquiz
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./postgres/init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  keycloak:
    image: quay.io/keycloak/keycloak:23.0
    environment:
      KEYCLOAK_ADMIN: admin
      KEYCLOAK_ADMIN_PASSWORD: admin
      KC_DB: postgres
      KC_DB_URL: jdbc:postgresql://postgres:5432/keycloak
      KC_DB_USERNAME: postgres
      KC_DB_PASSWORD: password
    ports:
      - "8080:8080"
    depends_on:
      postgres:
        condition: service_healthy
    command: start-dev

volumes:
  postgres_data:
EOF

cat > docker/postgres/init.sql << 'EOF'
-- Create KeyCloak database
CREATE DATABASE keycloak;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create initial schema will be handled by Drizzle migrations
EOF
```

### 7. Setup Script

```bash
cat > scripts/setup.sh << 'EOF'
#!/bin/bash
set -e

echo "🚀 Starting CertQuiz setup..."

# Check prerequisites
command -v bun >/dev/null 2>&1 || { echo "❌ Bun is required but not installed."; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "❌ Docker is required but not installed."; exit 1; }

# Install dependencies
echo "📦 Installing dependencies..."
bun install

# Start Docker services
echo "🐳 Starting Docker services..."
bun run docker:up

# Wait for PostgreSQL
echo "⏳ Waiting for PostgreSQL..."
until docker exec $(docker ps -qf "name=postgres") pg_isready -U postgres; do
  sleep 1
done

# Run migrations
echo "🗄️ Running database migrations..."
bun run db:migrate

# Setup KeyCloak
echo "🔐 Configuring KeyCloak..."
# Add KeyCloak realm import here

echo "✅ Setup complete!"
echo ""
echo "🌐 Services:"
echo "   Frontend: http://localhost:5173"
echo "   API: http://localhost:4000"
echo "   API Docs: http://localhost:4000/swagger"
echo "   KeyCloak: http://localhost:8080"
echo ""
echo "📝 Next steps:"
echo "   bun run dev    # Start development servers"
echo "   bun test       # Run tests"
EOF

chmod +x scripts/setup.sh
```

### 8. TypeScript Configuration

```bash
# Root tsconfig
cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "paths": {
      "@certquiz/shared": ["./packages/shared/src"],
      "@certquiz/shared/*": ["./packages/shared/src/*"]
    }
  },
  "include": ["apps/*/src/**/*", "packages/*/src/**/*"],
  "exclude": ["node_modules", "**/dist"]
}
EOF
```

## Verification Steps

1. **Check installations**:
   ```bash
   bun --version  # Should be 1.0+
   docker --version
   ```

2. **Verify services**:
   ```bash
   docker ps  # Should show postgres and keycloak
   curl http://localhost:4000/swagger  # API docs
   curl http://localhost:8080  # KeyCloak
   ```

3. **Test database connection**:
   ```bash
   bun run db:studio  # Opens Drizzle Studio
   ```

## Troubleshooting

### Common Issues

1. **Port already in use**:
   ```bash
   # Find process using port
   lsof -i :5432  # PostgreSQL
   lsof -i :4000  # API
   lsof -i :5173  # Frontend
   ```

2. **Docker permission denied**:
   ```bash
   sudo usermod -aG docker $USER
   # Log out and back in
   ```

3. **Database connection failed**:
   - Check Docker is running: `docker ps`
   - Check logs: `docker logs <container-name>`
   - Verify .env file has correct DATABASE_URL

4. **Bun installation issues**:
   ```bash
   # Alternative installation
   curl -fsSL https://bun.sh/install | bash
   source ~/.bashrc  # or ~/.zshrc
   ```

## Next Steps

1. Run `bun run dev` to start development
2. Visit http://localhost:5173 for the frontend
3. Visit http://localhost:4000/swagger for API documentation
4. Begin implementing features according to TASK_LIST.md