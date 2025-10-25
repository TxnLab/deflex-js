// @ts-check

import eslint from '@eslint/js'
import { defineConfig } from 'eslint/config'
import eslintConfigPrettier from 'eslint-config-prettier'
import importX from 'eslint-plugin-import-x'
import tseslint from 'typescript-eslint'

export default defineConfig(
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    ignores: ['**/dist/**', '**/node_modules/**'],
  },
  {
    files: ['**/src/**/*.ts', '**/tests/**/*.ts'],
    plugins: {
      // @ts-expect-error https://github.com/typescript-eslint/typescript-eslint/issues/11543
      'import-x': importX,
    },
    rules: {
      'import-x/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index',
            'object',
            'type',
          ],
          alphabetize: {
            order: 'asc',
            caseInsensitive: true,
          },
        },
      ],
    },
  },
  {
    files: ['**/tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' },
      ],
    },
  },
  eslintConfigPrettier,
)
