const assetTransform = 'react-native-windows/jest/assetFileTransformer.js';
const reactNativeTransform = './custom-transformer.js';
const defaultTransform = [
  'babel-jest',
  require('@rnw-scripts/babel-node-config'),
];

module.exports = {
  preset: '@rnx-kit/jest-preset',
  roots: ['<rootDir>/test/'],
  testEnvironment: '@react-native-windows/automation',
  testRegex: '.*\\.test\\.ts$',
  testTimeout: 70000,
  transform: {
    '^.+\\.(bmp|gif|jpg|jpeg|mp4|png|psd|svg|webp)$': assetTransform,
    'node_modules\\\\@?react-native\\\\.*': reactNativeTransform,
    '@react-native-windows\\\\tester\\\\.*': reactNativeTransform,
    'vnext\\\\.*': reactNativeTransform,
    '^.+\\.[jt]sx?$': defaultTransform,
  },
  // snapshotResolver: 'react-native-windows/jest-snapshot-resolver.js',
  transformIgnorePatterns: ['jest-runner'],
  maxWorkers: 1,
  verbose: true,
  // setupFilesAfterEnv: [
  //   'react-native-windows/jest/setup',
  //   './jest.setup.js',
  // ],

  testEnvironmentOptions: {
    app: 'WatermelonTester',
    webdriverOptions: {
      port: 4724,
      // Level of logging verbosity: trace | debug | info | warn | error
      logLevel: 'trace',

      // Default timeout for all waitFor* commands.
      waitforTimeout: 60000,

      // Default timeout in milliseconds for request
      connectionRetryTimeout: 10000,
      connectionRetryCount: 10,
    },
  },
};
