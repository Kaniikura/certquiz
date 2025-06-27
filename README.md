# CertQuiz

A modern web application for technical certification exam preparation, built with TypeScript and emphasizing test-driven development. Supports various technical certifications including networking, security, and cloud computing exams.

## 🚀 Quick Start

```bash
# Prerequisites: Bun 1.0+, Docker, Git

# Clone and install
git clone <repository-url>
cd cert-quiz
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
- **Backend**: [Elysia](https://elysiajs.com) + [Drizzle ORM](https://orm.drizzle.team)
- **Database**: PostgreSQL 16
- **Auth**: KeyCloak
- **Testing**: Vitest
- **API Spec**: TypeSpec → OpenAPI

## 📁 Project Structure

```
cert-quiz/
├── apps/
│   ├── web/          # SvelteKit frontend
│   └── api/          # Elysia backend API
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
bun test --watch      # Run tests in watch mode
bun test --coverage   # Check coverage (min 80%)
```

### Schema-First API Development
Define schemas → Generate types → Implement:
```bash
bun run typespec:compile   # Generate from TypeSpec
bun run db:generate       # Generate migrations
```

## 📚 Documentation

- [Project Setup](docs/project-setup.md) - Detailed setup instructions
- [Coding Standards](docs/coding-standards.md) - Code conventions
- [Database Schema](docs/database-schema.md) - Data models
- [API Specification](docs/api-specification.md) - Endpoint docs
- [Task List](docs/task-list.md) - Current development tasks
- [Commit Convention](.claude/commit-convention.md) - Git commit guidelines

## 🔧 Common Commands

```bash
# Development
bun run dev              # Start all services
bun run typecheck        # TypeScript checking
bun run lint            # ESLint
bun run format          # Prettier

# Database
bun run db:generate      # Generate migrations
bun run db:migrate       # Apply migrations
bun run db:studio        # Drizzle Studio GUI

# Testing
bun test                # Run all tests
bun test:unit           # Unit tests only
bun test:integration    # Integration tests

# Docker
bun run docker:up        # Start services
bun run docker:down      # Stop services
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feat/amazing-feature`
3. Write tests first (TDD)
4. Implement feature
5. Commit using [conventional commits](.claude/commit-convention.md): `✨ feat(scope): add amazing feature`
6. Push and create PR

## 🏗️ Architecture

- **Monorepo**: Shared types between frontend/backend
- **Type Safety**: End-to-end type safety with TypeScript
- **Schema-Driven**: Database and API schemas drive development
- **Performance**: Quiz response time < 200ms target

## 🔐 Environment Variables

Create `.env` file:
```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/certquiz
KEYCLOAK_URL=http://localhost:8080
KEYCLOAK_REALM=certquiz
JWT_SECRET=<generate-secure-key>
BMAC_WEBHOOK_SECRET=<from-buy-me-a-coffee>
```

## 📝 License

[License type] - See LICENSE file for details

## 🆘 Troubleshooting

See [Project Setup Guide](docs/project-setup.md#troubleshooting) for common issues.

---

Built with ❤️ using modern TypeScript tooling