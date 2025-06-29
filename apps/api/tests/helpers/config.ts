import * as dotenv from 'dotenv';
import { z } from 'zod';

// Priority order = .env.test → .env → process env
dotenv.config({ path: '.env.test', override: false });
dotenv.config(); // fall back to the standard file

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
