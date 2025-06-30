/**
 * This file exists to provide a user-friendly message when someone
 * accidentally runs "bun test" instead of "bun run test".
 */

import { test } from 'bun:test';

// Note: Using ⚠ (U+26A0) without variation selector for consistent terminal width
// Avoid ⚠️ (U+26A0 + FE0F) as it causes alignment issues in some terminals
// biome-ignore lint/suspicious/noConsole: This is intentional - we need to show this message
console.error(`
╔═══════════════════════════════════════════════════════════════════════╗
║                                                                       ║
║  ⚠  Bun's built-in test runner is disabled for this project           ║
║                                                                       ║
║  This project uses Vitest as its test runner.                         ║
║  Please use one of these commands instead:                            ║
║                                                                       ║
║    • bun run test              - Run all tests                        ║
║    • bun run test:unit         - Run unit tests only                  ║
║    • bun run test:integration  - Run integration tests only           ║
║    • bun run test:e2e          - Run e2e tests only                   ║
║    • bun run test:watch        - Run tests in watch mode              ║
║                                                                       ║
╚═══════════════════════════════════════════════════════════════════════╝
`);

// Create a skipped test so Bun doesn't complain about no tests
test.skip("Bun test is disabled - use Vitest via 'bun run test'", () => {
  // This test is intentionally skipped
});

// Exit with error code to indicate this shouldn't be used
process.exit(1);
