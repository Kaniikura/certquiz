/**
 * Base domain event class for event sourcing
 * @fileoverview Foundation for all domain events with proper typing
 */

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
  }) {
    this.eventId = props.eventId ?? crypto.randomUUID();
    this.aggregateId = props.aggregateId;
    this.version = props.version;
    this.eventType = props.eventType;
    this.payload = props.payload;
    this.occurredAt = props.occurredAt ?? new Date();
  }

  get eventSequence(): number {
    return this._eventSequence;
  }

  // Internal method for AggregateRoot to set sequence
  internalSetSequence(sequence: number): void {
    this._eventSequence = sequence;
  }
}
