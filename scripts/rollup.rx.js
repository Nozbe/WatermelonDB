const rxjs = require('rxjs/_esm2015/path-mapping')

const { keys } = require('rambdax')

const rxPaths = rxjs()

class RxResolver {
  resolveId(id) {
    // TODO:
    if (id.startsWith('rxjs')) {
      const esm = id.replace('rxjs/', '')

      return rxPaths[id] ?
        `${__dirname}/node_modules/${rxPaths[id]}.js` :
        `${__dirname}/node_modules/rxjs/_esm2015/internal/${
            esm === 'operators' ? `${esm}/index.js` : esm
          }`
    }

    return undefined
  }
}

const rollupRx = config => new RxResolver(config)
const rxExternalPaths = keys(rxPaths)

module.exports = { rollupRx, rxExternalPaths }
