/**
 * Shared test utilities
 * @fileoverview Central export for test support utilities
 */

// Re-export commonly used types for convenience
export type { Clock } from '@api/features/quiz/domain/base/Clock';
export { isResultErr, isResultOk, unwrapOrFail } from './helpers';
export { testIds } from './id-generators';
export { TestClock } from './TestClock';
export type { Mutable } from './types/Mutable';
