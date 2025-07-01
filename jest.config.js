module.exports = {
  verbose: true,
  bail: true,
  testURL: 'http://localhost/',
  moduleNameMapper: {
    // '^rxjs(.*)$': '<rootDir>/node_modules/rxjs/internal$1',
  },
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.js'],
  rootDir: __dirname,
  modulePaths: ['<rootDir>/src'],
  moduleDirectories: ['<rootDir>/node_modules'],
  restoreMocks: true,
  testMatch: ['**/__tests__/**/?(spec|test).[tj]s', '**/?(*.)(spec|test).[tj]s'],
  moduleFileExtensions: ['js', 'jsx', 'ts', 'tsx', 'json'],
  modulePathIgnorePatterns: ['<rootDir>/dist', '<rootDir>/dev'],
  collectCoverage: true,
  collectCoverageFrom: ['!**/node_modules/**', 'src/**/*.{js,jsx,ts,tsx}', '!src/**/*.d.ts'],
  coverageDirectory: 'coverage',
  coverageReporters: ['html', 'json'],
  transform: {
    '^.+\\.(t|j)sx?$': [
      'babel-jest',
      {
        presets: [
          '@babel/preset-typescript',
          ['@babel/preset-env', { targets: { node: 'current' } }],
          '@babel/preset-react',
        ],
        plugins: [
          ['@babel/plugin-proposal-decorators', { legacy: true }],
          ['@babel/plugin-proposal-class-properties', { loose: true }],
          ['@babel/plugin-transform-runtime', { regenerator: true }],
        ],
      },
    ],
  },
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json',
      babelConfig: true,
      diagnostics: false,
    },
  },
}
