/**
 * Test Fakes Barrel Export
 * @fileoverview Centralized exports for all fake implementations
 */

export { FakeQuizRepository } from './FakeQuizRepository';
export {
  FakeUnitOfWork,
  FakeUnitOfWorkFactory,
  withFakeUnitOfWork,
} from './FakeUnitOfWork';
export { FakeUserRepository } from './FakeUserRepository';

// TODO: Add more fake implementations as needed
// export { FakeEmailService } from './FakeEmailService';
