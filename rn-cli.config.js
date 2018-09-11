const blacklist = require('metro/src/blacklist')
const path = require('path')

const config = {
  getBlacklistRE() {
    // delete __tests__ from the default blacklist
    const defaultPattern = blacklist()
      .toString()
      .slice(1, -1)
    const newPattern = defaultPattern.replace(`|.*\\/__tests__\\/.*`, '')

    return RegExp(newPattern)
  },
  getTransformModulePath() {
    return path.resolve(__dirname, 'rn-transformer.js')
  },
}

module.exports = config
