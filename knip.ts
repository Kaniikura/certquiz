import type { KnipConfig } from 'knip';

// Provide a dummy DATABASE_URL for knip's Drizzle plugin
// This prevents drizzle.config.ts from throwing an error during static analysis
// The actual DATABASE_URL is still required when running drizzle-kit commands
process.env.DATABASE_URL ||= 'postgres://knip:knip@127.0.0.1:5432/knip';

const config: KnipConfig = {
  workspaces: {
    '.': {
      entry: [],
    },
    'apps/api': {
      entry: [
        'src/index.ts',
        'src/app-factory.ts',
        'src/**/*.test.ts',
        'src/system/seed/*.ts',
        'scripts/**/*.ts',
        'tests/**/*.test.ts',
      ],
      project: ['src/**', 'scripts/**'],
    },
  },
};

export default config;
