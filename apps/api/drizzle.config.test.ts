import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './test-utils/db/schema.ts',
  out: './test-utils/db/migrations',
  dialect: 'postgresql',
  // No dbCredentials needed - we only generate SQL, not apply it
  verbose: true,
  strict: true,
});
