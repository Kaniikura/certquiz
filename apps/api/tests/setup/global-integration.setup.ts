/**
 * Global setup for integration tests
 * @fileoverview Generates shared RSA key pair once before all integration tests
 *
 * This prevents resource contention from multiple concurrent generateKeyPair calls
 * in parallel test workers, which was causing CI timeouts.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { exportJWK, generateKeyPair, type JWK } from 'jose';

export interface SharedTestKeys {
  privateKey: JWK;
  publicKey: JWK;
}

const KEYS_FILE_PATH = join(process.cwd(), 'tests/setup/shared-test-keys.json');

/**
 * Global setup function - runs once before all integration tests
 * Generates RSA key pair and saves to shared file
 */
export async function setup(): Promise<void> {
  // Generate single RSA key pair for all tests to avoid resource contention

  try {
    // Generate single RSA key pair for all tests (extractable for JWK export)
    const keyPair = await generateKeyPair('RS256', { extractable: true });

    // Export keys as JWK format for easy JSON serialization
    const privateJWK = await exportJWK(keyPair.privateKey);
    const publicJWK = await exportJWK(keyPair.publicKey);

    const sharedKeys: SharedTestKeys = {
      privateKey: privateJWK,
      publicKey: publicJWK,
    };

    // Ensure directory exists
    await mkdir(join(process.cwd(), 'tests/setup'), { recursive: true });

    // Save keys to shared file
    await writeFile(KEYS_FILE_PATH, JSON.stringify(sharedKeys, null, 2));

    // Keys successfully generated and saved
  } catch (error) {
    throw new Error(
      `Failed to generate shared test keys: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Global teardown function - runs once after all integration tests
 * Cleans up the shared keys file
 */
export async function teardown(): Promise<void> {
  try {
    const { unlink } = await import('node:fs/promises');
    await unlink(KEYS_FILE_PATH);
    // Shared test keys cleaned up successfully
  } catch {
    // Ignore cleanup errors - file might not exist
  }
}
