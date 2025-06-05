# Updated Project Structure for Claude Code

## Recommended Folder Structure

```
quiz-app/
├── CLAUDE.md                    # Project context at root (required by Claude Code)
├── README.md                    # Public project documentation
├── .env.example                 # Environment template
├── .gitignore
├── package.json                 # Root monorepo config
├── bun.lockb
├── tsconfig.json               # Root TypeScript config
│
├── apps/                       # Application packages
│   ├── web/                    # SvelteKit frontend
│   │   ├── src/
│   │   ├── static/
│   │   ├── package.json
│   │   └── svelte.config.js
│   │
│   └── api/                    # Elysia backend
│       ├── src/
│       │   ├── index.ts
│       │   ├── routes/
│       │   ├── services/
│       │   ├── db/
│       │   │   ├── schema.ts
│       │   │   └── migrations/
│       │   └── middleware/
│       ├── package.json
│       └── drizzle.config.ts
│
├── packages/                   # Shared packages
│   ├── shared/                 # Common types and utilities
│   │   ├── src/
│   │   │   ├── types/
│   │   │   ├── constants/
│   │   │   └── utils/
│   │   └── package.json
│   │
│   └── typespec/              # API specifications
│       ├── main.tsp
│       └── package.json
│
├── docs/                      # Detailed documentation
│   ├── project-setup.md       # Environment setup guide
│   ├── database-schema.md     # Complete schema documentation
│   ├── api-specification.md   # API endpoint details
│   ├── task-list.md          # Implementation tasks
│   └── coding-standards.md    # Development conventions
│
├── docker/                    # Container configurations
│   ├── docker-compose.yml
│   ├── postgres/
│   │   └── init.sql
│   └── keycloak/
│       └── realm-export.json
│
├── k8s/                       # Kubernetes manifests
│   ├── base/
│   │   ├── api-deployment.yaml
│   │   ├── web-deployment.yaml
│   │   ├── postgres-statefulset.yaml
│   │   └── ingress.yaml
│   └── overlays/
│       ├── development/
│       └── production/
│
├── scripts/                   # Utility scripts
│   ├── setup.sh              # Initial setup script
│   ├── generate-types.sh     # Type generation
│   └── backup-db.sh          # Database backup
│
├── tests/                     # E2E tests
│   ├── e2e/
│   └── fixtures/
│
├── .claude/                   # Claude Code specific files
│   └── instructions.md        # Instructions for Claude Code
│
└── .github/                   # GitHub Actions
    └── workflows/
        ├── ci.yml
        └── deploy.yml
```

## Key Points for Claude Code

### 1. CLAUDE.md Location
- **MUST** be at project root
- Contains project overview and links to other docs
- Claude Code reads this first for context

### 2. Documentation Organization
- All detailed docs in `/docs` folder
- CLAUDE.md references these with relative paths
- Each doc has a specific purpose

### 3. Source Code Structure
- Monorepo with Bun workspaces
- Clear separation between apps and shared packages
- Database schemas co-located with API

### 4. Configuration Files
- Root config files for monorepo setup
- App-specific configs in their directories
- Docker and K8s configs isolated

## File Creation Order

When Claude Code starts implementation:

1. **Read CLAUDE.md** - Get project context
2. **Follow PROJECT_SETUP.md** - Initialize structure
3. **Implement from TASK_LIST.md** - Work through tasks
4. **Reference other docs as needed** - Schema, API, Standards

## Benefits of This Structure

1. **Claude Code Optimized**: CLAUDE.md at root provides immediate context
2. **Clear Separation**: Docs, code, and configs are well organized
3. **Monorepo Benefits**: Shared types and easy cross-package imports
4. **Scalable**: Easy to add new apps or packages
5. **CI/CD Ready**: Scripts and workflows pre-organized

## Example CLAUDE.md References

In CLAUDE.md, reference other files like:

```markdown
## Key Documentation

- **Setup Guide**: [docs/PROJECT_SETUP.md](docs/PROJECT_SETUP.md)
- **Database Schema**: [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md)
- **API Specification**: [docs/API_SPECIFICATION.md](docs/API_SPECIFICATION.md)
- **Task List**: [docs/TASK_LIST.md](docs/TASK_LIST.md)
- **Coding Standards**: [docs/CODING_STANDARDS.md](docs/CODING_STANDARDS.md)
```

This allows Claude Code to navigate to detailed documentation when needed while keeping the main CLAUDE.md concise.