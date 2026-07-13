import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'src/main.ts',
        'node_modules/**',
        'dist/**',
        '**/*.d.ts',
        '**/*.config.*',
        'tests/**',
      ],
    },
  },
});
