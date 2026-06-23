import babelParser from '@babel/eslint-parser';
import tsEslintParser from '@typescript-eslint/parser';
import eslintConfigPrettier from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import security from 'eslint-plugin-security';
import unusedImports from 'eslint-plugin-unused-imports';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const TSCONFIG_PROJECTS = [
  './apps/server/tsconfig.json',
  './apps/client/web/tsconfig.json',
  './apps/worker/tsconfig.json',
  './packages/types/tsconfig.json',
  './packages/chunker/tsconfig.json',
  './packages/logger/tsconfig.json',
  './packages/clients/tsconfig.json',
];

// R-224 layer flow: higher layers import lower, never the reverse. Paths resolve
// from the repo root, where every lint gate (CI, pre-commit, pre-push) runs.
const LAYER_CONTRACT_ZONES = [
  {
    target: './apps/server/src/routes',
    from: './apps/server/src/repositories',
    message:
      'Routes must delegate to handlers, not import repositories directly (R-224).',
  },
  {
    target: './apps/server/src/services',
    from: ['./apps/server/src/handlers', './apps/server/src/routes'],
    message: 'Services must not import handlers or routes (R-224).',
  },
  {
    target: './apps/server/src/repositories',
    from: [
      './apps/server/src/handlers',
      './apps/server/src/routes',
      './apps/server/src/services',
    ],
    message:
      'Repositories are the lowest application layer and must not import upward (R-224).',
  },
  {
    target: './apps/server/src/clients',
    from: [
      './apps/server/src/handlers',
      './apps/server/src/repositories',
      './apps/server/src/routes',
      './apps/server/src/services',
    ],
    message:
      'Clients wrap third-party SDKs and must not import application layers (R-224).',
  },
  {
    target: [
      './apps/client/web/src/api',
      './apps/client/web/src/services',
      './apps/client/web/src/state',
    ],
    from: ['./apps/client/web/src/app', './apps/client/web/src/components'],
    message:
      'Lower web layers must not import routes or components; data flows components -> state -> services/api (R-224).',
  },
];

export default tseslint.config([
  {
    ignores: [
      'build',
      'dist',
      'node_modules',
      '**/*.d.ts',
      '.turbo',
      '.next',
      'apps/client/web/.next',
      '**/vitest.config.ts',
      '**/*.config.ts',
      '**/dist/**',
      'scripts/',
      'e2e/',
      '**/build/**',
    ],
  },
  {
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
    extends: [security.configs.recommended],
    plugins: {
      security,
      'unused-imports': unusedImports,
    },
    rules: {
      curly: 'error',
      'no-console': ['warn', { allow: ['warn', 'info', 'error', 'group'] }],
      'no-implicit-globals': 'error',
      'no-param-reassign': ['error', { props: false }],
      'no-shadow': 'warn',
      'no-undef': 'error',
      'no-underscore-dangle': 'off',
      'no-unreachable': 'warn',
      'no-unused-expressions': 'error',
      'no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      'no-useless-escape': 'off',
      'no-var': 'warn',
      'object-shorthand': ['error', 'always'],
      'prefer-const': 'warn',
      'security/detect-eval-with-expression': 'warn',
      'security/detect-non-literal-fs-filename': 'warn',
      'security/detect-non-literal-regexp': 'warn',
      'security/detect-non-literal-require': 'warn',
      'security/detect-object-injection': 'off',
      'security/detect-possible-timing-attacks': 'warn',
      'unused-imports/no-unused-imports': 'warn',
    },
  },
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parser: babelParser,
      parserOptions: {
        requireConfigFile: false,
      },
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    extends: [...tseslint.configs.recommended],
    languageOptions: {
      ...react.configs.flat.recommended.languageOptions,
      ecmaVersion: 'latest',
      parser: tsEslintParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        ecmaVersion: 'latest',
        project: TSCONFIG_PROJECTS,
        sourceType: 'module',
      },
    },
    plugins: {
      import: importPlugin,
    },
    settings: {
      'import/parsers': {
        '@typescript-eslint/parser': ['.ts', '.tsx'],
      },
      'import/resolver': {
        typescript: {
          project: TSCONFIG_PROJECTS,
        },
      },
    },
    rules: {
      'import/no-cycle': ['error', { ignoreExternal: true }],
      'import/no-restricted-paths': ['error', { zones: LAYER_CONTRACT_ZONES }],
      '@typescript-eslint/ban-ts-comment': [
        'warn',
        { 'ts-ignore': 'allow-with-description' },
      ],
      '@typescript-eslint/consistent-type-definitions': 'off',
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        {
          fixStyle: 'inline-type-imports',
          prefer: 'type-imports',
        },
      ],
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-misused-promises': [
        'warn',
        {
          checksVoidReturn: { attributes: false },
        },
      ],
      '@typescript-eslint/no-require-imports': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unused-expressions': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/require-await': 'off',
      'no-undef': 'off',
      'no-var': 'warn',
      'prefer-const': 'warn',
    },
  },
  {
    files: ['**/*.tsx'],
    plugins: {
      'jsx-a11y': jsxA11y,
      react,
      'react-hooks': reactHooks,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...react.configs.flat.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      'jsx-a11y/anchor-is-valid': 'warn',
      'jsx-a11y/click-events-have-key-events': 'off',
      'jsx-a11y/iframe-has-title': 'off',
      'jsx-a11y/interactive-supports-focus': 'off',
      'jsx-a11y/no-autofocus': 'warn',
      'jsx-a11y/no-noninteractive-element-interactions': 'off',
      'jsx-a11y/no-static-element-interactions': 'off',
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/rules-of-hooks': 'warn',
      'react/display-name': 'warn',
      'react/jsx-curly-brace-presence': ['error', 'never'],
      'react/no-unescaped-entities': 'warn',
      'react/prop-types': 'off',
      'react/react-in-jsx-scope': 'off',
    },
  },
  {
    files: [
      '**/__tests__/**',
      '**/__mocks__/**',
      '**/tests/**',
      '**/*.test.ts',
      '**/*.test.tsx',
    ],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      'no-console': 'off',
      'security/detect-non-literal-regexp': 'off',
    },
  },
  eslintConfigPrettier,
]);
