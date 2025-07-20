import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './testing/infra/db/schema.ts',
  out: './testing/infra/db/migrations',
  dialect: 'postgresql',
  // No dbCredentials needed - we only generate SQL, not apply it
  verbose: true,
  strict: true,
});
