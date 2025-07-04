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

Frontend: http://localhost:5173  
API: http://localhost:4000/swagger  
KeyCloak: http://localhost:8080

## 🛠️ Tech Stack

- **Runtime**: [Bun](https://bun.sh) - Fast all-in-one JavaScript runtime
- **Frontend**: [SvelteKit](https://kit.svelte.dev) + TypeScript + TailwindCSS
- **Backend**: [Hono](https://hono.dev) + [Drizzle ORM](https://orm.drizzle.team)
- **Database**: PostgreSQL 16
- **Auth**: KeyCloak
- **Testing**: Vitest
- **API Spec**: TypeSpec → OpenAPI

## 📁 Project Structure

```
cert-quiz/
├── apps/
│   ├── web/          # SvelteKit frontend
│   └── api/          # Hono backend API
├── packages/
│   ├── shared/       # Shared types & utilities
│   └── typespec/     # API specifications
├── docker/           # Docker configurations
├── k8s/             # Kubernetes manifests
└── docs/            # Documentation
```

## 🧪 Development Principles

### Test-Driven Development (TDD)
**Mandatory** - Write tests first, then code:
```bash
bun run test --watch      # Run tests in watch mode
bun run test --coverage   # Check coverage (min 80%)
```

### Schema-First API Development
Define schemas → Generate types → Implement:
```bash
bun run typespec:compile   # Generate from TypeSpec
bun run db:generate       # Generate migrations
```

## 📚 Documentation

- [Task List](docs/task-list.md) - Current development tasks
- [API Specification](docs/api-specification.md) - Endpoint docs
- [Database Schema](docs/database-schema.md) - Data models
- [Coding Standards](docs/coding-standards.md) - Code conventions
- [Commit Convention](.claude/commit-convention.md) - Git commit guidelines
- [GitHub Actions Strategy](docs/github-actions-strategy.md) - CI/CD pipeline design

## 🔧 Common Commands

```bash
# Development
bun run dev              # Start all services
bun run typecheck        # TypeScript checking
bun run lint            # Biome linter
bun run format          # Biome formatter

# Database
bun run db:generate      # Generate migrations
bun run db:migrate       # Apply migrations
bun run db:studio        # Drizzle Studio GUI

# Testing
bun run test                # Run all tests
bun run test:unit           # Unit tests only
bun run test:integration    # Integration tests

# Docker
bun run docker:up        # Start services
bun run docker:down      # Stop services
```

## 🏗️ Architecture

- **Monorepo**: Shared types between frontend/backend
- **Type Safety**: End-to-end type safety with TypeScript
- **Schema-Driven**: Database and API schemas drive development
- **Performance**: Quiz response time < 200ms target

## 📝 License

[License type] - See LICENSE file for details

---

Built with ❤️ using modern TypeScript tooling