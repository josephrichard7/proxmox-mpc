module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  plugins: [
    '@typescript-eslint',
  ],
  extends: [
    'eslint:recommended',
  ],
  root: true,
  env: {
    node: true,
    jest: true,
    es6: true,
  },
  ignorePatterns: [
    '.eslintrc.js',
    'dist/**',
    'node_modules/**',
    'coverage/**',
    '**/*.js',
  ],
  rules: {
    // Basic ESLint rules
    'prefer-const': 'error',
    'no-var': 'error',
    'no-unused-vars': 'off', // TypeScript handles this
    'no-undef': 'off', // TypeScript handles this
    'no-useless-catch': 'off', // Allow catch blocks for specific error handling
    'no-case-declarations': 'off', // Allow lexical declarations in case blocks
    'no-useless-escape': 'warn', // Warn instead of error for escape characters
    
    // TypeScript-specific rules - Relaxed for development
    '@typescript-eslint/no-unused-vars': ['warn', { 
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      // Allow unused variables in tests and type imports
      ignoreRestSiblings: true,
    }],
  },
};