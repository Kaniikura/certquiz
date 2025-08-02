import type { KnipConfig } from 'knip';

// Provide a dummy DATABASE_URL for knip's Drizzle plugin
// This prevents drizzle.config.ts from throwing an error during static analysis
// The actual DATABASE_URL is still required when running drizzle-kit commands
if (process.env.NODE_ENV !== 'production') {
  process.env.DATABASE_URL ||= 'postgres://fake:fake@127.0.0.1:5432/fake';
}

const config: KnipConfig = {
  // Stricter rules for unused code detection
  rules: {
    exports: 'error', // Fail on any unused exports
    types: 'error', // Fail on unused types
    duplicates: 'error', // Fail on duplicate exports
    dependencies: 'error', // Fail on unused dependencies
    devDependencies: 'error', // Fail on unused devDependencies
    files: 'error', // Fail on unused files
    classMembers: 'error', // Fail on unused class members
    enumMembers: 'error', // Fail on unused enum members
  },
  // Treat configuration hints as errors to ensure best practices
  treatConfigHintsAsErrors: true,
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
