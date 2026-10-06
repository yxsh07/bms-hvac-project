// Flat ESLint config for apps/api.
//
// No new npm dependencies are permitted in this offline workspace, and neither
// the TypeScript parser nor the core recommended config is linked into
// apps/api/node_modules. They do exist in the workspace virtual store, so we
// load the parser by absolute path. Type-aware analysis stays with
// `tsc --noEmit` (the `typecheck` script).
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const parserEntry = path.join(
  here,
  '../../node_modules/.pnpm/node_modules/@typescript-eslint/parser/dist/index.js',
);
const tsParser = (await import(pathToFileURL(parserEntry).href)).default;

export default [
  {
    ignores: ['node_modules/**', 'coverage/**', 'dist/**', '*.config.*'],
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      'no-debugger': 'error',
      'no-duplicate-imports': 'error',
      'no-unreachable': 'error',
    },
  },
];
