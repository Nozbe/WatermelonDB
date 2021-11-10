const blacklist = require('metro-config/src/defaults/blacklist')
const path = require('path')
const glob = require('glob-to-regexp')

const getBlacklistRE = () => {
  // ignore dist/, dev/
  const defaultPattern = blacklist([
    glob(`${path.resolve(__dirname, '..')}/dist/*`),
    glob(`${path.resolve(__dirname, '..')}/dev/*`),
    glob(`${path.resolve(__dirname, '..')}/example/*`),
  ])
    .toString()
    .slice(1, -1)

  // delete __tests__ from the default blacklist
  const newPattern = defaultPattern.replace(`|.*\\/__tests__\\/.*`, '')

  return RegExp(newPattern)
}

const config = {
  projectRoot: path.resolve(__dirname),
  watchFolders: [
    path.resolve(__dirname, 'native'),
    path.resolve(__dirname, 'node_modules', '@babel'),
  ],
  resolver: {
    extraNodeModules: {
      // We need `expect` package for RN integration tests… but the damn thing expects to be in jest
      // (Node) environment… so we have to mock a bunch of stuff for this to work
      fs: path.resolve(__dirname, 'src/__tests__/emptyMock'),
      'graceful-fs': path.resolve(__dirname, 'src/__tests__/emptyMock'),
      module: path.resolve(__dirname, 'src/__tests__/emptyMock'),
      assert: path.resolve(__dirname, 'src/__tests__/emptyMock'),
      stream: path.resolve(__dirname, 'src/__tests__/emptyMock'),
      constants: path.resolve(__dirname, 'src/__tests__/emptyMock'),
    },
    blacklistRE: getBlacklistRE(),
  },
  transformer: {
    babelTransformerPath: path.resolve(__dirname, 'rn-transformer.js'),
  },
}

module.exports = config
