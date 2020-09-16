const blacklist = require('metro-config/src/defaults/blacklist')
const path = require('path')

module.exports = {
  resolver: {
    blacklistRE: blacklist([/dist\/.*/, /\/dev\/.*/]),
  },
  projectRoot: path.resolve(__dirname),
}
