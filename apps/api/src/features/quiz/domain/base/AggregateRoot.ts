/**
 * Base class for domain aggregates supporting event sourcing
 * @fileoverview Event sourcing aggregate root with versioning and event management
 */

import type { DomainEvent } from '../events/DomainEvent';

export abstract class AggregateRoot<TId, TEventPayloads extends object = object> {
  private _version: number = 0;
  private _uncommittedEvents: DomainEvent<TId, TEventPayloads>[] = [];
  private _eventSequenceCounter: number = 1;

  constructor(public readonly id: TId) {}

  get version(): number {
    return this._version;
  }

  protected incrementVersion(): number {
    this._version++;
    this._eventSequenceCounter = 1; // Reset sequence to 1 for new version
    return this._version;
  }

  protected addEvent<TPayload extends TEventPayloads>(event: DomainEvent<TId, TPayload>): void {
    // Verify event version matches current aggregate version
    if (event.version !== this._version) {
      throw new Error(`Event version mismatch: expected ${this._version}, got ${event.version}`);
    }

    // Auto-assign sequence number within version
    event.internalSetSequence(this._eventSequenceCounter++);
    this._uncommittedEvents.push(event as DomainEvent<TId, TEventPayloads>);
  }

  hasUncommittedEvents(): boolean {
    return this._uncommittedEvents.length > 0;
  }

  pullUncommittedEvents(): ReadonlyArray<DomainEvent<TId, TEventPayloads>> {
    const events = [...this._uncommittedEvents];
    this._uncommittedEvents = [];
    return events;
  }

  markChangesAsCommitted(): void {
    this._uncommittedEvents = [];
  }

  /**
   * Get expected version for optimistic concurrency control
   */
  getExpectedVersion(): number {
    return this._version;
  }

  // For event sourcing reconstruction
  loadFromHistory(events: DomainEvent<TId, TEventPayloads>[]): void {
    let currentVersion = -1;
    let maxSeq = 0;

    for (const event of events) {
      // Reset sequence counter when version changes
      if (event.version !== currentVersion) {
        currentVersion = event.version;
        maxSeq = 0;
      }

      // Track max sequence within current version
      maxSeq = Math.max(maxSeq, event.eventSequence);

      this.apply(event);
      this._version = event.version;
    }

    // Set sequence counter to continue from the last event
    this._eventSequenceCounter = maxSeq + 1;
    this.markChangesAsCommitted();
  }

  protected abstract apply(event: DomainEvent<TId, TEventPayloads>): void;
}
