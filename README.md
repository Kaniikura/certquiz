# CertQuiz

A modern web application for technical certification exam preparation, built with TypeScript and emphasizing test-driven development. Supports various technical certifications including networking, security, and cloud computing exams.

## 🚀 Quick Start

```bash
# Prerequisites: Bun 1.0+, Docker, Git

# Clone and install
git clone <repository-url>
cd certquiz
bun install

# Start services
bun run docker:up      # PostgreSQL + KeyCloak
bun run db:migrate     # Run migrations
bun run dev           # Start dev servers
```

API: http://localhost:4000/swagger  
KeyCloak: http://localhost:8080

## 🛠️ Tech Stack

- **Runtime**: [Bun](https://bun.sh) - Fast all-in-one JavaScript runtime
- **Backend**: [Hono](https://hono.dev) + [Drizzle ORM](https://orm.drizzle.team)
- **Database**: PostgreSQL 16
- **Auth**: KeyCloak
- **Testing**: Vitest

## 📁 Project Structure

```
cert-quiz/
├── apps/
│   └── api/          # Hono backend API (VSA + DDD + Repository Pattern)
├── packages/
│   └── shared/       # Essential constants & utilities (QUIZ_SIZES, CONFIG)
├── docker/           # Docker configurations
└── docs/            # Documentation
```

**Import Pattern**: Direct imports only, no barrel exports
```typescript
// ✅ Direct imports
import { QUIZ_SIZES } from '@certquiz/shared/constants';
import { Email } from '@api/features/auth/domain/value-objects/Email';

// ❌ Barrel imports (removed)
import { Email } from '@api/features/auth';
```

## 🧪 Development Principles

### Test-Driven Development (TDD)
**Mandatory** - Write tests first, then code:
```bash
bun run test --watch      # Run tests in watch mode
bun run test --coverage   # Check coverage (min 80%)
```

### Schema-Driven Development
Database schemas drive development:
```bash
bun run db:generate       # Generate migrations from schema changes
```

## 📚 Documentation

- [Task List](docs/task-list.md) - Current development tasks
- [API Specification](docs/api-specification.md) - Endpoint docs
- [Database Schema](docs/database-schema-v2.md) - Data models
- [Coding Standards](docs/coding-standards.md) - Code conventions
- [Commit Convention](.claude/commit-convention.md) - Git commit guidelines
- [GitHub Actions Strategy](docs/github-actions-strategy.md) - CI/CD pipeline design

## 🔧 Common Commands

```bash
# Development
bun run dev              # Start all services
bun run check            # All quality checks (TypeScript + Biome + knip) with auto-fix
bun run ci               # All quality checks (TypeScript + Biome + knip) without auto-fix
bun run typecheck        # TypeScript checking only
bun run lint            # Biome linter
bun run format          # Biome formatter

# Database
bun run db:generate      # Generate migrations
bun run db:migrate       # Apply migrations
bun run db:studio        # Drizzle Studio GUI
bun run db:test:migration # Test migrations locally (CI-like)

# Testing
bun run test                # Run all tests
bun run test:unit           # Unit tests only
bun run test:integration    # Integration tests

# Docker
bun run docker:up        # Start services
bun run docker:down      # Stop services

# Code Quality
bun run knip             # Check for unused exports
bun run knip:fix         # Auto-fix some unused exports
```

## 🏗️ Architecture

- **Vertical Slice Architecture**: Features organized by use case, not layers
- **Domain-Driven Design**: Rich domain models with business logic
- **Repository Pattern**: Clean separation between domain and data access
- **Type Safety**: Comprehensive TypeScript coverage with explicit types
- **Performance**: Quiz response time < 200ms target

## 📝 License

[License type] - See LICENSE file for details

---

Built with ❤️ using modern TypeScript tooling