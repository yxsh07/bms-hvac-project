import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text'],
      exclude: ['node_modules/', '**/*.test.*', '**/*.d.ts'],
    },
  },
  resolve: {
    alias: {
      '@contracts': path.resolve(__dirname, '../../packages/contracts/src/index.ts'),
      '@quality': path.resolve(__dirname, '../../packages/quality/src/index.ts'),
      '@ontology': path.resolve(__dirname, '../../packages/ontology/src/index.ts'),
    },
  },
});
