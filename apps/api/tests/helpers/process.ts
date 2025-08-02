/**
 * Process execution utilities for tests
 */

import { spawn } from 'node:child_process';

export interface ProcessResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  failed: boolean;
}

interface RunScriptOptions {
  timeout?: number;
  cwd?: string;
}

/**
 * Run a bun script and capture output
 */
export async function runBunScript(
  script: string,
  options: RunScriptOptions = {}
): Promise<ProcessResult> {
  return new Promise((resolve) => {
    const { timeout = 10000, cwd = process.cwd() } = options;

    const proc = spawn('bun', ['run', script], {
      cwd,
      shell: true,
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill();
    }, timeout);

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        stdout,
        stderr,
        exitCode: code ?? 1,
        failed: code !== 0 || timedOut,
      });
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      resolve({
        stdout,
        stderr: err.message,
        exitCode: 1,
        failed: true,
      });
    });
  });
}
