import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './tests/helpers/db-schema.ts',
  out: './tests/helpers/migrations',
  dialect: 'postgresql',
  // No dbCredentials needed - we only generate SQL, not apply it
  verbose: true,
  strict: true,
});
