const config = {
  env: {
    es6: true,
    // configure globals
    jest: true,
    browser: true,
    commonjs: true,
    node: true,
  },
  plugins: ['import', '@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:flowtype/recommended',
    'prettier',
    'plugin:jest/recommended',
  ],
  parser: '@babel/eslint-parser',
  ignorePatterns: 'examples/typescript/**/*.ts',
  settings: {
    flowtype: {
      onlyFilesWithFlowAnnotation: true,
    },
  },
  rules: {
    'no-console': ['error'],
    'no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
      },
    ],
    'import/no-cycle': 'error',
    'jest/no-large-snapshots': 'warn',
    'jest/no-disabled-tests': 'off',
    'jest/expect-expect': 'off',
  },
  overrides: [
    {
      files: ['src/**/*.js'],
      excludedFiles: ['*integrationTest.js', '*test.js', '**/__tests__/**', '*test.*.js'],
      rules: {
        'flowtype/require-valid-file-annotation': ['error', 'always'],
      },
    },
    {
      files: ['src/**/*.ts', 'examples/typescript/*.ts'],
      parser: '@typescript-eslint/parser',
      rules: {
        'flowtype/no-types-missing-file-annotation': 'off',
      },
    },
  ],
}

module.exports = config
