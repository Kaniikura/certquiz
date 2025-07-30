# CertQuiz Documentation

## Project Documentation Structure

### Core Documentation
- [Business Requirements Document](./business-requirements-document.md) - Comprehensive business context and requirements
- [Task List](./task-list.md) - Current implementation tasks and progress
- [Project Structure](./project-structure.md) - VSA + Repository Pattern architecture
- [API Specification](./api-specification.md) - RESTful API endpoints
- [Coding Standards](./coding-standards.md) - Development conventions with DDD
- [Database Schema](./database-schema-v2.md) - PostgreSQL schema with Drizzle ORM
- [GitHub Actions Strategy](./github-actions-strategy.md) - CI/CD implementation plan

### Architecture Decision Records (ADRs)
- [ADR Directory](./adr/) - Architecture decisions and rationale

#### Key Architectural Decisions
1. **Vertical Slice Architecture (VSA)** - Features organized by use case, not technical layers
2. **Domain-Driven Design (DDD)** - Rich domain models with business logic encapsulation
3. **Repository Pattern** - Domain interfaces with infrastructure implementations
4. **Unit of Work Pattern** - Transaction boundaries via Drizzle's transaction wrapper
5. **Result Type Pattern** - Explicit error handling without exceptions
6. **API Versioning** - URL-based versioning strategy (/api/v1)
7. **Soft Deletes** - Data integrity and audit trail maintenance
8. **Limited JSONB Usage** - Normalized tables for structured data

### Completed Tasks
- [01 - Core Setup Tasks](./completed/01-core-setup-tasks.md) - Initial project setup details

### Planning
- [Planning Directory](./planning/) - Task planning and backlog management

## Quick Links

- **Current Focus**: [Task List](./task-list.md) - Section 3: VSA + Repository Pattern Migration
- **API Design**: [API Specification](./api-specification.md)
- **Domain Modeling**: [Coding Standards](./coding-standards.md#domain-driven-design-standards)