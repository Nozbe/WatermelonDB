const blacklist = require('metro-config/src/defaults/blacklist')
const path = require('path')

const config = {
  resolver: {
    getBlacklistRE: (() => {
      // delete __tests__ from the default blacklist
      const defaultPattern = blacklist()
        .toString()
        .slice(1, -1)

      const newPattern = defaultPattern.replace(`|.*\\/__tests__\\/.*`, '')
      console.log(newPattern)
      return RegExp(newPattern)
    })(),
  },
  transformer: {
    babelTransformerPath: path.resolve(__dirname, 'rn-transformer.js'),
  },
}

module.exports = config
