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
      // Locked from the measured run (stmts 95.4, branch 85.2, funcs 91.3,
      // lines 95.4 as of 2026-06-23), calibrated below current with headroom
      // so CI catches real regressions without flaking. Well above the 60%
      // project minimum. Raise when adding tests; never lower to mask a gap.
      thresholds: {
        branches: 80,
        functions: 85,
        lines: 90,
        statements: 90,
      },
    },
  },
});
