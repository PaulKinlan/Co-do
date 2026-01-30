import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    // Don't use globals to avoid conflicts with Playwright
    globals: false,
  },
});
