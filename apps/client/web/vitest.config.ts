import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@repo/types': path.resolve(__dirname, '../../../packages/types/src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/__tests__/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'e2e'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: 'coverage',
      // D6: GLOBAL gate across all of src/. Exclude framework-managed
      // files with no testable branch logic (Voyager-style list).
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        '**/*.config.*',
        '**/*.d.ts',
        '**/*.test.{ts,tsx}',
        '.next/**',
        'e2e/**',
        'public/**',
        'src/__tests__/**',
        'src/app/layout.tsx',
        'src/app/**/layout.tsx',
        'src/app/**/loading.tsx',
        'src/app/**/error.tsx',
        'src/app/**/not-found.tsx',
      ],
      // Thresholds are locked in Task 9 from the measured run. Lines and
      // statements target 60 (project minimum); branches/functions floor
      // at 55. Never lower a threshold to mask a coverage gap (R-200).
      thresholds: {
        branches: 55,
        functions: 55,
        lines: 60,
        statements: 60,
      },
    },
  },
});
