import { defineConfig } from 'vitest/config';

// The console's unit tests are pure logic (clock/format helpers) and run in the
// default node environment; the React UI is exercised by the Playwright suite
// in apps/web once SimSite is running.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
