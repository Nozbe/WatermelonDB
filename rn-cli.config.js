const blacklist = require('metro/src/blacklist')

const config = {
  getBlacklistRE() {
    // delete __tests__ from the default blacklist
    const defaultPattern = blacklist()
      .toString()
      .slice(1, -1)
    let newPattern = defaultPattern.replace(`|.*\\/__tests__\\/.*`, '')
    newPattern += '|dist\\/.*'

    return RegExp(newPattern)
  },
}

module.exports = config
