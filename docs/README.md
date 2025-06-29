# CertQuiz Documentation

## Project Documentation Structure

### Core Documentation
- [Task List](./task-list.md) - Current implementation tasks and progress
- [Project Structure](./project-structure.md) - Phase 1 architecture overview
- [Database Schema](./database-schema.md) - Drizzle ORM schema definitions
- [API Specification](./api-specification.md) - RESTful API endpoints
- [Coding Standards](./coding-standards.md) - Development conventions
- [GitHub Actions Strategy](./github-actions-strategy.md) - CI/CD implementation plan

### Architecture Decision Records (ADRs)
- [ADR Directory](./adr/) - Architecture decisions and rationale

#### Key Architectural Decisions
1. **Service Layer Architecture** - Separation of business logic from HTTP concerns
2. **Repository Pattern** - Data access abstraction  
3. **Event-Driven Architecture** - Decoupled communication via events
4. **Redis Caching** - Multi-level caching strategy
5. **API Versioning** - URL-based versioning strategy
6. **Soft Deletes** - Data integrity and audit trail maintenance
7. **Limited JSONB Usage** - Normalized tables for structured data

### Completed Tasks
- [01 - Core Setup Tasks](./completed/01-core-setup-tasks.md) - Initial project setup details

### Design Documents
- [Phase 2 Clean Architecture](./designs/phase-2-clean-architecture.md) - Future architecture vision

### Planning
- [Planning Directory](./planning/) - Task planning and backlog management

## Quick Links

- **Current Focus**: [Task List](./task-list.md) - Section 2: Shared Utilities Setup
- **Database Design**: [Database Schema](./database-schema.md)
- **API Design**: [API Specification](./api-specification.md)