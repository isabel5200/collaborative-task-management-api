import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./tests/global-setup.js'],
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 15000,
    hookTimeout: 30000,
    coverage: { reporter: ['text', 'html'] },
  },
});
