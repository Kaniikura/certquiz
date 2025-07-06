# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) for the CertQuiz project.

## What is an ADR?

An Architecture Decision Record (ADR) is a document that captures an important architectural decision made along with its context and consequences.

## ADR Index

### Active
- [ADR-0001](./0001-record-architecture-decisions.md) - Record architecture decisions
- [ADR-0006](./0006-api-versioning-strategy.md) - Use URL-Based API Versioning
- [ADR-0007](./0007-soft-deletes-strategy.md) - Use Soft Deletes Instead of Hard Deletes
- [ADR-0008](./0008-limit-jsonb-usage.md) - Limit JSONB Usage to Truly Dynamic Data
- [ADR-0009](./0009-vertical-slice-architecture.md) - Adopt Vertical Slice Architecture with DDD

### Superseded
- [ADR-0002](./0002-service-layer-architecture.md) - ~~Use Service Layer Architecture~~ (Superseded by ADR-0009)
- [ADR-0003](./0003-repository-pattern.md) - ~~Use Repository Pattern for Data Access~~ (Superseded by ADR-0009)
- [ADR-0004](./0004-event-driven-architecture.md) - ~~Implement Event-Driven Architecture~~ (Superseded by ADR-0009)

### Deprecated
- [ADR-0005](./0005-redis-caching-strategy.md) - ~~Use Redis for Multi-Level Caching~~ (Removed in favor of Neon)

## ADR Template

When creating a new ADR, use this template:

```markdown
# [number]. [title]

Date: YYYY-MM-DD

## Status

[Proposed | Accepted | Deprecated | Superseded by ADR-XXXX]

## Context

[Describe the context and problem statement]

## Decision

[Describe the decision and how it addresses the problem]

## Consequences

**Positive:**
- [Positive consequence 1]
- [Positive consequence 2]

**Negative:**
- [Negative consequence 1]
- [Negative consequence 2]

**Neutral:**
- [Neutral consequence 1]
- [Neutral consequence 2]
```

## Creating a New ADR

1. Copy the template above
2. Create a new file with the next number in sequence: `XXXX-descriptive-name.md`
3. Fill in all sections
4. Update this README with a link to the new ADR
5. Commit with message: `docs(adr): add ADR-XXXX for [topic]`

## References

- [Documenting Architecture Decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions) - Michael Nygard
- [ADR GitHub Organization](https://adr.github.io/)
- [ADR Tools](https://github.com/npryce/adr-tools)