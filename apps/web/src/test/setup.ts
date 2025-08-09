// Vitest test setup file
import { afterEach, vi } from 'vitest';

type FetchWithPreconnect = typeof fetch & { preconnect: (url: string) => void };

// Setup global fetch mock
const mockFetch = vi.fn() as unknown as FetchWithPreconnect;
mockFetch.preconnect = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Setup additional global mocks if needed
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Global cleanup hook to prevent state leakage between tests
afterEach(() => {
  vi.clearAllMocks(); // Clear mock call history
  vi.restoreAllMocks(); // Restore original implementations
  vi.unstubAllGlobals(); // Remove all global stubs
});
