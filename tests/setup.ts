import 'reflect-metadata';
import { beforeEach, afterEach } from 'vitest';

// Global test setup
beforeEach(() => {
  // Reset any global state before each test
});

afterEach(() => {
  // Clean up after each test
});

// Mock console methods for cleaner test output
const originalConsole = { ...console };

beforeEach(() => {
  // Silence console output during tests unless DEBUG=true
  if (!process.env.DEBUG) {
    console.log = vi.fn();
    console.warn = vi.fn();
    console.error = vi.fn();
    console.debug = vi.fn();
  }
});

afterEach(() => {
  // Restore console
  if (!process.env.DEBUG) {
    Object.assign(console, originalConsole);
  }
});