// @flow
/* eslint-disable no-restricted-globals */
/* eslint-disable global-require */
/* eslint-disable import/no-mutable-exports */

import LokiWorker from './lokiWorker'

// In a web browser, Webpack will spin up a web worker and run this code there, while the importing
// module will see a Worker class.
// But Jest will actually import this file and has to provide a Worker interface, so we export a mock
const getDefaultExport = () => {
  if (process.env.NODE_ENV === 'test') {
    const workerMock = require('./workerMock').default
    return workerMock
  }

  self.workerClass = new LokiWorker(self)
  return self
}

export default getDefaultExport()
