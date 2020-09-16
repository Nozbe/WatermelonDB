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
  resolver: {
    blacklistRE: getBlacklistRE(),
  },
  transformer: {
    babelTransformerPath: path.resolve(__dirname, 'rn-transformer.js'),
  },
}

module.exports = config
