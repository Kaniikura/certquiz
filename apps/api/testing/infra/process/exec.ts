/**
 * Process execution helpers for testing
 * Replaces blocking execSync with async process execution
 */

import { execa } from 'execa';

/**
 * Options for running test processes
 */
interface RunProcessOptions {
  timeout?: number;
  cwd?: string;
  env?: Record<string, string>;
  stdin?: string;
}

/**
 * Result of process execution
 */
export interface ProcessResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  command: string;
  failed: boolean;
}

/**
 * Runs a command asynchronously with proper error handling
 * Replaces execSync with non-blocking execution
 *
 * @param command - Command to run (e.g., 'bun')
 * @param args - Command arguments
 * @param options - Execution options
 * @returns Process execution result
 */
export async function runProcess(
  command: string,
  args: string[] = [],
  options: RunProcessOptions = {}
): Promise<ProcessResult> {
  const {
    timeout = 30000, // 30 second default timeout
    cwd = process.cwd(),
    env = {},
    stdin,
  } = options;

  try {
    const result = await execa(command, args, {
      timeout,
      cwd,
      env: { ...process.env, ...env },
      input: stdin,
      encoding: 'utf8',
      reject: false, // Don't throw on non-zero exit codes
    });

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode || 0,
      command: `${command} ${args.join(' ')}`,
      failed: result.failed,
    };
  } catch (error) {
    // Handle timeout and other execution errors
    if (error instanceof Error) {
      return {
        stdout: '',
        stderr: error.message,
        exitCode: 1,
        command: `${command} ${args.join(' ')}`,
        failed: true,
      };
    }

    throw error;
  }
}

/**
 * Runs a bun script with proper error handling
 * Common pattern for running TypeScript files with bun
 *
 * @param scriptPath - Path to the TypeScript file to run
 * @param options - Execution options
 * @returns Process execution result
 */
export async function runBunScript(
  scriptPath: string,
  options: RunProcessOptions = {}
): Promise<ProcessResult> {
  return runProcess('bun', ['run', scriptPath], options);
}
