import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'tests/fixtures/**/*.test.ts',
      'tests/integration/**/*.test.ts',
      'tests/errors/**/*.test.ts',
      'packages/**/*.test.ts',
    ],
  },
});
