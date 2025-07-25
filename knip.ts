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
        'scripts/**/*.ts',
        'tests/**/*.test.ts',
      ],
      project: ['src/**', 'scripts/**'],
    },
  },
};

export default config;
