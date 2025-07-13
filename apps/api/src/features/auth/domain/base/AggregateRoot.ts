/**
 * Base class for domain aggregates - minimal version for auth domain
 * @fileoverview Simple aggregate root without event sourcing (YAGNI principle)
 *
 * Note: This differs from Quiz domain's event-sourced AggregateRoot by design.
 * See ADR-004 for architectural decision rationale.
 * @see docs/adr/004-auth-domain-aggregate-root-decision.md
 */

export abstract class AggregateRoot<TId> {
  constructor(public readonly id: TId) {}

  equals(other: AggregateRoot<TId>): boolean {
    if (this === other) return true;
    if (!other) return false;
    return this.id === other.id;
  }
}
