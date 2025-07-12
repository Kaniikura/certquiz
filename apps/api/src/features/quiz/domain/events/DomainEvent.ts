/**
 * Base domain event class for event sourcing
 * @fileoverview Foundation for all domain events with proper typing
 */

import type { Clock } from '@api/shared/clock';
import { SystemClock } from '@api/shared/clock';

export abstract class DomainEvent<TAggregateId, TPayload extends object = object> {
  public readonly eventId: string;
  public readonly aggregateId: TAggregateId;
  public readonly version: number;
  public readonly eventType: string;
  public readonly payload: TPayload;
  public readonly occurredAt: Date;
  private _eventSequence: number = 0;

  constructor(props: {
    aggregateId: TAggregateId;
    version: number;
    eventType: string;
    payload: TPayload;
    eventId?: string;
    occurredAt?: Date;
    clock?: Clock;
  }) {
    this.eventId = props.eventId ?? crypto.randomUUID();
    this.aggregateId = props.aggregateId;
    this.version = props.version;
    this.eventType = props.eventType;
    this.payload = props.payload;
    const clock = props.clock ?? new SystemClock();
    this.occurredAt = props.occurredAt ?? clock.now();
  }

  get eventSequence(): number {
    return this._eventSequence;
  }

  // Internal method for AggregateRoot to set sequence
  // Using symbol-based access for better encapsulation
  private static readonly SET_SEQUENCE_SYMBOL = Symbol('setSequence');

  static setEventSequence<TAggregateId, TPayload extends object>(
    event: DomainEvent<TAggregateId, TPayload>,
    sequence: number
  ): void {
    event._eventSequence = sequence;
  }

  /** @deprecated Use DomainEvent.setEventSequence instead */
  internalSetSequence(sequence: number): void {
    this._eventSequence = sequence;
  }
}
