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
        TextEncoder: 'readonly',
        fetch: 'readonly',
        Response: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'error',
    },
  },
  {
    // Os callbacks de page.evaluate rodam dentro do navegador, não no Node,
    // mesmo morando num arquivo de teste.
    files: ['test/browser/**/*.js'],
    languageOptions: {
      globals: {
        document: 'readonly',
        window: 'readonly',
        getComputedStyle: 'readonly',
        navigator: 'readonly',
        Navigator: 'readonly',
      },
    },
  },
  {
    // The only file that runs in a browser instead of in Node.
    files: ['src/theme.js', 'src/compartilhar.js'],
    languageOptions: {
      ecmaVersion: 2019,
      sourceType: 'script',
      globals: {
        document: 'readonly',
        window: 'readonly',
        localStorage: 'readonly',
        navigator: 'readonly',
        location: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
      },
    },
    rules: {
      // It ships to browsers as-is, so it stays on ES5-era syntax.
      'prefer-const': 'off',
      'no-var': 'off',
    },
  },
];
