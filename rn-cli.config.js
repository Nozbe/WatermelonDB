const blacklist = require('metro-config/src/defaults/blacklist')
const path = require('path')

const getBlacklistRE = () => {
  // delete __tests__ from the default blacklist
  const defaultPattern = blacklist()
    .toString()
    .slice(1, -1)
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
