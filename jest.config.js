module.exports = {
  verbose: true,
  bail: true,
  testURL: 'http://localhost/',
  moduleNameMapper: {
    '^rxjs(.*)$': '<rootDir>/node_modules/rxjs/internal$1',
  },
  setupTestFrameworkScriptFile: '<rootDir>/src/__tests__/setup.js',
  rootDir: __dirname,
  modulePaths: ['<rootDir>/src'],
  moduleDirectories: ['<rootDir>/node_modules'],
  restoreMocks: true,
  testMatch: ['**/__tests__/**/?(spec|test).(js|jsx)', '**/?(*.)(spec|test).(js|jsx)'],
  moduleFileExtensions: ['js', 'jsx'],
  modulePathIgnorePatterns: ['<rootDir>/dist', '<rootDir>/dev'],
}
