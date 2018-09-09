// @flow
/* eslint-disable no-restricted-globals */
/* eslint-disable global-require */
/* eslint-disable import/no-mutable-exports */

import LokiWorker from './lokiWorker'

let defaultExport

// In a web browser, Webpack will spin up a web worker and run this code there, while the importing
// module will see a Worker class.
// But Jest will actually import this file and has to provide a Worker interface, so we export a mock

if (process.env.NODE_ENV === 'test') {
  const workerMock = require('./workerMock').default
  defaultExport = workerMock
} else {
  self.workerClass = new LokiWorker(self)
  defaultExport = self
}

export default defaultExport
