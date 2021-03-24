const blacklist = require('metro-config/src/defaults/blacklist')
const path = require('path')
const glob = require('glob-to-regexp')

const getBlacklistRE = () => {
  // ignore dist/, dev/
  const defaultPattern = blacklist([
    glob(`${path.resolve(__dirname, '..')}/dist/*`),
    glob(`${path.resolve(__dirname, '..')}/dev/*`),
    glob(`${path.resolve(__dirname, '..')}/example/*`),
    // 'graceful-fs',
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
    // path.resolve(__dirname, 'src'),
    path.resolve(__dirname, 'native'),
    path.resolve(__dirname, 'node_modules', '@babel'),
  ],
  resolver: {
    extraNodeModules: {
      fs: path.resolve(__dirname, 'src', 'fs-mock'),
      'graceful-fs': path.resolve(__dirname, 'src', 'fs-mock'),
      module: path.resolve(__dirname, 'src', 'fs-mock'),
      assert: path.resolve(__dirname, 'src', 'fs-mock'),
      stream: path.resolve(__dirname, 'src', 'fs-mock'),
      constants: path.resolve(__dirname, 'src', 'fs-mock'),
    },
    blacklistRE: getBlacklistRE(),
  },
  transformer: {
    babelTransformerPath: path.resolve(__dirname, 'rn-transformer.js'),
  },
}

module.exports = config
