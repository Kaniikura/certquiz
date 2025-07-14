# CertQuiz

Technical certification exam preparation web app supporting CCNA, CCNP, and other certifications.

## Architecture

- **Frontend**: SvelteKit + TypeScript + TailwindCSS
- **Backend**: Bun + Hono + Drizzle ORM
- **Database**: Neon PostgreSQL (serverless)
- **Auth**: KeyCloak
- **Patterns**: VSA + DDD + Repository Pattern

## Core Principles

- **TDD Mandatory** - Write tests first, 80% coverage minimum
- **Schema-Driven** - TypeSpec → API, Drizzle → Database
- **Type Safety** - No `any`, explicit return types
- **Vertical Slices** - Features contain all layers

→ See [.claude/instructions.md](.claude/instructions.md) for detailed development rules

## Quick Start

```bash
# Setup environment
bun install
bun run docker:up
bun run db:migrate
```

## Common Commands

| Command | Description |
|---------|-------------|
| `bun run dev` | Start all services |
| `bun run test` | Run tests |
| `bun run test --watch` | TDD mode |
| `bun run check` | Format + lint + typecheck |
| `bun run db:migrate` | Run migrations |
| `bun run typespec:compile` | Generate API types |

## Key Documentation

- [Task Progress](docs/task-list.md) - Current implementation status
- [Architecture](docs/adr/) - Architecture Decision Records
- [Project Structure](docs/project-structure.md) - VSA organization  
- [Database Schema](docs/database-schema-v2.md) - Drizzle schemas
- [Coding Standards](docs/coding-standards.md) - Conventions

## Environment Setup

Copy `.env.example` to `.env` and configure:
- `DATABASE_URL` - PostgreSQL connection
- `KEYCLOAK_URL` - Auth server
- `JWT_SECRET` - Token signing key

See [Setup Guide](docs/project-setup.md) for details.

## License

[License type] - See LICENSE file