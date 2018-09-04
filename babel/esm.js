const moduleResolver = require('babel-plugin-module-resolver').default
const normalizeOptions = require('babel-plugin-module-resolver/lib/normalizeOptions').default
const buildPaths = require('../esm/path-mapping')

module.exports = plugin => {
  const resolver = moduleResolver(plugin)
  return {
    ...resolver,
    pre(file) {
      this.opts = {
        alias: buildPaths(),
      }

      this.types = plugin.types
      this.normalizedOpts = normalizeOptions(file.opts.filename, this.opts)
      this.moduleResolverVisited = new Set()
    },
  }
}
