import '@testing-library/jest-dom/vitest';
import { vi, beforeAll, afterAll, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Testing Library auto-cleanup only runs when test globals are enabled; enable it explicitly.
afterEach(() => {
  cleanup();
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}));

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  }))
});

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}));

// react-virtualized-auto-sizer relies on element measurements that jsdom does not
// provide, so provide a fixed viewport for tests.
vi.mock('react-virtualized-auto-sizer', () => ({
  default: ({ children }: { children: (size: { width: number; height: number }) => unknown }) =>
    children({ width: 1024, height: 768 })
}));

// react-window only renders visible rows, which never materialise in jsdom.
// Render every row so list content is assertable.
vi.mock('react-window', () => ({
  FixedSizeList: ({
    itemCount,
    itemSize,
    children
  }: {
    itemCount: number;
    itemSize: number;
    children: (args: { index: number; style: { width: number; height: number } }) => unknown;
  }) => Array.from({ length: itemCount }, (_, index) => children({ index, style: { width: 1024, height: itemSize } }))
}));

// Suppress console.error for tests (optional)
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    const first = args[0];
    if (typeof first === 'string' && first.includes('Warning: ReactDOM.render is no longer supported')) return;
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});
