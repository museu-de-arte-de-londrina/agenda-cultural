import js from '@eslint/js';

export default [
  { ignores: ['_site/**', 'node_modules/**'] },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        URL: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'error',
    },
  },
  {
    // The only file that runs in a browser instead of in Node.
    files: ['src/theme.js'],
    languageOptions: {
      ecmaVersion: 2019,
      sourceType: 'script',
      globals: {
        document: 'readonly',
        window: 'readonly',
        localStorage: 'readonly',
      },
    },
    rules: {
      // It ships to browsers as-is, so it stays on ES5-era syntax.
      'prefer-const': 'off',
      'no-var': 'off',
    },
  },
];
