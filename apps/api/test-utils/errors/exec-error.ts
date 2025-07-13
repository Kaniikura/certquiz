/**
 * Exec error type guards and utilities for testing
 */

/**
 * Error type from child_process execSync operations
 */
export interface ExecError extends Error {
  stdout?: string;
  stderr?: string;
  status?: number;
  signal?: string;
}

/**
 * Type guard to check if an error is from exec operations
 * @param error - Error to check
 * @returns true if error has exec-related properties
 */
export function isExecError(error: unknown): error is ExecError {
  return error instanceof Error && ('stdout' in error || 'stderr' in error || 'status' in error);
}

/**
 * Safely extracts output from an exec error
 * @param error - Error from exec operation
 * @returns Combined stdout and stderr output
 */
export function getExecErrorOutput(error: ExecError): string {
  const stdout = error.stdout || '';
  const stderr = error.stderr || '';
  return [stdout, stderr].filter(Boolean).join('\n');
}
