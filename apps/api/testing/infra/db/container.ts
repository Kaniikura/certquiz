/**
 * Database container management and URL utilities
 * Combines testcontainer management with database lifecycle operations
 */

import type postgres from 'postgres';

/**
 * Pool tracking for proper cleanup
 */
const activePools = new Set<postgres.Sql>();

/**
 * Closes all tracked postgres clients
 * Call this in afterAll hooks to prevent resource leaks
 */
export async function closeAllTrackedClients(): Promise<void> {
  const closePromises = Array.from(activePools).map(async (client) => {
    try {
      await client.end();
    } catch {
      // Silently ignore client close errors
    }
  });

  await Promise.all(closePromises);
  activePools.clear();
}
