const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config')
const exclusionList = require('metro-config/src/defaults/exclusionList')
// const fs = require('fs')
const path = require('path')
const glob = require('glob-to-regexp')
const metroCache = require('metro-cache')

// const rnwPath = fs.realpathSync(
//   path.resolve(require.resolve('react-native-windows/package.json'), '..'),
// )

const getBlockList = () => {
  const defaultPattern = exclusionList([
    // ignore dist/, dev/
    glob(`${path.resolve(__dirname, '..')}/dist/*`),
    glob(`${path.resolve(__dirname, '..')}/dev/*`),
    glob(`${path.resolve(__dirname, '..')}/example/*`),
    // This stops "react-native run-windows" from causing the metro server to crash if its already running
    // TODO: Shouldn't it be native/windowsTest?
    new RegExp(`${path.resolve(__dirname, 'windows').replace(/[/\\]/g, '/')}.*`),
    // This prevents "react-native run-windows" from hitting: EBUSY: resource busy or locked, open msbuild.ProjectImports.zip or other files produced by msbuild
    // new RegExp(`${rnwPath}/build/.*`),
    // new RegExp(`${rnwPath}/target/.*`),
    // /.*\.ProjectImports\.zip/,
  ])
    .toString()
    .slice(1, -1)

  // delete __tests__ from the default blacklist
  const newPattern = defaultPattern.replace(`|\\${path.sep}__tests__\\${path.sep}.*`, '')

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
    blockList: getBlockList(),
  },
  transformer: {
    babelTransformerPath: path.resolve(__dirname, 'native/metro-transformer.js'),
  },
  cacheStores: [
    new metroCache.FileStore({
      root: path.resolve(__dirname, '.cache/metro'),
    }),
  ],
}

module.exports = mergeConfig(getDefaultConfig(__dirname), config)
