import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default [
  { ignores: ['**/dist/**', '**/node_modules/**', 'server/.mongo-data/**', 'server/uploads/**'] },
  js.configs.recommended,
  {
    files: ['server/**/*.js', '*.js'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['client/**/*.{js,jsx}'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // ESLint alone cannot see JSX usage, so capitalised names are allowed through.
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
];
