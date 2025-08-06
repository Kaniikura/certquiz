/**
 * System statistics response DTO
 * @fileoverview Data transfer object for admin system statistics
 */

export interface SystemStats {
  users: {
    total: number;
    active: number;
    averageLevel: number;
  };
  quizzes: {
    total: number;
    activeSessions: number;
    averageScore: number; // percentage
  };
  questions: {
    total: number;
    pending: number;
  };
  system: {
    totalExperience: number;
    timestamp: Date;
  };
}
