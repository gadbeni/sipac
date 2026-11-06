import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default [
  { ignores: ['dist', 'node_modules', 'coverage', '.shots'] },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' }],
      // Regla de arquitectura: los componentes no importan los JSON semilla directamente.
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: ['@/data/*', '**/data/*.json'], message: 'Use la capa de servicios; sólo services/seed puede leer src/data.' }] },
      ],
    },
  },
  {
    files: ['src/services/seed/**', 'tests/**'],
    rules: { 'no-restricted-imports': 'off' },
  },
];
