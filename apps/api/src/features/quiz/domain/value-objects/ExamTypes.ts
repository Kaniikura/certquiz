/**
 * Exam and difficulty types for quiz configuration
 * @fileoverview Domain types for quiz categorization
 */

export type ExamType =
  | 'CCNA'
  | 'CCNP_ENCOR'
  | 'CCNP_ENARSI'
  | 'SECURITY_PLUS'
  | 'NETWORK_PLUS'
  | 'CISSP';

export type Category =
  | 'OSPF'
  | 'BGP'
  | 'SWITCHING'
  | 'SECURITY'
  | 'WIRELESS'
  | 'AUTOMATION'
  | 'QOS';

export type Difficulty = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'MIXED';
