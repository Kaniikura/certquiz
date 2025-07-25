/**
 * Request Helper Functions
 * @fileoverview Utility functions for handling HTTP requests safely
 */

import type { Context } from 'hono';

/**
 * Safely parses JSON from request body
 * @param c - Hono context
 * @returns Parsed JSON object or null if parsing fails
 */
export async function safeJson(c: Context): Promise<unknown | null> {
  try {
    return await c.req.json();
  } catch {
    return null;
  }
}
