/**
 * Test implementation of Clock with controlled time
 * @fileoverview Test utility for time-dependent tests
 */

import type { Clock } from '@api/features/quiz/domain/base/Clock';

export class TestClock implements Clock {
  constructor(private _currentTime: Date = new Date()) {}

  now(): Date {
    return new Date(this._currentTime.getTime());
  }

  setTime(time: Date): void {
    this._currentTime = new Date(time.getTime());
  }

  advanceBy(milliseconds: number): void {
    this._currentTime = new Date(this._currentTime.getTime() + milliseconds);
  }

  advanceByMinutes(minutes: number): void {
    this.advanceBy(minutes * 60 * 1000);
  }

  advanceByHours(hours: number): void {
    this.advanceBy(hours * 60 * 60 * 1000);
  }

  advanceByDays(days: number): void {
    this.advanceBy(days * 24 * 60 * 60 * 1000);
  }
}
