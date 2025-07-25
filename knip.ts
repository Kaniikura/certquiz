import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  workspaces: {
    '.': {
      entry: ['scripts/**/*.ts'],
    },
    'apps/api': {
      entry: [
        'src/index.ts',
        'src/app-factory.ts',
        'src/**/*.test.ts',
        'src/system/seed/*.ts',
        'src/system/migration/migrate.ts',
        'scripts/**/*.ts',
        'src/**/*.test.ts',
        'tests/**/*.test.ts',
      ],
      project: ['src/**', 'scripts/**'],
    },
  },
};

export default config;
