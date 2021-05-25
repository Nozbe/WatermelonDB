// @flow
/* eslint-disable no-restricted-globals */
/* eslint-disable global-require */

import DatabaseBridge from './DatabaseBridge'
import type Worker from './synchronousWorker'

// In a web browser, Webpack will spin up a web worker and run this code there, while the importing
// module will see a Worker class.
// But Jest will actually import this file and has to provide a Worker interface, so we export a mock
const getDefaultExport = (): any => {
  self.workerClass = new DatabaseBridge(self)
  return self
}

export default (getDefaultExport(): Worker)
