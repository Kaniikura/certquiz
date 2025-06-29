import * as dotenv from 'dotenv';
import { z } from 'zod';

// Priority order = .env.test → .env → process env
// Load in correct priority order: lowest priority first, then override with higher priority
dotenv.config(); // Load .env first (lowest priority)
dotenv.config({ path: '.env.test', override: true }); // Override with .env.test (highest priority)

const Env = z.object({
  DATABASE_URL: z.string().url().optional(),
  DATABASE_URL_TEST: z.string().url().optional(),
});

const env = Env.parse(process.env);

export const TEST_DB_URL =
  env.DATABASE_URL_TEST ??
  env.DATABASE_URL ??
  (() => {
    throw new Error('DATABASE_URL_TEST or DATABASE_URL missing');
  })();
