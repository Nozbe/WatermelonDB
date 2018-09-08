const blacklist = require('metro/src/blacklist')

const config = {
  getBlacklistRE() {
    // delete __tests__ from the default blacklist
    const defaultPattern = blacklist()
      .toString()
      .slice(1, -1)
    const newPattern = defaultPattern.replace(`|.*\\/__tests__\\/.*`, '')

    return RegExp(newPattern)
  },
}

module.exports = config
