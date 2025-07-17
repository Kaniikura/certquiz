import { defineConfig } from 'drizzle-kit';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is required');
}

export default defineConfig({
  schema: './src/infra/db/schema/index.ts',
  out: './src/infra/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
  },
  migrations: {
    prefix: 'timestamp',
    table: '__drizzle_migrations',
    schema: 'public',
  },
  tablesFilter: ['*'],
  verbose: true,
  strict: true,
});
