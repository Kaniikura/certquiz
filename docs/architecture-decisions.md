# Architecture Decisions

## Overview

Architecture decisions for CertQuiz are documented as Architecture Decision Records (ADRs) following industry best practices.

## 📁 ADR Location

All architecture decisions are maintained in the [`docs/adr/`](./adr/) directory as individual, numbered files.

## 📋 Current Decisions

See the [ADR Index](./adr/README.md) for a complete list of architecture decisions.

## Key Architectural Choices

The following major architectural decisions have been made:

1. **Service Layer Architecture** - Separation of business logic from HTTP concerns
2. **Repository Pattern** - Data access abstraction
3. **Event-Driven Architecture** - Decoupled communication via events
4. **Redis Caching** - Multi-level caching strategy
5. **API Versioning** - URL-based versioning strategy
6. **Soft Deletes** - Data integrity and audit trail maintenance
7. **Limited JSONB Usage** - Normalized tables for structured data

## Contributing

When making significant architectural changes:

1. Create a new ADR in `docs/adr/`
2. Follow the ADR template in the [ADR README](./adr/README.md)
3. Number it sequentially
4. Update the ADR index
5. Reference the ADR in pull requests